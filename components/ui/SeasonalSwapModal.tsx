import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Client, TireGroup, PRICE_BY_DIAMETER, DEFAULT_PRICE, formatDateForDisplay } from '../../types';
import { api } from '../../services/api';
import { TIRE_DATA } from '../../data/brands';
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

const parseTireSize = (val: string) => {
    const match = val.match(/(\d+)\/?(\d*)[R\s]*(\d*([,.]\d+)?)/i);
    return {
        width: match?.[1] || '',
        profile: match?.[2] || '',
        diameter: match?.[3]?.replace('.', ',') || ''
    };
};

const splitBrandAndModel = (fullStr: string) => {
    const trimmed = (fullStr || '').trim();
    if (!trimmed) return { brand: '', model: '' };
    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace > -1) {
        return {
            brand: trimmed.substring(0, firstSpace),
            model: trimmed.substring(firstSpace + 1)
        };
    }
    return { brand: trimmed, model: '' };
};

const COMMON_DEFECT_TAGS = [
    { label: '🩹 Латки', value: 'Латки' },
    { label: '📌 Жгуты', value: 'Жгуты' },
    { label: '⚠️ Грыжи', value: 'Грыжи' },
    { label: '✂️ Порезы / Трещины', value: 'Порезы' },
    { label: '🛞 Царапины дисков', value: 'Царапины дисков' },
    { label: '⚖️ Требуется балансировка', value: 'Требуется балансировка' },
    { label: '🆕 Замена колес на новые', value: 'Замена колес на новые' },
    { label: '✅ Без дефектов', value: 'Без дефектов' },
];

const TREAD_DEPTH_PRESETS = ['8 мм (Новый)', '6-7 мм', '4-5 мм', '< 3 мм (Износ)'];

type SetConfigMode = 'standard' | 'split2plus2' | 'staggered';

