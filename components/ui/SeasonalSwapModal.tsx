import React, { useState, useEffect } from 'react';
import { Client, TireGroup, PRICE_BY_DIAMETER, DEFAULT_PRICE, formatDateForDisplay } from '../../types';
import { api } from '../../services/api';
import { Button } from './Button';
import { ImageUpload } from './ImageUpload';
import { 
    XMarkIcon, 
    TireIcon, 
    CheckIcon, 
    DiscIcon, 
    CalendarDaysIcon,
    ArrowLeftIcon,
    PhoneIcon
} from '../icons/Icons';

interface SeasonalSwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    onSwapComplete: (updatedClient: Client) => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

// Generate new contract number
const generateContractNumber = () => {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
};

const formatDateLocal = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localIsoDate = new Date(date.getTime() - tzOffset);
    return localIsoDate.toISOString().split('T')[0];
};

const COMMON_DEFECT_TAGS = [
    { label: '🩹 Латки', value: 'Латки' },
    { label: '📌 Жгуты', value: 'Жгуты' },
    { label: '⚠️ Грыжи', value: 'Грыжи' },
    { label: '✂️ Порезы / Трещины', value: 'Порезы' },
    { label: '🛞 Царапины дисков', value: 'Царапины дисков' },
    { label: '⚖️ Требуется балансировка', value: 'Требуется балансировка' },
    { label: '✅ Без дефектов', value: 'Без дефектов' },
];

const TREAD_DEPTH_PRESETS = ['8 мм (Новый)', '6-7 мм', '4-5 мм', '< 3 мм (Износ)'];

