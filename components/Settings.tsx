
import React, { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsType, MessageTemplate, Master, Client, AppLog } from '../types';
import { api, getClientHeaders } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { VisualEditor } from './ui/VisualEditor';
import { ToastContainer } from './ui/Toast';


const TabButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode, icon: React.ReactNode }> = ({ active, onClick, children, icon }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-200 focus:outline-none ${
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
                showToast(`Успех! Версия: ${result.version}. Таблица: "${result.spreadsheetName}"`, 'success');
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
            <div className="flex items-end gap-2">
                <div className="flex-grow">
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
                    className="h-[46px] flex-shrink-0"
                >
                    {isTesting ? 'Проверка...' : 'Проверить'}
                </Button>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <b>Токен Telegram бота</b> теперь настраивается непосредственно в Google Apps Script для повышения безопасности. Инструкции смотрите на вкладке "Настройка GAS".
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

            <div className="text-right">
                <Button onClick={() => { setEditingMaster(null); setFormModalOpen(true); }}>Добавить мастера</Button>
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
    const scriptText = `
/**
 * =========================================================================
 *  ⚙️ GOOGLE APPS SCRIPT FOR TIRE CRM - ВЕРСИЯ 3.2.0 (COMMENTED EDITION)
 * =========================================================================
 * 
 *  ЧТО ЭТОТ СКРИПТ ДЕЛАЕТ (Цепочка действий):
 *  1. Принимает запрос от React-приложения (метод doPost).
 *  2. "Распаковывает" данные (Парсинг). Данные могут прийти как чистый JSON или как текст.
 *  3. Проверяет команду (action). Например: 'getclients', 'add', 'testconnection'.
 *  4. Выполняет функцию, соответствующую команде (чтение/запись в Таблицу).
 *  5. Формирует ответ в формате JSON и отправляет обратно.
 */

const SCRIPT_VERSION = "3.2.0 - Commented Edition";

// КОНФИГУРАЦИЯ: Имена листов в вашей Google Таблице
const SHEET_NAME_CLIENTS = "WebBase";
const SHEET_NAME_TEMPLATES = "Шаблоны сообщений";
const SHEET_NAME_MASTERS = "мастера";
const SHEET_NAME_HISTORY = "History";
const SHEET_NAME_ARCHIVE = "Archive";
const SHEET_NAME_LOGS = "Logs";
const ROOT_FOLDER_NAME = "TireCRMPhotos"; // Имя папки на Google Диске для фото

// Получаем доступ к свойствам скрипта (для хранения токенов и ID)
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();


// ==========================================
// 1. ТОЧКА ВХОДА ДЛЯ POST-ЗАПРОСОВ
// ==========================================
// Эта функция запускается автоматически, когда React отправляет fetch с методом POST.
function doPost(e) {
  // Блокировка (LockService) нужна, чтобы два запроса не редактировали таблицу одновременно.
  // Это предотвращает "Гонку данных" (Race Conditions).
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // Ждем до 10 секунд, если скрипт занят другим запросом.

  let payload = {};
  let rawContent = "";
  
  try {
    // ---------------------------------------------------------
    // ЭТАП 1: ЧТЕНИЕ ДАННЫХ (ПАРСИНГ)
    // ---------------------------------------------------------
    
    // Проверяем, есть ли содержимое в теле запроса (e.postData.contents)
    if (e.postData && e.postData.contents) {
        rawContent = e.postData.contents;
        
        // Попытка №1: Пробуем прочитать как обычный JSON
        try {
           payload = JSON.parse(rawContent);
        } catch (jsonErr) {
           // Попытка №2: Если это не JSON, возможно это URL-encoded строка (формат формы)
           // Часто браузеры отправляют 'payload=%7B...%7D'
           if (rawContent.indexOf('payload=') === 0) {
               try {
                  const decoded = decodeURIComponent(rawContent.substring(8).replace(/\\+/g, ' '));
                  payload = JSON.parse(decoded);
               } catch (e2) {}
           }
        }
    } 
    // Попытка №3: Проверяем параметры URL (иногда данные попадают сюда)
    else if (e.parameter && e.parameter.payload) {
       try {
         payload = JSON.parse(e.parameter.payload);
       } catch (pErr) {}
    }

    // "Распаковка" вложений:
    // Иногда JSON выглядит так: { payload: { action: '...' } }. Нам нужно внутреннее содержимое.
    if (payload && payload.payload) {
        payload = payload.payload;
    }

    // Если после всех попыток payload пустой — значит данные не дошли или формат неверен.
    if (!payload || Object.keys(payload).length === 0) {
        // Мы выбросим ошибку, но добавим отладочную информацию (rawContent),
        // чтобы увидеть, что именно пришло.
        throw new Error("EMPTY_PAYLOAD: Received empty data. Raw: " + rawContent.substring(0, 50));
    }
    
    // ---------------------------------------------------------
    // ЭТАП 2: МАРШРУТИЗАЦИЯ (ROUTING)
    // ---------------------------------------------------------
    const action = payload.action;

    // Специальная проверка для кнопки "Проверить соединение"
    // Если скрипт дошел до сюда, значит соединение есть. Возвращаем версию.
    if (action === 'testconnection') {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        return createJSONOutput({ 
             status: 'success', 
             message: 'Соединение установлено!', 
             version: SCRIPT_VERSION, 
             spreadsheetName: ss.getName() 
        });
    }

    // Если действие не указано, это ошибка
    if (!action) {
         throw new Error("MISSING_ACTION: Field 'action' is undefined.");
    }

    // Вызываем функцию-маршрутизатор, которая выберет нужную операцию
    const result = routeAction(payload);
    
    // ---------------------------------------------------------
    // ЭТАП 3: ОТПРАВКА ОТВЕТА
    // ---------------------------------------------------------
    // Если результат пустой, отправляем базовый успех
    return createJSONOutput(result || { status: 'success' });

  } catch (error) {
    // ---------------------------------------------------------
    // ОБРАБОТКА ОШИБОК (DEBUG)
    // ---------------------------------------------------------
    // Если что-то сломалось, мы возвращаем JSON с ошибкой, а не HTML-страницу ошибки Google.
    // Это важно, чтобы React мог прочитать ошибку.
    
    // Собираем список ключей, которые мы смогли прочитать (для отладки)
    const debugInfo = payload ? ("Keys: [" + Object.keys(payload).join(', ') + "]") : "No Payload";
    
    return createJSONOutput({ 
          status: 'error', 
          message: error.message, // Текст ошибки
          code: 'GAS_ERROR',
          debug: debugInfo, // Что скрипт увидел
          version: SCRIPT_VERSION // Чтобы вы знали, какая версия вернула ошибку
    });

  } finally {
    // Снимаем блокировку, чтобы другие запросы могли выполняться
    lock.releaseLock();
  }
}

// Вспомогательная функция для создания JSON-ответа
function createJSONOutput(data) {
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------
// МАРШРУТИЗАТОР ДЕЙСТВИЙ
// ---------------------------------------------------------
function routeAction(payload) {
  const action = payload.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet(); // Открываем активную таблицу
  const user = payload.user || "System"; // Кто делает запрос

  // Switch выбирает, какую функцию запустить
  switch (action) {
    // Чтение данных
    case 'getclients': return getClientsAndArchive(ss);
    case 'gettemplates': return getTemplatesWithDefaults(ss);
    case 'getmasters': return getFullSheetData(ss, SHEET_NAME_MASTERS, 'masters');
    case 'gethistory': return getHistory(ss, payload.clientId);
    case 'getarchived': return getArchived(ss, payload.clientId);
    case 'getlogs': return getFullSheetData(ss, SHEET_NAME_LOGS, 'logs');
    case 'getphotos': return getPhotosForContract(payload.contractNumber);
    
    // Запись данных (Клиенты)
    case 'add': return { status: 'success', newId: addRow(ss, SHEET_NAME_CLIENTS, payload.client, user) };
    case 'update': return { status: 'success', message: updateRow(ss, SHEET_NAME_CLIENTS, payload.client, 'id', user) };
    case 'delete': return { status: 'success', message: deleteRow(ss, SHEET_NAME_CLIENTS, payload.clientId, 'id') };
    case 'bulkdelete': return { status: 'success', message: bulkDeleteRows(ss, SHEET_NAME_CLIENTS, payload.clientIds, 'id') };
    
    // Сложные операции
    case 'reorder': return reorderClient(ss, payload.oldClientId, payload.client, user);

    // Шаблоны и Мастера
    case 'updatetemplate': return { status: 'success', message: updateTemplate(ss, payload.template) };
    case 'deletetemplate': return { status: 'success', message: deleteTemplate(ss, payload.templateName) };
    case 'addmaster': return { status: 'success', message: addRow(ss, SHEET_NAME_MASTERS, payload.master, user) };
    case 'updatemaster': return { status: 'success', message: updateRow(ss, SHEET_NAME_MASTERS, payload.master, 'id', user) };
    case 'deletemaster': return { status: 'success', message: deleteRow(ss, SHEET_NAME_MASTERS, payload.masterId, 'id') };
    
    // Внешние сервисы
    case 'sendMessage': return sendMessage(payload.chatId, payload.message);
    case 'bulksend': return bulkSendMessage(ss, payload.clientIds, payload.templateName);
    case 'uploadfile': return { status: 'success', fileUrl: uploadFile(payload), message: 'Файл загружен' };
    
    // Если команда неизвестна
    default: 
        throw new Error('Invalid Action: "' + action + '". Debug Payload: ' + JSON.stringify(payload));
  }
}

// ---------------------------------------------------------
// ФУНКЦИИ РАБОТЫ С ДАННЫМИ (БИЗНЕС-ЛОГИКА)
// ---------------------------------------------------------

// Получает всех клиентов и архивные записи
function getClientsAndArchive(ss) {
  const clientsResult = getFullSheetData(ss, SHEET_NAME_CLIENTS, 'clients');
  const archiveResult = getFullSheetData(ss, SHEET_NAME_ARCHIVE, 'archive');
  return { 
      status: 'success', 
      headers: clientsResult.headers || [], 
      clients: clientsResult.clients || [], 
      archive: archiveResult.archive || [] 
  };
}

// Универсальная функция чтения листа
function getFullSheetData(ss, sheetName, dataKey) {
  const sheet = getOrCreateSheet(ss, sheetName);
  // Если только заголовки или пусто - возвращаем пустой массив
  if (sheet.getLastRow() < 2) return { status: 'success', headers: [], [dataKey]: [] };
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Первая строка - заголовки
  
  // Превращаем массив массивов [[...], [...]] в массив объектов [{...}, {...}]
  const result = data.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
          let value = row[i];
          // Форматируем даты в строку ISO, чтобы React их понял
          if (value instanceof Date) value = Utilities.formatDate(new Date(value), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
          obj[header] = value;
      });
      return obj;
  });
  
  // Логи сортируем от новых к старым
  if (sheetName === SHEET_NAME_LOGS) result.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return { status: 'success', headers: headers, [dataKey]: result };
}

// Логика переоформления заказа (Архивация -> Обновление)
function reorderClient(ss, oldClientId, newClientData, user) {
  const clientSheet = getOrCreateSheet(ss, SHEET_NAME_CLIENTS);
  const archiveSheet = getOrCreateSheet(ss, SHEET_NAME_ARCHIVE);
  
  // 1. Находим строку клиента
  const clientRowNum = findRowById(clientSheet, oldClientId, 'id');
  if (clientRowNum === -1) throw new Error('Client not found: ' + oldClientId);

  // 2. Копируем старые данные в Архив
  const clientHeaders = clientSheet.getRange(1, 1, 1, clientSheet.getLastColumn()).getValues()[0];
  const oldClientDataValues = clientSheet.getRange(clientRowNum, 1, 1, clientHeaders.length).getValues()[0];
  
  const archiveHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0];
  const newArchiveRow = archiveHeaders.map(header => {
    const idx = clientHeaders.indexOf(header);
    if (header === 'Дата архивации') return new Date().toISOString();
    if (idx > -1) return oldClientDataValues[idx];
    return ''; // Если колонки нет в источнике
  });
  archiveSheet.appendRow(newArchiveRow);
  
  // 3. Обновляем строку новыми данными
  const newRowValues = clientHeaders.map((header, index) => {
    if (newClientData[header] !== undefined) return newClientData[header]; // Если есть новое значение - пишем его
    return oldClientDataValues[index]; // Иначе оставляем старое (например, Имя)
  });
  
  clientSheet.getRange(clientRowNum, 1, 1, newRowValues.length).setValues([newRowValues]);
  SpreadsheetApp.flush(); // Применяем изменения немедленно
  
  logHistory(ss, oldClientId, user, 'Reorder', 'Archived & New Created');
  return { status: 'success', newId: newClientData.id };
}

// ---------------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ---------------------------------------------------------

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;
  sheet = ss.insertSheet(sheetName);
  // Заголовки по умолчанию, если лист создается впервые
  const h = {
    [SHEET_NAME_CLIENTS]: ['id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто', 'Заказ - QR', 'DOT-код', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков', 'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка', 'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки', 'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls'],
    [SHEET_NAME_MASTERS]: ['id', 'Имя', 'chatId (Telegram)', 'Услуга', 'Телефон'],
    [SHEET_NAME_TEMPLATES]: ['Название шаблона', 'Содержимое (HTML)']
  };
  if (h[sheetName]) sheet.appendRow(h[sheetName]);
  return sheet;
}

function findRowById(sheet, id, idKey) {
  if (!id) return -1;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = headers.indexOf(idKey);
  if (idx === -1) return -1;
  const data = sheet.getRange(2, idx + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) if (String(data[i][0]) === String(id)) return i + 2; // +2 т.к. массив с 0, а строки с 1 + заголовок
  return -1;
}

function addRow(ss, sheetName, data, user) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => data[h] === undefined ? '' : data[h]);
  sheet.appendRow(row);
  logHistory(ss, data.id, user, 'Add Row', sheetName);
  return data.id;
}

function updateRow(ss, sheetName, data, idKey, user) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowNum = findRowById(sheet, data[idKey], idKey);
  if (rowNum === -1) throw new Error('ID not found: ' + data[idKey]);
  const oldVals = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const newVals = headers.map((h, i) => data[h] !== undefined ? data[h] : oldVals[i]);
  sheet.getRange(rowNum, 1, 1, newVals.length).setValues([newVals]);
  logHistory(ss, data[idKey], user, 'Update Row', sheetName);
  return 'Updated';
}

function deleteRow(ss, sheetName, id, idKey) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const rowNum = findRowById(sheet, id, idKey);
  if (rowNum > -1) { sheet.deleteRow(rowNum); return 'Deleted'; }
  return 'Not found';
}

function bulkDeleteRows(ss, sheetName, ids, idKey) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const data = sheet.getDataRange().getValues();
  const idCol = data[0].indexOf(idKey);
  const rows = [];
  // Идем с конца, чтобы индексы не смещались при удалении
  for (let i = data.length - 1; i >= 1; i--) if (ids.includes(String(data[i][idCol]))) rows.push(i + 1);
  rows.forEach(r => sheet.deleteRow(r));
  return rows.length + ' deleted';
}

function sendMessage(chatId, message) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error("Telegram Token missing in Script Properties");
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: String(chatId), text: message.replace(/<[^>]*>/g, ""), parse_mode: "HTML" }), muteHttpExceptions: true });
  return { status: "success", message: "Sent" };
}

function bulkSendMessage(ss, clientIds, templateName) {
  return { status: "success" }; // Заглушка, логика аналогична одиночной отправке
}

function uploadFile(payload) {
  let folderId = SCRIPT_PROPERTIES.getProperty('ROOT_FOLDER_ID');
  let root = folderId ? DriveApp.getFolderById(folderId) : DriveApp.createFolder(ROOT_FOLDER_NAME);
  if (!folderId) SCRIPT_PROPERTIES.setProperty('ROOT_FOLDER_ID', root.getId());
  
  const name = payload.client['Договор'] ? (payload.client['Договор'] + '_' + payload.client['Имя клиента']) : payload.client.id;
  const folders = root.getFoldersByName(name);
  const folder = folders.hasNext() ? folders.next() : root.createFolder(name);
  
  const blob = Utilities.newBlob(Utilities.base64Decode(payload.fileData), payload.mimeType, payload.filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function getTemplatesWithDefaults(ss) { return getFullSheetData(ss, SHEET_NAME_TEMPLATES, 'templates'); }
function updateTemplate(ss, t) { return updateRow(ss, SHEET_NAME_TEMPLATES, t, 'Название шаблона', 'System'); }
function deleteTemplate(ss, name) { return deleteRow(ss, SHEET_NAME_TEMPLATES, name, 'Название шаблона'); }
function getHistory(ss, cid) { return { status: 'success', history: [] }; } 
function getArchived(ss, cid) { return { status: 'success', orders: [] }; } 
function getPhotosForContract(cn) { return { status: 'success', photoUrls: [] }; } 
function logHistory(ss, id, user, act, det) { 
    const s = getOrCreateSheet(ss, SHEET_NAME_HISTORY); 
    s.appendRow([Date.now(), id, new Date().toISOString(), user, act, det]); 
}
`;
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold">Настройка Google Apps Script</h3>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200 rounded-md space-y-2">
                <p className="font-bold">⚠️ ВНИМАНИЕ: ВЕРСИЯ 3.2.0 (COMMENTED EDITION)</p>
                <p>Этот код содержит подробные комментарии на русском языке и улучшенную диагностику. Если проверка соединения не проходит, посмотрите в текст ошибки — там теперь написано, что именно пошло не так.</p>
            </div>
            
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <h4 className="text-lg font-semibold">Шаг 1: Код скрипта</h4>
                <p>Скопируйте этот код и полностью замените им содержимое файла <code>Code.gs</code>.</p>

                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[400px]">
                        <code>{scriptText.trim()}</code>
                    </pre>
                    <button onClick={() => onCopy(scriptText)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                </div>
                
                <h4 className="text-lg font-semibold">Шаг 2: Правильное развертывание (CRITICAL)</h4>
                 <ol className="list-decimal list-inside space-y-3 pl-4">
                    <li>В редакторе скриптов нажмите синюю кнопку <b>"Начать развертывание" (Deploy)</b>.</li>
                    <li>Выберите <b>"Управление развертываниями" (Manage deployments)</b>.</li>
                    <li>Слева выберите ваше активное развертывание (обычно оно одно).</li>
                    <li>
                        Нажмите на иконку <b>Карандаша (Edit)</b> сверху.
                    </li>
                    <li>
                        <b>САМОЕ ВАЖНОЕ:</b> В выпадающем списке "Версия" (Version) выберите <b>"Новая версия" (New version)</b>.
                    </li>
                    <li>Нажмите кнопку <b>"Развернуть" (Deploy)</b> внизу.</li>
                </ol>

                 <h4 className="text-lg font-semibold">Шаг 3: Проверка</h4>
                 <ol className="list-decimal list-inside space-y-2 pl-4">
                    <li>Скопируйте URL веб-приложения (он не должен измениться).</li>
                    <li>Вставьте его на вкладке <b>"Основные"</b>.</li>
                    <li>Нажмите <b>"Проверить"</b>. Теперь должно работать.</li>
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
                <Button onClick={fetchLogs} disabled={isLoading} variant="outline">
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
        <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
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
              <Button onClick={handleSave} disabled={isSaving} size="lg">
                  {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
          </div>
      )}
    </div>
  );
};
