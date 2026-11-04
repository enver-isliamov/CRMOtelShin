/**
 * Supabase Direct Client Provider (Passwordless Mode).
 * Connects directly to Supabase via Project URL and Anon/Service-Role API Key.
 * No Postgres password or connection strings required!
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, StorageOrder, Master, MessageTemplate, parseCurrency, parseDuration } from '../types';
import { LocalCRMStorage } from './api';
import { photoStorage } from '../utils/photoStorage';

export interface SupabaseConfig {
  url: string;
  key: string;
}

let cachedClient: SupabaseClient | null = null;
let currentConfigHash: string = '';

export function saveSupabaseConfig(url: string, key: string) {
  try {
    const cleanUrl = (url || '').trim();
    const cleanKey = (key || '').trim();
    if (!cleanUrl || !cleanKey) return;

    // 1. Save in dedicated localStorage keys
    localStorage.setItem('supabase_direct_url', cleanUrl);
    localStorage.setItem('supabase_direct_key', cleanKey);

    // 2. Also keep crm_settings in sync
    const raw = localStorage.getItem('crm_settings');
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.supabaseUrl = cleanUrl;
    parsed.supabaseKey = cleanKey;
    localStorage.setItem('crm_settings', JSON.stringify(parsed));
  } catch (e) {
    console.warn('[Supabase] Failed to persist config to localStorage:', e);
  }
}

export async function fetchServerPublicConfig(): Promise<{ supabaseUrl?: string; supabaseKey?: string; hasPostgres?: boolean }> {
  try {
    const res = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_public_config' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        if (data.supabaseUrl && data.supabaseKey) {
          saveSupabaseConfig(data.supabaseUrl, data.supabaseKey);
        }
        return data;
      }
    }
  } catch {}
  return {};
}

export function getSupabaseConfig(): SupabaseConfig {
  let url = '';
  let key = '';

  // 1. Try dedicated localStorage keys first
  try {
    const directUrl = localStorage.getItem('supabase_direct_url');
    const directKey = localStorage.getItem('supabase_direct_key');
    if (directUrl) url = directUrl.trim();
    if (directKey) key = directKey.trim();
  } catch {}

  // 2. Try crm_settings
  if (!url || !key) {
    try {
      const raw = localStorage.getItem('crm_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.supabaseUrl && !url) url = parsed.supabaseUrl.trim();
        if (parsed.supabaseKey && !key) key = parsed.supabaseKey.trim();
      }
    } catch {}
  }

  // 3. Fallback to Vite env variables
  if (!url && typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
    url = String(import.meta.env.VITE_SUPABASE_URL).trim();
  }
  if (!key && typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) {
    key = String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim();
  }

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key && url.startsWith('http') && key.length > 10);
}

export function getSupabaseClient(overrideUrl?: string, overrideKey?: string): SupabaseClient | null {
  const { url, key } = overrideUrl && overrideKey 
    ? { url: overrideUrl.trim(), key: overrideKey.trim() } 
    : getSupabaseConfig();

  if (!url || !key) return null;

  const hash = `${url}_${key}`;
  if (cachedClient && currentConfigHash === hash) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    currentConfigHash = hash;
    return cachedClient;
  } catch (e) {
    console.warn('[Supabase] Failed to initialize client:', e);
    return null;
  }
}

/**
 * Health check & diagnostic test for Supabase connection
 */
export async function testSupabaseConnection(overrideUrl?: string, overrideKey?: string): Promise<{
  success: boolean;
  message: string;
  clientsCount?: number;
  tablesFound?: boolean;
}> {
  const client = getSupabaseClient(overrideUrl, overrideKey);
  if (!client) {
    return {
      success: false,
      message: 'Не указан Project URL или API Key. Заполните оба поля.',
    };
  }

  try {
    // 1. Check if 'clients' table exists and query it
    const { count, error } = await client
      .from('clients')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation "clients" does not exist') || error.message.includes('not found')) {
        return {
          success: false,
          tablesFound: false,
          message: 'Подключение к Supabase успешно, но таблицы еще не созданы! Скопируйте SQL-схему и запустите её в SQL Editor.',
        };
      }
      return {
        success: false,
        message: `Ошибка Supabase: ${error.message} (код: ${error.code || error.hint || 'UNKNOWN'})`,
      };
    }

    // Auto-save configuration on successful connection
    if (overrideUrl && overrideKey) {
      saveSupabaseConfig(overrideUrl, overrideKey);
    }

    return {
      success: true,
      tablesFound: true,
      clientsCount: count || 0,
      message: `Подключение успешно! Связь с облаком Supabase активна (найдено клиентов: ${count || 0}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Сетевая ошибка при запросе к Supabase: ${err?.message || err}`,
    };
  }
}

