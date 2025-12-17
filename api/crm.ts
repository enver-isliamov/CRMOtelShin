
import { Pool } from 'pg';

// Инициализация пула вне хендлера
const connectionString = process.env.POSTGRES_URL || process.env.STOREGE_POSTGRES_URL;

// Создаем пул только если есть строка подключения, иначе ошибка будет внутри хендлера
let pool: Pool | null = null;
if (connectionString) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false // Важно для Supabase/Neon/Heroku
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
}

export default async function handler(req: any, res: any) {
  // CORS Headers для всех ответов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обрабатываем CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    if (!pool) {
        throw new Error("Connection string not found (POSTGRES_URL)");
    }

    // В Vercel Node Runtime req.body уже является объектом, если Content-Type: application/json
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
        result = { status: 'success', message: 'Postgres (pg) Connected!', version: 'Vercel-PG-1.0' };
        break;

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
            newClient.id,
            newClient['Договор'] || '',
            newClient['Имя клиента'] || '',
            newClient['Телефон'] || '',
            newClient['Статус сделки'] || 'На складе',
            JSON.stringify(newClient)
          ]
        );
        
        await pool.query(
            `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
            [newClient.id, 'Клиент создан', 'New record', user]
        );
        result = { status: 'success', newId: newClient.id };
        break;

      case 'update':
        const clientToUpdate = body.client;
        const id = clientToUpdate.id;
        
        await pool.query(
          `UPDATE clients 
           SET 
             contract = $1,
             name = $2,
             phone = $3,
             status = $4,
             data = data || $5::jsonb, 
             updated_at = NOW()
           WHERE id = $6`,
           [
             clientToUpdate['Договор'] || null,
             clientToUpdate['Имя клиента'] || null,
             clientToUpdate['Телефон'] || null,
             clientToUpdate['Статус сделки'] || null,
             JSON.stringify(clientToUpdate),
             id
           ]
        );
        
        await pool.query(
            `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
            [id, 'Данные обновлены', 'Update record', user]
        );
        result = { status: 'success', message: 'Updated' };
        break;

      case 'reorder':
        const oldClientId = body.oldClientId;
        const newOrderData = body.client;
        
        // 1. Archive old
        await pool.query(`UPDATE clients SET is_archived = TRUE, status = 'В архиве', updated_at = NOW() WHERE id = $1`, [oldClientId]);
        
        // 2. Create new
        if (!newOrderData.id || newOrderData.id === oldClientId) { newOrderData.id = `vc_ro_${Date.now()}`; }
        
        await pool.query(
          `INSERT INTO clients (id, contract, name, phone, status, data, is_archived)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
          [
            newOrderData.id,
            newOrderData['Договор'] || '',
            newOrderData['Имя клиента'] || '',
            newOrderData['Телефон'] || '',
            newOrderData['Статус сделки'] || 'На складе',
            JSON.stringify(newOrderData)
          ]
        );

        await pool.query(
            `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
            [oldClientId, 'Архивация (Reorder)', 'Moved to archive', user]
        );
        await pool.query(
            `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
            [newOrderData.id, 'Новый заказ (Reorder)', 'Created from previous', user]
        );
        result = { status: 'success', message: 'Reordered', newId: newOrderData.id };
        break;

      case 'delete':
        await pool.query(`DELETE FROM clients WHERE id = $1`, [body.clientId]);
        result = { status: 'success', message: 'Deleted' };
        break;
        
      case 'gethistory':
         const historyRes = await pool.query(`SELECT * FROM history WHERE client_id = $1 ORDER BY created_at DESC`, [body.clientId]);
         const history = historyRes.rows.map(row => ({ id: row.id, clientId: row.client_id, timestamp: row.created_at, user: row.user_name, action: row.action, details: row.details }));
         result = { status: 'success', history };
         break;

      default:
        result = { status: 'error', message: `Action ${action} not implemented in Vercel backend yet` };
    }

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('[CRM API] Error:', error);
    
    if (error.message && (error.message.includes('Connection string') || error.code === 'ENOTFOUND')) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Ошибка подключения к БД: проверьте POSTGRES_URL. ' + error.message 
        });
    }

    return res.status(500).json({ status: 'error', message: (error as Error).message });
  }
}
