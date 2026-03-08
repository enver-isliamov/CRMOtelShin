import { Pool } from 'pg';

let cachedPool: Pool | null = null;

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

function getDbPool() {
    if (cachedPool) return cachedPool;
    const rawConnectionString = process.env.POSTGRES_URL || process.env.STOREGE_POSTGRES_URL;
    if (!rawConnectionString) throw new Error("POSTGRES_URL is not defined");
    
    const connectionString = getCleanConnectionString(rawConnectionString);

    cachedPool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 10000,
    });
    return cachedPool;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegram(method: string, payload: any) {
    return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

export default async function handler(req: any, res: any) {
    const pool = getDbPool();

    if (req.method === 'GET') {
        const { client_id, chat_id, mode } = req.query;

        if (mode === 'chats') {
            // Get list of chats with latest message
            try {
                const result = await pool.query(`
                    SELECT DISTINCT ON (chat_id) 
                        chat_id, 
                        client_id, 
                        content, 
                        created_at,
                        direction
                    FROM messages
                    ORDER BY chat_id, created_at DESC
                `);
                
                // Enrich with client info
                const chats = await Promise.all(result.rows.map(async (chat) => {
                    let clientName = 'Unknown';
                    if (chat.client_id) {
                         const clientRes = await pool.query('SELECT data FROM clients WHERE id = $1', [chat.client_id]);
                         if (clientRes.rows[0]) {
                             clientName = clientRes.rows[0].data['Имя клиента'];
                         }
                    } else {
                        // Try to find client by chat_id if client_id is missing in message
                        const clientRes = await pool.query(`
                            SELECT data FROM clients 
                            WHERE data->>'Chat ID' = $1 
                            LIMIT 1
                        `, [chat.chat_id]);
                        if (clientRes.rows[0]) {
                             clientName = clientRes.rows[0].data['Имя клиента'];
                        }
                    }
                    return { ...chat, client_name: clientName };
                }));

                return res.status(200).json(chats);
            } catch (e: any) {
                return res.status(500).json({ error: e.message });
            }
        }

        if (chat_id) {
            try {
                const result = await pool.query(`
                    SELECT * FROM messages 
                    WHERE chat_id = $1 
                    ORDER BY created_at ASC
                `, [chat_id]);
                return res.status(200).json(result.rows);
            } catch (e: any) {
                return res.status(500).json({ error: e.message });
            }
        }
        
        return res.status(400).json({ error: "Missing chat_id or mode" });
    }

    if (req.method === 'POST') {
        const { chat_id, text, client_id } = req.body;

        if (!chat_id || !text) {
            return res.status(400).json({ error: "Missing chat_id or text" });
        }

        try {
            // 1. Send to Telegram
            const tgRes = await sendTelegram('sendMessage', {
                chat_id,
                text,
                parse_mode: 'HTML'
            });
            const tgData = await tgRes.json();

            if (!tgData.ok) {
                throw new Error(tgData.description);
            }

            // 2. Save to DB
            await pool.query(
                `INSERT INTO messages (client_id, chat_id, direction, type, content, status, external_id)
                 VALUES ($1, $2, 'outbound', 'text', $3, 'sent', $4)`,
                [client_id, chat_id, text, String(tgData.result.message_id)]
            );

            return res.status(200).json({ success: true });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).end();
}
