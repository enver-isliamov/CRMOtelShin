import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Client, MessageTemplate, SavedView, formatDateForDisplay, checkStorageExpiry } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';

// --- CANONICAL ICONS ---
import { 
  SearchIcon, 
  BookmarkIcon, 
  XMarkIcon, 
  FilterIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  WarehouseIcon,
  SnowflakeIcon,
  SunIcon,
  TireIcon,
  DiscIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon
} from './icons/Icons';
import { ExportClientsModal } from './ui/ExportClientsModal';
import { ImportClientsModal } from './ui/ImportClientsModal';

export type GroupByOption = 'none' | 'season' | 'expiry' | 'warehouse' | 'status' | 'rims';

const RU_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const getFieldType = (fieldName: string) => {
    const name = fieldName.toLowerCase();
    if (name.includes('дата') || name.includes('начало') || name.includes('окончание') || name.includes('напомнить')) return 'date';
    if (name.includes('цена') || name.includes('кол-во') || name.includes('сумма') || name.includes('долг') || name.includes('срок')) return 'number';
    if (name.includes('телефон')) return 'tel';
    return 'text';
};

const getClientPhotosCount = (c: Client): number => {
    const p = c.photoUrls;
    if (Array.isArray(p)) return p.length;
    if (typeof (p as unknown) === 'string' && (p as unknown as string).trim().length > 0) {
        return (p as unknown as string).split(',').length;
    }
    return 0;
};

const FilterBadge: React.FC<{text: string; onRemove: () => void}> = ({ text, onRemove }) => (
  <span className="inline-flex items-center gap-x-1.5 bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-800/30 dark:text-blue-200 rounded-full whitespace-nowrap">
    {text}
    <button
        type="button"
        onClick={onRemove}
        className="group relative -mr-0.5 h-3.5 w-3.5 rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-500/30"
    >
        <span className="sr-only">Удалить фильтр</span>
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 stroke-blue-600/50 group-hover:stroke-blue-600/75 dark:stroke-blue-400/50 dark:group-hover:stroke-blue-400">
            <path d="M4 4l6 6m0-6l-6 6" />
        </svg>
    </button>
  </span>
);

