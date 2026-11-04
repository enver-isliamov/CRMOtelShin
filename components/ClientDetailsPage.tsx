import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Client, MessageTemplate, TireGroup, formatDateForDisplay, parseDate, Settings, checkStorageExpiry } from '../types';
import { api } from '../services/api';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { PhotoGallery } from './ui/PhotoGallery';
import { Lightbox } from './ui/Lightbox';
import { OrderHistory, OrderStatusBadge } from './ui/Timeline';
import { PaymentModal } from './ui/PaymentModal';
import { SeasonalSwapModal } from './ui/SeasonalSwapModal';
import { RussianCarPlateBadge } from './ui/CarPlateBadge';

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
    CheckIcon,
    MapPinIcon,
    ArrowTopRightOnSquareIcon,
    EllipsisHorizontalIcon,
    XMarkIcon
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



// Expiry Days Calculator and Badge using unified checkStorageExpiry
const getRemainingDaysInfo = (endDateString?: string) => {
    const expiry = checkStorageExpiry(endDateString);
    if (!expiry) return null;
    
    return {
        ...expiry,
        text: expiry.statusText,
        badgeClass: expiry.isUrgent
            ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 font-bold'
            : expiry.severity === 'warning'
                ? 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 font-bold'
                : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900'
    };
};

// Authentic Tire DOT Badge with high mobile legibility (Anti-Wrap & Duplicate Grouping)
const TireDotBadge: React.FC<{ rawDot?: string }> = ({ rawDot }) => {
    if (!rawDot || !rawDot.trim()) {
        return (
            <span className="text-[11px] text-gray-400 font-mono italic">
                не указан
            </span>
        );
    }

    // Split by slash, comma, or semicolon and clean up
    const tokens = rawDot
        .split(/[/,;]+/)
        .map(t => t.trim().replace(/^DOT\s*[:.-]?\s*/i, ''))
        .filter(Boolean);

    if (tokens.length === 0) {
        return (
            <span className="text-[11px] text-gray-400 font-mono italic">
                не указан
            </span>
        );
    }

    // Group identical DOT codes (e.g. "2422 / 2422" -> "2422 ×2")
    const grouped = new Map<string, number>();
    for (const token of tokens) {
        grouped.set(token, (grouped.get(token) || 0) + 1);
    }

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {Array.from(grouped.entries()).map(([code, count], idx) => (
                <span 
                    key={idx} 
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border border-stone-300 dark:border-stone-700 font-mono text-xs font-bold tracking-wider select-all whitespace-nowrap tabular-nums shadow-2xs"
                    title={`DOT код шины: ${code}`}
                >
                    <span className="text-[9px] font-sans font-black text-amber-600 dark:text-amber-400 tracking-normal uppercase">
                        DOT
                    </span>
                    <span>{code}</span>
                    {count > 1 && (
                        <span className="text-[10px] font-sans font-semibold text-gray-500 dark:text-gray-400 ml-0.5 bg-black/5 dark:bg-white/10 px-1 rounded">
                            ×{count}
                        </span>
                    )}
                </span>
            ))}
        </div>
    );
};

// Helper to determine DOT for a specific group/pair (falls back gracefully to split client DOT)
const getGroupDot = (group: TireGroup, idx: number, allGroups: TireGroup[], clientDot?: string): string => {
    if (group.dot && group.dot.trim()) {
        return group.dot.trim();
    }
    if (!clientDot || !clientDot.trim()) return '';
    const parts = clientDot.split(/[/,;]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length === allGroups.length && parts[idx]) {
        return parts[idx];
    }
    if (idx === 0 && parts.length > 0) {
        return parts[0];
    }
    return '';
};

