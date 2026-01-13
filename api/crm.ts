import { Pool } from 'pg';

let cachedPool: Pool | null = null;

// Clean connection string to prevent conflicts with JS config
function getCleanConnectionString(url: string) {
  try {
    const connectionUrl = new URL(url);
    connectionUrl.searchParams.delete('sslmode');
    connectionUrl.searchParams.delete('sslrootcert');
    return connectionUrl.toString();
  } catch (e) {
    return url;
  }
}

// Initialize or retrieve the Postgres database pool.
function getDbPool() {
  if (cachedPool) return cachedPool;
  
  const rawConnectionString = 
    process.env.POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING || 
    process.env.DATABASE_URL;

  if (!rawConnectionString) {
    console.error("DATABASE_ERROR: No connection string found in environment variables.");
    throw new Error("POSTGRES_URL is not defined. Check Vercel Environment Variables.");
  }

  const connectionString = getCleanConnectionString(rawConnectionString);
  
  cachedPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Обязательно для Vercel/Neon
    max: 10,
    connectionTimeoutMillis: 10000,
  });
  
  return cachedPool;
}

// Log an action to the history table.
async function logHistory(pool: Pool, clientId: string, user: string, action: string, details: string) {
  try {
    await pool.query(
      'INSERT INTO history (client_id, user_name, action, details) VALUES ($1, $2, $3, $4)',
      [clientId, user, action, details]
    );
  } catch (e) {
    console.warn("History log failed:", e);
  }
}

