
import React, { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsType, MessageTemplate, Master, Client, AppLog } from '../types';
import { api, getClientHeaders } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Toast } from './ui/Toast';
import { Modal } from './ui/Modal';
import { VisualEditor } from './ui/VisualEditor';


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
            showToast(`Ошибка: ${e.message}. Проверьте URL и настройки доступа в Apps Script.`, 'error');
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
// --- НАСТРОЙКИ ---
const SCRIPT_VERSION = "2.5.0";
const SHEET_NAME_CLIENTS = "WebBase";
const SHEET_NAME_TEMPLATES = "Шаблоны сообщений";
const SHEET_NAME_MASTERS = "мастера";
const SHEET_NAME_HISTORY = "History";
const SHEET_NAME_ARCHIVE = "Archive";
const SHEET_NAME_LOGS = "Logs";
const ROOT_FOLDER_NAME = "TireCRMPhotos";
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// --- Главные функции обработки запросов ---
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "success", message: "GET request received. Use POST for actions." }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let payload;
  let rawContent = "empty";
  try {
    // Robust parsing logic
    if (e && e.postData && e.postData.contents) {
       rawContent = e.postData.contents;
       try {
          payload = JSON.parse(rawContent);
       } catch (jsonErr) {
          // If simple parse fails, try to handle cases where it might be url-encoded or just a string
          Logger.log("JSON parse failed, raw content: " + rawContent);
          throw new Error("Invalid JSON format");
       }
    } else if (e && e.parameter && e.parameter.payload) {
       // Fallback for form-data if used
       try {
         payload = JSON.parse(e.parameter.payload);
       } catch (pErr) {
         throw new Error("Invalid payload parameter JSON");
       }
    }

    if (!payload) {
        Logger.log('Invalid request structure received: ' + JSON.stringify(e));
        throw new Error("Неверный запрос: данные не получены. Проверьте URL и убедитесь, что скрипт развернут с доступом для 'Всех'.");
    }
    
    // Explicitly handle testconnection here to ensure it works even if routeAction fails
    if (payload.action === 'testconnection') {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        return ContentService
          .createTextOutput(JSON.stringify({ 
             status: 'success', 
             message: 'Соединение успешно установлено!', 
             version: SCRIPT_VERSION, 
             spreadsheetName: ss.getName() 
          }))
          .setMimeType(ContentService.MimeType.JSON);
    }

    const result = routeAction(payload);
    
    // Ensure the response is always a valid JSON object with a status.
    const finalResult = (result && result.status) ? result : { status: 'success', ...result };
    
    return ContentService
      .createTextOutput(JSON.stringify(finalResult))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const user = payload ? (payload.user || "System") : "System";
    const action = payload ? (payload.action || "Parse Error") : "Parse Error";
    
    // Log detailed error
    Logger.log("Error: " + error.message + " | Stack: " + error.stack);
    logError(ss, user, action, error);
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
          status: 'error', 
          message: 'Ошибка скрипта: ' + error.message, 
          receivedAction: action,
          debug: rawContent.substring(0, 100) // Return start of content for debug
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- Маршрутизатор действий ---
function routeAction(payload) {
  const action = payload.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    switch (action) {
      case 'testconnection': return testConnection(ss);
      case 'getclients': return getClientsAndArchive(ss);
      case 'gettemplates': return getTemplatesWithDefaults(ss);
      case 'getmasters': return getFullSheetData(ss, SHEET_NAME_MASTERS, 'masters');
      case 'gethistory': return getHistory(ss, payload.clientId);
      case 'getarchived': return getArchived(ss, payload.clientId);
      case 'getlogs': return getFullSheetData(ss, SHEET_NAME_LOGS, 'logs');
      case 'getphotos': return getPhotosForContract(payload.contractNumber);
      
      case 'add': return { status: 'success', newId: addRow(ss, SHEET_NAME_CLIENTS, payload.client, payload.user) };
      case 'update': return { status: 'success', message: updateRow(ss, SHEET_NAME_CLIENTS, payload.client, 'id', payload.user) };
      case 'delete': return { status: 'success', message: deleteRow(ss, SHEET_NAME_CLIENTS, payload.clientId, 'id') };
      case 'bulkdelete': return { status: 'success', message: bulkDeleteRows(ss, SHEET_NAME_CLIENTS, payload.clientIds, 'id') };
      
      case 'reorder': return reorderClient(ss, payload.oldClientId, payload.client, payload.user);

      case 'updatetemplate': return { status: 'success', message: updateTemplate(ss, payload.template) };
      case 'deletetemplate': return { status: 'success', message: deleteTemplate(ss, payload.templateName) };
      case 'addmaster': return { status: 'success', message: addRow(ss, SHEET_NAME_MASTERS, payload.master, payload.user) };
      case 'updatemaster': return { status: 'success', message: updateRow(ss, SHEET_NAME_MASTERS, payload.master, 'id', payload.user) };
      case 'deletemaster': return { status: 'success', message: deleteRow(ss, SHEET_NAME_MASTERS, payload.masterId, 'id') };
      case 'sendMessage': return sendMessage(payload.chatId, payload.message);
      case 'bulksend': return bulkSendMessage(ss, payload.clientIds, payload.templateName);
      case 'uploadfile': return { status: 'success', fileUrl: uploadFile(payload), message: 'Файл загружен' };
      default: return { status: 'error', message: 'Неверное действие (Unknown action): ' + action };
    }
  } catch(err) {
    Logger.log("Error in routeAction for " + action + ": " + err.message + " Stack: " + err.stack);
    logError(ss, payload.user, action, err);
    throw err;
  }
}

