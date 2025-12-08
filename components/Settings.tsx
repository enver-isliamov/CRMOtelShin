import React, { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsType, MessageTemplate, Master, Client, AppLog } from '../types';
import { api, getClientHeaders } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { VisualEditor } from './ui/VisualEditor';
import { ToastContainer } from './ui/Toast';
import { CRM_CODE, ROUTER_CODE, BOT_CODE } from '../data/gas-scripts';


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

const GeneralSettingsTab: React.FC<{ 
    settings: SettingsType, 
    onChange: (field: keyof SettingsType, value: string) => void,
    showToast: (message: string, type: 'success' | 'error') => void;
}> = ({ settings, onChange, showToast }) => {
    const [isTesting, setIsTesting] = useState(false);

    const handleTestConnection = async () => {
        if (!settings.googleSheetId) {
            showToast('Сначала вставьте URL скрипта', 'error');
            return;
        }
        setIsTesting(true);
        try {
            const result = await api.testConnection(settings.googleSheetId);
            if (result.status === 'success') {
                showToast(`Успех! Версия: ${result.version}.`, 'success');
            } else {
                throw new Error(result.message || 'Неизвестная ошибка от скрипта.');
            }
        } catch (e: any) {
            // Error handling is improved in api.ts, this will show the detailed message
            showToast(`Ошибка подключения: ${e.message}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="w-full sm:flex-grow">
                     <Input 
                        label="URL скрипта Google Apps" 
                        value={settings.googleSheetId} 
                        onChange={e => onChange('googleSheetId', e.target.value)}
                        helperText="URL веб-приложения, полученный после развертывания. Инструкция на вкладке 'Настройка GAS'."
                    />
                </div>
                <Button 
                    variant="outline" 
                    onClick={handleTestConnection} 
                    disabled={isTesting || !settings.googleSheetId}
                    className="w-full sm:w-auto h-[46px] flex-shrink-0"
                >
                    {isTesting ? 'Проверка...' : 'Проверить'}
                </Button>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <b>Токен Telegram бота</b> теперь настраивается  в Google Apps Script. Инструкции смотрите на вкладке "Настройка GAS".
                </p>
            </div>
            <Input 
                label="Chat ID Администраторов" 
                value={settings.adminIds} 
                onChange={e => onChange('adminIds', e.target.value)}
                helperText="ID чатов для админов, через запятую. Будут получать все уведомления."
            />
            <Input 
                label="Chat ID Менеджеров" 
                value={settings.managerIds} 
                onChange={e => onChange('managerIds', e.target.value)}
                helperText="ID чатов для менеджеров, через запятую. Будут получать уведомления о новых клиентах."
            />
        </div>
    );
};

const TemplateCard: React.FC<{
    initialTemplate: MessageTemplate;
    onDelete: (templateName: string) => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}> = ({ initialTemplate, onDelete, showToast }) => {
    const [template, setTemplate] = useState(initialTemplate);
    const [isSaving, setIsSaving] = useState(false);
    const originalName = useMemo(() => initialTemplate['Название шаблона'], [initialTemplate]);

    const handleTemplateChange = (field: keyof MessageTemplate, value: string) => {
        setTemplate(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.updateTemplate(template);
            showToast(`Шаблон "${template['Название шаблона']}" сохранен`, 'success');
        } catch (e: any) {
            showToast(`Ошибка сохранения: ${e.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = () => {
        if(window.confirm(`Вы уверены, что хотите удалить шаблон "${originalName}"?`)){
            onDelete(originalName);
        }
    }

    const placeholders = getClientHeaders().filter(h => h !== 'id').map(h => `{{${h}}}`);

    return (
        <Card noOverflow className="!p-0 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <Input
                    label="Название шаблона"
                    value={template['Название шаблона']}
                    onChange={e => handleTemplateChange('Название шаблона', e.target.value)}
                    className="text-lg font-semibold !p-0 border-none shadow-none focus:ring-0"
                />
            </div>
            <div className="p-4 flex-grow">
                <VisualEditor
                    value={template['Содержимое (HTML)']}
                    onChange={value => handleTemplateChange('Содержимое (HTML)', value)}
                    placeholders={placeholders}
                />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end items-center gap-2">
                <Button variant="danger" size="sm" onClick={handleDelete}>Удалить</Button>
                <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                </Button>
            </div>
        </Card>
    );
};


const TemplatesTab: React.FC<{ 
    templates: MessageTemplate[]; 
    setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
    showToast: (message: string, type: 'success' | 'error') => void;
}> = ({ templates, setTemplates, showToast }) => {
    
    const addTemplate = () => {
        const newTemplate = { 'Название шаблона': `Новый шаблон ${templates.length + 1}`, 'Содержимое (HTML)': '<p>Введите текст вашего сообщения здесь...</p>' };
        setTemplates([...templates, newTemplate]);
        // Immediately save the new blank template to the backend
        api.updateTemplate(newTemplate)
            .then(() => showToast('Новый шаблон добавлен', 'success'))
            .catch((e) => showToast(`Ошибка добавления шаблона: ${e.message}`, 'error'));
    };

    const handleDelete = async (templateName: string) => {
        try {
            await api.deleteTemplate(templateName);
            setTemplates(prev => prev.filter(t => t['Название шаблона'] !== templateName));
            showToast('Шаблон удален', 'success');
        } catch(e: any) {
            showToast(`Ошибка удаления: ${e.message}`, 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {templates.map((template, index) => (
                    <TemplateCard 
                        key={template['Название шаблона'] || index} 
                        initialTemplate={template} 
                        onDelete={handleDelete}
                        showToast={showToast}
                    />
                ))}
            </div>
            <div className="pt-2">
                <Button variant="outline" onClick={addTemplate}>Добавить шаблон</Button>
            </div>
        </div>
    );
};

const MasterFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    master: Master | null;
    onSave: (master: Omit<Master, 'id'> | Master) => void;
}> = ({ isOpen, onClose, master, onSave }) => {
    const [formData, setFormData] = useState<Partial<Master>>({});

    useEffect(() => {
        setFormData(master ? { ...master } : { 'Имя': '', 'chatId (Telegram)': '', 'Услуга': '', 'Телефон': '' });
    }, [master, isOpen]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        onSave(formData as Master);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={master ? 'Редактировать мастера' : 'Добавить мастера'}>
            <div className="space-y-4">
                <Input name="Имя" label="Имя" value={formData['Имя'] || ''} onChange={handleChange} placeholder="Иван Иванов" required />
                <Input name="chatId (Telegram)" label="Chat ID (Telegram)" value={formData['chatId (Telegram)'] || ''} onChange={handleChange} placeholder="123456789" required />
                <Input name="Услуга" label="Услуга" value={formData['Услуга'] || ''} onChange={handleChange} placeholder="Шиномонтаж, Ремонт дисков" helperText="Перечислите услуги через запятую, если их несколько." />
                <Input name="Телефон" label="Телефон" type="tel" value={formData['Телефон'] || ''} onChange={handleChange} placeholder="+7..." />
            </div>
            <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={onClose}>Отмена</Button>
                <Button onClick={handleSave}>Сохранить</Button>
            </div>
        </Modal>
    );
}

const ScheduleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    master: Master | null;
    clients: Client[];
    onSchedule: (master: Master, client: Client, service: string, dateTime: Date) => Promise<void>;
}> = ({ isOpen, onClose, master, clients, onSchedule }) => {
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedService, setSelectedService] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);

    const masterServices = useMemo(() => (master?.['Услуга'] || '').split(',').map(s => s.trim()).filter(Boolean), [master]);

    useEffect(() => {
        if (isOpen) {
            if (clients.length > 0) {
                setSelectedClientId(clients[0]?.id || '');
            }
            setSelectedService(masterServices[0] || '');
            const now = new Date();
            now.setMinutes(now.getMinutes() + (60 - now.getMinutes())); // Round up to the next hour
            setDate(now.toISOString().split('T')[0]);
            setTime(now.toTimeString().slice(0, 5));
        }
    }, [isOpen, clients, masterServices]);
    
    const handleSchedule = async () => {
        if (!master || !selectedClientId || !date || !time) return;
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) return;
        if (masterServices.length > 1 && !selectedService) {
            alert('Пожалуйста, выберите услугу.');
            return;
        }

        setIsScheduling(true);
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const dateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
        
        await onSchedule(master, client, selectedService, dateTime);
        setIsScheduling(false);
        onClose();
    };
    
    if (!master) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Запись к мастеру: ${master['Имя']}`}>
            <div className="space-y-4">
                <div>
                    <label htmlFor="client-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Клиент</label>
                    <select id="client-select" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition duration-150">
                        {clients.map(c => <option key={c.id} value={c.id}>{c['Имя клиента']} - {c['Номер Авто']}</option>)}
                    </select>
                </div>
                 {masterServices.length > 1 && (
                    <div>
                        <label htmlFor="service-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Услуга</label>
                        <select id="service-select" value={selectedService} onChange={e => setSelectedService(e.target.value)} required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition duration-150">
                           {masterServices.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    <Input label="Время" type="time" value={time} onChange={e => setTime(e.target.value)} />
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={onClose} disabled={isScheduling}>Отмена</Button>
                <Button onClick={handleSchedule} disabled={isScheduling || clients.length === 0}>
                    {isScheduling ? 'Отправка...' : 'Записать и уведомить'}
                </Button>
            </div>
        </Modal>
    );
};

const MastersTab: React.FC<{ 
    masters: Master[]; 
    setMasters: React.Dispatch<React.SetStateAction<Master[]>>;
    clients: Client[];
    showToast: (message: string, type: 'success' | 'error') => void;
}> = ({ masters, setMasters, clients, showToast }) => {
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);
    const [editingMaster, setEditingMaster] = useState<Master | null>(null);

    const handleSaveMaster = async (masterData: Omit<Master, 'id'> | Master) => {
        try {
            if ('id' in masterData && masterData.id) {
                const updatedMaster = await api.updateMaster(masterData);
                setMasters(masters.map(m => m.id === updatedMaster.id ? updatedMaster : m));
                showToast("Мастер обновлен", "success");
            } else {
                const newMaster = await api.addMaster(masterData);
                setMasters([...masters, newMaster]);
                showToast("Мастер добавлен", "success");
            }
        } catch(e: any) {
            showToast(`Ошибка сохранения мастера: ${e.message}`, 'error');
        }
    };

    const handleDeleteMaster = async (masterId: string) => {
        if (window.confirm("Вы уверены, что хотите удалить этого мастера?")) {
            try {
                await api.deleteMaster(masterId);
                setMasters(masters.filter(m => m.id !== masterId));
                showToast("Мастер удален", "success");
            } catch (e: any) {
                showToast(`Ошибка удаления: ${e.message}`, 'error');
            }
        }
    };
    
    const handleOpenScheduleModal = (master: Master) => {
        setSelectedMaster(master);
        setScheduleModalOpen(true);
    };

    const handleSchedule = async (master: Master, client: Client, service: string, dateTime: Date) => {
        const localDateTime = new Date(dateTime.getTime() - (dateTime.getTimezoneOffset() * 60000));
        const finalService = service || master['Услуга']?.split(',')[0].trim() || 'Не указана';
        const message = `<b>✅ Новая запись!</b>

Услуга: <b>${finalService}</b>
Клиент: <b>${client['Имя клиента']}</b>
Телефон: <code>${client['Телефон']}</code>

Дата и время: <b>${localDateTime.toLocaleString('ru-RU', {dateStyle: 'full', timeStyle: 'short'})}</b>`;
        try {
            const result = await api.sendMessage(master['chatId (Telegram)'], message);
            if (result.success) {
                showToast(`Уведомление мастеру ${master['Имя']} отправлено`, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch(e: any) {
            showToast(`Ошибка отправки: ${e.message}`, 'error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 text-blue-800 dark:text-blue-200 rounded-md">
                <h4 className="font-bold">Настройка листа "мастера"</h4>
                <p className="mt-1 text-sm">Для корректной работы убедитесь, что в вашей Google Таблице есть лист с названием \`мастера\`. Он должен содержать следующие столбцы в указанном порядке:</p>
                <ol className="list-decimal list-inside mt-1 text-sm space-y-1">
                    <li><b>id</b>: Уникальный идентификатор, будет заполнен автоматически.</li>
                    <li><b>Имя</b>: Имя мастера (например, "Иван П.").</li>
                    <li><b>chatId (Telegram)</b>: Числовой ID пользователя или группы в Telegram для отправки уведомлений.</li>
                    <li><b>Услуга</b>: Услуги, которые предоставляет мастер. Можно указать несколько через запятую (например, "Шиномонтаж, Ремонт дисков").</li>
                    <li><b>Телефон</b>: Контактный телефон мастера (необязательно).</li>
                </ol>
            </div>

            <div className="flex justify-end sm:block text-right">
                <Button onClick={() => { setEditingMaster(null); setFormModalOpen(true); }} className="w-full sm:w-auto">Добавить мастера</Button>
            </div>
            {masters && masters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {masters.map(master => (
                        <Card key={master.id} className="!p-4" noOverflow>
                            <div className="flex flex-col h-full">
                                <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-200">{master['Имя']}</h4>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {(master['Услуга'] || '').split(',').map(service => service.trim()).filter(Boolean).map(service => (
                                        <span key={service} className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full dark:bg-primary-900/50 dark:text-primary-200">{service}</span>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{master['Телефон']}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">Chat ID: {master['chatId (Telegram)']}</p>
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
                                    <Button size="sm" variant="primary" onClick={() => handleOpenScheduleModal(master)}>Записать</Button>
                                    <Button size="sm" variant="secondary" onClick={() => { setEditingMaster(master); setFormModalOpen(true); }}>Изменить</Button>
                                    <Button size="sm" variant="danger" onClick={() => handleDeleteMaster(master.id)}>Удалить</Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <p className="text-center py-8 text-gray-500">Мастера не добавлены.</p>
            )}

            <MasterFormModal 
                isOpen={formModalOpen}
                onClose={() => setFormModalOpen(false)}
                master={editingMaster}
                onSave={handleSaveMaster}
            />

            <ScheduleModal
                isOpen={scheduleModalOpen}
                onClose={() => setScheduleModalOpen(false)}
                master={selectedMaster}
                clients={clients}
                onSchedule={handleSchedule}
            />
        </div>
    );
};

const GasSetupTab: React.FC<{onCopy: (text:string) => void}> = ({ onCopy }) => {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold">Настройка Google Apps Script (Интеграция)</h3>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200 rounded-md space-y-2">
                <p className="font-bold">⚠️ ВАЖНО: Настройка Токена и ID Админа</p>
                <p>В этой версии токен бота и ID админа не задаются в коде напрямую. Используйте <b>Свойства скрипта</b>:</p>
                <ol className="list-decimal list-inside">
                    <li>В редакторе скриптов нажмите иконку <b>Шестеренки</b> (Project Settings).</li>
                    <li>Прокрутите вниз до раздела <b>Script Properties</b>.</li>
                    <li>Добавьте свойство <code>TELEGRAM_BOT_TOKEN</code> со значением вашего токена.</li>
                    <li>Добавьте свойство <code>ADMIN_CHAT_ID</code> с ID вашего Telegram (для уведомлений от бота).</li>
                </ol>
            </div>
            
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <h4 className="text-lg font-semibold">Файл 1: Code.gs (Основная логика CRM)</h4>
                <p>Вставьте этот код в файл <code>Code.gs</code>. Он отвечает за работу веб-интерфейса CRM.</p>

                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[300px]">
                        <code>{CRM_CODE.trim()}</code>
                    </pre>
                    <button onClick={() => onCopy(CRM_CODE)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                </div>

                <h4 className="text-lg font-semibold mt-8">Файл 2: Bot.gs (Телеграм Бот)</h4>
                <p>Создайте файл <code>Bot.gs</code> и вставьте туда этот код. Он содержит логику кнопок, меню и ЛК.</p>

                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[300px]">
                        <code>{BOT_CODE.trim()}</code>
                    </pre>
                    <button onClick={() => onCopy(BOT_CODE)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                </div>
                
                <h4 className="text-lg font-semibold mt-8">Файл 3: Router.gs (Маршрутизатор)</h4>
                <p>Создайте файл <code>Router.gs</code>. Он перенаправляет запросы либо в CRM, либо в Бота.</p>

                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[300px]">
                        <code>{ROUTER_CODE.trim()}</code>
                    </pre>
                    <button onClick={() => onCopy(ROUTER_CODE)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                </div>

                <h4 className="text-lg font-semibold mt-8">Финальный шаг: Развертывание</h4>
                 <ol className="list-decimal list-inside space-y-3 pl-4">
                    <li>Сохраните все файлы.</li>
                    <li>В редакторе скриптов нажмите синюю кнопку <b>"Начать развертывание" (Deploy)</b>.</li>
                    <li>Выберите <b>"Новое развертывание" (New deployment)</b>.</li>
                    <li>Тип: <b>Веб-приложение</b>. Доступ: <b>Все (Anyone)</b>.</li>
                    <li>Нажмите кнопку <b>"Развернуть" (Deploy)</b>.</li>
                    <li>Скопируйте полученный URL (Web App URL) и вставьте его в поле выше.</li>
                    <li>
                        <b>Настройка Webhook для бота:</b><br/>
                        Чтобы бот начал отвечать, нужно один раз открыть в браузере ссылку:<br/>
                        <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded">https://api.telegram.org/bot[ВАШ_ТОКЕН]/setWebhook?url=[ВАШ_WEB_APP_URL]</code>
                    </li>
                </ol>
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
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
        </button>
        {isExpanded && <div className="mt-4 prose prose-sm dark:prose-invert max-w-none animate-slide-in-bottom">{children}</div>}
    </div>
);

const AboutTab: React.FC<{ onCopy: (text: string) => void }> = ({ onCopy }) => {
    // Hardcoded descriptions from the prompt/DESCRIPTION.md context to ensure they appear
    const descriptionText = `
### 2.1. Дашборд (Панель мониторинга)
Централизованное представление ключевых бизнес-метрик:
- **Финансовые показатели:** Отображение общей выручки, текущего месячного дохода (в реальном времени) и общей суммы задолженностей.
- **Клиентская база:** Общее количество активных клиентов.
- **Список должников:** Быстрый доступ к клиентам с просроченной оплатой с возможностью отправки напоминания в один клик.
- **Список "напоминаний":** Отображение клиентов, у которых срок хранения подходит к концу в ближайшие 30 дней.

### 2.2. Управление клиентами
- **Единая база:** Просмотр, поиск и фильтрация всех клиентов в удобной табличной форме.
- **Карточка клиента:** Детальная информация о каждом клиенте, включая контактные данные, информацию об автомобиле, историю всех заказов и прикрепленные фотографии.
- **Массовые действия:** Возможность выбора нескольких клиентов для массовой рассылки или удаления.
- **Сохраненные виды:** Пользователи могут сохранять свои настройки фильтров и сортировки для быстрого доступа к нужным сегментам базы.

### 2.3. Создание и управление заказами
- **Гибкая форма:** Удобная форма для добавления нового клиента или оформления нового заказа для уже существующего.
- **Автоматические расчеты:** Система автоматически рассчитывает стоимость хранения, дату окончания и дату напоминания на основе введенных данных.
- **Управление услугами:** Легкое добавление дополнительных услуг (мойка, упаковка, вывоз) к заказу.
- **Архивация:** При оформлении нового заказа для старого клиента, предыдущий заказ автоматически переносится в архив, сохраняя полную историю взаимодействия.

### 2.4. Фотографии
- **Визуальное подтверждение:** Возможность загружать фотографии шин клиента через drag-and-drop или напрямую с камеры устройства.
- **Интеграция с Google Drive:** Все фотографии надежно хранятся в специальной папке на Google Диске пользователя, структурированные по номеру договора.

### 2.5. Автоматизация и уведомления
- **Интеграция с Telegram:** Настройка и отправка автоматических уведомлений клиентам и менеджерам через Telegram-бота.
- **Шаблоны сообщений:** Создание и редактирование шаблонов для различных типов уведомлений (напоминание о долге, об окончании хранения и т.д.).
`;

    const promptText = `
System Prompt:
You are a world-class senior frontend engineer specializing in React, TypeScript, and Google Cloud integrations. Your task is to build a comprehensive CRM application for a tire storage business from scratch.

**Название Приложения:** Tire Storage CRM

**Основные Технологии:**
*   **Frontend:** React, TypeScript, React Router, Tailwind CSS.
*   **Backend:** Google Sheets acting as a database, accessed via a Google Apps Script (GAS) deployed as a web app.
*   **API Communication:** The frontend communicates with the GAS URL by sending \`POST\` requests with a JSON payload specifying the desired \`action\`.
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
            <p><b>Версия приложения:</b> 1.2.0</p>
            
            <Expander title="Подробное описание функций" isExpanded={isDescriptionExpanded} setExpanded={setIsDescriptionExpanded}>
                <div dangerouslySetInnerHTML={{ __html: formattedDescription }} />
            </Expander>

            <Expander title="Промт для воссоздания CRM" isExpanded={isPromptExpanded} setExpanded={setIsPromptExpanded}>
                    <div className="relative">
                        <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[60vh]">
                            <code>{promptText.trim()}</code>
                        </pre>
                        <button onClick={() => onCopy(promptText)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                    </div>
            </Expander>
        </div>
    );
};


interface SettingsProps {
  initialSettings: SettingsType;
  initialTemplates: MessageTemplate[];
  initialMasters: Master[];
  clients: Client[];
  onSave: () => void;
  needsSetup: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ initialSettings, initialTemplates, initialMasters, clients, onSave, needsSetup }) => {
  const [activeTab, setActiveTab] = useState(needsSetup ? 'gas' : 'general');
  const [settings, setSettings] = useState(initialSettings);
  const [templates, setTemplates] = useState(initialTemplates);
  const [masters, setMasters] = useState(initialMasters);
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
   useEffect(() => {
    setMasters(initialMasters);
  }, [initialMasters]);

  const handleSettingsChange = (field: keyof SettingsType, value: string) => {
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
        { id: 'masters', label: 'Мастера', icon: <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.25 1.25 0 002.228-1.417a6.002 6.002 0 019.614 0a1.25 1.25 0 002.228 1.417a8.502 8.502 0 00-14.07 0z" /></svg> },
        { id: 'logs', label: 'Логи', icon: <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg> },
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
        {activeTab === 'masters' && <MastersTab masters={masters} setMasters={setMasters} clients={clients} showToast={addLocalToast} />}
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