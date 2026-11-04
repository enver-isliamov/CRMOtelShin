import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Client, ClientEvent, StorageOrder, formatDateForDisplay } from '../../types';
import { Button } from './Button';
import { Lightbox } from './Lightbox';
import { SunIcon, SnowflakeIcon, DiscIcon, TireIcon } from '../icons/Icons';

/* ========================================================================== */
/* 1. ICONS & VISUAL HELPERS                                                 */
/* ========================================================================== */

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

const ChatBubbleIcon: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-1.074-.707V18.25C2.87 16.666 2 14.444 2 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
);

const ClockIcon: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const CarIcon: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V4.5A2.25 2.25 0 0012 2.25H6.75A2.25 2.25 0 004.5 4.5v3M14.25 7.5H4.5" />
    </svg>
);

const CheckCircleIcon: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const WrenchIcon: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.398-3.085 1.22l-6.52 6.52a2.25 2.25 0 01-3.182-3.182l6.52-6.52c.822-.821 1.311-2.01 1.22-3.085A4.5 4.5 0 0117.25 2.25a4.5 4.5 0 014.5 4.5z" />
    </svg>
);

/* ========================================================================== */
/* 2. ORDER STATUS BADGE COMPONENT WITH DISTINCT COLOR CODING                 */
/* ========================================================================== */

export interface OrderStatusBadgeProps {
  status?: string;
  isArchived?: boolean;
  warehouse?: string;
  debt?: number;
  cell?: string;
  className?: string;
  showCell?: boolean;
}

/**
 * Visual indicator with dedicated color coding for tire storage orders:
 * - «На хранении» (зеленый / emerald)
 * - «Выдано» (серый / slate)
 * - «В работе» (синий / indigo)
 * - «Долг» (красный / rose)
 */
export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status = '',
  isArchived = false,
  warehouse = '',
  debt = 0,
  cell = '',
  className = '',
  showCell = true,
}) => {
  const normStatus = String(status || '').toLowerCase().trim();
  const isDelivered = isArchived || warehouse === 'У Клиента' || normStatus.includes('выдан') || normStatus.includes('закрыт') || normStatus === 'у клиента';
  const isInProgress = normStatus.includes('работ') || normStatus.includes('монтаж') || normStatus.includes('приемк') || normStatus.includes('новый');
  
  if (isDelivered) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300/80 dark:border-gray-700 whitespace-nowrap shadow-2xs ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500"></span>
        <span>🚗 Выдано</span>
      </span>
    );
  }

  if (isInProgress) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap shadow-2xs ${className}`}>
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
        <span>⚙️ В работе</span>
      </span>
    );
  }

  // Default: Active in storage
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 whitespace-nowrap shadow-2xs ${className}`}>
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <span>🏢 На хранении {showCell && cell ? `(Яч. ${cell})` : ''}</span>
    </span>
  );
};

/* ========================================================================== */
/* 3. UNIFIED TIMELINE EVENT STRUCTURE                                        */
/* ========================================================================== */

export type TimelineEventCategory = 'all' | 'order' | 'payment' | 'notification' | 'system';

export interface UnifiedTimelineEvent {
  id: string;
  timestamp: string; // ISO or date string
  sortDate: number;  // timestamp for sorting
  category: 'order' | 'payment' | 'notification' | 'system';
  title: string;
  description?: string;
  badgeLabel?: string;
  badgeColor?: string;
  orderContract?: string;
  user?: string;
  iconType: 'box' | 'car' | 'money' | 'chat' | 'wrench' | 'check' | 'clock';
  rawOrder?: StorageOrder;
}

