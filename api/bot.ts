import { Pool } from 'pg';

let cachedPool: Pool | null = null;

function getDbPool() {
    if (cachedPool) return cachedPool;
    const connectionString = process.env.POSTGRES_URL || process.env.STOREGE_POSTGRES_URL;
    if (!connectionString) throw new Error("POSTGRES_URL is not defined");
    
    cachedPool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
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
        console.error('[BOT ERROR]', error);
        return res.status(200).send('OK');
    }
}

async function handleMessage(pool: Pool, msg: any) {
    const chatId = String(msg.chat.id);
    const text = msg.text?.trim();
    
    if (msg.contact) {
        return handleContactAuth(pool, chatId, msg.contact);
    }

    if (!text) return;
    
    // Обработка /start с параметрами (рефералы)
    if (text.toLowerCase().startsWith('/start')) {
        const parts = text.split(' ');
        const startParam = parts.length > 1 ? parts[1] : null;
        
        await setSession(pool, chatId, null, { ref: startParam });

        if (startParam && startParam.startsWith('ref_')) {
            const referrerId = startParam.replace('ref_', '');
            if (referrerId !== chatId && ADMIN_CHAT_ID) {
                await sendTelegram('sendMessage', {
                    chat_id: ADMIN_CHAT_ID,
                    text: `📢 <b>Новый реферал!</b>\n\nПользователь <code>${chatId}</code> пришел по ссылке от <code>${referrerId}</code>.`,
                    parse_mode: 'HTML'
                });
            }
        }

        return sendTelegram('sendMessage', {
            chat_id: chatId,
            text: "👋 <b>Добро пожаловать в Отель Шин!</b>\n\nЯ ваш персональный помощник по хранению колес. Выберите действие:",
            parse_mode: 'HTML',
            reply_markup: getMainMenu()
        });
    }

    const session = await getSession(pool, chatId);

    if (session.state?.startsWith('signup_')) {
        return handleSignupFlow(pool, chatId, text, session);
    }
    
    if (session.state === 'lk_pickup_date') {
        return handlePickupRequest(pool, chatId, text);
    }

    if (msg.chat.type === 'private') {
        await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: "Используйте меню или нажмите /start.",
            reply_markup: { inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "main_menu" }]] }
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
            text = "🏠 <b>Главное меню:</b>";
            keyboard = getMainMenu();
            break;

        case 'flow_lk':
            const client = await findClientByChatId(pool, chatId);
            if (client) {
                text = `👤 <b>Личный кабинет</b>\n\n<b>Клиент:</b> ${client['Имя клиента']}\n<b>Договор:</b> <code>${client['Договор']}</code>\n<b>Срок до:</b> ${formatDate(client['Окончание'])}`;
                keyboard = getLkMenu(client);
            } else {
                text = `❌ <b>Вы не авторизованы</b>\n\nДля доступа к Личному кабинету нужно привязать номер телефона.`;
                return sendTelegram('sendMessage', {
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML',
                    reply_markup: { 
                        keyboard: [[{ text: "📱 Привязать телефон", request_contact: true }]],
                        resize_keyboard: true, one_time_keyboard: true
                    }
                });
            }
            break;

        case 'info_prices':
            text = "💰 <b>Наши цены:</b>\n\n• R13-R15: 500 ₽/мес\n• R16-R19: 600 ₽/мес\n• R20+: 700 ₽/мес\n\n<i>Мойка и упаковка уже включены в первый месяц!</i>";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "main_menu" }]] };
            break;

        case 'flow_signup':
            await setSession(pool, chatId, 'signup_phone', {});
            text = "✍️ <b>Запись на хранение</b>\n\nШаг 1/3. Введите ваш номер телефона:";
            keyboard = { inline_keyboard: [[{ text: "❌ Отмена", callback_data: "main_menu" }]] };
            break;
            
        case 'lk_referral':
            text = "🎁 <b>Реферальная программа</b>\n\nПриведи друга — получи <b>1 месяц в подарок</b>!\n\nВаша ссылка:\n<code>https://t.me/OtelShinBot?start=ref_${chatId}</code>";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "flow_lk" }]] };
            break;

        default:
            // Обработка остальных колбэков...
            break;
    }

    if (text) {
        await sendTelegram('editMessageText', {
            chat_id: chatId, message_id: messageId,
            text, parse_mode: 'HTML', reply_markup: keyboard
        });
    }
    await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id });
}

async function handleContactAuth(pool: Pool, chatId: string, contact: any) {
    let phone = contact.phone_number;
    if (!phone.startsWith('+')) phone = '+' + phone;

    const res = await pool.query(
        `SELECT id, data FROM clients WHERE phone = $1 OR data->>'Телефон' = $1 LIMIT 1`,
        [phone]
    );

    if (res.rowCount > 0) {
        const client = res.rows[0].data;
        const clientId = res.rows[0].id;
        client['Chat ID'] = chatId;
        await pool.query(`UPDATE clients SET data = $1 WHERE id = $2`, [JSON.stringify(client), clientId]);
        await sendTelegram('sendMessage', {
            chat_id: chatId, text: "✅ <b>Успешно!</b>\n\nТеперь вам доступен Личный кабинет.", parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true }
        });
        const text = `👤 <b>Личный кабинет</b>\n\n<b>Клиент:</b> ${client['Имя клиента']}\n<b>Договор:</b> <code>${client['Договор']}</code>`;
        return sendTelegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: getLkMenu(client) });
    } else {
        return sendTelegram('sendMessage', {
            chat_id: chatId, text: `❌ Номер <b>${phone}</b> не найден.\n\nОбратитесь к менеджеру: @OtelShinAdmin`,
            parse_mode: 'HTML', reply_markup: { remove_keyboard: true }
        });
    }
}

