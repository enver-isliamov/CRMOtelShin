
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Client, Settings } from '../types';
import { api } from '../services/api';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { SmartTireInput } from './ui/SmartTireInput';
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

const TIRE_PRESETS = [
    { size: 'R12', price: 500 },
    { size: 'R13', price: 500 },
    { size: 'R14', price: 500 },
    { size: 'R15', price: 500 },
    { size: 'R16', price: 600 },
    { size: 'R17', price: 600 },
    { size: 'R18', price: 600 },
    { size: 'R19', price: 600 },
    { size: 'R20', price: 700 },
    { size: 'R21', price: 700 },
    { size: 'R22', price: 800 },
    { size: 'R22,5', price: 800 },
    { size: 'R23', price: 800 },
];

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

const calculateAllFields = (baseData: Partial<Client>, updates: Partial<Client> = {}): Partial<Client> => {
    const nextState = { ...baseData, ...updates };

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
    
    const pricePerMonth = Number(nextState['Цена за месяц']) || 0;
    const tireCount = Number(nextState['Кол-во шин']) || 4;
    const storageMonths = Number(nextState['Срок']) || 0;
    
    const pricePerTirePerMonth = pricePerMonth / 4;
    const storagePrice = pricePerTirePerMonth * tireCount * storageMonths;

    let totalAmount = storagePrice;
    if (nextState['Наличие дисков'] === 'Да') totalAmount += 100;
    if (nextState['Услуга: Мойка']) totalAmount += 200;
    if (nextState['Услуга: Упаковка']) totalAmount += 350;
    nextState['Общая сумма'] = totalAmount;

    if (!nextState['Договор']) {
        nextState['Договор'] = generateContractNumber();
    }

    return nextState;
};

const getInitialState = (reorderClient?: Client): Partial<Client> => {
    // Logic for auto-detecting season
    const currentMonth = new Date().getMonth(); // 0-11
    // If Nov(10), Dec(11), Jan(0), Feb(1) -> People usually store Summer tires.
    // Otherwise -> People store Winter tires.
    const defaultSeason = (currentMonth >= 10 || currentMonth <= 1) ? 'Лето' : 'Зима';

    const defaultOrderState: Partial<Client> = {
        'Склад хранения': 'AYU-46', 'Ячейка': '', 'Источник трафика': '', 'Заказ - QR': '',
        'Кол-во шин': 4, 'Наличие дисков': 'Нет', 
        'Сезон': defaultSeason,
        'Срок': 6, 'Цена за месяц': TIRE_PRESETS[1].price, 'Начало': formatDate(new Date()),
        'Статус сделки': 'На складе', 'Размер шин': TIRE_PRESETS[1].size, 'Долг': 0,
        'DOT-код': '',
        'Услуга: Вывоз': false, 'Услуга: Мойка': false, 'Услуга: Упаковка': false,
        'photoUrls': [],
        'id': `c${Date.now()}` // Generate a new ID for the new order
    };
    
    let initialState: Partial<Client>;

    if (reorderClient) {
        initialState = {
            ...defaultOrderState, // Start with defaults for order-specific fields
            // Overwrite with client-specific fields from the old order
            'Имя клиента': reorderClient['Имя клиента'],
            'Телефон': reorderClient['Телефон'],
            'Адрес клиента': reorderClient['Адрес клиента'],
            'Chat ID': reorderClient['Chat ID'],
            'Номер Авто': reorderClient['Номер Авто'],
            'Источник трафика': reorderClient['Источник трафика'],
        };
    } else {
        initialState = {
            ...defaultOrderState,
            'Имя клиента': '', 'Телефон': '+7', 'Адрес клиента': '', 'Chat ID': '', 'Номер Авто': '',
        };
    }
    
    // Always calculate derived fields like dates, totals, and contract number
    return calculateAllFields(initialState);
};

// --- Advanced DOT Input Component ---
interface AdvancedDotInputProps {
    value: string;
    onChange: (val: string) => void;
    tireCount: number;
}

