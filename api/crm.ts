import { Pool } from 'pg';

let cachedPool: Pool | null = null;

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

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).end();
    
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
                const gcRes2 = await pool.query(`
                    SELECT data FROM clients 
                    WHERE (data->>'Chat ID' = $1 OR data->>'Chat ID' = $2)
                    AND is_archived = FALSE 
                    LIMIT 1
                `, [String(body.chatId), String(body.chatId)]);
                result = { status: 'success', client: gcRes2.rows[0]?.data };
                break;

            case 'lk_pickup':
                const pickupMsg = `🚗 <b>ЗАЯВКА НА ВЫДАЧУ (ЛК)</b>\n\n👤 <b>Клиент:</b> ${body.name}\n📄 <b>Договор:</b> <code>${body.contract}</code>\n🆔 <b>ChatID:</b> <code>${body.chatId}</code>`;
                await crmSendMessage(process.env.ADMIN_CHAT_ID || body.chatId, pickupMsg);
                await logHistory(pool, body.contract || 'LK', user, 'Заявка на выдачу', 'Через Mini App');
                result = { status: 'success' };
                break;

            case 'lk_extend':
                const extendMsg = `📅 <b>ЗАЯВКА НА ПРОДЛЕНИЕ (ЛК)</b>\n\n👤 <b>Клиент:</b> ${body.name}\n📄 <b>Договор:</b> <code>${body.contract}</code>\n🆔 <b>ChatID:</b> <code>${body.chatId}</code>`;
                await crmSendMessage(process.env.ADMIN_CHAT_ID || body.chatId, extendMsg);
                await logHistory(pool, body.contract || 'LK', user, 'Заявка на продление', 'Через Mini App');
                result = { status: 'success' };
                break;

            case 'submit_lead':
                const { phone, name, chatId: leadChatId, username } = body;
                const leadMsg = `🔥 <b>НОВЫЙ ЛИД (Mini App)</b>\n\n👤 <b>Имя:</b> ${name}\n📞 <b>Тел:</b> <code>${phone}</code>\n🔗 <b>TG:</b> @${username || '-'}\n🆔 <b>ID:</b> <code>${leadChatId}</code>`;
                await crmSendMessage(process.env.ADMIN_CHAT_ID || leadChatId, leadMsg);
                await logHistory(pool, 'LEAD', user, 'Заявка от нового пользователя', `Лид: ${name}, тел: ${phone}`);
                result = { status: 'success' };
                break;

            case 'getclients':
                const clientsRes = await pool.query('SELECT data FROM clients WHERE is_archived = FALSE ORDER BY created_at DESC');
                const archiveRes = await pool.query('SELECT data FROM clients WHERE is_archived = TRUE ORDER BY created_at DESC');
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

            case 'sendMessage':
                await crmSendMessage(body.chatId, body.message);
                result = { status: 'success', message: 'Sent' };
                break;
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error("CRM Handler Error:", error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
}