function getClientsAndArchive(ss) {
  const clientsResult = getFullSheetData(ss, SHEET_NAME_CLIENTS, 'clients');
  const archiveResult = getFullSheetData(ss, SHEET_NAME_ARCHIVE, 'archive');
  
  const allHeaders = clientsResult.headers || [];

  return { 
    status: 'success', 
    headers: allHeaders, 
    clients: clientsResult.clients || [], 
    archive: archiveResult.archive || [] 
  };
}


// --- Сервисные функции ---
function testConnection(ss) {
  return { status: 'success', message: 'Соединение успешно установлено!', version: SCRIPT_VERSION, spreadsheetName: ss.getName() };
}

// --- Функции для работы с листами ---
function getFullSheetData(ss, sheetName, dataKey) {
  try {
    const sheet = getOrCreateSheet(ss, sheetName);
    if (sheet.getLastRow() < 2) {
      const headers = sheet.getLastRow() === 1 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
      return { status: 'success', headers: headers, [dataKey]: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const result = data.map(row => {
        let obj = {};
        headers.forEach((header, i) => {
            let value = row[i];
            if (value instanceof Date) {
              value = Utilities.formatDate(new Date(value), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
            }
            obj[header] = value;
        });
        return obj;
    });

    if (sheetName === SHEET_NAME_LOGS) {
        result.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return { status: 'success', headers: headers, [dataKey]: result };
  } catch (e) {
      Logger.log('Error in getFullSheetData for ' + sheetName + ': ' + e.toString() + ' Stack: ' + e.stack);
      throw new Error('Could not get data from sheet: ' + sheetName);
  }
}

function getTemplatesWithDefaults(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAME_TEMPLATES);
  const defaultTemplates = {
    'Напоминание о задолженности': 'Здравствуйте, {{Имя клиента}}! Напоминаем о задолженности по договору №{{Договор}} в размере <b>{{Долг}} ₽</b>.',
    'Напоминание об окончании хранения': 'Здравствуйте, {{Имя клиента}}!<br>Срок хранения ваших шин по договору №{{Договор}} заканчивается <b>{{Окончание}}</b>.<br><br>Пожалуйста, свяжитесь с нами для продления или согласования даты вывоза.'
  };

  const data = sheet.getDataRange().getValues();
  const headers = data.length > 0 ? data[0] : ['Название шаблона', 'Содержимое (HTML)'];
  const existingTemplates = data.length > 1 ? data.slice(1).map(row => row[0]) : [];
  
  const templatesToAdd = [];
  for (const name in defaultTemplates) {
    if (!existingTemplates.includes(name)) {
      templatesToAdd.push([name, defaultTemplates[name]]);
    }
  }

  if (templatesToAdd.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, templatesToAdd.length, 2).setValues(templatesToAdd);
    SpreadsheetApp.flush();
  }

  return getFullSheetData(ss, SHEET_NAME_TEMPLATES, 'templates');
}


function getHistory(ss, clientId) {
  try {
    const sheet = getOrCreateSheet(ss, SHEET_NAME_HISTORY);
    if (sheet.getLastRow() < 2) return { status: 'success', history: [] };
    
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const clientIdIndex = headers.indexOf('clientId');
    if (clientIdIndex === -1) return { status: 'success', history: [] };

    const history = data.filter(row => row[clientIdIndex] == clientId).map(row => {
        let obj = {};
        headers.forEach((header, i) => { obj[header] = row[i]; });
        return obj;
    }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return { status: 'success', history: history };
  } catch(e) {
      Logger.log('Error in getHistory for ' + clientId + ': ' + e.toString());
      throw e;
  }
}

function getArchived(ss, clientId) {
  const clientSheet = getOrCreateSheet(ss, SHEET_NAME_CLIENTS);
  const clientRowNum = findRowById(clientSheet, clientId, 'id');
  if (clientRowNum === -1) {
    Logger.log("getArchived: Client ID " + clientId + " not found in " + SHEET_NAME_CLIENTS);
    return { status: 'success', orders: [] };
  }

  const clientHeaders = clientSheet.getRange(1, 1, 1, clientSheet.getLastColumn()).getValues()[0];
  const clientData = clientSheet.getRange(clientRowNum, 1, 1, clientHeaders.length).getValues()[0];
  const phoneIndex = clientHeaders.indexOf('Телефон');
  const clientPhone = phoneIndex > -1 ? clientData[phoneIndex] : null;

  if (!clientPhone) {
    Logger.log("getArchived: Client ID " + clientId + " has no phone number.");
    return { status: 'success', orders: [] }; 
  }

  const archiveSheet = getOrCreateSheet(ss, SHEET_NAME_ARCHIVE);
  if (archiveSheet.getLastRow() < 2) return { status: 'success', orders: [] };
  
  const data = archiveSheet.getDataRange().getValues();
  const headers = data.shift();
  const phoneIndexInArchive = headers.indexOf('Телефон');

  if (phoneIndexInArchive === -1) {
    throw new Error('Archive sheet is missing "Телефон" column.');
  }

  const orders = data.filter(row => row[phoneIndexInArchive] == clientPhone).map(row => {
      let obj = {};
      headers.forEach((header, i) => { 
        let value = row[i];
        if (value instanceof Date) {
          value = Utilities.formatDate(new Date(value), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
        }
        obj[header] = value;
      });
      return obj;
  }).sort((a,b) => new Date(b['Дата добавления']).getTime() - new Date(a['Дата добавления']).getTime());
  
  return { status: 'success', orders: orders };
}

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);
  const clientColumns = ['id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто', 'Заказ - QR', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков', 'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка', 'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки', 'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls'];
  
  const defaultHeaders = {
    [SHEET_NAME_CLIENTS]: clientColumns,
    [SHEET_NAME_ARCHIVE]: [...clientColumns, 'Дата архивации'],
    [SHEET_NAME_TEMPLATES]: ['Название шаблона', 'Содержимое (HTML)'],
    [SHEET_NAME_MASTERS]: ['id', 'Имя', 'chatId (Telegram)', 'Услуга', 'Телефон'],
    [SHEET_NAME_HISTORY]: ['id', 'clientId', 'timestamp', 'user', 'action', 'details'],
    [SHEET_NAME_LOGS]: ['timestamp', 'level', 'user', 'action', 'message', 'details']
  };

  if (defaultHeaders[sheetName]) {
    sheet.getRange(1, 1, 1, defaultHeaders[sheetName].length).setValues([defaultHeaders[sheetName]]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, defaultHeaders[sheetName].length).setFontWeight("bold");
    SpreadsheetApp.flush();
  }
  return sheet;
}

function findRowById(sheet, id, idKey) {
  if (!id) return -1;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColIndex = headers.indexOf(idKey);
  if (idColIndex === -1) return -1;
  const data = sheet.getRange(2, idColIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return i + 2;
    }
  }
  return -1;
}

function addRow(ss, sheetName, dataObject, user) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => dataObject[header] === undefined ? '' : dataObject[header]);
  sheet.appendRow(newRow);
  SpreadsheetApp.flush();
  
  const action = sheetName === SHEET_NAME_CLIENTS ? 'Клиент создан' : 'Запись добавлена';
  const clientId = sheetName === SHEET_NAME_CLIENTS ? dataObject.id : null;
  const details = Object.entries(dataObject).map(([key, value]) => key + ': ' + value).join('\\n');
  logHistory(ss, clientId, user, action, details);
  
  return dataObject.id;
}

