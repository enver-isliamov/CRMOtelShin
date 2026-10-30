import React, { useState, useEffect, useMemo } from 'react';
import { Master, Client } from '../types';
import { api } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { ToastContainer } from './ui/Toast';

import { 
    PhoneIcon, 
    CalendarDaysIcon as CalendarIcon, 
    EditIcon, 
    TrashIcon,
    SearchIcon,
    PlusIcon,
    CheckIcon,
    UserIcon,
    MasterIcon,
    XMarkIcon
} from './icons/Icons';

const TelegramIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-1.01-2.4-1.61-1.06-.69-.37-1.07.22-1.69.14-.15 2.6-2.48 2.65-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.4-1.08.39-.35-.01-1.03-.2-1.54-.37-.62-.21-1.12-.32-1.08-.67.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
    </svg>
);

const MapPinIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
);

const CarIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h.01M16 17h.01M3 13h18M5 17h14a2 2 0 002-2v-4a2 2 0 00-1-1.73l-2.6-3.46A2 2 0 0015.8 5H8.2a2 2 0 00-1.6.81L4 9.27A2 2 0 003 11v4a2 2 0 002 2z" />
    </svg>
);

const POPULAR_SERVICES = [
    'Шиномонтаж',
    'Балансировка',
    'Правка дисков',
    'Дошиповка',
    'Вулканизация',
    'Мойка колес',
    'Сход-развал'
];