async function handleSignupFlow(pool: Pool, chatId: string, text: string, session: any) {
    if (session.state === 'signup_phone') {
        await setSession(pool, chatId, 'signup_car', { phone: text });
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Принято.\n\nШаг 2/3. Номер авто:" });
    }
    if (session.state === 'signup_car') {
        await setSession(pool, chatId, 'signup_district', { ...session.data, car: text });
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Принято.\n\nШаг 3/3. Ваш адрес для забора:" });
    }
    if (session.state === 'signup_district') {
        const report = `🔥 <b>ЗАЯВКА</b>\n\n👤 <b>ID:</b> ${chatId}\n📞 <b>Тел:</b> ${session.data.phone}\n🚗 <b>Авто:</b> ${session.data.car}\n📍 <b>Адрес:</b> ${text}`;
        if (ADMIN_CHAT_ID) await sendTelegram('sendMessage', { chat_id: ADMIN_CHAT_ID, text: report, parse_mode: 'HTML' });
        await setSession(pool, chatId, null, {});
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ <b>Заявка принята!</b>", reply_markup: getMainMenu() });
    }
}

async function handlePickupRequest(pool: Pool, chatId: string, text: string) {
    const client = await findClientByChatId(pool, chatId);
    const report = `🚗 <b>ЗАЯВКА НА ВЫДАЧУ</b>\n\n👤 ${client ? client['Имя клиента'] : chatId}\n📅 <b>Когда:</b> ${text}`;
    if (ADMIN_CHAT_ID) await sendTelegram('sendMessage', { chat_id: ADMIN_CHAT_ID, text: report, parse_mode: 'HTML' });
    await setSession(pool, chatId, null, {});
    return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Заявка на выдачу принята!", reply_markup: getMainMenu() });
}

// Вспомогательные функции...
async function getSession(pool: Pool, chatId: string) {
    const res = await pool.query('SELECT state, data FROM bot_sessions WHERE chat_id = $1', [chatId]);
    return res.rows[0] || { state: null, data: {} };
}

async function setSession(pool: Pool, chatId: string, state: string | null, data: any) {
    await pool.query(`INSERT INTO bot_sessions (chat_id, state, data, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (chat_id) DO UPDATE SET state = EXCLUDED.state, data = EXCLUDED.data, updated_at = NOW()`, [chatId, state, JSON.stringify(data)]);
}

async function findClientByChatId(pool: Pool, chatId: string) {
    const res = await pool.query(`SELECT data FROM clients WHERE (data->>'Chat ID' = $1 OR data->>'Chat ID' = $2) AND is_archived = FALSE LIMIT 1`, [chatId, parseInt(chatId) || 0]);
    return res.rows[0]?.data;
}

function getMainMenu() {
    return {
        inline_keyboard: [
            [{ text: "📝 Записаться", callback_data: "flow_signup" }],
            [{ text: "📱 Личный кабинет", web_app: { url: "https://" + process.env.VERCEL_URL + "/#/tg-lk" } }],
            [{ text: "💰 Цены", callback_data: "info_prices" }, { text: "🏆 Почему мы", callback_data: "info_why" }],
            [{ text: "📞 Менеджер", url: "https://t.me/OtelShinAdmin" }]
        ]
    };
}

function getLkMenu(client: any) {
    return {
        inline_keyboard: [
            [{ text: "📅 Продлить", callback_data: "lk_extend" }],
            [{ text: "🚗 Забрать шины", callback_data: "lk_pickup" }],
            [{ text: "🎁 Бонусы", callback_data: "lk_referral" }],
            [{ text: "🏠 Меню", callback_data: "main_menu" }]
        ]
    };
}

async function sendTelegram(method: string, payload: any) {
    return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
}

function formatDate(dateStr: any) {
    if (!dateStr) return "-";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('ru-RU');
    } catch(e) { return dateStr; }
}

function getExtensionMenu(months: number, hasRims: boolean) {
    return {
        inline_keyboard: [
            [{ text: (months === 1 ? "✅ " : "") + "1 мес", callback_data: "ext_set_m_1" }, { text: (months === 6 ? "✅ " : "") + "6 мес", callback_data: "ext_set_m_6" }, { text: (months === 12 ? "✅ " : "") + "12 мес", callback_data: "ext_set_m_12" }],
            [{ text: (hasRims ? "✅" : "⬜") + " С дисками (+100₽/мес)", callback_data: "ext_toggle_rims" }],
            [{ text: "🧮 Расчитать", callback_data: "ext_calc" }],
            [{ text: "⬅️ Назад", callback_data: "flow_lk" }]
        ]
    };
}