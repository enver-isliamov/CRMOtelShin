
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

        console.log(`[BOT] Incoming update ID: ${update.update_id}`);

        if (update.message) {
            await handleMessage(pool, update.message);
        } else if (update.callback_query) {
            await handleCallback(pool, update.callback_query);
        }

        return res.status(200).send('OK');
    } catch (error: any) {
        console.error('[BOT ERROR]', error);
        // Возвращаем 200, чтобы Телеграм не заспамил повторами при ошибке кода
        return res.status(200).send('OK');
    }
}

// --- LOGIC ---

async function handleMessage(pool: Pool, msg: any) {
    const chatId = String(msg.chat.id);
    const text = msg.text?.trim();
    
    // Обработка кнопки "Поделиться контактом" для авторизации
    if (msg.contact) {
        return handleContactAuth(pool, chatId, msg.contact);
    }

    if (!text) return;
    const session = await getSession(pool, chatId);

    console.log(`[BOT] Msg from ${chatId}: ${text}. Current state: ${session.state}`);

    if (text.toLowerCase() === '/start') {
        await setSession(pool, chatId, null, {});
        return sendTelegram('sendMessage', {
            chat_id: chatId,
            text: "👋 <b>Добро пожаловать!</b>\n\nЯ помогу вам управлять хранением ваших шин. Выберите нужное действие в меню ниже:",
            parse_mode: 'HTML',
            reply_markup: getMainMenu()
        });
    }

    // Состояния flow (регистрация)
    if (session.state?.startsWith('signup_')) {
        return handleSignupFlow(pool, chatId, text, session);
    }
    
    // Состояния flow (забрать шины)
    if (session.state === 'lk_pickup_date') {
        return handlePickupRequest(pool, chatId, text);
    }

    // Если ничего не подошло
    if (msg.chat.type === 'private') {
        await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: "Извините, я не узнал эту команду. Нажмите /start для вызова главного меню."
        });
    }
}

