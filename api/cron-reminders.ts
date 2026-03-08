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
    max: 2,
    connectionTimeoutMillis: 10000,
  });
  
  return cachedPool;
}

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("No TELEGRAM_BOT_TOKEN provided");
    return false;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    return response.ok;
  } catch (e) {
    console.error("Failed to send TG message:", e);
    return false;
  }
}

export default async function handler(req: any, res: any) {
  // Проверка секрета (рекомендуется Vercel для Cron Jobs)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const pool = getDbPool();
    
    // Получаем всех активных клиентов
    const clientsRes = await pool.query(`SELECT id, data FROM clients WHERE is_archived = FALSE`);
    const clients = clientsRes.rows;
    
    let sent7Days = 0;
    let sentExpired = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const row of clients) {
      const client = row.data;
      const chatId = client['Chat ID'] || client['chatId'];
      const endDateStr = client['Окончание'];
      
      if (!chatId || !endDateStr) continue;
      
      // Парсим дату (формат YYYY-MM-DD или DD.MM.YYYY)
      let endDate: Date;
      if (endDateStr.includes('.')) {
        const [day, month, year] = endDateStr.split('.');
        endDate = new Date(Number(year), Number(month) - 1, Number(day));
      } else {
        endDate = new Date(endDateStr);
      }

      if (isNaN(endDate.getTime())) continue;
      
      endDate.setHours(0, 0, 0, 0);
      
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 7) {
        // Напоминание за 7 дней
        const msg = `Здравствуйте, ${client['Имя клиента'] || 'клиент'} !

🔔 Напоминаем вам, что срок хранения шин на нашем складе
[${client['Договор'] || 'Б/Н'}] заканчивается <b>${endDateStr}</b>.

💬 Предлагаем вам рассмотреть следующие варианты:

<blockquote><b>1. Продление срока.</b>
Если вы хотите продлить срок хранения шин, сообщите
нам об этом как можно скорее. Мы предоставим
информацию о стоимости продления.</blockquote>

<b>2. Забрать шины.</b>
> Вы можете забрать шины самостоятельно. Свяжитесь с нами,
чтобы согласовать удобное время выдачи.

<blockquote><b>3. Доставка шин.</b>
Также вы можете заказать платную доставку шин по
вашему адресу. Если этот вариант вам подходит —
сообщите нам.</blockquote>

<blockquote><b>4. Запись на шиномонтаж.</b>
> Мы можем записать вас на шиномонтаж к нашим
партнёрам.
> В этом случае мы обеспечим <b>бесплатную доставку</b> шин
до места шиномонтажа.
> После записи сообщим дату и время.</blockquote>

🙏 Пожалуйста, дайте нам знать, какой вариант вам больше
подходит, чтобы мы могли всё организовать.`;
        const success = await sendTelegramMessage(chatId, msg);
        if (success) sent7Days++;
      } else if (diffDays === 0) {
        // Истекло сегодня
        const msg = `Здравствуйте, ${client['Имя клиента'] || 'клиент'} !

🚨 <b>Срок хранения истек!</b>

Срок хранения ваших шин по договору [<b>${client['Договор'] || 'Б/Н'}</b>] истек <b>сегодня</b> (${endDateStr}).
С завтрашнего дня договор переходит в статус просроченного.

💬 Предлагаем вам рассмотреть следующие варианты:

<blockquote><b>1. Продление срока.</b>
Если вы хотите продлить срок хранения шин, сообщите
нам об этом как можно скорее. Мы предоставим
информацию о стоимости продления.</blockquote>

<b>2. Забрать шины.</b>
> Вы можете забрать шины самостоятельно. Свяжитесь с нами,
чтобы согласовать удобное время выдачи.

<blockquote><b>3. Доставка шин.</b>
Также вы можете заказать платную доставку шин по
вашему адресу. Если этот вариант вам подходит —
сообщите нам.</blockquote>

<blockquote><b>4. Запись на шиномонтаж.</b>
> Мы можем записать вас на шиномонтаж к нашим
партнёрам.
> В этом случае мы обеспечим <b>бесплатную доставку</b> шин
до места шиномонтажа.
> После записи сообщим дату и время.</blockquote>

🙏 Пожалуйста, дайте нам знать, какой вариант вам больше
подходит, чтобы мы могли всё организовать.`;
        const success = await sendTelegramMessage(chatId, msg);
        if (success) {
            sentExpired++;
            
            // Обновляем статус в базе на "Просрочен"
            client['Статус сделки'] = 'Просрочен';
            await pool.query(
              'UPDATE clients SET status = $1, data = $2, updated_at = NOW() WHERE id = $3',
              ['Просрочен', JSON.stringify(client), row.id]
            );
            
            try {
              await pool.query(
                'INSERT INTO history (client_id, user_name, action, details) VALUES ($1, $2, $3, $4)',
                [row.id, 'System Cron', 'Статус изменен', 'Срок хранения истек, статус изменен на Просрочен']
              );
            } catch (e) {
              console.warn("Failed to log history:", e);
            }
        }
      }
    }

    return res.status(200).json({ 
      status: 'success', 
      message: 'Cron reminders executed successfully.',
      stats: {
        sent7Days,
        sentExpired
      }
    });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