// Individual client row component
// Individual client row component
const ClientRowItem: React.FC<{
    client: Client;
    onClick: (e: React.MouseEvent) => void;
}> = ({ client, onClick }) => {
    const isTiresOut = client.hasActiveStorage === false || client['Склад хранения'] === 'У Клиента' || client['Статус сделки'] === 'Шины у клиента';
    const expiry = isTiresOut ? null : checkStorageExpiry(client['Окончание']);
    const isUrgentExpiry = expiry?.isUrgent === true;
    const ordersCount = client.ordersCount || client.orders?.length || 1;

    return (
        <div 
            onClick={onClick} 
            className={`flex items-center justify-between p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                isUrgentExpiry ? 'border-l-4 border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/15 hover:bg-rose-50/40 dark:hover:bg-rose-950/30' : ''
            }`}
        >
            <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                     <span className="font-semibold text-gray-900 dark:text-white text-base truncate">
                        {client['Имя клиента']}
                     </span>

                     {ordersCount > 1 && (
                        <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 shadow-2xs whitespace-nowrap"
                            title={`Всего оформлено сезонов/заказов: ${ordersCount}`}
                        >
                            <span>📦</span>
                            <span>{ordersCount} {ordersCount === 2 || ordersCount === 3 || ordersCount === 4 ? 'сезона' : 'сезонов'}</span>
                        </span>
                     )}

                     {isTiresOut && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                            🚗 Шины у клиента
                        </span>
                     )}

                     {(client['Долг'] || 0) > 0 && (
                        <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm ring-1 ring-red-400/50" title={`Долг: ${client['Долг']} ₽`}></span>
                     )}
                     {isUrgentExpiry && (
                        <span 
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200 border border-rose-300/80 dark:border-rose-800 shadow-2xs whitespace-nowrap"
                            title={expiry.statusText}
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                            </span>
                            <span>{expiry.isExpired ? 'Срок истёк!' : `Истекает: ${expiry.shortText}`}</span>
                        </span>
                     )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                     <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {client['Номер Авто'] || 'Нет авто'}
                     </span>
                     {client['Договор'] && (
                        <span className="font-mono bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 px-1.5 py-0.5 rounded text-[11px] text-blue-700 dark:text-blue-300 whitespace-nowrap">
                           № {client['Договор']}
                        </span>
                     )}
                     {client['Размер шин'] && (
                        <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap font-medium">
                           {client['Размер шин']}
                        </span>
                     )}
                     {getClientPhotosCount(client) > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-xs" title="Прикреплены фото">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <span>{getClientPhotosCount(client)}</span>
                        </span>
                     )}
                     {client['Телефон'] && (
                        <>
                            <span className="hidden sm:inline">•</span>
                            <span className="whitespace-nowrap">{client['Телефон']}</span>
                        </>
                     )}
                </div>
            </div>

            <div className="text-right flex flex-col gap-1 flex-shrink-0">
                 {isTiresOut ? (
                     <>
                         <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                             {client['Окончание'] ? `Выдан: ${formatDateForDisplay(client['Окончание'])}` : 'Шины на руках'}
                         </span>
                         <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">
                             {client['Статус сделки'] || 'Сезон завершён'}
                         </span>
                     </>
                 ) : (
                     <>
                         <span className={`text-sm flex items-center justify-end gap-1.5 ${
                             isUrgentExpiry 
                                 ? 'font-bold text-rose-600 dark:text-rose-400' 
                                 : 'text-gray-600 dark:text-gray-300'
                         }`}>
                             <span>{formatDateForDisplay(client['Окончание'])}</span>
                             {isUrgentExpiry && (
                                 <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500 text-white shadow-2xs">
                                     ≤ 7 дн.
                                 </span>
                             )}
                         </span>
                         <span className={`font-bold text-sm ${
                             (client['Долг'] || 0) > 0 
                             ? 'text-red-600 dark:text-red-400' 
                             : 'text-gray-900 dark:text-white'
                         }`}>
                             {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(client['Долг'] || 0)}
                         </span>
                     </>
                 )}
            </div>
        </div>
    );
};

interface ClientGroup {
    id: string;
    sortKey: string;
    title: string;
    icon: React.ReactNode;
    badgeClass: string;
    clients: Client[];
    totalTires: number;
    totalDebt: number;
}