async function handleCallback(pool: Pool, cb: any) {
    const chatId = String(cb.message.chat.id);
    const messageId = cb.message.message_id;
    const data = cb.data;
    const session = await getSession(pool, chatId);

    console.log(`[BOT] Callback from ${chatId}: ${data}`);

    let text = "";
    let keyboard: any = null;

    switch (data) {
        case 'main_menu':
            await setSession(pool, chatId, null, {});
            text = "🏠 <b>Главное меню:</b>";
            keyboard = getMainMenu();
            break;

        case 'info_prices':
            text = "💰 <b>Наши цены (за комплект/мес):</b>\n\n• R13-R15: 500 ₽\n• R16-R19: 600 ₽\n• R20-R22: 700 ₽\n• R23+: 800 ₽\n\n<i>Хранение с дисками: +100 ₽ к тарифу.</i>";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "main_menu" }]] };
            break;

        case 'info_why':
            text = "🏆 <b>Почему выбирают нас?</b>\n\n✅ <b>Безопасность:</b> Теплый охраняемый склад.\n✅ <b>Сервис:</b> Мойка, упаковка и проверка давления.\n✅ <b>Удобство:</b> Доставка шин от вашего дома.";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "main_menu" }]] };
            break;

        case 'flow_signup':
            await setSession(pool, chatId, 'signup_phone', {});
            text = "✍️ <b>Запись на хранение</b>\n\nШаг 1/3. Введите ваш номер телефона:";
            keyboard = { inline_keyboard: [[{ text: "❌ Отмена", callback_data: "main_menu" }]] };
            break;

        case 'flow_lk':
            const client = await findClientByChatId(pool, chatId);
            if (client) {
                text = `👤 <b>Личный кабинет</b>\n\n<b>Клиент:</b> ${client['Имя клиента']}\n<b>Авто:</b> ${client['Номер Авто'] || '-'}\n<b>Договор:</b> <code>${client['Договор']}</code>\n<b>Срок до:</b> ${formatDate(client['Окончание'])}`;
                keyboard = getLkMenu(client);
            } else {
                text = `❌ <b>Вы не авторизованы</b>\n\nЯ не нашел клиента с вашим ID (<code>${chatId}</code>).\n\nНажмите кнопку ниже, чтобы я нашел вас по номеру телефона.`;
                keyboard = { 
                    inline_keyboard: [],
                    keyboard: [[{ text: "📱 Привязать номер телефона", request_contact: true }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                };
                // В Телеграме нельзя смешивать inline и обычные кнопки в одном сообщении эффективно
                return sendTelegram('sendMessage', {
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                });
            }
            break;

        case 'lk_extend':
            await setSession(pool, chatId, 'ext_calc', { months: 1, hasRims: false });
            text = "📅 <b>Продление хранения</b>\n\nНа какой срок хотите продлить?";
            keyboard = getExtensionMenu(1, false);
            break;

        case 'lk_pickup':
            await setSession(pool, chatId, 'lk_pickup_date', {});
            text = "🚗 <b>Забрать шины</b>\n\nНапишите желаемую дату и время (например: завтра в 10:00). Менеджер подтвердит заявку.";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Отмена", callback_data: "flow_lk" }]] };
            break;

        default:
            if (data.startsWith('ext_set_m_')) {
                const m = parseInt(data.split('_')[3]);
                const newData = { ...session.data, months: m };
                await setSession(pool, chatId, 'ext_calc', newData);
                text = "📅 <b>Продление хранения</b>";
                keyboard = getExtensionMenu(m, newData.hasRims);
            } else if (data === 'ext_toggle_rims') {
                const newData = { ...session.data, hasRims: !session.data.hasRims };
                await setSession(pool, chatId, 'ext_calc', newData);
                text = "📅 <b>Продление хранения</b>";
                keyboard = getExtensionMenu(session.data.months, newData.hasRims);
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

/**
 * Авторизация по кнопке "Поделиться контактом"
 */
async function handleContactAuth(pool: Pool, chatId: string, contact: any) {
    let phone = contact.phone_number;
    if (!phone.startsWith('+')) phone = '+' + phone;

    console.log(`[AUTH] User ${chatId} shared phone ${phone}`);

    // Ищем клиента по телефону в Postgres
    const res = await pool.query(
        `SELECT id, data FROM clients WHERE phone = $1 OR data->>'Телефон' = $1 LIMIT 1`,
        [phone]
    );

    if (res.rowCount > 0) {
        const client = res.rows[0].data;
        const clientId = res.rows[0].id;
        
        // Привязываем Chat ID в объекте data
        client['Chat ID'] = chatId;
        
        await pool.query(
            `UPDATE clients SET data = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(client), clientId]
        );

        await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `✅ <b>Успешно!</b>\n\nВы привязаны к договору №${client['Договор']}.\nТеперь вам доступен Личный кабинет.`,
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true } // Убираем кнопку контакта
        });
        
        // Показываем меню ЛК
        const text = `👤 <b>Личный кабинет</b>\n\n<b>Клиент:</b> ${client['Имя клиента']}\n<b>Авто:</b> ${client['Номер Авто'] || '-'}\n<b>Договор:</b> <code>${client['Договор']}</code>\n<b>Срок до:</b> ${formatDate(client['Окончание'])}`;
        return sendTelegram('sendMessage', {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            reply_markup: getLkMenu(client)
        });

    } else {
        return sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `❌ Клиент с номером <b>${phone}</b> не найден в нашей базе.\n\nПожалуйста, свяжитесь с менеджером.`,
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true }
        });
    }
}

async function handleSignupFlow(pool: Pool, chatId: string, text: string, session: any) {
    if (session.state === 'signup_phone') {
        await setSession(pool, chatId, 'signup_car', { phone: text });
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Записал.\n\nШаг 2/3. Введите номер авто (или '-' если не помните):" });
    }
    if (session.state === 'signup_car') {
        await setSession(pool, chatId, 'signup_district', { ...session.data, car: text });
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Принято.\n\nШаг 3/3. Укажите ваш адрес или район (для логистики):" });
    }
    if (session.state === 'signup_district') {
        const report = `🔥 <b>НОВАЯ ЗАЯВКА ИЗ БОТА</b>\n\n<b>Тел:</b> ${session.data.phone}\n<b>Авто:</b> ${session.data.car}\n<b>Адрес:</b> ${text}\n<b>ChatID:</b> <code>${chatId}</code>`;
        
        if (ADMIN_CHAT_ID) {
            await sendTelegram('sendMessage', { chat_id: ADMIN_CHAT_ID, text: report, parse_mode: 'HTML' });
        }
        
        await setSession(pool, chatId, null, {});
        return sendTelegram('sendMessage', { 
            chat_id: chatId, 
            text: "✅ <b>Заявка успешно отправлена!</b>\n\nМенеджер свяжется с вами в течение 15 минут для уточнения деталей.",
            parse_mode: 'HTML',
            reply_markup: getMainMenu()
        });
    }
}

async function handlePickupRequest(pool: Pool, chatId: string, text: string) {
    const client = await findClientByChatId(pool, chatId);
    const report = `📤 <b>ЗАЯВКА НА ВЫДАЧУ</b>\n\n<b>Клиент:</b> ${client ? client['Имя клиента'] : 'Неизвестный'}\n<b>Когда:</b> ${text}\n<b>ChatID:</b> <code>${chatId}</code>`;
    
    if (ADMIN_CHAT_ID) {
        await sendTelegram('sendMessage', { chat_id: ADMIN_CHAT_ID, text: report, parse_mode: 'HTML' });
    }
    
    await setSession(pool, chatId, null, {});
    return sendTelegram('sendMessage', { 
        chat_id: chatId, 
        text: "✅ <b>Заявка принята!</b>\n\nМы подготовим ваши шины. Менеджер напишет вам для подтверждения времени.", 
        parse_mode: 'HTML',
        reply_markup: getMainMenu() 
    });
}

async function handleExtensionCalc(pool: Pool, chatId: string, session: any) {
    const client = await findClientByChatId(pool, chatId);
    if (!client) return;

    let basePrice = parseInt(client['Цена за месяц']) || 600;
    if (session.data.hasRims) basePrice += 100;
    const total = basePrice * session.data.months;

    const text = `💵 <b>Расчет продления</b>\n\n<b>Срок:</b> ${session.data.months} мес.\n<b>Диски:</b> ${session.data.hasRims ? 'Да' : 'Нет'}\n\n<b>Итого к оплате: ${total} ₽</b>\n\nОплатите по номеру телефона <code>+79780000000</code> и пришлите скриншот чека в этот чат.`;
    
    await setSession(pool, chatId, null, {});
    return sendTelegram('sendMessage', { 
        chat_id: chatId, 
        text, 
        parse_mode: 'HTML', 
        reply_markup: { inline_keyboard: [[{ text: "🏠 В главное меню", callback_data: "main_menu" }]] } 
    });
}

// --- DB HELPERS ---

async function getSession(pool: Pool, chatId: string) {
    try {
        const res = await pool.query('SELECT state, data FROM bot_sessions WHERE chat_id = $1', [chatId]);
        return res.rows[0] || { state: null, data: {} };
    } catch (e) {
        return { state: null, data: {} };
    }
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
    // Поиск по Chat ID внутри JSON-поля data
    // Используем несколько вариантов приведения типов для надежности
    const res = await pool.query(`
        SELECT data FROM clients 
        WHERE (data->>'Chat ID' = $1 OR data->>'Chat ID' = $2)
        AND is_archived = FALSE 
        LIMIT 1
    `, [chatId, parseInt(chatId) || 0]);
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
            [{ text: "🏠 Главное меню", callback_data: "main_menu" }]
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
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('ru-RU');
    } catch(e) {
        return dateStr;
    }
}
