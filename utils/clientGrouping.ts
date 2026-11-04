import { Client, StorageOrder } from '../types';

/**
 * Очищает номер телефона от спецсимволов для надежного сопоставления
 */
export function normalizePhone(phone?: string | number): string {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    // Если 11 цифр и начинается с 8 или 7, нормализуем последние 10 цифр
    if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
        return digits.substring(1);
    }
    return digits;
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
 * Объединяет разрозненные заказы (активные и архивные) вокруг уникальных клиентов (1 Клиент -> N Заказов)
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
    const clientsMap = new Map<string, {
        baseClient: Client;
        orders: StorageOrder[];
    }>();

    // Вспомогательная функция для генерации ключа клиента
    const getClientKey = (item: Client): string => {
        const phone = normalizePhone(item['Телефон']);
        if (phone && phone.length >= 7) {
            return `p_${phone}`;
        }
        const name = String(item['Имя клиента'] || '').trim().toLowerCase();
        if (name) {
            const car = String(item['Номер Авто'] || '').trim().toUpperCase().replace(/\s+/g, '');
            return `n_${name}_${car}`;
        }
        return `id_${item.id}`;
    };

    // 1. Обрабатываем активные записи
    for (const item of rawActive) {
        const key = getClientKey(item);
        const order = clientRecordToStorageOrder(item);

        if (!clientsMap.has(key)) {
            clientsMap.set(key, {
                baseClient: { ...item },
                orders: [order]
            });
        } else {
            const existing = clientsMap.get(key)!;
            // Добавляем заказ, если такого договора еще нет
            if (!existing.orders.some(o => o.contract === order.contract && o.id === order.id)) {
                existing.orders.push(order);
            }
        }
    }

    // 2. Обрабатываем архивные записи (завершенные сезоны)
    for (const item of rawArchive) {
        const key = getClientKey(item);
        const order = clientRecordToStorageOrder(item);
        order.isArchived = true;

        if (!clientsMap.has(key)) {
            clientsMap.set(key, {
                baseClient: { 
                    ...item, 
                    is_archived: true, 
                    'Статус сделки': item['Статус сделки'] || 'Шины у клиента' 
                },
                orders: [order]
            });
        } else {
            const existing = clientsMap.get(key)!;
            if (!existing.orders.some(o => o.contract === order.contract && o.id === order.id)) {
                existing.orders.push(order);
            }
        }
    }

    const allClients: Client[] = [];
    const activeClients: Client[] = [];
    const inactiveClients: Client[] = [];

    // 3. Формируем итоговые единые карточки клиентов
    for (const [, entry] of clientsMap.entries()) {
        const { baseClient, orders } = entry;

        // Сортируем заказы: самые свежие сверху
        orders.sort((a, b) => {
            const dateA = a.startDate || a.expiryDate || '';
            const dateB = b.startDate || b.expiryDate || '';
            return dateB.localeCompare(dateA);
        });

        // Находим текущий активный заказ (шины на складе)
        const activeOrder = orders.find(o => 
            !o.isArchived && 
            o.warehouse !== 'У Клиента' && 
            o.status !== 'Выдано' && 
            o.status !== 'Закрыта' &&
            o.status !== 'Завершено'
        );

        const latestOrder = orders[0];
        const hasActiveStorage = Boolean(activeOrder);
        const totalSpent = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

        // Используем данные актуального заказа для отображения в списке
        const currentData = activeOrder || latestOrder;

        const unifiedClient: Client = {
            ...baseClient,
            id: baseClient.id || currentData.id,
            'Имя клиента': baseClient['Имя клиента'] || currentData.clientName || 'Без имени',
            'Телефон': baseClient['Телефон'] || currentData.phone || '',
            'Номер Авто': baseClient['Номер Авто'] || currentData.carNumber || '',
            'Договор': currentData ? currentData.contract : baseClient['Договор'],
            'Бренд_Модель': currentData ? currentData.brandModel : baseClient['Бренд_Модель'],
            'Размер шин': currentData ? currentData.tireSize : baseClient['Размер шин'],
            'DOT-код': currentData ? currentData.dotCode : baseClient['DOT-код'],
            'Сезон': currentData ? currentData.season : baseClient['Сезон'],
            'Кол-во шин': currentData ? currentData.tireCount : baseClient['Кол-во шин'],
            'Наличие дисков': currentData ? currentData.hasRims : baseClient['Наличие дисков'],
            'Начало': currentData ? currentData.startDate : baseClient['Начало'],
            'Окончание': currentData ? currentData.expiryDate : baseClient['Окончание'],
            'Напомнить': currentData ? currentData.reminderDate : baseClient['Напомнить'],
            'Срок': currentData ? currentData.durationMonths : baseClient['Срок'],
            'Склад хранения': activeOrder ? activeOrder.warehouse : (currentData?.warehouse || 'У Клиента'),
            'Ячейка': activeOrder ? activeOrder.cell : '',
            'Общая сумма': currentData ? currentData.totalPrice : baseClient['Общая сумма'],
            'Долг': activeOrder ? activeOrder.debt : (currentData ? currentData.debt : 0),
            'Статус сделки': hasActiveStorage 
                ? (activeOrder?.status || 'На складе') 
                : 'Шины у клиента',
            is_archived: !hasActiveStorage,
            photoUrls: currentData?.photoUrls || baseClient.photoUrls || [],

            // Client-Centric Order Relations
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

    // Сортировка клиентов по дате/имени
    allClients.sort((a, b) => (b['Начало'] || '').localeCompare(a['Начало'] || ''));
    activeClients.sort((a, b) => (a['Окончание'] || '').localeCompare(b['Окончание'] || ''));
    inactiveClients.sort((a, b) => (b['Окончание'] || '').localeCompare(a['Окончание'] || ''));

    const clientMap = new Map<string, Client>();
    for (const c of allClients) {
        clientMap.set(String(c.id), c);
        // Также привязываем по ID всех заказов, чтобы при переходе по ссылке любого заказа открывался нужный клиент
        if (c.orders) {
            for (const ord of c.orders) {
                if (!clientMap.has(ord.id)) {
                    clientMap.set(ord.id, c);
                }
            }
        }
    }

    return {
        activeClients,
        inactiveClients,
        allClients,
        clientMap
    };
}