function updateRow(ss, sheetName, dataObject, idKey, user) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const rowNum = findRowById(sheet, dataObject[idKey], idKey);

  if (rowNum === -1) {
    throw new Error('Не удалось обновить: Запись с ID "' + dataObject[idKey] + '" не найдена в листе "' + sheetName + '".');
  }

  const oldDataValues = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const oldData = headers.reduce((obj, header, i) => ({...obj, [header]: oldDataValues[i]}), {});
  const newRow = headers.map(header => dataObject[header] !== undefined ? dataObject[header] : oldData[header]);
  sheet.getRange(rowNum, 1, 1, newRow.length).setValues([newRow]);
  SpreadsheetApp.flush();
  
  const changes = headers
    .map(header => ({ header, old: oldData[header], new: dataObject[header] }))
    .filter(({ old, new: newValue }) => newValue !== undefined && String(old) !== String(newValue))
    .map(({header, old, new: newValue}) => header + ": '" + old + "' -> '" + newValue + "'");
  
  if (changes.length > 0 && sheetName === SHEET_NAME_CLIENTS) {
    logHistory(ss, dataObject.id, user, 'Данные обновлены', changes.join('\\n'));
  }
  
  return 'Запись с ID ' + dataObject[idKey] + ' обновлена.';
}

function deleteRow(ss, sheetName, id, idKey) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const rowNum = findRowById(sheet, id, idKey);
  if (rowNum > -1) {
    sheet.deleteRow(rowNum);
    SpreadsheetApp.flush();
    return 'Запись с ID ' + id + ' удалена.';
  }
  return 'Запись с ID ' + id + ' не найдена.';
}

