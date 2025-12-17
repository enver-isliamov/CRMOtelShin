
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
        logHistory(pool, newClient.id, user, 'Клиент создан', 'New record');
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
        logHistory(pool, id, user, 'Данные обновлены', 'Update record');
        result = { status: 'success', message: 'Updated' };
        break;

      case 'reorder':
        const oldClientId = body.oldClientId;
        const newOrderData = body.client;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE clients SET is_archived = TRUE, status = 'В архиве', updated_at = NOW() WHERE id = $1`, [oldClientId]);
            if (!newOrderData.id || newOrderData.id === oldClientId) { newOrderData.id = `vc_ro_${Date.now()}`; }
            await client.query(
              `INSERT INTO clients (id, contract, name, phone, status, data, is_archived)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
              [
                newOrderData.id, newOrderData['Договор'] || '', newOrderData['Имя клиента'] || '',
                newOrderData['Телефон'] || '', newOrderData['Статус сделки'] || 'На складе', JSON.stringify(newOrderData)
              ]
            );
            await logHistory(client, oldClientId, user, 'Архивация (Reorder)', 'Moved to archive');
            await logHistory(client, newOrderData.id, user, 'Новый заказ (Reorder)', 'Created from previous');
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
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
        // Map data back to array
        const mastersList = mastersRes.rows.map(row => row.data);
        result = { status: 'success', masters: mastersList };
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
      case 'updatetemplate': // Postgres UPSERT behavior mainly
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

      // --- IMPORT / MIGRATION (FULL) ---
      case 'import':
        const { clients, archive, masters, templates } = body;
        const importClient = await pool.connect();
        
        try {
            await importClient.query('BEGIN');
            
            // --- SELF-HEALING: Убеждаемся, что таблицы существуют перед импортом ---
            await importClient.query(`
                CREATE TABLE IF NOT EXISTS clients (
                    id VARCHAR(255) PRIMARY KEY,
                    contract VARCHAR(255),
                    name VARCHAR(255),
                    phone VARCHAR(50),
                    status VARCHAR(50),
                    is_archived BOOLEAN DEFAULT FALSE,
                    data JSONB, 
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS masters (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255),
                    chat_id VARCHAR(255),
                    phone VARCHAR(50),
                    services TEXT,
                    address TEXT,
                    data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS templates (
                    name VARCHAR(255) PRIMARY KEY,
                    content TEXT,
                    data JSONB,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS history (
                    id SERIAL PRIMARY KEY,
                    client_id VARCHAR(255),
                    action VARCHAR(255),
                    details TEXT,
                    user_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            // -----------------------------------------------------------------------

            let count = 0;

            // 1. Clients & Archive
            const clientUpsert = `
                INSERT INTO clients (id, contract, name, phone, status, is_archived, data, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    contract=EXCLUDED.contract, name=EXCLUDED.name, phone=EXCLUDED.phone,
                    status=EXCLUDED.status, is_archived=EXCLUDED.is_archived, data=EXCLUDED.data;
            `;
            
            const processClientBatch = async (list: any[], isArchived: boolean) => {
                for (const c of list) {
                    let clientId = c.id;
                    if (!clientId) {
                        const contractPart = c['Договор'] ? String(c['Договор']).replace(/[^a-zA-Z0-9]/g, '') : 'nocontract';
                        clientId = `mig_${isArchived?'arch':'cl'}_${contractPart}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                    }
                    const clientData = { ...c, id: clientId };
                    await importClient.query(clientUpsert, [
                        clientId, c['Договор'] || '', c['Имя клиента'] || '', c['Телефон'] || '',
                        isArchived ? 'В архиве' : (c['Статус сделки'] || 'На складе'),
                        isArchived, JSON.stringify(clientData), c['Дата добавления'] || new Date()
                    ]);
                    count++;
                }
            };

            if (clients && Array.isArray(clients)) await processClientBatch(clients, false);
            if (archive && Array.isArray(archive)) await processClientBatch(archive, true);

            // 2. Masters
            if (masters && Array.isArray(masters)) {
                for (const m of masters) {
                    if (!m['Имя']) continue;
                    let mId = m.id || `m_mig_${Date.now()}_${Math.floor(Math.random()*100)}`;
                    const mData = { ...m, id: mId };
                    await importClient.query(
                        `INSERT INTO masters (id, name, chat_id, phone, services, address, data)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, chat_id=EXCLUDED.chat_id, data=EXCLUDED.data`,
                        [mId, m['Имя'], m['chatId (Telegram)'] || '', m['Телефон']||'', m['Услуга']||'', m['Адрес']||'', JSON.stringify(mData)]
                    );
                    count++;
                }
            }

            // 3. Templates
            if (templates && Array.isArray(templates)) {
                for (const t of templates) {
                    if (!t['Название шаблона']) continue;
                    await importClient.query(
                        `INSERT INTO templates (name, content, data) VALUES ($1, $2, $3)
                         ON CONFLICT (name) DO UPDATE SET content=EXCLUDED.content, data=EXCLUDED.data`,
                        [t['Название шаблона'], t['Содержимое (HTML)'] || '', JSON.stringify(t)]
                    );
                    count++;
                }
            }

            await importClient.query('COMMIT');
            result = { status: 'success', message: `Успешно перенесено ${count} объектов.` };
        } catch(e) {
            await importClient.query('ROLLBACK');
            throw e;
        } finally {
            importClient.release();
        }
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
         return res.status(500).json({ status: 'error', message: 'Ошибка авторизации БД. Проверьте пароль.' });
    }
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
