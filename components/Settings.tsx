
import React, { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsType, MessageTemplate, Client, AppLog, Master } from '../types';
import { api, getClientHeaders } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { VisualEditor } from './ui/VisualEditor';
import { ToastContainer } from './ui/Toast';
import { CRM_CODE, ROUTER_CODE, BOT_CODE } from '../data/gas-scripts';

// --- Icons ---
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>;
const ChevronUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>;
const CopyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>;
const ServerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const CloudIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>;
const ArrowPathIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18-3.183l-3.182-3.182a8.25 8.25 0 00-11.664 0l-3.18 3.185" /></svg>;

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

// --- Responsive Code Viewer Component ---
const CodeViewer: React.FC<{ code: string; title: string; onCopy: (c: string) => void }> = ({ code, title, onCopy }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="w-full max-w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-[#1e1e1e] shadow-sm overflow-hidden flex flex-col">
            {/* Header Bar: Stack on mobile to prevent squashing */}
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

            {/* Content Area - WRAPPING ENABLED */}
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

    const handleTestConnection = async () => {
        if (settings.apiMode === 'VERCEL') {
             setIsTesting(true);
             const controller = new AbortController();
             // INCREASED TIMEOUT: 30 seconds for cold starts
             const timeoutId = setTimeout(() => controller.abort(), 30000);

             try {
                 const res = await fetch('/api/crm', { 
                     method: 'POST', 
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

    return (
        <div className="space-y-6">
            
            {/* API MODE SWITCHER */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Источник данных (Backend)</h4>
                <div className="flex gap-4">
                    <label className={`flex-1 relative flex items-center justify-center p-4 cursor-pointer rounded-lg border-2 transition-all ${settings.apiMode === 'GAS' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        <input type="radio" name="apiMode" value="GAS" checked={settings.apiMode === 'GAS'} onChange={() => onChange('apiMode', 'GAS')} className="sr-only" />
                        <div className="text-center">
                            <CloudIcon />
                            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">Google Sheets</div>
                            <div className="text-xs text-gray-500">Классика (GAS)</div>
                        </div>
                    </label>
                    <label className={`flex-1 relative flex items-center justify-center p-4 cursor-pointer rounded-lg border-2 transition-all ${settings.apiMode === 'VERCEL' ? 'border-black dark:border-white bg-gray-100 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        <input type="radio" name="apiMode" value="VERCEL" checked={settings.apiMode === 'VERCEL'} onChange={() => onChange('apiMode', 'VERCEL')} className="sr-only" />
                        <div className="text-center">
                            <ServerIcon />
                            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">Vercel Postgres</div>
                            <div className="text-xs text-gray-500">Быстро (SQL)</div>
                        </div>
                    </label>
                </div>
            </div>

            {settings.apiMode === 'GAS' ? (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <div className="w-full sm:flex-grow">
                             <Input 
                                label="URL скрипта Google Apps" 
                                value={settings.googleSheetId} 
                                onChange={e => onChange('googleSheetId', e.target.value)}
                                helperText="URL веб-приложения, полученный после развертывания."
                            />
                        </div>
                        <Button 
                            variant="outline" 
                            onClick={handleTestConnection} 
                            disabled={isTesting || !settings.googleSheetId}
                            className="w-full sm:w-auto h-[46px] flex-shrink-0"
                        >
                            {isTesting ? 'Проверка...' : 'Проверить Google'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-top-2 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                        Используется база данных <b>Vercel Postgres</b>. Конфигурация через переменные окружения.
                    </p>
                    <Button 
                        variant="outline" 
                        onClick={handleTestConnection} 
                        disabled={isTesting}
                        className="w-full sm:w-auto"
                    >
                        {isTesting ? 'Проверка...' : 'Проверить соединение с БД'}
                    </Button>
                </div>
            )}

            <hr className="dark:border-gray-700"/>

            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <b>Токен Telegram бота</b> {settings.apiMode === 'GAS' ? 'настраивается в свойствах скрипта Google.' : 'должен быть в переменных окружения Vercel (TELEGRAM_BOT_TOKEN).'}
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
            // Case 1: Editing existing and Renamed -> Delete old, Add new
            if (originalName && originalName !== formData['Название шаблона']) {
                await api.deleteTemplate(originalName);
                await api.addTemplate(formData);
                setTemplates(prev => {
                    const filtered = prev.filter(t => t['Название шаблона'] !== originalName);
                    return [...filtered, formData];
                });
                showToast('Шаблон переименован и сохранен', 'success');
            } 
            // Case 2: Editing existing, same name -> Update
            else if (originalName) {
                await api.updateTemplate(formData);
                setTemplates(prev => prev.map(t => t['Название шаблона'] === originalName ? formData : t));
                showToast('Шаблон обновлен', 'success');
            }
            // Case 3: Creating New -> Add
            else {
                // Check for duplicate name
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
            {/* List of Templates */}
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

            {/* Editor Form */}
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
        // Initial fetch suppressed to not spam errors if connection is broken
        // fetchLogs(); 
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

const MigrationTab: React.FC<{ showToast: (message: string, type: 'success' | 'error') => void }> = ({ showToast }) => {
    const [fetchedData, setFetchedData] = useState<{ clients: any[], archive: any[] } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [importStatus, setImportStatus] = useState('');

    const handleFetchFromGAS = async () => {
        setIsLoading(true);
        try {
            const data = await api.fetchDataForMigration();
            setFetchedData(data);
            showToast(`Успешно загружено: ${data.clients.length} клиентов, ${data.archive.length} в архиве.`, 'success');
        } catch(e: any) {
            showToast(`Ошибка загрузки из Google: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportToVercel = async () => {
        if (!fetchedData) return;
        setIsLoading(true);
        setImportStatus('Начинаем импорт в Vercel Postgres...');
        try {
            // Импорт клиентами чанками по 100 штук, чтобы не превысить лимит запроса
            const CHUNK_SIZE = 100;
            const clientChunks = [];
            for (let i = 0; i < fetchedData.clients.length; i += CHUNK_SIZE) {
                clientChunks.push(fetchedData.clients.slice(i, i + CHUNK_SIZE));
            }
            const archiveChunks = [];
            for (let i = 0; i < fetchedData.archive.length; i += CHUNK_SIZE) {
                archiveChunks.push(fetchedData.archive.slice(i, i + CHUNK_SIZE));
            }

            let totalImported = 0;

            for (const chunk of clientChunks) {
                await api.importDataToVercel(chunk, []);
                totalImported += chunk.length;
                setImportStatus(`Импортировано активных клиентов: ${totalImported} / ${fetchedData.clients.length}`);
            }

            let totalArchiveImported = 0;
            for (const chunk of archiveChunks) {
                await api.importDataToVercel([], chunk);
                totalArchiveImported += chunk.length;
                setImportStatus(`Импортировано архива: ${totalArchiveImported} / ${fetchedData.archive.length}`);
            }

            showToast('Миграция успешно завершена!', 'success');
            setImportStatus('Готово! Теперь можно переключить источник данных на VERCEL.');
        } catch(e: any) {
            showToast(`Ошибка импорта: ${e.message}`, 'error');
            setImportStatus('Ошибка при импорте.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold">Миграция данных (Google Sheets -> Vercel Postgres)</h3>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-400 text-indigo-800 dark:text-indigo-200 rounded-md">
                <p className="text-sm">
                    Этот инструмент позволяет перенести данные из Google Таблиц в базу данных Vercel Postgres. 
                    Процесс безопасен: данные копируются, исходная таблица не изменяется.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Шаг 1 */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-800 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4 font-bold text-xl">1</div>
                    <h4 className="font-bold text-lg mb-2">Скачать данные</h4>
                    <p className="text-sm text-gray-500 mb-4">Получить всех клиентов и архив из Google Apps Script.</p>
                    <Button onClick={handleFetchFromGAS} disabled={isLoading} variant="outline" className="w-full justify-center">
                        {isLoading && !fetchedData ? 'Загрузка...' : 'Получить из Google'}
                    </Button>
                    {fetchedData && (
                        <div className="mt-4 text-left w-full bg-gray-50 dark:bg-gray-700/50 p-3 rounded text-sm">
                            <p>✅ Клиентов: <b>{fetchedData.clients.length}</b></p>
                            <p>✅ Архив: <b>{fetchedData.archive.length}</b></p>
                        </div>
                    )}
                </div>

                {/* Шаг 2 */}
                <div className={`border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-800 flex flex-col items-center text-center transition-opacity ${!fetchedData ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-4 font-bold text-xl">2</div>
                    <h4 className="font-bold text-lg mb-2">Загрузить в Postgres</h4>
                    <p className="text-sm text-gray-500 mb-4">Отправить данные в новую базу Vercel.</p>
                    <Button onClick={handleImportToVercel} disabled={isLoading} className="w-full justify-center">
                        {isLoading && fetchedData ? 'Импорт...' : 'Начать миграцию'}
                    </Button>
                    {importStatus && (
                        <div className="mt-4 text-xs font-mono text-gray-600 dark:text-gray-300 w-full text-center animate-pulse">
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
    // Hardcoded descriptions from the prompt/DESCRIPTION.md context to ensure they appear
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
            <p><b>Версия приложения:</b> 3.6.2 (Vercel Native)</p>
            
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
  // Remove local toast state
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
        { id: 'general', label: 'Основные', icon: <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.75a.75.75 0 01.75.75v1.5h-1.5v-1.5a.75.75 0 01.75-.75zM10 6a2.5 2.5 0 00-2.5 2.5v7.5a2.5 2.5 0 105 0v-7.5A2.5 2.5 0 0010 6zM8.75 8.5a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5z" /></svg> },
        { id: 'templates', label: 'Шаблоны', icon: <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0v-1.128c0-.416.16-.813.44-1.111h11.12c.28.298.44.7.44 1.11v1.129a.75.75 0 001.5 0V2.75a.75.75 0 00-1.5 0v1.128c0 .416-.16.813-.44 1.111H3.94c-.28-.298-.44-.7-.44-1.11V2.75z" /><path d="M6.25 7.5a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5z" /></svg> },
        { id: 'logs', label: 'Логи', icon: <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg> },
        { id: 'migration', label: 'Миграция', icon: <ArrowPathIcon /> },
        { id: 'gas', label: 'Настройка GAS', icon: <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M15.312 5.312a.75.75 0 010 1.062l-6.25 6.25a.75.75 0 01-1.062 0l-2.5-2.5a.75.75 0 011.062-1.062l1.97 1.97 5.72-5.72a.75.75 0 011.062 0z" clipRule="evenodd" /></svg> },
        { id: 'about', label: 'О проекте', icon: <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>}
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
        {activeTab === 'migration' && <MigrationTab showToast={addLocalToast} />}
        {activeTab === 'gas' && <GasSetupTab onCopy={handleCopyToClipboard} />}
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