// Send a Telegram message using the bot token from environment variables.
async function crmSendMessage(chatId: string | number, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  
  const sanitized = message
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p.*?>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text: sanitized,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error("TG Send failed:", e);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  
  let pool;
  try {
    pool = getDbPool();
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: "Configuration Error: " + e.message });
  }

  // ROBUST BODY PARSING
  let payload = req.body;
  if (typeof payload === 'string') {
      try {
          payload = JSON.parse(payload);
      } catch (e) {
          console.error("Failed to parse string body:", payload);
      }
  }

  if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ status: 'error', message: 'Invalid request body (JSON expected)' });
  }

  const action = payload.action;
  const user = payload.user || 'System';
  
  let result: any = { status: 'success' };
  
  try {
    switch (action) {
      case 'testconnection':
        const dbRes = await pool.query('SELECT NOW() as now, current_database() as db');
        result.message = "Соединение с Vercel Postgres успешно!";
        result.details = `Database: ${dbRes.rows[0].db}, Server Time: ${dbRes.rows[0].now}`;
        break;

      case 'getclients':
        const clientsRes = await pool.query('SELECT data FROM clients WHERE is_archived = FALSE ORDER BY created_at DESC');
        const archiveRes = await pool.query('SELECT data FROM clients WHERE is_archived = TRUE ORDER BY updated_at DESC');
        result.clients = clientsRes.rows.map(r => r.data);
        result.archive = archiveRes.rows.map(r => r.data);
        break;

      case 'add':
        const newClient = payload.client;
        await pool.query(
          'INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [newClient.id, newClient['Договор'], newClient['Имя клиента'], newClient['Телефон'], newClient['Статус сделки'], false, JSON.stringify(newClient)]
        );
        await logHistory(pool, newClient.id, user, 'Клиент создан', 'Добавлен через CRM');
        break;

      case 'update':
        const updatedClient = payload.client;
        await pool.query(
          'UPDATE clients SET contract = $1, name = $2, phone = $3, status = $4, data = $5, updated_at = NOW() WHERE id = $6',
          [updatedClient['Договор'], updatedClient['Имя клиента'], updatedClient['Телефон'], updatedClient['Статус сделки'], JSON.stringify(updatedClient), updatedClient.id]
        );
        await logHistory(pool, updatedClient.id, user, 'Данные обновлены', 'Изменено в CRM');
        break;

      case 'delete':
        await pool.query('DELETE FROM clients WHERE id = $1', [payload.clientId]);
        break;

      case 'bulkdelete':
        await pool.query('DELETE FROM clients WHERE id = ANY($1)', [payload.clientIds]);
        break;

      case 'reorder':
        const oldId = payload.oldClientId;
        const freshData = payload.client;
        await pool.query('UPDATE clients SET is_archived = TRUE WHERE id = $1', [oldId]);
        await pool.query(
            'INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [freshData.id, freshData['Договор'], freshData['Имя клиента'], freshData['Телефон'], freshData['Статус сделки'], false, JSON.stringify(freshData)]
        );
        await logHistory(pool, oldId, user, 'Заказ архивирован', 'Перенос в архив');
        await logHistory(pool, freshData.id, user, 'Новый заказ создан', 'Повторный заказ');
        break;

      case 'getarchived':
        const clientLookupRes = await pool.query('SELECT data->>\'Телефон\' as phone FROM clients WHERE id = $1', [payload.clientId]);
        if (clientLookupRes.rowCount > 0) {
            const phone = clientLookupRes.rows[0].phone;
            const archRes = await pool.query('SELECT data FROM clients WHERE is_archived = TRUE AND (phone = $1 OR data->>\'Телефон\' = $1)', [phone]);
            result.orders = archRes.rows.map(r => r.data);
        } else {
            result.orders = [];
        }
        break;

      case 'gettemplates':
        const tRes = await pool.query('SELECT name as "Название шаблона", content as "Содержимое (HTML)" FROM templates');
        result.templates = tRes.rows;
        break;

      case 'addtemplate':
        await pool.query('INSERT INTO templates (name, content) VALUES ($1, $2)', [payload.template['Название шаблона'], payload.template['Содержимое (HTML)']]);
        break;

      case 'updatetemplate':
        await pool.query('UPDATE templates SET content = $1, updated_at = NOW() WHERE name = $2', [payload.template['Содержимое (HTML)'], payload.template['Название шаблона']]);
        break;

      case 'deletetemplate':
        await pool.query('DELETE FROM templates WHERE name = $1', [payload.templateName]);
        break;

      case 'get_client_by_chatid':
        const gcRes2 = await pool.query(`
            SELECT data FROM clients 
            WHERE (data->>'Chat ID' = $1 OR data->>'Chat ID' = $2)
            AND is_archived = FALSE 
            LIMIT 1
        `, [payload.chatId, String(payload.chatId)]);
        result.client = gcRes2.rows[0]?.data;
        break;

      case 'submit_lead':
        const { phone: leadPhone, name: leadName, chatId: leadChatId, username: leadUsername } = payload;
        const adminMsg = `🔥 <b>НОВЫЙ ЛИД ИЗ MINI APP</b>\n\n👤 <b>Имя:</b> ${leadName}\n📞 <b>Тел:</b> <code>${leadPhone}</code>\n🔗 <b>TG:</b> @${leadUsername || '—'}\n🆔 <b>ID:</b> <code>${leadChatId}</code>`;
        await crmSendMessage(process.env.ADMIN_CHAT_ID || leadChatId, adminMsg);
        await logHistory(pool, 'LEAD', user, 'Новая заявка (Mini App)', `Лид: ${leadName}, ${leadPhone}`);
        result.message = 'Lead submitted';
        break;

      case 'getmasters':
        const mRes = await pool.query('SELECT id, name as "Имя", chat_id as "chatId (Telegram)", services as "Услуга", phone as "Телефон", address as "Адрес" FROM masters');
        result.masters = mRes.rows;
        break;

      case 'addmaster':
        const masterToAdd = payload.master;
        await pool.query('INSERT INTO masters (id, name, chat_id, services, phone, address) VALUES ($1, $2, $3, $4, $5, $6)', [masterToAdd.id, masterToAdd['Имя'], masterToAdd['chatId (Telegram)'], masterToAdd['Услуга'], masterToAdd['Телефон'], masterToAdd['Адрес']]);
        break;

      case 'updatemaster':
        const masterToUpdate = payload.master;
        await pool.query('UPDATE masters SET name = $1, chat_id = $2, services = $3, phone = $4, address = $5 WHERE id = $6', [masterToUpdate['Имя'], masterToUpdate['chatId (Telegram)'], masterToUpdate['Услуга'], masterToUpdate['Телефон'], masterToUpdate['Адрес'], masterToUpdate.id]);
        break;

      case 'deletemaster':
        await pool.query('DELETE FROM masters WHERE id = $1', [payload.masterId]);
        break;

      case 'gethistory':
        const hRes = await pool.query('SELECT * FROM history WHERE client_id = $1 ORDER BY created_at DESC', [payload.clientId]);
        result.history = hRes.rows.map(r => ({
            id: String(r.id),
            clientId: r.client_id,
            timestamp: r.created_at.toISOString(),
            user: r.user_name,
            action: r.action,
            details: r.details
        }));
        break;

      case 'getlogs':
        const lRes = await pool.query('SELECT created_at as timestamp, \'INFO\' as level, user_name as user, action, details as message, details FROM history ORDER BY created_at DESC LIMIT 50');
        result.logs = lRes.rows;
        break;

      case 'sendMessage':
        await crmSendMessage(payload.chatId, payload.message);
        result.message = "Сообщение отправлено";
        break;

      case 'reset_db':
        await pool.query('TRUNCATE clients, history, masters, templates, bot_sessions');
        result.message = "Database reset successful";
        break;

      case 'set_bot_webhook':
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const webhookUrl = `https://${process.env.VERCEL_URL}/api/bot`;
        const hookResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
        const hookData = await hookResponse.json();
        result.message = hookData.description || "Webhook updated";
        break;

      case 'import':
        // FIX: Handle missing IDs by generating defaults to satisfy NOT NULL constraint
        if (payload.clients && Array.isArray(payload.clients)) {
            for (const c of payload.clients) {
                const clientId = c.id || `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                // Ensure the stored JSON also has the ID
                const clientData = { ...c, id: clientId };
                
                await pool.query('INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', 
                [clientId, c['Договор'], c['Имя клиента'], c['Телефон'], c['Статус сделки'], false, JSON.stringify(clientData)]);
            }
        }
        if (payload.archive && Array.isArray(payload.archive)) {
            for (const c of payload.archive) {
                const clientId = c.id || `a_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                const clientData = { ...c, id: clientId };

                await pool.query('INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', 
                [clientId, c['Договор'], c['Имя клиента'], c['Телефон'], c['Статус сделки'], true, JSON.stringify(clientData)]);
            }
        }
        if (payload.masters && Array.isArray(payload.masters)) {
            for (const m of payload.masters) {
                const masterId = m.id || `m_${Date.now()}_${Math.random()}`;
                await pool.query('INSERT INTO masters (id, name, chat_id, services, phone, address) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
                [masterId, m['Имя'], m['chatId (Telegram)'], m['Услуга'], m['Телефон'], m['Адрес']]);
            }
        }
        if (payload.templates && Array.isArray(payload.templates)) {
            for (const t of payload.templates) {
                await pool.query('INSERT INTO templates (name, content) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content',
                [t['Название шаблона'], t['Содержимое (HTML)']]);
            }
        }
        break;
        
      default:
        result.status = 'error';
        result.message = 'Unknown action: ' + action;
    }

    return res.status(200).json(result);
  } catch (e: any) {
    console.error("CRM Handler Error:", e);
    return res.status(500).json({ status: 'error', message: e.message });
  }
}
