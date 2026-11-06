import { Client, StorageOrder } from '../types';

/**
 * Очищает и нормализует номер телефона (возвращает 10 цифр для РФ/СНГ номеров)
 */
export function normalizePhone(phone?: string | number): string {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';

    // Если 11 цифр и начинается с 7 или 8 (РФ/Казахстан), берем последние 10 цифр
    if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
        return digits.substring(1);
    }
    // Если уже 10 цифр (например 9781234567)
    if (digits.length === 10) {
        return digits;
    }
    // Если 12 цифр и начинается с 380 (Украина)
    if (digits.length === 12 && digits.startsWith('380')) {
        return digits.substring(2);
    }
    // Если 11 цифр и начинается с 380 (например 38099934707)
    if (digits.length === 11 && digits.startsWith('380')) {
        return digits.substring(1);
    }
    // Если длинный номер, берем последние 10 цифр
    if (digits.length > 10) {
        return digits.slice(-10);
    }
    return digits;
}

/**
 * Извлекает все телефонные номера из строки (если указано несколько через перенос, запятую или слэш)
 */
export function extractPhones(phone?: string | number): string[] {
    if (!phone) return [];
    const str = String(phone);
    const parts = str.split(/[\n\r,;/|]+/);
    const results = new Set<string>();

    for (const part of parts) {
        const norm = normalizePhone(part);
        if (norm && norm.length >= 7) {
            results.add(norm);
        }
        // Обработка двух слипшихся номеров (например 22 цифры без разделителя)
        const rawDigits = part.replace(/\D/g, '');
        if (rawDigits.length >= 20) {
            const p1 = normalizePhone(rawDigits.slice(0, 11));
            const p2 = normalizePhone(rawDigits.slice(11));
            if (p1 && p1.length >= 7) results.add(p1);
            if (p2 && p2.length >= 7) results.add(p2);
        }
    }
    return Array.from(results);
}

/**
 * Нормализует номер автомобиля с заменой латинских омоглифов на кириллицу
 */
export function normalizeCarNumber(car?: string): string {
    if (!car) return '';
    const upper = String(car).toUpperCase().replace(/[\s\-_.]/g, '');
    const homoglyphs: Record<string, string> = {
        'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'H': 'Н', 'K': 'К',
        'M': 'М', 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х', 'Y': 'У'
    };
    return upper.split('').map(ch => homoglyphs[ch] || ch).join('');
}

/**
 * Нормализует ФИО для надежного сопоставления
 */
export function normalizeName(name?: string): string {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
        .replace(/\s+/g, ' ');
}

/**
 * Разбивает ФИО на смысловые токены (фамилия, имя, отчество)
 */
export function getNameTokens(name?: string): string[] {
    const norm = normalizeName(name);
    return norm.split(' ').filter(w => w.length > 1);
}

/**
 * Преобразует плоскую запись клиента/заказа в нормализованную структуру StorageOrder
 */
export function clientRecordToStorageOrder(rec: Client, clientName?: string, phone?: string, carNumber?: string): StorageOrder {
    const isArchived = Boolean(
        rec.is_archived || 
        rec['Склад хранения'] === 'У Клиента' || 
        rec['Статус сделки'] === 'Закрыта' || 
        rec['Статус сделки'] === 'Выдано' ||
        rec['Статус сделки'] === 'Завершено'
    );

    const photos = Array.isArray(rec.photoUrls)
        ? rec.photoUrls
        : (typeof (rec.photoUrls as unknown) === 'string' && (rec.photoUrls as unknown as string).trim().length > 0
            ? (rec.photoUrls as unknown as string).split(',')
            : []);

    return {
        id: rec.id,
        contract: rec['Договор'] || rec.id,
        qrCode: rec['Заказ - QR'] || '',
        startDate: rec['Начало'] || rec['Дата добавления'] || '',
        durationMonths: Number(rec['Срок'] || 0),
        reminderDate: rec['Напомнить'] || '',
        expiryDate: rec['Окончание'] || '',
        warehouse: rec['Склад хранения'] || (isArchived ? 'У Клиента' : 'Основной'),
        cell: rec['Ячейка'] || '',
        pricePerMonth: Number(rec['Цена за месяц'] || 0),
        totalPrice: Number(rec['Общая сумма'] || 0),
        debt: Number(rec['Долг'] || 0),
        status: rec['Статус сделки'] || (isArchived ? 'Выдано' : 'На складе'),
        servicePickup: Boolean(rec['Услуга: Вывоз']),
        serviceWash: Boolean(rec['Услуга: Мойка']),
        servicePack: Boolean(rec['Услуга: Упаковка']),
        isArchived,
        photoUrls: photos,
        brandModel: rec['Бренд_Модель'] || '',
        tireSize: rec['Размер шин'] || '',
        dotCode: rec['DOT-код'] || '',
        season: rec['Сезон'] || 'Лето',
        tireCount: Number(rec['Кол-во шин'] || 4),
        hasRims: rec['Наличие дисков'] || 'Нет',
        metadata: rec.metadata || '',
        clientId: rec.id,
        clientName: clientName || rec['Имя клиента'],
        phone: phone || rec['Телефон'],
        carNumber: carNumber || rec['Номер Авто']
    };
}