function bulkDeleteRows(ss, sheetName, ids, idKey) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf(idKey);
  if (idColIndex === -1) throw new Error("ID column '" + idKey + "' not found.");

  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (ids.includes(String(data[i][idColIndex]))) {
      rowsToDelete.push(i + 1);
    }
  }

  if (rowsToDelete.length > 0) {
    rowsToDelete.sort((a,b) => b-a).forEach(rowNum => sheet.deleteRow(rowNum));
    SpreadsheetApp.flush();
  }
  return rowsToDelete.length + ' записей удалено.';
}

function reorderClient(ss, oldClientId, newClientData, user) {
  const clientSheet = getOrCreateSheet(ss, SHEET_NAME_CLIENTS);
  const archiveSheet = getOrCreateSheet(ss, SHEET_NAME_ARCHIVE);
  
  const clientRowNum = findRowById(clientSheet, oldClientId, 'id');
  if (clientRowNum === -1) {
    throw new Error('Не удалось найти клиента для архивации с ID: ' + oldClientId);
  }

  const clientHeaders = clientSheet.getRange(1, 1, 1, clientSheet.getLastColumn()).getValues()[0];
  const oldClientDataValues = clientSheet.getRange(clientRowNum, 1, 1, clientHeaders.length).getValues()[0];
  
  // Archive the old row
  const archiveHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0];
  const newArchiveRow = archiveHeaders.map(header => {
    const clientHeaderIndex = clientHeaders.indexOf(header);
    if (header === 'Дата архивации') return new Date().toISOString();
    if (clientHeaderIndex > -1) return oldClientDataValues[clientHeaderIndex];
    return '';
  });
  archiveSheet.appendRow(newArchiveRow);
  
  // CORRECTED: Create the new row for the client sheet by merging old and new data
  const newRowValues = clientHeaders.map((header, index) => {
    // If the new data payload from the frontend has a value for this header, use it.
    if (newClientData[header] !== undefined) {
      return newClientData[header];
    }
    // Otherwise, preserve the old value from the sheet to prevent data loss.
    return oldClientDataValues[index];
  });
  
  // Update the original row in the clientSheet with this merged data.
  clientSheet.getRange(clientRowNum, 1, 1, newRowValues.length).setValues([newRowValues]);

  SpreadsheetApp.flush();

  logHistory(ss, oldClientId, user, 'Заказ архивирован', 'Старый заказ перенесен в архив перед созданием нового.');
  const details = Object.entries(newClientData).map(([key, value]) => key + ': ' + value).join('\\n');
  logHistory(ss, newClientData.id, user, 'Новый заказ создан (обновлением)', details);

  return { status: 'success', message: 'Заказ успешно переоформлен.', newId: newClientData.id };
}


