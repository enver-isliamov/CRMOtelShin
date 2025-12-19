
import { Pool } from 'pg';

let cachedPool: Pool | null = null;

function getDbPool() {
    if (cachedPool) return cachedPool;
    const connectionString = process.env.POSTGRES_URL || process.env.STOREGE_POSTGRES_URL;
    if (!connectionString) throw new Error("POSTGRES_URL is not defined");
    
    cachedPool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 10000,
    });
    return cachedPool;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!BOT_TOKEN) return res.status(500).json({ error: "Token not set" });

    try {
        const pool = getDbPool();
        const update = req.body;

        if (update.message) {
            await handleMessage(pool, update.message);
        } else if (update.callback_query) {
            await handleCallback(pool, update.callback_query);
        }

        return res.status(200).send('OK');
    } catch (error: any) {
        console.error('[BOT API] Error:', error);
        return res.status(200).send('OK'); // Telegram needs 200 to stop retrying
    }
}

// --- LOGIC ---

async function handleMessage(pool: Pool, msg: any) {
    const chatId = String(msg.chat.id);
    const text = msg.text;
    if (!text) return;

    const session = await getSession(pool, chatId);

    if (text === '/start') {
        await setSession(pool, chatId, null, {});
        return sendTelegram('sendMessage', {
            chat_id: chatId,
            text: "👋 Добро пожаловать в сервис хранения шин! Выберите действие:",
            reply_markup: getMainMenu()
        });
    }

    // Обработка состояний (flow)
    if (session.state?.startsWith('signup_')) {
        return handleSignupFlow(pool, chatId, text, session);
    }
    
    if (session.state === 'lk_pickup_date') {
        return handlePickupRequest(pool, chatId, text);
    }

    if (msg.chat.type === 'private') {
        await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: "Я вас не совсем понял. Нажмите /start для вызова меню."
        });
    }
}

async function handleCallback(pool: Pool, cb: any) {
    const chatId = String(cb.message.chat.id);
    const messageId = cb.message.message_id;
    const data = cb.data;
    const session = await getSession(pool, chatId);

    let text = "";
    let keyboard: any = null;

    switch (data) {
        case 'main_menu':
            await setSession(pool, chatId, null, {});
            text = "Главное меню:";
            keyboard = getMainMenu();
            break;

        case 'info_prices':
            text = "💰 <b>Наши цены:</b>\n\nR13-R15: 500₽/мес\nR16-R19: 600₽/мес\nR20+: 700₽/мес\n\nС дисками: +100₽/мес за комплект.";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "main_menu" }]] };
            break;

        case 'info_why':
            text = "🏆 <b>Почему мы?</b>\n\n✅ Теплый склад\n✅ Страховка шин\n✅ Мойка и упаковка\n✅ Доставка";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "main_menu" }]] };
            break;

        case 'flow_signup':
            await setSession(pool, chatId, 'signup_phone', {});
            text = "✍️ <b>Запись на хранение</b>\n\nШаг 1/3. Введите ваш номер телефона (+7...):";
            break;

        case 'flow_lk':
            const client = await findClientByChatId(pool, chatId);
            if (client) {
                text = `👤 <b>Личный кабинет</b>\n\nКлиент: ${client['Имя клиента']}\nАвто: ${client['Номер Авто']}\nДоговор: ${client['Договор']}\nСрок до: ${formatDate(client['Окончание'])}`;
                keyboard = getLkMenu(client);
            } else {
                text = `❌ Клиент с ID <code>${chatId}</code> не найден в базе.\n\nПопросите менеджера привязать ваш Telegram в CRM.`;
                keyboard = { inline_keyboard: [[{ text: "⬅️ В меню", callback_data: "main_menu" }]] };
            }
            break;

        case 'lk_extend':
            await setSession(pool, chatId, 'ext_calc', { months: 1, hasRims: false });
            text = "📅 <b>Продление хранения</b>\n\nВыберите срок и опции:";
            keyboard = getExtensionMenu(1, false);
            break;

        case 'lk_pickup':
            await setSession(pool, chatId, 'lk_pickup_date', {});
            text = "🚗 <b>Забрать шины</b>\n\nНапишите желаемую дату и время (например: Завтра в 14:00):";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Отмена", callback_data: "flow_lk" }]] };
            break;

        // Обработка логики продления (ext_set_m_X, ext_toggle_rims, ext_calc)
        default:
            if (data.startsWith('ext_set_m_')) {
                const m = parseInt(data.split('_')[3]);
                const newData = { ...session.data, months: m };
                await setSession(pool, chatId, 'ext_calc', newData);
                text = "📅 <b>Продление хранения</b>\n\nСрок изменен.";
                keyboard = getExtensionMenu(m, newData.hasRims);
            } else if (data === 'ext_toggle_rims') {
                const newData = { ...session.data, hasRims: !session.data.hasRims };
                await setSession(pool, chatId, 'ext_calc', newData);
                text = "📅 <b>Продление хранения</b>\n\nОпции изменены.";
                keyboard = getExtensionMenu(newData.months, newData.hasRims);
            } else if (data === 'ext_calc') {
                return handleExtensionCalc(pool, chatId, session);
            }
    }

    if (text) {
        await sendTelegram('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }

    await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id });
}

// --- FLOWS ---

