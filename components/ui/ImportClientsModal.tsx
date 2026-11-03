import React, { useState, useMemo } from 'react';
import { Client, parseCurrency, parseDuration } from '../../types';
import { api } from '../../services/api';
import { Modal } from './Modal';
import { Button } from './Button';
import { 
  ArrowUpTrayIcon, 
  CheckIcon, 
  XMarkIcon, 
  TireIcon, 
  CalendarDaysIcon,
  PhoneIcon
} from '../icons/Icons';

interface ImportClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number, message: string) => void;
}

// Available CRM fields for mapping
const TARGET_FIELDS: { key: keyof Client; label: string; prioritySynonyms: string[] }[] = [
  { key: 'Имя клиента', label: 'Имя / ФИО клиента', prioritySynonyms: ['клиент', 'фио', 'имя', 'fio', 'name', 'client', 'ф.и.о.', 'заказчик'] },
  { key: 'Телефон', label: 'Телефон', prioritySynonyms: ['телефон', 'тел', 'phone', 'tel', 'номер телефона', 'мобильный', 'контакт'] },
  { key: 'Номер Авто', label: 'Госномер авто', prioritySynonyms: ['авто', 'госномер', 'номер авто', 'машина', 'гос. номер', 'автомобиль', 'car', 'plate', 'номер машины'] },
  { key: 'Бренд_Модель', label: 'Марка и модель шин', prioritySynonyms: ['бренд_модель', 'марка', 'модель', 'бренд', 'шины', 'колеса', 'резина', 'brand', 'model', 'марка/модель', 'марка и модель'] },
  { key: 'Размер шин', label: 'Размер шин', prioritySynonyms: ['размер шин', 'размер', 'типоразмер', 'size', 'r', 'радиус', 'параметры шин'] },
  { key: 'Сезон', label: 'Сезон (Лето / Зима)', prioritySynonyms: ['сезон', 'сезонность', 'season', 'зима/лето', 'лето/зима'] },
  { key: 'Наличие дисков', label: 'Диски (Да / Нет)', prioritySynonyms: ['наличие дисков', 'диски', 'с дисками', 'диски (да/нет)', 'rims', 'wheels', 'диск'] },
  { key: 'DOT-код', label: 'DOT-код (год шин)', prioritySynonyms: ['dot-код', 'dot', 'дот', 'год', 'год выпуска', 'dot код', 'дата выпуска'] },
  { key: 'Склад хранения', label: 'Склад хранения', prioritySynonyms: ['склад хранения', 'склад', 'филиал', 'локация', 'warehouse', 'база'] },
  { key: 'Ячейка', label: 'Ячейка / Место', prioritySynonyms: ['ячейка', 'место', 'полка', 'стеллаж', 'cell', 'ряд', 'ячейка хранения'] },
  { key: 'Начало', label: 'Дата приёма (Начало)', prioritySynonyms: ['начало', 'дата', 'дата приёма', 'дата приема', 'дата сдачи', 'start', 'date', 'принят', 'от'] },
  { key: 'Срок', label: 'Срок (месяцев)', prioritySynonyms: ['срок', 'месяцев', 'срок хранения', 'duration', 'мес', 'период'] },
  { key: 'Окончание', label: 'Дата окончания', prioritySynonyms: ['окончание', 'до', 'дата окончания', 'срок до', 'конец', 'end', 'выдача'] },
  { key: 'Общая сумма', label: 'Общая сумма (₽)', prioritySynonyms: ['общая сумма', 'сумма', 'цена', 'стоимость', 'итого', 'total', 'price', 'сумма заказа', 'всего'] },
  { key: 'Долг', label: 'Остаток долга (₽)', prioritySynonyms: ['долг', 'остаток', 'задолженность', 'debt', 'не оплачено', 'к доплате'] },
  { key: 'Договор', label: 'Номер договора / Акта', prioritySynonyms: ['договор', 'номер договора', 'акт', '№', 'номер заказа', 'order', 'contract', 'id заказа'] },
  { key: 'Адрес клиента', label: 'Адрес клиента', prioritySynonyms: ['адрес клиента', 'адрес', 'город', 'место проживания', 'address'] },
  { key: 'Статус сделки', label: 'Статус сделки', prioritySynonyms: ['статус сделки', 'статус', 'состояние', 'status'] },
  { key: 'Chat ID', label: 'Telegram Chat ID', prioritySynonyms: ['chat id', 'telegram', 'чат id', 'телеграм'] },
];

