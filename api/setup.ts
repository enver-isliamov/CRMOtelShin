import { Pool } from 'pg';

export default async function handler(req: any, res: any) {
  let connectionString = 
    process.env.POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;
  
  if (!connectionString) {
      return res.status(500).json({ 
          status: 'error', 
          message: 'Connection string not found. Please set POSTGRES_URL in Vercel project settings.' 
      });
  }

  // Очистка строки подключения от sslmode если она уже есть (библиотека pg может конфликтовать)
  let cleanConnectionString = connectionString;
  try {
      const url = new URL(cleanConnectionString);
      url.searchParams.delete('sslmode');
      url.searchParams.delete('sslrootcert');
      cleanConnectionString = url.toString();
  } catch (e) {
      console.warn("Setup: Failed to normalize connection string", e);
  }

  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const startTime = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - startTime;

    // 1. Таблица Клиентов
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

    // 2. Таблица Истории
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

    // 3. Таблица Настроек
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `);

    // 4. Таблица Мастеров
    await pool.query(`
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
    `);

    // 5. Таблица Шаблонов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        name VARCHAR(255) PRIMARY KEY,
        content TEXT,
        data JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Таблица Сессий Бота
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_sessions (
        chat_id VARCHAR(50) PRIMARY KEY,
        state VARCHAR(100),
        data JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.end();

    return res.status(200).json({ 
      status: 'success', 
      message: 'База данных успешно инициализирована и готова к работе!',
      latency: duration
    });

  } catch (error: any) {
    console.error("Setup Error:", error);
    try { await pool.end(); } catch(e) {}

    return res.status(500).json({
        status: 'error',
        message: 'Ошибка настройки БД: ' + error.message,
        details: error.toString(),
        hint: "Убедитесь, что вы создали Storage (Postgres) в Vercel и подключили его к проекту."
    });
  }
}
