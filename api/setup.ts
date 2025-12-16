
import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  try {
    // 1. Проверка соединения
    // Если переменных нет, этот запрос упадет с ошибкой 'missing_connection_string'
    await sql`SELECT 1`;

    // 2. Создаем таблицу клиентов
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

    // 3. Создаем таблицу истории (логов)
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

    // 4. Создаем таблицу настроек
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `;

    return new Response(JSON.stringify({ 
      status: 'success', 
      message: '✅ База данных успешно инициализирована! Таблицы созданы. Теперь можно пользоваться приложением.' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(error);
    
    // Специальная обработка ошибки отсутствия переменных
    if (error.message.includes('missing_connection_string') || error.message.includes('POSTGRES_URL')) {
        const htmlError = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ошибка подключения к БД</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; line-height: 1.5; max-width: 600px; margin: 0 auto; background: #f9fafb; }
                .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e5e7eb; }
                h1 { color: #dc2626; margin-top: 0; }
                code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-family: monospace; font-weight: bold; }
                ol { padding-left: 1.5rem; }
                li { margin-bottom: 0.5rem; }
                .btn { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; margin-top: 1rem; }
                .btn:hover { background: #1d4ed8; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>⚠️ База данных не подключена</h1>
                <p>Сервер Vercel не видит переменную <code>POSTGRES_URL</code>. Это нормально при первом запуске.</p>
                
                <h3>Как исправить (30 секунд):</h3>
                <ol>
                    <li>Откройте ваш проект в панели <b>Vercel</b>.</li>
                    <li>Перейдите на вкладку <b>Deployments</b>.</li>
                    <li>Нажмите на <b>три точки (...)</b> справа от последнего деплоя.</li>
                    <li>Выберите пункт <b>Redeploy</b> и подтвердите.</li>
                    <li>Дождитесь зеленого статуса <b>Ready</b>.</li>
                    <li>Обновите эту страницу.</li>
                </ol>
                <br/>
                <small>Техническая ошибка: ${error.message}</small>
            </div>
        </body>
        </html>
        `;
        return new Response(htmlError, {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