/**
 * Union-Find (Disjoint-Set) структура для группировки записей одного клиента
 */
class UnionFind {
    private parent: number[];

    constructor(size: number) {
        this.parent = Array.from({ length: size }, (_, i) => i);
    }

    find(i: number): number {
        if (this.parent[i] === i) return i;
        this.parent[i] = this.find(this.parent[i]);
        return this.parent[i];
    }

    union(i: number, j: number): void {
        const rootI = this.find(i);
        const rootJ = this.find(j);
        if (rootI !== rootJ) {
            this.parent[rootI] = rootJ;
        }
    }
}

/**
 * Проверяет, принадлежат ли две записи одному и тому же физическому клиенту
 */
function areRecordsSameClient(
    a: { client: Client; phones: string[]; car: string; nameTokens: string[]; chatId: string },
    b: { client: Client; phones: string[]; car: string; nameTokens: string[]; chatId: string }
): boolean {
    // 1. Совпадение по номеру телефона (наивысшая надежность)
    if (a.phones.length > 0 && b.phones.length > 0) {
        const hasCommonPhone = a.phones.some(p => b.phones.includes(p));
        if (hasCommonPhone) return true;
    }

    // 2. Совпадение по Telegram Chat ID
    if (a.chatId && b.chatId && a.chatId !== '0' && a.chatId === b.chatId) {
        return true;
    }

    // 3. Совпадение по уникальному ID клиента
    if (a.client.id && b.client.id && a.client.id === b.client.id) {
        return true;
    }

    // 4. Совпадение по номеру договора
    const contractA = String(a.client['Договор'] || '').trim();
    const contractB = String(b.client['Договор'] || '').trim();
    if (contractA && contractB && contractA !== '0000 00 00' && contractA === contractB) {
        return true;
    }

    // 5. Совпадение по номеру авто И фамилии (если есть госномер и совпадает первая часть имени)
    if (a.car && b.car && a.car === b.car && a.nameTokens.length > 0 && b.nameTokens.length > 0) {
        if (a.nameTokens[0] === b.nameTokens[0]) {
            return true;
        }
    }

    // 6. Совпадение по Фамилии + Имени (когда у одной из записей не заполнен телефон)
    if (a.nameTokens.length >= 2 && b.nameTokens.length >= 2) {
        const sameLastName = a.nameTokens[0] === b.nameTokens[0];
        const sameFirstName = a.nameTokens[1] === b.nameTokens[1];
        if (sameLastName && sameFirstName) {
            // Если у обоих заполнены разные телефоны, это могут быть однофамильцы
            const bothHavePhones = a.phones.length > 0 && b.phones.length > 0;
            if (!bothHavePhones) {
                return true;
            }
        }
    }

    // 7. Одинаковое редкое имя / позывной (например 'Сейд'), если нет конфликтующих телефонов
    if (a.nameTokens.length === 1 && b.nameTokens.length === 1 && a.nameTokens[0] === b.nameTokens[0]) {
        const bothHavePhones = a.phones.length > 0 && b.phones.length > 0;
        if (!bothHavePhones) {
            return true;
        }
    }

    return false;
}

/**
 * Объединяет разрозненные заказы (активные и архивные) вокруг уникальных клиентов (1 Клиент -> N Заказов)
 * с полной дедупликацией по номерам телефонов, ФИО, договорам и номерам авто.
 */
