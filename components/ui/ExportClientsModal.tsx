import React, { useState } from 'react';
import { Client } from '../../types';
import { Modal } from './Modal';
import { Button } from './Button';
import { ArrowDownTrayIcon, CheckIcon } from '../icons/Icons';
import { exportClients, ExportResult } from '../../utils/exportCsv';

interface ExportClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allClients: Client[];
  filteredClients: Client[];
  headers?: string[];
  isFilteredActive: boolean;
  onSuccess: (result: ExportResult) => void;
}

export const ExportClientsModal: React.FC<ExportClientsModalProps> = ({
  isOpen,
  onClose,
  allClients,
  filteredClients,
  headers = [],
  isFilteredActive,
  onSuccess
}) => {
  const [scope, setScope] = useState<'all' | 'filtered'>(isFilteredActive ? 'filtered' : 'all');
  const [delimiter, setDelimiter] = useState<';' | ','>(';');
  const [includeDetailedTires, setIncludeDetailedTires] = useState(true);
  const [includePaymentHistory, setIncludePaymentHistory] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const selectedCount = scope === 'all' ? allClients.length : filteredClients.length;
  const targetClients = scope === 'all' ? allClients : filteredClients;
  const dateStr = new Date().toISOString().slice(0, 10);
  const targetFilename = scope === 'all' ? `clients_backup_${dateStr}.csv` : `clients_filtered_${dateStr}.csv`;

  const handleExport = () => {
    setIsExporting(true);
    try {
      const result = exportClients(targetClients, {
        delimiter,
        headers,
        includeDetailedTires,
        includePaymentHistory,
        filename: targetFilename
      });
      onSuccess(result);
      onClose();
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
            <ArrowDownTrayIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
              Экспорт клиентов в CSV
            </span>
            <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
              Резервное копирование и выгрузка данных
            </span>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            К выгрузке: <span className="font-semibold text-gray-900 dark:text-white">{selectedCount}</span> записей
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" onClick={onClose} disabled={isExporting} className="w-1/2 sm:w-auto">
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={handleExport}
              disabled={isExporting || selectedCount === 0}
              className="w-1/2 sm:w-auto flex items-center justify-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>{isExporting ? 'Создание...' : `Скачать (${selectedCount})`}</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Scope Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            1. Что экспортировать
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* All clients option */}
            <div
              onClick={() => setScope('all')}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                scope === 'all'
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 text-gray-900 dark:text-white'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Все клиенты</span>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300">
                  {allClients.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Полный бэкап всей клиентской базы CRM
              </p>
            </div>

            {/* Filtered clients option */}
            <div
              onClick={() => setScope('filtered')}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                scope === 'filtered'
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 text-gray-900 dark:text-white'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Текущая выборка</span>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {filteredClients.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isFilteredActive ? 'С учетом активного поиска и фильтров' : 'Совпадает со всеми клиентами'}
              </p>
            </div>
          </div>
        </div>

        {/* Delimiter / Format Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            2. Формат разделителя
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              onClick={() => setDelimiter(';')}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                delimiter === ';'
                  ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20 font-medium'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="delimiter"
                  checked={delimiter === ';'}
                  onChange={() => setDelimiter(';')}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-900 dark:text-white">Точка с запятой (;)</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-5">
                Идеально для MS Excel в РФ (открывает сразу по колонкам)
              </p>
            </div>

            <div
              onClick={() => setDelimiter(',')}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                delimiter === ','
                  ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20 font-medium'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="delimiter"
                  checked={delimiter === ','}
                  onChange={() => setDelimiter(',')}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-900 dark:text-white">Запятая (,)</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-5">
                Для Google Таблиц, Apple Numbers и других сервисов
              </p>
            </div>
          </div>
        </div>

        {/* Enrichment Options */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            3. Дополнительные данные
          </label>
          <div className="space-y-2 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDetailedTires}
                onChange={(e) => setIncludeDetailedTires(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Детализация всех комплектов шин
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Добавляет колонку с подробным списком брендов, моделей, размеров и DOT-кодов каждого комплекта
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                checked={includePaymentHistory}
                onChange={(e) => setIncludePaymentHistory(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  История оплат и итоговые суммы
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Добавляет историю внесенных оплат (СБП, наличные, карта) и сумму фактических платежей
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Information badge */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
          <div className="shrink-0 mt-0.5">
            <CheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-semibold">Кодировка UTF-8 с сигнатурой BOM:</p>
            <p className="mt-0.5 text-blue-700 dark:text-blue-300/80">
              Кириллические имена, адреса и названия отображаются правильно без искажений при открытии в любой версии Excel.
            </p>
            <p className="mt-1 font-mono text-[11px] text-blue-600 dark:text-blue-400">
              Имя файла: {targetFilename}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
