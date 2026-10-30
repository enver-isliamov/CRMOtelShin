import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from './Card';
import { Client, parseDate } from '../../types';

// --- CANONICAL ICONS ---
import { PaperAirplaneIcon, CalendarDaysIcon } from '../icons/Icons';
const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 w-4"} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

interface ExpiringClientsListProps {
  clients: Client[];
  onRemind: (client: Client) => void;
  dragHandle?: React.ReactNode;
}

export const ExpiringClientsList: React.FC<ExpiringClientsListProps> = ({ clients, onRemind, dragHandle }) => {
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  const expiringClients = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);

    return clients
      .map(client => {
        const endDate = parseDate(client['Окончание']);
        const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return { ...client, endDate, daysLeft };
      })
      .filter((client): client is Client & { endDate: Date; daysLeft: number } => 
        !!client.endDate && client.endDate >= now && client.endDate <= thirtyDaysFromNow
      )
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  }, [clients]);
  
  const createCalendarLink = (client: Client, isMeeting: boolean) => {
    const title = isMeeting
      ? `Выдача шин: ${client['Имя клиента']} (${client['Номер Авто']})`
      : `Окончание хранения: ${client['Имя клиента']}`;
    
    const endDateObj = parseDate(client['Окончание']);
    if (!endDateObj) {
      alert("Некорректная дата окончания для создания события.");
      return '#';
    }
    
    const calendarDate = endDateObj.toISOString().split('T')[0].replace(/-/g, '');
    const dates = isMeeting 
      ? `${calendarDate}T150000/${calendarDate}T160000`
      : `${calendarDate}/${calendarDate}`;

    const details = `Клиент: ${client['Имя клиента']}\nТелефон: ${client['Телефон']}\nАвто: ${client['Номер Авто']}\nДоговор: ${client['Договор']}\nЗаказ: ${client['Заказ - QR']}\n\nСгенерировано CRM.`;
    const location = client['Адрес клиента'] || '';
    
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${encodeURIComponent(dates)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  };

  const ActionButton: React.FC<{onClick: () => void, children: React.ReactNode, title?: string}> = ({ onClick, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-lg shadow-2xs hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all active:scale-95"
    >
      {children}
    </button>
  );

  return (
    <Card 
      title={
        <span className="flex items-center gap-2">
          <span>Окончание хранения (30 дн.)</span>
          {expiringClients.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
              {expiringClients.length}
            </span>
          )}
        </span>
      } 
      actions={dragHandle} 
      className="h-full flex flex-col"
    >
      <div className="flex-grow overflow-y-auto space-y-2.5 pr-1 -mr-1 max-h-[460px]">
        {expiringClients.length === 0 ? (
          <div className="text-center py-10 px-4">
            <CalendarDaysIcon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Нет клиентов с окончанием хранения в ближайшие 30 дней.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Все договоры в актуальном сроке.
            </p>
          </div>
        ) : (
          expiringClients.map(client => {
            const isUrgent = client.daysLeft <= 7;
            const daysText = client.daysLeft === 0 
              ? 'Сегодня!' 
              : client.daysLeft === 1 
                ? 'Завтра' 
                : `${client.daysLeft} дн.`;

            return (
              <div 
                key={client.id} 
                className={`p-3 rounded-xl border transition-all ${
                  isUrgent 
                    ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50' 
                    : 'bg-gray-50/80 border-gray-200/80 dark:bg-gray-800/40 dark:border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Link 
                      to={`/clients/${client.id}`}
                      className="font-bold text-sm text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate block"
                      title="Открыть карточку клиента"
                    >
                      {client['Имя клиента']}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span className="font-mono">{client['Номер Авто'] || '—'}</span>
                      {client['Склад хранения'] && (
                        <>
                          <span>·</span>
                          <span>{client['Склад хранения']}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        isUrgent
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {daysText}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      до {client.endDate?.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                  <ActionButton onClick={() => onRemind(client)} title="Отправить шаблон напоминания в Telegram">
                    <PaperAirplaneIcon className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                    <span>Напомнить</span>
                  </ActionButton>

                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setMenuOpenFor(menuOpenFor === client.id ? null : client.id)}
                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-lg shadow-2xs hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all active:scale-95"
                    >
                      <CalendarDaysIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>В календарь</span>
                      <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-400 transition-transform ${menuOpenFor === client.id ? 'rotate-180' : ''}`}/>
                    </button>
                    {menuOpenFor === client.id && (
                      <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 p-1 text-xs">
                        <a 
                          href={createCalendarLink(client, false)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="block text-left w-full px-2.5 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                        >
                          📅 Напоминание
                        </a>
                        <a 
                          href={createCalendarLink(client, true)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="block text-left w-full px-2.5 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                        >
                          🚗 Встреча для выдачи
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};