// Heuristic column match
const detectTargetField = (rawHeader: string): keyof Client | '' => {
  const clean = rawHeader.toLowerCase().trim().replace(/[\s_\-.]+/g, ' ');
  for (const field of TARGET_FIELDS) {
    if (field.prioritySynonyms.some(syn => clean === syn || clean.startsWith(syn) || clean.includes(syn))) {
      return field.key;
    }
  }
  return '';
};

// Parse pasted or file content (supports TSV from Google Sheets copy-paste, semicolon CSV, comma CSV)
const parseTableText = (text: string): { headers: string[]; rows: string[][] } => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter: tab (\t), semicolon (;), comma (,)
  const firstLine = lines[0];
  let delimiter = '\t';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  if (tabCount >= 1) {
    delimiter = '\t';
  } else if (semiCount >= commaCount && semiCount > 0) {
    delimiter = ';';
  } else if (commaCount > 0) {
    delimiter = ',';
  }

  // Parse lines with quotes support
  const parseLine = (line: string): string[] => {
    if (delimiter === '\t') {
      return line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
    }
    // CSV with quotes
    const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*)"|([^${delimiter}]*))`, 'g');
    const row: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      row.push((match[1] !== undefined ? match[1] : match[2] || '').trim());
    }
    return row;
  };

  const rawHeaders = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter(r => r.some(c => c.length > 0));

  return { headers: rawHeaders, rows };
};

// Normalize dates like DD.MM.YYYY or DD/MM/YYYY to YYYY-MM-DD
const normalizeDateStr = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
  const dmyMatch = trimmed.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
};

