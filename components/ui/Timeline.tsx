import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Client, ClientEvent, StorageOrder, formatDateForDisplay } from '../../types';
import { Button } from './Button';
import { Lightbox } from './Lightbox';
import { SunIcon, SnowflakeIcon, DiscIcon, TireIcon } from '../icons/Icons';

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
  const [ordersList, setOrdersList] = useState<StorageOrder[]>(() => {
    if (client.orders && client.orders.length > 0) {
      return client.orders;
    }
    return [];
  });
  const [historyEvents, setHistoryEvents] = useState<ClientEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;
      setIsLoading(true);
      setError(null);
      try {
        const [archivedRows, events] = await Promise.all([
          api.fetchArchivedOrders(client.id).catch(() => []),
          api.fetchClientHistory(client.id).catch(() => []),
        ]);

        // Собираем все заказы клиента
        const existingOrders = client.orders || [];
        const mergedOrdersMap = new Map<string, StorageOrder>();

        // 1. Добавляем заказы из клиентского объекта
        for (const ord of existingOrders) {
            mergedOrdersMap.set(ord.contract || ord.id, ord);
        }

        // 2. Добавляем заказы из архивного запроса API
        for (const row of archivedRows) {
            const contract = row['Договор'] || row.id;
            if (!mergedOrdersMap.has(contract)) {
                mergedOrdersMap.set(contract, {
                    id: row.id,
                    contract: row['Договор'] || row.id,
                    qrCode: row['Заказ - QR'] || '',
                    startDate: row['Начало'] || row['Дата добавления'] || '',
                    durationMonths: Number(row['Срок'] || 0),
                    reminderDate: row['Напомнить'] || '',
                    expiryDate: row['Окончание'] || '',
                    warehouse: row['Склад хранения'] || 'У Клиента',
                    cell: row['Ячейка'] || '',
                    pricePerMonth: Number(row['Цена за месяц'] || 0),
                    totalPrice: Number(row['Общая сумма'] || 0),
                    debt: Number(row['Долг'] || 0),
                    status: row['Статус сделки'] || 'Завершено',
                    isArchived: true,
                    photoUrls: Array.isArray(row.photoUrls) ? row.photoUrls : [],
                    brandModel: row['Бренд_Модель'] || '',
                    tireSize: row['Размер шин'] || '',
                    dotCode: row['DOT-код'] || '',
                    season: row['Сезон'] || 'Лето',
                    tireCount: Number(row['Кол-во шин'] || 4),
                    hasRims: row['Наличие дисков'] || 'Нет',
                    metadata: row.metadata || ''
                });
            }
        }

        // Если текущий заказ клиента еще не в списке, добавляем его как активный
        if (client['Договор'] && !mergedOrdersMap.has(client['Договор'])) {
            mergedOrdersMap.set(client['Договор'], {
                id: client.id,
                contract: client['Договор'],
                qrCode: client['Заказ - QR'] || '',
                startDate: client['Начало'] || '',
                durationMonths: Number(client['Срок'] || 0),
                reminderDate: client['Напомнить'] || '',
                expiryDate: client['Окончание'] || '',
                warehouse: client['Склад хранения'] || 'Основной',
                cell: client['Ячейка'] || '',
                pricePerMonth: Number(client['Цена за месяц'] || 0),
                totalPrice: Number(client['Общая сумма'] || 0),
                debt: Number(client['Долг'] || 0),
                status: client['Статус сделки'] || 'На складе',
                isArchived: Boolean(client.is_archived || client['Склад хранения'] === 'У Клиента'),
                photoUrls: Array.isArray(client.photoUrls) ? client.photoUrls : [],
                brandModel: client['Бренд_Модель'] || '',
                tireSize: client['Размер шин'] || '',
                dotCode: client['DOT-код'] || '',
                season: client['Сезон'] || 'Лето',
                tireCount: Number(client['Кол-во шин'] || 4),
                hasRims: client['Наличие дисков'] || 'Нет',
                metadata: client.metadata || ''
            });
        }

        const combined = Array.from(mergedOrdersMap.values());
        combined.sort((a, b) => {
            const dateA = a.startDate || a.expiryDate || '';
            const dateB = b.startDate || b.expiryDate || '';
            return dateB.localeCompare(dateA);
        });

        setOrdersList(combined);
        setHistoryEvents(events);
      } catch (e: any) {
        setError("Не удалось загрузить историю.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [client?.id, client?.orders]);

  if (isLoading && ordersList.length === 0) return <LoadingSpinner />;
  if (error && ordersList.length === 0) return <p className="text-center py-6 text-sm text-red-500 font-medium">{error}</p>;

  const hasAnyData = ordersList.length > 0 || historyEvents.length > 0;

  if (!hasAnyData) return (
    <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <ArchiveBoxIcon className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" />
        <h3 className="mt-2 text-sm font-bold text-gray-900 dark:text-white">История пуста</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Здесь будут отображаться все сезоны хранения шин клиента и хроника операций.
        </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {lightboxUrl && <Lightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* ==================================================================== */}
      {/* 1. ИСТОРИЯ ЗАКАЗОВ И СЕЗОНОВ ХРАНЕНИЯ КЛИЕНТА                        */}
      {/* ==================================================================== */}
      {ordersList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <ArchiveBoxIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span>Заказы и сезоны хранения ({ordersList.length})</span>
            </h4>
            <span className="text-[11px] font-medium text-gray-400">
              {client['Имя клиента']}
            </span>
          </div>

          <div className="space-y-3">
            {ordersList.map((order, orderIdx) => {
              const cleanDetails = (order.qrCode || '').split('||JSON:')[0]?.trim();
              const isSeasonWinter = order.season === 'Зима';
              const isTiresOnWarehouse = !order.isArchived && order.warehouse !== 'У Клиента' && order.status !== 'Выдано' && order.status !== 'Закрыта';
              const hasRims = String(order.hasRims).toLowerCase() === 'да' || cleanDetails.toLowerCase().includes('с дисками');

              return (
                <div 
                  key={order.id || order.contract || orderIdx} 
                  className={`p-4 bg-white dark:bg-gray-800 rounded-2xl border transition-all shadow-xs ${
                    isTiresOnWarehouse
                      ? 'border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-500/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    
                    {/* Header Row: Contract Number + Status Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                          #{order.contract}
                        </span>

                        {isTiresOnWarehouse ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/60 dark:border-emerald-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>На складе (Ячейка {order.cell || '—'})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            <span>🚗 Выдано / Шины у клиента</span>
                          </span>
                        )}

                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {order.startDate ? `с ${formatDateForDisplay(order.startDate)}` : ''} {order.expiryDate ? `по ${formatDateForDisplay(order.expiryDate)}` : ''}
                        </span>
                      </div>

                      {/* Season & Wheels Badge */}
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                          isSeasonWinter 
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-900' 
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                        }`}>
                          {isSeasonWinter ? <SnowflakeIcon className="w-3.5 h-3.5 text-blue-500" /> : <SunIcon className="w-3.5 h-3.5 text-amber-500" />}
                          <span>{order.season || 'Сезон'}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {hasRims ? <DiscIcon className="w-3.5 h-3.5 text-blue-500" /> : <TireIcon className="w-3.5 h-3.5 text-gray-400" />}
                          <span>{hasRims ? 'С дисками' : 'Без дисков'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Middle Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-gray-50/70 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Шины:</span>
                        <span className="font-bold text-gray-900 dark:text-white truncate block">
                          {order.brandModel || order.tireSize || 'Комплект шин'}
                        </span>
                        {order.tireSize && order.brandModel && (
                          <span className="text-[11px] text-gray-500 font-mono block">{order.tireSize}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Срок:</span>
                        <span className="font-bold text-gray-900 dark:text-white">{order.durationMonths || 6} мес.</span>
                        <span className="text-[11px] text-gray-500 block">до {formatDateForDisplay(order.expiryDate)}</span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Склад / Ячейка:</span>
                        <span className="font-bold text-gray-900 dark:text-white truncate block">
                          {order.warehouse || 'У Клиента'}
                        </span>
                        {order.cell && (
                          <span className="text-[11px] text-primary-600 dark:text-primary-400 font-bold block">Ячейка: {order.cell}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Сумма заказа:</span>
                        <span className="font-black text-gray-900 dark:text-white block whitespace-nowrap">
                          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(order.totalPrice || 0)}
                        </span>
                        {order.debt > 0 ? (
                          <span className="text-[11px] text-rose-600 font-bold block">Долг: {order.debt} ₽</span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-bold block">Оплачено</span>
                        )}
                      </div>
                    </div>

                    {/* Clean Notes & QR details */}
                    {cleanDetails && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 px-1">
                        {cleanDetails}
                      </p>
                    )}

                    {/* Photo Thumbnails for this season */}
                    {order.photoUrls && order.photoUrls.length > 0 && (
                      <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Фото сезона:</span>
                        {order.photoUrls.slice(0, 5).map((photoUrl, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => setLightboxUrl(photoUrl)}
                            className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0 hover:scale-105 transition-transform"
                          >
                            <img src={photoUrl} alt={`Фото ${pIdx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                        {order.photoUrls.length > 5 && (
                          <span className="text-xs text-gray-400 font-bold">+{order.photoUrls.length - 5}</span>
                        )}
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 gap-2">
                      <div className="text-[11px] text-gray-400">
                        {isTiresOnWarehouse ? 'Комплект находится на хранении' : 'Шины выданы клиенту'}
                      </div>

                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="!py-1.5 px-3 text-xs font-bold flex items-center gap-1.5"
                        onClick={() => navigate('/add-client', { 
                          state: { 
                            clientToReorder: {
                              ...client,
                              'Договор': order.contract,
                              'Бренд_Модель': order.brandModel,
                              'Размер шин': order.tireSize,
                              'Сезон': order.season === 'Зима' ? 'Лето' : 'Зима', // Предлагаем смену сезона
                              'Склад хранения': order.warehouse !== 'У Клиента' ? order.warehouse : 'ABD13',
                              'Кол-во шин': order.tireCount,
                              'Наличие дисков': order.hasRims
                            } 
                          } 
                        })}
                      >
                        <span>🔄 Принять на новый сезон</span>
                      </Button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. ХРОНОЛОГИЯ ОПЕРАЦИЙ И АУДИТА                                     */}
      {/* ==================================================================== */}
      {historyEvents.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <BanknotesIcon className="w-4 h-4 text-emerald-600" />
              <span>Хронология действий и платежей ({historyEvents.length})</span>
            </h4>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-xs">
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
              {historyEvents.map((evt, idx) => {
                const actionLower = (evt.action || '').toLowerCase();
                const isPayment = actionLower.includes('оплат');
                const isArchived = actionLower.includes('архив') || actionLower.includes('завершен') || actionLower.includes('выдан');
                
                return (
                  <div key={evt.id || idx} className="relative group">
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
    </div>
  );
};
