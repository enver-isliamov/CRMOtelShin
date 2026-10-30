import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Client, ClientEvent, formatDateForDisplay } from '../../types';
import { Button } from './Button';

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center py-10">
        <svg className="animate-spin h-7 w-7 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const ArchiveBoxIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3.75h3.75M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
);

const BanknotesIcon: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H2.25m0 0v10.5m0-10.5h16.5m-16.5 0v10.5m16.5-10.5v10.5m0 0a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 16.5V6a2.25 2.25 0 012.25-2.25h15A2.25 2.25 0 0121.75 6v10.5a2.25 2.25 0 01-2.25 2.25zM12 9.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
    </svg>
);

export const OrderHistory: React.FC<{ client: Client }> = ({ client }) => {
  const [orders, setOrders] = useState<Client[]>([]);
  const [historyEvents, setHistoryEvents] = useState<ClientEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;
      setIsLoading(true);
      setError(null);
      try {
        const [archivedOrders, events] = await Promise.all([
          api.fetchArchivedOrders(client.id).catch(() => []),
          api.fetchClientHistory(client.id).catch(() => []),
        ]);
        setOrders(archivedOrders);
        setHistoryEvents(events);
      } catch (e: any) {
        setError("Не удалось загрузить историю.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [client?.id]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-center py-6 text-sm text-red-500 font-medium">{error}</p>;

  const hasAnyData = orders.length > 0 || historyEvents.length > 0;

  if (!hasAnyData) return (
    <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <ArchiveBoxIcon className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" />
        <h3 className="mt-2 text-sm font-bold text-gray-900 dark:text-white">История пуста</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Здесь будет отображаться хроника оплат, изменений договора и завершенные архивные заказы клиента.
        </p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 1. Audit Timeline Events (Payments, Updates, Actions) */}
      {historyEvents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <BanknotesIcon className="w-4 h-4 text-emerald-600" />
              <span>Хронология операций и платежей ({historyEvents.length})</span>
            </h4>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-xs">
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
              {historyEvents.map((evt, idx) => {
                const actionLower = (evt.action || '').toLowerCase();
                const isPayment = actionLower.includes('оплат');
                const isArchived = actionLower.includes('архив') || actionLower.includes('завершен');
                
                return (
                  <div key={evt.id || idx} className="relative group">
                    {/* Bullet marker */}
                    <span className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                      isPayment 
                        ? 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/60' 
                        : isArchived
                          ? 'bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950/60'
                          : 'bg-primary-500 ring-4 ring-primary-100 dark:ring-primary-950/60'
                    }`} />

                    <div className="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <span className={`text-xs font-bold ${
                          isPayment 
                            ? 'text-emerald-700 dark:text-emerald-300' 
                            : isArchived
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-gray-900 dark:text-white'
                        }`}>
                          {evt.action}
                        </span>

                        <span className="text-[11px] font-mono text-gray-400 whitespace-nowrap">
                          {evt.timestamp ? new Date(evt.timestamp).toLocaleString('ru-RU', { 
                            dateStyle: 'short', 
                            timeStyle: 'short' 
                          }) : '—'}
                        </span>
                      </div>

                      {evt.details && (
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed">
                          {evt.details}
                        </p>
                      )}

                      {evt.user && (
                        <div className="mt-1 pt-1 border-t border-gray-200/50 dark:border-gray-700/50 text-[10px] text-gray-400 flex items-center gap-1">
                          <span>Сотрудник:</span>
                          <span className="font-semibold text-gray-600 dark:text-gray-400">{evt.user}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. Past Archived Orders */}
      {orders.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <ArchiveBoxIcon className="w-4 h-4 text-gray-500" />
            <span>Архивные завершенные заказы ({orders.length})</span>
          </h4>

          <div className="space-y-3">
            {orders.map((order) => {
              const cleanDetails = (order['Заказ - QR'] || '').split('||JSON:')[0]?.trim();
              return (
                <div 
                  key={order.id} 
                  className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3.5 justify-between items-start shadow-xs hover:shadow-sm transition-shadow"
                >
                  <div className="flex-1 w-full min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          #{order['Договор']}
                        </span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                          от {formatDateForDisplay(order['Дата добавления'] || order['Начало'])}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {order['Статус сделки'] || 'Завершено'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-2 my-1 border-y border-gray-100 dark:border-gray-700/70">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-gray-400 block">Срок:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{order['Срок']} мес.</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-gray-400 block">Сумма:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(order['Общая сумма'] || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-gray-400 block">Окончание:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{formatDateForDisplay(order['Окончание'])}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-gray-400 block">Шины:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200 truncate block">{order['Бренд_Модель'] || order['Размер шин'] || 'Комплект'}</span>
                      </div>
                    </div>

                    {cleanDetails && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {cleanDetails}
                      </p>
                    )}
                  </div>
                  
                  <div className="w-full sm:w-auto shrink-0 self-stretch sm:self-center">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="w-full sm:w-auto !py-2 text-xs font-bold justify-center"
                      onClick={() => navigate('/add-client', { state: { clientToReorder: order } })}
                    >
                      Сдать снова
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
