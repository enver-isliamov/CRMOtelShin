import React, { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsType, MessageTemplate, Client, AppLog, Master } from '../types';
import { api, getClientHeaders } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { VisualEditor } from './ui/VisualEditor';
import { ToastContainer } from './ui/Toast';
import { ThemeSwitcher } from './ui/ThemeSwitcher';
import { CRM_CODE, ROUTER_CODE, BOT_CODE } from '../data/gas-scripts';
import { offlineStorage } from '../services/offlineStorage';
import { syncManager } from '../services/syncManager';
import { testSupabaseConnection, supabaseService } from '../services/supabaseClient';

// --- Icons ---
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>;
const ChevronUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>;
const CopyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>;
const ServerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const CloudIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>;
const ArrowPathIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18-3.183l-3.182-3.182a8.25 8.25 0 00-11.664 0l-3.18 3.185" /></svg>;
const BotIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h.01M15 9h.01M9 15h6" /></svg>;

const TabButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode, icon: React.ReactNode }> = ({ active, onClick, children, icon }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-200 focus:outline-none whitespace-nowrap ${
            active
            ? 'border-primary-500 text-primary-600 dark:text-primary-300'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
    >
        {icon}
        {children}
    </button>
);

const CodeViewer: React.FC<{ code: string; title: string; onCopy: (c: string) => void }> = ({ code, title, onCopy }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="w-full max-w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-[#1e1e1e] shadow-sm overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 gap-2 sm:gap-0">
                <span className="font-mono text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
                    {title}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                    <button 
                        onClick={() => onCopy(code)} 
                        className="flex items-center gap-1 text-xs bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 px-2 py-1.5 rounded text-gray-700 dark:text-gray-200 transition-colors"
                        title="Копировать код"
                    >
                        <CopyIcon />
                        <span className="inline">Копировать</span>
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1 text-xs bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-1.5 rounded transition-colors font-medium"
                    >
                         {isExpanded ? <ChevronUpIcon/> : <ChevronDownIcon/>}
                         <span>{isExpanded ? 'Свернуть' : 'Код'}</span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="w-full bg-[#1e1e1e] border-t border-gray-700">
                    <pre className="p-3 text-[10px] sm:text-xs leading-relaxed text-gray-300 font-mono w-full selection:bg-gray-600 whitespace-pre-wrap break-all">
                        <code>{code.trim()}</code>
                    </pre>
                </div>
            )}
        </div>
    );
};