async function handleSignupFlow(pool: Pool, chatId: string, text: string, session: any) {
    if (session.state === 'signup_phone') {
        await setSession(pool, chatId, 'signup_car', { phone: text });
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Принято.\nШаг 2/3. Введите номер авто (или '-', если нет):" });
    }
    if (session.state === 'signup_car') {
        await setSession(pool, chatId, 'signup_district', { ...session.data, car: text });
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Принято.\nШаг 3/3. Укажите ваш район (для логистики):" });
    }
    if (session.state === 'signup_district') {
        const report = `🔥 <b>Новая заявка (Бот)</b>\n\nТел: ${session.data.phone}\nАвто: ${session.data.car}\nРайон: ${text}\nChatID: <code>${chatId}</code>`;
        if (ADMIN_CHAT_ID) await sendTelegram('sendMessage', { chat_id: ADMIN_CHAT_ID, text: report, parse_mode: 'HTML' });
        
        await setSession(pool, chatId, null, {});
        return sendTelegram('sendMessage', { 
            chat_id: chatId, 
            text: "✅ <b>Заявка отправлена!</b>\nМенеджер свяжется с вами.",
            reply_markup: getMainMenu()
        });
    }
}

async function handlePickupRequest(pool: Pool, chatId: string, text: string) {
    const client = await findClientByChatId(pool, chatId);
    const report = `📤 <b>Заявка на выдачу</b>\n\nКлиент: ${client ? client['Имя клиента'] : 'Неизвестный'}\nКогда: ${text}\nChatID: <code>${chatId}</code>`;
    if (ADMIN_CHAT_ID) await sendTelegram('sendMessage', { chat_id: ADMIN_CHAT_ID, text: report, parse_mode: 'HTML' });
    
    await setSession(pool, chatId, null, {});
    return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Заявка принята. Ждите подтверждения.", reply_markup: getMainMenu() });
}

async function handleExtensionCalc(pool: Pool, chatId: string, session: any) {
    const client = await findClientByChatId(pool, chatId);
    if (!client) return;

    let basePrice = client['Цена за месяц'] || 600;
    if (session.data.hasRims) basePrice += 100;
    const total = basePrice * session.data.months;

    const text = `💵 <b>К оплате</b>\n\nСрок: ${session.data.months} мес.\nДиски: ${session.data.hasRims ? 'Да' : 'Нет'}\n\n<b>Итого: ${total} ₽</b>\n\nПришлите чек об оплате менеджеру.`;
    await setSession(pool, chatId, null, {});
    return sendTelegram('sendMessage', { 
        chat_id: chatId, 
        text, 
        parse_mode: 'HTML', 
        reply_markup: { inline_keyboard: [[{ text: "⬅️ В меню", callback_data: "main_menu" }]] } 
    });
}

// --- DB HELPERS ---

async function getSession(pool: Pool, chatId: string) {
    const res = await pool.query('SELECT state, data FROM bot_sessions WHERE chat_id = $1', [chatId]);
    return res.rows[0] || { state: null, data: {} };
}

async function setSession(pool: Pool, chatId: string, state: string | null, data: any) {
    await pool.query(
        `INSERT INTO bot_sessions (chat_id, state, data, updated_at) 
         VALUES ($1, $2, $3, NOW()) 
         ON CONFLICT (chat_id) DO UPDATE SET state = EXCLUDED.state, data = EXCLUDED.data, updated_at = NOW()`,
        [chatId, state, JSON.stringify(data)]
    );
}

async function findClientByChatId(pool: Pool, chatId: string) {
    const res = await pool.query(`SELECT data FROM clients WHERE data->>'Chat ID' = $1 AND is_archived = FALSE LIMIT 1`, [chatId]);
    return res.rows[0]?.data;
}

// --- UI HELPERS ---

function getMainMenu() {
    return {
        inline_keyboard: [
            [{ text: "📝 Записаться на хранение", callback_data: "flow_signup" }],
            [{ text: "👤 Личный кабинет", callback_data: "flow_lk" }],
            [{ text: "💰 Цены", callback_data: "info_prices" }, { text: "ℹ️ Почему мы", callback_data: "info_why" }],
            [{ text: "📞 Связаться с менеджером", url: "https://t.me/OtelShinAdmin" }]
        ]
    };
}

function getLkMenu(client: any) {
    return {
        inline_keyboard: [
            [{ text: "📅 Продлить хранение", callback_data: "lk_extend" }],
            [{ text: "🚗 Забрать шины", callback_data: "lk_pickup" }],
            [{ text: "⬅️ В меню", callback_data: "main_menu" }]
        ]
    };
}

function getExtensionMenu(months: number, hasRims: boolean) {
    return {
        inline_keyboard: [
            [
                { text: (months === 1 ? "✅ " : "") + "1 мес", callback_data: "ext_set_m_1" },
                { text: (months === 6 ? "✅ " : "") + "6 мес", callback_data: "ext_set_m_6" },
                { text: (months === 12 ? "✅ " : "") + "12 мес", callback_data: "ext_set_m_12" }
            ],
            [{ text: (hasRims ? "✅" : "⬜") + " С дисками (+100₽/мес)", callback_data: "ext_toggle_rims" }],
            [{ text: "🧮 Рассчитать", callback_data: "ext_calc" }],
            [{ text: "⬅️ Назад", callback_data: "flow_lk" }]
        ]
    };
}

async function sendTelegram(method: string, payload: any) {
    return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

function formatDate(dateStr: any) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('ru-RU');
}