export const SeasonalSwapModal: React.FC<SeasonalSwapModalProps> = ({
    isOpen,
    onClose,
    client,
    onSwapComplete,
    showToast
}) => {
    // Current outgoing set season
    const currentSeason = client['Сезон'] || 'Зима';
    const defaultIncomingSeason = currentSeason === 'Зима' ? 'Лето' : 'Зима';

    // State for archived sets
    const [archivedOrders, setArchivedOrders] = useState<Client[]>([]);
    const [isLoadingArchived, setIsLoadingArchived] = useState(false);
    const [selectedPastOrderId, setSelectedPastOrderId] = useState<string | null>(null);

    // Incoming tire set state
    const [season, setSeason] = useState<'Лето' | 'Зима'>(defaultIncomingSeason);
    const [brandModel, setBrandModel] = useState('');
    const [tireSize, setTireSize] = useState(client['Размер шин'] || '');
    const [tireCount, setTireCount] = useState<number>(client['Кол-во шин'] || 4);
    const [hasRims, setHasRims] = useState<'Да' | 'Нет'>(client['Наличие дисков'] || 'Нет');
    const [dotCode, setDotCode] = useState('');
    
    // Defect & Inspection state ("Там могут появиться дефекты, латки")
    const [selectedDefects, setSelectedDefects] = useState<string[]>([]);
    const [treadDepth, setTreadDepth] = useState<string>('6-7 мм');
    const [customNotes, setCustomNotes] = useState<string>('');
    const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);

    // Storage parameters for new order
    const [storageCell, setStorageCell] = useState(client['Ячейка'] || '');
    const [storageWarehouse, setStorageWarehouse] = useState(client['Склад хранения'] || 'Основной');
    const [storageMonths, setStorageMonths] = useState<number>(6); // standard 6 months season
    const [pricePerMonth, setPricePerMonth] = useState<number>(client['Цена за месяц'] || 600);
    
    // Services
    const [washService, setWashService] = useState<boolean>(true); // default tire wash during season swap
    const [packService, setPackService] = useState<boolean>(client['Услуга: Упаковка'] || false);
    const [deliveryService, setDeliveryService] = useState<boolean>(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch archived orders of this client to offer previously stored sets
    useEffect(() => {
        if (!isOpen || !client) return;
        
        let isMounted = true;
        setIsLoadingArchived(true);
        api.fetchArchivedOrders(client.id)
            .then((orders) => {
                if (!isMounted) return;
                setArchivedOrders(orders);

                // Auto-pick the most recent set of the OPPOSITE season if found!
                const matchingPastSet = orders.find(o => o['Сезон'] === defaultIncomingSeason);
                if (matchingPastSet) {
                    applyPastOrder(matchingPastSet);
                } else {
                    // Fallback: initialize with clean opposite season
                    setSeason(defaultIncomingSeason);
                    setTireSize(client['Размер шин'] || '');
                    setHasRims(client['Наличие дисков'] || 'Нет');
                }
            })
            .catch(() => {
                if (!isMounted) return;
                setArchivedOrders([]);
            })
            .finally(() => {
                if (isMounted) setIsLoadingArchived(false);
            });

        return () => { isMounted = false; };
    }, [isOpen, client?.id]);

    // Recalculate price whenever tire size changes
    useEffect(() => {
        if (!tireSize) return;
        const match = tireSize.match(/R(\d+([,.]\d+)?)/i);
        if (match && match[1]) {
            const diam = match[1].replace('.', ',');
            if (PRICE_BY_DIAMETER[diam]) {
                setPricePerMonth(PRICE_BY_DIAMETER[diam]);
            }
        }
    }, [tireSize]);

    // Apply data from a previously stored order
    const applyPastOrder = (pastOrder: Client) => {
        setSelectedPastOrderId(pastOrder.id);
        if (pastOrder['Сезон']) setSeason(pastOrder['Сезон']);
        if (pastOrder['Бренд_Модель']) setBrandModel(pastOrder['Бренд_Модель']);
        if (pastOrder['Размер шин']) setTireSize(pastOrder['Размер шин']);
        if (pastOrder['Кол-во шин']) setTireCount(pastOrder['Кол-во шин']);
        if (pastOrder['Наличие дисков']) setHasRims(pastOrder['Наличие дисков']);
        if (pastOrder['DOT-код']) setDotCode(pastOrder['DOT-код']);
        if (pastOrder['Цена за месяц']) setPricePerMonth(pastOrder['Цена за месяц']);
    };

    // Toggle a defect tag
    const toggleDefectTag = (defect: string) => {
        if (defect === 'Без дефектов') {
            setSelectedDefects(['Без дефектов']);
            return;
        }

        setSelectedDefects(prev => {
            const filtered = prev.filter(d => d !== 'Без дефектов');
            if (filtered.includes(defect)) {
                return filtered.filter(d => d !== defect);
            } else {
                return [...filtered, defect];
            }
        });
    };

    if (!isOpen) return null;

    // Financial calculations
    const totalPrice = pricePerMonth * storageMonths;

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!brandModel.trim() && !tireSize.trim()) {
            showToast('Укажите марку/модель или размер принимаемых шин', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            const now = new Date();
            const startDateStr = formatDateLocal(now);
            
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + storageMonths);
            const endDateStr = formatDateLocal(endDate);

            const remindDate = new Date(endDate);
            remindDate.setDate(remindDate.getDate() - 14); // 2 weeks before end
            const remindDateStr = formatDateLocal(remindDate);

            // Construct consolidated defect & inspection notes
            const defectListStr = selectedDefects.length > 0 
                ? selectedDefects.join(', ') 
                : 'Без явных дефектов';
            
            const fullInspectionNotes = [
                `Сезонная замена (принят комплект ${season}).`,
                `Протектор: ${treadDepth}.`,
                `Дефекты: ${defectListStr}.`,
                customNotes.trim() ? `Заметки мастера: ${customNotes.trim()}` : ''
            ].filter(Boolean).join(' ');

            const newContractNumber = generateContractNumber();

            // Prepare new client data
            const newClientData: Partial<Client> = {
                ...client,
                'Договор': newContractNumber,
                'Сезон': season,
                'Бренд_Модель': brandModel.trim() || `${season} комплект`,
                'Размер шин': tireSize.trim(),
                'Кол-во шин': Number(tireCount) || 4,
                'Наличие дисков': hasRims,
                'DOT-код': dotCode.trim(),
                'Начало': startDateStr,
                'Срок': storageMonths,
                'Окончание': endDateStr,
                'Напомнить': remindDateStr,
                'Склад хранения': storageWarehouse,
                'Ячейка': storageCell.trim(),
                'Цена за месяц': pricePerMonth,
                'Общая сумма': totalPrice,
                'Долг': totalPrice, // initially full sum as debt until paid
                'Статус сделки': 'На складе',
                'Заказ - QR': fullInspectionNotes,
                'Услуга: Мойка': washService,
                'Услуга: Упаковка': packService,
                'Услуга: Вывоз': deliveryService,
                // If new photos were uploaded, preserve existing or reset for new season
                photoUrls: uploadedPhotos.length > 0 ? [] : (client.photoUrls || [])
            };

            // Describe outgoing set
            const outgoingDesc = `${client['Сезон'] || 'Текущий комплект'} (${client['Бренд_Модель'] || ''} ${client['Размер шин'] || ''}) из ячейки №${client['Ячейка'] || '—'}`;
            const incomingDesc = `${season} (${brandModel || ''} ${tireSize}) в ячейку №${storageCell || '—'}. Дефекты: ${defectListStr}`;

            const updated = await api.seasonalSwap(
                client.id,
                newClientData,
                {
                    archiveAction: 'Выдача со склада',
                    archiveDetails: `Комплект ${outgoingDesc} выдан клиенту со склада при сезонной замене.`,
                    newAction: 'Принят на хранение',
                    newDetails: `Принят комплект ${incomingDesc}.`
                }
            );

            showToast('Сезонная замена успешно оформлена! Текущий комплект перенесен в историю.', 'success');
            onSwapComplete(updated);
            onClose();
        } catch (err: any) {
            console.error('Seasonal swap error:', err);
            showToast(err?.message || 'Ошибка при оформлении сезонной замены', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="px-4 py-3.5 sm:px-6 bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xl select-none">🔄</span>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                                Сезонная замена комплекта
                            </h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {client['Имя клиента']} · Авто: {client['Номер Авто'] || 'Без номера'}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        title="Закрыть"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
                    
                    {/* STEP 1: CURRENT STORED SET BEING ISSUED TO CLIENT */}
                    <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                <span>📤 Выдаём клиенту со склада:</span>
                            </span>
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">
                                Переносится в архив
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white text-sm">
                                    {client['Сезон'] === 'Лето' ? '☀️ Лето' : '❄️ Зима'} · {client['Бренд_Модель'] || 'Комплект шин'}
                                </p>
                                <p className="text-gray-600 dark:text-gray-300 font-mono mt-0.5">
                                    {client['Размер шин'] || 'Размер не указан'} · {client['Кол-во шин'] || 4} шт. · {client['Наличие дисков'] === 'Да' ? 'С дисками' : 'Без дисков'}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="font-mono font-bold text-gray-700 dark:text-gray-300 bg-white/80 dark:bg-gray-800 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900">
                                    Ячейка: № {client['Ячейка'] || '—'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* STEP 2: PREVIOUS SETS SELECTION OR FAST REUSE */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                📥 Принимаем на хранение (сменяемый комплект):
                            </label>
                            {isLoadingArchived && (
                                <span className="text-[11px] text-gray-400 italic">Поиск истории...</span>
                            )}
                        </div>

                        {/* Previously Stored Sets of this client */}
                        {archivedOrders.length > 0 && (
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                    Ранее хранившиеся комплекты клиента:
                                </span>
                                <div className="grid grid-cols-1 gap-2">
                                    {archivedOrders.map((ord) => {
                                        const isSelected = selectedPastOrderId === ord.id;
                                        return (
                                            <button
                                                key={ord.id}
                                                type="button"
                                                onClick={() => applyPastOrder(ord)}
                                                className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
                                                    isSelected
                                                        ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 ring-2 ring-primary-500/20'
                                                        : 'bg-gray-50/70 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-xs text-gray-900 dark:text-white">
                                                            {ord['Сезон'] === 'Лето' ? '☀️ Лето' : '❄️ Зима'} · {ord['Бренд_Модель'] || 'Комплект'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                            (Договор #{ord['Договор']})
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">
                                                        {ord['Размер шин']} · {ord['Кол-во шин'] || 4} шт. · {ord['Наличие дисков'] === 'Да' ? 'С дисками' : 'Без дисков'}
                                                    </p>
                                                </div>

                                                <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${
                                                    isSelected 
                                                        ? 'bg-primary-600 text-white' 
                                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                                                }`}>
                                                    {isSelected ? '✓ Выбран' : 'Использовать'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Tire Parameters Fields */}
                        <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/30 border border-gray-200/80 dark:border-gray-700/80 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {/* Season */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                        Сезон:
                                    </label>
                                    <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setSeason('Лето')}
                                            className={`flex-1 py-1.5 font-bold transition-colors ${
                                                season === 'Лето'
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            ☀️ Лето
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSeason('Зима')}
                                            className={`flex-1 py-1.5 font-bold transition-colors ${
                                                season === 'Зима'
                                                    ? 'bg-sky-600 text-white'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            ❄️ Зима
                                        </button>
                                    </div>
                                </div>

                                {/* Count */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                        Кол-во шин:
                                    </label>
                                    <select
                                        value={tireCount}
                                        onChange={e => setTireCount(Number(e.target.value))}
                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2 text-gray-900 dark:text-white"
                                    >
                                        <option value={4}>4 шт.</option>
                                        <option value={2}>2 шт.</option>
                                        <option value={1}>1 шт.</option>
                                        <option value={5}>5 шт.</option>
                                    </select>
                                </div>

                                {/* Rims */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                        Диски:
                                    </label>
                                    <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setHasRims('Да')}
                                            className={`flex-1 py-1.5 font-bold transition-colors ${
                                                hasRims === 'Да'
                                                    ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            С дисками
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasRims('Нет')}
                                            className={`flex-1 py-1.5 font-bold transition-colors ${
                                                hasRims === 'Нет'
                                                    ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            Без дисков
                                        </button>
                                    </div>
                                </div>

                                {/* DOT Code */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                        DOT-код:
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="2422"
                                        value={dotCode}
                                        onChange={e => setDotCode(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2 font-mono text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {/* Brand and Model */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                        Марка и модель шин:
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Например: Michelin Pilot Sport 4"
                                        value={brandModel}
                                        onChange={e => setBrandModel(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2.5 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Tire Size */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                        Размер шин:
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="225/50 R17"
                                        value={tireSize}
                                        onChange={e => setTireSize(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2.5 font-mono text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STEP 3: DEFECTS, PATCHES & INSPECTION (CRITICAL REQUEST POINT) */}
                    <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                                <span>🔍 Дефекты и состояние после сезона эксплуатации:</span>
                            </span>
                            <span className="text-[10px] text-gray-500 italic">Латки, жгуты, износ</span>
                        </div>

                        {/* Defect Quick Tags */}
                        <div>
                            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1.5">
                                Быстрые отметки обнаруженных дефектов:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {COMMON_DEFECT_TAGS.map(tag => {
                                    const isChecked = selectedDefects.includes(tag.value);
                                    return (
                                        <button
                                            key={tag.value}
                                            type="button"
                                            onClick={() => toggleDefectTag(tag.value)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                                isChecked
                                                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                            }`}
                                        >
                                            {tag.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tread Depth Presets */}
                        <div>
                            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1.5">
                                Остаток глубины протектора:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {TREAD_DEPTH_PRESETS.map(preset => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setTreadDepth(preset)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                            treadDepth === preset
                                                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-900 dark:border-gray-100'
                                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                        }`}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Defect Notes */}
                        <div>
                            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Подробное описание дефектов (колесо, характер повреждения):
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Например: 1 латка на заднем правом колесе, притёртость на 2 дисках..."
                                value={customNotes}
                                onChange={e => setCustomNotes(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs p-2.5 text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* Photo attachment for accepted set */}
                        <div>
                            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1">
                                Свежие фото приёмки / повреждений (при необходимости):
                            </span>
                            <ImageUpload
                                onFilesChange={setUploadedPhotos}
                                maxFiles={6}
                                label="Добавить фото дефектов и шин"
                            />
                        </div>
                    </div>

                    {/* STEP 4: STORAGE LOCATION & TERMS */}
                    <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/30 border border-gray-200/80 dark:border-gray-700/80 space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                            📍 Склад хранения и срок нового договора:
                        </span>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {/* Warehouse */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                    Склад:
                                </label>
                                <input
                                    type="text"
                                    value={storageWarehouse}
                                    onChange={e => setStorageWarehouse(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2 text-gray-900 dark:text-white"
                                />
                            </div>

                            {/* Storage Cell (vacated cell pre-filled) */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                    Ячейка:
                                </label>
                                <input
                                    type="text"
                                    placeholder="№ 12"
                                    value={storageCell}
                                    onChange={e => setStorageCell(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2 font-mono font-bold text-gray-900 dark:text-white"
                                />
                            </div>

                            {/* Duration */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                    Срок:
                                </label>
                                <select
                                    value={storageMonths}
                                    onChange={e => setStorageMonths(Number(e.target.value))}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2 text-gray-900 dark:text-white font-bold"
                                >
                                    <option value={6}>6 мес. (Сезон)</option>
                                    <option value={7}>7 мес.</option>
                                    <option value={8}>8 мес.</option>
                                    <option value={12}>12 мес. (Год)</option>
                                </select>
                            </div>

                            {/* Price / month */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                    Цена / месяц:
                                </label>
                                <input
                                    type="number"
                                    value={pricePerMonth}
                                    onChange={e => setPricePerMonth(Number(e.target.value))}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2 text-gray-900 dark:text-white font-bold"
                                />
                            </div>
                        </div>

                        {/* Additional Services */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
                            <span className="text-[11px] text-gray-400 mr-1">Доп. услуги:</span>
                            
                            <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={washService}
                                    onChange={e => setWashService(e.target.checked)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span>🚿 Мойка шин</span>
                            </label>

                            <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none ml-2">
                                <input
                                    type="checkbox"
                                    checked={packService}
                                    onChange={e => setPackService(e.target.checked)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span>📦 Пакеты</span>
                            </label>

                            <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none ml-2">
                                <input
                                    type="checkbox"
                                    checked={deliveryService}
                                    onChange={e => setDeliveryService(e.target.checked)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span>🚚 Вывоз</span>
                            </label>
                        </div>

                        {/* Calculated Total */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200/70 dark:border-gray-700/70">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Итоговая сумма за {storageMonths} мес.:
                            </span>
                            <span className="font-mono font-black text-base text-gray-900 dark:text-white">
                                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(totalPrice)}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSubmitting}
                            className="!py-2.5 px-5 font-bold"
                        >
                            {isSubmitting ? 'Оформление...' : '✓ Подтвердить сезонную замену'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
