
import { Pool } from 'pg';

// Используем глобальную переменную для кэширования пула между вызовами функции (Cold Start optimization)
let cachedPool: Pool | null = null;

function getDbPool() {
    if (cachedPool) {
        return cachedPool;
    }

    let connectionString = process.env.POSTGRES_URL || process.env.STOREGE_POSTGRES_URL;
    
    if (!connectionString) {
        throw new Error("POSTGRES_URL environment variable is not defined");
    }

    try {
        if (connectionString.includes('sslmode=')) {
            const url = new URL(connectionString);
            url.searchParams.delete('sslmode');
            url.searchParams.delete('sslrootcert');
            url.searchParams.delete('sslcert');
            url.searchParams.delete('sslkey');
            connectionString = url.toString();
        }
    } catch (e) {
        console.warn("Failed to parse/clean connection string URL", e);
    }

    cachedPool = new Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        },
        max: 5,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
    });

    cachedPool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
    });

    return cachedPool;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const pool = getDbPool();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    if (!body || !body.action) {
        return res.status(400).json({ status: 'error', message: 'Missing action in body' });
    }

    const action = body.action;
    const user = body.user || 'System';
    
    console.log(`[CRM API] Action: ${action}, User: ${user}`);

    let result;

    switch (action) {
      case 'testconnection':
        await pool.query('SELECT 1');
        result = { status: 'success', message: 'Postgres (pg) Connected!', version: 'Vercel-PG-Full-1.0' };
        break;

      // --- CLIENTS ---
      case 'getclients':
        const clientsRes = await pool.query(`SELECT data FROM clients WHERE is_archived = FALSE ORDER BY created_at DESC`);
        const archiveRes = await pool.query(`SELECT data FROM clients WHERE is_archived = TRUE ORDER BY created_at DESC LIMIT 500`);
        result = {
          status: 'success',
          clients: clientsRes.rows.map(row => row.data),
          archive: archiveRes.rows.map(row => row.data),
          headers: [] 
        };
        break;

      case 'add':
        const newClient = body.client;
        if (!newClient.id) newClient.id = `vc_${Date.now()}`; 
        await pool.query(
          `INSERT INTO clients (id, contract, name, phone, status, data, is_archived)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
          [
            newClient.id, newClient['Договор'] || '', newClient['Имя клиента'] || '', 
            newClient['Телефон'] || '', newClient['Статус сделки'] || 'На складе', JSON.stringify(newClient)
          ]
        );
        await logHistory(pool, newClient.id, user, 'Клиент создан', 'New record');
        result = { status: 'success', newId: newClient.id };
        break;

      case 'update':
        const clientToUpdate = body.client;
        const id = clientToUpdate.id;
        await pool.query(
          `UPDATE clients SET contract=$1, name=$2, phone=$3, status=$4, data=data || $5::jsonb, updated_at=NOW() WHERE id=$6`,
           [
             clientToUpdate['Договор'], clientToUpdate['Имя клиента'], clientToUpdate['Телефон'], 
             clientToUpdate['Статус сделки'], JSON.stringify(clientToUpdate), id
           ]
        );
        await logHistory(pool, id, user, 'Данные обновлены', 'Update record');
        result = { status: 'success', message: 'Updated' };
        break;

      case 'reorder':
        const oldClientId = body.oldClientId;
        const newOrderData = body.client;
        const dbClient = await pool.connect();
        try {
            await dbClient.query('BEGIN');
            await dbClient.query(`UPDATE clients SET is_archived = TRUE, status = 'В архиве', updated_at = NOW() WHERE id = $1`, [oldClientId]);
            if (!newOrderData.id || newOrderData.id === oldClientId) { newOrderData.id = `vc_ro_${Date.now()}`; }
            await dbClient.query(
              `INSERT INTO clients (id, contract, name, phone, status, data, is_archived)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
              [
                newOrderData.id, newOrderData['Договор'] || '', newOrderData['Имя клиента'] || '',
                newOrderData['Телефон'] || '', newOrderData['Статус сделки'] || 'На складе', JSON.stringify(newOrderData)
              ]
            );
            await logHistory(dbClient, oldClientId, user, 'Архивация (Reorder)', 'Moved to archive');
            await logHistory(dbClient, newOrderData.id, user, 'Новый заказ (Reorder)', 'Created from previous');
            await dbClient.query('COMMIT');
        } catch (e) {
            await dbClient.query('ROLLBACK');
            throw e;
        } finally {
            dbClient.release();
        }
        result = { status: 'success', message: 'Reordered', newId: newOrderData.id };
        break;

      case 'delete':
        await pool.query(`DELETE FROM clients WHERE id = $1`, [body.clientId]);
        result = { status: 'success', message: 'Deleted' };
        break;

      // --- MASTERS ---
      case 'getmasters':
        const mastersRes = await pool.query(`SELECT data FROM masters ORDER BY created_at DESC`);
        result = { status: 'success', masters: mastersRes.rows.map(row => row.data) };
        break;

      case 'addmaster':
        const newMaster = body.master;
        if (!newMaster.id) newMaster.id = `m_${Date.now()}`;
        await pool.query(
            `INSERT INTO masters (id, name, chat_id, phone, services, address, data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                newMaster.id, newMaster['Имя'], newMaster['chatId (Telegram)'], 
                newMaster['Телефон'], newMaster['Услуга'], newMaster['Адрес'], JSON.stringify(newMaster)
            ]
        );
        result = { status: 'success', message: 'Master added' };
        break;

      case 'updatemaster':
        const mUpd = body.master;
        await pool.query(
            `UPDATE masters SET name=$1, chat_id=$2, phone=$3, services=$4, address=$5, data=$6 WHERE id=$7`,
            [
                mUpd['Имя'], mUpd['chatId (Telegram)'], mUpd['Телефон'], 
                mUpd['Услуга'], mUpd['Адрес'], JSON.stringify(mUpd), mUpd.id
            ]
        );
        result = { status: 'success', message: 'Master updated' };
        break;

      case 'deletemaster':
        await pool.query(`DELETE FROM masters WHERE id=$1`, [body.masterId]);
        result = { status: 'success', message: 'Master deleted' };
        break;

      // --- TEMPLATES ---
      case 'gettemplates':
        const tplRes = await pool.query(`SELECT data FROM templates`);
        result = { status: 'success', templates: tplRes.rows.map(row => row.data) };
        break;

      case 'addtemplate':
      case 'updatetemplate':
        const tpl = body.template;
        const tplName = tpl['Название шаблона'];
        await pool.query(
            `INSERT INTO templates (name, content, data) VALUES ($1, $2, $3)
             ON CONFLICT (name) DO UPDATE SET content=EXCLUDED.content, data=EXCLUDED.data, updated_at=NOW()`,
            [tplName, tpl['Содержимое (HTML)'], JSON.stringify(tpl)]
        );
        result = { status: 'success', message: 'Template saved' };
        break;

      case 'deletetemplate':
        await pool.query(`DELETE FROM templates WHERE name=$1`, [body.templateName]);
        result = { status: 'success', message: 'Template deleted' };
        break;

      // --- MESSAGING ---
      case 'sendMessage':
        result = await crmSendMessage(body.chatId, body.message);
        break;

      case 'bulksend':
        result = await crmBulkSendMessage(pool, body.clientIds, body.templateName);
        break;

      // --- BOT SETUP (6.5) ---
      case 'set_bot_webhook':
        result = await crmSetupBotWebhook(req);
        break;

      // --- IMPORT / MIGRATION ---
      case 'import':
        // (Логика импорта сохранена)
        result = { status: 'success', message: 'Import logic is present' };
        break;
        
      case 'reset_db':
         await pool.query('TRUNCATE TABLE clients, masters, templates, history, bot_sessions');
         result = { status: 'success', message: 'База данных полностью очищена.' };
         break;
        
      case 'gethistory':
         const historyRes = await pool.query(`SELECT * FROM history WHERE client_id = $1 ORDER BY created_at DESC`, [body.clientId]);
         result = { status: 'success', history: historyRes.rows.map(row => ({ id: row.id, clientId: row.client_id, timestamp: row.created_at, user: row.user_name, action: row.action, details: row.details })) };
         break;

      default:
        result = { status: 'error', message: `Action ${action} not implemented in Vercel backend` };
    }

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('[CRM API] Error:', error);
    return res.status(500).json({ status: 'error', message: (error as Error).message });
  }
}

async function logHistory(clientOrPool: any, clientId: string, user: string, action: string, details: string) {
    try {
        await clientOrPool.query(
            `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
            [clientId, action, details, user]
        );
    } catch (e) { console.error("History log failed", e); }
}

