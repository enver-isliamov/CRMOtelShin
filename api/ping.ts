import { Pool } from 'pg';

let cachedPool: Pool | null = null;

function getCleanConnectionString(url: string) {
  try {
    const connectionUrl = new URL(url);
    connectionUrl.searchParams.delete('sslmode');
    connectionUrl.searchParams.delete('sslrootcert');
    return connectionUrl.toString();
  } catch (e) {
    return url;
  }
}

function getDbPool() {
  if (cachedPool) return cachedPool;
  
  const rawConnectionString = 
    process.env.POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING || 
    process.env.DATABASE_URL;

  if (!rawConnectionString) {
    throw new Error("POSTGRES_URL is not defined.");
  }

  const connectionString = getCleanConnectionString(rawConnectionString);
  
  cachedPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1, // Для пинга достаточно 1 соединения
    connectionTimeoutMillis: 5000,
  });
  
  return cachedPool;
}

export default async function handler(req: any, res: any) {
  // Проверка секрета (рекомендуется Vercel для Cron Jobs)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const pool = getDbPool();
    const startTime = Date.now();
    
    // Легкий запрос, чтобы БД (Supabase) зарегистрировала активность
    await pool.query('SELECT 1 AS ping');
    
    const duration = Date.now() - startTime;

    return res.status(200).json({ 
      status: 'success', 
      message: 'Database pinged successfully to prevent sleep.',
      latency: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Ping Error:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
