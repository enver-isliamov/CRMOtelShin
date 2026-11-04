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

    // 1.1 Таблица Заказов хранения со ссылкой на clients
    await pool.query(`
      CREATE TABLE IF NOT EXISTS storage_orders (
        id VARCHAR(64) PRIMARY KEY,
        client_id VARCHAR(255) NOT NULL,
        contract VARCHAR(100) UNIQUE,
        qr_code VARCHAR(100),
        start_date DATE,
        duration_months INTEGER DEFAULT 6,
        reminder_date DATE,
        expiry_date DATE,
        warehouse VARCHAR(100) DEFAULT 'Основной',
        cell VARCHAR(50),
        price_per_month NUMERIC(10, 2) DEFAULT 0.00,
        total_price NUMERIC(10, 2) DEFAULT 0.00,
        debt NUMERIC(10, 2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Новая',
        service_pickup BOOLEAN DEFAULT FALSE,
        service_wash BOOLEAN DEFAULT FALSE,
        service_pack BOOLEAN DEFAULT FALSE,
        is_archived BOOLEAN DEFAULT FALSE,
        photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_storage_orders_client FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT
      );
    `);

    // 1.2 Таблица Комплектов шин со ссылкой на storage_orders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tire_groups (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        brand VARCHAR(100),
        model VARCHAR(100),
        width VARCHAR(20),
        profile VARCHAR(20),
        diameter VARCHAR(20),
        count INTEGER DEFAULT 4,
        season VARCHAR(20),
        has_rims VARCHAR(10) DEFAULT 'Нет',
        dot_code VARCHAR(50),
        price_per_month NUMERIC(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tire_groups_order FOREIGN KEY (order_id) REFERENCES storage_orders(id) ON UPDATE CASCADE ON DELETE CASCADE
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

    // 7. Таблица Сообщений (Чат)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(255),
        chat_id VARCHAR(50),
        direction VARCHAR(10), -- 'inbound' | 'outbound'
        type VARCHAR(20), -- 'text' | 'image' | 'file'
        content TEXT,
        status VARCHAR(20), -- 'sent' | 'delivered' | 'read' | 'failed'
        external_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
