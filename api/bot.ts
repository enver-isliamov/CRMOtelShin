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
    const rawConnectionString = process.env.POSTGRES_URL || process.env.STOREGE_POSTGRES_URL;
    if (!rawConnectionString) throw new Error("POSTGRES_URL is not defined");
    
    const connectionString = getCleanConnectionString(rawConnectionString);

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
        
        // ROBUST BODY PARSING
        let update = req.body;
        if (typeof update === 'string') {
            try {
                update = JSON.parse(update);
            } catch (e) {
                console.error("Bot: Failed to parse string body", update);
            }
        }

        if (!update || typeof update !== 'object') {
            return res.status(200).send('OK'); // Always return OK to TG
        }

        console.log(`[BOT] Incoming update ID: ${update.update_id}`);

        if (update.message) {
            await handleMessage(pool, update.message);
        } else if (update.callback_query) {
            await handleCallback(pool, update.callback_query);
        }

        return res.status(200).send('OK');
    } catch (error: any) {
        console.error('[BOT ERROR]', error);
        try {
            const pool = getDbPool();
            await pool.query(
                'INSERT INTO history (client_id, user_name, action, details) VALUES ($1, $2, $3, $4)',
                ['SYSTEM', 'TelegramBot', 'ERROR', String(error?.message || error)]
            );
        } catch (e) {
            console.error("Failed to log error to DB", e);
        }
        return res.status(200).send('OK');
    }
}

// ... rest of the file stays same ...
async function handleMessage(pool: Pool, msg: any) {
    const chatId = String(msg.chat.id);
    const text = msg.text?.trim();
    
    if (msg.contact) {
        return handleContactAuth(pool, chatId, msg.contact);
    }

    if (!text) return;

    // SAVE INBOUND MESSAGE
    const client = await findClientByChatId(pool, chatId);
    await saveMessage(pool, {
        client_id: client?.id || null,
        chat_id: chatId,
        direction: 'inbound',
        type: 'text',
        content: text,
        status: 'delivered',
        external_id: String(msg.message_id)
    });

    const session = await getSession(pool, chatId);

    console.log(`[BOT] Msg from ${chatId}: ${text}. Current state: ${session.state}`);

    if (text.toLowerCase() === '/start') {
        await setSession(pool, chatId, null, {});
        return sendTelegram('sendMessage', {
            chat_id: chatId,
            text: "👋 <b>Добро пожаловать в Отель Шин!</b>\n\nЯ ваш персональный помощник по хранению и обслуживанию колес. Выберите нужное действие:",
            parse_mode: 'HTML',
            reply_markup: getMainMenu()
        });
    }

    if (session.state?.startsWith('signup_')) {
        return handleSignupFlow(pool, chatId, text, session);
    }
    
    if (session.state === 'lk_pickup_date') {
        return handlePickupRequest(pool, chatId, text);
    }

    if (msg.chat.type === 'private') {
        // Instead of "Unknown command", we treat it as a support message
        await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: "✅ <b>Сообщение принято!</b>\n\nМенеджер получил ваше сообщение и ответит в ближайшее время.",
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "main_menu" }]] }
        });

        // Notify Admin about new message
        if (ADMIN_CHAT_ID) {
             await sendTelegram('sendMessage', {
                chat_id: ADMIN_CHAT_ID,
                text: `📩 <b>Новое сообщение от клиента</b>\n\n<b>От:</b> ${client ? client['Имя клиента'] : 'Неизвестный'} (ID: ${chatId})\n<b>Текст:</b> ${text}`,
                parse_mode: 'HTML'
            });
        }
    }
}

