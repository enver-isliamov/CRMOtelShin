import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Client, MessageTemplate, TireGroup, formatDateForDisplay, parseDate, Settings } from '../types';
import { api } from '../services/api';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { PhotoGallery } from './ui/PhotoGallery';
import { Lightbox } from './ui/Lightbox';
import { OrderHistory } from './ui/Timeline';
import { PaymentModal } from './ui/PaymentModal';

// --- CANONICAL ICONS ---
import { 
    ArrowLeftIcon, 
    EditIcon, 
    MessageIcon, 
    TrashIcon as DeleteIcon, 
    DocumentPlusIcon, 
    ReceiptIcon, 
    ShieldCheckIcon, 
    BanknotesIcon,
    TireIcon,
    DiscIcon,
    SunIcon,
    SnowflakeIcon,
    UserIcon,
    PhoneIcon,
    CalendarDaysIcon,
    CheckIcon
} from './icons/Icons';

// Helper to extract JSON tire groups
const getTireGroups = (client: Client): TireGroup[] => {
    let groups: TireGroup[] = [];
    if (client.metadata) {
        try {
            const parsed = JSON.parse(client.metadata);
            if (parsed.groups && Array.isArray(parsed.groups)) {
                groups = parsed.groups;
            }
        } catch(e) {}
    }
    if (groups.length === 0 && client['Заказ - QR']) {
        const jsonMatch = client['Заказ - QR'].match(/\|\|JSON:(.*)$/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.groups && Array.isArray(parsed.groups)) {
                    groups = parsed.groups;
                }
            } catch (e) {}
        }
    }
    return groups;
};

// Russian Car License Plate Badge (No awkward breaks)
const RussianCarPlateBadge: React.FC<{ plate?: string }> = ({ plate }) => {
    if (!plate || !plate.trim()) return null;
    const cleanPlate = plate.trim().toUpperCase();
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-black tracking-wider bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-900 dark:border-gray-400 shadow-2xs whitespace-nowrap shrink-0">
            <span className="mr-1.5">{cleanPlate}</span>
            <span className="border-l border-gray-900 dark:border-gray-400 pl-1 text-[9px] font-bold text-gray-500 dark:text-gray-400">
                RUS
            </span>
        </span>
    );
};

// Expiry Days Calculator and Badge
const getRemainingDaysInfo = (endDateString?: string) => {
    if (!endDateString) return null;
    const endDate = parseDate(endDateString);
    if (!endDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return { 
            text: `Просрочен ${Math.abs(diffDays)} дн.`, 
            isExpired: true, 
            badgeClass: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900' 
        };
    }
    if (diffDays === 0) {
        return { 
            text: 'Истекает сегодня!', 
            isExpired: false, 
            badgeClass: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 font-bold' 
        };
    }
    if (diffDays <= 7) {
        return { 
            text: `${diffDays} дн. осталось`, 
            isExpired: false, 
            badgeClass: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 font-bold' 
        };
    }
    return { 
        text: `${diffDays} дн. осталось`, 
        isExpired: false, 
        badgeClass: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900' 
    };
};

// Section Container with clean header
const SectionBlock: React.FC<{
    title: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
}> = ({ title, children, icon, badge }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200/90 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-gray-50/80 dark:bg-gray-900/40 px-3.5 sm:px-4 py-2.5 border-b border-gray-200/80 dark:border-gray-700/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
                {icon && <span className="text-gray-500 dark:text-gray-400 shrink-0">{icon}</span>}
                <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider truncate">{title}</h4>
            </div>
            {badge && <div className="shrink-0">{badge}</div>}
        </div>
        <div className="p-3.5 sm:p-4">
            {children}
        </div>
    </div>
);

