import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Client, ClientEvent, formatDateForDisplay } from '../../types';
import { Button } from './Button';

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center py-8">
        <svg className="animate-spin h-6 w-6 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const ArchiveBoxIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M.5 3.75A.75.75 0 011.25 3h17.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75h-17.5a.75.75 0 01-.75-.75v-3zM1.25 9h17.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75h-17.5a.75.75 0 01-.75-.75v-3A.75.75 0 011.25 9z" /><path d="M2 15.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" /></svg>;
const BanknotesIcon: React.FC<{className?: string}> = ({className="w-4 h-4"}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H2.25m0 0v10.5m0-10.5h16.5m-16.5 0h16.5m0 0v10.5m0-10.5a.75.75 0 01.75-.75h.75m0 0A2.25 2.25 0 0121.75 6v10.5a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 16.5V6a2.25 2.25 0 012.25-2.25h16.5M12 9.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" /></svg>;

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
  }, [client]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  const hasAnyData = orders.length > 0 || historyEvents.length > 0;

  if (!hasAnyData) return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">История пуста</h3>
        <p className="mt-1 text-sm text-gray-500">У этого клиента пока нет записей о платежах или прошлых заказах.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. History Events (Payments, Updates, Actions) */}
      {historyEvents.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <BanknotesIcon className="w-4 h-4 text-emerald-500" />
            История операций и платежей
          </h4>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60 shadow-sm overflow-hidden">
            {historyEvents.map((evt, idx) => {
              const isPayment = evt.action === 'Оплата' || (evt.action || '').toLowerCase().includes('оплат');
              return (
                <div key={evt.id || idx} className="p-3.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                    isPayment 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' 
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300'
                  }`}>
                    {isPayment ? (
                      <BanknotesIcon className="w-4 h-4" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className={`text-sm font-bold ${isPayment ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'}`}>
                        {evt.action}
                      </span>
                      <span className="text-xs text-gray-400">
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    {evt.details && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-wrap">
                        {evt.details}
                      </p>
                    )}
                    {evt.user && (
                      <span className="inline-block text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                        Сотрудник: {evt.user}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Past Archived Orders */}
      {orders.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />
            Прошлые завершенные заказы ({orders.length})
          </h4>
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-start shadow-sm">
                <div className="flex-1 w-full">
                    <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">Заказ от {formatDateForDisplay(order['Дата добавления'])}</h4>
                        <span className="text-xs font-mono px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">{order['Договор']}</span>
                    </div>
                    <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                          <dt className="text-gray-500 dark:text-gray-400 text-xs">Срок:</dt>
                          <dd className="text-gray-800 dark:text-gray-200 font-medium">{order['Срок']} мес.</dd>
                      </div>
                      <div>
                          <dt className="text-gray-500 dark:text-gray-400 text-xs">Сумма:</dt>
                          <dd className="text-gray-800 dark:text-gray-200 font-medium">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(order['Общая сумма'] || 0)}</dd>
                      </div>
                      <div>
                          <dt className="text-gray-500 dark:text-gray-400 text-xs">Статус:</dt>
                          <dd className="text-gray-800 dark:text-gray-200">{order['Статус сделки']}</dd>
                      </div>
                      <div>
                          <dt className="text-gray-500 dark:text-gray-400 text-xs">Окончание:</dt>
                          <dd className="text-gray-800 dark:text-gray-200">{formatDateForDisplay(order['Окончание'])}</dd>
                      </div>
                    </dl>
                    {order['Заказ - QR'] && (
                      <div className='mt-2 pt-2 border-t border-gray-200 dark:border-gray-700'>
                          <dt className="text-gray-500 dark:text-gray-400 text-xs">Детали заказа:</dt>
                          <dd className="text-gray-800 dark:text-gray-200 text-sm font-mono whitespace-pre-wrap">{order['Заказ - QR']}</dd>
                      </div>
                    )}
                </div>
                
                <div className="w-full sm:w-auto self-stretch sm:self-center shrink-0">
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full sm:w-auto h-full sm:h-auto py-2 sm:py-2 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 font-medium"
                        onClick={() => navigate('/add-client', { state: { clientToReorder: order } })}
                      >
                        Сдать снова (с теми же шинами)
                    </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