const AdvancedDotInput: React.FC<AdvancedDotInputProps> = ({ value, onChange, tireCount }) => {
    const [mode, setMode] = useState<'single' | 'multi'>('single');
    const [singleDot, setSingleDot] = useState('');
    const [multiDots, setMultiDots] = useState<{dot: string, note: string}[]>([]);

    // Parse incoming string to state
    useEffect(() => {
        if (!value) {
            setMode('single');
            setSingleDot('');
            setMultiDots(Array(tireCount).fill({ dot: '', note: '' }));
            return;
        }

        // Check if value looks like multi-line format (#1: ...)
        const isMulti = value.includes('\n') || value.startsWith('#');
        
        if (isMulti) {
            setMode('multi');
            const lines = value.split('\n');
            const parsed = Array(tireCount).fill(null).map((_, i) => {
                // Try to find a line starting with #{i+1}:
                const line = lines.find(l => l.trim().startsWith(`#${i + 1}:`));
                if (line) {
                    // Extract DOT and Note from "#1: 4221 (Defect)"
                    const content = line.substring(line.indexOf(':') + 1).trim();
                    const noteMatch = content.match(/\((.*?)\)$/);
                    const note = noteMatch ? noteMatch[1] : '';
                    const dot = noteMatch ? content.replace(/\s*\(.*?\)$/, '') : content;
                    return { dot, note };
                }
                return { dot: '', note: '' };
            });
            setMultiDots(parsed);
        } else {
            setMode('single');
            setSingleDot(value);
            // Pre-fill multi state just in case user switches
            setMultiDots(Array(tireCount).fill({ dot: value, note: '' }));
        }
    }, [value, tireCount]);

    // Handle updates and sync back to parent string
    const updateParent = (currentMode: 'single' | 'multi', sDot: string, mDots: typeof multiDots) => {
        if (currentMode === 'single') {
            onChange(sDot);
        } else {
            // Build multi-line string
            // Format:
            // #1: 4221
            // #2: 4121 (Грыжа)
            const lines = mDots.map((item, index) => {
                if (!item.dot && !item.note) return null;
                let line = `#${index + 1}: ${item.dot || '?'}`;
                if (item.note) line += ` (${item.note})`;
                return line;
            }).filter(Boolean);
            
            if (lines.length === 0) onChange('');
            else onChange(lines.join('\n'));
        }
    };

    const handleSingleChange = (val: string) => {
        setSingleDot(val);
        setMultiDots(mDots => mDots.map(d => ({ ...d, dot: val })));
        updateParent('single', val, multiDots);
    };

    const handleMultiChange = (index: number, field: 'dot' | 'note', val: string) => {
        const newDots = [...multiDots];
        // Ensure array size matches tireCount (in case tireCount increased dynamically)
        while(newDots.length <= index) newDots.push({dot: '', note: ''});
        
        newDots[index] = { ...newDots[index], [field]: val };
        setMultiDots(newDots);
        updateParent('multi', singleDot, newDots);
    };

    const toggleMode = (newMode: 'single' | 'multi') => {
        setMode(newMode);
        updateParent(newMode, singleDot, multiDots);
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">DOT-код</label>
                <div className="flex bg-gray-100 dark:bg-gray-700/50 rounded-lg p-0.5">
                    <button
                        type="button"
                        onClick={() => toggleMode('single')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'single' ? 'bg-white dark:bg-gray-600 shadow text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                    >
                        Один
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleMode('multi')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'multi' ? 'bg-white dark:bg-gray-600 shadow text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                    >
                        Разные / Дефекты
                    </button>
                </div>
            </div>

            {mode === 'single' ? (
                <Input 
                    value={singleDot} 
                    onChange={e => handleSingleChange(e.target.value)} 
                    placeholder="Например, 4521" 
                    helperText="4 цифры (неделя и год)"
                />
            ) : (
                <div className="grid grid-cols-1 gap-2 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    {Array.from({ length: tireCount }).map((_, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <span className="text-xs font-bold text-gray-400 w-6 text-right">#{idx + 1}</span>
                            <input 
                                type="text"
                                className="flex-1 min-w-0 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400"
                                placeholder="DOT (4521)"
                                value={multiDots[idx]?.dot || ''}
                                onChange={(e) => handleMultiChange(idx, 'dot', e.target.value)}
                            />
                            <input 
                                type="text"
                                className="flex-[1.5] min-w-0 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400"
                                placeholder="Дефект (латка...)"
                                value={multiDots[idx]?.note || ''}
                                onChange={(e) => handleMultiChange(idx, 'note', e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


export const AddClient: React.FC<{ settings: Settings, onClientAdd: () => void }> = ({ settings, onClientAdd }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const originalClient = location.state?.clientToReorder as Client | undefined;
    
    const [formData, setFormData] = useState<Partial<Client>>(() => getInitialState(originalClient));
    const [description, setDescription] = useState('');
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Оформление...');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    const handleChange = (updates: Partial<Client>) => {
        setFormData(currentData => calculateAllFields(currentData, updates));
    };

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
    
    const handlePresetClick = (preset: { size: string; price: number }) => {
        handleChange({
            'Размер шин': preset.size,
            'Цена за месяц': preset.price
        });
    };
    
    const formatManagerMessage = (client: Partial<Client>): string => {
        const services = [];
        if (client['Услуга: Вывоз']) services.push('Вывоз шин');
        if (client['Услуга: Мойка']) services.push('Мойка колёс');
        if (client['Услуга: Упаковка']) services.push('Упаковка в пакеты');
        const servicesLine = services.length > 0 ? `<b>Доп. услуги:</b> ${services.join(', ')}` : '';

        const startDate = client['Начало'] ? new Date(client['Начало']).toLocaleDateString('ru-RU') : '-';
        const endDate = client['Окончание'] ? new Date(client['Окончание']).toLocaleDateString('ru-RU') : '-';
        
        const formatCurrency = (val: number | undefined) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(val || 0);

        return `
✅✅✅ <b>НОВЫЙ ЗАКАЗ</b> ✅✅✅
${originalClient ? '<i>(для существующего клиента)</i>\n' : ''}
<b>Имя:</b> ${client['Имя клиента']}
<b>Телефон:</b> <code>${client['Телефон']}</code>
<b>Авто:</b> ${client['Номер Авто']}
<b>Адрес:</b> ${client['Адрес клиента'] || 'Не указан'}

- - - - - <b>ДЕТАЛИ ЗАКАЗА</b> - - - - -
<blockquote><i>⭕️ ${client['Заказ - QR'] || ''}</i>
Кол-во шин: ${client['Кол-во шин']} шт.
Сезон: ${client['Сезон']}
Диски: ${client['Наличие дисков']}
${servicesLine}</blockquote>
- - - - - - - - - - - - - -
📦 <b>Склад:</b> ${client['Склад хранения']} / ${client['Ячейка']}
⚡️ <b>Хранение:</b> ${client['Срок']} мес. (${startDate} » ${endDate})
- - - - - - - - - - - - - -
💳 <b>Сумма:</b> ${formatCurrency(client['Общая сумма'])} [${client['Цена за месяц']} ₽/мес.]
🧧 <b>Долг:</b> ${formatCurrency(client['Долг'])}
- - - - - - - - - - - - - -
🌐 <b>Источник:</b> ${client['Источник трафика']}
📑 <b>Договор:</b> ${client['Договор']}
`.trim().replace(/^\s+/gm, '');
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setToast(null);

        // Prepare the base data object
        let dataForSubmission = { ...formData };
        if (!dataForSubmission.id) dataForSubmission.id = `c${Date.now()}`;
        
        const qrBase = dataForSubmission['Заказ - QR'] || '';
        dataForSubmission['Заказ - QR'] = description ? `${qrBase} >> ${description}` : qrBase;
        
        try {
            // Step 1: Upload photos and get URLs
            const uploadedUrls: string[] = [];
            if (filesToUpload.length > 0) {
                for (const [index, file] of filesToUpload.entries()) {
                    setLoadingMessage(`Загрузка фото ${index + 1}/${filesToUpload.length}...`);
                    // Pass only essential client data for folder naming
                    const { fileUrl } = await api.uploadFile(file, dataForSubmission);
                    uploadedUrls.push(fileUrl);
                }
            }

            // Step 2: Create final data object with photo URLs
            const existingUrls = originalClient?.photoUrls || [];
            const finalClientData = { 
                ...dataForSubmission,
                // Combine previous and new photos, ensuring no duplicates.
                photoUrls: [...new Set([...existingUrls, ...uploadedUrls])]
            };

            // Step 3: Make a single atomic API call to create/update the client
            let processedClient: Client;
            if (originalClient && originalClient.id) {
                setLoadingMessage('Архивация и обновление...');
                processedClient = await api.reorderClient(originalClient.id, finalClientData);
            } else {
                setLoadingMessage('Создание клиента...');
                processedClient = await api.addClient(finalClientData);
            }

            // Step 4: Send notifications
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
            
            // Step 5: Finalize
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
                        {/* ФИО и Телефон */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="ФИО" name="Имя клиента" value={formData['Имя клиента']} onChange={handleInputChange} placeholder="Фамилия Имя Отчество" required />
                            <Input label="Телефон" name="Телефон" value={formData['Телефон']} onChange={handleInputChange} placeholder="+7 (999) 123-45-67" type="tel"/>
                        </div>

                        {/* Номер Авто и Chat ID (2 колонки всегда) */}
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Номер Авто" name="Номер Авто" value={formData['Номер Авто']} onChange={(e) => handleCarNumberChange(e.target.value)} placeholder="A123BC777" />
                            <Input label="Chat ID" name="Chat ID" value={formData['Chat ID']} onChange={handleInputChange} placeholder="123456789" />
                        </div>

                        <div className="w-full">
                           <Input label="Адрес" name="Адрес клиента" value={formData['Адрес клиента']} onChange={handleInputChange} placeholder="Улица, № дома, квартира" helperText="Для услуги 'Вывоз шин'" />
                        </div>

                        {/* Трафик и Договор (2 колонки всегда) */}
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
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Размер / Цена</label>
                            <div className="grid grid-cols-4 gap-2 sm:gap-3">
                                {TIRE_PRESETS.map(preset => (
                                    <button
                                        type="button"
                                        key={preset.size}
                                        onClick={() => handlePresetClick(preset)}
                                        className={`p-2 sm:p-3 rounded-lg border-2 text-center transition-all duration-200 flex flex-col items-center justify-center ${formData['Размер шин'] === preset.size 
                                            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 shadow-md' 
                                            : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-primary-400'
                                        }`}
                                    >
                                        <div className="font-bold text-gray-800 dark:text-gray-100 text-xs sm:text-base">{preset.size}</div>
                                        <div className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400 leading-tight">
                                            {preset.price}₽<span className="hidden sm:inline">/мес</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                         </div>
                        
                        <SmartTireInput 
                            label="Бренд / Марка / Размер шин" 
                            value={formData['Заказ - QR'] || ''} 
                            onChange={(val) => handleChange({ 'Заказ - QR': val })} 
                            season={formData['Сезон'] as 'Лето'|'Зима'}
                            onSeasonChange={(s) => handleChange({ 'Сезон': s })}
                            tireCount={Number(formData['Кол-во шин'] || 4)}
                            onTireCountChange={(c) => handleChange({ 'Кол-во шин': c })}
                            hasRims={formData['Наличие дисков'] as 'Да'|'Нет'}
                            onHasRimsChange={(r) => handleChange({ 'Наличие дисков': r })}
                        />
                        
                        {/* New Advanced DOT Input */}
                        <AdvancedDotInput 
                            value={formData['DOT-код'] || ''} 
                            onChange={(val) => handleChange({ 'DOT-код': val })} 
                            tireCount={Number(formData['Кол-во шин']) || 4} 
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
                                <Input label="Срок хранения, мес." name="Срок" type="number" inputMode="numeric" value={formData['Срок']} onChange={handleInputChange} />
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
                                            ((Number(formData['Цена за месяц']) || 0) / 4) * (Number(formData['Кол-во шин']) || 4) * (Number(formData['Срок']) || 0)
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
                                    <div className="flex justify-between">
                                        <span>Хранение дисков</span>
                                        <span>+ 100 ₽</span>
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
