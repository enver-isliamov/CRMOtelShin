import { Client } from '../types';

export interface ExportCsvOptions {
  delimiter?: ';' | ',';
  headers?: string[];
  includeDetailedTires?: boolean;
  includePaymentHistory?: boolean;
  filename?: string;
}

export interface ExportResult {
  rowCount: number;
  filename: string;
  sizeBytes: number;
}

// Default standard column headers for the CRM
export const DEFAULT_CRM_COLUMNS: string[] = [
  'id',
  'Дата добавления',
  'Имя клиента',
  'Телефон',
  'Номер Авто',
  'Статус сделки',
  'Бренд_Модель',
  'Размер шин',
  'Сезон',
  'Кол-во шин',
  'Наличие дисков',
  'DOT-код',
  'Склад хранения',
  'Ячейка',
  'Начало',
  'Срок',
  'Окончание',
  'Напомнить',
  'Цена за месяц',
  'Общая сумма',
  'Долг',
  'Договор',
  'Адрес клиента',
  'Источник трафика',
  'Услуга: Вывоз',
  'Услуга: Мойка',
  'Услуга: Упаковка',
  'Chat ID',
  'Заказ - QR'
];

/**
 * Format a single CSV cell with proper escaping according to RFC 4180
 */
export function formatCsvCell(value: any, delimiter: string = ';'): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }

  let str: string;
  if (Array.isArray(value)) {
    str = value.join(', ');
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  // Double up existing quotes
  const escaped = str.replace(/"/g, '""');

  // Wrap in quotes if cell contains delimiter, quote, or newline
  const needsQuotes =
    escaped.includes(delimiter) ||
    escaped.includes('"') ||
    escaped.includes('\n') ||
    escaped.includes('\r');

  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * Generates the CSV string from Client records
 */
export function generateClientsCSV(
  clients: Client[],
  options: ExportCsvOptions = {}
): string {
  const delimiter = options.delimiter || ';';
  const customHeaders = options.headers && options.headers.length > 0 ? options.headers : DEFAULT_CRM_COLUMNS;

  // Compile final ordered header list
  const headersSet = new Set<string>();

  // 1. Add standard / given headers first
  customHeaders.forEach(h => {
    if (h && h !== 'photoUrls' && h !== 'metadata') {
      headersSet.add(h);
    }
  });

  // 2. Add any other properties found across client objects
  clients.forEach(client => {
    Object.keys(client).forEach(key => {
      if (key !== 'photoUrls' && key !== 'metadata' && !headersSet.has(key)) {
        headersSet.add(key);
      }
    });
  });

  // 3. Optional enriched columns for backup fidelity
  if (options.includeDetailedTires) {
    headersSet.add('Детали комплектов шин');
  }
  if (options.includePaymentHistory) {
    headersSet.add('История оплат');
    headersSet.add('Всего оплачено');
  }

  const columns = Array.from(headersSet);
  const lines: string[] = [];

  // Write header row
  lines.push(columns.map(col => formatCsvCell(col, delimiter)).join(delimiter));

  // Write data rows
  for (const client of clients) {
    let parsedMeta: any = null;
    if (client.metadata) {
      try {
        parsedMeta = typeof client.metadata === 'string' ? JSON.parse(client.metadata) : client.metadata;
      } catch (e) {
        // silent parse fallback
      }
    }

    const row = columns.map(col => {
      // Detailed tire packages column
      if (col === 'Детали комплектов шин') {
        if (parsedMeta?.tires && Array.isArray(parsedMeta.tires) && parsedMeta.tires.length > 0) {
          return formatCsvCell(
            parsedMeta.tires.map((t: any, idx: number) => {
              const brandModel = `${t.brand || ''} ${t.model || ''}`.trim();
              const size = t.width ? `${t.width}/${t.profile} R${t.diameter}` : '';
              const count = t.count ? `${t.count} шт.` : '';
              const season = t.season || '';
              const rims = t.hasRims === 'Да' ? 'с дисками' : 'без дисков';
              const dot = t.dot ? `DOT:${t.dot}` : '';
              return `#${idx + 1}: ${[brandModel, size, count, season, rims, dot].filter(Boolean).join(', ')}`;
            }).join(' | '),
            delimiter
          );
        }
        return '';
      }

      // Payment history column
      if (col === 'История оплат') {
        if (parsedMeta?.payments && Array.isArray(parsedMeta.payments) && parsedMeta.payments.length > 0) {
          return formatCsvCell(
            parsedMeta.payments.map((p: any) => {
              const methodLabel = p.method === 'sbp' ? 'СБП' : p.method === 'cash' ? 'Наличные' : p.method === 'card' ? 'Карта' : 'Безнал';
              return `${p.date || ''}: ${p.amount || 0} ₽ (${methodLabel}${p.note ? `, ${p.note}` : ''})`;
            }).join(' | '),
            delimiter
          );
        }
        return '';
      }

      // Total payments sum column
      if (col === 'Всего оплачено') {
        if (parsedMeta?.payments && Array.isArray(parsedMeta.payments) && parsedMeta.payments.length > 0) {
          const totalPaid = parsedMeta.payments.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
          return formatCsvCell(totalPaid, delimiter);
        }
        return formatCsvCell((client['Общая сумма'] || 0) - (client['Долг'] || 0), delimiter);
      }

      // Standard field value
      const val = client[col];
      return formatCsvCell(val, delimiter);
    });

    lines.push(row.join(delimiter));
  }

  // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows/Mac opens Cyrillic text natively without mojibake
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Triggers the browser to download the given CSV text as a file
 */
export function downloadCSVFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Helper to export clients and download with default naming
 */
export function exportClients(
  clients: Client[],
  options: ExportCsvOptions = {}
): ExportResult {
  const dateStr = new Date().toISOString().slice(0, 10);
  const isFiltered = options.filename?.includes('filtered') ?? false;
  const defaultName = isFiltered ? `clients_filtered_${dateStr}.csv` : `clients_backup_${dateStr}.csv`;
  const filename = options.filename || defaultName;

  const csvContent = generateClientsCSV(clients, options);
  downloadCSVFile(csvContent, filename);

  return {
    rowCount: clients.length,
    filename,
    sizeBytes: new Blob([csvContent]).size
  };
}