async function saveMessage(pool: Pool, msgData: any) {
    try {
        await pool.query(
            `INSERT INTO messages (client_id, chat_id, direction, type, content, status, external_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [msgData.client_id, msgData.chat_id, msgData.direction, msgData.type, msgData.content, msgData.status, msgData.external_id]
        );
    } catch (e) {
        console.error("Failed to save message:", e);
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
            text = "💰 <b>Наши цены (за комплект/мес):</b>\n\n• R13-R15: 500 ₽\n• R16-R19: 600 ₽\n• R20-R22: 700 ₽\n• R23+: 800 ₽\n\n<i>Хранение с дисками: +100 ₽ к тарифу за комплект.</i>";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "main_menu" }]] };
            break;

        case 'info_why':
            text = "🏆 <b>Почему выбирают нас?</b>\n\n✅ <b>Безопасность:</b> Теплый охраняемый склад.\n✅ <b>Сервис:</b> Мойка, упаковка и проверка давления.\n✅ <b>Удобство:</b> Доставка шин от вашего дома.\n✅ <b>Страхование:</b> Ваши колеса застрахованы на весь период.";
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
                text = `❌ <b>Вы не авторизованы</b>\n\nНажмите кнопку ниже, чтобы я нашел вас по номеру телефона в базе CRM.`;
                return sendTelegram('sendMessage', {
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML',
                    reply_markup: { 
                        keyboard: [[{ text: "📱 Привязать номер телефона", request_contact: true }]],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
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

        case 'lk_referral':
            text = "🎁 <b>Реферальная программа</b>\n\nПриведи друга и получи <b>1 месяц хранения в подарок</b>!\n\nВаш друг должен назвать ваше имя или номер договора при оформлении. Количество бонусов не ограничено!";
            keyboard = { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "flow_lk" }]] };
            break;

        case 'menu_fitting':
            text = "🔧 <b>Услуги шиномонтажа</b>\n\nМы предлагаем:\n\n1. <b>Стационарный шиномонтаж</b> в наших партнерских центрах со скидкой для клиентов Отеля Шин.\n2. <b>Выездной шиномонтаж</b> — приедем к вашему дому или офису.";
            keyboard = { 
                inline_keyboard: [
                    [{ text: "📍 Партнерские центры", callback_data: "fitting_partners" }],
                    [{ text: "🚚 Выездной сервис", callback_data: "fitting_mobile" }],
                    [{ text: "⬅️ Назад", callback_data: "main_menu" }]
                ] 
            };
            break;

        case 'fitting_partners':
            text = "📍 <b>Наши партнеры</b>\n\nСеть сервисов 'Авто-Стоп' и 'Шинный Двор'. Для записи со скидкой обратитесь к нашему менеджеру.";
            keyboard = { inline_keyboard: [[{ text: "📞 Записаться", url: "https://t.me/OtelShinAdmin" }], [{ text: "⬅️ Назад", callback_data: "menu_fitting" }]] };
            break;

        case 'fitting_mobile':
            text = "🚚 <b>Выездной шиномонтаж</b>\n\nПриедем в любую точку города. Стоимость выезда — от 1000 ₽ + работа по прайсу.\n\nИдеально для тех, кто ценит время!";
            keyboard = { inline_keyboard: [[{ text: "📞 Вызвать мастера", url: "https://t.me/OtelShinAdmin" }], [{ text: "⬅️ Назад", callback_data: "menu_fitting" }]] };
            break;

        case 'menu_partners':
            text = "🤝 <b>Партнёрские сервисы</b>\n\nНашим клиентам доступны привилегии у партнеров:\n\n• 🧽 Детейлинг и мойка (-15%)\n• 🛠 Техническое обслуживание (-10%)\n• 🧊 Заправка кондиционеров\n\nПодробности у менеджера.";
            keyboard = { inline_keyboard: [[{ text: "📞 Узнать подробнее", url: "https://t.me/OtelShinAdmin" }], [{ text: "⬅️ Назад", callback_data: "main_menu" }]] };
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

async function handleContactAuth(pool: Pool, chatId: string, contact: any) {
    let phone = contact.phone_number;
    if (!phone.startsWith('+')) phone = '+' + phone;

    console.log(`[AUTH] User ${chatId} shared phone ${phone}`);

    const res = await pool.query(
        `SELECT id, data FROM clients WHERE phone = $1 OR data->>'Телефон' = $1 LIMIT 1`,
        [phone]
    );

    if (res.rowCount > 0) {
        const client = res.rows[0].data;
        const clientId = res.rows[0].id;
        client['Chat ID'] = chatId;
        
        await pool.query(
            `UPDATE clients SET data = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(client), clientId]
        );

        await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: `✅ <b>Успешно!</b>\n\nВаш аккаунт привязан. Теперь вы можете пользоваться Личным кабинетом.`,
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true }
        });
        
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
            text: `❌ Номер <b>${phone}</b> не найден в базе.\n\nПожалуйста, свяжитесь с менеджером: @OtelShinAdmin`,
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true }
        });
    }
}

