
export interface Client {
  id: string;
  'Дата добавления'?: string;
  'Chat ID': string | number;
  'Имя клиента': string;
  'Телефон': string;
  'Номер Авто': string;
  'Заказ - QR': string;
  'Бренд_Модель'?: string;
  'DOT-код'?: string;
  'Размер шин'?: string;
  'Сезон'?: 'Лето' | 'Зима';
  'Цена за месяц': number;
  'Кол-во шин': number;
  'Наличие дисков': 'Да' | 'Нет';
  'Начало': string; // date
  'Срок': number; // months
  'Напомнить':string; // date
  'Окончание': string; // date
  'Склад хранения': string;
  'Ячейка': string;
  'Общая сумма': number;
  'Долг': number;
  'Договор': string;
  'Адрес клиента': string;
  'Статус сделки': string;
  'Источник трафика': string;
  'Услуга: Вывоз'?: boolean;
  'Услуга: Мойка'?: boolean;
  'Услуга: Упаковка'?: boolean;
  photoUrls?: string[];
  [key:string]: any;
}

export interface Settings {
  adminIds: string;
  managerIds:string;
  googleSheetId: string;
  sheetName: string;
}

export interface MessageTemplate {
 'Название шаблона': string;
 'Содержимое (HTML)': string;
}

export interface Master {
  id: string;
  'Имя': string;
  'chatId (Telegram)': string;
  'Услуга'?: string;
  'Телефон'?: string;
}

export enum UserRole {
  Admin = 'Admin',
  Manager = 'Manager'
}

export interface User {
  username: string;
  role: UserRole;
}

export interface ClientEvent {
    id: string;
    clientId: string;
    timestamp: string; // ISO 8601 string
    user: string;
    action: string;
    details: string | null;
}

export interface AppLog {
    timestamp: string;
    level: 'ERROR' | 'INFO';
    user: string;
    action: string;
    message: string;
    details: string;
}

export interface SavedView {
    id: string;
    name: string;
    filters: {
        status: string;
        warehouse: string;
        debt: boolean;
    };
    sortConfig: {
        key: string;
        direction: 'ascending' | 'descending';
    } | null;
}

export const parseCurrency = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  // Remove currency symbol, spaces, and use dot as a decimal separator
  const cleanedString = value.replace(/[^0-9,.]/g, '').replace(',', '.');
  const number = parseFloat(cleanedString);
  return isNaN(number) ? 0 : number;
};

export const parseDuration = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    const cleanedString = value.replace(/[^0-9,.]/g, '').replace(',', '.');
    const number = parseInt(cleanedString, 10);
    return isNaN(number) ? 0 : number;
}


export const parseDate = (dateString: string | undefined | null): Date | null => {
  if (!dateString || typeof dateString !== 'string') return null;

  // Priority 1: ISO 8601 format (e.g., "2024-05-21T10:00:00.000Z")
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateString)) {
      const d = new Date(dateString);
      if (!isNaN(d.getTime())) return d;
  }

  // Priority 2: Russian format DD.MM.YYYY
  const ruParts = dateString.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (ruParts) {
      const d = new Date(Date.UTC(parseInt(ruParts[3], 10), parseInt(ruParts[2], 10) - 1, parseInt(ruParts[1], 10)));
      if (!isNaN(d.getTime())) return d;
  }

  // Priority 3: YYYY-MM-DD format (without time)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const parts = dateString.split('-').map(p => parseInt(p, 10));
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (!isNaN(d.getTime())) return d;
  }
  
  // Fallback for any other format that JS `new Date()` can understand.
  const genericDate = new Date(dateString);
  if (!isNaN(genericDate.getTime())) {
      return genericDate;
  }

  return null;
};

export const formatDateForDisplay = (dateString: string | undefined | null): string => {
  if (!dateString) return '-';
  
  // Attempt to parse the date string. This is robust and handles full ISO strings (like ...T...Z), YYYY-MM-DD etc.
  const date = new Date(dateString);
  
  // Check if the parsed date is valid
  if (!isNaN(date.getTime())) {
    // If it's a valid date, format it to DD.MM.YYYY
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}.${month}.${year}`;
  }

  // If new Date() failed, it might be in DD.MM.YYYY format which JS sometimes misinterprets.
  // Check for this format specifically.
  const ruMatch = dateString.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (ruMatch) {
    return ruMatch[0]; // It's already in the correct format, return as is.
  }

  // Fallback: return the original string if all parsing fails.
  return dateString;
};