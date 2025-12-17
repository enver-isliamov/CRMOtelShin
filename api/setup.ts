
import { Pool } from 'pg';

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

  // Настройка пула для pg
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Необходимо для большинства облачных БД (Neon, Supabase, Heroku)
    },
    connectionTimeoutMillis: 5000, // Тайм-аут 5 секунд
  });

  try {
    const startTime = Date.now();
    // 1. Проверка соединения
    await pool.query('SELECT 1');
    const duration = Date.now() - startTime;

    console.log(`DB Connected in ${duration}ms using pg driver`);

    // 2. Создаем таблицу клиентов
    await pool.query(`
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
    `);

    // 3. Создаем таблицу истории
    await pool.query(`
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(255),
        action VARCHAR(255),
        details TEXT,
        user_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Создаем таблицу настроек
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `);
    
    // Закрываем пул после использования в setup (в API будем держать открытым)
    await pool.end();

    return new Response(JSON.stringify({ 
      status: 'success', 
      message: '✅ База данных успешно инициализирована! Таблицы созданы.',
      latency: duration,
      driver: 'pg'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Setup Error:", error);
    
    // Попытка безопасно закрыть пул при ошибке
    try { await pool.end(); } catch(e) {}

    return new Response(JSON.stringify({
        status: 'error',
        message: 'Ошибка настройки БД: ' + error.message,
        details: error.toString(),
        hint: error.code === 'ENOTFOUND' ? 'Проверьте хост в строке подключения (POSTGRES_URL).' : undefined
    }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
