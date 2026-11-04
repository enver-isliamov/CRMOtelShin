import React, { useState, useEffect, useRef } from 'react';
import { syncManager, SyncStatus } from '../../services/syncManager';

export const NetworkStatusIndicator: React.FC<{ onManualSync?: () => void }> = ({ onManualSync }) => {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    lastError: null,
    failedActions: [],
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await syncManager.retrySync();
      if (onManualSync) onManualSync();
    } finally {
      setIsRetrying(false);
    }
  };

  const formatLastSync = (ts: number | null): string => {
    if (!ts) return 'Ещё не выполнялась';
    const d = new Date(ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Indicator Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all select-none shadow-2xs ${
          !status.isOnline
            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300 dark:border-rose-800'
            : status.isSyncing
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-300 dark:border-blue-800 animate-pulse'
            : status.pendingCount > 0
            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border-amber-300 dark:border-amber-800'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/70'
        }`}
        title="Статус подключения и синхронизации с базой"
      >
        {/* Status Dot / Icon */}
        {!status.isOnline ? (
          <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-300 dark:ring-rose-800"></span>
        ) : status.isSyncing ? (
          <svg className="w-3.5 h-3.5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        ) : status.pendingCount > 0 ? (
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        )}

        {/* Text Label */}
        <span className="hidden sm:inline">
          {!status.isOnline
            ? 'Офлайн'
            : status.isSyncing
            ? 'Синхронизация...'
            : status.pendingCount > 0
            ? `Очередь (${status.pendingCount})`
            : 'В сети'}
        </span>
        <span className="sm:hidden font-mono">
          {!status.isOnline ? 'Офлайн' : status.pendingCount > 0 ? `+${status.pendingCount}` : 'Онлайн'}
        </span>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status.isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              Статус соединения
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              status.isOnline 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' 
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
            }`}>
              {status.isOnline ? 'Интернет есть' : 'Нет сети'}
            </span>
          </div>

          <div className="py-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex justify-between items-center">
              <span>Хранилище данных:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                IndexedDB (Офлайн-кэш)
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span>Неотправленных изменений:</span>
              <span className={`font-bold ${status.pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                {status.pendingCount}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span>Последняя синхронизация:</span>
              <span className="text-gray-500 dark:text-gray-400 font-mono">
                {formatLastSync(status.lastSyncTime)}
              </span>
            </div>

            {status.lastError && (
              <div className="p-2 mt-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-[11px]">
                <span className="font-bold block">Последняя ошибка:</span>
                <span className="truncate block">{status.lastError}</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying || status.isSyncing}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${isRetrying || status.isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isRetrying ? 'Отправка...' : 'Синхронизировать сейчас (Retry)'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
