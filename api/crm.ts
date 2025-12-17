
import { createPool } from '@vercel/postgres';

// Vercel Serverless Function definition
export default async function handler(request: Request) {
  console.log(`[CRM API] Incoming request: ${request.method}`);

  // Обрабатываем CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405 });
  }

  // Подключение к БД с поддержкой нестандартного имени переменной (STOREGE_)
  const connectionString = process.env.POSTGRES_URL || process.env.STOREGE_POSTGRES_URL;
  console.log(`[CRM API] Connection string present: ${!!connectionString}`);
  
  const db = createPool({ connectionString });

  try {
    const body = await request.json();
    const action = body.action;
    const user = body.user || 'System';
    
    console.log(`[CRM API] Action: ${action}, User: ${user}`);

    let result;

    switch (action) {
      case 'testconnection':
        if (!connectionString) throw new Error("Connection string not found (checked POSTGRES_URL and STOREGE_POSTGRES_URL)");
        // Проверяем реальное подключение к БД
        console.log(`[CRM API] Testing DB connection...`);
        await db.sql`SELECT 1`;
        console.log(`[CRM API] DB Connection Successful!`);
        result = { status: 'success', message: 'Vercel Postgres Connected!', version: 'Vercel-1.0.1' };
        break;

      case 'getclients':
        const clientsRes = await db.sql`SELECT data FROM clients WHERE is_archived = FALSE ORDER BY created_at DESC;`;
        const archiveRes = await db.sql`SELECT data FROM clients WHERE is_archived = TRUE ORDER BY created_at DESC LIMIT 500;`;
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
        
        await db.sql`
          INSERT INTO clients (id, contract, name, phone, status, data, is_archived)
          VALUES (
            ${newClient.id}, 
            ${newClient['Договор'] || ''}, 
            ${newClient['Имя клиента'] || ''}, 
            ${newClient['Телефон'] || ''}, 
            ${newClient['Статус сделки'] || 'На складе'}, 
            ${JSON.stringify(newClient)},
            FALSE
          )
        `;
        await db.sql`INSERT INTO history (client_id, action, details, user_name) VALUES (${newClient.id}, 'Клиент создан', 'New record', ${user})`;
        result = { status: 'success', newId: newClient.id };
        break;

      case 'update':
        const clientToUpdate = body.client;
        const id = clientToUpdate.id;
        await db.sql`
          UPDATE clients 
          SET 
            contract = ${clientToUpdate['Договор'] || null},
            name = ${clientToUpdate['Имя клиента'] || null},
            phone = ${clientToUpdate['Телефон'] || null},
            status = ${clientToUpdate['Статус сделки'] || null},
            data = data || ${JSON.stringify(clientToUpdate)},
            updated_at = NOW()
          WHERE id = ${id}
        `;
        await db.sql`INSERT INTO history (client_id, action, details, user_name) VALUES (${id}, 'Данные обновлены', 'Update record', ${user})`;
        result = { status: 'success', message: 'Updated' };
        break;

      case 'reorder':
        const oldClientId = body.oldClientId;
        const newOrderData = body.client;
        await db.sql`UPDATE clients SET is_archived = TRUE, status = 'В архиве', updated_at = NOW() WHERE id = ${oldClientId}`;
        if (!newOrderData.id || newOrderData.id === oldClientId) { newOrderData.id = `vc_ro_${Date.now()}`; }
        await db.sql`
          INSERT INTO clients (id, contract, name, phone, status, data, is_archived)
          VALUES (
            ${newOrderData.id}, 
            ${newOrderData['Договор'] || ''}, 
            ${newOrderData['Имя клиента'] || ''}, 
            ${newOrderData['Телефон'] || ''}, 
            ${newOrderData['Статус сделки'] || 'На складе'}, 
            ${JSON.stringify(newOrderData)},
            FALSE
          )
        `;
        await db.sql`INSERT INTO history (client_id, action, details, user_name) VALUES (${oldClientId}, 'Архивация (Reorder)', 'Moved to archive', ${user})`;
        await db.sql`INSERT INTO history (client_id, action, details, user_name) VALUES (${newOrderData.id}, 'Новый заказ (Reorder)', 'Created from previous', ${user})`;
        result = { status: 'success', message: 'Reordered', newId: newOrderData.id };
        break;

      case 'delete':
        await db.sql`DELETE FROM clients WHERE id = ${body.clientId}`;
        result = { status: 'success', message: 'Deleted' };
        break;
        
      case 'gethistory':
         const historyRes = await db.sql`SELECT * FROM history WHERE client_id = ${body.clientId} ORDER BY created_at DESC`;
         const history = historyRes.rows.map(row => ({ id: row.id, clientId: row.client_id, timestamp: row.created_at, user: row.user_name, action: row.action, details: row.details }));
         result = { status: 'success', history };
         break;

      default:
        result = { status: 'error', message: `Action ${action} not implemented in Vercel backend yet` };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    console.error('[CRM API] Error:', error);
    
    // Красивое сообщение об ошибке подключения для фронтенда
    if (error.message && (error.message.includes('missing_connection_string') || error.message.includes('POSTGRES_URL'))) {
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: 'Ошибка подключения: переменная POSTGRES_URL не найдена. Проверьте настройки Vercel.' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }

    return new Response(JSON.stringify({ status: 'error', message: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