async function handleSignupFlow(pool: Pool, chatId: string, text: string, session: any) {
    if (session.state === 'signup_phone') {
        await setSession(pool, chatId, 'signup_car', { phone: text });
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Принято.\n\nШаг 2/3. Введите номер авто (или '-' если нет):" });
    }
    if (session.state === 'signup_car') {
        await setSession(pool, chatId, 'signup_district', { ...session.data, car: text });
        return sendTelegram('sendMessage', { chat_id: chatId, text: "✅ Принято.\n\nШаг 3/3. Укажите ваш район или адрес для бесплатного вывоза:" });
    }
    if (session.state === 'signup_district') {
        const report = `🔥 <b>НОВАЯ ЗАЯВКА</b>\n\n<b>Тел:</b> ${session.data.phone}\n<b>Авто:</b> ${session.data.car}\n<b>Адрес:</b> ${text}\n<b>ChatID:</b> <code>${chatId}</code>`;
        
        if (ADMIN_CHAT_ID) {
            await sendTelegram('sendMessage', { chat_id: ADMIN_CHAT_ID, text: report, parse_mode: 'HTML' });
        }
        
        await setSession(pool, chatId, null, {});
        return sendTelegram('sendMessage', { 
            chat_id: chatId, 
            text: "✅ <b>Заявка принята!</b>\n\nМенеджер свяжется с вами в ближайшее время.",
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
        text: "✅ <b>Заявка принята!</b>\n\nОжидайте подтверждения времени от менеджера.", 
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

    const text = `💵 <b>Расчет продления</b>\n\n<b>Срок:</b> ${session.data.months} мес.\n<b>Диски:</b> ${session.data.hasRims ? 'Да' : 'Нет'}\n\n<b>Итого к оплате: ${total} ₽</b>\n\nДля оплаты свяжитесь с менеджером или используйте реквизиты из договора.`;
    
    await setSession(pool, chatId, null, {});
    return sendTelegram('sendMessage', { 
        chat_id: chatId, 
        text, 
        parse_mode: 'HTML', 
        reply_markup: { inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "main_menu" }]] } 
    });
}

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
    const res = await pool.query(`
        SELECT data FROM clients 
        WHERE (data->>'Chat ID' = $1 OR data->>'Chat ID' = $2)
        AND is_archived = FALSE 
        LIMIT 1
    `, [chatId, parseInt(chatId) || 0]);
    return res.rows[0]?.data;
}

function getMainMenu() {
    return {
        inline_keyboard: [
            [{ text: "📝 Записаться на хранение", callback_data: "flow_signup" }],
            [{ text: "👤 Личный кабинет", callback_data: "flow_lk" }],
            [{ text: "🔧 Шиномонтаж", callback_data: "menu_fitting" }],
            [{ text: "💰 Цены", callback_data: "info_prices" }, { text: "🏆 Почему мы", callback_data: "info_why" }],
            [{ text: "🤝 Партнёры", callback_data: "menu_partners" }],
            [{ text: "📞 Связаться с менеджером", url: "https://t.me/OtelShinAdmin" }]
        ]
    };
}

function getLkMenu(client: any) {
    return {
        inline_keyboard: [
            [{ text: "📅 Продлить хранение", callback_data: "lk_extend" }],
            [{ text: "🚗 Забрать шины", callback_data: "lk_pickup" }],
            [{ text: "🎁 Реферальная программа", callback_data: "lk_referral" }],
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