/**
 * Helper: map a raw row from Supabase 'clients' table to CRM Client type
 */
function mapRowToClient(row: any): Client {
  const extra = row.data && typeof row.data === 'object' ? row.data : {};
  const photoUrls = Array.isArray(row.photo_urls)
    ? row.photo_urls
    : typeof row.photo_urls === 'string' && row.photo_urls.trim().length > 0
    ? row.photo_urls.split(',')
    : Array.isArray(extra.photoUrls)
    ? extra.photoUrls
    : [];

  return {
    ...extra,
    id: String(row.id),
    'Имя клиента': row.name || extra['Имя клиента'] || 'Без имени',
    'Телефон': row.phone || extra['Телефон'] || '',
    'Chat ID': row.chat_id || extra['Chat ID'] || '',
    'Номер Авто': row.car_number || extra['Номер Авто'] || '',
    'Договор': row.contract || extra['Договор'] || '',
    'Статус сделки': row.status || extra['Статус сделки'] || 'На складе',
    'Адрес клиента': row.address || extra['Адрес клиента'] || '',
    'Источник трафика': row.traffic_source || extra['Источник трафика'] || '',
    'Дата добавления': row.created_at ? String(row.created_at).split('T')[0] : extra['Дата добавления'] || new Date().toISOString().split('T')[0],
    photoUrls,
    is_archived: Boolean(row.is_archived),
  };
}

/**
 * Helper: format CRM client to Supabase row format
 */
function mapClientToRow(c: Partial<Client>) {
  return {
    id: String(c.id),
    name: c['Имя клиента'] || '',
    phone: c['Телефон'] || '',
    chat_id: c['Chat ID'] || '',
    car_number: c['Номер Авто'] || '',
    contract: c['Договор'] || '',
    status: c['Статус сделки'] || 'На складе',
    address: c['Адрес клиента'] || '',
    traffic_source: c['Источник трафика'] || '',
    notes: c.metadata || '',
    is_archived: Boolean(c.is_archived),
    data: { ...c }, // Store complete CRM object in JSONB so no data is ever lost
    updated_at: new Date().toISOString(),
  };
}

/**
 * Helper: format storage order row
 */
function mapClientToOrderRow(c: Partial<Client>) {
  if (!c['Договор'] && !c.id) return null;
  return {
    id: `ord_${c['Договор'] || c.id}`,
    client_id: String(c.id),
    contract: c['Договор'] || `DOG-${c.id}`,
    qr_code: c['Заказ - QR'] || '',
    start_date: c['Начало'] || null,
    duration_months: Number(c['Срок']) || 6,
    reminder_date: c['Напомнить'] || null,
    expiry_date: c['Окончание'] || null,
    warehouse: c['Склад хранения'] || 'Основной',
    cell: c['Ячейка'] || '',
    price_per_month: parseCurrency(c['Цена за месяц']),
    total_price: parseCurrency(c['Общая сумма']),
    debt: parseCurrency(c['Долг']),
    status: c['Статус сделки'] || 'На складе',
    service_pickup: Boolean(c['Услуга: Вывоз']),
    service_wash: Boolean(c['Услуга: Мойка']),
    service_pack: Boolean(c['Услуга: Упаковка']),
    is_archived: Boolean(c.is_archived),
    photo_urls: Array.isArray(c.photoUrls) ? c.photoUrls : [],
    metadata: {
      brandModel: c['Бренд_Модель'] || '',
      tireSize: c['Размер шин'] || '',
      season: c['Сезон'] || 'Лето',
      tireCount: Number(c['Кол-во шин']) || 4,
      hasRims: c['Наличие дисков'] || 'Нет',
      dotCode: c['DOT-код'] || '',
    },
    updated_at: new Date().toISOString(),
  };
}

