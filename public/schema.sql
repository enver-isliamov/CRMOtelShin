-- ============================================================================
-- CRM "Шинный Отель" (Tyre Hotel) - PostgreSQL / Supabase DDL Schema
-- Идемпотентная схема: безопасно выполняется как на чистой БД, так и на 
-- существующей БД с обновлением колонок (ALTER TABLE ADD COLUMN IF NOT EXISTS)
-- ============================================================================

-- 0. Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Таблица Клиентов (clients)
-- Создается, если её еще нет, или обновляется недостающими колонками
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    phone VARCHAR(50),
    chat_id VARCHAR(50),
    car_number VARCHAR(50),
    contract VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Новая',
    address TEXT,
    traffic_source VARCHAR(100),
    notes TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Безопасное добавление колонок на случай, если таблица clients уже была создана ранее в Supabase:
ALTER TABLE clients ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS chat_id VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS car_number VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Новая';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS traffic_source VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Миграция данных из поля data JSONB (если в Supabase уже были старые записи):
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'data'
    ) THEN
        UPDATE clients 
        SET 
            chat_id = COALESCE(chat_id, data->>'Chat ID'),
            car_number = COALESCE(car_number, data->>'Номер Авто'),
            address = COALESCE(address, data->>'Адрес клиента'),
            traffic_source = COALESCE(traffic_source, data->>'Источник трафика'),
            contract = COALESCE(contract, data->>'Договор'),
            name = COALESCE(name, data->>'Имя клиента'),
            phone = COALESCE(phone, data->>'Телефон'),
            status = COALESCE(status, data->>'Статус сделки')
        WHERE data IS NOT NULL;
    END IF;
END $$;

