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

// --- Icons ---
const PhoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>;
const TelegramIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-1.01-2.4-1.61-1.06-.69-.37-1.07.22-1.69.14-.15 2.6-2.48 2.65-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.4-1.08.39-.35-.01-1.03-.2-1.54-.37-.62-.21-1.12-.32-1.08-.67.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/></svg>;
const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;


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

const SmartScheduleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    master: Master | null;
    clients: Client[];
    onSchedule: (master: Master, client: Client, service: string, dateTime: Date) => Promise<void>;
}> = ({ isOpen, onClose, master, clients, onSchedule }) => {
    const [step, setStep] = useState(1);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedService, setSelectedService] = useState('');
    const [date, setDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
    const [customTime, setCustomTime] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);

    const masterServices = useMemo(() => (master?.['Услуга'] || '').split(',').map(s => s.trim()).filter(Boolean), [master]);
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            if (clients.length > 0) setSelectedClientId(clients[0]?.id || '');
            if (masterServices.length > 0) setSelectedService(masterServices[0]);
            const now = new Date();
            setDate(now.toISOString().split('T')[0]);
            setSelectedTimeSlot('');
            setCustomTime('');
        }
    }, [isOpen, clients, masterServices]);
    
    const handleNext = () => {
        if (!selectedClientId) return;
        setStep(2);
    }

    const handleSchedule = async () => {
        if (!master || !selectedClientId || !date) return;
        const finalTime = customTime || selectedTimeSlot;
        if (!finalTime) return;

        const client = clients.find(c => c.id === selectedClientId);
        if (!client) return;

        setIsScheduling(true);
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = finalTime.split(':').map(Number);
        const dateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
        
        await onSchedule(master, client, selectedService, dateTime);
        setIsScheduling(false);
        onClose();
    };
    
    if (!master) return null;

    const renderStep1 = () => (
        <div className="space-y-5">
            <div>
                <label htmlFor="client-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Кого записываем?</label>
                <select id="client-select" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition duration-150">
                    <option value="" disabled>Выберите клиента</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c['Имя клиента']} {c['Номер Авто'] ? `(${c['Номер Авто']})` : ''}</option>)}
                </select>
            </div>
            {masterServices.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Какая услуга?</label>
                    <div className="flex flex-wrap gap-2">
                        {masterServices.map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setSelectedService(s)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                    selectedService === s
                                    ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-400'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Дата визита</label>
                <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Время записи</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                    {timeSlots.map(slot => (
                        <button
                            key={slot}
                            type="button"
                            onClick={() => { setSelectedTimeSlot(slot); setCustomTime(''); }}
                            className={`py-1.5 text-sm rounded-md transition-colors font-medium ${
                                selectedTimeSlot === slot
                                ? 'bg-primary-600 text-white shadow'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {slot}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase font-bold">Или</span>
                    <input 
                        type="time" 
                        value={customTime} 
                        onChange={e => { setCustomTime(e.target.value); setSelectedTimeSlot(''); }}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    />
                </div>
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Запись к: ${master['Имя']}`}>
            <div className="min-h-[300px] flex flex-col">
                <div className="flex-grow">
                    {step === 1 ? renderStep1() : renderStep2()}
                </div>
                
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {step === 1 ? (
                        <>
                            <Button variant="outline" onClick={onClose}>Отмена</Button>
                            <Button onClick={handleNext} disabled={!selectedClientId}>Далее</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep(1)}>Назад</Button>
                            <Button onClick={handleSchedule} disabled={isScheduling || (!selectedTimeSlot && !customTime)}>
                                {isScheduling ? 'Отправка...' : 'Подтвердить запись'}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const MasterContactCard: React.FC<{
    master: Master;
    onEdit: (m: Master) => void;
    onDelete: (id: string) => void;
    onSchedule: (m: Master) => void;
}> = ({ master, onEdit, onDelete, onSchedule }) => {
    const initials = master['Имя'].split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const services = (master['Услуга'] || '').split(',').map(s => s.trim()).filter(Boolean);
    
    // Generate a consistent color based on the name length
    const colorIndex = (master['Имя'].length) % 6;
    const colors = [
        'bg-red-100 text-red-600',
        'bg-orange-100 text-orange-600',
        'bg-amber-100 text-amber-600',
        'bg-green-100 text-green-600',
        'bg-blue-100 text-blue-600',
        'bg-purple-100 text-purple-600',
    ];
    const avatarColor = colors[colorIndex];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col hover:shadow-md transition-shadow duration-200">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${avatarColor} shrink-0`}>
                        {initials}
                    </div>
                    <div className="overflow-hidden">
                        <h4 className="font-bold text-gray-900 dark:text-white truncate" title={master['Имя']}>{master['Имя']}</h4>
                        {master['chatId (Telegram)'] ? (
                            <div className="flex items-center gap-1 text-blue-500 text-xs">
                                <TelegramIcon />
                                <span className="truncate">Telegram OK</span>
                            </div>
                        ) : (
                            <span className="text-xs text-gray-400">Telegram не привязан</span>
                        )}
                    </div>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => onEdit(master)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                        <EditIcon />
                    </button>
                    <button onClick={() => onDelete(master.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">
                        <TrashIcon />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow space-y-3 mb-4">
                {master['Телефон'] && (
                    <a href={`tel:${master['Телефон']}`} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium">
                        <PhoneIcon /> {master['Телефон']}
                    </a>
                )}
                {services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {services.map(s => (
                            <span key={s} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
                                {s}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Action */}
            <Button onClick={() => onSchedule(master)} className="w-full justify-center !py-2" size="sm">
                <CalendarIcon /> <span className="ml-2">Записать</span>
            </Button>
        </div>
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                    Справочник мастеров для быстрой записи и уведомлений.
                </div>
                <Button onClick={() => { setEditingMaster(null); setFormModalOpen(true); }} className="w-full sm:w-auto shrink-0">
                    Добавить мастера
                </Button>
            </div>

            {masters && masters.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {masters.map(master => (
                        <MasterContactCard 
                            key={master.id} 
                            master={master} 
                            onEdit={() => { setEditingMaster(master); setFormModalOpen(true); }}
                            onDelete={handleDeleteMaster}
                            onSchedule={handleOpenScheduleModal}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500 mb-2">Список мастеров пуст</p>
                    <Button variant="outline" size="sm" onClick={() => { setEditingMaster(null); setFormModalOpen(true); }}>Добавить первого</Button>
                </div>
            )}

            <MasterFormModal 
                isOpen={formModalOpen}
                onClose={() => setFormModalOpen(false)}
                master={editingMaster}
                onSave={handleSaveMaster}
            />

            <SmartScheduleModal
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