export const supabaseService = {
  /**
   * Fetch all clients and archive directly from Supabase
   */
  async fetchClients(): Promise<{ clients: Client[]; archive: Client[] } | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return { clients: [], archive: [] };

      const active: Client[] = [];
      const archive: Client[] = [];

      data.forEach((row) => {
        const item = mapRowToClient(row);
        if (item.is_archived || row.is_archived) {
          archive.push(item);
        } else {
          active.push(item);
        }
      });

      return { clients: active, archive };
    } catch (e) {
      console.warn('[Supabase] fetchClients failed:', e);
      return null;
    }
  },

  /**
   * Upsert a client and its active order to Supabase
   */
  async upsertClient(c: Partial<Client>): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || !c.id) return false;

    try {
      const clientRow = mapClientToRow(c);
      const { error: clientErr } = await client
        .from('clients')
        .upsert(clientRow, { onConflict: 'id' });

      if (clientErr) throw clientErr;

      // Also upsert order
      const orderRow = mapClientToOrderRow(c);
      if (orderRow) {
        await client
          .from('storage_orders')
          .upsert(orderRow, { onConflict: 'id' })
          .catch(e => console.warn('[Supabase] Order upsert warning:', e));
      }

      return true;
    } catch (e) {
      console.warn('[Supabase] upsertClient error:', e);
      return false;
    }
  },

  /**
   * Delete a client and their orders from Supabase
   */
  async deleteClient(clientId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || !clientId) return false;

    try {
      // First delete associated orders
      await client.from('storage_orders').delete().eq('client_id', clientId);
      // Then delete client
      const { error } = await client.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] deleteClient error:', e);
      return false;
    }
  },

  /**
   * Bulk import all local CRM data into Supabase
   */
  async importLocalData(overrideUrl?: string, overrideKey?: string): Promise<{ success: boolean; count: number; message: string }> {
    if (overrideUrl && overrideKey) {
      saveSupabaseConfig(overrideUrl, overrideKey);
    }

    const client = getSupabaseClient(overrideUrl, overrideKey);
    if (!client) {
      return { success: false, count: 0, message: 'Supabase не настроен. Укажите Project URL и API Key в настройках.' };
    }

    let active = LocalCRMStorage.getClients();
    let archive = LocalCRMStorage.getArchive();

    // Fallback if local storage was somehow cleared
    if (!active || active.length === 0) {
      try {
        active = await offlineStorage.getClients();
        archive = await offlineStorage.getArchive();
      } catch {}
    }

    const all = [...active.map(c => ({ ...c, is_archived: false })), ...archive.map(c => ({ ...c, is_archived: true }))];

    if (all.length === 0) {
      return { success: true, count: 0, message: 'Локальная база пуста. Нечего переносить.' };
    }

    try {
      const rows = all.map(mapClientToRow);
      const orders = all.map(mapClientToOrderRow).filter(Boolean);

      // Insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await client.from('clients').upsert(chunk, { onConflict: 'id' });
        if (error) throw error;
      }

      for (let i = 0; i < orders.length; i += chunkSize) {
        const chunk = orders.slice(i, i + chunkSize);
        await client.from('storage_orders').upsert(chunk, { onConflict: 'id' }).catch(() => {});
      }

      // Also ensure offline IndexedDB cache is hot
      await offlineStorage.cacheClients(active, archive).catch(() => {});

      return {
        success: true,
        count: all.length,
        message: `Успешно перенесено ${all.length} договоров (активных: ${active.length}, архивных: ${archive.length}) в облако Supabase!`,
      };
    } catch (err: any) {
      console.error('[Supabase] importLocalData failed:', err);
      return {
        success: false,
        count: 0,
        message: `Ошибка импорта в Supabase: ${err?.message || err}. Проверьте, созданы ли таблицы clients и storage_orders через SQL Editor.`,
      };
    }
  },
};
