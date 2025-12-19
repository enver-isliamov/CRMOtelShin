import { Pool } from 'pg';

let cachedPool: Pool | null = null;

// Initialize or retrieve the Postgres database pool.
function getDbPool() {
  if (cachedPool) return cachedPool;
  const connectionString = process.env.POSTGRES_URL || process.env.STOREGE_POSTGRES_URL;
  if (!connectionString) throw new Error("POSTGRES_URL is not defined");
  
  cachedPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    connectionTimeoutMillis: 10000,
  });
  return cachedPool;
}

// Log an action to the history table.
async function logHistory(pool: Pool, clientId: string, user: string, action: string, details: string) {
  await pool.query(
    'INSERT INTO history (client_id, user_name, action, details) VALUES ($1, $2, $3, $4)',
    [clientId, user, action, details]
  );
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

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(chatId),
      text: sanitized,
      parse_mode: 'HTML'
    })
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const pool = getDbPool();
  const payload = req.body;
  const action = payload.action;
  const user = payload.user || 'System';
  
  let result: any = { status: 'success' };
  
  try {
    switch (action) {
      case 'getclients':
        // Fetch active and archived clients.
        const clientsRes = await pool.query('SELECT data FROM clients WHERE is_archived = FALSE');
        const archiveRes = await pool.query('SELECT data FROM clients WHERE is_archived = TRUE');
        result.clients = clientsRes.rows.map(r => r.data);
        result.archive = archiveRes.rows.map(r => r.data);
        break;

      case 'add':
        // Insert a new client record.
        const newClient = payload.client;
        await pool.query(
          'INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [newClient.id, newClient['Договор'], newClient['Имя клиента'], newClient['Телефон'], newClient['Статус сделки'], false, JSON.stringify(newClient)]
        );
        await logHistory(pool, newClient.id, user, 'Клиент создан', 'Добавлен через CRM');
        break;

      case 'update':
        // Update an existing client record.
        const updatedClient = payload.client;
        await pool.query(
          'UPDATE clients SET contract = $1, name = $2, phone = $3, status = $4, data = $5, updated_at = NOW() WHERE id = $6',
          [updatedClient['Договор'], updatedClient['Имя клиента'], updatedClient['Телефон'], updatedClient['Статус сделки'], JSON.stringify(updatedClient), updatedClient.id]
        );
        await logHistory(pool, updatedClient.id, user, 'Данные обновлены', 'Изменено в CRM');
        break;

      case 'delete':
        // Permanently delete a client.
        await pool.query('DELETE FROM clients WHERE id = $1', [payload.clientId]);
        break;

      case 'bulkdelete':
        // Delete multiple clients at once.
        await pool.query('DELETE FROM clients WHERE id = ANY($1)', [payload.clientIds]);
        break;

      case 'reorder':
        // Transition an existing client to archive and create a new active record.
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
        // Fetch all archived orders for a specific client based on their phone number.
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
        // Retrieve message templates.
        const tRes = await pool.query('SELECT name as "Название шаблона", content as "Содержимое (HTML)" FROM templates');
        result.templates = tRes.rows;
        break;

      case 'addtemplate':
        // Add a new message template.
        await pool.query('INSERT INTO templates (name, content) VALUES ($1, $2)', [payload.template['Название шаблона'], payload.template['Содержимое (HTML)']]);
        break;

      case 'updatetemplate':
        // Update an existing message template.
        await pool.query('UPDATE templates SET content = $1, updated_at = NOW() WHERE name = $2', [payload.template['Содержимое (HTML)'], payload.template['Название шаблона']]);
        break;

      case 'deletetemplate':
        // Delete a message template.
        await pool.query('DELETE FROM templates WHERE name = $1', [payload.templateName]);
        break;

      case 'get_client_by_chatid':
        // Find an active client by their Telegram Chat ID.
        const gcRes2 = await pool.query(`
            SELECT data FROM clients 
            WHERE (data->>'Chat ID' = $1 OR data->>'Chat ID' = $2)
            AND is_archived = FALSE 
            LIMIT 1
        `, [payload.chatId, String(payload.chatId)]);
        result.client = gcRes2.rows[0]?.data;
        break;

      case 'submit_lead':
        // Handle a new lead from the Mini App.
        const { phone: leadPhone, name: leadName, chatId: leadChatId, username: leadUsername } = payload;
        const adminMsg = `🔥 <b>НОВЫЙ ЛИД ИЗ MINI APP</b>\n\n👤 <b>Имя:</b> ${leadName}\n📞 <b>Тел:</b> <code>${leadPhone}</code>\n🔗 <b>TG:</b> @${leadUsername || '—'}\n🆔 <b>ID:</b> <code>${leadChatId}</code>`;
        await crmSendMessage(process.env.ADMIN_CHAT_ID || leadChatId, adminMsg);
        await logHistory(pool, 'LEAD', user, 'Новая заявка (Mini App)', `Лид: ${leadName}, ${leadPhone}`);
        result.message = 'Lead submitted';
        break;

      case 'getmasters':
        // Fetch masters directory.
        const mRes = await pool.query('SELECT id, name as "Имя", chat_id as "chatId (Telegram)", services as "Услуга", phone as "Телефон", address as "Адрес" FROM masters');
        result.masters = mRes.rows;
        break;

      case 'addmaster':
        // Add a new master.
        const masterToAdd = payload.master;
        await pool.query('INSERT INTO masters (id, name, chat_id, services, phone, address) VALUES ($1, $2, $3, $4, $5, $6)', [masterToAdd.id, masterToAdd['Имя'], masterToAdd['chatId (Telegram)'], masterToAdd['Услуга'], masterToAdd['Телефон'], masterToAdd['Адрес']]);
        break;

      case 'updatemaster':
        // Update an existing master record.
        const masterToUpdate = payload.master;
        await pool.query('UPDATE masters SET name = $1, chat_id = $2, services = $3, phone = $4, address = $5 WHERE id = $6', [masterToUpdate['Имя'], masterToUpdate['chatId (Telegram)'], masterToUpdate['Услуга'], masterToUpdate['Телефон'], masterToUpdate['Адрес'], masterToUpdate.id]);
        break;

      case 'deletemaster':
        // Delete a master record.
        await pool.query('DELETE FROM masters WHERE id = $1', [payload.masterId]);
        break;

      case 'gethistory':
        // Fetch history events for a specific client.
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
        // Fetch system logs (last 50 events from history).
        const lRes = await pool.query('SELECT created_at as timestamp, \'INFO\' as level, user_name as user, action, details as message, details FROM history ORDER BY created_at DESC LIMIT 50');
        result.logs = lRes.rows;
        break;

      case 'sendMessage':
        // Send an individual Telegram message.
        await crmSendMessage(payload.chatId, payload.message);
        result.message = "Сообщение отправлено";
        break;

      case 'reset_db':
        // Destructive action: wipe the database (Vercel-only).
        await pool.query('TRUNCATE clients, history, masters, templates, bot_sessions');
        result.message = "Database reset successful";
        break;

      case 'testconnection':
        // Simple test to verify DB connectivity.
        await pool.query('SELECT 1');
        result.message = "Connection successful";
        break;

      case 'set_bot_webhook':
        // Set Telegram bot webhook to this Vercel deployment.
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const webhookUrl = `https://${process.env.VERCEL_URL}/api/bot`;
        const hookResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
        const hookData = await hookResponse.json();
        result.message = hookData.description || "Webhook updated";
        break;

      case 'import':
        // Migration tool: Import data from Google Sheets to Postgres.
        if (payload.clients && Array.isArray(payload.clients)) {
            for (const c of payload.clients) {
                await pool.query('INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', 
                [c.id, c['Договор'], c['Имя клиента'], c['Телефон'], c['Статус сделки'], false, JSON.stringify(c)]);
            }
        }
        if (payload.archive && Array.isArray(payload.archive)) {
            for (const c of payload.archive) {
                await pool.query('INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', 
                [c.id, c['Договор'], c['Имя клиента'], c['Телефон'], c['Статус сделки'], true, JSON.stringify(c)]);
            }
        }
        if (payload.masters && Array.isArray(payload.masters)) {
            for (const m of payload.masters) {
                await pool.query('INSERT INTO masters (id, name, chat_id, services, phone, address) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
                [m.id || `m_${Date.now()}_${Math.random()}`, m['Имя'], m['chatId (Telegram)'], m['Услуга'], m['Телефон'], m['Адрес']]);
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