// Segmented Navigation Tab Button
const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex-1 py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            active
                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
        }`}
    >
        {children}
    </button>
);

interface ClientDetailsPageProps {
    clients: Client[];
    headers: string[];
    templates: MessageTemplate[];
    refreshData: () => Promise<void>;
    settings: Settings;
}

export const ClientDetailsPage: React.FC<ClientDetailsPageProps> = ({ clients, templates, refreshData, settings }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [client, setClient] = useState<Client | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'photos'>('details');
    const [mode, setMode] = useState<'view' | 'message'>('view');
    const [messageTarget, setMessageTarget] = useState<'client' | 'admin'>('client');
    const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');
    const [preview, setPreview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedLightboxUrl, setSelectedLightboxUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const foundClient = clients.find(c => String(c.id) === String(id));
        if (foundClient) {
            setClient(foundClient);
        } else if (location.state?.client) {
            setClient(location.state.client);
        }
    }, [id, clients, location.state]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    // Template Logic
    useEffect(() => {
        if (mode === 'message' && templates.length > 0 && !selectedTemplateName && preview === '') {
            setSelectedTemplateName(templates[0]?.['Название шаблона'] || '');
        }
    }, [templates, selectedTemplateName, mode, preview]);

    useEffect(() => {
        if (selectedTemplateName && client) {
            const selectedTemplate = templates.find(t => t['Название шаблона'] === selectedTemplateName);
            if (selectedTemplate) {
                let content = selectedTemplate['Содержимое (HTML)'];
                Object.keys(client).forEach(key => {
                    let value = client[key as keyof Client];
                    if ((key === 'Начало' || key === 'Окончание' || key === 'Напомнить') && typeof value === 'string') {
                        if (value.includes('T')) value = value.split('T')[0];
                    }
                    if ((key === 'Общая сумма' || key === 'Долг' || key === 'Цена за месяц') && typeof value === 'number') {
                         value = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value);
                    }
                    content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
                });
                setPreview(content);
            }
        }
    }, [selectedTemplateName, templates, client]);

    const handleArchive = async () => {
        if (!client) return;
        if (window.confirm(`Вы уверены, что хотите завершить хранение и перевести заказ клиента "${client['Имя клиента']}" в архив?`)) {
            setIsSubmitting(true);
            try {
                await api.archiveClient(client.id);
                showToast('Заказ переведен в архив', 'success');
                await refreshData();
                navigate('/clients', { replace: true });
            } catch (e: any) {
                showToast(e.message, 'error');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handlePaymentSuccess = async (newDebt: number, _paidAmount: number, sendReceipt: boolean, receiptHtml?: string) => {
        if (client) {
            setClient(prev => prev ? ({ ...prev, 'Долг': newDebt }) : prev);
        }
        await refreshData();
        if (sendReceipt && receiptHtml) {
            setPreview(receiptHtml);
            setSelectedTemplateName('');
            setMessageTarget('client');
            setMode('message');
        }
    };

    const handleDelete = async () => {
        if (!client) return;
        if (window.confirm(`Вы уверены, что хотите удалить клиента "${client['Имя клиента']}"?`)) {
            setIsSubmitting(true);
            try {
                await api.deleteClient(client.id);
                showToast('Клиент удален', 'success');
                await refreshData();
                navigate('/clients', { replace: true });
            } catch (e: any) {
                showToast(e.message, 'error');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleSendMessage = async () => {
        if (preview && client) {
            setIsSubmitting(true);
            try {
                if (messageTarget === 'admin') {
                    const adminIds = settings.adminIds.split(',').map(id => id.trim()).filter(Boolean);
                    if (adminIds.length === 0) throw new Error("ID администраторов не настроены в настройках.");
                    
                    await Promise.all(adminIds.map(id => api.sendMessage(id, preview)));
                    showToast(`Отправлено администраторам (${adminIds.length})`, 'success');
                } else {
                    if (!client['Chat ID']) throw new Error("У клиента не указан Chat ID.");
                    const result = await api.sendMessage(client['Chat ID'] as string, preview);
                    showToast(result.message, result.success ? 'success' : 'error');
                }
                
                if (messageTarget === 'client') {
                    await refreshData();
                }
                setMode('view');
            } catch(e: any) {
                showToast(e.message, 'error');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleEditClient = () => {
        if (!client) return;
        navigate('/add-client', { state: { clientToEdit: client } });
    };

    const handleNewOrder = () => {
        if (!client) return;
        navigate('/add-client', { state: { clientToReorder: client } });
    };

    const handleAdminMessage = () => {
        if (!client) return;
        setSelectedTemplateName('');
        setMessageTarget('admin');
        setMode('message');
        setPreview('');
    };

    const handleClientMessage = () => {
        setMessageTarget('client');
        setMode('message');
        setPreview('');
    };

    const handleGenerateReceipt = () => {
        if (!client) return;
        const groups = getTireGroups(client);
        const formatCurrency = (val: number | undefined) => 
            new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(val || 0);
        
        let tiresText = '';
        if (groups.length > 0) {
            tiresText = groups.map((g, i) => `<b>📦 Комплект ${i + 1}:</b>\n${g.count}шт • ${g.brand} ${g.model}\nРазмер: <b>${g.width}/${g.profile} R${g.diameter}</b>\nСезон: ${g.season} | Диски: ${g.hasRims}${g.dot ? `\nDOT: <b>${g.dot}</b>` : ''}`).join('\n\n');
        } else {
            tiresText = (client['Заказ - QR'] || '').split('||JSON:')[0];
        }

        const receiptHtml = `
