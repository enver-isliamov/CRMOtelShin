
import { createPool } from '@vercel/postgres';

export default async function handler(request: Request) {
  // Ищем строку подключения. 
  // Приоритет: 
  // 1. Стандартная POSTGRES_URL
  // 2. Ваша с опечаткой STOREGE_POSTGRES_URL
  // 3. Версия без пулинга (иногда помогает) STOREGE_POSTGRES_URL_NON_POOLING
  const connectionString = 
    process.env.POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL || 
    process.env.STOREGE_POSTGRES_URL_NON_POOLING;
  
  const db = createPool({ connectionString });

  try {
    if (!connectionString) {
        throw new Error('missing_connection_string');
    }

    // 1. Проверка соединения
    await db.sql`SELECT 1`;

    // 2. Создаем таблицу клиентов
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

    // 3. Создаем таблицу истории (логов)
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

    // 4. Создаем таблицу настроек
    await db.sql`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `;

    return new Response(JSON.stringify({ 
      status: 'success', 
      message: '✅ База данных успешно инициализирована! Таблицы созданы.' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Setup Error:", error);
    
    const envKeys = Object.keys(process.env).filter(k => k.startsWith('POSTGRES') || k.startsWith('STOREGE') || k.startsWith('VERCEL'));
    const hasUrl = !!connectionString;
    // Маскируем URL для безопасности
    const maskedUrl = connectionString ? connectionString.substring(0, 15) + '...' : 'undefined';

    const htmlError = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ошибка подключения к БД</title>
        <style>
            body { font-family: sans-serif; padding: 2rem; background: #f3f4f6; color: #1f2937; }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); max-width: 600px; margin: 0 auto; }
            h1 { color: #dc2626; font-size: 1.5rem; margin-top: 0; }
            code { background: #e5e7eb; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.9em; word-break: break-all; }
            .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: bold; font-size: 0.875rem; }
            .badge-red { background: #fee2e2; color: #991b1b; }
            .badge-green { background: #d1fae5; color: #065f46; }
            ul { text-align: left; background: #f9fafb; padding: 1rem 2rem; border-radius: 0.5rem; border: 1px solid #e5e7eb; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>⛔ Ошибка подключения</h1>
            <p>Не удалось подключиться к базе данных Vercel Postgres.</p>
            
            <div style="margin: 1.5rem 0;">
                <strong>Статус строки подключения: </strong>
                ${hasUrl ? '<span class="badge badge-green">НАЙДЕНА</span>' : '<span class="badge badge-red">ОТСУТСТВУЕТ</span>'}
                <br/><br/>
                <code style="font-size: 0.7rem">${maskedUrl}</code>
            </div>

            ${!hasUrl ? `
                <p>⚠️ Переменная <code>POSTGRES_URL</code> (или <code>STOREGE_POSTGRES_URL</code>) не найдена.</p>
            ` : ''}

            <h3>Отладочная информация:</h3>
            <p>Доступные переменные (ключи):</p>
            <ul>
                ${envKeys.length > 0 ? envKeys.map(k => `<li>${k}</li>`).join('') : '<li>Нет переменных БД</li>'}
            </ul>

            <p style="font-size: 0.875rem; color: #6b7280; margin-top: 2rem;">
                Ошибка системы: <code>${error.message}</code>
                <br/>
                <small>Исправление: Добавлен "type": "module" в package.json</small>
            </p>
        </div>
    </body>
    </html>
    `;

    return new Response(htmlError, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
