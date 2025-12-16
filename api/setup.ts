
import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  try {
    // Создаем таблицу клиентов
    await sql`
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
    `;

    // Создаем таблицу истории (логов)
    await sql`
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(255),
        action VARCHAR(255),
        details TEXT,
        user_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Создаем таблицу настроек
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `;

    return new Response(JSON.stringify({ 
      status: 'success', 
      message: 'Tables created successfully (clients, history, settings)' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