// Smart Brand & Model Autocomplete Input Component
const BrandModelSelector: React.FC<{
    brand: string;
    model: string;
    onBrandChange: (brand: string) => void;
    onModelChange: (model: string) => void;
    placeholderBrand?: string;
    placeholderModel?: string;
    labelBrand?: string;
    labelModel?: string;
}> = ({
    brand,
    model,
    onBrandChange,
    onModelChange,
    placeholderBrand = "Michelin, Nokian, Pirelli...",
    placeholderModel = "Pilot Sport, Hakkapeliitta...",
    labelBrand = "Марка шин:",
    labelModel = "Модель шин:"
}) => {
    const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
    const [showModelSuggestions, setShowModelSuggestions] = useState(false);
    const modelInputRef = useRef<HTMLInputElement>(null);

    const brandNames = useMemo(() => TIRE_DATA.map(d => d.brand), []);
    const filteredBrands = useMemo(() => {
        if (!brand || !brand.trim()) return brandNames.slice(0, 15);
        const query = brand.trim().toLowerCase();
        return brandNames.filter(b => b.toLowerCase().includes(query)).slice(0, 15);
    }, [brand, brandNames]);

    const filteredModels = useMemo(() => {
        const found = TIRE_DATA.find(d => d.brand.toLowerCase() === brand.trim().toLowerCase());
        if (!found || !found.models) return [];
        if (!model || !model.trim()) return found.models.slice(0, 15);
        const query = model.trim().toLowerCase();
        return found.models.filter(m => m.toLowerCase().includes(query)).slice(0, 15);
    }, [brand, model]);

    const handleSelectBrand = (selectedBrand: string) => {
        onBrandChange(selectedBrand);
        setShowBrandSuggestions(false);
        if (modelInputRef.current) {
            modelInputRef.current.focus();
            setShowModelSuggestions(true);
        }
    };

    const handleSelectModel = (selectedModel: string) => {
        onModelChange(selectedModel);
        setShowModelSuggestions(false);
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Brand Input with Autocomplete */}
            <div className="relative">
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                    {labelBrand}
                </label>
                <input
                    type="text"
                    value={brand}
                    onChange={e => {
                        onBrandChange(e.target.value);
                        setShowBrandSuggestions(true);
                    }}
                    onFocus={() => setShowBrandSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 200)}
                    placeholder={placeholderBrand}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {showBrandSuggestions && filteredBrands.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 text-xs divide-y divide-gray-100 dark:divide-gray-700/50">
                        {filteredBrands.map(b => (
                            <li
                                key={b}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectBrand(b);
                                }}
                                className="px-3 py-1.5 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-800 dark:text-gray-200 font-medium transition-colors flex items-center justify-between"
                            >
                                <span>{b}</span>
                                <span className="text-[10px] text-gray-400">бренд</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Model Input with Autocomplete */}
            <div className="relative">
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                    {labelModel}
                </label>
                <input
                    ref={modelInputRef}
                    type="text"
                    value={model}
                    onChange={e => {
                        onModelChange(e.target.value);
                        setShowModelSuggestions(true);
                    }}
                    onFocus={() => setShowModelSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowModelSuggestions(false), 200)}
                    placeholder={placeholderModel}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {showModelSuggestions && filteredModels.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 text-xs divide-y divide-gray-100 dark:divide-gray-700/50">
                        {filteredModels.map(m => (
                            <li
                                key={m}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectModel(m);
                                }}
                                className="px-3 py-1.5 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-800 dark:text-gray-200 font-medium transition-colors flex items-center justify-between"
                            >
                                <span>{m}</span>
                                <span className="text-[10px] text-gray-400">модель</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

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

    // Car plate edit state (if client changed car or plate)
    const [carPlate, setCarPlate] = useState<string>(client['Номер Авто'] || '');
    const [isEditingCar, setIsEditingCar] = useState<boolean>(false);

    // Configuration mode: 'standard' (4 uniform) | 'split2plus2' (2 old + 2 new) | 'staggered' (front/rear)
    const [configMode, setConfigMode] = useState<SetConfigMode>('standard');

    // General Incoming Set Properties
    const [season, setSeason] = useState<'Лето' | 'Зима'>(defaultIncomingSeason);
    const [hasRims, setHasRims] = useState<'Да' | 'Нет'>(client['Наличие дисков'] || 'Нет');

    // --- 1. Standard Set State (4 uniform) ---
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [tireSize, setTireSize] = useState(client['Размер шин'] || '');
    const [tireCount, setTireCount] = useState<number>(client['Кол-во шин'] || 4);
    const [dotMode, setDotMode] = useState<'identical' | 'individual'>('identical');
    const [dotCode, setDotCode] = useState('');
    const [wheelDots, setWheelDots] = useState<string[]>(['', '', '', '']);

    // --- 2. Split 2+2 State (2 Old from past storage + 2 New tires) ---
    const [oldPairBrand, setOldPairBrand] = useState('');
    const [oldPairModel, setOldPairModel] = useState('');
    const [oldPairSize, setOldPairSize] = useState('');
    const [oldPairDot, setOldPairDot] = useState('');
    const [oldPairAxle, setOldPairAxle] = useState<string>('Задняя ось (ЗЛ + ЗП)');

    const [newPairMatchesOld, setNewPairMatchesOld] = useState<boolean>(true);
    const [newPairBrand, setNewPairBrand] = useState('');
    const [newPairModel, setNewPairModel] = useState('');
    const [newPairSize, setNewPairSize] = useState('');
    const [newPairDot, setNewPairDot] = useState('');
    const [newPairAxle, setNewPairAxle] = useState<string>('Передняя ось (ПЛ + ПП)');

    // --- 3. Staggered State (Front / Rear Axles) ---
    const [frontBrand, setFrontBrand] = useState('');
    const [frontModel, setFrontModel] = useState('');
    const [frontSize, setFrontSize] = useState('');
    const [frontDot, setFrontDot] = useState('');

    const [rearBrand, setRearBrand] = useState('');
    const [rearModel, setRearModel] = useState('');
    const [rearSize, setRearSize] = useState('');
    const [rearDot, setRearDot] = useState('');
    
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
        setCarPlate(client['Номер Авто'] || '');
        setIsEditingCar(false);

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
                    const splitted = splitBrandAndModel(client['Бренд_Модель'] || '');
                    setBrand(splitted.brand);
                    setModel(splitted.model);
                    setDotCode(client['DOT-код'] || '');
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

    // Extract unique historical DOTs with counts from past orders or current client
    const historicalDotOptions = useMemo(() => {
        const counts: Record<string, number> = {};
        const sources: (string | undefined)[] = [
            client['DOT-код'],
            ...(archivedOrders.map(o => o['DOT-код']))
        ];
        sources.forEach(src => {
            if (!src) return;
            const tokens = src.split(/[/,;+\s]+/)
                .map(t => t.trim().replace(/^DOT\s*[:.-]?\s*/i, ''))
                .filter(t => t.length >= 3 && /^\d+$/.test(t));
            tokens.forEach(tok => {
                counts[tok] = (counts[tok] || 0) + 1;
            });
        });

        return Object.entries(counts).map(([dot, count]) => ({
            dot,
            count
        }));
    }, [client, archivedOrders]);

    // Recalculate price whenever tire size changes
    useEffect(() => {
        const sizeToCheck = configMode === 'staggered' 
            ? (rearSize || frontSize) 
            : configMode === 'split2plus2' 
                ? (oldPairSize || newPairSize) 
                : tireSize;

        if (!sizeToCheck) return;
        const match = sizeToCheck.match(/R(\d+([,.]\d+)?)/i);
        if (match && match[1]) {
            const diam = match[1].replace('.', ',');
            if (PRICE_BY_DIAMETER[diam]) {
                setPricePerMonth(PRICE_BY_DIAMETER[diam]);
            }
        }
    }, [tireSize, configMode, frontSize, rearSize, oldPairSize, newPairSize]);

    // Apply data from a previously stored order
    const applyPastOrder = (pastOrder: Client) => {
        setSelectedPastOrderId(pastOrder.id);
        if (pastOrder['Сезон']) setSeason(pastOrder['Сезон']);
        if (pastOrder['Наличие дисков']) setHasRims(pastOrder['Наличие дисков']);
        if (pastOrder['Цена за месяц']) setPricePerMonth(pastOrder['Цена за месяц']);
        if (pastOrder['Кол-во шин']) setTireCount(pastOrder['Кол-во шин']);

        // Check if past order had staggered axle groups
        let pastGroups: TireGroup[] = [];
        if (pastOrder.metadata) {
            try {
                const parsed = JSON.parse(pastOrder.metadata);
                if (parsed.groups && Array.isArray(parsed.groups)) pastGroups = parsed.groups;
            } catch(e) {}
        }
        if (pastGroups.length === 0 && pastOrder['Заказ - QR']) {
            const match = pastOrder['Заказ - QR'].match(/\|\|JSON:(.*)$/);
            if (match) {
                try {
                    const parsed = JSON.parse(match[1]);
                    if (parsed.groups && Array.isArray(parsed.groups)) pastGroups = parsed.groups;
                } catch (e) {}
            }
        }

        if (pastGroups.length > 1) {
            setConfigMode('staggered');
            setFrontBrand(pastGroups[0].brand || '');
            setFrontModel(pastGroups[0].model || '');
            setFrontSize(`${pastGroups[0].width}/${pastGroups[0].profile} R${pastGroups[0].diameter}`);
            setFrontDot(pastGroups[0].dot || '');

            setRearBrand(pastGroups[1].brand || '');
            setRearModel(pastGroups[1].model || '');
            setRearSize(`${pastGroups[1].width}/${pastGroups[1].profile} R${pastGroups[1].diameter}`);
            setRearDot(pastGroups[1].dot || '');
        } else {
            setConfigMode('standard');
            const splitted = splitBrandAndModel(pastOrder['Бренд_Модель'] || '');
            setBrand(splitted.brand);
            setModel(splitted.model);
            if (pastOrder['Размер шин']) setTireSize(pastOrder['Размер шин']);
            
            const rawDot = pastOrder['DOT-код'] || '';
            setDotCode(rawDot);

            // Prefill Old Pair of Split 2+2
            setOldPairBrand(splitted.brand);
            setOldPairModel(splitted.model);
            setOldPairSize(pastOrder['Размер шин'] || '');
            
            // Clean DOT token for old pair if multiple codes were present
            const dotTokens = rawDot.split(/[/,;+\s]+/).map(s => s.trim().replace(/^DOT\s*[:.-]?\s*/i, '')).filter(Boolean);
            setOldPairDot(dotTokens[0] || rawDot);

            // Prefill New Pair automatically with identical parameters so operator doesn't re-type!
            setNewPairBrand(splitted.brand);
            setNewPairModel(splitted.model);
            setNewPairSize(pastOrder['Размер шин'] || '');
            setNewPairMatchesOld(true);

            // If DOT contains multiple distinct codes, initialize individual wheel slots
            const distinctTokens = new Set(dotTokens);
            if (dotTokens.length > 1 && distinctTokens.size > 1) {
                setDotMode('individual');
                const slots = [...dotTokens];
                while (slots.length < 4) slots.push(dotTokens[0] || '');
                setWheelDots(slots.slice(0, 4));
            } else {
                setDotMode('identical');
                setWheelDots([rawDot, rawDot, rawDot, rawDot]);
            }
        }
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

    // Copy wheel 1 DOT to all wheels
    const copyWheel1ToAll = () => {
        const first = wheelDots[0] || dotCode;
        setWheelDots([first, first, first, first]);
    };

    if (!isOpen) return null;

    // Financial calculations
    const totalPrice = pricePerMonth * storageMonths;

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (configMode === 'staggered') {
            if (!frontSize.trim() || !rearSize.trim()) {
                showToast('Укажите размеры для передней и задней оси', 'error');
                return;
            }
        } else if (configMode === 'split2plus2') {
            if (!oldPairSize.trim() && !newPairSize.trim()) {
                showToast('Укажите размеры шин для комплекта', 'error');
                return;
            }
        } else {
            if (!brand.trim() && !tireSize.trim()) {
                showToast('Укажите марку или размер принимаемых шин', 'error');
                return;
            }
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

            // Determine final DOT string and configuration payload
            let finalDotString = '';
            let finalBrandModel = '';
            let finalTireSize = '';
            let metadataPayload = client.metadata || '';

            if (configMode === 'staggered') {
                finalDotString = [frontDot.trim(), rearDot.trim()].filter(Boolean).join(' / ');
                finalBrandModel = `${`${frontBrand} ${frontModel}`.trim() || 'Перед'} / ${`${rearBrand} ${rearModel}`.trim() || 'Зад'}`;
                finalTireSize = `${frontSize.trim()} / ${rearSize.trim()}`;

                const frontParsed = parseTireSize(frontSize);
                const rearParsed = parseTireSize(rearSize);

                const groups: TireGroup[] = [
                    {
                        id: 'group_front',
                        brand: frontBrand || 'Шины',
                        model: frontModel || '',
                        width: frontParsed.width,
                        profile: frontParsed.profile,
                        diameter: frontParsed.diameter,
                        count: 2,
                        season: season,
                        hasRims: hasRims,
                        pricePerMonth: Math.round(pricePerMonth / 2),
                        dot: frontDot.trim()
                    },
                    {
                        id: 'group_rear',
                        brand: rearBrand || 'Шины',
                        model: rearModel || '',
                        width: rearParsed.width,
                        profile: rearParsed.profile,
                        diameter: rearParsed.diameter,
                        count: 2,
                        season: season,
                        hasRims: hasRims,
                        pricePerMonth: Math.round(pricePerMonth / 2),
                        dot: rearDot.trim()
                    }
                ];
                metadataPayload = JSON.stringify({ groups });

            } else if (configMode === 'split2plus2') {
                finalDotString = [oldPairDot.trim(), newPairDot.trim()].filter(Boolean).join(' / ');
                const effNewBrand = newPairMatchesOld ? (oldPairBrand || brand) : (newPairBrand || oldPairBrand || brand);
                const effNewModel = newPairMatchesOld ? (oldPairModel || model) : (newPairModel || oldPairModel || model);
                const effNewSize = newPairMatchesOld ? (oldPairSize || tireSize) : (newPairSize || oldPairSize || tireSize);

                const oldAxleTag = oldPairAxle ? ` (${oldPairAxle})` : '';
                const newAxleTag = newPairAxle ? ` (${newPairAxle})` : '';

                const oldFull = `${oldPairBrand} ${oldPairModel}`.trim() || 'Старые шины';
                const newFull = `${effNewBrand} ${effNewModel}`.trim() || 'Новые шины';
                finalBrandModel = `${oldFull}${oldAxleTag} (2 шт) + ${newFull}${newAxleTag} (2 шт)`;
                finalTireSize = oldPairSize.trim() === effNewSize.trim() 
                    ? oldPairSize.trim() 
                    : `${oldPairSize.trim()} + ${effNewSize.trim()}`;

                const oldParsed = parseTireSize(oldPairSize);
                const newParsed = parseTireSize(effNewSize);

                const groups: TireGroup[] = [
                    {
                        id: 'group_old',
                        brand: oldPairBrand || 'Шины',
                        model: `${oldPairModel}${oldAxleTag} (ранее хранились)`.trim(),
                        width: oldParsed.width,
                        profile: oldParsed.profile,
                        diameter: oldParsed.diameter,
                        count: 2,
                        season: season,
                        hasRims: hasRims,
                        pricePerMonth: Math.round(pricePerMonth / 2),
                        dot: oldPairDot.trim()
                    },
                    {
                        id: 'group_new',
                        brand: effNewBrand || 'Шины',
                        model: `${effNewModel}${newAxleTag} (новые шины)`.trim(),
                        width: newParsed.width,
                        profile: newParsed.profile,
                        diameter: newParsed.diameter,
                        count: 2,
                        season: season,
                        hasRims: hasRims,
                        pricePerMonth: Math.round(pricePerMonth / 2),
                        dot: newPairDot.trim()
                    }
                ];
                metadataPayload = JSON.stringify({ groups });

            } else {
                // Standard mode
                finalBrandModel = `${brand} ${model}`.trim() || `${season} комплект`;
                finalTireSize = tireSize.trim();
                if (dotMode === 'individual') {
                    const activeWheelDots = wheelDots.slice(0, tireCount).map(s => s.trim()).filter(Boolean);
                    finalDotString = activeWheelDots.join(' / ');
                } else {
                    finalDotString = dotCode.trim();
                }
                metadataPayload = ''; // single uniform set
            }

            // Construct consolidated defect & inspection notes
            const defectListStr = selectedDefects.length > 0 
                ? selectedDefects.join(', ') 
                : 'Без явных дефектов';
            
            const configNotes = configMode === 'split2plus2' 
                ? ', составной 2+2 (2 старых + 2 новых)' 
                : configMode === 'staggered' 
                    ? ', разноширокий' 
                    : '';

            const fullInspectionNotes = [
                `Сезонная замена (принят комплект ${season}${configNotes}).`,
                `Протектор: ${treadDepth}.`,
                `Дефекты: ${defectListStr}.`,
                customNotes.trim() ? `Заметки мастера: ${customNotes.trim()}` : ''
            ].filter(Boolean).join(' ');

            const newContractNumber = generateContractNumber();

            // Prepare new client data
            const newClientData: Partial<Client> = {
                ...client,
                'Номер Авто': carPlate.trim().toUpperCase() || client['Номер Авто'],
                'Договор': newContractNumber,
                'Сезон': season,
                'Бренд_Модель': finalBrandModel,
                'Размер шин': finalTireSize,
                'Кол-во шин': configMode === 'standard' ? (Number(tireCount) || 4) : 4,
                'Наличие дисков': hasRims,
                'DOT-код': finalDotString,
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
                'metadata': metadataPayload,
                'Услуга: Мойка': washService,
                'Услуга: Упаковка': packService,
                'Услуга: Вывоз': deliveryService,
                photoUrls: uploadedPhotos.length > 0 ? [] : (client.photoUrls || [])
            };

            // Describe outgoing set
            const outgoingDesc = `${client['Сезон'] || 'Текущий комплект'} (${client['Бренд_Модель'] || ''} ${client['Размер шин'] || ''}) из ячейки №${client['Ячейка'] || '—'}`;
            const incomingDesc = `${season} (${finalBrandModel} ${finalTireSize}) в ячейку №${storageCell || '—'}. Дефекты: ${defectListStr}. DOT: ${finalDotString || '—'}`;

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
                
                {/* Header with car plate and vehicle change option */}
                <div className="px-4 py-3.5 sm:px-6 bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
                    <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xl select-none">🔄</span>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                                Сезонная замена комплекта
                            </h3>
                        </div>

                        {/* Client & Car Info Row (with quick car change option) */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {client['Имя клиента']}
                            </span>
                            <span>·</span>
                            {!isEditingCar ? (
                                <div className="inline-flex items-center gap-1.5">
                                    <span>Авто:</span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                                        {carPlate || 'Без номера'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingCar(true)}
                                        className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline ml-1"
                                    >
                                        Сменился авто?
                                    </button>
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Новый госномер:</span>
                                    <input
                                        type="text"
                                        value={carPlate}
                                        onChange={e => setCarPlate(e.target.value.toUpperCase())}
                                        placeholder="А 123 ВС 77"
                                        className="w-24 px-1.5 py-0.5 text-xs font-mono font-bold border border-amber-300 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingCar(false)}
                                        className="text-[10px] font-bold text-emerald-600 hover:underline"
                                    >
                                        ✓ Ок
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
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
                                    {client['DOT-код'] ? ` · DOT: ${client['DOT-код']}` : ''}
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
                                    Ранее хранившиеся комплекты клиента (1 клик для предзаполнения):
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
                                                        {ord['DOT-код'] ? ` · DOT: ${ord['DOT-код']}` : ''}
                                                    </p>
                                                </div>

                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
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

                        {/* Configuration Mode Switcher: 4 Uniform vs 2 Old + 2 New vs Staggered */}
                        <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/30 border border-gray-200/80 dark:border-gray-700/80 space-y-3">
                            
                            {/* Season & Discs Header Row */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-200/60 dark:border-gray-700/60">
                                {/* Season */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase text-gray-400">Сезон:</span>
                                    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setSeason('Лето')}
                                            className={`px-3 py-1 font-bold transition-colors ${
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
                                            className={`px-3 py-1 font-bold transition-colors ${
                                                season === 'Зима'
                                                    ? 'bg-sky-600 text-white'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            ❄️ Зима
                                        </button>
                                    </div>
                                </div>

                                {/* Discs */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase text-gray-400">Диски:</span>
                                    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setHasRims('Да')}
                                            className={`px-2.5 py-1 font-bold transition-colors ${
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
                                            className={`px-2.5 py-1 font-bold transition-colors ${
                                                hasRims === 'Нет'
                                                    ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            Без дисков
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 3 Configuration Modes Segmented Bar */}
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                                    Вариант комплектации принимаемых шин:
                                </span>
                                <div className="grid grid-cols-3 p-1 rounded-xl bg-gray-200/80 dark:bg-gray-800/80 text-xs font-semibold gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setConfigMode('standard')}
                                        className={`py-1.5 px-1.5 rounded-lg transition-all text-center text-[11px] sm:text-xs truncate ${
                                            configMode === 'standard'
                                                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs font-bold'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        4 одинаковых
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConfigMode('split2plus2');
                                            const effBrand = oldPairBrand || brand;
                                            const effModel = oldPairModel || model;
                                            const effSize = oldPairSize || tireSize;
                                            const effDot = oldPairDot || dotCode || wheelDots[0] || '';

                                            setOldPairBrand(effBrand);
                                            setOldPairModel(effModel);
                                            setOldPairSize(effSize);
                                            if (!oldPairDot && effDot) {
                                                const tokens = effDot.split(/[/,;+\s]+/).map(s => s.trim().replace(/^DOT\s*[:.-]?\s*/i, '')).filter(Boolean);
                                                setOldPairDot(tokens[0] || effDot);
                                            }

                                            // Prefill new pair with same values so operator does not re-type!
                                            if (!newPairBrand) setNewPairBrand(effBrand);
                                            if (!newPairModel) setNewPairModel(effModel);
                                            if (!newPairSize) setNewPairSize(effSize);
                                        }}
                                        className={`py-1.5 px-1.5 rounded-lg transition-all text-center text-[11px] sm:text-xs truncate ${
                                            configMode === 'split2plus2'
                                                ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-2xs font-bold'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        2 старых + 2 новых 🆕
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConfigMode('staggered');
                                            if (!frontSize) setFrontSize(tireSize);
                                            if (!frontBrand) setFrontBrand(brand);
                                            if (!frontModel) setFrontModel(model);
                                        }}
                                        className={`py-1.5 px-1.5 rounded-lg transition-all text-center text-[11px] sm:text-xs truncate ${
                                            configMode === 'staggered'
                                                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Разноширокие 🛞
                                    </button>
                                </div>
                            </div>

                            {/* --- MODE 1: STANDARD 4 UNIFORM TIRES --- */}
                            {configMode === 'standard' && (
                                <div className="space-y-3 pt-1">
                                    {/* Smart Brand & Model Selector with Autocomplete from TIRE_DATA */}
                                    <BrandModelSelector
                                        brand={brand}
                                        model={model}
                                        onBrandChange={setBrand}
                                        onModelChange={setModel}
                                    />

                                    {/* Tire Size & Count */}
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                                Размер шин:
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="225/50 R17"
                                                value={tireSize}
                                                onChange={e => setTireSize(e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2.5 font-mono font-bold text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                                                Количество:
                                            </label>
                                            <select
                                                value={tireCount}
                                                onChange={e => setTireCount(Number(e.target.value))}
                                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2 text-gray-900 dark:text-white font-bold"
                                            >
                                                <option value={4}>4 шт. (Комплект)</option>
                                                <option value={2}>2 шт. (Пара)</option>
                                                <option value={1}>1 шт.</option>
                                                <option value={5}>5 шт. (+ Запаска)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* DOT Management: Identical for all VS Individual (if 1 or more replaced) */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase text-gray-400">
                                                DOT-коды (Год/неделя выпуска):
                                            </span>

                                            <div className="flex items-center gap-2">
                                                {dotMode === 'identical' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDotMode('individual');
                                                            const base = dotCode.trim();
                                                            setWheelDots([base, base, base, '']);
                                                        }}
                                                        className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                                                    >
                                                        + Разные DOT / Замена 1 колеса 🆕
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDotMode('identical');
                                                            setDotCode(wheelDots[0] || '');
                                                        }}
                                                        className="text-[11px] font-semibold text-gray-500 hover:underline"
                                                    >
                                                        Одинаковый DOT для всех
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {dotMode === 'identical' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Например: 2422 (все одинаковые)"
                                                    value={dotCode}
                                                    onChange={e => setDotCode(e.target.value)}
                                                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs py-1.5 px-2.5 font-mono text-gray-900 dark:text-white"
                                                />
                                                <span className="text-[11px] text-gray-400 shrink-0">
                                                    Один код на весь комплект
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {Array.from({ length: tireCount }).map((_, idx) => (
                                                        <div key={idx}>
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <span className="text-[10px] font-bold text-gray-400">
                                                                    Колесо #{idx + 1}
                                                                </span>
                                                                {idx === 3 && (
                                                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                        (Новое?)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder={idx === 3 ? "1226" : "2422"}
                                                                value={wheelDots[idx] || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    setWheelDots(prev => {
                                                                        const copy = [...prev];
                                                                        copy[idx] = val;
                                                                        return copy;
                                                                    });
                                                                }}
                                                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs py-1.5 px-2 font-mono font-bold text-gray-900 dark:text-white"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex items-center justify-between pt-1 text-[11px] text-gray-400">
                                                    <span>Укажите свежий DOT для заменённого колеса</span>
                                                    <button
                                                        type="button"
                                                        onClick={copyWheel1ToAll}
                                                        className="text-primary-600 dark:text-primary-400 hover:underline"
                                                    >
                                                        Скопировать DOT #1 во все
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* --- MODE 2: SPLIT 2+2 (2 OLD FROM ARCHIVE + 2 NEW REPLACED TIRES) --- */}
                            {configMode === 'split2plus2' && (
                                <div className="space-y-3 pt-1">
                                    <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300">
                                        💡 <b>Режим 2+2</b>: 2 шины берутся из истории хранения (выберите по DOT), а для 2 новых параметры уже продублированы, чтобы не вводить их повторно.
                                    </div>

                                    {/* Axle Distribution Quick Switch */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-xs">
                                        <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                                            Распределение по осям авто:
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOldPairAxle('Задняя ось (ЗЛ + ЗП)');
                                                    setNewPairAxle('Передняя ось (ПЛ + ПП)');
                                                }}
                                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                                                    newPairAxle.includes('Передняя')
                                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                                                }`}
                                            >
                                                🚗 Новые спереди, старые сзади
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOldPairAxle('Передняя ось (ПЛ + ПП)');
                                                    setNewPairAxle('Задняя ось (ЗЛ + ЗП)');
                                                }}
                                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                                                    newPairAxle.includes('Задняя')
                                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                                                }`}
                                            >
                                                🚗 Новые сзади, старые спереди
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pair 1: Old Stored Tires (2 pcs) */}
                                    <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                <span>Пара #1: 2 старых колеса ({oldPairAxle || 'из истории'})</span>
                                            </span>
                                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded">
                                                Хранились ранее
                                            </span>
                                        </div>

                                        {/* Quick Historical DOT Selector */}
                                        {historicalDotOptions.length > 0 && (
                                            <div className="p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase text-blue-800 dark:text-blue-300">
                                                        🎯 Выбрать оставшуюся пару по DOT из истории:
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                        Кликните нужный DOT
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {historicalDotOptions.map(opt => (
                                                        <button
                                                            key={opt.dot}
                                                            type="button"
                                                            onClick={() => setOldPairDot(opt.dot)}
                                                            className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                                                                oldPairDot === opt.dot
                                                                    ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-400/50'
                                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:border-blue-400'
                                                            }`}
                                                        >
                                                            {oldPairDot === opt.dot && <CheckIcon className="w-3.5 h-3.5" />}
                                                            <span>DOT {opt.dot}</span>
                                                            {opt.count > 1 && (
                                                                <span className={`text-[10px] px-1 rounded ${
                                                                    oldPairDot === opt.dot ? 'bg-blue-700 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                                }`}>
                                                                    {opt.count} шт.
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <BrandModelSelector
                                            brand={oldPairBrand}
                                            model={oldPairModel}
                                            onBrandChange={(b) => {
                                                setOldPairBrand(b);
                                                if (newPairMatchesOld) setNewPairBrand(b);
                                            }}
                                            onModelChange={(m) => {
                                                setOldPairModel(m);
                                                if (newPairMatchesOld) setNewPairModel(m);
                                            }}
                                            labelBrand="Марка старых шин:"
                                            labelModel="Модель старых шин:"
                                        />

                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Размер шин:</label>
                                                <input
                                                    type="text"
                                                    placeholder="205/55 R16"
                                                    value={oldPairSize}
                                                    onChange={e => {
                                                        const s = e.target.value;
                                                        setOldPairSize(s);
                                                        if (newPairMatchesOld) setNewPairSize(s);
                                                    }}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs py-1.5 px-2 font-mono font-bold text-gray-900 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">DOT старых шин:</label>
                                                <input
                                                    type="text"
                                                    placeholder="2420"
                                                    value={oldPairDot}
                                                    onChange={e => setOldPairDot(e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs py-1.5 px-2 font-mono font-bold text-gray-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pair 2: New Purchased Tires (2 pcs) */}
                                    <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/60 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span>Пара #2: 2 новых колеса ({newPairAxle || 'свежекупленные'})</span>
                                            </span>
                                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                                                🆕 Новые шины
                                            </span>
                                        </div>

                                        {/* Smart match indicator or independent selection */}
                                        {newPairMatchesOld ? (
                                            <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                                        <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                        <span>Та же марка и модель, что и у старых:</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewPairMatchesOld(false)}
                                                        className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                                                    >
                                                        ✏️ Другая модель
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                                                    <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                                        {oldPairBrand || brand || 'Марка'} {oldPairModel || model || 'Модель'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/50 font-mono text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700 text-xs">
                                                        {oldPairSize || tireSize || 'Размер'}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase text-gray-400">
                                                        Параметры новых шин:
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNewPairBrand(oldPairBrand || brand);
                                                            setNewPairModel(oldPairModel || model);
                                                            setNewPairSize(oldPairSize || tireSize);
                                                            setNewPairMatchesOld(true);
                                                        }}
                                                        className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                                                    >
                                                        📋 Сделать как у старых
                                                    </button>
                                                </div>

                                                <BrandModelSelector
                                                    brand={newPairBrand}
                                                    model={newPairModel}
                                                    onBrandChange={setNewPairBrand}
                                                    onModelChange={setNewPairModel}
                                                    labelBrand="Марка новых шин:"
                                                    labelModel="Модель новых шин:"
                                                />

                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Размер шин:</label>
                                                    <input
                                                        type="text"
                                                        placeholder={oldPairSize || "205/55 R16"}
                                                        value={newPairSize}
                                                        onChange={e => setNewPairSize(e.target.value)}
                                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2 font-mono font-bold text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">
                                                    DOT новых шин (Год/неделя):
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-gray-400 font-semibold">Год:</span>
                                                    {['2026', '2025', '2024'].map(yr => {
                                                        const short = yr.slice(-2);
                                                        return (
                                                            <button
                                                                key={yr}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!newPairDot || newPairDot.length < 2) {
                                                                        setNewPairDot(`01${short}`);
                                                                    } else {
                                                                        setNewPairDot(prev => prev.slice(0, 2) + short);
                                                                    }
                                                                }}
                                                                className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-emerald-500"
                                                            >
                                                                ..{short}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="например: 1226 (свежий год)"
                                                value={newPairDot}
                                                onChange={e => setNewPairDot(e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs py-1.5 px-2.5 font-mono font-bold text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- MODE 3: STAGGERED (РАЗНОШИРОКИЕ) AXLES --- */}
                            {configMode === 'staggered' && (
                                <div className="space-y-3 pt-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                                            Разбивка по осям (Перед / Зад):
                                        </span>
                                        <span className="text-[10px] text-gray-400">По 2 колеса на каждую ось</span>
                                    </div>

                                    {/* Front Axle */}
                                    <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                            <span>Передняя ось (2 шт.)</span>
                                        </span>

                                        <BrandModelSelector
                                            brand={frontBrand}
                                            model={frontModel}
                                            onBrandChange={setFrontBrand}
                                            onModelChange={setFrontModel}
                                            labelBrand="Марка передних:"
                                            labelModel="Модель передних:"
                                        />

                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Размер передних:</label>
                                                <input
                                                    type="text"
                                                    placeholder="245/45 R19"
                                                    value={frontSize}
                                                    onChange={e => setFrontSize(e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs py-1.5 px-2 font-mono font-bold text-gray-900 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">DOT передних:</label>
                                                <input
                                                    type="text"
                                                    placeholder="2422"
                                                    value={frontDot}
                                                    onChange={e => setFrontDot(e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs py-1.5 px-2 font-mono text-gray-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rear Axle */}
                                    <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                            <span>Задняя ось (2 шт.)</span>
                                        </span>

                                        <BrandModelSelector
                                            brand={rearBrand}
                                            model={rearModel}
                                            onBrandChange={setRearBrand}
                                            onModelChange={setRearModel}
                                            labelBrand="Марка задних:"
                                            labelModel="Модель задних:"
                                        />

                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Размер задних:</label>
                                                <input
                                                    type="text"
                                                    placeholder="275/40 R19"
                                                    value={rearSize}
                                                    onChange={e => setRearSize(e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs py-1.5 px-2 font-mono font-bold text-gray-900 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">DOT задних:</label>
                                                <input
                                                    type="text"
                                                    placeholder="2422"
                                                    value={rearDot}
                                                    onChange={e => setRearDot(e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs py-1.5 px-2 font-mono text-gray-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* STEP 3: DEFECTS, PATCHES & INSPECTION (CRITICAL REQUEST POINT) */}
                    <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                                <span>🔍 Дефекты и состояние после сезона эксплуатации:</span>
                            </span>
                            <span className="text-[10px] text-gray-500 italic">Латки, жгуты, новые колеса</span>
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
