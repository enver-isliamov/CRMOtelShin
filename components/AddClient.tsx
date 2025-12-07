
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Client, Settings, TireGroup, PRICE_BY_DIAMETER, DEFAULT_PRICE } from '../types';
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
    return `${year}${month}${day}-${hours}${minutes}`;
}

const calculateAllFields = (baseData: Partial<Client>, tireGroups: TireGroup[], draftGroup: TireGroup | null, updates: Partial<Client> = {}): Partial<Client> => {
    const nextState = { ...baseData, ...updates };

    // 1. Calculate dates
    if ('Начало' in updates || 'Срок' in updates || !nextState['Окончание']) {
        const startDate = new Date(nextState['Начало']!);
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
    
    // 2. Calculate Prices
    // We combine saved groups + the current draft group (if it has a valid diameter)
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

    // 4. Status Logic
    const debt = Number(nextState['Долг'] || 0);
    const total = Number(nextState['Общая сумма'] || 0);

    if (debt > 0) {
        if (debt >= total) {
             nextState['Статус сделки'] = 'Без оплаты';
        } else {
             nextState['Статус сделки'] = 'Частичная оплата';
        }
    } else {
        if (nextState['Статус сделки'] === 'Без оплаты' || nextState['Статус сделки'] === 'Частичная оплата') {
             nextState['Статус сделки'] = 'Оплачено';
        }
    }

    return nextState;
};

// Helper to deserialize existing client data into groups
const parseGroupsFromClient = (client?: Partial<Client>): TireGroup[] => {
    if (!client) return [];
    
    // Check if we have JSON in 'Заказ - QR'
    const qrData = client['Заказ - QR'] || '';
    const jsonMatch = qrData.match(/\|\|JSON:(.*)$/);
    
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.groups && Array.isArray(parsed.groups)) {
                return parsed.groups;
            }
        } catch (e) {
            console.warn("Failed to parse groups JSON", e);
        }
    }

    // Fallback for legacy
    const sizeStr = client['Размер шин'] || '';
    const diaMatch = sizeStr.match(/R(\d+)/i);
    const diameter = diaMatch ? diaMatch[1] : '16'; 
    
    const sizeFullMatch = sizeStr.match(/(\d+)\/?(\d*)/);
    const width = sizeFullMatch ? sizeFullMatch[1] : '';
    const profile = sizeFullMatch ? sizeFullMatch[2] : '';

    const brandStr = client['Бренд_Модель'] || '';
    const brandParts = brandStr.split(' ');
    
    return [{
        id: 'legacy-group',
        brand: brandParts[0] || 'Unknown',
        model: brandParts.slice(1).join(' ') || '',
        width,
        profile,
        diameter,
        count: Number(client['Кол-во шин']) || 4,
        season: client['Сезон'] || 'Лето',
        hasRims: client['Наличие дисков'] || 'Нет',
        pricePerMonth: Number(client['Цена за месяц']) || DEFAULT_PRICE,
        dot: client['DOT-код'] || ''
    }];
};

