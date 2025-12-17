
import { createPool } from '@vercel/postgres';

export default async function handler(request: Request) {
  const connectionString = 
    process.env.POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL_NON_POOLING;
  
  if (!connectionString) {
      return new Response(JSON.stringify({ 
          status: 'error', 
          message: 'Connection string not found. Please set POSTGRES_URL env var.' 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Используем connectionString напрямую при создании пула
  const db = createPool({ connectionString });

  try {
    // Простой запрос для проверки
    // Используем sql template tag напрямую
    const startTime = Date.now();
    await db.sql`SELECT 1`;
    const duration = Date.now() - startTime;

    console.log(`DB Connected in ${duration}ms`);

    // Создание таблиц
    await db.sql`
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

    await db.sql`
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(255),
        action VARCHAR(255),
        details TEXT,
        user_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await db.sql`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `;

    return new Response(JSON.stringify({ 
      status: 'success', 
      message: '✅ База данных успешно инициализирована! Таблицы созданы.',
      latency: duration
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Setup Error:", error);
    
    return new Response(JSON.stringify({
        status: 'error',
        message: 'Ошибка настройки БД: ' + error.message,
        details: error.toString()
    }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
