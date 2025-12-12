
import React, { useState, useEffect, useMemo } from 'react';
import { Master, Client } from '../types';
import { api } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Toast, ToastContainer } from './ui/Toast';

// --- Icons ---
const PhoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>;
const TelegramIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-1.01-2.4-1.61-1.06-.69-.37-1.07.22-1.69.14-.15 2.6-2.48 2.65-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.4-1.08.39-.35-.01-1.03-.2-1.54-.37-.62-.21-1.12-.32-1.08-.67.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/></svg>;
const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const MapPinIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>;

const MasterFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    master: Master | null;
    onSave: (master: Omit<Master, 'id'> | Master) => void;
}> = ({ isOpen, onClose, master, onSave }) => {
    const [formData, setFormData] = useState<Partial<Master>>({});

    useEffect(() => {
        setFormData(master ? { ...master } : { 'Имя': '', 'chatId (Telegram)': '', 'Услуга': '', 'Телефон': '', 'Адрес': '' });
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input name="Телефон" label="Телефон" type="tel" value={formData['Телефон'] || ''} onChange={handleChange} placeholder="+7..." />
                    <Input name="Адрес" label="Адрес" value={formData['Адрес'] || ''} onChange={handleChange} placeholder="Ул. Ленина, д.1" />
                </div>
            </div>
            <div className="flex w-full gap-3 mt-6">
                <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
                <Button onClick={handleSave} className="flex-1">Сохранить</Button>
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
                {master['Адрес'] && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <MapPinIcon /> <span className="truncate" title={master['Адрес']}>{master['Адрес']}</span>
                    </div>
                )}
                {services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
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

export const MastersView: React.FC<{
    masters: Master[];
    setMasters: React.Dispatch<React.SetStateAction<Master[]>>;
    clients: Client[];
}> = ({ masters, setMasters, clients }) => {
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);
    const [editingMaster, setEditingMaster] = useState<Master | null>(null);
    const [toasts, setToasts] = useState<any[]>([]);

    const addToast = (message: string, type: 'success' | 'error') => {
       const id = Date.now().toString();
       setToasts(prev => [...prev, { id, message, type, duration: 4000 }]);
    };
  
    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleSaveMaster = async (masterData: Omit<Master, 'id'> | Master) => {
        try {
            if ('id' in masterData && masterData.id) {
                const updatedMaster = await api.updateMaster(masterData);
                setMasters(masters.map(m => m.id === updatedMaster.id ? updatedMaster : m));
                addToast("Мастер обновлен", "success");
            } else {
                const newMaster = await api.addMaster(masterData);
                setMasters([...masters, newMaster]);
                addToast("Мастер добавлен", "success");
            }
        } catch(e: any) {
            addToast(`Ошибка сохранения мастера: ${e.message}`, 'error');
        }
    };

    const handleDeleteMaster = async (masterId: string) => {
        if (window.confirm("Вы уверены, что хотите удалить этого мастера?")) {
            try {
                await api.deleteMaster(masterId);
                setMasters(masters.filter(m => m.id !== masterId));
                addToast("Мастер удален", "success");
            } catch (e: any) {
                addToast(`Ошибка удаления: ${e.message}`, 'error');
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
                addToast(`Уведомление мастеру ${master['Имя']} отправлено`, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch(e: any) {
            addToast(`Ошибка отправки: ${e.message}`, 'error');
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
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
            </Card>

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
