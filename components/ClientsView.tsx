
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Client, MessageTemplate, SavedView, formatDateForDisplay } from '../types';
import { api } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';

// --- ICONS ---
const SearchIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
const SyncIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18-3.183l-3.182-3.182a8.25 8.25 0 00-11.664 0l-3.18 3.185" /></svg>;
const BookmarkIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>;
const XMarkIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const FilterIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>;

const getFieldType = (fieldName: string) => {
    const name = fieldName.toLowerCase();
    if (name.includes('дата') || name.includes('начало') || name.includes('окончание') || name.includes('напомнить')) return 'date';
    if (name.includes('цена') || name.includes('кол-во') || name.includes('сумма') || name.includes('долг') || name.includes('срок')) return 'number';
    if (name.includes('телефон')) return 'tel';
    return 'text';
}

const FilterBadge: React.FC<{text: string; onRemove: () => void}> = ({ text, onRemove }) => (
  <span className="inline-flex items-center gap-x-1.5 bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-800/30 dark:text-blue-200 rounded-full whitespace-nowrap">
    {text}
    <button
        type="button"
        onClick={onRemove}
        className="group relative -mr-0.5 h-3.5 w-3.5 rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-500/30"
    >
        <span className="sr-only">Remove</span>
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 stroke-blue-600/50 group-hover:stroke-blue-600/75 dark:stroke-blue-400/50 dark:group-hover:stroke-blue-400">
            <path d="M4 4l6 6m0-6l-6 6" />
        </svg>
    </button>
  </span>
);

export const ClientsView: React.FC<{
    clients: Client[];
    headers: string[];
    templates: MessageTemplate[];
    savedViews: SavedView[];
    onSaveViews: (views: SavedView[]) => void;
    refreshData: () => Promise<void>;
}> = ({ clients, savedViews, onSaveViews, refreshData }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    warehouse: 'all',
    debt: searchParams.get('filter') === 'debt',
  });
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'ascending' | 'descending' } | null>({ key: 'Начало', direction: 'descending' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const filterOptions = useMemo(() => {
    const statuses = new Set(clients.map(c => c['Статус сделки']).filter(Boolean));
    const warehouses = new Set(clients.map(c => c['Склад хранения']).filter(Boolean));
    return {
      statuses: Array.from(statuses),
      warehouses: Array.from(warehouses),
    };
  }, [clients]);
  
  const sortedClients = useMemo(() => {
    let clientsToFilter = [...clients];

    if (filters.debt) {
        clientsToFilter = clientsToFilter.filter(client => (client['Долг'] || 0) > 0);
    }
    if (filters.status !== 'all') {
      clientsToFilter = clientsToFilter.filter(c => c['Статус сделки'] === filters.status);
    }
    if (filters.warehouse !== 'all') {
      clientsToFilter = clientsToFilter.filter(c => c['Склад хранения'] === filters.warehouse);
    }
    
    if (searchTerm) {
        clientsToFilter = clientsToFilter.filter(client =>
            Object.values(client).some(value =>
                String(value).toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [clients, searchTerm, filters, sortConfig]);

  useEffect(() => {
    const debtFilter = searchParams.get('filter') === 'debt';
    if(debtFilter) {
        setFilters(prev => ({...prev, debt: true}));
    }
  }, [searchParams]);

  const handleFilterChange = (type: 'status' | 'warehouse', value: string) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const removeFilter = (type: keyof typeof filters) => {
    if (type === 'debt') {
      setFilters(prev => ({...prev, debt: false}));
      setSearchParams(params => {
        params.delete('filter');
        return params;
      });
    } else {
      setFilters(prev => ({ ...prev, [type]: 'all' }));
    }
  }

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
    // Pass the entire client object in state to handle duplicate IDs in the sheet
    navigate(`/clients/${client.id}`, { state: { client } });
  };
  
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refreshData();
      showToast('Данные синхронизированы', 'success');
    } catch(e: any) {
      showToast(`Ошибка синхронизации: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }

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
  
  const isFiltersActive = filters.status !== 'all' || filters.warehouse !== 'all' || filters.debt;

  // Check for duplicate IDs to warn user
  const hasDuplicates = useMemo(() => {
      const ids = clients.map(c => c.id);
      return new Set(ids).size !== ids.length;
  }, [clients]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* COMPACT HEADER / FILTER BAR */}
      <Card className="!p-3 sm:!p-4">
        <div className="flex flex-col gap-3">
          {/* Top Row: Search + Actions */}
          <div className="flex gap-2 w-full">
            <div className="relative flex-grow">
               <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <SearchIcon className="h-5 w-5"/>
               </div>
               <input 
                  type="text"
                  placeholder="Поиск..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 pl-10 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-150 h-[42px]"
               />
            </div>
            
            <button 
                onClick={handleSync} 
                disabled={isSyncing}
                className="flex items-center justify-center w-[42px] h-[42px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-primary-500 transition-colors"
                title="Синхронизировать"
            >
                <SyncIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center w-[42px] h-[42px] rounded-md border ${isFiltersActive ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'} focus:ring-2 focus:ring-primary-500 transition-all`}
                title="Фильтры и Сортировка"
            >
                <FilterIcon className="w-5 h-5"/>
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
          
          {/* Active Filters & Saved Views Chips (Horizontal Scroll) */}
          {(isFiltersActive || savedViews.length > 0) && (
             <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {/* Active Filter Chips */}
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
                  <span className="font-bold">Внимание:</span> Обнаружены клиенты с одинаковыми ID в таблице. Возможны ошибки при отображении деталей. Рекомендуется удалить дубликаты в Google Таблице.
              </div>
          </div>
      )}

      {/* Client List */}
      <Card className="!p-0 overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedClients.map((client, index) => (
                <div 
                    key={`${client.id}_${index}`} 
                    onClick={(e) => handleRowClick(client, e)} 
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                             <span className="font-semibold text-gray-900 dark:text-white text-base truncate">
                                {client['Имя клиента']}
                             </span>
                             {(client['Долг'] || 0) > 0 && (
                                <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm ring-1 ring-red-400/50" title="Есть задолженность"></span>
                             )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                             <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {client['Номер Авто'] || 'Нет авто'}
                             </span>
                             {client['Телефон'] && (
                                <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="whitespace-nowrap">{client['Телефон']}</span>
                                </>
                             )}
                        </div>
                    </div>

                    <div className="text-right flex flex-col gap-1 flex-shrink-0">
                         <span className="text-sm text-gray-600 dark:text-gray-300">
                             {formatDateForDisplay(client['Окончание'])}
                         </span>
                         <span className={`font-bold text-sm ${
                             (client['Долг'] || 0) > 0 
                             ? 'text-red-600 dark:text-red-400' 
                             : 'text-gray-900 dark:text-white'
                         }`}>
                             {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(client['Долг'] || 0)}
                         </span>
                    </div>
                </div>
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
    </div>
  );
};