const GeneralSettingsTab: React.FC<{ 
    settings: SettingsType, 
    onChange: (field: keyof SettingsType, value: any) => void,
    showToast: (message: string, type: 'success' | 'error') => void;
}> = ({ settings, onChange, showToast }) => {
    const [isTesting, setIsTesting] = useState(false);
    const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
    const [isCopyingSql, setIsCopyingSql] = useState(false);
    const [isManualSyncing, setIsManualSyncing] = useState(false);
    const [showSupabaseGuide, setShowSupabaseGuide] = useState(true);
    const [syncQueueCount, setSyncQueueCount] = useState(0);

    useEffect(() => {
        offlineStorage.getPendingActions().then(items => setSyncQueueCount(items.length)).catch(() => {});
        const unsub = syncManager.subscribe(status => {
            setSyncQueueCount(status.pendingCount);
        });
        return unsub;
    }, []);

    const handleCopySql = async () => {
        setIsCopyingSql(true);
        try {
            const res = await fetch('/schema.sql');
            if (!res.ok) throw new Error('Не удалось загрузить schema.sql');
            const sqlText = await res.text();
            await navigator.clipboard.writeText(sqlText);
            showToast('SQL-схема скопирована в буфер обмена! Вставьте её в SQL Editor в Supabase.', 'success');
        } catch (e: any) {
            showToast(`Ошибка копирования: ${e.message}`, 'error');
        } finally {
            setIsCopyingSql(false);
        }
    };

    const handleForceSync = async () => {
        setIsManualSyncing(true);
        try {
            const res = await syncManager.retrySync();
            if (res.syncedCount > 0) {
                showToast(`Успешно отправлено ${res.syncedCount} отложенных действий!`, 'success');
            } else if (res.remainingCount === 0) {
                showToast('Все изменения уже синхронизированы с базой.', 'success');
            } else {
                showToast(`Не удалось синхронизировать ${res.remainingCount} действий. Проверьте интернет и POSTGRES_URL.`, 'error');
            }
        } finally {
            setIsManualSyncing(false);
        }
    };

    const [isTestingSupabaseDirect, setIsTestingSupabaseDirect] = useState(false);
    const [isImportingDirect, setIsImportingDirect] = useState(false);

    const handleTestSupabaseDirect = async () => {
        if (!settings.supabaseUrl || !settings.supabaseKey) {
            showToast('Укажите Project URL и API Key для проверки подключения', 'error');
            return;
        }
        setIsTestingSupabaseDirect(true);
        try {
            const result = await testSupabaseConnection(settings.supabaseUrl, settings.supabaseKey);
            if (result.success) {
                showToast(result.message, 'success');
            } else {
                showToast(result.message, 'error');
            }
        } finally {
            setIsTestingSupabaseDirect(false);
        }
    };

    const handleImportToSupabaseDirect = async () => {
        if (!settings.supabaseUrl || !settings.supabaseKey) {
            showToast('Сначала заполните Project URL и API Key и сохраните их', 'error');
            return;
        }
        setIsImportingDirect(true);
        try {
            const res = await supabaseService.importLocalData();
            if (res.success) {
                showToast(res.message, 'success');
            } else {
                showToast(res.message, 'error');
            }
        } catch (e: any) {
            showToast(`Ошибка загрузки: ${e?.message || e}`, 'error');
        } finally {
            setIsImportingDirect(false);
        }
    };

    const handleTestConnection = async () => {
        if (settings.apiMode === 'VERCEL') {
             setIsTesting(true);
             const controller = new AbortController();
             const timeoutId = setTimeout(() => controller.abort(), 30000);

             try {
                 const res = await fetch('/api/crm', { 
                     method: 'POST', 
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ action: 'testconnection' }),
                     signal: controller.signal
                 });
                 clearTimeout(timeoutId);
                 
                 if (!res.ok) {
                     if (res.status === 404) throw new Error("API еще не развернут. Дождитесь окончания сборки Vercel.");
                     const text = await res.text();
                     throw new Error(`Ошибка сервера (${res.status}): ${text}`);
                 }

                 const result = await res.json();
                 if (result.status === 'success') {
                     showToast(`Vercel OK: ${result.message}`, 'success');
                 } else {
                     throw new Error(result.message);
                 }
             } catch(e: any) {
                 if (e.name === 'AbortError') {
                     showToast('Тайм-аут: Сервер долго отвечает (Cold Start). Попробуйте еще раз через 10 секунд.', 'error');
                 } else {
                     showToast(`Ошибка Vercel: ${e.message}`, 'error');
                 }
             } finally {
                 setIsTesting(false);
             }
             return;
        }

        if (!settings.googleSheetId) {
            showToast('Сначала вставьте URL скрипта', 'error');
            return;
        }
        setIsTesting(true);
        try {
            const result = await api.testConnection(settings.googleSheetId);
            if (result.status === 'success') {
                showToast(`Google OK! Версия: ${result.version}.`, 'success');
            } else {
                throw new Error(result.message || 'Неизвестная ошибка от скрипта.');
            }
        } catch (e: any) {
            showToast(`Ошибка подключения: ${e.message}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const handleUpdateSchema = async () => {
        setIsTesting(true);
        try {
            const res = await fetch('/api/setup');
            const result = await res.json();
            if (result.status === 'success') {
                showToast(result.message, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            showToast(`Ошибка обновления схемы: ${e.message}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const handleUpdateWebhook = async () => {
        setIsUpdatingWebhook(true);
        try {
            const res = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_bot_webhook' })
            });
            const result = await res.json();
            if (result.status === 'success') {
                showToast(result.message, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            showToast(`Ошибка Webhook: ${e.message}`, 'error');
        } finally {
            setIsUpdatingWebhook(false);
        }
    };

    const handleCheckWebhook = async () => {
        setIsUpdatingWebhook(true);
        try {
            const res = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_webhook_info' })
            });
            const result = await res.json();
            if (result.status === 'success' && result.info) {
                const info = result.info;
                const msg = `URL: ${info.url}\nPending: ${info.pending_update_count}\nLast Error: ${info.last_error_message || 'None'}`;
                alert(msg);
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            showToast(`Ошибка проверки: ${e.message}`, 'error');
        } finally {
            setIsUpdatingWebhook(false);
        }
    };

    return (
        <div className="space-y-6">
            
            {/* THEME SELECTION SECTION */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Тема оформления</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Переключение между светлой, тёмной и системной темой интерфейса
                        </p>
                    </div>
                    <div className="self-start sm:self-auto">
                        <ThemeSwitcher />
                    </div>
                </div>
            </div>

            {/* DATABASE STATUS & OFFLINE SYNC */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-200/90 dark:border-gray-700/80 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                            <ServerIcon />
                        </div>
                        <div>
                            <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">База данных и Офлайн-синхронизация</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Подключение к Supabase (PostgreSQL) + локальный кэш IndexedDB и PWA Service Worker
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                            syncQueueCount > 0
                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${syncQueueCount > 0 ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></span>
                            <span>{syncQueueCount > 0 ? `В очереди: ${syncQueueCount}` : 'Синхронизировано'}</span>
                        </span>
                    </div>
                </div>

                {/* Status metrics grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70 text-xs">
                    <div>
                        <span className="text-gray-400 uppercase text-[10px] font-bold tracking-wider block">Офлайн-база</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">IndexedDB (TireCRM_Offline_DB)</span>
                    </div>
                    <div>
                        <span className="text-gray-400 uppercase text-[10px] font-bold tracking-wider block">Service Worker</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">PWA Активен (Кэш v3)</span>
                    </div>
                    <div>
                        <span className="text-gray-400 uppercase text-[10px] font-bold tracking-wider block">Очередь отложенных действий</span>
                        <span className={`font-semibold ${syncQueueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200'}`}>
                            {syncQueueCount} {syncQueueCount === 1 ? 'действие' : 'действий'}
                        </span>
                    </div>
                </div>

                {/* Quick actions row */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button 
                        variant="primary" 
                        onClick={handleForceSync} 
                        disabled={isManualSyncing}
                        className="text-xs !py-2 !px-3 font-bold"
                    >
                        {isManualSyncing ? 'Отправка...' : 'Синхронизировать сейчас (Retry)'}
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={handleTestConnection} 
                        disabled={isTesting}
                        className="text-xs !py-2 !px-3"
                    >
                        {isTesting ? 'Проверка...' : 'Проверить состояние базы'}
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={handleCopySql} 
                        disabled={isCopyingSql}
                        className="text-xs !py-2 !px-3 font-bold !text-indigo-600 dark:!text-indigo-400 !border-indigo-300 dark:!border-indigo-800"
                    >
                        {isCopyingSql ? 'Копирование...' : '📋 Скопировать SQL-схему для Supabase'}
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={handleUpdateSchema} 
                        disabled={isTesting}
                        className="text-xs !py-2 !px-3"
                    >
                        {isTesting ? 'Обновление...' : 'Обновить схему SQL'}
                    </Button>
                </div>

                {/* DIRECT SUPABASE INPUTS (METHOD 2: URL + API KEY WITHOUT PASSWORD) */}
                <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-extrabold text-[10px] uppercase tracking-wider">
                                Способ 2 (Без пароля)
                            </span>
                            <h5 className="font-bold text-sm text-gray-900 dark:text-white">
                                Подключение через Supabase URL и API Key
                            </h5>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Пароль от БД не нужен!
                        </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300">
                        Скопируйте эти два значения из Supabase (<b>Project Settings ➔ API</b>) и вставьте их сюда. Они сохраняются в памяти CRM и работают сразу:
                    </p>

                    <div className="space-y-3">
                        <Input 
                            label="Project URL" 
                            value={settings.supabaseUrl || ''} 
                            onChange={e => onChange('supabaseUrl', e.target.value)}
                            placeholder="https://xxxxxxxxxxxxxxxx.supabase.co"
                            helperText="Раздел Project Settings ➔ API ➔ Project URL"
                        />
                        <Input 
                            label="Project API Key (anon / public или service_role)" 
                            type="password"
                            value={settings.supabaseKey || ''} 
                            onChange={e => onChange('supabaseKey', e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            helperText="Раздел Project Settings ➔ API ➔ Project API keys (anon public)"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                            variant="primary"
                            onClick={handleTestSupabaseDirect}
                            disabled={isTestingSupabaseDirect}
                            className="text-xs !py-2 !px-3 font-bold !bg-indigo-600 hover:!bg-indigo-700"
                        >
                            {isTestingSupabaseDirect ? 'Проверка...' : '⚡️ Проверить подключение (Способ 2)'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleImportToSupabaseDirect}
                            disabled={isImportingDirect}
                            className="text-xs !py-2 !px-3 font-bold !text-emerald-700 dark:!text-emerald-300 !border-emerald-300 dark:!border-emerald-800"
                        >
                            {isImportingDirect ? 'Перенос...' : '🚀 Загрузить 27 клиентов в Supabase в 1 клик'}
                        </Button>
                    </div>
                </div>

                {/* STEP-BY-STEP SUPABASE VISUAL GUIDE */}
                <div className="mt-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 via-white to-gray-50/80 dark:from-indigo-950/20 dark:via-gray-900 dark:to-gray-900/60 p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">⚡️</span>
                            <h5 className="font-bold text-sm text-gray-900 dark:text-white">
                                Понятная инструкция: как подключить базу в Supabase
                            </h5>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSupabaseGuide(!showSupabaseGuide)}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            {showSupabaseGuide ? 'Свернуть' : 'Развернуть инструкцию'}
                        </button>
                    </div>

                    {showSupabaseGuide && (
                        <div className="space-y-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300 pt-1">
                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1">
                                <div className="font-bold text-indigo-600 dark:text-indigo-400">Шаг 1. Откройте проект в Supabase</div>
                                <p className="text-gray-600 dark:text-gray-300">
                                    Перейдите на <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold underline">supabase.com/dashboard</a>. Нажмите <b>New Project</b> (или выберите существующий). Придумайте пароль базы данных (Database Password) и обязательно сохраните его.
                                </p>
                            </div>

                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                                <div className="font-bold text-indigo-600 dark:text-indigo-400">Шаг 2. Запустите SQL-схему (создание таблиц)</div>
                                <p className="text-gray-600 dark:text-gray-300">
                                    1. В левой колонке Supabase нажмите на иконку <b>SQL Editor</b> (значок терминала <code>&gt;_</code>).<br/>
                                    2. Нажмите зелёную кнопку <b>+ New query</b> вверху.<br/>
                                    3. Нажмите кнопку ниже, чтобы скопировать готовую SQL-схему, и вставьте её (Ctrl+V) в поле ввода Supabase:
                                </p>
                                <button
                                    type="button"
                                    onClick={handleCopySql}
                                    disabled={isCopyingSql}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
                                >
                                    📋 Скопировать готовую SQL-схему в буфер
                                </button>
                                <p className="text-gray-500 text-[11px]">
                                    4. Нажмите кнопку <b>Run</b> в правом нижнем углу Supabase (или <code>Ctrl + Enter</code>). Таблицы <code>clients</code>, <code>storage_orders</code>, <code>masters</code> и индексы будут созданы.
                                </p>
                            </div>

                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1.5">
                                <div className="font-bold text-indigo-600 dark:text-indigo-400">Шаг 3. Скопируйте строку подключения (URI)</div>
                                <p className="text-gray-600 dark:text-gray-300">
                                    1. В левом меню в самом низу нажмите <b>Project Settings (шестерёнка)</b>.<br/>
                                    2. Перейдите в пункт <b>Database</b>.<br/>
                                    3. Прокрутите страницу вниз до блока <b>Connection string</b> ➔ выберите вкладку <b>URI</b>.<br/>
                                    4. Скопируйте строку, например:<br/>
                                    <code className="p-1 rounded bg-gray-100 dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 font-mono block mt-1 select-all break-all text-[11px]">
                                        postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres
                                    </code>
                                    5. Замените <code>[YOUR-PASSWORD]</code> на ваш реальный пароль от базы данных (без скобок <code>[ ]</code>).
                                </p>
                            </div>

                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1">
                                <div className="font-bold text-indigo-600 dark:text-indigo-400">Шаг 4. Подключение к сайту в Vercel</div>
                                <p className="text-gray-600 dark:text-gray-300">
                                    В панели вашего проекта на Vercel откройте <b>Settings ➔ Environment Variables</b> ➔ добавьте переменную <code>POSTGRES_URL</code> и вставьте туда вашу готовую строку. Нажмите кнопку <b>«Проверить состояние базы»</b> выше, чтобы убедиться в подключении.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Время отправки уведомлений</h4>
                        <p className="text-xs text-gray-500 mb-3">
                            Настройка времени автоматической проверки сроков хранения.
                            <br/>
                            <span className="opacity-70">Формат Cron: <code>Минуты Часы * * *</code> (UTC). Например: <code>5 11 * * *</code> = 11:05 UTC.</span>
                        </p>
                        <Input 
                            label="Cron Expression" 
                            value={settings.cronTime || '5 11 * * *'} 
                            onChange={e => onChange('cronTime', e.target.value)}
                            placeholder="5 11 * * *"
                        />
                    </div>

                    {/* WEBHOOK SETUP SECTION (6.5) */}
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                        <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2 mb-2">
                            <BotIcon /> Настройка Telegram Webhook
                        </h4>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-4">
                            Нажмите кнопку ниже, чтобы переключить бота на новый эндпоинт Vercel (<code>/api/bot</code>). 
                            Бот перестанет работать через Google Script и начнет использовать Postgres.
                        </p>
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleUpdateWebhook} 
                                disabled={isUpdatingWebhook}
                                className="!bg-indigo-600 hover:!bg-indigo-700 !text-white text-sm"
                            >
                                {isUpdatingWebhook ? 'Привязка...' : 'Привязать бота к Vercel'}
                            </Button>
                            <Button 
                                onClick={handleCheckWebhook} 
                                disabled={isUpdatingWebhook}
                                variant="outline"
                                className="text-sm"
                            >
                                Проверить статус
                            </Button>
                        </div>
                    </div>

            <hr className="dark:border-gray-700"/>

            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <b>Токен Telegram бота</b> задаётся в переменных окружения (<code>TELEGRAM_BOT_TOKEN</code>).
                </p>
            </div>
            <Input 
                label="Chat ID Администраторов" 
                value={settings.adminIds} 
                onChange={e => onChange('adminIds', e.target.value)}
                helperText="ID чатов для админов, через запятую."
            />
            <Input 
                label="Chat ID Менеджеров" 
                value={settings.managerIds} 
                onChange={e => onChange('managerIds', e.target.value)}
                helperText="ID чатов для менеджеров, через запятую."
            />
        </div>
    );
};

const TemplatesTab: React.FC<{ 
    templates: MessageTemplate[]; 
    setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
    showToast: (message: string, type: 'success' | 'error') => void;
}> = ({ templates, setTemplates, showToast }) => {
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [originalName, setOriginalName] = useState<string | null>(null);
    const [formData, setFormData] = useState<MessageTemplate>({ 'Название шаблона': '', 'Содержимое (HTML)': '' });
    const [isSaving, setIsSaving] = useState(false);

    const placeholders = getClientHeaders().filter(h => h !== 'id').map(h => `{{${h}}}`);

    const handleEdit = (template: MessageTemplate) => {
        setOriginalName(template['Название шаблона']);
        setFormData(template);
        setIsFormOpen(true);
    };

    const handleAddNew = () => {
        setOriginalName(null);
        setFormData({ 'Название шаблона': '', 'Содержимое (HTML)': '<p>Текст сообщения...</p>' });
        setIsFormOpen(true);
    };

    const handleCancel = () => {
        setIsFormOpen(false);
        setOriginalName(null);
    };

    const handleSave = async () => {
        if (!formData['Название шаблона']) {
            showToast('Введите название шаблона', 'error');
            return;
        }
        setIsSaving(true);
        try {
            if (originalName && originalName !== formData['Название шаблона']) {
                await api.deleteTemplate(originalName);
                await api.addTemplate(formData);
                setTemplates(prev => {
                    const filtered = prev.filter(t => t['Название шаблона'] !== originalName);
                    return [...filtered, formData];
                });
                showToast('Шаблон переименован и сохранен', 'success');
            } 
            else if (originalName) {
                await api.updateTemplate(formData);
                setTemplates(prev => prev.map(t => t['Название шаблона'] === originalName ? formData : t));
                showToast('Шаблон обновлен', 'success');
            }
            else {
                if (templates.some(t => t['Название шаблона'] === formData['Название шаблона'])) {
                    throw new Error('Шаблон с таким именем уже существует');
                }
                await api.addTemplate(formData);
                setTemplates(prev => [...prev, formData]);
                showToast('Шаблон создан', 'success');
            }
            setIsFormOpen(false);
        } catch (e: any) {
            showToast(`Ошибка сохранения: ${e.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Вы уверены, что хотите удалить шаблон "${name}"?`)) {
            try {
                await api.deleteTemplate(name);
                setTemplates(prev => prev.filter(t => t['Название шаблона'] !== name));
                showToast('Шаблон удален', 'success');
                if (isFormOpen && originalName === name) {
                    setIsFormOpen(false);
                }
            } catch (e: any) {
                showToast(`Ошибка удаления: ${e.message}`, 'error');
            }
        }
    };

    return (
        <div className="space-y-4">
            {!isFormOpen && (
                <>
                    {templates.length > 0 ? (
                        <div className="space-y-2">
                            {templates.map((template) => (
                                <div 
                                    key={template['Название шаблона']}
                                    onClick={() => handleEdit(template)}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:border-primary-500 hover:shadow-sm transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{template['Название шаблона']}</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={(e) => handleDelete(template['Название шаблона'], e)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center py-8 text-gray-500">Шаблоны не созданы.</p>
                    )}

                    <button
                        type="button"
                        onClick={handleAddNew}
                        className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-all flex items-center justify-center gap-2 font-medium bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        Добавить шаблон
                    </button>
                </>
            )}

            {isFormOpen && (
                <div className="transition-all duration-300 animate-in fade-in slide-in-from-top-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-lg ring-1 ring-black/5">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                            {originalName ? "Редактирование шаблона" : "Новый шаблон"}
                        </span>
                        <button type="button" onClick={handleCancel} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline">
                            Отменить
                        </button>
                    </div>

                    <div className="space-y-4">
                        <Input
                            label="Название шаблона"
                            value={formData['Название шаблона']}
                            onChange={e => setFormData({ ...formData, 'Название шаблона': e.target.value })}
                            placeholder="Например: Напоминание о долге"
                        />
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Текст сообщения</label>
                            <VisualEditor
                                value={formData['Содержимое (HTML)']}
                                onChange={val => setFormData({ ...formData, 'Содержимое (HTML)': val })}
                                placeholders={placeholders}
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={isSaving}>Отмена</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Сохранение...' : 'Сохранить шаблон'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const GasSetupTab: React.FC<{onCopy: (text:string) => void}> = ({ onCopy }) => {
    return (
        <div className="space-y-6 max-w-full overflow-hidden">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Настройка Google Apps Script</h3>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200 rounded-md space-y-2 text-sm">
                <p className="font-bold">⚠️ ВАЖНО: Настройка Токена и ID Админа</p>
                <p>В этой версии токен бота и ID админа не задаются в коде напрямую. Используйте <b>Свойства скрипта</b>:</p>
                <ol className="list-decimal list-inside">
                    <li>В редакторе скриптов нажмите иконку <b>Шестеренки</b> (Project Settings).</li>
                    <li>Прокрутите вниз до раздела <b>Script Properties</b>.</li>
                    <li>Добавьте свойство <code>TELEGRAM_BOT_TOKEN</code> со значением вашего токена.</li>
                    <li>Добавьте свойство <code>ADMIN_CHAT_ID</code> с ID вашего Telegram (для уведомлений от бота).</li>
                </ol>
            </div>
            
            <div className="space-y-6">
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Файл 1: Code.gs (Основная логика CRM)</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Вставьте этот код в файл <code>Code.gs</code>. Он отвечает за работу веб-интерфейса CRM.</p>
                    <CodeViewer code={CRM_CODE} title="Code.gs" onCopy={onCopy} />
                </div>

                <div>
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Файл 2: Bot.gs (Телеграм Бот)</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Создайте файл <code>Bot.gs</code> и вставьте туда этот код. Он содержит логику кнопок, меню и ЛК.</p>
                    <CodeViewer code={BOT_CODE} title="Bot.gs" onCopy={onCopy} />
                </div>
                
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Файл 3: Router.gs (Маршрутизатор)</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Создайте файл <code>Router.gs</code>. Он перенаправляет запросы либо в CRM, либо в Бота.</p>
                    <CodeViewer code={ROUTER_CODE} title="Router.gs" onCopy={onCopy} />
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                     <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Финальный шаг: Развертывание</h4>
                     <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 pl-2">
                        <li>Сохраните все файлы.</li>
                        <li>В редакторе скриптов нажмите синюю кнопку <b>"Начать развертывание" (Deploy)</b>.</li>
                        <li>Выберите <b>"Новое развертывание" (New deployment)</b>.</li>
                        <li>Тип: <b>Веб-приложение</b>. Доступ: <b>Все (Anyone)</b>.</li>
                        <li>Нажмите кнопку <b>"Развернуть" (Deploy)</b>.</li>
                        <li>Скопируйте полученный URL (Web App URL) и вставьте его в поле на вкладке "Основные".</li>
                        <li>
                            <b>Настройка Webhook для бота:</b><br/>
                            <span className="text-gray-500">Откройте в браузере:</span><br/>
                            <code className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded block w-full break-all whitespace-pre-wrap font-mono text-xs my-2">https://api.telegram.org/bot[ВАШ_ТОКЕН]/setWebhook?url=[ВАШ_WEB_APP_URL]</code>
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

const LogsTab: React.FC<{showToast: (message: string, type: 'success' | 'error') => void;}> = ({ showToast }) => {
    const [logs, setLogs] = useState<AppLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const fetchedLogs = await api.fetchLogs();
            setLogs(fetchedLogs);
            showToast('Логи обновлены', 'success');
        } catch (e: any) {
            showToast(`Ошибка загрузки логов: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
    }, []);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Системные логи</h3>
                <Button onClick={fetchLogs} disabled={isLoading} variant="outline" className="text-sm">
                    {isLoading ? 'Загрузка...' : 'Обновить'}
                </Button>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 text-blue-800 dark:text-blue-200 rounded-md">
                <p className="text-sm">Здесь отображаются последние 50 событий и ошибок, произошедших на сервере. Самые новые вверху.</p>
            </div>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Время</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Уровень</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Действие</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Сообщение</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800/20 divide-y divide-gray-200 dark:divide-gray-700">
                        {isLoading ? (
                            <tr><td colSpan={4} className="text-center p-8 text-gray-500">Загрузка логов...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={4} className="text-center p-8 text-gray-500">Логи пусты.</td></tr>
                        ) : (
                           logs.map((log, index) => (
                               <tr key={index}>
                                   <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                       {new Date(log.timestamp).toLocaleString('ru-RU')}
                                   </td>
                                   <td className="px-4 py-4 whitespace-nowrap text-sm">
                                       <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.level === 'ERROR' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'}`}>
                                           {log.level}
                                       </span>
                                   </td>
                                   <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200 font-mono">{log.action}</td>
                                   <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200 break-words max-w-md" title={log.details}>{log.message}</td>
                               </tr>
                           ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const SyncTab: React.FC<{ showToast: (message: string, type: 'success' | 'error') => void }> = ({ showToast }) => {
    const [fetchedData, setFetchedData] = useState<{ clients: any[], archive: any[], masters: any[], templates: any[] } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [importStatus, setImportStatus] = useState('');

    const handleFetchFromGAS = async () => {
        setIsLoading(true);
        try {
            const data = await api.fetchDataForMigration();
            setFetchedData(data);
            showToast(`Успешно загружено: ${data.clients.length} клиентов, ${data.archive.length} в архиве, ${data.masters.length} мастеров, ${data.templates.length} шаблонов.`, 'success');
        } catch(e: any) {
            showToast(`Ошибка загрузки из Google: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportToVercel = async () => {
        if (!fetchedData) return;
        setIsLoading(true);
        setImportStatus('Начинаем синхронизацию с Vercel Postgres...');
        try {
            const CHUNK_SIZE = 100;
            const clientChunks = [];
            for (let i = 0; i < fetchedData.clients.length; i += CHUNK_SIZE) {
                clientChunks.push(fetchedData.clients.slice(i, i + CHUNK_SIZE));
            }
            
            let totalImported = 0;
            for (const chunk of clientChunks) {
                await api.importDataToVercel(chunk, []);
                totalImported += chunk.length;
                setImportStatus(`Синхронизировано активных клиентов: ${totalImported} / ${fetchedData.clients.length}`);
            }

            const archiveChunks = [];
            for (let i = 0; i < fetchedData.archive.length; i += CHUNK_SIZE) {
                archiveChunks.push(fetchedData.archive.slice(i, i + CHUNK_SIZE));
            }
            
            let totalArchiveImported = 0;
            for (const chunk of archiveChunks) {
                await api.importDataToVercel([], chunk);
                totalArchiveImported += chunk.length;
                setImportStatus(`Синхронизировано архива: ${totalArchiveImported} / ${fetchedData.archive.length}`);
            }

            setImportStatus('Синхронизация Мастеров и Шаблонов...');
            await api.importDataToVercel([], [], fetchedData.masters, fetchedData.templates);

            showToast('Синхронизация успешно завершена!', 'success');
            setImportStatus('Готово! Данные синхронизированы.');
        } catch(e: any) {
            showToast(`Ошибка синхронизации: ${e.message}`, 'error');
            setImportStatus('Ошибка при синхронизации.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">База данных и резервное копирование (Backup)</h3>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 text-emerald-800 dark:text-emerald-200 rounded-md">
                <p className="text-sm">
                    CRM полностью автономна и независима от Google Таблиц. Все данные хранятся на вашем устройстве или в серверной базе PostgreSQL.
                    <br/>
                    Вы можете в любой момент выгрузить полную резервную копию всех договоров, архива, шаблонов и мастеров в один клик.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Full Database Snapshot Backup */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-800 flex flex-col items-center text-center shadow-2xs">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300 mb-4 font-bold text-xl">
                        📦
                    </div>
                    <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Полный бэкап базы данных</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Скачать единый архивный JSON-файл со всеми 27 клиентами, архивом, шаблонами и мастерами.
                    </p>
                    <Button 
                        onClick={() => {
                            try {
                                const clients = JSON.parse(localStorage.getItem('crm_clients') || '[]');
                                const archive = JSON.parse(localStorage.getItem('crm_archive') || '[]');
                                const templates = JSON.parse(localStorage.getItem('crm_templates') || '[]');
                                const masters = JSON.parse(localStorage.getItem('crm_masters') || '[]');
                                const backup = {
                                    version: '2.0',
                                    exportDate: new Date().toISOString(),
                                    clientsCount: clients.length,
                                    archiveCount: archive.length,
                                    clients,
                                    archive,
                                    templates,
                                    masters
                                };
                                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `tire_crm_backup_${new Date().toISOString().split('T')[0]}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                                showToast(`Резервная копия успешно скачана (${clients.length + archive.length} заказов)!`, 'success');
                            } catch (e: any) {
                                showToast(`Ошибка создания бэкапа: ${e.message}`, 'error');
                            }
                        }} 
                        className="w-full justify-center !bg-emerald-600 hover:!bg-emerald-700 text-white"
                    >
                        Скачать полный бэкап (JSON)
                    </Button>
                </div>

                {/* 2. Sync to Cloud PostgreSQL */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-800 flex flex-col items-center text-center shadow-2xs">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300 mb-4 font-bold text-xl">
                        ⚡
                    </div>
                    <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Синхронизация в PostgreSQL</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Загрузить локальную базу данных на облачный сервер Vercel / Neon при подключении.
                    </p>
                    
                    <div className="w-full space-y-3">
                        <Button 
                            onClick={async () => {
                                setIsLoading(true);
                                setImportStatus('Отправка данных в PostgreSQL...');
                                try {
                                    const clients = JSON.parse(localStorage.getItem('crm_clients') || '[]');
                                    const archive = JSON.parse(localStorage.getItem('crm_archive') || '[]');
                                    const templates = JSON.parse(localStorage.getItem('crm_templates') || '[]');
                                    const masters = JSON.parse(localStorage.getItem('crm_masters') || '[]');
                                    await api.importDataToVercel(clients, archive, masters, templates);
                                    showToast('База данных успешно синхронизирована с PostgreSQL!', 'success');
                                    setImportStatus('Синхронизация завершена успешно.');
                                } catch (e: any) {
                                    showToast(`Сообщение: ${e.message}`, 'error');
                                    setImportStatus('Статус: локальное автономное хранилище активно.');
                                } finally {
                                    setIsLoading(false);
                                }
                            }} 
                            disabled={isLoading} 
                            variant="outline"
                            className="w-full justify-center"
                        >
                            {isLoading ? 'Синхронизация...' : 'Синхронизировать в PostgreSQL'}
                        </Button>
                    </div>

                    {importStatus && (
                        <div className="mt-4 text-xs font-mono text-gray-600 dark:text-gray-300 w-full text-center">
                            {importStatus}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Expander: React.FC<{
    title: string;
    isExpanded: boolean;
    setExpanded: (v: boolean) => void;
    children: React.ReactNode;
}> = ({ title, isExpanded, setExpanded, children }) => (
    <div className="border-t dark:border-gray-700 pt-4 mt-4">
        <button 
            onClick={() => setExpanded(!isExpanded)}
            className="flex justify-between items-center w-full text-left font-semibold text-lg text-gray-800 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
        >
            <span>{title}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </button>
        {isExpanded && <div className="mt-4 prose prose-sm dark:prose-invert max-w-none animate-slide-in-bottom">{children}</div>}
    </div>
);

const AboutTab: React.FC<{ onCopy: (text: string) => void }> = ({ onCopy }) => {
    const descriptionText = `
### 2.1. Дашборд (Панель мониторинга)
Централизованное представление ключевых бизнес-метрик:
- **Финансовые показатели:** Отображение общей выручки, текущего месячного дохода и общей суммы задолженностей.
- **Живая аналитика:** Виджеты "Доход в реальном времени" и "Всего заработано" с анимацией накопления средств.
- **Клиентская база:** Общее количество активных клиентов.
- **Список должников:** Быстрый доступ к клиентам с просроченной оплатой.
- **Список "напоминаний":** Отображение клиентов, у которых срок хранения подходит к концу в ближайшие 30 дней.

### 2.2. Управление клиентами
- **Единая база:** Просмотр, поиск и фильтрация всех клиентов.
- **Карточка клиента:** Детальная информация, история заказов и фото.
- **Массовые действия:** Возможность выбора нескольких клиентов для массовой рассылки или удаления.
- **Сохраненные виды:** Создание персональных наборов фильтров (по статусу, складу, долгу) для быстрого переключения между сегментами базы.

### 2.3. Продвинутое оформление заказов
- **Мульти-комплекты:** Поддержка **разношироких шин** и разных осей. Возможность добавить несколько групп шин в один заказ (например, 2 передних + 2 задних с разными параметрами).
- **Детализация:** Указание DOT-кода для каждой шины отдельно.
- **Умный ввод:** Автодополнение брендов и моделей шин, визуальный селектор размеров.
- **Авто-расчеты:** Калькуляция стоимости с учетом дисков и доп. услуг для каждой группы шин.
- **Архивация:** При оформлении нового заказа для старого клиента, предыдущий заказ автоматически переносится в архив.

### 2.4. Телеграм Бот и ЛК Клиента (v2.0)
- **Полноценный Бот:** Встроенный скрипт (\`Bot.gs\`) обеспечивает работу Telegram-бота.
- **Личный кабинет:** Клиенты могут видеть статус своих шин, сроки хранения и фото договора прямо в Telegram.
- **Продление и Выдача:** Заявки на продление хранения или выдачу шин оформляются через бота и попадают менеджеру.
- **Мастера:** Уведомления мастерам о новых записях.

### 2.5. Управление Мастерами
- **Справочник сотрудников:** Ведение списка мастеров/партнеров.
- **Запись:** Функционал для записи клиента к конкретному мастеру на определенное время.
- **Уведомления:** Автоматическая отправка деталей записи мастеру в Telegram.

### 2.6. Технологии и Настройки
- **Фото:** Загрузка и хранение фото на Google Drive.
- **Архитектура:** Использование \`metadata\` для хранения сложных структур данных (группы шин) в Google Sheets.
- **WYSIWYG:** Визуальный редактор HTML для настройки шаблонов сообщений.
`;

    const promptText = `
System Prompt:
You are a world-class senior frontend engineer. Build a CRM for a tire storage business.

**App Name:** Tire Storage CRM (CRM-OtelShun.ru)

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Google Sheets (Backend), Google Apps Script.

**Architecture:**
*   **Frontend:** Single Page App.
*   **Backend:** GAS Web App (\`doPost\`).
*   **Files:** \`Code.gs\` (CRM logic), \`Bot.gs\` (Telegram Bot logic), \`Router.gs\` (Entry point).
*   **Data:** Clients stored in 'WebBase' sheet. Complex data (tire groups) stored as JSON string in \`metadata\` column.

**Key Features:**
1.  **Multi-Group Tire Input:** Support for adding multiple groups of tires (e.g., staggered sets) per client. UI handles Brand/Model/Size/DOT per group.
2.  **Masters & Scheduling:** 'Masters' tab to manage employees. Schedule appointments and send Telegram notifications to masters.
3.  **Telegram Bot Integration:** Backend handles webhooks for a client-facing bot (Signup, Personal Cabinet, Extension flows).
4.  **Dashboard:** Real-time income counters, expiration lists.
5.  **Settings:** Config for Scripts, Visual Editor for templates (HTML), Masters management.
6.  **Saved Views:** Filter presets for the client list.

**Data Model:**
*   \`Client\`: Includes \`metadata\` (JSON) for \`TireGroup[]\`.
*   \`TireGroup\`: { brand, model, size, season, rims, dot, price }.
`;

    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);

    const formatMarkdownToHtml = (markdown: string) => {
        let html = markdown
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 border-b pb-2 dark:border-gray-600">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4 border-b-2 pb-2 dark:border-gray-500">$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/__(.*?)__/gim, '<strong>$1</strong>')
            .replace(/`([^`]+)`/gim, '<code class="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded text-sm">$1</code>');
            
        html = html.replace(/^\s*[-*] (.*)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc list-inside space-y-1 my-2">$1</ul>');

        return html.split('\n\n').map(p => {
             const trimmed = p.trim();
             if (trimmed === '') return '';
             if (trimmed.startsWith('<ul') || trimmed.startsWith('<h')) return p;
             return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
        }).join('');
    };

    const formattedDescription = formatMarkdownToHtml(descriptionText);

    return (
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <h3 className="text-xl font-semibold">О проекте Tire Storage CRM</h3>
            <p>Это приложение разработано для упрощения управления клиентской базой шинного хранения.</p>
            <p><b>Версия приложения:</b> 3.6.5 (Vercel Native)</p>
            
            <Expander title="Подробное описание функций" isExpanded={isDescriptionExpanded} setExpanded={setIsDescriptionExpanded}>
                <div dangerouslySetInnerHTML={{ __html: formattedDescription }} />
            </Expander>

            <Expander title="Промт для воссоздания CRM" isExpanded={isPromptExpanded} setExpanded={setIsPromptExpanded}>
                <CodeViewer code={promptText} title="Prompt.txt" onCopy={onCopy} />
            </Expander>
        </div>
    );
};


interface SettingsProps {
  initialSettings: SettingsType;
  initialTemplates: MessageTemplate[];
  initialMasters: Master[]; // Kept for prop compatibility, but unused
  clients: Client[];
  onSave: () => void;
  needsSetup: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ initialSettings, initialTemplates, clients, onSave, needsSetup }) => {
  const [activeTab, setActiveTab] = useState(needsSetup ? 'general' : 'general');
  const [settings, setSettings] = useState(initialSettings);
  const [templates, setTemplates] = useState(initialTemplates);
  const [isSaving, setIsSaving] = useState(false);
  
  const [localToasts, setLocalToasts] = useState<any[]>([]);
  
  const addLocalToast = (message: string, type: 'success' | 'error') => {
       const id = Date.now().toString();
       const duration = type === 'error' ? 0 : 4000;
       setLocalToasts(prev => [...prev, { id, message, type, duration }]);
  };
  
  const removeLocalToast = (id: string) => {
      setLocalToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);
  useEffect(() => {
    setTemplates(initialTemplates);
  }, [initialTemplates]);

  const handleSettingsChange = (field: keyof SettingsType, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.saveSettings(settings);
      addLocalToast('Настройки сохранены!', 'success');
      onSave();
    } catch (e: any) {
      addLocalToast(`Ошибка сохранения: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        addLocalToast('Скопировано в буфер обмена!', 'success');
    }, () => {
        addLocalToast('Не удалось скопировать.', 'error');
    });
  };
  
   const TABS = [
        { 
            id: 'general', 
            label: 'Основные', 
            icon: (
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
            ) 
        },
        { 
            id: 'templates', 
            label: 'Шаблоны', 
            icon: (
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            ) 
        },
        { 
            id: 'logs', 
            label: 'Логи', 
            icon: (
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
            ) 
        },
        { 
            id: 'migration', 
            label: 'База данных и бэкап', 
            icon: <ArrowPathIcon /> 
        },
        { 
            id: 'about', 
            label: 'О проекте', 
            icon: (
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
            )
        }
    ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <ToastContainer toasts={localToasts} removeToast={removeLocalToast} />
      
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-4 overflow-x-auto pb-1 no-scrollbar" aria-label="Tabs">
            {TABS.map(tab => (
                 <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon}>
                    {tab.label}
                 </TabButton>
            ))}
        </nav>
      </div>
      
      <Card>
        {activeTab === 'general' && <GeneralSettingsTab settings={settings} onChange={handleSettingsChange} showToast={addLocalToast} />}
        {activeTab === 'templates' && <TemplatesTab templates={templates} setTemplates={setTemplates} showToast={addLocalToast}/>}
        {activeTab === 'migration' && <SyncTab showToast={addLocalToast} />}
        {activeTab === 'logs' && <LogsTab showToast={addLocalToast} />}
        {activeTab === 'about' && <AboutTab onCopy={handleCopyToClipboard} />}
      </Card>
      
      {activeTab === 'general' && (
          <div className="flex justify-end mt-6">
              <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-full sm:w-auto">
                  {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
          </div>
      )}
    </div>
  );
};