// Modal for Adding/Editing Master
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

    const handleAddServiceChip = (service: string) => {
        const current = (formData['Услуга'] || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!current.includes(service)) {
            const updated = [...current, service].join(', ');
            setFormData({ ...formData, 'Услуга': updated });
        }
    };

    const handleSave = () => {
        if (!formData['Имя']?.trim()) return;
        onSave(formData as Master);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={master ? 'Редактировать мастера' : 'Добавить нового мастера'}>
            <div className="space-y-4">
                <Input 
                    name="Имя" 
                    label="Имя мастера / Название сервиса" 
                    value={formData['Имя'] || ''} 
                    onChange={handleChange} 
                    placeholder="Алексей Смирнов (Шиномонтаж #1)" 
                    required 
                />

                <div>
                    <Input 
                        name="chatId (Telegram)" 
                        label="Chat ID (Telegram)" 
                        value={formData['chatId (Telegram)'] || ''} 
                        onChange={handleChange} 
                        placeholder="123456789" 
                        required 
                        helperText="ID чата мастера в Telegram. Туда бот будет автоматически отправлять уведомления о новых записях клиентов."
                    />
                </div>

                <div>
                    <Input 
                        name="Услуга" 
                        label="Услуги мастера" 
                        value={formData['Услуга'] || ''} 
                        onChange={handleChange} 
                        placeholder="Шиномонтаж, Балансировка, Правка дисков" 
                        helperText="Перечислите через запятую или нажмите на быстрые теги ниже:"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {POPULAR_SERVICES.map(service => (
                            <button
                                key={service}
                                type="button"
                                onClick={() => handleAddServiceChip(service)}
                                className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors"
                            >
                                + {service}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                        name="Телефон" 
                        label="Контактный телефон" 
                        type="tel" 
                        value={formData['Телефон'] || ''} 
                        onChange={handleChange} 
                        placeholder="+7 (999) 000-00-00" 
                    />
                    <Input 
                        name="Адрес" 
                        label="Адрес поста / бокса" 
                        value={formData['Адрес'] || ''} 
                        onChange={handleChange} 
                        placeholder="Бокс №4, ул. Ленина, 25" 
                    />
                </div>
            </div>

            <div className="flex w-full gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
                <Button onClick={handleSave} disabled={!formData['Имя']?.trim()} className="flex-1">
                    Сохранить мастера
                </Button>
            </div>
        </Modal>
    );
};

// Modal for Smart Booking Workflow
const SmartScheduleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    master: Master | null;
    clients: Client[];
    onSchedule: (master: Master, client: Client, service: string, dateTime: Date) => Promise<void>;
}> = ({ isOpen, onClose, master, clients, onSchedule }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedService, setSelectedService] = useState('');
    const [customService, setCustomService] = useState('');
    const [date, setDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
    const [customTime, setCustomTime] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);

    const masterServices = useMemo(() => {
        const raw = (master?.['Услуга'] || '').split(',').map(s => s.trim()).filter(Boolean);
        return raw.length > 0 ? raw : ['Шиномонтаж'];
    }, [master]);

    const timeSlots = [
        '09:00', '10:00', '11:00', '12:00', 
        '13:00', '14:00', '15:00', '16:00', 
        '17:00', '18:00', '19:00', '20:00'
    ];

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setClientSearch('');
            if (clients.length > 0) setSelectedClientId(clients[0]?.id || '');
            if (masterServices.length > 0) {
                setSelectedService(masterServices[0]);
            }
            setCustomService('');
            const now = new Date();
            setDate(now.toISOString().split('T')[0]);
            setSelectedTimeSlot('10:00');
            setCustomTime('');
        }
    }, [isOpen, clients, masterServices]);

    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return clients;
        const q = clientSearch.toLowerCase();
        return clients.filter(c => 
            c['Имя клиента']?.toLowerCase().includes(q) ||
            c['Номер Авто']?.toLowerCase().includes(q) ||
            c['Телефон']?.toLowerCase().includes(q)
        );
    }, [clients, clientSearch]);

    const selectedClient = useMemo(() => 
        clients.find(c => c.id === selectedClientId),
        [clients, selectedClientId]
    );

    const handleDateShortcut = (daysToAdd: number) => {
        const target = new Date();
        target.setDate(target.getDate() + daysToAdd);
        setDate(target.toISOString().split('T')[0]);
    };

    const handleSchedule = async () => {
        if (!master || !selectedClient || !date) return;
        const finalTime = customTime || selectedTimeSlot;
        if (!finalTime) return;

        const finalService = customService.trim() || selectedService || 'Шиномонтаж';

        setIsScheduling(true);
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = finalTime.split(':').map(Number);
        const dateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
        
        await onSchedule(master, selectedClient, finalService, dateTime);
        setIsScheduling(false);
        onClose();
    };

    if (!master) return null;

    const formattedPreviewDate = (() => {
        if (!date) return '';
        const finalTime = customTime || selectedTimeSlot;
        try {
            const [y, m, d] = date.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            return `${dt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}${finalTime ? ` в ${finalTime}` : ''}`;
        } catch {
            return date;
        }
    })();

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Запись к мастеру: ${master['Имя']}`}
        >
            <div className="flex flex-col space-y-4">
                {/* Step indicator header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold">
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className={`flex items-center gap-2 pb-1 transition-colors ${
                            step === 1 
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 font-bold' 
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 flex items-center justify-center text-xs">1</span>
                        <span>Клиент и услуга</span>
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">➔</span>
                    <button
                        type="button"
                        onClick={() => selectedClientId && setStep(2)}
                        disabled={!selectedClientId}
                        className={`flex items-center gap-2 pb-1 transition-colors ${
                            step === 2 
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 font-bold' 
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs">2</span>
                        <span>Дата и время</span>
                    </button>
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        {/* Searchable Client Selector */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                    Выберите клиента из базы ({clients.length}):
                                </label>
                                {selectedClient && (
                                    <span className="text-xs text-primary-600 font-semibold truncate max-w-[200px]">
                                        ✓ {selectedClient['Имя клиента']}
                                    </span>
                                )}
                            </div>

                            {/* Search bar inside modal */}
                            <div className="relative mb-2">
                                <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={clientSearch}
                                    onChange={e => setClientSearch(e.target.value)}
                                    placeholder="Поиск по имени, номеру авто или телефону..."
                                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                {clientSearch && (
                                    <button 
                                        type="button" 
                                        onClick={() => setClientSearch('')} 
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <XMarkIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Client cards list */}
                            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 border border-gray-100 dark:border-gray-800 rounded-xl p-1 bg-gray-50/50 dark:bg-gray-900/50">
                                {filteredClients.length > 0 ? (
                                    filteredClients.map(c => {
                                        const isSelected = selectedClientId === c.id;
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => setSelectedClientId(c.id)}
                                                className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between border ${
                                                    isSelected
                                                        ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-400 dark:border-primary-600 shadow-xs'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-800 dark:text-gray-200'}`}>
                                                        {c['Имя клиента']}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                                                        <span>{c['Телефон'] || 'Без телефона'}</span>
                                                        {c['Номер Авто'] && (
                                                            <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded text-gray-700 dark:text-gray-300">
                                                                {c['Номер Авто']}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                                    {c['Склад хранения'] && (
                                                        <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                                                            {c['Склад хранения']}
                                                        </span>
                                                    )}
                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                                                        isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 dark:border-gray-600'
                                                    }`}>
                                                        {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-center py-6 text-xs text-gray-400">
                                        Клиенты по запросу «{clientSearch}» не найдены
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Service Picker */}
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-2">
                                Выберите услугу:
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {masterServices.map(service => {
                                    const isSelected = selectedService === service && !customService;
                                    return (
                                        <button
                                            key={service}
                                            type="button"
                                            onClick={() => { setSelectedService(service); setCustomService(''); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                                isSelected
                                                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-400'
                                            }`}
                                        >
                                            {service}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-xs text-gray-400 font-medium">Другая услуга:</span>
                                <input
                                    type="text"
                                    value={customService}
                                    onChange={e => { setCustomService(e.target.value); setSelectedService(''); }}
                                    placeholder="Введите название услуги..."
                                    className="flex-1 py-1.5 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        {/* Date Picker with shortcuts */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                    Дата визита:
                                </label>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleDateShortcut(0)}
                                        className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                                    >
                                        Сегодня
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDateShortcut(1)}
                                        className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                                    >
                                        Завтра
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDateShortcut(2)}
                                        className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                                    >
                                        +2 дня
                                    </button>
                                </div>
                            </div>
                            <input 
                                type="date" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                className="block w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Time Slots Grid */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-2">
                                Выберите удобное время:
                            </label>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mb-2.5">
                                {timeSlots.map(slot => {
                                    const isSelected = selectedTimeSlot === slot && !customTime;
                                    return (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => { setSelectedTimeSlot(slot); setCustomTime(''); }}
                                            className={`py-2 text-xs rounded-lg transition-all font-semibold ${
                                                isSelected
                                                    ? 'bg-primary-600 text-white shadow-xs scale-102'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {slot}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-medium">Точное время:</span>
                                <input 
                                    type="time" 
                                    value={customTime} 
                                    onChange={e => { setCustomTime(e.target.value); setSelectedTimeSlot(''); }}
                                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1.5 px-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                            </div>
                        </div>

                        {/* Confirmation Card Preview */}
                        <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/70 dark:border-blue-900/40 text-xs space-y-1.5">
                            <p className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                                <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span>Сводка записи:</span>
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-gray-700 dark:text-gray-300">
                                <div>
                                    <span className="text-gray-400 block text-[11px]">Клиент:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{selectedClient?.['Имя клиента']}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[11px]">Автомобиль:</span>
                                    <span className="font-mono font-semibold">{selectedClient?.['Номер Авто'] || 'Не указан'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[11px]">Услуга:</span>
                                    <span className="font-semibold">{customService.trim() || selectedService}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[11px]">Время:</span>
                                    <span className="font-semibold text-primary-600 dark:text-primary-400">{formattedPreviewDate}</span>
                                </div>
                            </div>
                            {master['chatId (Telegram)'] ? (
                                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 pt-1 border-t border-blue-200/50 dark:border-blue-900/40">
                                    ✓ Мастер <b>{master['Имя']}</b> получит моментальное уведомление в Telegram (Chat ID: {master['chatId (Telegram)']}).
                                </p>
                            ) : (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 pt-1 border-t border-amber-200/50">
                                    ⚠️ У мастера не указан Chat ID в Telegram, уведомление не будет отправлено автоматически.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-800 gap-3">
                    {step === 1 ? (
                        <>
                            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
                            <Button 
                                onClick={() => setStep(2)} 
                                disabled={!selectedClientId} 
                                className="flex-1"
                            >
                                Далее: Выбрать время ➔
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                                ⬅ Назад
                            </Button>
                            <Button 
                                onClick={handleSchedule} 
                                disabled={isScheduling || (!selectedTimeSlot && !customTime) || !date}
                                className="flex-1"
                            >
                                {isScheduling ? 'Отправка...' : 'Подтвердить запись'}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// Master Craftsman Profile Card
const MasterContactCard: React.FC<{
    master: Master;
    onEdit: (m: Master) => void;
    onDelete: (id: string) => void;
    onSchedule: (m: Master) => void;
}> = ({ master, onEdit, onDelete, onSchedule }) => {
    const initials = (master['Имя'] || 'М')
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    
    const services = (master['Услуга'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const hasTelegram = Boolean(master['chatId (Telegram)'] && String(master['chatId (Telegram)']).trim());

    // Generate consistent avatar colors
    const avatarColorStyles = useMemo(() => {
        const colorPalette = [
            'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
            'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
            'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
            'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900',
            'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900',
        ];
        const idx = Math.abs((master['Имя'] || '').length) % colorPalette.length;
        return colorPalette[idx];
    }, [master]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs hover:shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 group">
            <div>
                {/* Header with Avatar and Actions */}
                <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border shadow-xs ${avatarColorStyles}`}>
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate group-hover:text-primary-600 transition-colors" title={master['Имя']}>
                                {master['Имя']}
                            </h4>
                            
                            <div className="flex items-center gap-1.5 mt-0.5">
                                {hasTelegram ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                                        <TelegramIcon className="w-3.5 h-3.5 text-sky-500" />
                                        <span>Telegram OK</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                        <span>Без Telegram</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <button 
                            type="button"
                            onClick={() => onEdit(master)} 
                            title="Редактировать мастера"
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <EditIcon className="w-4 h-4" />
                        </button>
                        <button 
                            type="button"
                            onClick={() => onDelete(master.id)} 
                            title="Удалить мастера"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Contact & Location Info */}
                <div className="space-y-2 py-2 border-y border-gray-100 dark:border-gray-700/60 text-xs">
                    {master['Телефон'] ? (
                        <a 
                            href={`tel:${master['Телефон']}`} 
                            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-semibold transition-colors"
                        >
                            <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 shrink-0">
                                <PhoneIcon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                            </div>
                            <span className="truncate">{master['Телефон']}</span>
                        </a>
                    ) : (
                        <div className="flex items-center gap-2 text-gray-400">
                            <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center text-gray-400 shrink-0">
                                <PhoneIcon className="w-3.5 h-3.5" />
                            </div>
                            <span className="italic">Телефон не указан</span>
                        </div>
                    )}

                    {master['Адрес'] && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 shrink-0">
                                <MapPinIcon className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <span className="truncate" title={master['Адрес']}>{master['Адрес']}</span>
                        </div>
                    )}

                    {hasTelegram && (
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
                            <span className="text-gray-400">Chat ID:</span>
                            <span className="bg-gray-100 dark:bg-gray-700/80 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                                {master['chatId (Telegram)']}
                            </span>
                        </div>
                    )}
                </div>

                {/* Services Tags */}
                {services.length > 0 && (
                    <div className="pt-3 pb-2">
                        <p className="text-[11px] font-semibold uppercase text-gray-400 mb-1.5">Услуги:</p>
                        <div className="flex flex-wrap gap-1.5">
                            {services.map(s => (
                                <span 
                                    key={s} 
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-gray-700/70 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                                >
                                    {s}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Action Button */}
            <div className="pt-4">
                <button
                    type="button"
                    onClick={() => onSchedule(master)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-98"
                >
                    <CalendarIcon className="w-4 h-4" />
                    <span>Записать клиента</span>
                </button>
            </div>
        </div>
    );
};

export const MastersView: React.FC<{
    masters: Master[];
    setMasters: React.Dispatch<React.SetStateAction<Master[]>>;
    clients: Client[];
}> = ({ masters, setMasters, clients }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedServiceFilter, setSelectedServiceFilter] = useState('Все');
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

    // Calculate unique services across all masters
    const availableServices = useMemo(() => {
        const set = new Set<string>();
        masters.forEach(m => {
            (m['Услуга'] || '').split(',').forEach(s => {
                const trimmed = s.trim();
                if (trimmed) set.add(trimmed);
            });
        });
        return Array.from(set);
    }, [masters]);

    // Filter masters based on search & service filter
    const filteredMasters = useMemo(() => {
        return masters.filter(m => {
            const matchesQuery = 
                !searchQuery.trim() ||
                m['Имя']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m['Телефон']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m['Услуга']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m['Адрес']?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesService = 
                selectedServiceFilter === 'Все' ||
                (m['Услуга'] || '').toLowerCase().includes(selectedServiceFilter.toLowerCase());

            return matchesQuery && matchesService;
        });
    }, [masters, searchQuery, selectedServiceFilter]);

    const connectedTelegramCount = useMemo(() => {
        return masters.filter(m => m['chatId (Telegram)'] && String(m['chatId (Telegram)']).trim()).length;
    }, [masters]);

    const handleSaveMaster = async (masterData: Omit<Master, 'id'> | Master) => {
        try {
            if ('id' in masterData && masterData.id) {
                const updatedMaster = await api.updateMaster(masterData);
                setMasters(masters.map(m => m.id === updatedMaster.id ? updatedMaster : m));
                addToast("Данные мастера обновлены", "success");
            } else {
                const newMaster = await api.addMaster(masterData);
                setMasters([...masters, newMaster]);
                addToast("Новый мастер успешно добавлен", "success");
            }
        } catch(e: any) {
            addToast(`Ошибка сохранения: ${e.message}`, 'error');
        }
    };

    const handleDeleteMaster = async (masterId: string) => {
        const master = masters.find(m => m.id === masterId);
        if (window.confirm(`Вы уверены, что хотите удалить мастера "${master?.['Имя'] || masterId}"?`)) {
            try {
                await api.deleteMaster(masterId);
                setMasters(masters.filter(m => m.id !== masterId));
                addToast("Мастер удален из справочника", "success");
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
        const finalService = service || master['Услуга']?.split(',')[0].trim() || 'Шиномонтаж';
        
        const message = `<b>✅ Новая запись клиента!</b>

Услуга: <b>${finalService}</b>
Клиент: <b>${client['Имя клиента']}</b>
Телефон: <code>${client['Телефон'] || 'Не указан'}</code>
${client['Номер Авто'] ? `Автомобиль: <b>${client['Номер Авто']}</b>\n` : ''}
${client['Склад хранения'] ? `Склад хранения: <b>${client['Склад хранения']} (ячейка ${client['Ячейка'] || '—'})</b>\n` : ''}
Дата и время: <b>${localDateTime.toLocaleString('ru-RU', { dateStyle: 'full', timeStyle: 'short' })}</b>`;

        try {
            if (!master['chatId (Telegram)']) {
                addToast(`Запись сохранена! Обратите внимание: у мастера ${master['Имя']} не привязан Telegram.`, 'success');
                return;
            }

            const result = await api.sendMessage(master['chatId (Telegram)'], message);
            if (result.success) {
                addToast(`Запись создана! Мастер ${master['Имя']} получил уведомление в Telegram`, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch(e: any) {
            addToast(`Ошибка отправки уведомления: ${e.message}`, 'error');
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Workbench Top Header */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                            <MasterIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                Справочник мастеров и сервисов
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                Быстрая запись клиентов на шиномонтаж, правку дисков и отправка деталей в Telegram
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <Button 
                        onClick={() => { setEditingMaster(null); setFormModalOpen(true); }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm font-bold w-full sm:w-auto justify-center"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>Добавить мастера</span>
                    </Button>
                </div>
            </div>

            {/* Metrics & Operational Overview Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Всего мастеров</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
                        {masters.length} <span className="text-xs font-medium text-gray-500">специалистов</span>
                    </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Telegram подключен</p>
                    <p className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
                        {connectedTelegramCount} <span className="text-xs font-medium text-gray-500">из {masters.length}</span>
                    </p>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Клиенты для записи</p>
                    <p className="text-2xl font-black text-primary-600 dark:text-primary-400 mt-0.5">
                        {clients.length} <span className="text-xs font-medium text-gray-500">в базе отеля</span>
                    </p>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Поиск мастера по имени, телефону, услуге или адресу..."
                            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Reset Filters */}
                    {(searchQuery || selectedServiceFilter !== 'Все') && (
                        <button
                            type="button"
                            onClick={() => { setSearchQuery(''); setSelectedServiceFilter('Все'); }}
                            className="text-xs text-primary-600 hover:text-primary-700 font-semibold px-2 py-1 self-center"
                        >
                            Сбросить фильтры
                        </button>
                    )}
                </div>

                {/* Service Quick Filter Chips */}
                {availableServices.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                        <span className="text-xs font-medium text-gray-400 shrink-0 mr-1">Услуги:</span>
                        <button
                            type="button"
                            onClick={() => setSelectedServiceFilter('Все')}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                selectedServiceFilter === 'Все'
                                    ? 'bg-primary-600 text-white shadow-xs'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            Все ({masters.length})
                        </button>
                        {availableServices.map(service => {
                            const count = masters.filter(m => (m['Услуга'] || '').includes(service)).length;
                            const isSelected = selectedServiceFilter === service;
                            return (
                                <button
                                    key={service}
                                    type="button"
                                    onClick={() => setSelectedServiceFilter(service)}
                                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                        isSelected
                                            ? 'bg-primary-600 text-white shadow-xs'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {service} ({count})
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Masters Cards Grid */}
            {filteredMasters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {filteredMasters.map(master => (
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
                <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-6">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto mb-3">
                        <MasterIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {masters.length === 0 ? 'Список мастеров пуст' : 'Мастера не найдены'}
                    </h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                        {masters.length === 0 
                            ? 'Добавьте ваших мастеров, шиномонтажников или сервисы-партнеры для быстрой записи клиентов.'
                            : `По запросу «${searchQuery || selectedServiceFilter}» ничего не найдено.`}
                    </p>
                    <Button 
                        onClick={() => { setEditingMaster(null); setFormModalOpen(true); }}
                        className="inline-flex items-center gap-1.5"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>Добавить мастера</span>
                    </Button>
                </div>
            )}

            {/* Add / Edit Master Modal */}
            <MasterFormModal 
                isOpen={formModalOpen}
                onClose={() => setFormModalOpen(false)}
                master={editingMaster}
                onSave={handleSaveMaster}
            />

            {/* Smart 2-Step Schedule Modal */}
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