export const ImportClientsModal: React.FC<ImportClientsModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'input' | 'mapping' | 'importing'>('input');
  const [inputTab, setInputTab] = useState<'paste' | 'file' | 'googleGuide'>('paste');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  
  // Parsed structure
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  
  // Column mappings: { [sourceColIndex: number]: keyof Client | '' }
  const [columnMapping, setColumnMapping] = useState<Record<number, keyof Client | ''>>({});

  // Destination and options
  const [targetDestination, setTargetDestination] = useState<'archive' | 'active' | 'auto'>('auto');
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [defaultWarehouse, setDefaultWarehouse] = useState('Основной');

  // Error/Status
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  // Reset on open/close
  const handleClose = () => {
    setStep('input');
    setRawText('');
    setFileName('');
    setParsedHeaders([]);
    setParsedRows([]);
    setColumnMapping({});
    setErrorMsg('');
    setProgressMsg('');
    onClose();
  };

  // Process raw text and go to mapping step
  const handleParseAndContinue = (textToParse: string) => {
    setErrorMsg('');
    const { headers, rows } = parseTableText(textToParse);
    if (headers.length === 0 || rows.length === 0) {
      setErrorMsg('Не удалось распознать строки таблицы. Убедитесь, что вставили данные с заголовками колонок.');
      return;
    }

    setParsedHeaders(headers);
    setParsedRows(rows);

    // Auto-detect mappings
    const mapping: Record<number, keyof Client | ''> = {};
    const usedTargets = new Set<string>();

    headers.forEach((h, idx) => {
      const detected = detectTargetField(h);
      if (detected && !usedTargets.has(String(detected))) {
        mapping[idx] = detected;
        usedTargets.add(String(detected));
      } else {
        mapping[idx] = '';
      }
    });

    setColumnMapping(mapping);
    setStep('mapping');
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      handleParseAndContinue(content);
    };
    reader.onerror = () => {
      setErrorMsg('Ошибка чтения файла.');
    };
    reader.readAsText(file, 'utf-8');
  };

  // Preview generated client objects
  const previewClients = useMemo(() => {
    const sampleRows = parsedRows.slice(0, 5);
    return sampleRows.map((row, rowIdx) => {
      const clientObj: Partial<Client> = {
        id: `preview_${rowIdx}`,
        'Склад хранения': defaultWarehouse,
        'Сезон': 'Зима',
        'Наличие дисков': 'Нет',
        'Кол-во шин': 4,
        'Статус сделки': 'В работе'
      };

      row.forEach((cellVal, colIdx) => {
        const targetField = columnMapping[colIdx];
        if (!targetField) return;

        const val = cellVal.trim();
        if (targetField === 'Общая сумма' || targetField === 'Долг' || targetField === 'Цена за месяц') {
          clientObj[targetField] = parseCurrency(val);
        } else if (targetField === 'Срок' || targetField === 'Кол-во шин') {
          clientObj[targetField] = parseDuration(val);
        } else if (targetField === 'Начало' || targetField === 'Окончание' || targetField === 'Напомнить') {
          clientObj[targetField] = normalizeDateStr(val);
        } else if (targetField === 'Сезон') {
          clientObj['Сезон'] = /зима|winter|шип/i.test(val) ? 'Зима' : 'Лето';
        } else if (targetField === 'Наличие дисков') {
          clientObj['Наличие дисков'] = /да|yes|\+|\bс\s*диск/i.test(val) ? 'Да' : 'Нет';
        } else {
          // General string assignment
          (clientObj as any)[targetField] = val;
        }
      });

      return clientObj;
    });
  }, [parsedRows, columnMapping, defaultWarehouse]);

  // Execute import
  const handleExecuteImport = async () => {
    setStep('importing');
    setProgressMsg('Формирование карточек клиентов и заказов...');

    try {
      const activeClients: Partial<Client>[] = [];
      const archiveClients: Partial<Client>[] = [];

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      parsedRows.forEach((row, idx) => {
        const clientObj: Partial<Client> = {
          id: `imp_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
          'Склад хранения': defaultWarehouse,
          'Сезон': 'Зима',
          'Наличие дисков': 'Нет',
          'Кол-во шин': 4,
          'Статус сделки': 'В работе',
          'Дата добавления': todayStr
        };

        row.forEach((cellVal, colIdx) => {
          const targetField = columnMapping[colIdx];
          if (!targetField) return;

          const val = cellVal.trim();
          if (targetField === 'Общая сумма' || targetField === 'Долг' || targetField === 'Цена за месяц') {
            clientObj[targetField] = parseCurrency(val);
          } else if (targetField === 'Срок' || targetField === 'Кол-во шин') {
            clientObj[targetField] = parseDuration(val);
          } else if (targetField === 'Начало' || targetField === 'Окончание' || targetField === 'Напомнить') {
            clientObj[targetField] = normalizeDateStr(val);
          } else if (targetField === 'Сезон') {
            clientObj['Сезон'] = /зима|winter|шип/i.test(val) ? 'Зима' : 'Лето';
          } else if (targetField === 'Наличие дисков') {
            clientObj['Наличие дисков'] = /да|yes|\+|\bс\s*диск/i.test(val) ? 'Да' : 'Нет';
          } else {
            (clientObj as any)[targetField] = val;
          }
        });

        // Autogenerate contract number if missing
        if (!clientObj['Договор']) {
          const cleanCar = (clientObj['Номер Авто'] || '').replace(/\s+/g, '');
          clientObj['Договор'] = cleanCar ? `IMP-${cleanCar}` : `IMP-${idx + 1}`;
        }

        // Determine destination: archive vs active
        let isArchive = false;
        if (targetDestination === 'archive') {
          isArchive = true;
        } else if (targetDestination === 'active') {
          isArchive = false;
        } else {
          // Auto mode: check endDate or status
          const endDate = clientObj['Окончание'] || '';
          const status = clientObj['Статус сделки'] || '';
          if (/завершен|выдан|архив|закрыт/i.test(status)) {
            isArchive = true;
          } else if (endDate && endDate < todayStr) {
            isArchive = true;
          } else {
            isArchive = false;
          }
        }

        if (isArchive) {
          archiveClients.push({
            ...clientObj,
            is_archived: true,
            'Статус сделки': clientObj['Статус сделки'] || 'Завершено'
          });
        } else {
          activeClients.push(clientObj);
        }
      });

      setProgressMsg(`Сохранение данных (активных: ${activeClients.length}, в архиве: ${archiveClients.length})...`);

      // Send to API
      await api.importClientsBatch(activeClients, archiveClients, mergeMode);

      onSuccess(
        activeClients.length + archiveClients.length,
        `Импорт успешно завершён: ${activeClients.length} активных клиентов и ${archiveClients.length} заказов в архиве!`
      );
      handleClose();

    } catch (err: any) {
      console.error('Import execution error:', err);
      setErrorMsg(`Ошибка импорта: ${err.message || 'Сбой записи в базу данных'}`);
      setStep('mapping');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
            <ArrowUpTrayIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
              Импорт из Google Таблиц / Excel / CSV
            </span>
            <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
              Быстрое объединение клиентов и старых заказов в единую базу
            </span>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          {step === 'mapping' ? (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                Назад к данным
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Отмена
                </Button>
                <Button variant="primary" onClick={handleExecuteImport} className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4" />
                  <span>Импортировать ({parsedRows.length} записей)</span>
                </Button>
              </div>
            </>
          ) : step === 'input' ? (
            <>
              <div className="text-xs text-gray-400">
                Поддерживаются любые Google Таблицы и файлы .csv
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Отмена
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleParseAndContinue(rawText)}
                  disabled={!rawText.trim()}
                  className="flex items-center gap-2"
                >
                  <span>Далее: Сопоставить колонки</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full text-center text-sm font-semibold text-emerald-600 animate-pulse">
              {progressMsg || 'Импортируем данные...'}
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <span className="text-sm font-bold">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* --- STEP 1: INPUT --- */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Input Navigation Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setInputTab('paste')}
                className={`pb-2 border-b-2 transition-colors ${
                  inputTab === 'paste'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                📋 Вставить строки из Google Таблицы (Ctrl+C / Ctrl+V)
              </button>
              <button
                type="button"
                onClick={() => setInputTab('file')}
                className={`pb-2 border-b-2 transition-colors ${
                  inputTab === 'file'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                📁 Загрузить файл (.csv / .tsv / .txt)
              </button>
              <button
                type="button"
                onClick={() => setInputTab('googleGuide')}
                className={`pb-2 border-b-2 transition-colors ${
                  inputTab === 'googleGuide'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                💡 Как скопировать из Google
              </button>
            </div>

            {inputTab === 'paste' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Выделите ячейки в вашей Google Таблице с первой строкой-заголовком, нажмите <b>Ctrl+C</b> и вставьте сюда:</span>
                  {rawText && (
                    <button
                      type="button"
                      onClick={() => setRawText('')}
                      className="text-red-500 hover:underline"
                    >
                      Очистить
                    </button>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`ФИО\tТелефон\tАвто\tРазмер\tБренд\tСезон\tСрок\nИванов Иван\t+79991234567\tА123АА77\t205/55 R16\tMichelin\tЗима\t6\nПетров Петр\t+79007654321\tВ777ВВ199\t225/45 R17\tNokian\tЛето\t6`}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 font-mono text-xs leading-relaxed text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-400">
                  💡 При копировании из Google Таблиц разделители колонок определяются автоматически.
                </p>
              </div>
            )}

            {inputTab === 'file' && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-gray-50 dark:bg-gray-800/50 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    id="import-file-input"
                    className="hidden"
                  />
                  <label htmlFor="import-file-input" className="cursor-pointer space-y-2 block">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <ArrowUpTrayIcon className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {fileName ? `Выбран файл: ${fileName}` : 'Нажмите для выбора файла или перетащите его сюда'}
                    </div>
                    <div className="text-xs text-gray-400">
                      Поддерживаются файлы CSV и TSV с разделителями «;», «,» или табуляция
                    </div>
                  </label>
                </div>
              </div>
            )}

            {inputTab === 'googleGuide' && (
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-3 text-xs text-blue-900 dark:text-blue-200">
                <h4 className="font-bold text-sm">3 простых способа перенести данные из Google Таблицы:</h4>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    <b>Быстрее всего (Копировать-Вставить):</b> Откройте вашу Google Таблицу, выделите диапазон нужных строк вместе с шапкой (заголовками) и нажмите <b>Ctrl + C</b>. Затем откройте вкладку <i>«Вставить строки»</i> выше и нажмите <b>Ctrl + V</b>.
                  </li>
                  <li>
                    <b>Через файл:</b> В Google Таблице выберите <i>Файл ➔ Скачать ➔ CSV-файл (.csv)</i> и загрузите полученный файл на вкладке <i>«Загрузить файл»</i>.
                  </li>
                  <li>
                    <b>Постоянное живое подключение:</b> Если вы хотите, чтобы сайт читал и писал прямо в вашу Google Таблицу онлайн, откройте в верхнем меню <b>«Опции» ➔ «Настройка GAS»</b>. Встроенный скрипт подключается к таблице в 1 клик.
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* --- STEP 2: MAPPING & DESTINATION --- */}
        {step === 'mapping' && (
          <div className="space-y-4">
            {/* Destination Options */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-3">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                ⚙️ Куда сохранять импортируемые записи:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className={`flex flex-col p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${
                  targetDestination === 'auto'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <input
                      type="radio"
                      name="targetDestination"
                      checked={targetDestination === 'auto'}
                      onChange={() => setTargetDestination('auto')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Умное распределение</span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                    Завершённые и истёкшие заказы ➔ в архив. Действующие ➔ на склад.
                  </span>
                </label>

                <label className={`flex flex-col p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${
                  targetDestination === 'archive'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <input
                      type="radio"
                      name="targetDestination"
                      checked={targetDestination === 'archive'}
                      onChange={() => setTargetDestination('archive')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Все в Архив (Прошлые)</span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                    Сохранятся как история клиентов для быстрой смены сезона.
                  </span>
                </label>

                <label className={`flex flex-col p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${
                  targetDestination === 'active'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <input
                      type="radio"
                      name="targetDestination"
                      checked={targetDestination === 'active'}
                      onChange={() => setTargetDestination('active')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Все на Склад (Активные)</span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                    Комплекты сейчас хранятся у нас на складе.
                  </span>
                </label>
              </div>

              {/* Merge or append */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-700 text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  Совпадения по номеру телефона / авто / договору:
                </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Объединять с существующими (без создания дублей)
                </span>
              </div>
            </div>

            {/* Column Mapping Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Сопоставление колонок вашей таблицы:
                </span>
                <span className="text-[11px] text-gray-400">
                  Распознано колонок: {parsedHeaders.length} • Строк данных: {parsedRows.length}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {parsedHeaders.map((headerName, idx) => {
                  const currentMapped = columnMapping[idx] || '';
                  const sampleVal = parsedRows[0]?.[idx] || '';

                  return (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white truncate">
                            {headerName || `Колонка ${idx + 1}`}
                          </span>
                          {sampleVal && (
                            <span className="text-[10px] text-gray-400 truncate max-w-[200px]" title={sampleVal}>
                              Пример: &quot;{sampleVal}&quot;
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-400">➔</span>
                        <select
                          value={currentMapped}
                          onChange={(e) => {
                            const val = e.target.value as keyof Client | '';
                            setColumnMapping(prev => ({ ...prev, [idx]: val }));
                          }}
                          className={`rounded-lg border text-xs py-1 px-2 font-medium ${
                            currentMapped
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500'
                          }`}
                        >
                          <option value="">(Не импортировать)</option>
                          {TARGET_FIELDS.map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Data Preview */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                Предпросмотр первых записей:
              </span>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-[11px]">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-semibold">#</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Клиент</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Телефон</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Авто</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Шины / Размер</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Срок / Начало</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {previewClients.map((client, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-2.5 py-1.5 text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-2.5 py-1.5 font-bold text-gray-900 dark:text-white">
                          {client['Имя клиента'] || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono text-gray-600 dark:text-gray-300">
                          {client['Телефон'] || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono font-bold text-gray-800 dark:text-gray-200">
                          {client['Номер Авто'] || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-2.5 py-1.5 text-gray-700 dark:text-gray-300">
                          {client['Бренд_Модель'] || ''} {client['Размер шин'] || ''}
                        </td>
                        <td className="px-2.5 py-1.5 text-gray-600 dark:text-gray-400">
                          {client['Начало'] || '—'} ({client['Срок'] || 6} мес.)
                        </td>
                        <td className="px-2.5 py-1.5 font-semibold text-gray-900 dark:text-white">
                          {client['Общая сумма'] ? `${client['Общая сумма']} ₽` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- STEP 3: IMPORTING PROGRESS --- */}
        {step === 'importing' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-spin">
              <ArrowUpTrayIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Выполняется импорт базы...
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {progressMsg}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