export const ClientsView: React.FC<{
    clients: Client[];
    archive?: Client[];
    headers: string[];
    templates: MessageTemplate[];
    savedViews: SavedView[];
    onSaveViews: (views: SavedView[]) => void;
    refreshData: () => Promise<void>;
}> = ({ clients, archive = [], headers = [], savedViews, onSaveViews, refreshData }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [viewTab, setViewTab] = useState<'active' | 'archive' | 'all'>(
    searchParams.get('tab') === 'archive' ? 'archive' : (searchParams.get('tab') === 'all' ? 'all' : 'active')
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [filters, setFilters] = useState({
    status: 'all',
    warehouse: 'all',
    debt: searchParams.get('filter') === 'debt',
    expiring: searchParams.get('filter') === 'expiring',
  });
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'ascending' | 'descending' } | null>({ key: 'Начало', direction: 'descending' });
  const [newViewName, setNewViewName] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sync tab from URL params if present
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'archive' && viewTab !== 'archive') {
      setViewTab('archive');
    } else if (tabParam === 'all' && viewTab !== 'all') {
      setViewTab('all');
    } else if (!tabParam && viewTab !== 'active') {
      setViewTab('active');
    }
  }, [searchParams]);

  const currentBaseList = useMemo(() => {
    if (viewTab === 'all') return [...clients, ...archive];
    return viewTab === 'archive' ? archive : clients;
  }, [viewTab, clients, archive]);

  // Count clients whose storage ends within <= 7 days or is overdue (active only)
  const urgentCount = useMemo(() => {
    return clients.filter(c => {
      const exp = checkStorageExpiry(c['Окончание']);
      return exp?.isUrgent === true;
    }).length;
  }, [clients]);
  
  const filterOptions = useMemo(() => {
    const statuses = new Set(currentBaseList.map(c => c['Статус сделки']).filter(Boolean));
    const warehouses = new Set(currentBaseList.map(c => c['Склад хранения']).filter(Boolean));
    return {
      statuses: Array.from(statuses),
      warehouses: Array.from(warehouses),
    };
  }, [currentBaseList]);
  
  const sortedClients = useMemo(() => {
    let clientsToFilter = [...currentBaseList];

    if (filters.debt) {
        clientsToFilter = clientsToFilter.filter(client => (client['Долг'] || 0) > 0);
    }
    if (filters.expiring && viewTab === 'active') {
        clientsToFilter = clientsToFilter.filter(client => {
            const exp = checkStorageExpiry(client['Окончание']);
            return exp?.isUrgent === true;
        });
    }
    if (filters.status !== 'all') {
      clientsToFilter = clientsToFilter.filter(c => c['Статус сделки'] === filters.status);
    }
    if (filters.warehouse !== 'all') {
      clientsToFilter = clientsToFilter.filter(c => c['Склад хранения'] === filters.warehouse);
    }
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        clientsToFilter = clientsToFilter.filter(client =>
            Object.values(client).some(value =>
                String(value).toLowerCase().includes(term)
            )
        );
    }
    
    if (sortConfig !== null) {
        clientsToFilter.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            
            const type = getFieldType(sortConfig.key);

            let compareA = valA, compareB = valB;

            if (type === 'date') {
                compareA = valA ? new Date(valA as string).getTime() : 0;
                compareB = valB ? new Date(valB as string).getTime() : 0;
            }

            if (compareA === undefined || compareA === null) return 1;
            if (compareB === undefined || compareB === null) return -1;
            
            if (compareA < compareB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (compareA > compareB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }

    return clientsToFilter;
  }, [currentBaseList, searchTerm, filters, sortConfig, viewTab]);

  // Grouping computation based on selected groupBy option
  const groupedData = useMemo<ClientGroup[]>(() => {
    if (groupBy === 'none') return [];

    const map = new Map<string, ClientGroup>();

    sortedClients.forEach(client => {
        let groupId = 'other';
        let sortKey = '999';
        let title = 'Прочие';
        let icon: React.ReactNode = <TireIcon className="w-4 h-4 text-gray-500" />;
        let badgeClass = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';

        if (groupBy === 'season') {
            const raw = String(client['Сезон'] || '').toLowerCase();
            const qr = String(client['Заказ - QR'] || '').toLowerCase();
            const model = String(client['Бренд_Модель'] || '').toLowerCase();
            const combined = `${raw} ${qr} ${model}`;

            if (combined.includes('зим') || combined.includes('winter') || combined.includes('ice') || combined.includes('snow') || combined.includes('шип') || combined.includes('stud')) {
                groupId = 'season_winter';
                sortKey = '1_winter';
                title = '❄️ Зимние шины';
                icon = <SnowflakeIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
                badgeClass = 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800';
            } else if (combined.includes('лет') || combined.includes('summer')) {
                groupId = 'season_summer';
                sortKey = '2_summer';
                title = '☀️ Летние шины';
                icon = <SunIcon className="w-4 h-4 text-amber-500" />;
                badgeClass = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
            } else if (combined.includes('всесезон') || combined.includes('all season') || combined.includes('at') || combined.includes('mt')) {
                groupId = 'season_allseason';
                sortKey = '3_allseason';
                title = '🍂 Всесезонные шины';
                icon = <TireIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
                badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
            } else {
                groupId = 'season_unknown';
                sortKey = '4_unknown';
                title = '⚪ Сезон не указан';
                icon = <TireIcon className="w-4 h-4 text-gray-400" />;
                badgeClass = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
            }
        } else if (groupBy === 'expiry') {
            const raw = client['Окончание'];
            const expiry = checkStorageExpiry(raw);
            if (expiry?.isExpired) {
                groupId = 'exp_0_expired';
                sortKey = '0_expired';
                title = '🚨 Срок хранения истёк (просрочено)';
                icon = <ExclamationTriangleIcon className="w-4 h-4 text-rose-600" />;
                badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
            } else if (expiry?.isUrgent) {
                groupId = 'exp_1_urgent';
                sortKey = '1_urgent';
                title = '⚠️ Истекает в течение 7 дней (срочно)';
                icon = <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" />;
                badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
            } else if (raw) {
                let d = new Date(raw);
                if (isNaN(d.getTime()) && typeof raw === 'string') {
                    const parts = raw.split(/[.-]/);
                    if (parts.length === 3) {
                        if (parts[0].length === 4) d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                        else d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    }
                }
                if (!isNaN(d.getTime())) {
                    const y = d.getFullYear();
                    const m = d.getMonth();
                    const monthName = RU_MONTHS[m] || 'Месяц';
                    const mPad = String(m + 1).padStart(2, '0');
                    groupId = `exp_${y}_${mPad}`;
                    sortKey = `2_${y}_${mPad}`;
                    title = `📅 Окончание: ${monthName} ${y}`;
                    icon = <CalendarDaysIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
                    badgeClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
                } else {
                    groupId = 'exp_none';
                    sortKey = '9_none';
                    title = '⏳ Без даты окончания';
                    icon = <CalendarDaysIcon className="w-4 h-4 text-gray-400" />;
                    badgeClass = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
                }
            } else {
                groupId = 'exp_none';
                sortKey = '9_none';
                title = '⏳ Без даты окончания';
                icon = <CalendarDaysIcon className="w-4 h-4 text-gray-400" />;
                badgeClass = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
            }
        } else if (groupBy === 'warehouse') {
            const wh = (client['Склад хранения'] || '').trim() || 'Склад не указан';
            groupId = `wh_${wh}`;
            sortKey = wh;
            title = `🏢 Склад: ${wh}`;
            icon = <WarehouseIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
            badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
        } else if (groupBy === 'status') {
            const st = (client['Статус сделки'] || '').trim() || 'Без статуса';
            groupId = `st_${st}`;
            sortKey = st;
            title = `🏷️ Статус: ${st}`;
            icon = <BookmarkIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />;
            badgeClass = 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800';
        } else if (groupBy === 'rims') {
            const hasRims = String(client['Наличие дисков'] || '').toLowerCase() === 'да' || String(client['Заказ - QR'] || '').toLowerCase().includes('с дисками');
            if (hasRims) {
                groupId = 'rims_yes';
                sortKey = '1_yes';
                title = '🛞 С дисками (в сборе)';
                icon = <DiscIcon className="w-4 h-4 text-blue-600" />;
                badgeClass = 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
            } else {
                groupId = 'rims_no';
                sortKey = '2_no';
                title = '⚪ Без дисков (только резина)';
                icon = <TireIcon className="w-4 h-4 text-gray-500" />;
                badgeClass = 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
            }
        }

        if (!map.has(groupId)) {
            map.set(groupId, {
                id: groupId,
                sortKey,
                title,
                icon,
                badgeClass,
                clients: [],
                totalTires: 0,
                totalDebt: 0
            });
        }

        const group = map.get(groupId)!;
        group.clients.push(client);
        group.totalTires += Number(client['Кол-во шин']) || 4;
        group.totalDebt += Number(client['Долг']) || 0;
    });

    const result = Array.from(map.values());
    result.sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'ru', { numeric: true }));
    return result;
  }, [sortedClients, groupBy]);

  useEffect(() => {
    const debtFilter = searchParams.get('filter') === 'debt';
    if(debtFilter) {
        setFilters(prev => ({...prev, debt: true}));
    }
    const expiringFilter = searchParams.get('filter') === 'expiring';
    if(expiringFilter) {
        setFilters(prev => ({...prev, expiring: true}));
    }
  }, [searchParams]);

  const handleFilterChange = (type: 'status' | 'warehouse', value: string) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const removeFilter = (type: keyof typeof filters) => {
    if (type === 'debt' || type === 'expiring') {
      setFilters(prev => ({...prev, [type]: false}));
      setSearchParams(params => {
        params.delete('filter');
        return params;
      });
    } else {
      setFilters(prev => ({ ...prev, [type]: 'all' }));
    }
  };

  const handleSortChange = (key: string) => {
      setSortConfig(prev => {
          if (prev && prev.key === key) {
              return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
          }
          const isDate = key.includes('Дата') || key.includes('Окончание') || key.includes('Начало');
          return { key, direction: isDate ? 'descending' : 'ascending' };
      });
  };

  const handleRowClick = (client: Client, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) return;
    navigate(`/clients/${client.id}`, { state: { client } });
  };
  
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleSaveView = () => {
    if (!newViewName) {
        showToast("Введите имя для нового представления", 'error');
        return;
    }
    const newView: SavedView = {
        id: `view_${Date.now()}`,
        name: newViewName,
        filters,
        sortConfig
    };
    onSaveViews([...savedViews, newView]);
    setNewViewName('');
    showToast(`Представление "${newViewName}" сохранено`, 'success');
  };

  const handleLoadView = (viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    if (view) {
        setFilters(view.filters);
        setSortConfig(view.sortConfig);
        showToast(`Загружено представление: ${view.name}`, 'success');
    }
  };

  const handleDeleteView = (viewId: string) => {
    onSaveViews(savedViews.filter(v => v.id !== viewId));
    showToast('Представление удалено', 'success');
  };

  const toggleGroup = (groupId: string) => {
      setCollapsedGroups(prev => ({
          ...prev,
          [groupId]: !prev[groupId]
      }));
  };

  const expandAllGroups = () => {
      setCollapsedGroups({});
  };

  const collapseAllGroups = () => {
      const all: Record<string, boolean> = {};
      groupedData.forEach(g => { all[g.id] = true; });
      setCollapsedGroups(all);
  };
  
  const isFiltersActive = filters.status !== 'all' || filters.warehouse !== 'all' || filters.debt || filters.expiring;

  // Check for duplicate IDs to warn user
  const hasDuplicates = useMemo(() => {
      const ids = clients.map(c => c.id);
      return new Set(ids).size !== ids.length;
  }, [clients]);

  const groupByLabels: Record<GroupByOption, string> = {
      none: 'Без группировки',
      season: 'По сезону шин',
      expiry: 'По окончанию хранения',
      warehouse: 'По складу',
      status: 'По статусу',
      rims: 'По наличию дисков'
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* COMPACT HEADER / FILTER BAR */}
      <Card className="!p-3 sm:!p-4">
        <div className="flex flex-col gap-3">
          {/* Active vs Inactive (Tires with Client) vs All Clients Switcher */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700/80 pb-2.5 overflow-x-auto gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewTab('active');
                    setSearchParams(p => { p.delete('tab'); return p; });
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                    viewTab === 'active'
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>📦 На складе</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${viewTab === 'active' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    {clients.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewTab('archive');
                    setSearchParams(p => { p.set('tab', 'archive'); return p; });
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                    viewTab === 'archive'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>🚗 Шины у клиента</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${viewTab === 'archive' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    {archive.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewTab('all');
                    setSearchParams(p => { p.set('tab', 'all'); return p; });
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                    viewTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>👥 Все клиенты</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${viewTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    {clients.length + archive.length}
                  </span>
                </button>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap hidden md:block">
               Клиентская база: <span className="font-bold text-gray-800 dark:text-gray-200">{clients.length + archive.length}</span> уникальных клиентов
            </div>
          </div>

          {/* Top Row: Search + Grouping + Actions */}
          <div className="flex gap-2 w-full flex-wrap sm:flex-nowrap items-center">
            <div className="relative flex-grow min-w-[200px]">
               <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <SearchIcon className="h-5 w-5"/>
               </div>
               <input 
                  type="text"
                  placeholder="Поиск по имени, авто, шинам, договору..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 pl-10 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-150 h-[42px] text-sm"
               />
            </div>

            {/* Interactive Grouping Control */}
            <div className="relative shrink-0">
               <div className="flex items-center h-[42px] px-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-2xs hover:border-gray-400 transition-colors">
                  <Squares2X2Icon className={`w-4 h-4 mr-2 shrink-0 ${groupBy !== 'none' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                  <select
                     value={groupBy}
                     onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
                     className="bg-transparent border-0 text-xs sm:text-sm font-medium focus:ring-0 cursor-pointer pr-4 py-1 dark:text-white"
                     title="Группировка списка клиентов"
                  >
                     <option value="none" className="dark:bg-gray-800">Без группировки</option>
                     <option value="season" className="dark:bg-gray-800">❄️/☀️ По сезону шин</option>
                     <option value="expiry" className="dark:bg-gray-800">📅 По окончанию хранения</option>
                     <option value="warehouse" className="dark:bg-gray-800">🏢 По складу</option>
                     <option value="status" className="dark:bg-gray-800">🏷️ По статусу</option>
                     <option value="rims" className="dark:bg-gray-800">🛞 По наличию дисков</option>
                  </select>
               </div>
            </div>
            
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center w-[42px] h-[42px] rounded-md border shrink-0 ${isFiltersActive ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'} focus:ring-2 focus:ring-primary-500 transition-all`}
                title="Фильтры и Сортировка"
            >
                <FilterIcon className="w-5 h-5"/>
            </button>

            {urgentCount > 0 && viewTab === 'active' && (
                <button 
                    type="button"
                    onClick={() => setFilters(prev => ({ ...prev, expiring: !prev.expiring }))}
                    className={`flex items-center justify-center gap-1.5 px-3 h-[42px] rounded-md border font-bold text-xs sm:text-sm transition-all whitespace-nowrap shadow-xs active:scale-95 shrink-0 ${
                        filters.expiring
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-400/50'
                            : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                    }`}
                    title="Показать только клиентов с окончанием хранения менее чем через 7 дней"
                >
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                    </span>
                    <span className="hidden sm:inline">Истекают</span> <span>≤ 7 дн. ({urgentCount})</span>
                </button>
            )}

            <button 
                onClick={() => setShowExportModal(true)}
                className="flex items-center justify-center gap-1.5 px-3 h-[42px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-primary-500 font-medium text-sm transition-all whitespace-nowrap shadow-sm active:scale-95"
                title="Экспорт списка клиентов в CSV (резервная копия)"
            >
                <ArrowDownTrayIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="hidden lg:inline">Экспорт CSV</span>
            </button>

            <button 
                onClick={() => setShowImportModal(true)}
                className="flex items-center justify-center gap-1.5 px-3 h-[42px] rounded-md border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 focus:ring-2 focus:ring-emerald-500 font-medium text-sm transition-all whitespace-nowrap shadow-sm active:scale-95"
                title="Импорт клиентов и заказов из Google Таблиц / Excel / CSV"
            >
                <ArrowUpTrayIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden lg:inline">Импорт</span>
            </button>
          </div>

          {/* Collapsible Filter Panel */}
          {showFilters && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-200">
               <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Сортировка</label>
                  <select value={sortConfig?.key || ''} onChange={e => handleSortChange(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                      <option value="Начало">По дате (новые)</option>
                      <option value="Имя клиента">По имени (А-Я)</option>
                      <option value="Окончание">По окончанию</option>
                      <option value="Долг">По долгу</option>
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Статус</label>
                  <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                      <option value="all">Все статусы</option>
                      {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Склад</label>
                   <select value={filters.warehouse} onChange={e => handleFilterChange('warehouse', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                      <option value="all">Все склады</option>
                      {filterOptions.warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                   </select>
               </div>
               <div className="flex items-end gap-2">
                   <div className="flex-grow">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Сохранить вид</label>
                        <input 
                            type="text" 
                            value={newViewName} 
                            onChange={(e) => setNewViewName(e.target.value)} 
                            placeholder="Название..." 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
                   </div>
                   <Button variant="outline" onClick={handleSaveView} className="h-[34px] !px-3" title="Сохранить текущие фильтры">
                        <BookmarkIcon className="h-4 w-4"/>
                   </Button>
               </div>
            </div>
          )}
          
          {/* Active Filters, Grouping & Saved Views Chips */}
          {(isFiltersActive || savedViews.length > 0 || groupBy !== 'none') && (
             <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {/* Active Grouping Chip */}
                {groupBy !== 'none' && (
                    <span className="inline-flex items-center gap-x-1.5 bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 text-xs font-semibold text-purple-800 dark:text-purple-200 rounded-full border border-purple-300 dark:border-purple-800 whitespace-nowrap">
                        <Squares2X2Icon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Группировка: {groupByLabels[groupBy]}</span>
                        <button
                            type="button"
                            onClick={() => setGroupBy('none')}
                            className="group relative -mr-0.5 h-3.5 w-3.5 rounded-full hover:bg-purple-200/60 dark:hover:bg-purple-500/30"
                            title="Сбросить группировку"
                        >
                            <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 stroke-purple-600/70 group-hover:stroke-purple-700 dark:stroke-purple-300">
                                <path d="M4 4l6 6m0-6l-6 6" />
                            </svg>
                        </button>
                    </span>
                )}

                {/* Active Filter Chips */}
                {filters.expiring && <FilterBadge text={`Истекают ≤ 7 дн. (${urgentCount})`} onRemove={() => removeFilter('expiring')} />}
                {filters.debt && <FilterBadge text="С долгом" onRemove={() => removeFilter('debt')} />}
                {filters.status !== 'all' && <FilterBadge text={filters.status} onRemove={() => removeFilter('status')} />}
                {filters.warehouse !== 'all' && <FilterBadge text={filters.warehouse} onRemove={() => removeFilter('warehouse')} />}
                
                {isFiltersActive && savedViews.length > 0 && <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 flex-shrink-0 mx-1"></div>}
                
                {/* Saved Views Chips */}
                {savedViews.map(view => (
                    <span key={view.id} className="inline-flex flex-shrink-0 items-center gap-x-1 bg-gray-100 pl-2.5 pr-1 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-full border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        <button onClick={() => handleLoadView(view.id)}>{view.name}</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }} className="p-0.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-50 text-gray-400 hover:text-red-500">
                            <XMarkIcon className="h-3 w-3"/>
                        </button>
                    </span>
                ))}
             </div>
          )}
        </div>
      </Card>
      
      {hasDuplicates && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-3 rounded-lg flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <span className="font-bold">Внимание:</span> Обнаружены дубликаты идентификаторов клиентов. Рекомендуется проверить данные.
              </div>
          </div>
      )}

      {/* Grouping Actions Toolbar (when grouping is active) */}
      {groupBy !== 'none' && groupedData.length > 0 && (
          <div className="flex items-center justify-between px-1">
             <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                 <span>Групп: <strong className="text-primary-600 dark:text-primary-400">{groupedData.length}</strong></span>
                 <span className="text-gray-400">•</span>
                 <span>Клиентов: <strong>{sortedClients.length}</strong></span>
             </div>
             <div className="flex items-center gap-2">
                 <button
                     type="button"
                     onClick={expandAllGroups}
                     className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors"
                 >
                     Развернуть все
                 </button>
                 <span className="text-gray-300 dark:text-gray-600">|</span>
                 <button
                     type="button"
                     onClick={collapseAllGroups}
                     className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                 >
                     Свернуть все
                 </button>
             </div>
          </div>
      )}

      {/* Main Client List / Groups */}
      {groupBy === 'none' ? (
          /* FLAT STANDARD LIST */
          <Card className="!p-0 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedClients.map((client, index) => (
                    <ClientRowItem
                        key={`${client.id}_${index}`}
                        client={client}
                        onClick={(e) => handleRowClick(client, e)}
                    />
                ))}
            </div>
            {sortedClients.length === 0 && (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                    <SearchIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Клиенты не найдены</h3>
                    <p className="mt-1 text-sm text-gray-500">Попробуйте изменить условия поиска или фильтры.</p>
                </div>
            )}
          </Card>
      ) : (
          /* GROUPED ACCORDION SECTIONS */
          <div className="space-y-4">
              {groupedData.map((group) => {
                  const isCollapsed = Boolean(collapsedGroups[group.id]);

                  return (
                      <div 
                          key={group.id} 
                          className="rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800 shadow-2xs overflow-hidden transition-all duration-200"
                      >
                          {/* Group Header Toggle */}
                          <button
                              type="button"
                              onClick={() => toggleGroup(group.id)}
                              className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-gray-50/70 dark:bg-gray-800/90 hover:bg-gray-100/70 dark:hover:bg-gray-700/50 transition-colors text-left border-b border-gray-200/60 dark:border-gray-700/60"
                          >
                              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap min-w-0">
                                  <div className="p-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-2xs">
                                      {group.icon}
                                  </div>
                                  <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                                      {group.title}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-800 dark:bg-primary-950/70 dark:text-primary-200 border border-primary-200 dark:border-primary-800">
                                      {group.clients.length} {group.clients.length === 1 ? 'клиент' : group.clients.length < 5 ? 'клиента' : 'клиентов'}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200/70 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                      {group.totalTires} шин
                                  </span>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                  {group.totalDebt > 0 && (
                                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 whitespace-nowrap">
                                          Долг: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(group.totalDebt)}
                                      </span>
                                  )}
                                  <div className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                                      <ChevronDownIcon className="w-5 h-5" />
                                  </div>
                              </div>
                          </button>

                          {/* Group Body */}
                          {!isCollapsed ? (
                              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                  {group.clients.map((client, cIdx) => (
                                      <ClientRowItem
                                          key={`${client.id}_${cIdx}`}
                                          client={client}
                                          onClick={(e) => handleRowClick(client, e)}
                                      />
                                  ))}
                              </div>
                          ) : (
                              <div className="py-2.5 px-4 text-xs text-gray-400 dark:text-gray-500 italic bg-gray-50/30 dark:bg-gray-800/30 flex items-center justify-between">
                                  <span>Свернуто ({group.clients.length} записей)</span>
                                  <span className="text-primary-600 dark:text-primary-400 font-semibold cursor-pointer hover:underline" onClick={() => toggleGroup(group.id)}>Развернуть</span>
                              </div>
                          )}
                      </div>
                  );
              })}

              {groupedData.length === 0 && (
                  <Card className="text-center py-16 text-gray-500 dark:text-gray-400 shadow-sm">
                      <SearchIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Клиенты не найдены</h3>
                      <p className="mt-1 text-sm text-gray-500">Попробуйте изменить условия поиска или фильтры.</p>
                  </Card>
              )}
          </div>
      )}

      {/* CSV Export & Backup Modal */}
      <ExportClientsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        allClients={clients}
        filteredClients={sortedClients}
        headers={headers}
        isFilteredActive={Boolean(isFiltersActive || searchTerm.trim())}
        onSuccess={(result) => {
          showToast(`Экспортировано ${result.rowCount} клиентов в файл "${result.filename}"`, 'success');
        }}
      />

      {/* Google Sheets / Excel / CSV Import Modal */}
      <ImportClientsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={(_count, message) => {
          showToast(message, 'success');
          refreshData();
        }}
      />
    </div>
  );
};
