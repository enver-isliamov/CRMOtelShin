
import { Pool } from 'pg';

export default async function handler(req: any, res: any) {
  const connectionString = 
    process.env.POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL_NON_POOLING;
  
  if (!connectionString) {
      return res.status(500).json({ 
          status: 'error', 
          message: 'Connection string not found. Please set POSTGRES_URL env var.' 
      });
  }

  // Создаем пул, который будет жить только время выполнения этой функции
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000,
  });

  try {
    const startTime = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - startTime;

    console.log(`DB Connected in ${duration}ms using pg driver`);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `);
    
    await pool.end();

    return res.status(200).json({ 
      status: 'success', 
      message: '✅ База данных успешно инициализирована!',
      latency: duration,
      driver: 'pg'
    });

  } catch (error: any) {
    console.error("Setup Error:", error);
    try { await pool.end(); } catch(e) {}

    return res.status(500).json({
        status: 'error',
        message: 'Ошибка настройки БД: ' + error.message,
        details: error.toString()
    });
  }
}