/* ========================================================================== */
/* 4. MAIN ORDER HISTORY & UNIFIED TIMELINE COMPONENT                         */
/* ========================================================================== */

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
  const [viewMode, setViewMode] = useState<'timeline' | 'orders_table'>('timeline');
  const [timelineFilter, setTimelineFilter] = useState<TimelineEventCategory>('all');
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

  /* ======================================================================== */
  /* MERGED CHRONOLOGICAL FEED (Orders + System Events + Messages + Payments) */
  /* ======================================================================== */
  const unifiedEvents: UnifiedTimelineEvent[] = useMemo(() => {
    const list: UnifiedTimelineEvent[] = [];

    // Helper to parse dates to timestamp
    const getTimestamp = (val?: string): number => {
      if (!val) return 0;
      const parsed = Date.parse(val);
      if (!isNaN(parsed)) return parsed;
      // DD.MM.YYYY check
      const dmy = val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (dmy) {
        return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])).getTime();
      }
      return 0;
    };

    // 1. Convert Orders into Milestone Events
    ordersList.forEach((ord) => {
      const cleanDetails = (ord.qrCode || '').split('||JSON:')[0]?.trim();
      const seasonLabel = ord.season === 'Зима' ? '❄️ Зимний комплект' : '☀️ Летний комплект';
      const tireSpec = [ord.brandModel, ord.tireSize].filter(Boolean).join(' ') || 'Комплект шин';
      const rimsText = String(ord.hasRims).toLowerCase() === 'да' ? 'на дисках' : 'без дисков';

      // Milestone: Order In Storage / Created
      const startMs = getTimestamp(ord.startDate) || getTimestamp(client['Дата добавления']);
      list.push({
        id: `ord-start-${ord.contract || ord.id}`,
        timestamp: ord.startDate || client['Дата добавления'] || '',
        sortDate: startMs,
        category: 'order',
        title: `Приём на хранение (Договор #${ord.contract})`,
        description: `${seasonLabel}: ${tireSpec} (${ord.tireCount || 4} шт, ${rimsText}). Склад: ${ord.warehouse}${ord.cell ? `, ячейка ${ord.cell}` : ''}. Срок: ${ord.durationMonths || 6} мес.`,
        badgeLabel: ord.isArchived ? 'Архив' : 'На складе',
        badgeColor: ord.isArchived ? 'bg-gray-100 text-gray-700' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        orderContract: ord.contract,
        iconType: 'box',
        rawOrder: ord
      });

      // Milestone: Order Issued / Returned to Client (if archived or marked as with client)
      if (ord.isArchived || ord.warehouse === 'У Клиента' || ord.status === 'Выдано') {
        const expiryMs = getTimestamp(ord.expiryDate) || (startMs + 86400000);
        list.push({
          id: `ord-end-${ord.contract || ord.id}`,
          timestamp: ord.expiryDate || ord.startDate || '',
          sortDate: expiryMs,
          category: 'order',
          title: `Шины выданы клиенту (Договор #${ord.contract})`,
          description: `Сезон хранения завершён. Комплект шин передан клиенту. Договор переведён в статус «Выдано».`,
          badgeLabel: 'Выдано',
          badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          orderContract: ord.contract,
          iconType: 'car',
          rawOrder: ord
        });
      }
    });

    // 2. Convert Audit Events & System Logs
    historyEvents.forEach((evt) => {
      const actLower = String(evt.action || '').toLowerCase();
      const detLower = String(evt.details || '').toLowerCase();
      const ms = getTimestamp(evt.timestamp);

      let category: UnifiedTimelineEvent['category'] = 'system';
      let iconType: UnifiedTimelineEvent['iconType'] = 'clock';
      let badgeLabel = 'Система';
      let badgeColor = 'bg-gray-100 text-gray-700';

      if (actLower.includes('оплат') || detLower.includes('оплат') || actLower.includes('руб') || detLower.includes('внесена оплата')) {
        category = 'payment';
        iconType = 'money';
        badgeLabel = 'Оплата';
        badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      } else if (actLower.includes('сообщен') || actLower.includes('telegram') || actLower.includes('уведомл') || actLower.includes('напомин') || actLower.includes('чек')) {
        category = 'notification';
        iconType = 'chat';
        badgeLabel = 'Уведомление';
        badgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
      } else if (actLower.includes('монтаж') || actLower.includes('работ') || actLower.includes('сезон') || actLower.includes('смена')) {
        category = 'order';
        iconType = 'wrench';
        badgeLabel = 'Сервис';
        badgeColor = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300';
      }

      list.push({
        id: evt.id || `evt-${ms}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: evt.timestamp,
        sortDate: ms,
        category,
        title: evt.action,
        description: evt.details || undefined,
        user: evt.user,
        badgeLabel,
        badgeColor,
        iconType
      });
    });

    // Sort descending (newest first)
    list.sort((a, b) => b.sortDate - a.sortDate);
    return list;
  }, [ordersList, historyEvents, client]);

  // Filtered timeline events
  const filteredEvents = useMemo(() => {
    if (timelineFilter === 'all') return unifiedEvents;
    return unifiedEvents.filter(e => e.category === timelineFilter);
  }, [unifiedEvents, timelineFilter]);

  if (isLoading && ordersList.length === 0) return <LoadingSpinner />;
  if (error && ordersList.length === 0) return <p className="text-center py-6 text-sm text-red-500 font-medium">{error}</p>;

  const hasAnyData = ordersList.length > 0 || historyEvents.length > 0;

  if (!hasAnyData) return (
    <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
        <ArchiveBoxIcon className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" />
        <h3 className="mt-2 text-sm font-bold text-gray-900 dark:text-white">История заказов и действий пуста</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Здесь будет отображаться вся хронология: приём шин, история сезонов, платежи и переписка.
        </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {lightboxUrl && <Lightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* TOP VIEW SWITCHER: Table of Orders vs Unified Chronological Feed */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2 bg-gray-100/90 dark:bg-gray-900/90 rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'timeline'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ClockIcon className="w-3.5 h-3.5 text-primary-600" />
            <span>Единый лог хроники ({unifiedEvents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('orders_table')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'orders_table'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ArchiveBoxIcon className="w-3.5 h-3.5 text-primary-600" />
            <span>История заказов ({ordersList.length})</span>
          </button>
        </div>

        {/* Client quick recap */}
        <div className="flex items-center justify-between sm:justify-end gap-2 px-1 text-[11px] text-gray-500 font-medium">
          <span>Клиент: <strong className="text-gray-800 dark:text-gray-200">{client['Имя клиента']}</strong></span>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <span>Авто: <strong className="font-mono text-gray-800 dark:text-gray-200">{client['Номер Авто'] || '—'}</strong></span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VIEW A: UNIFIED CHRONOLOGICAL FEED (Timeline)                       */}
      {/* ==================================================================== */}
      {viewMode === 'timeline' && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          
          {/* Filter Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 mr-1">
              Фильтр:
            </span>
            <button
              type="button"
              onClick={() => setTimelineFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-colors shrink-0 ${
                timelineFilter === 'all'
                  ? 'bg-primary-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              Все события ({unifiedEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setTimelineFilter('order')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-colors shrink-0 flex items-center gap-1 ${
                timelineFilter === 'order'
                  ? 'bg-primary-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>📦 Заказы и шины</span>
              <span className="text-[10px] opacity-75">({unifiedEvents.filter(e => e.category === 'order').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTimelineFilter('payment')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-colors shrink-0 flex items-center gap-1 ${
                timelineFilter === 'payment'
                  ? 'bg-primary-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>💰 Оплаты</span>
              <span className="text-[10px] opacity-75">({unifiedEvents.filter(e => e.category === 'payment').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTimelineFilter('notification')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-colors shrink-0 flex items-center gap-1 ${
                timelineFilter === 'notification'
                  ? 'bg-primary-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>💬 Сообщения и TG</span>
              <span className="text-[10px] opacity-75">({unifiedEvents.filter(e => e.category === 'notification').length})</span>
            </button>
          </div>

          {/* Chronological Stream */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 sm:p-5 shadow-xs">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                По выбранному фильтру событий не найдено
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-7 space-y-4 before:absolute before:left-2.5 sm:before:left-3 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                {filteredEvents.map((evt, idx) => {
                  const isOrder = evt.category === 'order';
                  const isPayment = evt.category === 'payment';
                  const isNotification = evt.category === 'notification';

                  // Circle dot colors
                  const dotClasses = isPayment
                    ? 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/60'
                    : isOrder
                      ? 'bg-primary-600 ring-4 ring-primary-100 dark:ring-primary-950/60'
                      : isNotification
                        ? 'bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-950/60'
                        : 'bg-gray-400 ring-4 ring-gray-100 dark:ring-gray-700';

                  return (
                    <div key={evt.id || idx} className="relative group">
                      {/* Timeline Node Point */}
                      <span className={`absolute -left-6 sm:-left-7 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 transition-transform group-hover:scale-125 ${dotClasses}`} />

                      {/* Content Card */}
                      <div className="p-3 sm:p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-2xs">
                        
                        {/* Event Header */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              {evt.title}
                            </span>

                            {evt.orderContract && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-200/70 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                #{evt.orderContract}
                              </span>
                            )}

                            {evt.badgeLabel && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${evt.badgeColor || 'bg-gray-100 text-gray-700'}`}>
                                {evt.badgeLabel}
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] font-mono text-gray-400 whitespace-nowrap">
                            {evt.timestamp ? (
                              evt.timestamp.includes('T') || evt.timestamp.includes(':') 
                                ? new Date(evt.timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                                : formatDateForDisplay(evt.timestamp)
                            ) : '—'}
                          </span>
                        </div>

                        {/* Event Body Description */}
                        {evt.description && (
                          <p className="text-xs text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed">
                            {evt.description}
                          </p>
                        )}

                        {/* Order action button if attached */}
                        {evt.rawOrder && (
                          <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                              <span>Сумма: <strong>{evt.rawOrder.totalPrice} ₽</strong></span>
                              {evt.rawOrder.debt > 0 ? (
                                <span className="text-rose-600 font-bold">Долг: {evt.rawOrder.debt} ₽</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">Оплачено</span>
                              )}
                            </div>

                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="!py-1 !px-2 text-[11px] font-bold"
                              onClick={() => navigate('/add-client', {
                                state: {
                                  clientToReorder: {
                                    ...client,
                                    'Договор': evt.rawOrder?.contract,
                                    'Бренд_Модель': evt.rawOrder?.brandModel,
                                    'Размер шин': evt.rawOrder?.tireSize,
                                    'Сезон': evt.rawOrder?.season === 'Зима' ? 'Лето' : 'Зима',
                                    'Склад хранения': evt.rawOrder?.warehouse !== 'У Клиента' ? evt.rawOrder?.warehouse : 'ABD13',
                                    'Кол-во шин': evt.rawOrder?.tireCount,
                                    'Наличие дисков': evt.rawOrder?.hasRims
                                  }
                                }
                              })}
                            >
                              <span>🔄 Принять на новый сезон</span>
                            </Button>
                          </div>
                        )}

                        {/* Operator / User attribution */}
                        {evt.user && (
                          <div className="mt-1.5 pt-1 text-[10px] text-gray-400 flex items-center gap-1 border-t border-gray-100 dark:border-gray-800">
                            <span>Сотрудник:</span>
                            <span className="font-semibold text-gray-600 dark:text-gray-400">{evt.user}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW B: FULL TABLE & DETAILED CARDS OF ALL ORDERS                   */}
      {/* ==================================================================== */}
      {viewMode === 'orders_table' && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          
          {/* Header row */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <ArchiveBoxIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span>Все заказы и сезоны клиента ({ordersList.length})</span>
            </h4>

            <Button
              size="sm"
              onClick={() => navigate('/add-client', { state: { clientToReorder: client } })}
              className="!py-1.5 px-3 text-xs font-bold bg-primary-600 text-white shadow-2xs"
            >
              <span>+ Новый сезон</span>
            </Button>
          </div>

          {/* 1. TABLE VIEW FOR TABLET & DESKTOP (Hidden on Mobile) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xs">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
              <thead className="bg-gray-50/80 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3.5 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Договор</th>
                  <th className="px-3.5 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Статус хранения</th>
                  <th className="px-3.5 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Период</th>
                  <th className="px-3.5 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Шины и сезон</th>
                  <th className="px-3.5 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Склад / Ячейка</th>
                  <th className="px-3.5 py-3 text-right font-bold text-gray-500 uppercase tracking-wider">Сумма / Оплата</th>
                  <th className="px-3.5 py-3 text-center font-bold text-gray-500 uppercase tracking-wider">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                {ordersList.map((ord, idx) => {
                  const isWinter = ord.season === 'Зима';
                  const hasRims = String(ord.hasRims).toLowerCase() === 'да';
                  return (
                    <tr key={ord.id || ord.contract || idx} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-mono font-extrabold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          #{ord.contract}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <OrderStatusBadge 
                          status={ord.status} 
                          isArchived={ord.isArchived} 
                          warehouse={ord.warehouse} 
                          debt={ord.debt} 
                          cell={ord.cell} 
                          showCell={false}
                        />
                      </td>

                      <td className="px-3.5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                        <div>с {formatDateForDisplay(ord.startDate)}</div>
                        <div className="text-[11px] text-gray-400">по {formatDateForDisplay(ord.expiryDate)} ({ord.durationMonths} мес.)</div>
                      </td>

                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[11px] font-bold ${
                            isWinter ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {isWinter ? <SnowflakeIcon className="w-3 h-3 text-blue-500" /> : <SunIcon className="w-3 h-3 text-amber-500" />}
                            <span>{ord.season}</span>
                          </span>

                          <span className="font-bold text-gray-900 dark:text-white">
                            {ord.brandModel || ord.tireSize || 'Комплект'}
                          </span>

                          <span className="text-[11px] text-gray-400">
                            ({ord.tireCount || 4} шт, {hasRims ? 'диски' : 'без дисков'})
                          </span>
                        </div>
                      </td>

                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="text-gray-800 dark:text-gray-200 font-bold block">{ord.warehouse || 'У Клиента'}</span>
                        {ord.cell && <span className="text-[11px] text-primary-600 font-mono">Ячейка: {ord.cell}</span>}
                      </td>

                      <td className="px-3.5 py-3 whitespace-nowrap text-right">
                        <div className="font-black text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(ord.totalPrice || 0)}
                        </div>
                        {ord.debt > 0 ? (
                          <span className="text-[11px] text-rose-600 font-bold">Долг: {ord.debt} ₽</span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-bold">Оплачено</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 whitespace-nowrap text-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="!py-1 !px-2 text-xs font-bold"
                          onClick={() => navigate('/add-client', {
                            state: {
                              clientToReorder: {
                                ...client,
                                'Договор': ord.contract,
                                'Бренд_Модель': ord.brandModel,
                                'Размер шин': ord.tireSize,
                                'Сезон': ord.season === 'Зима' ? 'Лето' : 'Зима',
                                'Склад хранения': ord.warehouse !== 'У Клиента' ? ord.warehouse : 'ABD13',
                                'Кол-во шин': ord.tireCount,
                                'Наличие дисков': ord.hasRims
                              }
                            }
                          })}
                        >
                          <span>🔄 Новый сезон</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 2. CARD VIEW OPTIMIZED FOR MOBILE SCREENS (<768px) */}
          <div className="block md:hidden space-y-3">
            {ordersList.map((order, orderIdx) => {
              const cleanDetails = String(order.qrCode || '').split('||JSON:')[0]?.trim() || '';
              const isSeasonWinter = order.season === 'Зима';
              const isTiresOnWarehouse = !order.isArchived && order.warehouse !== 'У Клиента' && order.status !== 'Выдано' && order.status !== 'Закрыта';
              const hasRims = String(order.hasRims).toLowerCase() === 'да' || cleanDetails.toLowerCase().includes('с дисками');

              return (
                <div 
                  key={order.id || order.contract || orderIdx} 
                  className={`p-3.5 sm:p-4 bg-white dark:bg-gray-800 rounded-2xl border transition-all shadow-xs ${
                    isTiresOnWarehouse
                      ? 'border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-500/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex flex-col gap-2.5">
                    
                    {/* Top Row: Contract + Status Indicator */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                          #{order.contract}
                        </span>

                        <OrderStatusBadge 
                          status={order.status} 
                          isArchived={order.isArchived} 
                          warehouse={order.warehouse} 
                          debt={order.debt} 
                          cell={order.cell} 
                        />
                      </div>

                      {/* Season Badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                        isSeasonWinter 
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-900' 
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                      }`}>
                        {isSeasonWinter ? <SnowflakeIcon className="w-3.5 h-3.5 text-blue-500" /> : <SunIcon className="w-3.5 h-3.5 text-amber-500" />}
                        <span>{order.season || 'Сезон'}</span>
                      </span>
                    </div>

                    {/* Middle Details Grid */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Шины:</span>
                        <span className="font-bold text-gray-900 dark:text-white truncate block">
                          {order.brandModel || order.tireSize || 'Комплект шин'}
                        </span>
                        <span className="text-[11px] text-gray-500 block">
                          {order.tireCount || 4} шт • {hasRims ? 'С дисками' : 'Без дисков'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Срок:</span>
                        <span className="font-bold text-gray-900 dark:text-white">{order.durationMonths || 6} мес.</span>
                        <span className="text-[11px] text-gray-500 block truncate">до {formatDateForDisplay(order.expiryDate)}</span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Склад:</span>
                        <span className="font-bold text-gray-900 dark:text-white truncate block">
                          {order.warehouse || 'У Клиента'}
                        </span>
                        {order.cell && (
                          <span className="text-[11px] text-primary-600 dark:text-primary-400 font-bold block">Ячейка: {order.cell}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Сумма:</span>
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

                    {/* Photo Thumbnails */}
                    {order.photoUrls && order.photoUrls.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Фото:</span>
                        {order.photoUrls.slice(0, 4).map((url, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => setLightboxUrl(url)}
                            className="relative w-9 h-9 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0"
                          >
                            <img src={url} alt={`Фото ${pIdx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full !py-2 text-xs font-bold justify-center"
                        onClick={() => navigate('/add-client', { 
                          state: { 
                            clientToReorder: {
                              ...client,
                              'Договор': order.contract,
                              'Бренд_Модель': order.brandModel,
                              'Размер шин': order.tireSize,
                              'Сезон': order.season === 'Зима' ? 'Лето' : 'Зима',
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
    </div>
  );
};