function updateTemplate(ss, template) {
  const sheet = getOrCreateSheet(ss, SHEET_NAME_TEMPLATES);
  const templateName = template['Название шаблона'];
  const rowNum = findRowById(sheet, templateName, 'Название шаблона');
  
  if (rowNum > -1) {
    sheet.getRange(rowNum, 2).setValue(template['Содержимое (HTML)']);
  } else {
    sheet.appendRow([templateName, template['Содержимое (HTML)']]);
  }
  SpreadsheetApp.flush();
  return 'Шаблон "' + templateName + '" сохранен.';
}

function deleteTemplate(ss, templateName) {
    const sheet = getOrCreateSheet(ss, SHEET_NAME_TEMPLATES);
    const rowNum = findRowById(sheet, templateName, 'Название шаблона');
    if (rowNum > -1) {
        sheet.deleteRow(rowNum);
        SpreadsheetApp.flush();
        return 'Шаблон "' + templateName + '" удален.';
    }
    return 'Шаблон "' + templateName + '" не найден.';
}

// --- Функции для Telegram ---
function sendMessage(chatId, message) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error("Токен Telegram не настроен в свойствах скрипта (Script Properties).");
  if (!chatId) throw new Error("Chat ID не предоставлен.");
  
  const sanitizedMessage = message
    .replace(/<br\\s*\\/?>/gi, '\\n')
    .replace(/<\\/p>/gi, '\\n')
    .replace(/<p.*?>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/(\\n\\s*){2,}/g, '\\n\\n')
    .trim();

  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  const params = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: String(chatId),
      text: sanitizedMessage,
      parse_mode: "HTML",
    }),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, params);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode === 200) {
    return { status: "success", message: "Сообщение отправлено в чат " + chatId };
  } else {
    Logger.log("Telegram API Error: " + responseBody);
    const errorDescription = JSON.parse(responseBody).description || "Неизвестная ошибка";
    throw new Error("Не удалось отправить сообщение: " + errorDescription);
  }
}

