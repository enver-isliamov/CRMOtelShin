import { Pool } from 'pg';

// Cache the database pool for reuse across function invocations in Vercel environment
let cachedPool: Pool | null = null;

/**
 * Initializes and returns a PostgreSQL connection pool.
 */
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

/**
 * Helper to send messages via Telegram Bot API.
 */
async function crmSendMessage(chatId: string, message: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: String(chatId),
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (e) {
        console.error("Telegram Send Error:", e);
    }
}

/**
 * Helper to log history events into the Postgres database.
 */
async function logHistory(pool: Pool, clientId: string, user: string, action: string, details: string) {
    try {
        await pool.query(
            'INSERT INTO history (client_id, user_name, action, details) VALUES ($1, $2, $3, $4)',
            [clientId, user, action, details]
        );
    } catch (e) {
        console.error("History Logging Error:", e);
    }
}

/**
 * Main Vercel Serverless Function handler for CRM API requests.
 */
export default async function handler(req: any, res: any) {
    // Only allow POST requests for this endpoint
    if (req.method !== 'POST') return res.status(405).end();
    
    // Fix: Define body, action, user, pool, and result variables in the handler scope to resolve 1-based line errors
    const body = req.body;
    const action = body.action;
    const user = body.user || 'System';
    const pool = getDbPool();
    let result: any = { status: 'error', message: 'Unknown action: ' + action };

    try {
        switch (action) {
            case 'testconnection':
                result = { status: 'success', message: 'Vercel Postgres Connection OK' };
                break;

            case 'get_client_by_chatid':
                // Fix: Find client data by Chat ID using pg pool as used in line 19
                const gcRes2 = await pool.query(`
                    SELECT data FROM clients 
                    WHERE (data->>'Chat ID' = $1 OR data->>'Chat ID' = $2)
                    AND is_archived = FALSE 
                    LIMIT 1
                `, [body.chatId, String(body.chatId)]);
                result = { status: 'success', client: gcRes2.rows[0]?.data };
                break;

            case 'lk_pickup':
                // Fix: Handle pickup request using provided snippet logic and defined helper functions
                const pickupMsg = `🚗 <b>ЗАЯВКА НА ВЫДАЧУ (ЛК)</b>\n\n👤 <b>Клиент:</b> ${body.name}\n📄 <b>Договор:</b> <code>${body.contract}</code>\n🆔 <b>ChatID:</b> <code>${body.chatId}</code>`;
                await crmSendMessage(process.env.ADMIN_CHAT_ID || body.chatId, pickupMsg);
                await logHistory(pool, body.contract || 'LK', user, 'Заявка на выдачу', 'Через Mini App');
                result = { status: 'success' };
                break;

            case 'lk_extend':
                // Fix: Handle extension request using provided snippet logic and defined helper functions
                const extendMsg = `📅 <b>ЗАЯВКА НА ПРОДЛЕНИЕ (ЛК)</b>\n\n👤 <b>Клиент:</b> ${body.name}\n📄 <b>Договор:</b> <code>${body.contract}</code>\n🆔 <b>ChatID:</b> <code>${body.chatId}</code>`;
                await crmSendMessage(process.env.ADMIN_CHAT_ID || body.chatId, extendMsg);
                await logHistory(pool, body.contract || 'LK', user, 'Заявка на продление', 'Через Mini App');
                result = { status: 'success' };
                break;

            case 'getclients':
                // Implementation for fetching clients and archive for the Vercel backend
                const clientsRes = await pool.query('SELECT data FROM clients WHERE is_archived = FALSE');
                const archiveRes = await pool.query('SELECT data FROM clients WHERE is_archived = TRUE');
                result = { 
                    status: 'success', 
                    clients: clientsRes.rows.map(r => r.data),
                    archive: archiveRes.rows.map(r => r.data)
                };
                break;

            case 'getmasters':
                const mastersRes = await pool.query('SELECT data FROM masters');
                result = { status: 'success', masters: mastersRes.rows.map(r => r.data) };
                break;

            case 'gettemplates':
                const templatesRes = await pool.query('SELECT data FROM templates');
                result = { status: 'success', templates: templatesRes.rows.map(r => r.data) };
                break;
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error("CRM Handler Error:", error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
}