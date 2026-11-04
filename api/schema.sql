-- ============================================================================
-- CRM "Шинный Отель" (Tyre Hotel) - PostgreSQL DDL Schema
-- Поддержка сущностей: Clients, Storage Orders, Tire Groups, Masters, 
-- Message Templates, History Events, Chat Messages, Bot Sessions
-- Обеспечение ссылочной целостности через Foreign Key (FK) constraints
-- ============================================================================

-- 0. Расширения (при необходимости)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Таблица Клиентов (clients)
-- Хранит постоянные персональные данные клиента
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    chat_id VARCHAR(50),
    car_number VARCHAR(50),
    address TEXT,
    traffic_source VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска клиентов
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_chat_id ON clients(chat_id);
CREATE INDEX IF NOT EXISTS idx_clients_car_number ON clients(car_number);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ----------------------------------------------------------------------------
-- 2. Таблица Договоров / Заказов хранения (storage_orders)
-- Связана с клиентом через ВНЕШНИЙ КЛЮЧ client_id -> clients(id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage_orders (
    id VARCHAR(64) PRIMARY KEY,
    client_id VARCHAR(64) NOT NULL,
    contract VARCHAR(100) NOT NULL UNIQUE,
    qr_code VARCHAR(100),
    start_date DATE NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 6,
    reminder_date DATE,
    expiry_date DATE NOT NULL,
    warehouse VARCHAR(100) NOT NULL DEFAULT 'Основной',
    cell VARCHAR(50) NOT NULL,
    price_per_month NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    debt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'Новая',
    service_pickup BOOLEAN NOT NULL DEFAULT FALSE,
    service_wash BOOLEAN NOT NULL DEFAULT FALSE,
    service_pack BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ограничение внешнего ключа: предотвращает появление "заказов-сирот"
    CONSTRAINT fk_storage_orders_client
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON UPDATE CASCADE 
        ON DELETE RESTRICT
);

-- Индексы для заказов
CREATE INDEX IF NOT EXISTS idx_storage_orders_client_id ON storage_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_storage_orders_contract ON storage_orders(contract);
CREATE INDEX IF NOT EXISTS idx_storage_orders_expiry_date ON storage_orders(expiry_date);
CREATE INDEX IF NOT EXISTS idx_storage_orders_status ON storage_orders(status);
CREATE INDEX IF NOT EXISTS idx_storage_orders_is_archived ON storage_orders(is_archived);
CREATE INDEX IF NOT EXISTS idx_storage_orders_warehouse_cell ON storage_orders(warehouse, cell);

-- ----------------------------------------------------------------------------
-- 3. Таблица Комплектов шин (tire_groups)
-- Связана с заказом через ВНЕШНИЙ КЛЮЧ order_id -> storage_orders(id)
-- Каскадное удаление: при удалении заказа удаляются связанные комплекты шин
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tire_groups (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    width VARCHAR(20),
    profile VARCHAR(20),
    diameter VARCHAR(20),
    count INTEGER NOT NULL DEFAULT 4,
    season VARCHAR(20) NOT NULL CHECK (season IN ('Лето', 'Зима')),
    has_rims VARCHAR(10) NOT NULL DEFAULT 'Нет' CHECK (has_rims IN ('Да', 'Нет')),
    dot_code VARCHAR(50),
    price_per_month NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ограничение внешнего ключа с каскадным удалением
    CONSTRAINT fk_tire_groups_order
        FOREIGN KEY (order_id) 
        REFERENCES storage_orders(id) 
        ON UPDATE CASCADE 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tire_groups_order_id ON tire_groups(order_id);
CREATE INDEX IF NOT EXISTS idx_tire_groups_season ON tire_groups(season);

-- ----------------------------------------------------------------------------
-- 4. Таблица Мастеров (masters)
-- Мастера шиномонтажа, выездного сервиса и партнеры
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS masters (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    chat_id VARCHAR(50),
    phone VARCHAR(50),
    services TEXT,
    address TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_masters_name ON masters(name);
CREATE INDEX IF NOT EXISTS idx_masters_chat_id ON masters(chat_id);

-- ----------------------------------------------------------------------------
-- 5. Таблица Шаблонов сообщений (message_templates)
-- HTML/Текстовые шаблоны уведомлений в Telegram/SMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_templates_name ON message_templates(name);

-- ----------------------------------------------------------------------------
-- 6. Таблица Истории событий / Аудита (history_events)
-- Фиксирует все действия менеджеров, оплаты, смену статусов и сезонные выдачи
-- Связана с клиентом и заказом через ВНЕШНИЕ КЛЮЧИ
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS history_events (
    id VARCHAR(64) PRIMARY KEY,
    client_id VARCHAR(64),
    order_id VARCHAR(64),
    user_name VARCHAR(100) NOT NULL DEFAULT 'Admin',
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Внешние ключи с установкой NULL при удалении клиента/заказа для сохранения аудита
    CONSTRAINT fk_history_client
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL,

    CONSTRAINT fk_history_order
        FOREIGN KEY (order_id) 
        REFERENCES storage_orders(id) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_history_client_id ON history_events(client_id);
CREATE INDEX IF NOT EXISTS idx_history_order_id ON history_events(order_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history_events(created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Таблица Сессий Telegram-бота (bot_sessions)
-- Хранит состояние диалога клиента с ботом
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_sessions (
    chat_id VARCHAR(50) PRIMARY KEY,
    state VARCHAR(100),
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 8. Таблица Чата / Сообщений (chat_messages)
-- История входящих и исходящих сообщений с клиентом
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    client_id VARCHAR(64),
    chat_id VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'file')),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    external_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chat_messages_client
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_client_id ON chat_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. Представление (View) для обратной совместимости с плоской структурой Client
-- Объединяет clients, storage_orders и tire_groups в привычный для CRM формат
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_clients_full AS
SELECT 
    c.id AS "id",
    TO_CHAR(so.created_at, 'YYYY-MM-DD') AS "Дата добавления",
    c.chat_id AS "Chat ID",
    c.name AS "Имя клиента",
    c.phone AS "Телефон",
    c.car_number AS "Номер Авто",
    so.contract AS "Договор",
    so.qr_code AS "Заказ - QR",
    tg.brand || COALESCE(' ' || tg.model, '') AS "Бренд_Модель",
    tg.dot_code AS "DOT-код",
    tg.diameter AS "Размер шин",
    tg.season AS "Сезон",
    so.price_per_month AS "Цена за месяц",
    tg.count AS "Кол-во шин",
    tg.has_rims AS "Наличие дисков",
    TO_CHAR(so.start_date, 'YYYY-MM-DD') AS "Начало",
    so.duration_months AS "Срок",
    TO_CHAR(so.reminder_date, 'YYYY-MM-DD') AS "Напомнить",
    TO_CHAR(so.expiry_date, 'YYYY-MM-DD') AS "Окончание",
    so.warehouse AS "Склад хранения",
    so.cell AS "Ячейка",
    so.total_price AS "Общая сумма",
    so.debt AS "Долг",
    c.address AS "Адрес клиента",
    so.status AS "Статус сделки",
    c.traffic_source AS "Источник трафика",
    so.service_pickup AS "Услуга: Вывоз",
    so.service_wash AS "Услуга: Мойка",
    so.service_pack AS "Услуга: Упаковка",
    so.photo_urls AS "photoUrls",
    so.metadata AS "metadata",
    so.is_archived AS "is_archived",
    so.id AS "order_id"
FROM storage_orders so
JOIN clients c ON so.client_id = c.id
LEFT JOIN LATERAL (
    SELECT * FROM tire_groups tg_sub 
    WHERE tg_sub.order_id = so.id 
    ORDER BY tg_sub.created_at ASC 
    LIMIT 1
) tg ON TRUE;

-- ----------------------------------------------------------------------------
-- 10. Триггеры обновления поля updated_at
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

DROP TRIGGER IF EXISTS set_timestamp_orders ON storage_orders;
CREATE TRIGGER set_timestamp_orders
BEFORE UPDATE ON storage_orders
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_masters ON masters;
CREATE TRIGGER set_timestamp_masters
BEFORE UPDATE ON masters
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_templates ON message_templates;
CREATE TRIGGER set_timestamp_templates
BEFORE UPDATE ON message_templates
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