function bulkSendMessage(ss, clientIds, templateName) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error("Токен Telegram не настроен в свойствах скрипта.");

  const templatesData = getTemplatesWithDefaults(ss);
  const template = templatesData.templates.find(t => t['Название шаблона'] === templateName);
  if (!template) throw new Error('Шаблон "' + templateName + '" не найден.');

  const clientsData = getFullSheetData(ss, SHEET_NAME_CLIENTS, 'clients');
  const clientsToSend = clientsData.clients.filter(c => clientIds.includes(c.id));
  
  clientsToSend.forEach(client => {
    if (client['Chat ID']) {
      let message = template['Содержимое (HTML)'];
      Object.keys(client).forEach(key => {
        message = message.replace(new RegExp('{{' + key + '}}', 'g'), client[key] || '');
      });
      sendMessage(client['Chat ID'], message);
    }
  });
  return { status: "success", message: "Массовая рассылка завершена."};
}

// --- Функции для работы с файлами ---
function getAppRootFolder() {
  let folderId = SCRIPT_PROPERTIES.getProperty('ROOT_FOLDER_ID');
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch(e) {
      Logger.log("Root folder with ID " + folderId + " not found. Creating a new one.");
    }
  }
  
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    const folder = folders.next();
    SCRIPT_PROPERTIES.setProperty('ROOT_FOLDER_ID', folder.getId());
    return folder;
  }
  
  const newFolder = DriveApp.createFolder(ROOT_FOLDER_NAME);
  SCRIPT_PROPERTIES.setProperty('ROOT_FOLDER_ID', newFolder.getId());
  return newFolder;
}

function getOrCreateSubFolder(parentFolder, subFolderName) {
  const folders = parentFolder.getFoldersByName(subFolderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(subFolderName);
}

function getPhotosForContract(contractNumber) {
  if (!contractNumber) {
    return { status: 'success', photoUrls: [] };
  }
  try {
    const rootFolder = getAppRootFolder();
    const folders = rootFolder.getFolders();
    let clientFolder = null;
    
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getName().startsWith(contractNumber)) {
        clientFolder = folder;
        break;
      }
    }
    
    if (!clientFolder) {
      return { status: 'success', photoUrls: [] };
    }
    
    const photoUrls = [];
    const files = clientFolder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      try {
        if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        }
        photoUrls.push('https://drive.google.com/uc?export=view&id=' + file.getId());
      } catch (e) {
        Logger.log("Could not get URL for file " + file.getName() + " in folder " + clientFolder.getName() + ": " + e.message);
      }
    }
    
    return { status: 'success', photoUrls: photoUrls };
  } catch(e) {
    Logger.log("Error in getPhotosForContract for " + contractNumber + ": " + e.message);
    return { status: 'success', photoUrls: [] }; 
  }
}

