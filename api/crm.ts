
import { Pool } from 'pg';

let cachedPool: Pool | null = null;

// Fix: Implement database pool initialization using environment variables
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

// Fix: Restore full handler logic for all CRM actions
export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
    }

    const payload = req.body;
    const { action } = payload;
    const pool = getDbPool();

    try {
        switch (action) {
            case 'testconnection':
                await pool.query('SELECT 1');
                return res.status(200).json({ status: 'success', message: 'Vercel Postgres Connected' });

            case 'getclients':
                const clientsRes = await pool.query('SELECT data FROM clients WHERE is_archived = FALSE ORDER BY created_at DESC');
                const archiveRes = await pool.query('SELECT data FROM clients WHERE is_archived = TRUE ORDER BY updated_at DESC');
                return res.status(200).json({ 
                    status: 'success', 
                    clients: clientsRes.rows.map(r => r.data),
                    archive: archiveRes.rows.map(r => r.data)
                });

            case 'add':
                const newClient = payload.client;
                await pool.query(
                    'INSERT INTO clients (id, contract, name, phone, status, data) VALUES ($1, $2, $3, $4, $5, $6)',
                    [newClient.id, newClient['Договор'], newClient['Имя клиента'], newClient['Телефон'], newClient['Статус сделки'], JSON.stringify(newClient)]
                );
                return res.status(200).json({ status: 'success', newId: newClient.id });

            case 'update':
                const updatedClient = payload.client;
                await pool.query(
                    'UPDATE clients SET contract = $1, name = $2, phone = $3, status = $4, data = $5, updated_at = NOW() WHERE id = $6',
                    [updatedClient['Договор'], updatedClient['Имя клиента'], updatedClient['Телефон'], updatedClient['Статус сделки'], JSON.stringify(updatedClient), updatedClient.id]
                );
                return res.status(200).json({ status: 'success' });

            case 'delete':
                await pool.query('DELETE FROM clients WHERE id = $1', [payload.clientId]);
                return res.status(200).json({ status: 'success' });

            case 'bulkdelete':
                if (payload.clientIds && payload.clientIds.length > 0) {
                    await pool.query('DELETE FROM clients WHERE id = ANY($1)', [payload.clientIds]);
                }
                return res.status(200).json({ status: 'success' });

            case 'reorder':
                const { oldClientId, client: reorderClient } = payload;
                await pool.query('UPDATE clients SET is_archived = TRUE, updated_at = NOW() WHERE id = $1', [oldClientId]);
                await pool.query(
                    'INSERT INTO clients (id, contract, name, phone, status, data) VALUES ($1, $2, $3, $4, $5, $6)',
                    [reorderClient.id, reorderClient['Договор'], reorderClient['Имя клиента'], reorderClient['Телефон'], reorderClient['Статус сделки'], JSON.stringify(reorderClient)]
                );
                return res.status(200).json({ status: 'success', newId: reorderClient.id });

            case 'getarchived':
                const { clientId: targetId } = payload;
                const cRes = await pool.query('SELECT data->>\'Телефон\' as phone FROM clients WHERE id = $1', [targetId]);
                if (cRes.rowCount === 0) return res.status(200).json({ status: 'success', orders: [] });
                const phoneNum = cRes.rows[0].phone;
                const histRes = await pool.query('SELECT data FROM clients WHERE (data->>\'Телефон\' = $1 OR phone = $1) AND is_archived = TRUE ORDER BY updated_at DESC', [phoneNum]);
                return res.status(200).json({ status: 'success', orders: histRes.rows.map(r => r.data) });

            case 'gettemplates':
                const tRes = await pool.query('SELECT name as "Название шаблона", content as "Содержимое (HTML)" FROM templates');
                return res.status(200).json({ status: 'success', templates: tRes.rows });

            case 'addtemplate':
                const nt = payload.template;
                await pool.query('INSERT INTO templates (name, content) VALUES ($1, $2)', [nt['Название шаблона'], nt['Содержимое (HTML)']]);
                return res.status(200).json({ status: 'success' });

            case 'updatetemplate':
                const ut = payload.template;
                await pool.query('UPDATE templates SET content = $1, updated_at = NOW() WHERE name = $2', [ut['Содержимое (HTML)'], ut['Название шаблона']]);
                return res.status(200).json({ status: 'success' });

            case 'deletetemplate':
                await pool.query('DELETE FROM templates WHERE name = $1', [payload.templateName]);
                return res.status(200).json({ status: 'success' });

            case 'getmasters':
                const mRes = await pool.query('SELECT id, name as "Имя", chat_id as "chatId (Telegram)", phone as "Телефон", services as "Услуга", address as "Адрес" FROM masters');
                return res.status(200).json({ status: 'success', masters: mRes.rows });

            case 'addmaster':
                const nm = payload.master;
                await pool.query(
                    'INSERT INTO masters (id, name, chat_id, phone, services, address) VALUES ($1, $2, $3, $4, $5, $6)',
                    [nm.id, nm['Имя'], nm['chatId (Telegram)'], nm['Телефон'], nm['Услуга'], nm['Адрес']]
                );
                return res.status(200).json({ status: 'success' });

            case 'updatemaster':
                const um = payload.master;
                await pool.query(
                    'UPDATE masters SET name = $1, chat_id = $2, phone = $3, services = $4, address = $5 WHERE id = $6',
                    [um['Имя'], um['chatId (Telegram)'], um['Телефон'], um['Услуга'], um['Адрес'], um.id]
                );
                return res.status(200).json({ status: 'success' });

            case 'deletemaster':
                await pool.query('DELETE FROM masters WHERE id = $1', [payload.masterId]);
                return res.status(200).json({ status: 'success' });

            case 'gethistory':
                const ghRes = await pool.query('SELECT id, client_id as "clientId", created_at as "timestamp", user_name as "user", action, details FROM history WHERE client_id = $1 ORDER BY created_at DESC', [payload.clientId]);
                return res.status(200).json({ status: 'success', history: ghRes.rows });

            case 'getlogs':
                const glRes = await pool.query('SELECT created_at as "timestamp", \'INFO\' as "level", user_name as "user", action, \'\' as "message", details FROM history ORDER BY created_at DESC LIMIT 50');
                return res.status(200).json({ status: 'success', logs: glRes.rows });

            case 'getphotos':
                return res.status(200).json({ status: 'success', photoUrls: [] });

            case 'sendMessage':
                const msgRes = await crmSendMessage(payload.chatId, payload.message);
                return res.status(200).json({ status: 'success', ...msgRes });

            case 'import':
                const { clients: cData, archive: aData, masters: mData, templates: tData } = payload;
                if (cData) {
                    for (const c of cData) {
                        await pool.query(
                            'INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, FALSE, $6) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
                            [c.id, c['Договор'], c['Имя клиента'], c['Телефон'], c['Статус сделки'], JSON.stringify(c)]
                        );
                    }
                }
                if (aData) {
                     for (const c of aData) {
                        await pool.query(
                            'INSERT INTO clients (id, contract, name, phone, status, is_archived, data) VALUES ($1, $2, $3, $4, $5, TRUE, $6) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
                            [c.id, c['Договор'], c['Имя клиента'], c['Телефон'], c['Статус сделки'], JSON.stringify(c)]
                        );
                    }
                }
                if (mData) {
                    for (const m of mData) {
                         await pool.query(
                            'INSERT INTO masters (id, name, chat_id, phone, services, address) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
                            [m.id, m['Имя'], m['chatId (Telegram)'], m['Телефон'], m['Услуга'], m['Адрес']]
                        );
                    }
                }
                if (tData) {
                     for (const t of tData) {
                         await pool.query(
                            'INSERT INTO templates (name, content) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content',
                            [t['Название шаблона'], t['Содержимое (HTML)']]
                        );
                    }
                }
                return res.status(200).json({ status: 'success' });

            case 'reset_db':
                await pool.query('TRUNCATE clients, history, masters, templates, bot_sessions');
                return res.status(200).json({ status: 'success' });

            case 'get_client_by_chatid':
                const gcRes2 = await pool.query('SELECT data FROM clients WHERE (data->>\'Chat ID\' = $1 OR data->>\'Chat ID\' = $2) AND is_archived = FALSE LIMIT 1', [payload.chatId, String(payload.chatId)]);
                return res.status(200).json({ status: 'success', client: gcRes2.rows[0]?.data });

            case 'set_bot_webhook':
                const botToken = process.env.TELEGRAM_BOT_TOKEN;
                const hook = `https://${process.env.VERCEL_URL}/api/bot`;
                const whRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${hook}`);
                const whData = await whRes.json();
                return res.status(200).json({ status: whData.ok ? 'success' : 'error', message: whData.description });

            default:
                return res.status(400).json({ status: 'error', message: 'Unknown action: ' + action });
        }
    } catch (error: any) {
        console.error('CRM API Error:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Fix: Provide full implementation for crmSendMessage with WebApp button logic
async function crmSendMessage(chatId: string | number, message: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not defined");

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

    // Если это чек или детали заказа, добавляем кнопку открытия WebApp
    if (message.includes('ДЕТАЛИ ЗАКАЗА') || message.includes('ЧЕК')) {
        const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : '');
        if (vercelUrl) {
            payload.reply_markup = {
                inline_keyboard: [
                    [{ 
                        text: "📱 Открыть Личный Кабинет", 
                        web_app: { url: `${vercelUrl}/#/tg-lk` } 
                    }]
                ]
            };
        }
    }

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const tgData = await tgResponse.json();
    return { success: tgData.ok, message: tgData.ok ? 'Sent' : tgData.description };
}