// Unified Tire Set Card: identical sleek style for single sets and multi/staggered axle pairs
const TireSetCard: React.FC<{
    badgeLabel?: string;
    brandModel: string;
    size: string;
    count: number;
    season?: string;
    hasRims?: string;
    dot?: string;
    isStaggered?: boolean;
}> = ({ badgeLabel, brandModel, size, count, season, hasRims, dot, isStaggered }) => {
    return (
        <div className="p-3 sm:p-3.5 rounded-xl bg-gray-50/90 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 shadow-2xs space-y-2.5">
            {/* Top Row: Index Badge, Brand & Model, Tire Size Monospace Pill */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                    {badgeLabel && (
                        <span className="w-5 h-5 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-mono shadow-2xs">
                            {badgeLabel}
                        </span>
                    )}
                    <div className="min-w-0">
                        <h5 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                            {brandModel || 'Марка не указана'}
                        </h5>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className="font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {count} шт.
                            </span>
                            {season && (
                                <>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                        {season === 'Лето' ? '☀️ Лето' : '❄️ Зима'}
                                    </span>
                                </>
                            )}
                            {hasRims && (
                                <>
                                    <span>·</span>
                                    <span className="whitespace-nowrap">
                                        {hasRims === 'Да' ? 'С дисками' : 'Без дисков'}
                                    </span>
                                </>
                            )}
                            {isStaggered && (
                                <>
                                    <span>·</span>
                                    <span className="text-[10px] text-gray-700 dark:text-gray-300 font-semibold bg-gray-200/80 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                        {badgeLabel === '#1' ? 'Передняя ось' : badgeLabel === '#2' ? 'Задняя ось' : 'Ось/партия'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Light & Clean Tire Size Pill (High contrast, lightweight, non-heavy) */}
                <span className="px-2.5 py-1 rounded-lg font-mono text-xs sm:text-sm font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 shadow-2xs shrink-0 whitespace-nowrap tracking-tight">
                    {size || 'Размер —'}
                </span>
            </div>

            {/* Dedicated DOT Code Row: highly legible, responsive, anti-wrap */}
            <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800/80 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        DOT код:
                    </span>
                    <TireDotBadge rawDot={dot} />
                </div>
            </div>
        </div>
    );
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
    archive?: Client[];
    headers: string[];
    templates: MessageTemplate[];
    refreshData: () => Promise<void>;
    settings: Settings;
}

export const ClientDetailsPage: React.FC<ClientDetailsPageProps> = ({ clients, archive = [], templates, refreshData, settings }) => {
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
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [selectedLightboxUrl, setSelectedLightboxUrl] = useState<string | null>(null);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const handleSwapComplete = (updatedClient: Client) => {
        setClient(updatedClient);
        refreshData();
    };

    useEffect(() => {
        if (!id) return;
        let foundClient = clients.find(c => String(c.id) === String(id)) || archive.find(c => String(c.id) === String(id));
        if (!foundClient) {
            // Resolve via order id or contract from unified orders list
            foundClient = clients.find(c => c.orders?.some(o => String(o.id) === String(id) || String(o.contract) === String(id))) ||
                          archive.find(c => c.orders?.some(o => String(o.id) === String(id) || String(o.contract) === String(id)));
        }
        if (foundClient) {
            setClient(foundClient);
        } else if (location.state?.client) {
            setClient(location.state.client);
        }
    }, [id, clients, archive, location.state]);

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
    const isTiresOut = client?.hasActiveStorage === false || client?.['Склад хранения'] === 'У Клиента' || client?.['Статус сделки'] === 'Шины у клиента';
    const expiryInfo = isTiresOut ? null : getRemainingDaysInfo(client['Окончание']);
    const groups = getTireGroups(client);
    const ordersCount = client?.ordersCount || client?.orders?.length || 1;

    // Initials for avatar
    const initials = (client['Имя клиента'] || 'К')
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    // Deal Status Styling
    const status = isTiresOut ? 'Шины у клиента' : (client['Статус сделки'] || 'На складе');
    const statusStyles = {
        'На складе': 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        'Шины у клиента': 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
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
            
            {/* 1. STICKY TOP APP BAR (Spacious for long names, No duplicate contract info) */}
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-4 py-2.5 shadow-xs">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button 
                            type="button"
                            onClick={() => navigate('/clients')} 
                            className="p-1.5 -ml-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shrink-0"
                            title="Назад к клиентам"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white leading-snug break-words">
                                {client['Имя клиента']}
                            </h1>
                        </div>
                    </div>

                    {/* Car plate badge pinned cleanly to the right */}
                    <div className="shrink-0">
                        <RussianCarPlateBadge plate={client['Номер Авто']} />
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
                                <span>Заказы и хроника ({ordersCount})</span>
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

                                {/* Banner when client's tires are currently with them */}
                                {isTiresOut && (
                                    <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
                                                <span className="text-xl">🚗</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-extrabold text-sm sm:text-base text-amber-900 dark:text-amber-100">
                                                        Шины сейчас находятся у клиента
                                                    </h4>
                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                                                        Всего в истории: {ordersCount} {ordersCount === 1 ? 'заказ' : (ordersCount >= 2 && ordersCount <= 4 ? 'заказа' : 'заказов')}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                                                    Активного комплекта на складе сейчас нет (шины выданы клиенту). Последний договор: <span className="font-mono font-bold">#{client['Договор']}</span> ({client['Бренд_Модель'] || client['Размер шин'] || 'Комплект'}).
                                                </p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm"
                                            onClick={() => navigate('/add-client', { state: { clientToReorder: client } })}
                                            className="w-full sm:w-auto shrink-0 !py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold whitespace-nowrap shadow-xs"
                                        >
                                            + Принять на новый сезон
                                        </Button>
                                    </div>
                                )}
                                
                                {/* Urgent Expiry Red Alert Banner (<= 7 days or overdue) */}
                                {expiryInfo?.isUrgent && (
                                    <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200 shadow-xs flex items-start gap-3">
                                        <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 shadow-xs">
                                            <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-300 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="font-extrabold text-xs sm:text-sm text-rose-800 dark:text-rose-200">
                                                    {expiryInfo.isExpired ? 'Срок хранения истёк!' : 'Срок хранения истекает менее чем через 7 дней!'}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase bg-rose-200/80 dark:bg-rose-900 text-rose-900 dark:text-rose-100">
                                                    {expiryInfo.shortText}
                                                </span>
                                            </div>
                                            <p className="text-xs text-rose-700/90 dark:text-rose-300/90 mt-0.5 leading-relaxed">
                                                {expiryInfo.statusText} (дата окончания: {formatDateForDisplay(client['Окончание'])}). Свяжитесь с клиентом для продления хранения или выдачи шин.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* BLOCK 1: ORDER & STORAGE OVERVIEW (Active Contract, Dates, Location, Finances) */}
                                <SectionBlock 
                                    title="Текущий заказ и хранение" 
                                    icon={<CalendarDaysIcon className="w-4 h-4 text-primary-600" />}
                                    badge={
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <OrderStatusBadge
                                                status={client['Статус сделки']}
                                                isArchived={client.is_archived || isTiresOut}
                                                warehouse={client['Склад хранения']}
                                                debt={Number(client['Долг'] || 0)}
                                                cell={client['Ячейка']}
                                                showCell={false}
                                            />
                                            <span className="font-mono text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                                                #{client['Договор']}
                                            </span>
                                        </div>
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
                                        <div className={`p-2.5 rounded-xl border transition-all ${
                                            expiryInfo?.isUrgent
                                                ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 ring-1 ring-rose-400/40'
                                                : 'bg-gray-50/90 dark:bg-gray-900/40 border-gray-200/70 dark:border-gray-700/70'
                                        }`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Окончание</span>
                                                {expiryInfo?.isUrgent && (
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-base sm:text-lg font-black mt-0.5 whitespace-nowrap ${
                                                expiryInfo?.isUrgent ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'
                                            }`}>
                                                {formatDateForDisplay(client['Окончание'])}
                                            </p>
                                            {expiryInfo ? (
                                                <span className={`text-[10px] font-bold ${
                                                    expiryInfo.isUrgent ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-blue-500'
                                                } whitespace-nowrap`}>
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
                                    icon={<TireIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />}
                                    badge={
                                        <div className="flex items-center gap-1.5">
                                            {groups.length > 1 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 whitespace-nowrap">
                                                    Разноширокие ({groups.length})
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsSwapModalOpen(true)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 text-xs font-bold transition-all shadow-2xs"
                                                title="Оформить сезонную замену шин"
                                            >
                                                <span>🔄</span>
                                                <span>Смена сезона</span>
                                            </button>
                                        </div>
                                    }
                                >
                                    <div className="space-y-3">
                                        {/* Multi-set Groups (e.g. Staggered Front & Rear Axles) with individual DOT codes */}
                                        {groups.length > 1 ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                        Разноширокие / Составные комплекты ({groups.length}):
                                                    </p>
                                                    <span className="text-[10px] text-gray-400 font-medium">Разбивка по осям с отдельным DOT</span>
                                                </div>
                                                <div className="space-y-2.5">
                                                    {groups.map((g: TireGroup, idx: number) => {
                                                        const groupDot = getGroupDot(g, idx, groups, client['DOT-код']);
                                                        return (
                                                            <TireSetCard 
                                                                key={idx}
                                                                badgeLabel={`#${idx + 1}`}
                                                                brandModel={`${g.brand || ''} ${g.model || ''}`.trim() || client['Бренд_Модель'] || 'Марка не указана'}
                                                                size={`${g.width}/${g.profile} R${g.diameter}`}
                                                                count={g.count || 2}
                                                                season={g.season || client['Сезон']}
                                                                hasRims={g.hasRims || client['Наличие дисков']}
                                                                dot={groupDot}
                                                                isStaggered={true}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            /* Single Standard Tire Set with identical sleek aesthetic & mobile-optimized DOT */
                                            <TireSetCard 
                                                badgeLabel="#1"
                                                brandModel={client['Бренд_Модель'] || (groups[0] ? `${groups[0].brand} ${groups[0].model}`.trim() : '') || 'Марка не указана'}
                                                size={client['Размер шин'] || (groups[0] ? `${groups[0].width}/${groups[0].profile} R${groups[0].diameter}` : '') || 'Размер —'}
                                                count={client['Кол-во шин'] || groups[0]?.count || 4}
                                                season={client['Сезон'] || groups[0]?.season}
                                                hasRims={client['Наличие дисков'] || groups[0]?.hasRims}
                                                dot={client['DOT-код'] || groups[0]?.dot}
                                            />
                                        )}

                                        {/* Minimalist Extra Services Strip */}
                                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700/70 text-xs">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Услуги:</span>
                                            {client['Услуга: Мойка'] && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold text-[11px] whitespace-nowrap">
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
                                    icon={<UserIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />}
                                >
                                    <div className="space-y-2 text-xs">
                                        {/* Contact & Vehicle Row - Styled identically to storage dates, clean & lightweight */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
                                            {/* Phone */}
                                            <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30 min-h-[34px]">
                                                <span className="text-gray-400 text-[11px]">Телефон:</span>
                                                {client['Телефон'] ? (
                                                    <a 
                                                        href={`tel:${client['Телефон']}`} 
                                                        className="inline-flex items-center gap-1 font-mono font-bold text-xs text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap"
                                                        title="Позвонить клиенту"
                                                    >
                                                        <PhoneIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                        <span>{client['Телефон']}</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 italic text-xs">Не указан</span>
                                                )}
                                            </div>

                                            {/* Vehicle Plate */}
                                            <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30 min-h-[34px]">
                                                <span className="text-gray-400 text-[11px]">Авто:</span>
                                                {client['Номер Авто'] ? (
                                                    <RussianCarPlateBadge plate={client['Номер Авто']} />
                                                ) : (
                                                    <span className="text-gray-400 italic text-xs">Без номера</span>
                                                )}
                                            </div>

                                            {/* Telegram */}
                                            <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30 min-h-[34px]">
                                                <span className="text-gray-400 text-[11px]">Telegram:</span>
                                                {client['Chat ID'] ? (
                                                    <span 
                                                        className="inline-flex items-center gap-1.5 font-mono font-bold text-xs text-gray-800 dark:text-gray-200"
                                                        title={`Telegram Chat ID: ${client['Chat ID']}`}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                                                        <span>{client['Chat ID']}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic text-xs">Не привязан</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Client Address (Clean, compact, no uppercase headers, clickable to open map & navigate route) */}
                                        {client['Адрес клиента'] && (
                                            <a 
                                                href={`https://yandex.ru/maps/?text=${encodeURIComponent(client['Адрес клиента'])}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 p-1.5 px-2.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30 hover:bg-gray-100/80 dark:hover:bg-gray-800/50 transition-colors cursor-pointer text-xs"
                                                title="Открыть адрес на Яндекс.Картах и проложить маршрут"
                                            >
                                                <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                                                    <span className="text-gray-400 text-[11px] shrink-0 mt-0.5 sm:mt-0">Адрес:</span>
                                                    <span className="font-semibold text-gray-800 dark:text-gray-200 break-words leading-relaxed group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                                        {client['Адрес клиента']}
                                                    </span>
                                                </div>
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 dark:text-primary-400 group-hover:underline shrink-0 self-end sm:self-center">
                                                    <span>Маршрут</span>
                                                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                                                </span>
                                            </a>
                                        )}

                                        {/* Client Source & Creation Date in matching compact style */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 pt-0.5">
                                            <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30 min-h-[32px]">
                                                <span className="text-gray-400 text-[11px]">Источник:</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-200 truncate">
                                                    {client['Источник трафика'] || 'Прямое обращение'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-gray-50/60 dark:bg-gray-900/30 min-h-[32px]">
                                                <span className="text-gray-400 text-[11px]">Создан:</span>
                                                <span className="font-bold font-mono text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                                    {formatDateForDisplay(client['Дата добавления'] || client['Начало'])}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </SectionBlock>

                                {/* BLOCK 4: ORDERS & SEASONS HISTORY LIST */}
                                <SectionBlock 
                                    title={`История заказов и сезонов (${ordersCount})`}
                                    icon={<CalendarDaysIcon className="w-4 h-4 text-primary-600" />}
                                    badge={
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('history')}
                                            className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                                        >
                                            <span>Вся хроника и лог ➔</span>
                                        </button>
                                    }
                                >
                                    <div className="space-y-2">
                                        {client.orders && client.orders.length > 0 ? (
                                            <div className="space-y-2">
                                                {client.orders.map((ord, oIdx) => (
                                                    <div 
                                                        key={ord.id || ord.contract || oIdx}
                                                        onClick={() => setActiveTab('history')}
                                                        className="p-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                            <span className="font-mono text-xs font-extrabold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded shrink-0">
                                                                #{ord.contract}
                                                            </span>
                                                            <OrderStatusBadge 
                                                                status={ord.status}
                                                                isArchived={ord.isArchived}
                                                                warehouse={ord.warehouse}
                                                                debt={ord.debt}
                                                                cell={ord.cell}
                                                            />
                                                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                                                                {ord.season === 'Зима' ? '❄️ Зима' : '☀️ Лето'} • {ord.brandModel || ord.tireSize || 'Комплект шин'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-gray-500 shrink-0">
                                                            <span>{formatDateForDisplay(ord.startDate)} — {formatDateForDisplay(ord.expiryDate)}</span>
                                                            <span className="font-black text-gray-900 dark:text-white">{ord.totalPrice} ₽</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div 
                                                onClick={() => setActiveTab('history')}
                                                className="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100/60 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <OrderStatusBadge 
                                                        status={client['Статус сделки']}
                                                        isArchived={isTiresOut}
                                                        warehouse={client['Склад хранения']}
                                                        debt={Number(client['Долг'] || 0)}
                                                        cell={client['Ячейка']}
                                                    />
                                                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                                                        Договор #{client['Договор']} ({client['Сезон'] || 'Сезон'} • {client['Бренд_Модель'] || 'Комплект'})
                                                    </span>
                                                </div>
                                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 shrink-0">Хронология ➔</span>
                                            </div>
                                        )}
                                    </div>
                                </SectionBlock>

                                {/* BLOCK 5: ORDER NOTES & PHOTO QUICK STRIP */}
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

            {/* 3. STICKY BOTTOM ACTIONS TOOLBAR (Mobile-First, Ergonomic, Clean Hierarchy) */}
            <footer className="sticky bottom-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-2 sm:p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="max-w-4xl mx-auto">
                    {mode === 'view' && (
                        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                            
                            {/* 1. PRIMARY ACTION: PAYMENT (With Debt Highlight) */}
                            <button 
                                type="button"
                                onClick={() => setIsPaymentModalOpen(true)} 
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 py-2.5 px-3.5 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold shadow-xs transition-all text-xs sm:text-sm min-h-[44px]"
                                title="Внести оплату или погасить задолженность"
                            >
                                <BanknotesIcon className="w-4 h-4 text-white shrink-0" /> 
                                <span className="whitespace-nowrap truncate font-extrabold">
                                    {hasDebt 
                                        ? `Оплатить (${new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(client['Долг'] || 0)})`
                                        : 'Внести оплату'
                                    }
                                </span>
                            </button>

                            {/* 2. CORE OPERATIONAL ACTION: SEASON SWAP / ISSUE TIRES */}
                            <button 
                                type="button"
                                onClick={() => setIsSwapModalOpen(true)} 
                                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold active:scale-98 transition-all text-xs min-h-[44px] whitespace-nowrap shadow-2xs"
                                title="Оформить сезонную смену шин или выдачу"
                            >
                                <span>🔄</span>
                                <span className="hidden xs:inline sm:inline">Смена сезона</span>
                                <span className="xs:hidden sm:hidden">Сезон</span>
                            </button>

                            {/* 3. QUICK TOOLS: RECEIPT, TELEGRAM, AND "••• ЕЩЁ" MENU */}
                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                {/* RECEIPT / CHECK */}
                                <button 
                                    type="button"
                                    onClick={handleGenerateReceipt} 
                                    className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs min-h-[44px] min-w-[42px] transition-colors" 
                                    title="Сформировать электронный чек и договор"
                                >
                                    <ReceiptIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" /> 
                                    <span className="hidden sm:inline">Чек</span>
                                </button>

                                {/* TELEGRAM */}
                                <button 
                                    type="button"
                                    onClick={handleClientMessage} 
                                    className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs min-h-[44px] min-w-[42px] transition-colors" 
                                    title="Написать клиенту в Telegram"
                                >
                                    <MessageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" /> 
                                    <span className="hidden sm:inline">TG</span>
                                </button>

                                {/* MORE ACTIONS MENU TRIGGER ("••• Ещё") */}
                                <button 
                                    type="button"
                                    onClick={() => setIsMoreMenuOpen(true)}
                                    className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs min-h-[44px] min-w-[42px] transition-colors group"
                                    title="Все действия с клиентом"
                                >
                                    <EllipsisHorizontalIcon className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:scale-110 transition-transform" />
                                    <span className="hidden sm:inline">Ещё</span>
                                </button>
                            </div>

                        </div>
                    )}

                    {mode === 'message' && (
                        <div className="flex w-full gap-2">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setMode('view')} 
                                disabled={isSubmitting} 
                                className="flex-1 !rounded-xl !py-2.5 min-h-[44px]"
                            >
                                Отмена
                            </Button>
                            <Button 
                                size="sm" 
                                onClick={handleSendMessage} 
                                disabled={isSubmitting || (messageTarget === 'client' && !client?.['Chat ID'])} 
                                className="flex-1 !rounded-xl !py-2.5 min-h-[44px]"
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

            {/* Seasonal Swap Modal */}
            {client && (
                <SeasonalSwapModal
                    isOpen={isSwapModalOpen}
                    onClose={() => setIsSwapModalOpen(false)}
                    client={client}
                    onSwapComplete={handleSwapComplete}
                    showToast={showToast}
                />
            )}

            {/* 4. MODERN ACTION SHEET MODAL ("••• Ещё действия") */}
            {isMoreMenuOpen && client && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
                        onClick={() => setIsMoreMenuOpen(false)}
                    />

                    {/* Sheet Container */}
                    <div className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-250">
                        {/* Mobile Grab Indicator */}
                        <div className="pt-3 pb-1 flex justify-center sm:hidden">
                            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                        </div>

                        {/* Sheet Header */}
                        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                            <div className="min-w-0 flex-1 pr-2">
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                                    Действия с клиентом
                                </h3>
                                <p className="text-xs text-gray-500 truncate">
                                    {client['Имя клиента']} • {client['Номер Авто'] || 'Без авто'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMoreMenuOpen(false)}
                                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Sheet Body with Organized Categories */}
                        <div className="p-3 sm:p-4 space-y-4 overflow-y-auto">
                            
                            {/* SECTION 1: ЗАКАЗЫ И ХРАНЕНИЕ */}
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">
                                    Заказы и хранение
                                </span>
                                <div className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            setIsSwapModalOpen(true);
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/70 text-left transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform font-bold">
                                            🔄
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-gray-900 dark:text-white">Смена сезона / Выдача шин</div>
                                            <div className="text-[11px] text-gray-500 truncate">Сменить сезон, продлить хранение или выдать комплект</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            handleNewOrder();
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/70 text-left transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <DocumentPlusIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-gray-900 dark:text-white">+ Добавить ещё один комплект шин</div>
                                            <div className="text-[11px] text-gray-500 truncate">Оформить дополнительный заказ на хранение для клиента</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* SECTION 2: ДОКУМЕНТЫ И СВЯЗЬ */}
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">
                                    Документы и связь
                                </span>
                                <div className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            handleGenerateReceipt();
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/70 text-left transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <ReceiptIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-gray-900 dark:text-white">Сформировать чек и договор</div>
                                            <div className="text-[11px] text-gray-500 truncate">Подготовить электронный акт с QR-кодом и расчётом</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            handleClientMessage();
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/70 text-left transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <MessageIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-gray-900 dark:text-white">Написать клиенту в Telegram</div>
                                            <div className="text-[11px] text-gray-500 truncate">Чат ID: {client['Chat ID'] ? client['Chat ID'] : 'Не привязан'}</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            handleAdminMessage();
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/70 text-left transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <ShieldCheckIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-gray-900 dark:text-white">Сообщение администраторам</div>
                                            <div className="text-[11px] text-gray-500 truncate">Отправить служебное уведомление управляющим</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* SECTION 3: КАРТОЧКА КЛИЕНТА */}
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">
                                    Карточка клиента
                                </span>
                                <div className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            handleEditClient();
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/70 text-left transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <EditIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-gray-900 dark:text-white">Редактировать карточку</div>
                                            <div className="text-[11px] text-gray-500 truncate">Изменить телефон, госномер авто, склад, ячейку или адрес</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            handleArchive();
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-amber-50/80 dark:hover:bg-amber-950/40 text-left transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-sm">
                                            📦
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-amber-900 dark:text-amber-200">Завершить хранение (в архив)</div>
                                            <div className="text-[11px] text-amber-700/80 dark:text-amber-400 truncate">Шины выданы, перевести заказ в архив истории</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* SECTION 4: ОПАСНАЯ ЗОНА */}
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMoreMenuOpen(false);
                                        handleDelete();
                                    }}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors group"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <DeleteIcon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-rose-600 dark:text-rose-400">Удалить клиента</div>
                                        <div className="text-[11px] text-rose-500/80 dark:text-rose-400/80 truncate">Безвозвратное удаление карточки клиента и заказов</div>
                                    </div>
                                </button>
                            </div>

                        </div>

                        {/* Sheet Footer */}
                        <div className="p-3 bg-gray-50/80 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => setIsMoreMenuOpen(false)}
                                className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors shadow-2xs"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