const getInitialState = (reorderClient?: Client): Partial<Client> => {
    const currentMonth = new Date().getMonth(); 
    const defaultSeason = (currentMonth >= 10 || currentMonth <= 1) ? 'Лето' : 'Зима';

    const defaultOrderState: Partial<Client> = {
        'Склад хранения': 'AYU-46', 'Ячейка': '', 'Источник трафика': '', 'Заказ - QR': '', 'Бренд_Модель': '',
        'Кол-во шин': 4, 'Наличие дисков': 'Нет', 
        'Сезон': defaultSeason,
        'Срок': 6, 'Цена за месяц': DEFAULT_PRICE, 'Начало': formatDate(new Date()),
        'Статус сделки': 'На складе', 'Размер шин': '', 'Долг': 0,
        'DOT-код': '',
        'Услуга: Вывоз': false, 'Услуга: Мойка': false, 'Услуга: Упаковка': false,
        'photoUrls': [],
        'id': `c${Date.now()}` 
    };
    
    let initialState: Partial<Client>;

    if (reorderClient) {
        const phone = reorderClient['Телефон']?.startsWith('+7') 
            ? reorderClient['Телефон'].substring(2) 
            : reorderClient['Телефон'];

        initialState = {
            ...defaultOrderState, 
            'Имя клиента': reorderClient['Имя клиента'],
            'Телефон': phone,
            'Адрес клиента': reorderClient['Адрес клиента'],
            'Chat ID': reorderClient['Chat ID'],
            'Номер Авто': reorderClient['Номер Авто'],
            'Источник трафика': reorderClient['Источник трафика'],
            'Склад хранения': reorderClient['Склад хранения'] || defaultOrderState['Склад хранения']
        };
    } else {
        initialState = {
            ...defaultOrderState,
            'Имя клиента': '', 'Телефон': '', 'Адрес клиента': '', 'Chat ID': '', 'Номер Авто': '',
        };
    }
    
    return initialState;
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
    const originalClient = location.state?.clientToReorder as Client | undefined;
    
    // State
    const [tireGroups, setTireGroups] = useState<TireGroup[]>([]);
    const [draftGroup, setDraftGroup] = useState<TireGroup | null>(null); // State for real-time calculation
    
    const [formData, setFormData] = useState<Partial<Client>>(() => {
        const init = getInitialState(originalClient);
        return init;
    });
    
    // Initialize groups if reordering
    useEffect(() => {
        if (originalClient && tireGroups.length === 0) {
            const extractedGroups = parseGroupsFromClient(originalClient);
            if (extractedGroups.length > 0) {
                setTireGroups(extractedGroups);
                setFormData(prev => calculateAllFields(prev, extractedGroups, null));
            }
        }
    }, [originalClient]);

    const [description, setDescription] = useState('');
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Оформление...');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    const handleChange = (updates: Partial<Client>) => {
        setFormData(currentData => calculateAllFields(currentData, tireGroups, draftGroup, updates));
    };

    const handleGroupsChange = (newGroups: TireGroup[]) => {
        setTireGroups(newGroups);
        // Force recalculation when groups change
        setFormData(currentData => calculateAllFields(currentData, newGroups, draftGroup));
    };
    
    const handleDraftChange = (newDraft: TireGroup | null) => {
        setDraftGroup(newDraft);
        setFormData(currentData => calculateAllFields(currentData, tireGroups, newDraft));
    }

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
    
    const formatManagerMessage = (client: Partial<Client>): string => {
        const startDate = client['Начало'] ? new Date(client['Начало']).toLocaleDateString('ru-RU') : '-';
        const endDate = client['Окончание'] ? new Date(client['Окончание']).toLocaleDateString('ru-RU') : '-';
        
        const formatCurrency = (val: number | undefined) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(val || 0);
        
        // Build detailed tire groups message
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
            // Fallback for flat structure or if empty
            tiresDetails = (client['Заказ - QR'] || '').split('||JSON:')[0];
        }

        const services = [];
        if (client['Услуга: Вывоз']) services.push('🚚 Вывоз');
        if (client['Услуга: Мойка']) services.push('🚿 Мойка');
        if (client['Услуга: Упаковка']) services.push('🧧 Упаковка');
        const servicesLine = services.length > 0 ? `\n<b>Доп. услуги:</b> ${services.join(', ')}` : '';

        return `
✅✅✅ <b>НОВЫЙ ЗАКАЗ</b> ✅✅✅
${originalClient ? '<i>(для существующего клиента)</i>\n' : ''}
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
`.trim().replace(/^\s+/gm, '');
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (tireGroups.length === 0) {
             setToast({ message: `Добавьте хотя бы одну группу шин в заказ!`, type: 'error' });
             return;
        }

        setIsLoading(true);
        setToast(null);

        // Prepare the base data object
        let dataForSubmission = { ...formData };
        if (!dataForSubmission.id) dataForSubmission.id = `c${Date.now()}`;
        
        if (dataForSubmission['Телефон'] && !dataForSubmission['Телефон'].startsWith('+7')) {
            dataForSubmission['Телефон'] = '+7' + dataForSubmission['Телефон'];
        }
        
        // SERIALIZE GROUPS INTO FLATTENED FIELDS
        
        // 1. Brand_Model: Combine unique brands/models
        const brands = Array.from(new Set(tireGroups.map(g => `${g.brand} ${g.model}`.trim())));
        dataForSubmission['Бренд_Модель'] = brands.join(' // ');

        // 2. Size: Combine dimensions
        const sizes = tireGroups.map(g => `${g.count}x ${g.width}/${g.profile}R${g.diameter}`);
        dataForSubmission['Размер шин'] = sizes.join(' // ');

        // 3. QR / Description field: Readable summary + Hidden JSON
        const readableDesc = tireGroups.map(g => `${g.count}x ${g.brand} ${g.model} ${g.width}/${g.profile}R${g.diameter}`).join(' // ');
        
        let fullReadable = readableDesc;
        if (description) fullReadable += ` >> ${description}`;

        const jsonPayload = JSON.stringify({ groups: tireGroups, note: description });
        dataForSubmission['Заказ - QR'] = `${fullReadable}||JSON:${jsonPayload}`;

        // Ensure DOT is synced
        if (!dataForSubmission['DOT-код']) {
             dataForSubmission['DOT-код'] = tireGroups.map(g => g.dot).filter(Boolean).join(' / ');
        }
        
        try {
            // Step 1: Upload photos
            const uploadedUrls: string[] = [];
            if (filesToUpload.length > 0) {
                for (const [index, file] of filesToUpload.entries()) {
                    setLoadingMessage(`Загрузка фото ${index + 1}/${filesToUpload.length}...`);
                    const { fileUrl } = await api.uploadFile(file, dataForSubmission);
                    uploadedUrls.push(fileUrl);
                }
            }

            const existingUrls = originalClient?.photoUrls || [];
            const finalClientData = { 
                ...dataForSubmission,
                photoUrls: [...new Set([...existingUrls, ...uploadedUrls])]
            };

            // Step 3: API call
            let processedClient: Client;
            if (originalClient && originalClient.id) {
                setLoadingMessage('Архивация и обновление...');
                processedClient = await api.reorderClient(originalClient.id, finalClientData);
            } else {
                setLoadingMessage('Создание клиента...');
                processedClient = await api.addClient(finalClientData);
            }

            // Step 4: Notifications
            setLoadingMessage('Отправка уведомлений...');
            const allRecipientIds = [
                ...(settings.adminIds?.split(',').map(id => id.trim()).filter(Boolean) || []),
                ...(settings.managerIds?.split(',').map(id => id.trim()).filter(Boolean) || [])
            ];
            const uniqueIds = [...new Set(allRecipientIds)];

            if (uniqueIds.length > 0) {
                const message = formatManagerMessage(finalClientData);
                await Promise.all(uniqueIds.map(id => api.sendMessage(id, message)));
            }
            
            setToast({ message: 'Клиент успешно добавлен!', type: 'success' });
            await onClientAdd();
            setTimeout(() => navigate('/clients', { replace: true }), 1500);

        } catch (error: any) {
            setToast({ message: `Ошибка: ${error.message}`, type: 'error' });
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
                
                <Card title={originalClient ? `Новый заказ для: ${originalClient['Имя клиента']}` : "Клиент и Автомобиль"} actions={<UserIcon className="text-gray-400"/>}>
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
                                <select name="Статус сделки" value={formData['Статус сделки']} onChange={handleInputChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white">
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

                <div className="flex justify-end">
                    <Button type="submit" size="lg" disabled={isLoading} className="w-full sm:w-auto">
                        {isLoading ? loadingMessage : originalClient ? 'Оформить новый заказ' : 'Оформить и уведомить'}
                    </Button>
                </div>
            </form>
        </div>
    );
};
