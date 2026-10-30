import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from './Card';
import { Client } from '../../types';
import { PaperAirplaneIcon, ExclamationTriangleIcon } from '../icons/Icons';

interface DebtorsListProps {
  debtors: Client[];
  onRemind: (client: Client) => void;
  dragHandle?: React.ReactNode;
}

export const DebtorsList: React.FC<DebtorsListProps> = ({ debtors, onRemind, dragHandle }) => {
  const totalDebtSum = debtors.reduce((acc, c) => acc + (Number(c['Долг']) || 0), 0);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);

  return (
    <Card 
      title={
        <div className="flex items-center justify-between w-full pr-2">
          <span className="flex items-center gap-2">
            <span>Должники</span>
            {debtors.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                {debtors.length}
              </span>
            )}
          </span>
          {debtors.length > 0 && (
            <span className="text-xs font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalDebtSum)}
            </span>
          )}
        </div>
      } 
      actions={dragHandle} 
      className="h-full flex flex-col"
    >
      <div className="flex-grow overflow-y-auto space-y-2.5 pr-1 -mr-1 max-h-[460px]">
        {debtors.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-200 dark:border-emerald-800">
              ✓
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Задолженностей нет!
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Все клиенты оплатили хранение в полном объёме.
            </p>
          </div>
        ) : (
          debtors.map(client => (
            <div 
              key={client.id} 
              className="p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/50 rounded-xl flex items-center justify-between gap-3 hover:border-red-300 dark:hover:border-red-800 transition-all"
            >
              <div className="min-w-0 flex-1">
                <Link 
                  to={`/clients/${client.id}`}
                  className="font-bold text-sm text-gray-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 transition-colors truncate block"
                  title="Открыть карточку для приёма оплаты"
                >
                  {client['Имя клиента']}
                </Link>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <span className="font-mono">{client['Номер Авто'] || '—'}</span>
                  <span>·</span>
                  <span className="font-mono text-[11px]">№{client['Договор']}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black text-red-600 dark:text-red-400">
                  {formatCurrency(Number(client['Долг']) || 0)}
                </p>
                <button
                  type="button"
                  onClick={() => onRemind(client)}
                  className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300 bg-white dark:bg-red-900/30 rounded-lg shadow-2xs hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 transition-all active:scale-95"
                  title="Отправить уведомление о задолженности в Telegram"
                >
                  <PaperAirplaneIcon className="h-3 w-3" />
                  <span>Напомнить</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};