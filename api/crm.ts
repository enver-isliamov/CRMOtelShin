
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

    // ХАК: Удаляем параметры sslmode из строки подключения, чтобы они не конфликтовали
    // с явной настройкой ssl: { rejectUnauthorized: false }
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

    // Создаем новый пул
    cachedPool = new Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false // Явно разрешаем Self-Signed сертификаты (Supabase/Neon)
        },
        max: 5, // Ограничиваем кол-во соединений для Serverless
        connectionTimeoutMillis: 10000, // 10 секунд на подключение
        idleTimeoutMillis: 30000,
    });

    // Обработка ошибок пула, чтобы процесс не падал
    cachedPool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
        // Не сбрасываем cachedPool = null, pg сам попытается переподключиться
    });

    return cachedPool;
}

export default async function handler(req: any, res: any) {
  // CORS
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
    
    // Парсинг тела запроса
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
        
        try {
            await pool.query(
                `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
                [newClient.id, 'Клиент создан', 'New record', user]
            );
        } catch (e) { console.error("History log failed", e); }

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
        
        try {
            await pool.query(
                `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
                [id, 'Данные обновлены', 'Update record', user]
            );
        } catch (e) { console.error("History log failed", e); }

        result = { status: 'success', message: 'Updated' };
        break;

      case 'reorder':
        const oldClientId = body.oldClientId;
        const newOrderData = body.client;
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Archive old
            await client.query(`UPDATE clients SET is_archived = TRUE, status = 'В архиве', updated_at = NOW() WHERE id = $1`, [oldClientId]);
            
            // 2. Create new
            if (!newOrderData.id || newOrderData.id === oldClientId) { newOrderData.id = `vc_ro_${Date.now()}`; }
            
            await client.query(
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

            await client.query(
                `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
                [oldClientId, 'Архивация (Reorder)', 'Moved to archive', user]
            );
            await client.query(
                `INSERT INTO history (client_id, action, details, user_name) VALUES ($1, $2, $3, $4)`,
                [newOrderData.id, 'Новый заказ (Reorder)', 'Created from previous', user]
            );
            
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
        
        result = { status: 'success', message: 'Reordered', newId: newOrderData.id };
        break;

      case 'import':
        // Массовый импорт для миграции
        const { clients, archive } = body;
        const importClient = await pool.connect();
        
        try {
            await importClient.query('BEGIN');
            
            let count = 0;
            const upsertQuery = `
                INSERT INTO clients (id, contract, name, phone, status, is_archived, data, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    contract = EXCLUDED.contract,
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    status = EXCLUDED.status,
                    is_archived = EXCLUDED.is_archived,
                    data = EXCLUDED.data,
                    updated_at = NOW();
            `;

            if (clients && Array.isArray(clients)) {
                for (const c of clients) {
                    // FIX: Ensure ID is never null. Use Contract or generate random if missing.
                    let clientId = c.id;
                    if (!clientId) {
                        const contractPart = c['Договор'] ? String(c['Договор']).replace(/[^a-zA-Z0-9]/g, '') : 'nocontract';
                        clientId = `mig_${contractPart}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                    }

                    // Update the object's ID as well so JSONB matches
                    const clientData = { ...c, id: clientId };

                    await importClient.query(upsertQuery, [
                        clientId, 
                        c['Договор'] || '', 
                        c['Имя клиента'] || '', 
                        c['Телефон'] || '', 
                        c['Статус сделки'] || 'На складе', 
                        false, 
                        JSON.stringify(clientData), 
                        c['Дата добавления'] || new Date()
                    ]);
                    count++;
                }
            }

            if (archive && Array.isArray(archive)) {
                for (const a of archive) {
                    let archiveId = a.id;
                    if (!archiveId) {
                        const contractPart = a['Договор'] ? String(a['Договор']).replace(/[^a-zA-Z0-9]/g, '') : 'nocontract';
                        archiveId = `mig_arch_${contractPart}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                    }
                    
                    const archiveData = { ...a, id: archiveId };

                    await importClient.query(upsertQuery, [
                        archiveId, 
                        a['Договор'] || '', 
                        a['Имя клиента'] || '', 
                        a['Телефон'] || '', 
                        'В архиве', 
                        true, 
                        JSON.stringify(archiveData), 
                        a['Дата добавления'] || new Date()
                    ]);
                    count++;
                }
            }

            await importClient.query('COMMIT');
            result = { status: 'success', message: `Импортировано ${count} записей.` };
        } catch(e) {
            await importClient.query('ROLLBACK');
            throw e;
        } finally {
            importClient.release();
        }
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
    
    if (error.message && (error.message.includes('password authentication') || error.code === '28P01')) {
         return res.status(500).json({ status: 'error', message: 'Ошибка авторизации БД. Проверьте пароль в POSTGRES_URL.' });
    }
    if (error.message && error.message.includes('self-signed')) {
         return res.status(500).json({ status: 'error', message: 'Ошибка SSL (Self-signed). Попробуем исправить...' });
    }

    return res.status(500).json({ status: 'error', message: (error as Error).message });
  }
}