function uploadFile(payload) {
  const { client, filename, mimeType, fileData } = payload;
  const decodedData = Utilities.base64Decode(fileData);
  const blob = Utilities.newBlob(decodedData, mimeType, filename);
  
  const rootFolder = getAppRootFolder();
  const clientFolderName = client['Договор'] ? (client['Договор'] + '_' + client['Имя клиента']) : client['id'];
  const clientFolder = getOrCreateSubFolder(rootFolder, clientFolderName);
  
  const file = clientFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

// --- Логирование ---
function logHistory(ss, clientId, user, action, details) {
  try {
    const historySheet = getOrCreateSheet(ss, SHEET_NAME_HISTORY);
    const event = {
      id: "evt_" + new Date().getTime(),
      clientId: clientId || 'N/A',
      timestamp: new Date().toISOString(),
      user: user || 'System',
      action: action || 'Действие',
      details: details || null
    };
    const headers = historySheet.getRange(1, 1, 1, historySheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => event[header]);
    historySheet.appendRow(newRow);
  } catch (e) {
    Logger.log("Failed to log history: " + e.message);
  }
}

function logError(ss, user, action, error) {
  try {
    const logsSheet = getOrCreateSheet(ss, SHEET_NAME_LOGS);
    logsSheet.appendRow([
      new Date().toISOString(),
      "ERROR",
      user || "System",
      action || "Unknown",
      error.message,
      error.stack || ""
    ]);
  } catch (e) {
    Logger.log("CRITICAL: FAILED TO LOG ERROR. Original error: " + error.message + ". Logging error: " + e.message);
  }
}
    `;
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold">Настройка Google Apps Script</h3>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 text-blue-800 dark:text-blue-200 rounded-md space-y-2">
                <p>Следуйте этим шагам, чтобы подключить вашу Google Таблицу к CRM.</p>
            </div>
            
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <h4 className="text-lg font-semibold">Шаг 1: Создание таблицы и скрипта</h4>
                <ol className="list-decimal list-inside space-y-2 pl-4">
                    <li>Откройте <a href="https://sheets.google.com/create" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Google Sheets</a> и создайте новую таблицу.</li>
                    <li>В вашей таблице перейдите в <b>Расширения &gt; Apps Script</b>.</li>
                    <li>
                        Создайте на Google Диске папку с названием <code className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded">TireCRMPhotos</code>. 
                        <b>ИЛИ</b> скрипт создаст ее автоматически при первой загрузке фото.
                    </li>
                </ol>
                
                <h4 className="text-lg font-semibold">Шаг 2: Вставка кода</h4>
                <ol className="list-decimal list-inside space-y-2 pl-4">
                    <li>Удалите весь код в файле <code>Code.gs</code> и вставьте вместо него код ниже.</li>
                </ol>

                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[400px]">
                        <code>{scriptText.trim()}</code>
                    </pre>
                    <button onClick={() => onCopy(scriptText)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                </div>
                
                <h4 className="text-lg font-semibold">Шаг 3: Добавление токена Telegram</h4>
                <ol className="list-decimal list-inside space-y-3 pl-4">
                     <li>В редакторе скриптов слева нажмите на иконку шестеренки (⚙️ <b>Настройки проекта</b>).</li>
                     <li>Пролистайте вниз до раздела <b>"Свойства скрипта"</b> (Script Properties).</li>
                     <li>Нажмите <b>"Изменить свойства скрипта"</b> и добавьте новое свойство:</li>
                     <li className="list-none pl-4">
                        <ul className="list-disc list-inside space-y-1">
                            <li><b>Ключ (Property):</b> <code className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded">TELEGRAM_BOT_TOKEN</code></li>
                            <li><b>Значение (Value):</b> <code>вставьте_ваш_токен_от_BotFather</code></li>
                        </ul>
                     </li>
                     <li>Нажмите <b>"Сохранить свойства скрипта"</b>.</li>
                </ol>

                <h4 className="text-lg font-semibold">Шаг 4: Развертывание скрипта</h4>
                 <ol className="list-decimal list-inside space-y-3 pl-4">
                    <li>Нажмите кнопку <b>"Развертывание"</b> в правом верхнем углу редактора, затем <b>"Новое развертывание"</b>.</li>
                    <li>
                        Нажмите на иконку шестеренки (⚙️) рядом с "Выбрать тип" и выберите <b>"Веб-приложение"</b>.
                    </li>
                    <li>
                        В настройках развертывания укажите:
                        <ul className="list-disc list-inside space-y-1 pl-6 mt-2">
                            <li><b>Описание:</b> <code>Tire CRM Connector</code> (или любое другое)</li>
                            <li><b>Выполнять как:</b> Я (ваш@email.com)</li>
                            <li>⚠️ <b>У кого есть доступ:</b> <b className="text-red-500">Все</b></li>
                        </ul>
                    </li>
                    <li>Нажмите <b>"Развертывание"</b>. Google запросит разрешения на доступ. Предоставьте их.</li>
                    <li>После развертывания вы получите <b>URL веб-приложения</b>. Скопируйте его.</li>
                    <li>⚠️ <b>Важно:</b> Если вы вносите изменения в код, вам нужно снова нажать <b>"Развертывание" &gt; "Управление развертываниями"</b>, выбрать ваше развертывание, нажать на иконку карандаша и выбрать <b>"Новая версия"</b>.</li>
                </ol>

                 <h4 className="text-lg font-semibold">Шаг 5: Подключение к CRM</h4>
                 <ol className="list-decimal list-inside space-y-2 pl-4">
                    <li>Вернитесь в это приложение, перейдите на вкладку <b>"Основные"</b>.</li>
                    <li>Вставьте скопированный URL в поле <b>"URL скрипта Google Apps"</b>.</li>
                    <li>Нажмите кнопку <b>"Проверить"</b>, чтобы убедиться, что все настроено правильно.</li>
                    <li>Нажмите <b>"Сохранить изменения"</b> внизу страницы.</li>
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
        fetchLogs();
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
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/DESCRIPTION.md')
            .then(response => {
                if (!response.ok) throw new Error('Не удалось загрузить файл описания.');
                return response.text();
            })
            .then(text => {
                const parts = text.split('---PROMPT_SEPARATOR---');
                setDescription(parts[0] || '');
                setPrompt(parts[1] || 'Промт не найден.');
            })
            .catch(err => {
                setError(err.message);
                console.error(err);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const formatMarkdownToHtml = (markdown: string) => {
        let html = markdown
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 border-b pb-2 dark:border-gray-600">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4 border-b-2 pb-2 dark:border-gray-500">$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/__(.*?)__/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/_(.*?)_/gim, '<em>$1</em>')
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

    const formattedDescription = formatMarkdownToHtml(description);
    // const formattedPrompt = formatMarkdownToHtml(prompt); // Removed unused variable

    return (
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <h3 className="text-xl font-semibold">О проекте Tire Storage CRM</h3>
            <p>Это приложение разработано для упрощения управления клиентской базой шинного хранения.</p>
            <p><b>Версия приложения:</b> 1.2.0</p>
            
            <Expander title="Подробное описание функций" isExpanded={isDescriptionExpanded} setExpanded={setIsDescriptionExpanded}>
                {isLoading ? <p>Загрузка...</p> : error ? <p className="text-red-500">{error}</p> : <div dangerouslySetInnerHTML={{ __html: formattedDescription }} />}
            </Expander>

            <Expander title="Промт для воссоздания CRM" isExpanded={isPromptExpanded} setExpanded={setIsPromptExpanded}>
                 {isLoading ? <p>Загрузка...</p> : error ? <p className="text-red-500">{error}</p> : 
                    <div className="relative">
                        <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto max-h-[60vh]">
                            <code>{prompt.trim()}</code>
                        </pre>
                        <button onClick={() => onCopy(prompt)} className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Копировать</button>
                    </div>
                }
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Resync state if initial props change (e.g., after a global refresh)
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
  
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.saveSettings(settings);
      showToast('Настройки сохранены!', 'success');
      onSave();
    } catch (e: any) {
      showToast(`Ошибка сохранения: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Скопировано в буфер обмена!', 'success');
    }, () => {
        showToast('Не удалось скопировать.', 'error');
    });
  };
  
   const CodeBracketIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 15" /></svg>;

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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
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
        {activeTab === 'general' && <GeneralSettingsTab settings={settings} onChange={handleSettingsChange} showToast={showToast} />}
        {activeTab === 'templates' && <TemplatesTab templates={templates} setTemplates={setTemplates} showToast={showToast}/>}
        {activeTab === 'masters' && <MastersTab masters={masters} setMasters={setMasters} clients={clients} showToast={showToast} />}
        {activeTab === 'gas' && <GasSetupTab onCopy={handleCopyToClipboard} />}
        {activeTab === 'logs' && <LogsTab showToast={showToast} />}
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
