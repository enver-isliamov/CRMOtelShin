
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
    const crmCodeText = `/**
 * ==========================================
 *  ВЕРСИЯ CRM: 3.3.1 (Renamed for compatibility)
 * ==========================================
 */

// --- КОНФИГУРАЦИЯ CRM ---
const CRM_SCRIPT_VERSION = "3.3.1 - Merged";
const SHEET_NAME_CLIENTS = "WebBase";
const SHEET_NAME_TEMPLATES = "Шаблоны сообщений";
const SHEET_NAME_MASTERS = "мастера";
const SHEET_NAME_HISTORY = "History";
const SHEET_NAME_ARCHIVE = "Archive";
const SHEET_NAME_LOGS = "Logs";
const ROOT_FOLDER_NAME = "TireCRMPhotos"; 
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// --- ВХОДНЫЕ ТОЧКИ (Переименованы) ---

function doGetCRM(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "success", message: "CRM Service is running.", version: CRM_SCRIPT_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPostCRM(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); 

  let payload = {};
  
  try {
    let requestBody;
    
    // 1. Проверяем параметры (форма)
    if (e && e.parameter && e.parameter.payload) {
      requestBody = e.parameter.payload;
    } 
    // 2. Проверяем тело (raw JSON)
    else if (e && e.postData && e.postData.contents) {
      requestBody = e.postData.contents;
    }

    if (!requestBody) throw new Error("Empty Payload in CRM request");

    try {
        payload = JSON.parse(requestBody);
    } catch (err) {
        if (requestBody.indexOf('payload=') === 0) {
             const decoded = decodeURIComponent(requestBody.substring(8).replace(/\\+/g, ' '));
             payload = JSON.parse(decoded);
        } else {
             throw new Error("JSON Parse Error");
        }
    }
    
    if (payload.payload) payload = payload.payload;

    const result = routeActionCRM(payload);
    const finalResult = (result && result.status) ? result : { status: 'success', ...result };
    
    return ContentService.createTextOutput(JSON.stringify(finalResult)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    crmLogError(ss, (payload ? payload.user : "System"), (payload ? payload.action : "Unknown"), error);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- МАРШРУТИЗАТОР CRM ---
function routeActionCRM(payload) {
  const action = payload.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const user = payload.user || "System";

  switch (action) {
    case 'testconnection': return { status: 'success', message: 'Соединение ОК!', version: CRM_SCRIPT_VERSION };
    case 'getclients': return crmGetClientsAndArchive(ss);
    case 'gettemplates': return crmGetTemplatesWithDefaults(ss);
    case 'getmasters': return crmGetFullSheetData(ss, SHEET_NAME_MASTERS, 'masters');
    case 'gethistory': return crmGetHistory(ss, payload.clientId);
    case 'getarchived': return crmGetArchived(ss, payload.clientId);
    case 'getlogs': return crmGetFullSheetData(ss, SHEET_NAME_LOGS, 'logs');
    case 'getphotos': return crmGetPhotosForContract(payload.contractNumber);
    case 'add': return { status: 'success', newId: crmAddRow(ss, SHEET_NAME_CLIENTS, payload.client, user) };
    case 'update': return { status: 'success', message: crmUpdateRow(ss, SHEET_NAME_CLIENTS, payload.client, 'id', user) };
    case 'delete': return { status: 'success', message: crmDeleteRow(ss, SHEET_NAME_CLIENTS, payload.clientId, 'id') };
    case 'bulkdelete': return { status: 'success', message: crmBulkDeleteRows(ss, SHEET_NAME_CLIENTS, payload.clientIds, 'id') };
    case 'reorder': return crmReorderClient(ss, payload.oldClientId, payload.client, user);
    case 'updatetemplate': return { status: 'success', message: crmUpdateTemplate(ss, payload.template) };
    case 'deletetemplate': return { status: 'success', message: crmDeleteTemplate(ss, payload.templateName) };
    case 'addmaster': return { status: 'success', message: crmAddRow(ss, SHEET_NAME_MASTERS, payload.master, user) };
    case 'updatemaster': return { status: 'success', message: crmUpdateRow(ss, SHEET_NAME_MASTERS, payload.master, 'id', user) };
    case 'deletemaster': return { status: 'success', message: crmDeleteRow(ss, SHEET_NAME_MASTERS, payload.masterId, 'id') };
    
    // ВАЖНО: Используем crmSendMessage, чтобы не конфликтовать со старым кодом
    case 'sendMessage': return crmSendMessage(payload.chatId, payload.message);
    case 'bulksend': return crmBulkSendMessage(ss, payload.clientIds, payload.templateName);
    case 'uploadfile': return { status: 'success', fileUrl: crmUploadFile(payload), message: 'Файл загружен' };
    default: return { status: 'error', message: 'Unknown action: ' + action };
  }
}

// --- БИЗНЕС-ЛОГИКА (С префиксом crm для изоляции) ---

function crmGetClientsAndArchive(ss) {
  const clientsResult = crmGetFullSheetData(ss, SHEET_NAME_CLIENTS, 'clients');
  const archiveResult = crmGetFullSheetData(ss, SHEET_NAME_ARCHIVE, 'archive');
  return { status: 'success', headers: clientsResult.headers || [], clients: clientsResult.clients || [], archive: archiveResult.archive || [] };
}

function crmGetHistory(ss, clientId) {
  try {
    const sheet = crmGetOrCreateSheet(ss, SHEET_NAME_HISTORY);
    if (sheet.getLastRow() < 2) return { status: 'success', history: [] };
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const clientIdIndex = headers.indexOf('clientId');
    if (clientIdIndex === -1) return { status: 'success', history: [] };
    const history = data.filter(row => row[clientIdIndex] == clientId).map(row => {
        let obj = {}; headers.forEach((header, i) => { obj[header] = row[i]; }); return obj;
    }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { status: 'success', history: history };
  } catch(e) { return { status: 'error', message: e.message }; }
}

function crmGetArchived(ss, clientId) {
  const clientSheet = crmGetOrCreateSheet(ss, SHEET_NAME_CLIENTS);
  const clientRowNum = crmFindRowById(clientSheet, clientId, 'id');
  if (clientRowNum === -1) return { status: 'success', orders: [] };
  const clientHeaders = clientSheet.getRange(1, 1, 1, clientSheet.getLastColumn()).getValues()[0];
  const clientData = clientSheet.getRange(clientRowNum, 1, 1, clientHeaders.length).getValues()[0];
  const phoneIndex = clientHeaders.indexOf('Телефон');
  const clientPhone = phoneIndex > -1 ? clientData[phoneIndex] : null;
  if (!clientPhone) return { status: 'success', orders: [] }; 
  const archiveSheet = crmGetOrCreateSheet(ss, SHEET_NAME_ARCHIVE);
  if (archiveSheet.getLastRow() < 2) return { status: 'success', orders: [] };
  const data = archiveSheet.getDataRange().getValues();
  const headers = data.shift();
  const phoneIndexInArchive = headers.indexOf('Телефон');
  if (phoneIndexInArchive === -1) return { status: 'success', orders: [] };
  const orders = data.filter(row => row[phoneIndexInArchive] == clientPhone).map(row => {
      let obj = {}; headers.forEach((header, i) => { 
        let value = row[i]; if (value instanceof Date) value = Utilities.formatDate(new Date(value), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"); obj[header] = value;
      }); return obj;
  }).sort((a,b) => new Date(b['Дата добавления']).getTime() - new Date(a['Дата добавления']).getTime());
  return { status: 'success', orders: orders };
}

function crmGetPhotosForContract(contractNumber) {
  if (!contractNumber) return { status: 'success', photoUrls: [] };
  try {
    const rootFolder = crmGetAppRootFolder();
    const folders = rootFolder.getFolders();
    let clientFolder = null;
    while (folders.hasNext()) { const folder = folders.next(); if (folder.getName().startsWith(contractNumber)) { clientFolder = folder; break; } }
    if (!clientFolder) return { status: 'success', photoUrls: [] };
    const photoUrls = []; const files = clientFolder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) { try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {} }
      photoUrls.push('https://drive.google.com/uc?export=view&id=' + file.getId());
    }
    return { status: 'success', photoUrls: photoUrls };
  } catch(e) { return { status: 'success', photoUrls: [] }; }
}

function crmBulkSendMessage(ss, clientIds, templateName) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error("Токен Telegram не настроен.");
  const templatesData = crmGetTemplatesWithDefaults(ss);
  const template = templatesData.templates.find(t => t['Название шаблона'] === templateName);
  if (!template) throw new Error('Шаблон "' + templateName + '" не найден.');
  const clientsData = crmGetFullSheetData(ss, SHEET_NAME_CLIENTS, 'clients');
  const clientsToSend = clientsData.clients.filter(c => clientIds.includes(c.id));
  clientsToSend.forEach(client => {
    if (client['Chat ID']) {
      let message = template['Содержимое (HTML)'];
      Object.keys(client).forEach(key => { message = message.replace(new RegExp('{{' + key + '}}', 'g'), client[key] || ''); });
      crmSendMessage(client['Chat ID'], message);
    }
  });
  return { status: "success", message: "Рассылка завершена."};
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Изолированные имена) ---

function crmGetFullSheetData(ss, sheetName, dataKey) {
  try {
    const sheet = crmGetOrCreateSheet(ss, sheetName);
    if (sheet.getLastRow() < 2) return { status: 'success', headers: [], [dataKey]: [] };
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const result = data.map(row => {
        let obj = {}; headers.forEach((header, i) => { let value = row[i]; if (value instanceof Date) value = Utilities.formatDate(new Date(value), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"); obj[header] = value; }); return obj;
    });
    if (sheetName === SHEET_NAME_LOGS) result.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { status: 'success', headers: headers, [dataKey]: result };
  } catch (e) { throw new Error('Could not get data from sheet: ' + sheetName); }
}

function crmGetOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;
  sheet = ss.insertSheet(sheetName);
  const defaultHeaders = {
    [SHEET_NAME_CLIENTS]: ['id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто', 'Заказ - QR', 'Бренд_Модель', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков', 'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка', 'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки', 'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls'],
    [SHEET_NAME_ARCHIVE]: ['id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто', 'Заказ - QR', 'Бренд_Модель', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков', 'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка', 'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки', 'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls', 'Дата архивации'],
    [SHEET_NAME_TEMPLATES]: ['Название шаблона', 'Содержимое (HTML)'],
    [SHEET_NAME_MASTERS]: ['id', 'Имя', 'chatId (Telegram)', 'Услуга', 'Телефон'],
    [SHEET_NAME_HISTORY]: ['id', 'clientId', 'timestamp', 'user', 'action', 'details'],
    [SHEET_NAME_LOGS]: ['timestamp', 'level', 'user', 'action', 'message', 'details']
  };
  if (defaultHeaders[sheetName]) { sheet.appendRow(defaultHeaders[sheetName]); sheet.setFrozenRows(1); sheet.getRange(1, 1, 1, defaultHeaders[sheetName].length).setFontWeight("bold"); }
  return sheet;
}

function crmFindRowById(sheet, id, idKey) {
  if (!id) return -1;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColIndex = headers.indexOf(idKey);
  if (idColIndex === -1) return -1;
  const data = sheet.getRange(2, idColIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) { if (String(data[i][0]) === String(id)) return i + 2; }
  return -1;
}

function crmAddRow(ss, sheetName, dataObject, user) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => dataObject[header] === undefined ? '' : dataObject[header]);
  sheet.appendRow(newRow);
  const action = sheetName === SHEET_NAME_CLIENTS ? 'Клиент создан' : 'Запись добавлена';
  const clientId = sheetName === SHEET_NAME_CLIENTS ? dataObject.id : null;
  const details = Object.entries(dataObject).map(([key, value]) => key + ': ' + value).join('\n');
  crmLogHistory(ss, clientId, user, action, details);
  return dataObject.id;
}

function crmUpdateRow(ss, sheetName, dataObject, idKey, user) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowNum = crmFindRowById(sheet, dataObject[idKey], idKey);
  if (rowNum === -1) throw new Error('Update failed: ID not found');
  const oldDataValues = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const oldData = headers.reduce((obj, header, i) => ({...obj, [header]: oldDataValues[i]}), {});
  const newRow = headers.map(header => dataObject[header] !== undefined ? dataObject[header] : oldData[header]);
  sheet.getRange(rowNum, 1, 1, newRow.length).setValues([newRow]);
  const changes = headers.map(header => ({ header, old: oldData[header], new: dataObject[header] })).filter(({ old, new: newValue }) => newValue !== undefined && String(old) !== String(newValue)).map(({header, old, new: newValue}) => header + ": '" + old + "' -> '" + newValue + "'");
  if (changes.length > 0 && sheetName === SHEET_NAME_CLIENTS) { crmLogHistory(ss, dataObject.id, user, 'Данные обновлены', changes.join('\n')); }
  return 'Updated';
}

function crmDeleteRow(ss, sheetName, id, idKey) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const rowNum = crmFindRowById(sheet, id, idKey);
  if (rowNum > -1) { sheet.deleteRow(rowNum); return 'Deleted'; }
  return 'Not found';
}

function crmBulkDeleteRows(ss, sheetName, ids, idKey) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const data = sheet.getDataRange().getValues();
  const idCol = data[0].indexOf(idKey);
  const rows = [];
  for (let i = data.length - 1; i >= 1; i--) if (ids.includes(String(data[i][idCol]))) rows.push(i + 1);
  rows.forEach(r => sheet.deleteRow(r));
  return rows.length + ' записей удалено.';
}

function crmReorderClient(ss, oldClientId, newClientData, user) {
  const clientSheet = crmGetOrCreateSheet(ss, SHEET_NAME_CLIENTS);
  const archiveSheet = crmGetOrCreateSheet(ss, SHEET_NAME_ARCHIVE);
  const clientRowNum = crmFindRowById(clientSheet, oldClientId, 'id');
  if (clientRowNum === -1) throw new Error('Не удалось найти клиента: ' + oldClientId);
  const clientHeaders = clientSheet.getRange(1, 1, 1, clientSheet.getLastColumn()).getValues()[0];
  const oldClientDataValues = clientSheet.getRange(clientRowNum, 1, 1, clientHeaders.length).getValues()[0];
  const archiveHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0];
  const newArchiveRow = archiveHeaders.map(header => {
    const idx = clientHeaders.indexOf(header); if (header === 'Дата архивации') return new Date().toISOString(); if (idx > -1) return oldClientDataValues[idx]; return '';
  });
  archiveSheet.appendRow(newArchiveRow);
  const newRowValues = clientHeaders.map((header, index) => { if (newClientData[header] !== undefined) return newClientData[header]; return oldClientDataValues[index]; });
  clientSheet.getRange(clientRowNum, 1, 1, newRowValues.length).setValues([newRowValues]);
  crmLogHistory(ss, oldClientId, user, 'Заказ архивирован', 'Перенос в архив');
  crmLogHistory(ss, newClientData.id, user, 'Новый заказ создан', 'Обновление записи');
  return { status: 'success', message: 'Заказ успешно переоформлен.', newId: newClientData.id };
}

// --- TELEGRAM И ФАЙЛЫ (Имена изменены) ---
function crmSendMessage(chatId, message) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error("Токен Telegram не настроен.");
  const sanitizedMessage = message.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<p.*?>/gi, '').replace(/&nbsp;/g, ' ').trim();
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: String(chatId), text: sanitizedMessage, parse_mode: "HTML" }), muteHttpExceptions: true });
  return { status: "success", message: "Sent" };
}

function crmGetTemplatesWithDefaults(ss) {
  const sheet = crmGetOrCreateSheet(ss, SHEET_NAME_TEMPLATES);
  const defaultTemplates = { 'Напоминание о задолженности': 'Здравствуйте, {{Имя клиента}}! Долг по договору №{{Договор}}: <b>{{Долг}} ₽</b>.', 'Напоминание об окончании хранения': 'Здравствуйте, {{Имя клиента}}! Срок хранения шин (дог. №{{Договор}}) истекает <b>{{Окончание}}</b>.' };
  const data = sheet.getDataRange().getValues();
  const existingTemplates = data.length > 1 ? data.slice(1).map(row => row[0]) : [];
  const templatesToAdd = []; for (const name in defaultTemplates) { if (!existingTemplates.includes(name)) templatesToAdd.push([name, defaultTemplates[name]]); }
  if (templatesToAdd.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, templatesToAdd.length, 2).setValues(templatesToAdd);
  return crmGetFullSheetData(ss, SHEET_NAME_TEMPLATES, 'templates');
}

function crmUpdateTemplate(ss, t) { return crmUpdateRow(ss, SHEET_NAME_TEMPLATES, t, 'Название шаблона', 'System'); }
function crmDeleteTemplate(ss, name) { return crmDeleteRow(ss, SHEET_NAME_TEMPLATES, name, 'Название шаблона'); }

function crmGetAppRootFolder() {
  let folderId = SCRIPT_PROPERTIES.getProperty('ROOT_FOLDER_ID');
  if (folderId) { try { return DriveApp.getFolderById(folderId); } catch(e) {} }
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
  SCRIPT_PROPERTIES.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function crmUploadFile(payload) {
  const root = crmGetAppRootFolder();
  const name = payload.client['Договор'] ? (payload.client['Договор'] + '_' + payload.client['Имя клиента']) : payload.client.id;
  const folders = root.getFoldersByName(name);
  const folder = folders.hasNext() ? folders.next() : root.createFolder(name);
  const blob = Utilities.newBlob(Utilities.base64Decode(payload.fileData), payload.mimeType, payload.filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function crmLogHistory(ss, clientId, user, action, details) {
  try { const s = crmGetOrCreateSheet(ss, SHEET_NAME_HISTORY); s.appendRow(["evt_" + new Date().getTime(), clientId || 'N/A', new Date().toISOString(), user || 'System', action, details]); } catch (e) {}
}

function crmLogError(ss, user, action, error) {
  try { const s = crmGetOrCreateSheet(ss, SHEET_NAME_LOGS); s.appendRow([new Date().toISOString(), "ERROR", user, action, error.message, error.stack]); } catch (e) { Logger.log(e); }
}`;

    const routerCodeText = `/**
 * ГЛАВНЫЙ МАРШРУТИЗАТОР (ROUTER)
 * Решает, куда отправить запрос: в CRM или БОТ.
 */

function doGet(e) {
  return doGetCRM(e); 
}

function doPost(e) {
  // 1. Проверяем, не пришел ли запрос от Telegram
  // Telegram шлет JSON в теле запроса, в котором обязательно есть update_id
  if (e.postData && e.postData.contents) {
     let data = {};
     try {
       data = JSON.parse(e.postData.contents);
     } catch (err) {}

     // Если есть update_id - это вебхук от Telegram
     if (data && data.update_id) {
         return doBot(e);
     }
  }

  // 2. Иначе считаем, что это запрос от CRM (React)
  return doPostCRM(e);
}`;

    const botCodeText = `/**
 * ==========================================
 *  TELEGRAM BOT LOGIC (Bot.gs)
 * ==========================================
 */

// --- КОНФИГУРАЦИЯ БОТА ---
const BOT_TOKEN = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
// ID администраторов и менеджеров для уведомлений о новых заявках
const ADMIN_IDS_PROP = 'adminIds'; // Можно использовать existing script properties или хардкод

// --- KEYBOARDS ---
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "📝 Записаться на хранение" }, { text: "👤 Личный кабинет" }],
    [{ text: "💰 Цены" }, { text: "ℹ️ Почему мы" }],
    [{ text: "📞 Связаться с менеджером" }, { text: "🔧 Шиномонтаж" }]
  ],
  resize_keyboard: true
};

const CABINET_KEYBOARD = {
  inline_keyboard: [
    [{ text: "📅 Продлить хранение", callback_data: "cab_extend" }],
    [{ text: "🚗 Забрать шины", callback_data: "cab_pickup" }],
    [{ text: "🛠 Шиномонтаж", callback_data: "cab_fitting" }, { text: "🎁 Рефералка", callback_data: "cab_ref" }]
  ]
};

// --- ENTRY POINT ---
function doBot(e) {
  const update = JSON.parse(e.postData.contents);
  
  try {
    if (update.message) {
      handleMessage(update.message);
    } else if (update.callback_query) {
      handleCallback(update.callback_query);
    }
  } catch (err) {
    Logger.log("Bot Error: " + err.message);
  }
  
  return ContentService.createTextOutput("OK");
}

// --- HANDLERS ---
function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userCache = CacheService.getScriptCache();
  const state = userCache.get("state_" + chatId);
  
  // 1. GLOBAL COMMANDS
  if (text === "/start") {
    userCache.remove("state_" + chatId);
    return sendBotMessage(chatId, "👋 Добро пожаловать в сервис хранения шин! Выберите действие:", MAIN_KEYBOARD);
  }

  // 2. STATE MACHINE (Registration Flow)
  if (state === "WAITING_PHONE") {
    // Сохраняем телефон, просим номер авто
    const phone = msg.contact ? msg.contact.phone_number : text;
    userCache.put("temp_phone_" + chatId, phone, 3600);
    userCache.put("state_" + chatId, "WAITING_AUTO", 3600);
    return sendBotMessage(chatId, "✅ Телефон принят. Теперь введите гос. номер вашего автомобиля (например, А123ВС777):");
  }

  if (state === "WAITING_AUTO") {
    userCache.put("temp_auto_" + chatId, text, 3600);
    userCache.put("state_" + chatId, "WAITING_DISTRICT", 3600);
    return sendBotMessage(chatId, "🚗 Номер принят. Укажите желаемый район/склад или напишите 'Любой':");
  }

  if (state === "WAITING_DISTRICT") {
    const district = text;
    const phone = userCache.get("temp_phone_" + chatId);
    const auto = userCache.get("temp_auto_" + chatId);
    const name = (msg.from.first_name || "") + " " + (msg.from.last_name || "");
    
    // Notify Managers
    const requestText = \`🆕 <b>Новая заявка на хранение!</b>\\n\\n👤 <b>Клиент:</b> \${name}\\n📞 <b>Телефон:</b> \${phone}\\n🚗 <b>Авто:</b> \${auto}\\n📍 <b>Район:</b> \${district}\\n🆔 ChatID: \${chatId}\`;
    notifyManagers(requestText);
    
    userCache.remove("state_" + chatId);
    return sendBotMessage(chatId, "✅ Заявка отправлена! Менеджер свяжется с вами в ближайшее время для подтверждения.", MAIN_KEYBOARD);
  }
  
  if (state === "WAITING_PICKUP_TIME") {
    const requestText = \`🚗 <b>Заявка на выдачу шин!</b>\\n\\n🆔 ChatID: \${chatId}\\n⏰ <b>Желаемое время:</b> \${text}\`;
    notifyManagers(requestText);
    userCache.remove("state_" + chatId);
    return sendBotMessage(chatId, "✅ Заявка на выдачу принята. Мы проверим наличие и подтвердим время.", MAIN_KEYBOARD);
  }


  // 3. MENU HANDLERS
  switch (text) {
    case "📝 Записаться на хранение":
      userCache.put("state_" + chatId, "WAITING_PHONE", 3600);
      const contactKb = { keyboard: [[{text: "📱 Отправить телефон", request_contact: true}]], resize_keyboard: true, one_time_keyboard: true };
      return sendBotMessage(chatId, "Для записи нам нужен ваш контактный телефон. Нажмите кнопку ниже или введите номер вручную (+7...):", contactKb);
      
    case "👤 Личный кабинет":
      return handleCabinet(chatId);
      
    case "💰 Цены":
      return sendBotMessage(chatId, "💲 <b>Наши цены:</b>\\n\\nR13-R15: 2000р / сезон\\nR16-R17: 2400р / сезон\\nR18+: 3000р / сезон\\n\\n<i>Цена за комплект 4 шины, 6 месяцев.</i>", MAIN_KEYBOARD);
      
    case "ℹ️ Почему мы":
      return sendBotMessage(chatId, "🏆 <b>Почему выбирают нас:</b>\\n\\n✅ Теплый склад\\n✅ Страховка шин\\n✅ Доставка и забор\\n✅ Скидки на шиномонтаж", MAIN_KEYBOARD);
      
    case "📞 Связаться с менеджером":
      return sendBotMessage(chatId, "📞 Наш телефон: +7 (999) 000-00-00\\nTelegram: @Manager", MAIN_KEYBOARD);

    case "🔧 Шиномонтаж":
      return sendBotMessage(chatId, "🛠 Мы сотрудничаем с сетью 'Профи-Шина'.\\n📍 Адрес: ул. Ленина, 10\\n🎁 Скидка 10% для клиентов хранения!", MAIN_KEYBOARD);
      
    default:
      return sendBotMessage(chatId, "Я не понимаю эту команду. Используйте меню.", MAIN_KEYBOARD);
  }
}

function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const data = cb.data;
  
  if (data === "cab_extend") {
    // Show duration options
    const extendKb = {
        inline_keyboard: [
            [{ text: "1 мес", callback_data: "ext_1" }, { text: "3 мес", callback_data: "ext_3" }, { text: "6 мес", callback_data: "ext_6" }]
        ]
    };
    editBotMessage(chatId, cb.message.message_id, "📅 Выберите срок продления:", extendKb);
  } 
  else if (data.startsWith("ext_")) {
    const months = data.split("_")[1];
    // Simple calculation logic
    const price = parseInt(months) * 500; // Base logic
    const text = \`💳 Для продления на \${months} мес. к оплате: <b>\${price} ₽</b>.\\n\\nПереведите сумму по СБП на номер +79990000000 и пришлите скриншот чека в этот чат.\`;
    sendBotMessage(chatId, text);
    // Notify manager
    notifyManagers(\`💰 Клиент \${chatId} хочет продлить хранение на \${months} мес.\`);
  }
  else if (data === "cab_pickup") {
    CacheService.getScriptCache().put("state_" + chatId, "WAITING_PICKUP_TIME", 3600);
    sendBotMessage(chatId, "🕒 Напишите желаемую дату и время, когда вы хотите забрать шины:");
  }
  else if (data === "cab_fitting") {
    sendBotMessage(chatId, "🛠 Партнёрский шиномонтаж:\\nул. Примерная 1\\nЗапись: +79998887766");
  }
  else if (data === "cab_ref") {
    sendBotMessage(chatId, "🎁 Приведи друга и получи месяц хранения бесплатно!\\nТвой промокод: <b>REF" + chatId + "</b>");
  }
  
  // Acknowledge callback to stop loading spinner
  const url = "https://api.telegram.org/bot" + BOT_TOKEN + "/answerCallbackQuery";
  UrlFetchApp.fetch(url, { method: "post", payload: { callback_query_id: cb.id } });
}

function handleCabinet(chatId) {
  // Find client in CRM
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_CLIENTS); // Variable from Code.gs
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const chatCol = headers.indexOf('Chat ID');
  
  let client = null;
  for (let i = 1; i < data.length; i++) {
    // Loose comparison for strings/numbers
    if (data[i][chatCol] == chatId) {
      client = {};
      headers.forEach((h, idx) => client[h] = data[i][idx]);
      break;
    }
  }
  
  if (client) {
    let contractDate = client['Окончание'];
    if (contractDate instanceof Date) contractDate = Utilities.formatDate(contractDate, ss.getSpreadsheetTimeZone(), "dd.MM.yyyy");
    
    const info = \`👤 <b>Личный кабинет</b>\\n\\n📑 Договор: <b>\${client['Договор']}</b>\\n🚗 Авто: \${client['Номер Авто']}\\n📦 Шины: \${client['Кол-во шин']} шт.\\n📅 Хранение до: <b>\${contractDate}</b>\\n📍 Склад: \${client['Склад хранения']}\`;
    sendBotMessage(chatId, info, CABINET_KEYBOARD);
  } else {
    sendBotMessage(chatId, "🚫 Ваш номер не найден в базе. Если вы уже сдали шины, свяжитесь с менеджером для привязки Telegram.", MAIN_KEYBOARD);
  }
}

// --- HELPERS ---
function sendBotMessage(chatId, text, keyboard) {
  if (!BOT_TOKEN) return;
  const payload = {
    chat_id: String(chatId),
    text: text,
    parse_mode: "HTML"
  };
  if (keyboard) payload.reply_markup = keyboard;
  
  UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}

function editBotMessage(chatId, messageId, text, keyboard) {
  if (!BOT_TOKEN) return;
  const payload = {
    chat_id: String(chatId),
    message_id: messageId,
    text: text,
    parse_mode: "HTML"
  };
  if (keyboard) payload.reply_markup = keyboard;
  
  UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/editMessageText", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}

function notifyManagers(text) {
  // Try to get admin IDs from Script Properties first
  let idsStr = SCRIPT_PROPERTIES.getProperty('ADMIN_IDS'); 
  // If not found, rely on what might be saved in Settings logic via UI, but strictly here we rely on properties
  // or you can hardcode a fallback
  if (!idsStr) return; // No admins configured
  
  const ids = idsStr.split(',');
  ids.forEach(id => {
      try {
        sendBotMessage(id.trim(), text);
      } catch(e) {}
  });
}
`;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold">Настройка Google Apps Script (Интеграция)</h3>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 text-blue-800 dark:text-blue-200 rounded-md space-y-2">
                <p className="font-bold">⚠️ ВНИМАНИЕ: МНОГОФАЙЛОВАЯ КОНФИГУРАЦИЯ</p>
                <p>Теперь проект состоит из трех файлов для разделения логики CRM и Telegram Бота.</p>
            </div>
            
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <h4 className="text-lg font-semibold">Файл 1: Code.gs (Логика CRM)</h4>
                <p>Основной файл с бизнес-логикой работы с таблицами.</p>
                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[250px]">
                        <code>{crmCodeText.trim()}</code>
                    </pre>
                    <button onClick={() => onCopy(crmCodeText)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                </div>

                <h4 className="text-lg font-semibold mt-6">Файл 2: Bot.gs (Логика Бота)</h4>
                <p>Создайте файл <code>Bot.gs</code>. Он отвечает за меню, запись и личный кабинет в Telegram.</p>
                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[250px]">
                        <code>{botCodeText.trim()}</code>
                    </pre>
                    <button onClick={() => onCopy(botCodeText)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                </div>
                
                <h4 className="text-lg font-semibold mt-6">Файл 3: Router.gs (Маршрутизатор)</h4>
                <p>Создайте файл <code>Router.gs</code>. Он перенаправляет запросы либо в CRM, либо в Бот.</p>
                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[250px]">
                        <code>{routerCodeText.trim()}</code>
                    </pre>
                    <button onClick={() => onCopy(routerCodeText)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                </div>

                <h4 className="text-lg font-semibold mt-8">Финальный шаг: Настройка Токена и Развертывание</h4>
                 <ol className="list-decimal list-inside space-y-3 pl-4">
                    <li>В редакторе скриптов зайдите в <b>Настройки проекта</b> (шестеренка слева).</li>
                    <li>В разделе "Свойства скрипта" добавьте: <code>TELEGRAM_BOT_TOKEN</code> = ваш токен.</li>
                    <li>Добавьте свойство <code>ADMIN_IDS</code> = ваш ID (для тестов бота).</li>
                    <li>Нажмите кнопку <b>"Начать развертывание"</b> -> <b>"Новая версия"</b> -> <b>"Развернуть"</b>.</li>
                    <li>Скопируйте полученный URL и установите вебхук для бота (через браузер):<br/>
                    <code className="text-xs break-all">https://api.telegram.org/botТОКЕН/setWebhook?url=ВАШ_URL_СКРИПТА</code></li>
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