<b>📃 ДЕТАЛИ ЗАКАЗА (ДОГОВОР)</b>

👤 <b>Клиент:</b> ${client['Имя клиента']}
🚗 <b>Авто:</b> ${client['Номер Авто']}
📞 <b>Телефон:</b> ${client['Телефон']}

🔢 <b>Договор №:</b> <code>${client['Договор']}</code>
📅 <b>Срок хранения:</b> ${client['Срок']} мес.
(с ${formatDateForDisplay(client['Начало'])} по ${formatDateForDisplay(client['Окончание'])})

- - - - - - - - - - - - - -
${tiresText}
- - - - - - - - - - - - - -

💰 <b>Сумма заказа:</b> ${formatCurrency(client['Общая сумма'])}
(Тариф: ${formatCurrency(client['Цена за месяц'])}/мес)
${Number(client['Долг']) > 0 ? `❗️ <b>К оплате (Долг):</b> ${formatCurrency(client['Долг'])}` : ''}

📍 <b>Склад:</b> ${client['Склад хранения']}

<i>Приём и хранение осуществляется на условиях публичной оферты otelshin.ru/dogovor</i>
`.trim().replace(/\n/g, '<br/>');

        setPreview(receiptHtml);
        setSelectedTemplateName(''); 
        setMessageTarget('client');
        setMode('message');
    };

    if (clients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50 dark:bg-gray-950">
                <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3"></div>
                <p className="text-xs text-gray-500 font-medium">Загрузка данных...</p>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-50 dark:bg-gray-950">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-sm w-full">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Клиент не найден</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                        Возможно, карточка была удалена или перенесена в архив.
                    </p>
                    <Button onClick={() => navigate('/clients')} className="w-full justify-center">
                        Вернуться к списку
                    </Button>
                </div>
            </div>
        );
    }

    const rawPhotos = client?.photoUrls;
    const clientPhotos: string[] = Array.isArray(rawPhotos)
        ? rawPhotos.filter(Boolean)
        : (typeof (rawPhotos as unknown) === 'string' && (rawPhotos as unknown as string).trim().length > 0
            ? (rawPhotos as unknown as string).split(',').map(s => s.trim()).filter(Boolean)
            : []);
    const descClean = (client?.['Заказ - QR'] || '').split('||JSON:')[0]?.trim();
    const expiryInfo = getRemainingDaysInfo(client['Окончание']);
    const groups = getTireGroups(client);

    // Initials for avatar
    const initials = (client['Имя клиента'] || 'К')
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    // Deal Status Styling
    const status = client['Статус сделки'] || 'На складе';
    const statusStyles = {
        'На складе': 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        'Оплачено': 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        'Частичная оплата': 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        'Без оплаты': 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        'Завершено': 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    }[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';

    const hasDebt = Number(client['Долг'] || 0) > 0;

    return (
        <div className="flex flex-col h-full bg-gray-50/70 dark:bg-gray-950">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {selectedLightboxUrl && <Lightbox imageUrl={selectedLightboxUrl} onClose={() => setSelectedLightboxUrl(null)} />}
            
            {/* 1. STICKY TOP APP BAR (Compact & Mobile-Safe, No Text Overflows) */}
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-4 py-2.5 shadow-xs">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <button 
                            type="button"
                            onClick={() => navigate('/clients')} 
                            className="p-1.5 -ml-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shrink-0"
                            title="Назад к клиентам"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-nowrap">
                                <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate">
                                    {client['Имя клиента']}
                                </h1>
                                <RussianCarPlateBadge plate={client['Номер Авто']} />
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                <span className="font-mono">#{client['Договор']}</span>
                                <span>·</span>
                                <span>{client['Склад хранения'] || 'Основной'}</span>
                                {client['Ячейка'] && <span>(ячейка {client['Ячейка']})</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border whitespace-nowrap ${statusStyles}`}>
                            {status}
                        </span>
                    </div>
                </div>
            </header>

            {/* 2. SCROLLABLE CONTENT BODY */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-24 sm:pb-24">
                
                {/* Mode: Message Composer */}
                {mode === 'message' && (
                    <div className="max-w-2xl mx-auto space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-950 text-primary-600">
                                        <MessageIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                            {messageTarget === 'admin' ? 'Сообщение администраторам' : `Сообщение: ${client['Имя клиента']}`}
                                        </h3>
                                        <p className="text-[11px] text-gray-500">
                                            {messageTarget === 'admin' ? 'Администраторам системы' : `В Telegram: ${client['Chat ID'] || 'Без ID'}`}
                                        </p>
                                    </div>
                                </div>
                                {messageTarget === 'admin' && <ShieldCheckIcon className="w-5 h-5 text-blue-500"/>}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label htmlFor="template" className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                                        Шаблон:
                                    </label>
                                    <select 
                                        id="template" 
                                        value={selectedTemplateName} 
                                        onChange={e => setSelectedTemplateName(e.target.value)} 
                                        className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 py-2 px-2.5 text-xs dark:bg-gray-800 dark:text-white"
                                    >
                                        <option value="">-- Индивидуальное сообщение / Чек --</option>
                                        {templates.map(t => (
                                            <option key={t['Название шаблона']} value={t['Название шаблона']}>
                                                {t['Название шаблона']}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div 
                                        className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-900/60 dark:border-gray-700 min-h-[140px] max-h-[35vh] overflow-y-auto font-mono text-xs whitespace-pre-wrap outline-none text-gray-800 dark:text-gray-200" 
                                        contentEditable
                                        onInput={(e) => setPreview(e.currentTarget.innerText)} 
                                        dangerouslySetInnerHTML={{ __html: preview }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mode: View (Tabs) */}
                {mode === 'view' && (
                    <div className="max-w-4xl mx-auto space-y-3.5">
                        
                        {/* 2.1 MODERN COMPACT SEGMENTED TABS */}
                        <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl flex border border-gray-200 dark:border-gray-800">
                            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
                                <TireIcon className="w-3.5 h-3.5" />
                                <span>Данные и заказ</span>
                            </TabButton>
                            
                            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
                                <CalendarDaysIcon className="w-3.5 h-3.5" />
                                <span>История ({client['Срок'] || 0}м)</span>
                            </TabButton>
                            
                            <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')}>
                                <span>📸 Фото</span>
                                {clientPhotos.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold">
                                        {clientPhotos.length}
                                    </span>
                                )}
                            </TabButton>
                        </div>

                        {/* 2.2 DETAILS TAB: LOGICALLY SEPARATED BLOCKS */}
                        {activeTab === 'details' && (
                            <div className="space-y-3.5 animate-in fade-in duration-150">
                                
                                {/* BLOCK 1: ORDER & STORAGE OVERVIEW (Active Contract, Dates, Location, Finances) */}
                                <SectionBlock 
                                    title="Текущий заказ и хранение" 
                                    icon={<CalendarDaysIcon className="w-4 h-4 text-primary-600" />}
                                    badge={
                                        <span className="font-mono text-xs font-bold text-gray-500">
                                            #{client['Договор']}
                                        </span>
                                    }
                                >
                                    {/* Financial & Time Glance Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pb-3 border-b border-gray-100 dark:border-gray-700/70">
                                        
                                        {/* 1. Debt / Payment Status */}
                                        <div className="p-2.5 rounded-xl bg-gray-50/90 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Оплата / Долг</span>
                                            <p className={`text-base sm:text-lg font-black mt-0.5 whitespace-nowrap tabular-nums ${
                                                hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                            }`}>
                                                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(client['Долг'] || 0))}
                                            </p>
                                            <span className={`text-[10px] font-bold ${hasDebt ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {hasDebt ? 'Задолженность' : 'Оплачено 100%'}
                                            </span>
                                        </div>

                                        {/* 2. Total Sum & Monthly Rate */}
                                        <div className="p-2.5 rounded-xl bg-gray-50/90 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Сумма заказа</span>
                                            <p className="text-base sm:text-lg font-black mt-0.5 text-gray-900 dark:text-white whitespace-nowrap tabular-nums">
                                                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(client['Общая сумма'] || 0))}
                                            </p>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                {client['Цена за месяц'] || 0} ₽/мес
                                            </span>
                                        </div>

                                        {/* 3. Expiration Date & Countdown */}
                                        <div className="p-2.5 rounded-xl bg-gray-50/90 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Окончание</span>
                                            <p className="text-base sm:text-lg font-black mt-0.5 text-gray-900 dark:text-white whitespace-nowrap">
                                                {formatDateForDisplay(client['Окончание'])}
                                            </p>
                                            {expiryInfo ? (
                                                <span className={`text-[10px] font-bold ${expiryInfo.isExpired ? 'text-rose-500' : 'text-blue-500'} whitespace-nowrap`}>
                                                    {expiryInfo.text}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-gray-400">{client['Срок']} мес.</span>
                                            )}
                                        </div>

                                        {/* 4. Cell & Warehouse */}
                                        <div className="p-2.5 rounded-xl bg-gray-50/90 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Ячейка / Склад</span>
                                            <p className="text-base sm:text-lg font-mono font-black mt-0.5 text-gray-900 dark:text-white whitespace-nowrap truncate">
                                                {client['Ячейка'] ? `№ ${client['Ячейка']}` : '—'}
                                            </p>
                                            <span className="text-[10px] text-gray-400 truncate block">
                                                {client['Склад хранения'] || 'Основной'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Storage Dates Info Row */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2.5 text-xs text-gray-600 dark:text-gray-300">
                                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30">
                                            <span className="text-gray-400 text-[11px]">Начало:</span>
                                            <span className="font-bold whitespace-nowrap">{formatDateForDisplay(client['Начало'])}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30">
                                            <span className="text-gray-400 text-[11px]">Срок:</span>
                                            <span className="font-bold whitespace-nowrap">{client['Срок']} мес.</span>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 flex items-center justify-between p-1.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30">
                                            <span className="text-gray-400 text-[11px]">Напомнить:</span>
                                            <span className="font-bold whitespace-nowrap">{formatDateForDisplay(client['Напомнить'])}</span>
                                        </div>
                                    </div>
                                </SectionBlock>

                                {/* BLOCK 2: TIRES & EQUIPMENT (Model, Size, Season, Wheels, DOT, Extra Services) */}
                                <SectionBlock 
                                    title="Параметры шин и комплектация" 
                                    icon={<TireIcon className="w-4 h-4 text-indigo-600" />}
                                    badge={
                                        <div className="flex items-center gap-1.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${
                                                client['Сезон'] === 'Лето'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                    : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                            }`}>
                                                {client['Сезон'] === 'Лето' ? '☀️ Лето' : '❄️ Зима'}
                                            </span>

                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                <DiscIcon className="w-3 h-3 text-indigo-500" />
                                                <span>{client['Наличие дисков'] === 'Да' ? 'С дисками' : 'Без дисков'}</span>
                                            </span>
                                        </div>
                                    }
                                >
                                    <div className="space-y-3">
                                        {/* Main Tire Model & Size Highlight */}
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/90 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70 gap-2">
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">Марка и модель шин</span>
                                                <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate mt-0.5">
                                                    {client['Бренд_Модель'] || (groups.length > 0 ? `${groups[0].brand || ''} ${groups[0].model || ''}`.trim() : '') || 'Марка не указана'}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                    <span>{client['Кол-во шин'] || (groups.length > 0 ? groups.reduce((acc, g) => acc + (g.count || 0), 0) : 4)} шт.</span>
                                                    {client['DOT-код'] && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="font-mono">DOT: {client['DOT-код']}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <span className="px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black bg-primary-600 text-white shadow-2xs shrink-0 whitespace-nowrap">
                                                {client['Размер шин'] || (groups.length > 0 ? `${groups[0].width}/${groups[0].profile} R${groups[0].diameter}` : '') || 'Размер —'}
                                            </span>
                                        </div>

                                        {/* Multi-set Groups: displayed ONLY when there are multiple sets or staggered wheelsets (e.g. front/rear axles) */}
                                        {groups.length > 1 && (
                                            <div className="space-y-1.5 pt-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                        Разноширокие / Составные комплекты ({groups.length}):
                                                    </p>
                                                    <span className="text-[10px] text-gray-400 font-medium">Разбивка по осям/партиям</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {groups.map((g: TireGroup, idx: number) => (
                                                        <div 
                                                            key={idx} 
                                                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200/70 dark:border-gray-700/70 text-xs"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                                    #{idx + 1}
                                                                </span>
                                                                <div className="truncate">
                                                                    <span className="font-bold text-gray-900 dark:text-white mr-1.5">{g.brand} {g.model}</span>
                                                                    <span className="text-gray-500 dark:text-gray-400">{g.count} шт. · {g.season === 'Лето' ? '☀️' : '❄️'}</span>
                                                                </div>
                                                            </div>

                                                            <span className="shrink-0 font-mono font-bold bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-300 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                                                                {g.width}/{g.profile} R{g.diameter}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Minimalist Extra Services Strip */}
                                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700/70 text-xs">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Услуги:</span>
                                            {client['Услуга: Мойка'] && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-semibold text-[11px] whitespace-nowrap">
                                                    🚿 Мойка шин
                                                </span>
                                            )}
                                            {client['Услуга: Упаковка'] && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 font-semibold text-[11px] whitespace-nowrap">
                                                    📦 Упаковка в пакеты
                                                </span>
                                            )}
                                            {client['Услуга: Вывоз'] && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 font-semibold text-[11px] whitespace-nowrap">
                                                    🚚 Вывоз и доставка
                                                </span>
                                            )}
                                            {!client['Услуга: Мойка'] && !client['Услуга: Упаковка'] && !client['Услуга: Вывоз'] && (
                                                <span className="text-gray-400 text-xs italic">Без дополнительных услуг</span>
                                            )}
                                        </div>
                                    </div>
                                </SectionBlock>

                                {/* BLOCK 3: CUSTOMER PROFILE & CONTACTS */}
                                <SectionBlock 
                                    title="Данные и контакты клиента" 
                                    icon={<UserIcon className="w-4 h-4 text-blue-600" />}
                                    badge={
                                        <RussianCarPlateBadge plate={client['Номер Авто']} />
                                    }
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        {/* Direct Phone Calling */}
                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200/60 dark:border-gray-700/60">
                                            <span className="text-gray-400 text-[11px] shrink-0 mr-2">Телефон:</span>
                                            {client['Телефон'] ? (
                                                <a 
                                                    href={`tel:${client['Телефон']}`} 
                                                    className="font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline whitespace-nowrap"
                                                >
                                                    <PhoneIcon className="w-3.5 h-3.5 text-primary-600" />
                                                    <span className="font-mono">{client['Телефон']}</span>
                                                </a>
                                            ) : <span className="text-gray-400">—</span>}
                                        </div>

                                        {/* Telegram Chat ID */}
                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200/60 dark:border-gray-700/60">
                                            <span className="text-gray-400 text-[11px] shrink-0 mr-2">Telegram:</span>
                                            {client['Chat ID'] ? (
                                                <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                                    <span>{client['Chat ID']}</span>
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-[11px]">Не привязан</span>
                                            )}
                                        </div>

                                        {/* Client Address */}
                                        {client['Адрес клиента'] && (
                                            <div className="sm:col-span-2 flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-gray-400 text-[11px] shrink-0 mr-2">Адрес:</span>
                                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{client['Адрес клиента']}</span>
                                            </div>
                                        )}

                                        {/* Client Source & Creation Date */}
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50/60 dark:bg-gray-900/30">
                                            <span className="text-gray-400 text-[11px]">Источник:</span>
                                            <span className="font-medium truncate">{client['Источник трафика'] || 'Прямое обращение'}</span>
                                        </div>

                                        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50/60 dark:bg-gray-900/30">
                                            <span className="text-gray-400 text-[11px]">Создан в CRM:</span>
                                            <span className="font-medium whitespace-nowrap">{formatDateForDisplay(client['Дата добавления'] || client['Начало'])}</span>
                                        </div>
                                    </div>
                                </SectionBlock>

                                {/* BLOCK 4: ORDER NOTES & PHOTO QUICK STRIP */}
                                {descClean && (
                                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3 text-xs">
                                        <p className="font-bold text-amber-800 dark:text-amber-300 uppercase text-[10px] mb-1">Заметки к заказу:</p>
                                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{descClean}</p>
                                    </div>
                                )}

                                {/* Fast Photo Preview Strip */}
                                <SectionBlock 
                                    title={`Фотографии комплекта (${clientPhotos.length})`}
                                    icon={<span className="text-xs select-none">📸</span>}
                                    badge={
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('photos')}
                                            className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                                        >
                                            {clientPhotos.length > 0 ? 'Галерея ➔' : '+ Загрузить'}
                                        </button>
                                    }
                                >
                                    {clientPhotos.length > 0 ? (
                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
                                            {clientPhotos.slice(0, 8).map((url, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedLightboxUrl(url)}
                                                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0 cursor-pointer group bg-gray-100 dark:bg-gray-900 shadow-2xs"
                                                >
                                                    <img src={url} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                    <span className="absolute bottom-1 left-1 px-1 rounded text-[8px] font-mono bg-black/70 text-white">
                                                        #{idx + 1}
                                                    </span>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('photos')}
                                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-[10px] text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 shrink-0 font-medium transition-colors"
                                            >
                                                <span>+ Все ({clientPhotos.length})</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div 
                                            onClick={() => setActiveTab('photos')}
                                            className="py-3 px-3 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                                        >
                                            <p className="text-xs text-gray-500">
                                                Фотографий шин пока нет. <span className="text-primary-600 font-bold underline">Загрузить фото</span>
                                            </p>
                                        </div>
                                    )}
                                </SectionBlock>
                            </div>
                        )}
                        
                        {/* 2.3 HISTORY TAB */}
                        {activeTab === 'history' && (
                            <div className="animate-in fade-in duration-150">
                                <OrderHistory client={client} />
                            </div>
                        )}
                        
                        {/* 2.4 PHOTOS TAB */}
                        {activeTab === 'photos' && (
                            <div className="animate-in fade-in duration-150">
                                <PhotoGallery 
                                    client={client} 
                                    refreshClientData={refreshData} 
                                    showToast={showToast} 
                                />
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* 3. STICKY BOTTOM ACTIONS TOOLBAR (Mobile-First, Ergonomic) */}
            <footer className="sticky bottom-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-2.5 sm:p-3.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                    
                    {mode === 'view' && (
                        <>
                            {/* Primary Payment Action Button */}
                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                <button 
                                    type="button"
                                    onClick={() => setIsPaymentModalOpen(true)} 
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs active:scale-98 transition-all text-xs sm:text-sm whitespace-nowrap"
                                    title="Принять оплату"
                                >
                                    <BanknotesIcon className="w-4 h-4 text-white" /> 
                                    <span>
                                        {hasDebt 
                                            ? `Оплатить (${new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(client['Долг'] || 0)})`
                                            : 'Внести оплату'
                                        }
                                    </span>
                                </button>
                            </div>
                            
                            {/* Secondary Actions Row */}
                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={handleEditClient} 
                                    className="flex-shrink-0 justify-center !py-1.5 !px-2.5 text-xs !rounded-lg"
                                    title="Редактировать заказ"
                                >
                                    <EditIcon className="w-3.5 h-3.5 mr-1 text-gray-500" /> 
                                    <span>Изм.</span>
                                </Button>

                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={handleGenerateReceipt} 
                                    className="flex-shrink-0 justify-center !py-1.5 !px-2.5 text-xs !bg-indigo-50 !text-indigo-700 dark:!bg-indigo-950/40 dark:!text-indigo-300 !rounded-lg" 
                                    title="Сформировать чек и договор"
                                >
                                    <ReceiptIcon className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400" /> 
                                    <span>Чек</span>
                                </Button>

                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={handleClientMessage} 
                                    className="flex-shrink-0 justify-center !py-1.5 !px-2.5 text-xs !rounded-lg" 
                                    title="Написать клиенту в Telegram"
                                >
                                    <MessageIcon className="w-3.5 h-3.5 mr-1 text-gray-500" /> 
                                    <span>TG</span>
                                </Button>

                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={handleNewOrder} 
                                    className="flex-shrink-0 justify-center !py-1.5 !px-2.5 text-xs !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100 dark:!bg-emerald-950/40 dark:!text-emerald-300 !rounded-lg" 
                                    title="Добавить еще один комплект шин"
                                >
                                    <DocumentPlusIcon className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" /> 
                                    <span>+ Комплект</span>
                                </Button>

                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={handleAdminMessage} 
                                    className="flex-shrink-0 justify-center !py-1.5 !px-2.5 text-xs !bg-blue-50 !text-blue-700 dark:!bg-blue-950/30 dark:!text-blue-300 !rounded-lg" 
                                    title="Сообщение администраторам"
                                >
                                    <ShieldCheckIcon className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" /> 
                                    <span>Админу</span>
                                </Button>

                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={handleArchive} 
                                    className="flex-shrink-0 justify-center !py-1.5 !px-2 text-xs !bg-amber-50 !text-amber-800 dark:!bg-amber-950/30 dark:!text-amber-300 !rounded-lg" 
                                    title="Завершить хранение и в архив"
                                >
                                    <span>Архив</span>
                                </Button>

                                <Button 
                                    size="sm" 
                                    variant="danger" 
                                    onClick={handleDelete} 
                                    className="flex-shrink-0 justify-center !p-1.5 !rounded-lg" 
                                    title="Удалить клиента"
                                >
                                    <DeleteIcon className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </>
                    )}

                    {mode === 'message' && (
                        <div className="flex w-full gap-2">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setMode('view')} 
                                disabled={isSubmitting} 
                                className="flex-1 !rounded-xl"
                            >
                                Отмена
                            </Button>
                            <Button 
                                size="sm"
                                onClick={handleSendMessage} 
                                disabled={isSubmitting || (messageTarget === 'client' && !client?.['Chat ID'])} 
                                className="flex-1 !rounded-xl"
                            >
                                {isSubmitting ? 'Отправка...' : 'Отправить в Telegram'}
                            </Button>
                        </div>
                    )}
                </div>
            </footer>

            {/* Payment Modal */}
            {client && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    client={client}
                    onPaymentSuccess={handlePaymentSuccess}
                    showToast={showToast}
                />
            )}
        </div>
    );
};