-- Индексы для клиентов
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_chat_id ON clients(chat_id);
CREATE INDEX IF NOT EXISTS idx_clients_car_number ON clients(car_number);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ----------------------------------------------------------------------------
-- 2. Таблица Договоров / Заказов хранения (storage_orders)
-- Связана с клиентом через ВНЕШНИЙ КЛЮЧ client_id -> clients(id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage_orders (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    contract VARCHAR(100) UNIQUE,
    qr_code VARCHAR(100),
    start_date DATE,
    duration_months INTEGER DEFAULT 6,
    reminder_date DATE,
    expiry_date DATE,
    warehouse VARCHAR(100) DEFAULT 'Основной',
    cell VARCHAR(50),
    price_per_month NUMERIC(10, 2) DEFAULT 0.00,
    total_price NUMERIC(10, 2) DEFAULT 0.00,
    debt NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Новая',
    service_pickup BOOLEAN DEFAULT FALSE,
    service_wash BOOLEAN DEFAULT FALSE,
    service_pack BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Добавляем внешний ключ безопасно, если его еще нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_storage_orders_client'
    ) THEN
        ALTER TABLE storage_orders
        ADD CONSTRAINT fk_storage_orders_client
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON UPDATE CASCADE 
        ON DELETE RESTRICT;
    END IF;
END $$;

-- Индексы для заказов
CREATE INDEX IF NOT EXISTS idx_storage_orders_client_id ON storage_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_storage_orders_contract ON storage_orders(contract);
CREATE INDEX IF NOT EXISTS idx_storage_orders_expiry_date ON storage_orders(expiry_date);
CREATE INDEX IF NOT EXISTS idx_storage_orders_status ON storage_orders(status);
CREATE INDEX IF NOT EXISTS idx_storage_orders_is_archived ON storage_orders(is_archived);

-- ----------------------------------------------------------------------------
-- 3. Таблица Комплектов шин (tire_groups)
-- Связана с заказом через ВНЕШНИЙ КЛЮЧ order_id -> storage_orders(id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tire_groups (
    id VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    width VARCHAR(20),
    profile VARCHAR(20),
    diameter VARCHAR(20),
    count INTEGER DEFAULT 4,
    season VARCHAR(20),
    has_rims VARCHAR(10) DEFAULT 'Нет',
    dot_code VARCHAR(50),
    price_per_month NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tire_groups_order'
    ) THEN
        ALTER TABLE tire_groups
        ADD CONSTRAINT fk_tire_groups_order
        FOREIGN KEY (order_id) 
        REFERENCES storage_orders(id) 
        ON UPDATE CASCADE 
        ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tire_groups_order_id ON tire_groups(order_id);
CREATE INDEX IF NOT EXISTS idx_tire_groups_season ON tire_groups(season);

-- ----------------------------------------------------------------------------
-- 4. Таблица Мастеров (masters)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS masters (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    chat_id VARCHAR(50),
    phone VARCHAR(50),
    services TEXT,
    address TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE masters ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE masters ADD COLUMN IF NOT EXISTS chat_id VARCHAR(50);
ALTER TABLE masters ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE masters ADD COLUMN IF NOT EXISTS services TEXT;
ALTER TABLE masters ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE masters ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_masters_name ON masters(name);
CREATE INDEX IF NOT EXISTS idx_masters_chat_id ON masters(chat_id);

-- ----------------------------------------------------------------------------
-- 5. Таблица Шаблонов сообщений (message_templates)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Совместимость с таблицей templates (если уже была создана ранее)
CREATE TABLE IF NOT EXISTS templates (
    name VARCHAR(255) PRIMARY KEY,
    content TEXT,
    data JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. Таблица Истории событий / Аудита (history_events / history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS history_events (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255),
    order_id VARCHAR(255),
    user_name VARCHAR(100) NOT NULL DEFAULT 'Admin',
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Обеспечение наличия старой таблицы history
CREATE TABLE IF NOT EXISTS history (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255),
    action VARCHAR(255),
    details TEXT,
    user_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_history_client'
    ) THEN
        ALTER TABLE history_events
        ADD CONSTRAINT fk_history_client
        FOREIGN KEY (client_id) REFERENCES clients(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_history_order'
    ) THEN
        ALTER TABLE history_events
        ADD CONSTRAINT fk_history_order
        FOREIGN KEY (order_id) REFERENCES storage_orders(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_history_events_client_id ON history_events(client_id);
CREATE INDEX IF NOT EXISTS idx_history_events_created_at ON history_events(created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Таблица Сессий Telegram-бота (bot_sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_sessions (
    chat_id VARCHAR(50) PRIMARY KEY,
    state VARCHAR(100),
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 8. Таблица Настроек (settings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB
);

-- ----------------------------------------------------------------------------
-- 9. Представление (View) для обратной совместимости: view_clients_full
-- Использует COALESCE для извлечения колонок как из отдельных полей, так и из data JSONB
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_clients_full AS
SELECT 
    c.id AS "id",
    TO_CHAR(COALESCE(so.created_at, c.created_at), 'YYYY-MM-DD') AS "Дата добавления",
    COALESCE(c.chat_id, c.data->>'Chat ID') AS "Chat ID",
    COALESCE(c.name, c.data->>'Имя клиента') AS "Имя клиента",
    COALESCE(c.phone, c.data->>'Телефон') AS "Телефон",
    COALESCE(c.car_number, c.data->>'Номер Авто') AS "Номер Авто",
    COALESCE(so.contract, c.contract, c.data->>'Договор') AS "Договор",
    COALESCE(so.qr_code, c.data->>'Заказ - QR') AS "Заказ - QR",
    COALESCE(
        tg.brand || COALESCE(' ' || tg.model, ''), 
        c.data->>'Бренд_Модель'
    ) AS "Бренд_Модель",
    COALESCE(tg.dot_code, c.data->>'DOT-код') AS "DOT-код",
    COALESCE(tg.diameter, c.data->>'Размер шин') AS "Размер шин",
    COALESCE(tg.season, c.data->>'Сезон') AS "Сезон",
    COALESCE(so.price_per_month, (c.data->>'Цена за месяц')::NUMERIC, 0) AS "Цена за месяц",
    COALESCE(tg.count, (c.data->>'Кол-во шин')::INTEGER, 4) AS "Кол-во шин",
    COALESCE(tg.has_rims, c.data->>'Наличие дисков', 'Нет') AS "Наличие дисков",
    COALESCE(TO_CHAR(so.start_date, 'YYYY-MM-DD'), c.data->>'Начало') AS "Начало",
    COALESCE(so.duration_months, (c.data->>'Срок')::INTEGER, 6) AS "Срок",
    COALESCE(TO_CHAR(so.reminder_date, 'YYYY-MM-DD'), c.data->>'Напомнить') AS "Напомнить",
    COALESCE(TO_CHAR(so.expiry_date, 'YYYY-MM-DD'), c.data->>'Окончание') AS "Окончание",
    COALESCE(so.warehouse, c.data->>'Склад хранения', 'Основной') AS "Склад хранения",
    COALESCE(so.cell, c.data->>'Ячейка', '') AS "Ячейка",
    COALESCE(so.total_price, (c.data->>'Общая сумма')::NUMERIC, 0) AS "Общая сумма",
    COALESCE(so.debt, (c.data->>'Долг')::NUMERIC, 0) AS "Долг",
    COALESCE(c.address, c.data->>'Адрес клиента') AS "Адрес клиента",
    COALESCE(so.status, c.status, c.data->>'Статус сделки', 'Новая') AS "Статус сделки",
    COALESCE(c.traffic_source, c.data->>'Источник трафика') AS "Источник трафика",
    COALESCE(so.service_pickup, (c.data->>'Услуга: Вывоз')::BOOLEAN, FALSE) AS "Услуга: Вывоз",
    COALESCE(so.service_wash, (c.data->>'Услуга: Мойка')::BOOLEAN, FALSE) AS "Услуга: Мойка",
    COALESCE(so.service_pack, (c.data->>'Услуга: Упаковка')::BOOLEAN, FALSE) AS "Услуга: Упаковка",
    COALESCE(so.photo_urls, ARRAY[]::TEXT[]) AS "photoUrls",
    COALESCE(so.metadata, c.data) AS "metadata",
    COALESCE(so.is_archived, c.is_archived, FALSE) AS "is_archived"
FROM clients c
LEFT JOIN storage_orders so ON so.client_id = c.id
LEFT JOIN LATERAL (
    SELECT * FROM tire_groups tg_sub 
    WHERE tg_sub.order_id = so.id 
    ORDER BY tg_sub.created_at ASC 
    LIMIT 1
) tg ON TRUE;

-- ----------------------------------------------------------------------------
-- 10. Триггер для автоматического обновления updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_clients ON clients;
CREATE TRIGGER set_timestamp_clients
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
