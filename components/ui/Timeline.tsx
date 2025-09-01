
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Client, formatDateForDisplay } from '../../types';

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center py-8">
        <svg className="animate-spin h-6 w-6 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const ArchiveBoxIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M.5 3.75A.75.75 0 011.25 3h17.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75h-17.5a.75.75 0 01-.75-.75v-3zM1.25 9h17.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75h-17.5a.75.75 0 01-.75-.75v-3A.75.75 0 011.25 9z" /><path d="M2 15.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" /></svg>;


export const OrderHistory: React.FC<{ client: Client }> = ({ client }) => {
  const [orders, setOrders] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!client) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.fetchArchivedOrders(client.id);
        setOrders(data);
      } catch (e: any) {
        setError("Не удалось загрузить историю заказов.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [client]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-center text-red-500">{error}</p>;
  if (orders.length === 0) return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Архив пуст</h3>
        <p className="mt-1 text-sm text-gray-500">У этого клиента еще нет завершенных заказов.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
           <div className="flex justify-between items-start">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200">Заказ от {formatDateForDisplay(order['Дата добавления'])}</h4>
              <span className="text-xs font-mono px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">{order['Договор']}</span>
           </div>
           <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
             <div>
                <dt className="text-gray-500 dark:text-gray-400">Срок:</dt>
                <dd className="text-gray-800 dark:text-gray-200">{order['Срок']} мес.</dd>
             </div>
             <div>
                <dt className="text-gray-500 dark:text-gray-400">Сумма:</dt>
                <dd className="text-gray-800 dark:text-gray-200">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(order['Общая сумма'] || 0)}</dd>
             </div>
             <div>
                <dt className="text-gray-500 dark:text-gray-400">Статус:</dt>
                <dd className="text-gray-800 dark:text-gray-200">{order['Статус сделки']}</dd>
             </div>
             <div>
                <dt className="text-gray-500 dark:text-gray-400">Окончание:</dt>
                <dd className="text-gray-800 dark:text-gray-200">{formatDateForDisplay(order['Окончание'])}</dd>
             </div>
           </dl>
           {order['Заказ - QR'] && (
            <div className='mt-2 pt-2 border-t border-gray-200 dark:border-gray-600'>
                 <dt className="text-gray-500 dark:text-gray-400 text-xs">Детали заказа:</dt>
                 <dd className="text-gray-800 dark:text-gray-200 text-sm font-mono">{order['Заказ - QR']}</dd>
            </div>
           )}
        </div>
      ))}
    </div>
  );
};