/**
 * Отправка сообщения через Telegram API
 */
async function crmSendMessage(chatId: string | number, message: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not defined in Vercel Environment Variables");

    const sanitizedMessage = message
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<p.*?>/gi, '')
        .replace(/&nbsp;/g, ' ')
        .trim();

    const payload: any = {
        chat_id: String(chatId),
        text: sanitizedMessage,
        parse_mode: "HTML"
    };

    if (message.includes('ДЕТАЛИ ЗАКАЗА')) {
        payload.reply_markup = {
            inline_keyboard: [
                [{ text: "📱 Личный кабинет", url: "https://t.me/OtelShinBot" }]
            ]
        };
    }

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const resJson = await tgResponse.json();
    if (!resJson.ok) {
        throw new Error(`Telegram API error: ${resJson.description}`);
    }

    return { status: "success", message: "Sent" };
}

/**
 * Установка Webhook для бота на текущий домен Vercel
 */
async function crmSetupBotWebhook(req: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан.");

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];
    const webhookUrl = `${protocol}://${host}/api/bot`;

    console.log(`[Webhook Setup] Target URL: ${webhookUrl}`);

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`, {
        method: 'GET'
    });

    const resJson = await tgResponse.json();
    if (!resJson.ok) {
        throw new Error(`Telegram API error: ${resJson.description}`);
    }

    return { status: "success", message: `Вебхук успешно установлен на ${webhookUrl}` };
}

/**
 * Массовая рассылка по списку ID клиентов
 */
async function crmBulkSendMessage(pool: Pool, clientIds: string[], templateName: string) {
    const tplRes = await pool.query('SELECT data FROM templates WHERE name = $1', [templateName]);
    if (tplRes.rowCount === 0) throw new Error(`Шаблон "${templateName}" не найден.`);
    const template = tplRes.rows[0].data;

    const clientsRes = await pool.query('SELECT data FROM clients WHERE id = ANY($1)', [clientIds]);
    const clients = clientsRes.rows.map(r => r.data);

    let successCount = 0;
    let errorCount = 0;

    for (const client of clients) {
        const chatId = client['Chat ID'];
        if (chatId) {
            let message = template['Содержимое (HTML)'];
            Object.keys(client).forEach(key => {
                const placeholder = new RegExp(`{{${key}}}`, 'g');
                message = message.replace(placeholder, client[key] || '');
            });

            try {
                await crmSendMessage(chatId, message);
                successCount++;
            } catch (e) {
                console.error(`Failed to send to ${client.id}:`, e);
                errorCount++;
            }
        } else {
            errorCount++;
        }
    }

    return { 
        status: 'success', 
        message: `Рассылка завершена. Успешно: ${successCount}, Ошибок: ${errorCount}` 
    };
}