export function buildUnifiedClients(
    rawActive: Client[] = [], 
    rawArchive: Client[] = []
): { 
    activeClients: Client[]; 
    inactiveClients: Client[]; 
    allClients: Client[];
    clientMap: Map<string, Client>;
} {
    // 1. Собираем все исходные записи с пометкой источника
    const activeTagged = (rawActive || []).map(c => ({ client: { ...c }, isRawArchive: false }));
    const archiveTagged = (rawArchive || []).map(c => ({ client: { ...c, is_archived: true }, isRawArchive: true }));
    const allRecords = [...activeTagged, ...archiveTagged];

    if (allRecords.length === 0) {
        return {
            activeClients: [],
            inactiveClients: [],
            allClients: [],
            clientMap: new Map()
        };
    }

    // 2. Предварительная нормализация метаданных каждой записи для быстрого сопоставления
    const prepared = allRecords.map(item => {
        const c = item.client;
        return {
            client: c,
            isRawArchive: item.isRawArchive,
            phones: extractPhones(c['Телефон']),
            car: normalizeCarNumber(c['Номер Авто']),
            nameTokens: getNameTokens(c['Имя клиента']),
            chatId: String(c['Chat ID'] || '').trim(),
            contract: String(c['Договор'] || '').trim(),
        };
    });

    // 3. Кластеризация записей через Union-Find
    const uf = new UnionFind(prepared.length);

    for (let i = 0; i < prepared.length; i++) {
        for (let j = i + 1; j < prepared.length; j++) {
            if (areRecordsSameClient(prepared[i], prepared[j])) {
                uf.union(i, j);
            }
        }
    }

    // 4. Сборка кластеров
    const clusters = new Map<number, typeof prepared>();
    for (let i = 0; i < prepared.length; i++) {
        const root = uf.find(i);
        if (!clusters.has(root)) {
            clusters.set(root, []);
        }
        clusters.get(root)!.push(prepared[i]);
    }

    const allClients: Client[] = [];
    const activeClients: Client[] = [];
    const inactiveClients: Client[] = [];

    // 5. Формирование единого объекта клиента для каждого кластера
    for (const [, group] of clusters.entries()) {
        // Собираем все уникальные заказы кластера
        const ordersMap = new Map<string, StorageOrder>();

        for (const item of group) {
            const ord = clientRecordToStorageOrder(
                item.client, 
                item.client['Имя клиента'], 
                item.client['Телефон'], 
                item.client['Номер Авто']
            );
            if (item.isRawArchive) {
                ord.isArchived = true;
            }

            // Ключ заказа для исключения дубликатов одного и того же договора
            const orderKey = ord.contract && ord.contract !== '0000 00 00' 
                ? `c_${ord.contract}` 
                : (ord.id ? `id_${ord.id}` : `dt_${ord.startDate}_${ord.brandModel}`);

            if (!ordersMap.has(orderKey)) {
                ordersMap.set(orderKey, ord);
            } else {
                // Если заказ уже есть, дополняем недостающими данными (фото, qr, etc.)
                const existing = ordersMap.get(orderKey)!;
                if (!existing.qrCode && ord.qrCode) existing.qrCode = ord.qrCode;
                if (!existing.dotCode && ord.dotCode) existing.dotCode = ord.dotCode;
                if (ord.photoUrls && ord.photoUrls.length > existing.photoUrls.length) {
                    existing.photoUrls = ord.photoUrls;
                }
            }
        }

        const orders = Array.from(ordersMap.values());

        // Сортируем заказы: самые свежие сверху
        orders.sort((a, b) => {
            const dateA = a.startDate || a.expiryDate || '';
            const dateB = b.startDate || b.expiryDate || '';
            return dateB.localeCompare(dateA);
        });

        // Находим текущий активный заказ (шины находятся на складе)
        const activeOrder = orders.find(o => 
            !o.isArchived && 
            o.warehouse !== 'У Клиента' && 
            o.status !== 'Выдано' && 
            o.status !== 'Закрыта' &&
            o.status !== 'Завершено'
        );

        const latestOrder = orders[0] || ordersMap.values().next().value;
        const hasActiveStorage = Boolean(activeOrder);
        const totalSpent = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

        // Для шапки карточки выбираем наиболее полную и актуальную информацию
        const activeItem = group.find(g => !g.isRawArchive) || group[0];
        const bestNameItem = group.slice().sort((a, b) => 
            String(b.client['Имя клиента'] || '').length - String(a.client['Имя клиента'] || '').length
        )[0];
        const bestPhoneItem = group.find(g => g.phones.length > 0) || group[0];
        const bestCarItem = group.find(g => g.car.length > 0) || group[0];
        const bestChatIdItem = group.find(g => g.chatId && g.chatId !== '0');

        const currentData = activeOrder || latestOrder;

        // Собираем все уникальные фотографии со всех заказов клиента
        const allPhotos: string[] = [];
        orders.forEach(o => {
            if (Array.isArray(o.photoUrls)) {
                o.photoUrls.forEach(url => {
                    if (url && !allPhotos.includes(url)) allPhotos.push(url);
                });
            }
        });

        const unifiedClient: Client = {
            ...activeItem.client,
            id: activeItem.client.id || currentData?.id || `unified_${Math.random()}`,
            'Имя клиента': bestNameItem.client['Имя клиента'] || currentData?.clientName || 'Без имени',
            'Телефон': bestPhoneItem.client['Телефон'] || currentData?.phone || '',
            'Номер Авто': bestCarItem.client['Номер Авто'] || currentData?.carNumber || '',
            'Chat ID': bestChatIdItem ? bestChatIdItem.client['Chat ID'] : (activeItem.client['Chat ID'] || ''),
            'Адрес клиента': group.find(g => g.client['Адрес клиента'])?.client['Адрес клиента'] || '',
            'Договор': currentData ? currentData.contract : activeItem.client['Договор'],
            'Бренд_Модель': currentData ? currentData.brandModel : activeItem.client['Бренд_Модель'],
            'Размер шин': currentData ? currentData.tireSize : activeItem.client['Размер шин'],
            'DOT-код': currentData ? currentData.dotCode : activeItem.client['DOT-код'],
            'Сезон': currentData ? currentData.season : activeItem.client['Сезон'],
            'Кол-во шин': currentData ? currentData.tireCount : activeItem.client['Кол-во шин'],
            'Наличие дисков': currentData ? currentData.hasRims : activeItem.client['Наличие дисков'],
            'Начало': currentData ? currentData.startDate : activeItem.client['Начало'],
            'Окончание': currentData ? currentData.expiryDate : activeItem.client['Окончание'],
            'Напомнить': currentData ? currentData.reminderDate : activeItem.client['Напомнить'],
            'Срок': currentData ? currentData.durationMonths : activeItem.client['Срок'],
            'Склад хранения': activeOrder ? activeOrder.warehouse : (currentData?.warehouse || 'У Клиента'),
            'Ячейка': activeOrder ? activeOrder.cell : '',
            'Общая сумма': currentData ? currentData.totalPrice : activeItem.client['Общая сумма'],
            'Долг': activeOrder ? activeOrder.debt : (currentData ? currentData.debt : 0),
            'Статус сделки': hasActiveStorage 
                ? (activeOrder?.status || 'На складе') 
                : 'Шины у клиента',
            is_archived: !hasActiveStorage,
            photoUrls: allPhotos.length > 0 ? allPhotos : (currentData?.photoUrls || []),

            // Client-Centric Relations
            orders,
            ordersCount: orders.length,
            hasActiveStorage,
            totalSpent,
            activeOrder,
            latestOrder
        };

        allClients.push(unifiedClient);
        if (hasActiveStorage) {
            activeClients.push(unifiedClient);
        } else {
            inactiveClients.push(unifiedClient);
        }
    }

    // 6. Сортировка клиентов
    allClients.sort((a, b) => (b['Начало'] || '').localeCompare(a['Начало'] || ''));
    activeClients.sort((a, b) => (a['Окончание'] || '').localeCompare(b['Окончание'] || ''));
    inactiveClients.sort((a, b) => (b['Окончание'] || '').localeCompare(a['Окончание'] || ''));

    // 7. Создание карты быстрого поиска по всем известным идентификаторам клиента
    const clientMap = new Map<string, Client>();
    for (const c of allClients) {
        clientMap.set(String(c.id), c);

        // Привязываем по ID всех заказов клиента
        if (c.orders) {
            for (const ord of c.orders) {
                if (ord.id) clientMap.set(String(ord.id), c);
                if (ord.contract) clientMap.set(String(ord.contract), c);
            }
        }

        // Привязываем по нормализованным телефонам
        const phones = extractPhones(c['Телефон']);
        for (const p of phones) {
            clientMap.set(`phone_${p}`, c);
        }
    }

    return {
        activeClients,
        inactiveClients,
        allClients,
        clientMap
    };
}
