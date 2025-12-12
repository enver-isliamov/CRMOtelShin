
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Client, Settings, TireGroup, PRICE_BY_DIAMETER, DEFAULT_PRICE, parseDate } from '../types';
import { api } from '../services/api';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { MultiTireInput } from './ui/MultiTireInput';
import { ImageUpload } from './ui/ImageUpload';

// --- ICONS ---
const UserIcon: React.FC<{className?: string}> = ({ className="h-6 w-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;
const TireIcon: React.FC<{className?: string}> = ({ className="h-6 w-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 9.068l.44-2.396M11.25 9.068l-3.41 1.936m3.41-1.936l1.936 3.41M11.25 9.068a4.5 4.5 0 013.182-.968h.063a4.5 4.5 0 013.478 5.432l-1.29 7.234a.75.75 0 01-1.42-.25l-1.29-7.234a2.25 2.25 0 00-2.208-1.956H9.413a2.25 2.25 0 00-2.208 1.956l-1.29 7.234a.75.75 0 01-1.42-.25l-1.29-7.234a4.5 4.5 0 016.12 6.132h.063a4.5 4.5 0 013.182.968z" /></svg>;
const CreditCardIcon: React.FC<{className?: string}> = ({ className="h-6 w-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 21z" /></svg>;
const ArrowLeftIcon: React.FC<{className?: string}> = ({ className="w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>;
const CheckIcon: React.FC<{className?: string}> = ({ className="h-6 w-6" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
const SpinnerIcon: React.FC<{className?: string}> = ({ className="h-6 w-6" }) => <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;

const CheckboxPill: React.FC<{name: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; label: React.ReactNode}> = ({ name, checked, onChange, label }) => (
    <label className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800/60 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-gray-700 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20 transition-all duration-200">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
    </label>
);

const STORAGE_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const formatDate = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localIsoDate = new Date(date.getTime() - tzOffset);
    return localIsoDate.toISOString().split('T')[0];
}

const generateContractNumber = () => {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

const calculateAllFields = (baseData: Partial<Client>, tireGroups: TireGroup[], draftGroup: TireGroup | null): Partial<Client> => {
    const nextState = { ...baseData };

    // 1. Calculate dates (if Start date or Duration changes, which are in baseData)
    if (nextState['Начало'] && nextState['Срок']) {
        const startDate = new Date(nextState['Начало']);
        const storageMonths = Number(nextState['Срок']);
        
        if (!isNaN(startDate.getTime()) && storageMonths > 0) {
            const endDate = new Date(startDate);
            endDate.setMonth(startDate.getMonth() + storageMonths);
            nextState['Окончание'] = formatDate(endDate);
            
            const reminderDate = new Date(endDate);
            reminderDate.setDate(endDate.getDate() - 7);
            nextState['Напомнить'] = formatDate(reminderDate);
        }
    }
    
    // 2. Calculate Prices from Groups
    let calcGroups = [...tireGroups];
    if (draftGroup && draftGroup.diameter) {
        const existingIdx = calcGroups.findIndex(g => g.id === draftGroup.id);
        if (existingIdx > -1) {
            calcGroups[existingIdx] = draftGroup;
        } else {
            calcGroups.push(draftGroup);
        }
    }

    const storageMonths = Number(nextState['Срок']) || 0;
    
    let totalMonthlyPrice = 0;
    let totalTireCount = 0;
    let anyRims = false;
    let combinedDot = '';

    if (calcGroups.length > 0) {
        calcGroups.forEach(group => {
            totalTireCount += group.count;
            if (group.hasRims === 'Да') anyRims = true;
            
            const pricePerSet = PRICE_BY_DIAMETER[group.diameter] || DEFAULT_PRICE;
            const pricePerTire = pricePerSet / 4;
            
            let groupCost = pricePerTire * group.count;

            if (group.hasRims === 'Да') {
                groupCost += (100 / 4) * group.count;
            }
            
            totalMonthlyPrice += groupCost;

            if (group.dot) {
                combinedDot += `${group.brand} R${group.diameter}: ${group.dot}\n`;
            }
        });
    } else {
         if (!draftGroup?.diameter) {
             // Fallback default if no groups
             totalTireCount = 4;
             totalMonthlyPrice = DEFAULT_PRICE; 
         }
    }
    
    nextState['Кол-во шин'] = totalTireCount;
    nextState['Цена за месяц'] = totalMonthlyPrice;
    nextState['Наличие дисков'] = anyRims ? 'Да' : 'Нет';
    if (combinedDot) nextState['DOT-код'] = combinedDot.trim();

    // 3. Total Amount Calculation
    let totalAmount = totalMonthlyPrice * storageMonths;

    if (nextState['Услуга: Мойка']) totalAmount += 200;
    if (nextState['Услуга: Упаковка']) totalAmount += 350;
    
    nextState['Общая сумма'] = totalAmount;

    if (!nextState['Договор']) {
        nextState['Договор'] = generateContractNumber();
    }

    return nextState;
};

// Helper to deserialize existing client data into groups
const parseGroupsFromClient = (client?: Partial<Client>): TireGroup[] => {
    if (!client) return [];
    
    // 1. Try Metadata (Structured JSON) - Most reliable
    if (client.metadata) {
        try {
            const parsed = JSON.parse(client.metadata);
            if (parsed.groups && Array.isArray(parsed.groups)) {
                return parsed.groups;
            }
        } catch (e) {
            console.warn("Failed to parse metadata JSON", e);
        }
    }

    // 2. Try QR JSON - Fallback
    const qrData = client['Заказ - QR'] || '';
    const jsonMatch = qrData.match(/\|\|JSON:(.*)$/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.groups && Array.isArray(parsed.groups)) {
                return parsed.groups;
            }
        } catch (e) {
            console.warn("Failed to parse legacy JSON groups", e);
        }
    }

    // 3. Smart String Parsing (For "2x 275/40R21 \n 2x ...")
    const sizeString = client['Размер шин'] || '';
    if (!sizeString) return [];

    const sizeLines = sizeString.split('\n').map(s => s.trim()).filter(Boolean);
    const brandLines = (client['Бренд_Модель'] || '').split('\n').map(s => s.trim()).filter(Boolean);
    
    // Attempt to map each line to a TireGroup
    return sizeLines.map((line, index) => {
        let count = 4; // Default
        
        // Check for "2x " prefix
        const countMatch = line.match(/^(\d+)x/i);
        if (countMatch) {
            count = parseInt(countMatch[1], 10);
        } else if (sizeLines.length > 1) {
            count = 2; // Heuristic: if multiple lines, likely 2 per line.
        }

        const sizeMatch = line.match(/(\d{3})\/?(\d{2})[R]?(\d{2})/i);
        const width = sizeMatch ? sizeMatch[1] : '';
        const profile = sizeMatch ? sizeMatch[2] : '';
        const diameter = sizeMatch ? sizeMatch[3] : '';

        // Try to match brand line-by-line, or use the first one for all
        let brandStr = brandLines[index] || brandLines[0] || '';
        let brand = 'Не указан';
        let model = '';
        
        if (brandStr) {
            const parts = brandStr.split(' ');
            brand = parts[0];
            model = parts.slice(1).join(' ');
        }

        return {
            id: `restored-${index}-${Date.now()}`,
            brand,
            model,
            width,
            profile,
            diameter,
            count: count,
            season: client['Сезон'] || 'Лето',
            hasRims: client['Наличие дисков'] || 'Нет',
            pricePerMonth: Number(client['Цена за месяц']) || DEFAULT_PRICE, 
            dot: '' 
        };
    });
};

const getInitialState = (mode: 'create' | 'edit' | 'reorder', sourceClient?: Client): Partial<Client> => {
    const currentMonth = new Date().getMonth(); 
    const defaultSeason = (currentMonth >= 10 || currentMonth <= 1) ? 'Лето' : 'Зима';
    // Generate a truly unique ID to avoid collision issues in React Key or List finding
    const uniqueId = `c${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const defaultOrderState: Partial<Client> = {
        'Склад хранения': 'AYU-46', 'Ячейка': '', 'Источник трафика': '', 'Заказ - QR': '', 'Бренд_Модель': '',
        'Кол-во шин': 4, 'Наличие дисков': 'Нет', 
        'Сезон': defaultSeason,
        'Срок': 6, 'Цена за месяц': DEFAULT_PRICE, 'Начало': formatDate(new Date()),
        'Статус сделки': 'На складе', 'Размер шин': '', 'Долг': 0,
        'DOT-код': '',
        'Услуга: Вывоз': false, 'Услуга: Мойка': false, 'Услуга: Упаковка': false,
        'photoUrls': [],
        'id': uniqueId,
        'metadata': '',
        'Договор': generateContractNumber()
    };
    
    if (mode === 'edit' && sourceClient) {
        // Prepare dates for HTML input type="date" (YYYY-MM-DD)
        const safeFormat = (dateVal: any) => {
            const parsed = parseDate(dateVal);
            return parsed ? formatDate(parsed) : '';
        };
        
        const rawPhone = String(sourceClient['Телефон'] || '');
        const phone = rawPhone.startsWith('+7') ? rawPhone.substring(2) : rawPhone;

        return {
            ...sourceClient,
            'Телефон': phone,
            'Начало': safeFormat(sourceClient['Начало']),
            'Окончание': safeFormat(sourceClient['Окончание']),
            'Напомнить': safeFormat(sourceClient['Напомнить']),
        };
    }

    if (mode === 'reorder' && sourceClient) {
        const rawPhone = String(sourceClient['Телефон'] || '');
        const phone = rawPhone.startsWith('+7') 
            ? rawPhone.substring(2) 
            : rawPhone;

        return {
            ...defaultOrderState, 
            'Имя клиента': sourceClient['Имя клиента'],
            'Телефон': phone,
            'Адрес клиента': sourceClient['Адрес клиента'],
            'Chat ID': sourceClient['Chat ID'],
            'Номер Авто': sourceClient['Номер Авто'],
            'Источник трафика': sourceClient['Источник трафика'],
            'Склад хранения': sourceClient['Склад хранения'] || defaultOrderState['Склад хранения']
        };
    }
    
    return {
        ...defaultOrderState,
        'Имя клиента': '', 'Телефон': '', 'Адрес клиента': '', 'Chat ID': '', 'Номер Авто': '',
    };
};

// --- Smart Duration Selector ---
const SmartDurationSelector: React.FC<{
    value: number;
    onChange: (val: number) => void;
    minimal?: boolean;
}> = ({ value, onChange, minimal = false }) => {
    const [isActive, setIsActive] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsActive(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative flex flex-col items-center group w-full" ref={wrapperRef}>
            {!minimal && <span className="text-[10px] uppercase text-gray-400 font-medium tracking-wider mb-1 select-none">Срок</span>}
            <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-full text-center font-medium transition-all duration-200 ${minimal ? 'text-lg text-gray-900 dark:text-white' : 'text-2xl sm:text-3xl font-black tracking-tight leading-none border-b-2 pb-1'} ${
                    isActive 
                    ? minimal ? '' : 'text-primary-600 border-primary-500 scale-110' 
                    : minimal ? '' : 'text-gray-800 dark:text-gray-100 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
                {value}<span className={`text-gray-500 ${minimal ? 'text-sm font-normal ml-1' : 'text-sm font-normal ml-1'}`}>мес</span>
            </button>
            
            {isActive && (
                <div className={`
                    fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90vw] max-w-[320px] 
                    sm:absolute sm:top-full sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-0 sm:mt-2 sm:z-50 sm:w-[320px]
                    bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 
                    animate-in fade-in zoom-in-95 duration-100
                `}>
                    <div className="grid grid-cols-4 gap-2 no-scrollbar">
                        {STORAGE_MONTHS.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => { onChange(opt); setIsActive(false); }}
                                className={`py-3 rounded-lg text-lg font-bold transition-colors ${
                                    value === opt
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


export const AddClient: React.FC<{ settings: Settings, onClientAdd: () => void }> = ({ settings, onClientAdd }) => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Determine Mode
    const clientToEdit = location.state?.clientToEdit as Client | undefined;
    const clientToReorder = location.state?.clientToReorder as Client | undefined;
    
    const mode: 'create' | 'edit' | 'reorder' = clientToEdit ? 'edit' : clientToReorder ? 'reorder' : 'create';
    const sourceClient = clientToEdit || clientToReorder;

    // State
    const [tireGroups, setTireGroups] = useState<TireGroup[]>([]);
    const [draftGroup, setDraftGroup] = useState<TireGroup | null>(null);
    
    const [formData, setFormData] = useState<Partial<Client>>(() => {
        return getInitialState(mode, sourceClient);
    });
    
    const [isInitialized, setIsInitialized] = useState(false);
    const justLoadedRef = useRef(false);

    // CRITICAL FIX: Reset form when switching between clients (e.g. creating new order for A then B)
    useEffect(() => {
        setFormData(getInitialState(mode, sourceClient));
        setTireGroups([]);
        setDraftGroup(null);
        setIsInitialized(false);
        justLoadedRef.current = false;
    }, [mode, sourceClient?.id]);

    useEffect(() => {
        // If we are editing or reordering, we try to restore tire groups from the source client
        if (sourceClient && tireGroups.length === 0 && !isInitialized) {
            const extractedGroups = parseGroupsFromClient(sourceClient);
            if (extractedGroups.length > 0) {
                setTireGroups(extractedGroups);
                
                if (mode === 'edit') {
                    // In edit mode, we want to respect the DB values initially, 
                    // so we flag to skip the next recalculation effect
                    justLoadedRef.current = true;
                } else {
                    // For reorder, we want to recalc immediately based on the restored tires + new defaults
                    setFormData(prev => calculateAllFields(prev, extractedGroups, null));
                }
            }
            
            // Restore description note if present in metadata
            if (sourceClient.metadata) {
                try {
                    const parsed = JSON.parse(sourceClient.metadata);
                    if (parsed.note) setDescription(parsed.note);
                } catch(e) {}
            }
            setIsInitialized(true);
        }
    }, [sourceClient, mode, isInitialized]);

    // Recalculate fields whenever tire groups change
    useEffect(() => {
        // Skip recalculation if we just loaded the data in Edit mode (preserving existing DB values)
        if (justLoadedRef.current) {
            justLoadedRef.current = false;
            return;
        }

        setFormData(prev => calculateAllFields(prev, tireGroups, draftGroup));
    }, [tireGroups, draftGroup, formData['Срок'], formData['Начало'], formData['Услуга: Мойка'], formData['Услуга: Упаковка']]);

    const [description, setDescription] = useState('');
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Оформление...');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    // Handlers
    const handleChange = useCallback((updates: Partial<Client>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    }, []);

    const handleGroupsChange = useCallback((newGroups: TireGroup[]) => {
        setTireGroups(newGroups);
    }, []);
    
    const handleDraftChange = useCallback((newDraft: TireGroup | null) => {
        setDraftGroup(newDraft);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const { checked } = isCheckbox ? (e.target as HTMLInputElement) : { checked: false };
        handleChange({ [name]: isCheckbox ? checked : value });
    };

    const handleCarNumberChange = (value: string) => {
        const formattedValue = value.toUpperCase().replace(/[^А-ЯA-Z0-9]/g, '');
        handleChange({ 'Номер Авто': formattedValue });
    };

    const handleCancel = () => {
        if (mode === 'edit' && sourceClient) {
            // If editing, go back to that client's details
            navigate(`/clients/${sourceClient.id}`);
        } else {
            // If creating new or reordering (new order), go back to list
            navigate('/clients');
        }
    };
    
    const formatManagerMessage = (client: Partial<Client>): string => {
        const startDate = client['Начало'] ? new Date(client['Начало']).toLocaleDateString('ru-RU') : '-';
        const endDate = client['Окончание'] ? new Date(client['Окончание']).toLocaleDateString('ru-RU') : '-';
        const formatCurrency = (val: number | undefined) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(val || 0);
        
        let tiresDetails = '';
        if (tireGroups.length > 0) {
            tiresDetails = tireGroups.map((g, i) => {
                const rimText = g.hasRims === 'Да' ? 'Есть' : 'Нет';
                const dotText = g.dot ? `\nDOT: ${g.dot}` : '';
                return `<b>📦 Группа ${i + 1}:</b>
${g.count}шт • ${g.brand} ${g.model}
Размер: <b>${g.width}/${g.profile} R${g.diameter}</b>
Сезон: ${g.season} | Диски: ${rimText}${dotText}`;
            }).join('\n\n');
        } else {
            tiresDetails = (client['Заказ - QR'] || '').split('||JSON:')[0];
        }

        const services = [];
        if (client['Услуга: Вывоз']) services.push('🚚 Вывоз');
        if (client['Услуга: Мойка']) services.push('🚿 Мойка');
        if (client['Услуга: Упаковка']) services.push('🧧 Упаковка');
        const servicesLine = services.length > 0 ? `\n<b>Доп. услуги:</b> ${services.join(', ')}` : '';

        const title = mode === 'edit' ? '✏️ ИЗМЕНЕНИЕ ЗАКАЗА' : '✅✅✅ НОВЫЙ ЗАКАЗ ✅✅✅';

        return `
<b>${title}</b>
${mode === 'reorder' ? '<i>(повторный заказ клиента)</i>\n' : ''}
👤 <b>${client['Имя клиента']}</b>
📞 <code>${client['Телефон']}</code>
🚗 ${client['Номер Авто']}
${client['Адрес клиента'] ? `📍 ${client['Адрес клиента']}` : ''}

- - - - - <b>ШИНЫ И ДИСКИ</b> - - - - -
<blockquote>${tiresDetails}
${servicesLine}</blockquote>
- - - - - - - - - - - - - -
🏭 <b>Склад:</b> ${client['Склад хранения']} ${client['Ячейка'] ? `/ ${client['Ячейка']}` : ''}
🗓 <b>Хранение:</b> ${client['Срок']} мес.
(${startDate} ➝ ${endDate})
- - - - - - - - - - - - - -
💰 <b>Итого:</b> ${formatCurrency(client['Общая сумма'])}
(Тариф: ${formatCurrency(client['Цена за месяц'])}/мес)
${Number(client['Долг']) > 0 ? `❗️ <b>Долг:</b> ${formatCurrency(client['Долг'])}` : ''}
- - - - - - - - - - - - - -
📑 <b>Договор:</b> ${client['Договор']}

<i>Приём и хранение осуществляется на условиях публичной оферты otelshin.ru/dogovor</i>
`.trim().replace(/^\s+/gm, '');
    };
    
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (tireGroups.length === 0) {
             setToast({ message: `Добавьте хотя бы одну группу шин в заказ!`, type: 'error' });
             return;
        }

        setIsLoading(true);
        setToast(null);

        let dataForSubmission = { ...formData };
        if (!dataForSubmission.id) {
             // Fallback ID generation if not set
             dataForSubmission.id = `c${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        }
        
        let phone = String(dataForSubmission['Телефон'] || '').trim();
        if (phone && !phone.startsWith('+7')) {
            dataForSubmission['Телефон'] = '+7' + phone;
        }
        
        const brands = Array.from(new Set(tireGroups.map(g => {
            const b = g.brand === 'Не указан' ? '' : g.brand;
            return `${b} ${g.model}`.trim();
        }))).filter(Boolean);
        dataForSubmission['Бренд_Модель'] = brands.join('\n');

        const sizes = tireGroups.map(g => `${g.count}x ${g.width}/${g.profile}R${g.diameter}`);
        dataForSubmission['Размер шин'] = sizes.join('\n');

        const readableDesc = tireGroups.map(g => {
            const brandStr = g.brand === 'Не указан' ? '' : g.brand;
            return `${g.count}x ${brandStr} ${g.model} ${g.width}/${g.profile}R${g.diameter}`.replace(/\s+/g, ' ').trim();
        }).join('\n');
        
        let fullReadable = readableDesc;
        if (description) fullReadable += `\n>> ${description}`;

        dataForSubmission['Заказ - QR'] = fullReadable;

        const jsonPayload = JSON.stringify({ groups: tireGroups, note: description });
        dataForSubmission.metadata = jsonPayload;

        if (!dataForSubmission['DOT-код']) {
             dataForSubmission['DOT-код'] = tireGroups.map(g => g.dot).filter(Boolean).join(' / ');
        }
        
        try {
            const uploadedUrls: string[] = [];
            if (filesToUpload.length > 0) {
                for (const [index, file] of filesToUpload.entries()) {
                    setLoadingMessage(`Загрузка фото ${index + 1}/${filesToUpload.length}...`);
                    const { fileUrl } = await api.uploadFile(file, dataForSubmission);
                    uploadedUrls.push(fileUrl);
                }
            }

            const existingUrls = sourceClient?.photoUrls || [];
            const finalClientData = { 
                ...dataForSubmission,
                photoUrls: [...new Set([...existingUrls, ...uploadedUrls])]
            };

            let processedClient: Client;
            
            if (mode === 'edit') {
                setLoadingMessage('Обновление данных...');
                processedClient = await api.updateClient(finalClientData as Client);
                setToast({ message: 'Данные клиента обновлены!', type: 'success' });
            } else if (mode === 'reorder' && sourceClient) {
                setLoadingMessage('Архивация и создание заказа...');
                processedClient = await api.reorderClient(sourceClient.id, finalClientData);
                setToast({ message: 'Новый заказ успешно создан!', type: 'success' });
            } else {
                setLoadingMessage('Создание клиента...');
                processedClient = await api.addClient(finalClientData);
                setToast({ message: 'Клиент успешно добавлен!', type: 'success' });
            }

            setLoadingMessage('Готово!');
            
            onClientAdd(); 

            if (mode !== 'edit' || (mode === 'edit' && window.confirm("Отправить уведомление менеджерам об изменениях?"))) {
                const allRecipientIds = [
                    ...(settings.adminIds?.split(',').map(id => id.trim()).filter(Boolean) || []),
                    ...(settings.managerIds?.split(',').map(id => id.trim()).filter(Boolean) || [])
                ];
                const uniqueIds = [...new Set(allRecipientIds)];

                if (uniqueIds.length > 0) {
                    const message = formatManagerMessage(finalClientData);
                    Promise.all(uniqueIds.map(id => api.sendMessage(id, message))).catch(console.error);
                }
            }
            
            setTimeout(() => {
                if (mode === 'edit') {
                    navigate(`/clients/${dataForSubmission.id}`, { replace: true });
                } else {
                    navigate('/clients', { replace: true });
                }
            }, 800);

        } catch (error: any) {
            setToast({ message: `Ошибка: ${error.message}`, type: 'error' });
            setIsLoading(false);
        }
    };
    
    const pageTitle = formData['Имя клиента'] || 'Новый Клиент';
    
    const modeDescription = mode === 'edit' 
        ? 'Редактирование профиля' 
        : mode === 'reorder' 
            ? 'Создание нового заказа' 
            : 'Добавление нового клиента';

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-950">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Sticky Header with Back Button (Similar to ClientDetailsPage) */}
            <div className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                    <button onClick={handleCancel} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                        <ArrowLeftIcon />
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-lg font-bold leading-tight text-gray-900 dark:text-white truncate">
                            {pageTitle}
                        </h1>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {modeDescription}
                        </div>
                    </div>
                </div>
                
                <button
                    onClick={() => handleSubmit()}
                    disabled={isLoading}
                    className={`p-2 rounded-full transition-colors ${
                        isLoading 
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' 
                        : 'bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50'
                    }`}
                    title="Сохранить"
                >
                    {isLoading ? <SpinnerIcon className="w-6 h-6" /> : <CheckIcon className="w-6 h-6" />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto pb-6">
                    
                    <Card title="Контактные данные" actions={<UserIcon className="text-gray-400"/>}>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="ФИО" name="Имя клиента" value={formData['Имя клиента']} onChange={handleInputChange} placeholder="Фамилия Имя Отчество" required />
                                <Input 
                                    label="Телефон" 
                                    name="Телефон" 
                                    value={formData['Телефон']} 
                                    onChange={handleInputChange} 
                                    prefix="+7"
                                    placeholder="(999) 123-45-67" 
                                    type="tel"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Номер Авто" name="Номер Авто" value={formData['Номер Авто']} onChange={(e) => handleCarNumberChange(e.target.value)} placeholder="A123BC777" />
                                <Input label="Chat ID" name="Chat ID" value={formData['Chat ID']} onChange={handleInputChange} placeholder="123456789" />
                            </div>

                            <div className="w-full">
                            <Input label="Адрес" name="Адрес клиента" value={formData['Адрес клиента']} onChange={handleInputChange} placeholder="Улица, № дома, квартира" helperText="Для услуги 'Вывоз шин'" />
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-end">
                                <Input label="Источник трафика" name="Источник трафика" value={formData['Источник трафика']} onChange={handleInputChange} placeholder="Авито, Сайт..." />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Договор №</label>
                                    <div className="flex items-center h-[46px] px-3 rounded-md bg-gray-100 dark:bg-gray-700/50">
                                        <span className="font-mono text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">{formData['Договор']}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card title="Шины и Услуги" actions={<TireIcon className="text-gray-400"/>}>
                        <div className="space-y-6">
                            
                            <MultiTireInput 
                                groups={tireGroups}
                                onGroupsChange={handleGroupsChange}
                                onDraftChange={handleDraftChange}
                            />
                            
                            <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Описание и дефекты (общее)</label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="Без латок, с шипами, без порезов и т.д."
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-150"
                                />
                            </div>
                            
                            <ImageUpload onFilesChange={setFilesToUpload} />

                            <div>
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Дополнительные услуги</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <CheckboxPill name="Услуга: Вывоз" checked={!!formData['Услуга: Вывоз']} onChange={handleInputChange} label={<>Вывоз шин <span className="text-green-600 font-bold">БЕСПЛАТНО</span></>} />
                                    <CheckboxPill name="Услуга: Мойка" checked={!!formData['Услуга: Мойка']} onChange={handleInputChange} label={<>Мойка колёс <span className="font-bold">200₽</span></>} />
                                    <CheckboxPill name="Услуга: Упаковка" checked={!!formData['Услуга: Упаковка']} onChange={handleInputChange} label={<>Упаковка в пакеты <span className="font-bold">350₽</span></>} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card title="Финансы" actions={<CreditCardIcon className="text-gray-400"/>}>
                        <div className="space-y-6">
                            <div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Дата начала" name="Начало" type="date" value={formData['Начало']} onChange={handleInputChange} />
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Срок хранения</label>
                                        <div className="relative h-[46px] flex items-center justify-start px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm transition-all hover:border-primary-500">
                                            <SmartDurationSelector 
                                                value={Number(formData['Срок'])} 
                                                onChange={(val) => handleChange({ 'Срок': val })} 
                                                minimal={true}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <Input label="Дата окончания" name="Окончание" type="date" value={formData['Окончание']} readOnly className="bg-gray-100 dark:bg-gray-700/50"/>
                                    <Input label="Дата напоминания" name="Напомнить" type="date" value={formData['Напомнить']} readOnly className="bg-gray-100 dark:bg-gray-700/50"/>
                                </div>
                            </div>
                            
                            <hr className="dark:border-gray-700" />

                            <div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Склад хранения" name="Склад хранения" value={formData['Склад хранения']} onChange={handleInputChange} placeholder="AYU-46" />
                                    <Input label="Ячейка" name="Ячейка" value={formData['Ячейка']} onChange={handleInputChange} placeholder="E-43" helperText="назначается на складе"/>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Статус сделки</label>
                                    <select name="Статус сделки" value={formData['Статус сделки']} onChange={handleInputChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                                        <option>На складе</option>
                                        <option>Без оплаты</option>
                                        <option>Частичная оплата</option>
                                        <option>Оплачено</option>
                                        <option>Завершено</option>
                                    </select>
                                </div>
                            </div>

                            <hr className="dark:border-gray-700" />

                            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg space-y-3 border border-gray-200 dark:border-gray-700">
                                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200">Расчет стоимости</h4>

                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <div className="flex justify-between">
                                        <span>Хранение ({formData['Срок']} мес.)</span>
                                        <span>
                                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                                                (Number(formData['Цена за месяц']) || 0) * (Number(formData['Срок']) || 0)
                                            )}
                                        </span>
                                    </div>
                                    {formData['Услуга: Вывоз'] && (
                                        <div className="flex justify-between">
                                            <span>Вывоз шин</span>
                                            <span className="font-bold text-green-600 dark:text-green-400">0 ₽</span>
                                        </div>
                                    )}
                                    {formData['Наличие дисков'] === 'Да' && (
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>(Включена наценка за диски)</span>
                                        </div>
                                    )}
                                    {formData['Услуга: Мойка'] && (
                                        <div className="flex justify-between">
                                            <span>Мойка колёс</span>
                                            <span>+ 200 ₽</span>
                                        </div>
                                    )}
                                    {formData['Услуга: Упаковка'] && (
                                        <div className="flex justify-between">
                                            <span>Упаковка в пакеты</span>
                                            <span>+ 350 ₽</span>
                                        </div>
                                    )}
                                </div>

                                <hr className="dark:border-gray-600" />
                            
                                <div className="flex justify-between items-center text-lg">
                                <span className="font-bold text-gray-800 dark:text-gray-100">Итого к оплате:</span>
                                <span className="font-bold text-primary-600 dark:text-primary-300 text-2xl">
                                    {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(formData['Общая сумма'] || 0)}
                                </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <Input 
                                        label="Цена за месяц, ₽" 
                                        name="Цена за месяц" 
                                        type="number" 
                                        inputMode="numeric" 
                                        value={formData['Цена за месяц']} 
                                        onChange={handleInputChange}
                                        className="!bg-green-50/50 dark:!bg-green-900/20 !border-green-300 dark:!border-green-800 focus:!ring-green-500 text-green-800 dark:text-green-200 font-semibold"
                                        helperText="Авторасчет (можно править)"
                                    />
                                    <Input 
                                        label="Долг, ₽" 
                                        name="Долг" 
                                        type="number" 
                                        inputMode="numeric" 
                                        value={formData['Долг']} 
                                        onChange={handleInputChange}
                                        className="!bg-red-50/50 dark:!bg-red-900/20 !border-red-300 dark:!border-red-800 focus:!ring-red-500 text-red-800 dark:text-red-200 font-semibold"
                                    />
                                </div>
                        </div>
                        </div>
                    </Card>
                </form>
            </div>
        </div>
    );
};
