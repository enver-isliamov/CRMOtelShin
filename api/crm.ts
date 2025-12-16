
import { sql } from '@vercel/postgres';

// Vercel Serverless Function definition
export default async function handler(request: Request) {
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

  try {
    const body = await request.json();
    const action = body.action;
    const user = body.user || 'System';

    let result;

    switch (action) {
      case 'testconnection':
        result = { status: 'success', message: 'Vercel Postgres Connected!', version: 'Vercel-1.0.0' };
        break;

      case 'getclients':
        // Получаем активных клиентов
        const clientsRes = await sql`
          SELECT data FROM clients WHERE is_archived = FALSE ORDER BY created_at DESC;
        `;
        // Получаем архив
        const archiveRes = await sql`
          SELECT data FROM clients WHERE is_archived = TRUE ORDER BY created_at DESC LIMIT 500;
        `;
        
        result = {
          status: 'success',
          clients: clientsRes.rows.map(row => row.data),
          archive: archiveRes.rows.map(row => row.data),
          headers: [] // Фронтенд сам разберется с заголовками
        };
        break;

      case 'add':
        const newClient = body.client;
        if (!newClient.id) newClient.id = `vc_${Date.now()}`; 
        
        await sql`
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
        
        await sql`INSERT INTO history (client_id, action, details, user_name) VALUES (${newClient.id}, 'Клиент создан', 'New record', ${user})`;
        
        result = { status: 'success', newId: newClient.id };
        break;

      case 'update':
        const clientToUpdate = body.client;
        const id = clientToUpdate.id;
        
        await sql`
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
        
        await sql`INSERT INTO history (client_id, action, details, user_name) VALUES (${id}, 'Данные обновлены', 'Update record', ${user})`;
        
        result = { status: 'success', message: 'Updated' };
        break;

      case 'reorder':
        const oldClientId = body.oldClientId;
        const newOrderData = body.client;
        
        // Шаг 1: Архивируем текущий заказ
        await sql`
          UPDATE clients 
          SET is_archived = TRUE, status = 'В архиве', updated_at = NOW() 
          WHERE id = ${oldClientId}
        `;
        
        // Шаг 2: Создаем новый заказ
        if (!newOrderData.id || newOrderData.id === oldClientId) {
             newOrderData.id = `vc_ro_${Date.now()}`;
        }
        
        await sql`
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
        
        await sql`INSERT INTO history (client_id, action, details, user_name) VALUES (${oldClientId}, 'Архивация (Reorder)', 'Moved to archive', ${user})`;
        await sql`INSERT INTO history (client_id, action, details, user_name) VALUES (${newOrderData.id}, 'Новый заказ (Reorder)', 'Created from previous', ${user})`;

        result = { status: 'success', message: 'Reordered', newId: newOrderData.id };
        break;

      case 'delete':
        await sql`DELETE FROM clients WHERE id = ${body.clientId}`;
        result = { status: 'success', message: 'Deleted' };
        break;
        
      case 'gethistory':
         const historyRes = await sql`SELECT * FROM history WHERE client_id = ${body.clientId} ORDER BY created_at DESC`;
         const history = historyRes.rows.map(row => ({
             id: row.id,
             clientId: row.client_id,
             timestamp: row.created_at,
             user: row.user_name,
             action: row.action,
             details: row.details
         }));
         result = { status: 'success', history };
         break;

      default:
        result = { status: 'error', message: `Action ${action} not implemented in Vercel backend yet` };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ status: 'error', message: (error as Error).message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
    });
  }
}
