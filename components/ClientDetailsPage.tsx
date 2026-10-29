
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Client, MessageTemplate, TireGroup, formatDateForDisplay, Settings } from '../types';
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
    CurrencyRubleIcon as CashIcon,
    UserIcon
} from './icons/Icons';


// Helper to extract JSON groups
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
}

const SectionBlock: React.FC<{title: string, children: React.ReactNode, icon?: React.ReactNode}> = ({ title, children, icon }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h4>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {children}
        </div>
    </div>
);

const DetailItem: React.FC<{ label: string; value: React.ReactNode, className?: string }> = ({ label, value, className }) => (
    <div className={className}>
        <dt className="text-[10px] sm:text-xs font-medium text-gray-400 dark:text-gray-500 uppercase mb-0.5">{label}</dt>
        <dd className="text-sm sm:text-base font-medium text-gray-900 dark:text-white break-words leading-tight">{value || '—'}</dd>
    </div>
);

const TireGroupsView: React.FC<{ client: Client }> = ({ client }) => {
    const groups = getTireGroups(client);
    if (groups.length === 0) return null;

    return (
         <div className="col-span-1 sm:col-span-2 space-y-2 mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
            <p className="text-xs font-bold text-gray-500 uppercase">Состав комплекта:</p>
            {groups.map((g: TireGroup, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                     <span>
                         <span className="font-bold">{g.count} шт</span> • {g.brand} {g.model}
                     </span>
                     <span className="font-mono text-gray-600 dark:text-gray-400 font-semibold">
                         {g.width}/{g.profile} R{g.diameter}
                     </span>
                </div>
            ))}
         </div>
    );
};

const TabButton: React.FC<{active: boolean, onClick: ()=>void, children: React.ReactNode}> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors duration-200 focus:outline-none ${
            active
            ? 'border-primary-500 text-primary-600 dark:text-primary-300'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
    >
        {children}
    </button>
)

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
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedLightboxUrl, setSelectedLightboxUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const foundClient = clients.find(c => String(c.id) === String(id));
        if (foundClient) {
            // Live data from database/storage always takes precedence
            setClient(foundClient);
        } else if (location.state?.client) {
            // Fallback while clients list is loading on initial mount
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
                    // Send to all admins
                    const adminIds = settings.adminIds.split(',').map(id => id.trim()).filter(Boolean);
                    if (adminIds.length === 0) throw new Error("ID администраторов не настроены в настройках.");
                    
                    await Promise.all(adminIds.map(id => api.sendMessage(id, preview)));
                    showToast(`Отправлено администраторам (${adminIds.length})`, 'success');
                } else {
                    // Send to client
                    if (!client['Chat ID']) throw new Error("У клиента не указан Chat ID.");
                    const result = await api.sendMessage(client['Chat ID'] as string, preview);
                    showToast(result.message, result.success ? 'success' : 'error');
                }
                
                if (messageTarget === 'client') {
                    await refreshData(); // Refresh only if client interaction
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
    }

    const handleClientMessage = () => {
        setMessageTarget('client');
        setMode('message');
        setPreview('');
    }

    const handleGenerateReceipt = () => {
        if (!client) return;
        const groups = getTireGroups(client);
        const formatCurrency = (val: number | undefined) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(val || 0);
        
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
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-100 dark:bg-gray-950">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Загрузка базы данных...</p>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-100 dark:bg-gray-950">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-sm w-full">
                    <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Клиент не найден</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Возможно, клиент был удален или ID в ссылке указан неверно.
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
    const descClean = (client?.['Заказ - QR'] || '').split('||JSON:')[0];

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-950">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {selectedLightboxUrl && <Lightbox imageUrl={selectedLightboxUrl} onClose={() => setSelectedLightboxUrl(null)} />}
            
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                    <button onClick={() => navigate('/clients')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                        <ArrowLeftIcon />
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-lg font-bold leading-tight text-gray-900 dark:text-white truncate">
                            {client['Имя клиента']}
                        </h1>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="truncate">{client['Номер Авто']}</span>
                            {client['Склад хранения'] && <span>• {client['Склад хранения']}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                         client['Статус сделки'] === 'На складе' ? 'bg-green-100 text-green-800' : 
                         client['Статус сделки'] === 'Завершено' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
                     }`}>
                         {client['Статус сделки']}
                     </span>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6">
                
                {/* Mode: Message */}
                {mode === 'message' && (
                    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold dark:text-white">
                                    {messageTarget === 'admin' ? 'Сообщение администратору' : 'Сообщение клиенту'}
                                </h3>
                                {messageTarget === 'admin' && <ShieldCheckIcon className="w-6 h-6 text-blue-500"/>}
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="template" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Шаблон</label>
                                    <select 
                                        id="template" 
                                        value={selectedTemplateName} 
                                        onChange={e => setSelectedTemplateName(e.target.value)} 
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition duration-150"
                                    >
                                        <option value="">-- Индивидуальное сообщение / Чек --</option>
                                        {templates.map(t => <option key={t['Название шаблона']} value={t['Название шаблона']}>{t['Название шаблона']}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Сообщение (HTML)</h4>
                                    <div 
                                        className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 min-h-[150px] max-h-[40vh] overflow-y-auto font-mono text-sm whitespace-pre-wrap outline-none focus:ring-2 focus:ring-primary-500" 
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
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Tab Nav */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-200 dark:border-gray-700 flex">
                            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Детали</TabButton>
                            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>История</TabButton>
                            <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')}>
                                Фото {clientPhotos.length > 0 ? `(${clientPhotos.length})` : ''}
                            </TabButton>
                        </div>

                        {activeTab === 'details' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                {/* Key Metrics Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                     <div className={`p-4 rounded-xl border flex flex-col justify-between ${Number(client['Долг'] || 0) > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'}`}>
                                        <div>
                                            <p className={`text-xs font-bold uppercase tracking-wider ${Number(client['Долг'] || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {Number(client['Долг'] || 0) > 0 ? 'Долг' : 'Оплачено'}
                                            </p>
                                            <p className={`text-xl sm:text-2xl font-black mt-1 ${Number(client['Долг'] || 0) > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(client['Долг'] || 0))}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsPaymentModalOpen(true)}
                                            className={`mt-2.5 w-full py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 ${
                                                Number(client['Долг'] || 0) > 0
                                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                                    : 'bg-white hover:bg-gray-100 text-green-700 dark:bg-gray-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                                            }`}
                                        >
                                            <BanknotesIcon className="w-3.5 h-3.5" />
                                            <span>{Number(client['Долг'] || 0) > 0 ? 'Принять оплату' : '+ Внести оплату'}</span>
                                        </button>
                                    </div>
                                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-800">
                                        <p className="text-xs font-bold uppercase tracking-wider text-blue-500">Окончание</p>
                                        <p className="text-xl sm:text-2xl font-black mt-1 text-blue-700 dark:text-blue-300">{formatDateForDisplay(client['Окончание'])}</p>
                                    </div>
                                </div>

                                {/* Contract Info */}
                                <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Договор №</p>
                                        <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">{client['Договор']}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 uppercase font-bold">Ячейка</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{client['Ячейка'] || '—'}</p>
                                    </div>
                                </div>

                                <SectionBlock title="Шины и Хранение" icon={<TireIcon/>}>
                                     <DetailItem label="Бренд" value={client['Бренд_Модель']} className="col-span-1 sm:col-span-2" />
                                     <DetailItem label="Размер шин" value={client['Размер шин']} className="col-span-1 sm:col-span-2" />
                                     <TireGroupsView client={client} />
                                     <DetailItem label="Сезон" value={client['Сезон']} />
                                     <DetailItem label="Кол-во" value={`${client['Кол-во шин']} шт.`} />
                                     <DetailItem label="Наличие дисков" value={client['Наличие дисков']} />
                                     <DetailItem label="DOT-код" value={client['DOT-код']} />
                                </SectionBlock>

                                {/* Photo Strip in Details Tab */}
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 dark:text-gray-500">📸</span>
                                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Фотографии шин и дисков {clientPhotos.length > 0 ? `(${clientPhotos.length})` : ''}
                                            </h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('photos')}
                                            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                                        >
                                            {clientPhotos.length > 0 ? 'Все фото ➔' : '+ Загрузить фото'}
                                        </button>
                                    </div>
                                    <div className="p-3">
                                        {clientPhotos.length > 0 ? (
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                                {clientPhotos.slice(0, 6).map((url, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => setSelectedLightboxUrl(url)}
                                                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xs cursor-pointer group bg-gray-100 dark:bg-gray-900"
                                                    >
                                                        <img src={url} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                        <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded text-[9px] font-mono bg-black/70 text-white leading-none">
                                                            #{idx + 1}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div 
                                                onClick={() => setActiveTab('photos')}
                                                className="py-3 px-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                                            >
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Нет прикрепленных фото. <span className="text-primary-600 dark:text-primary-400 font-semibold underline">Нажмите здесь</span>, чтобы загрузить из галереи или с камеры.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-4">
                                    <h4 className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase mb-2">Заметки</h4>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap">{descClean || 'Нет описания'}</p>
                                </div>

                                <SectionBlock title="Финансы" icon={<CashIcon/>}>
                                     <DetailItem label="Общая сумма" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(client['Общая сумма'] || 0))} className="col-span-1 sm:col-span-1" />
                                     <DetailItem label="Текущий долг" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(client['Долг'] || 0))} className={`col-span-1 sm:col-span-1 font-bold ${Number(client['Долг'] || 0) > 0 ? '!text-red-600 dark:!text-red-400' : '!text-green-600 dark:!text-green-400'}`} />
                                     <DetailItem label="Цена за месяц" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(client['Цена за месяц'] || 0))} />
                                     <DetailItem label="Срок хранения" value={`${client['Срок']} мес.`} />
                                     <DetailItem label="Начало хранения" value={formatDateForDisplay(client['Начало'])} />
                                </SectionBlock>

                                <SectionBlock title="Контакты" icon={<UserIcon/>}>
                                    <DetailItem label="Телефон" value={client['Телефон']} />
                                    <DetailItem label="Chat ID" value={client['Chat ID']} />
                                    <DetailItem label="Адрес клиента" value={client['Адрес клиента']} className="col-span-1 sm:col-span-2" />
                                </SectionBlock>
                            </div>
                        )}
                        
                        {activeTab === 'history' && <OrderHistory client={client} />}
                        
                        {activeTab === 'photos' && <PhotoGallery client={client} refreshClientData={refreshData} showToast={showToast} />}
                    </div>
                )}
            </div>

            {/* Sticky Bottom Actions Bar (Mobile Optimized) */}
            <div className="sticky bottom-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-2.5 sm:p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-2 sm:gap-3 justify-between items-stretch sm:items-center">
                    
                    {mode === 'view' && (
                        <>
                            {/* Primary Payment Action Button */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Button 
                                    size="md" 
                                    variant="secondary" 
                                    onClick={() => setIsPaymentModalOpen(true)} 
                                    className="flex-1 sm:flex-none justify-center !py-2.5 !px-4 !bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold shadow-sm active:scale-[0.98] transition-transform text-sm"
                                    title="Принять оплату"
                                >
                                    <BanknotesIcon className="w-5 h-5 mr-1.5 text-white"/> 
                                    <span>
                                        {Number(client['Долг'] || 0) > 0 
                                            ? `Принять оплату (${new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(client['Долг'] || 0)})`
                                            : 'Принять оплату'
                                        }
                                    </span>
                                </Button>
                            </div>
                            
                            {/* Secondary Actions: Clean Scrollable Strip on Mobile, Wrap on Desktop */}
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
                                <Button size="md" variant="secondary" onClick={handleEditClient} className="flex-shrink-0 justify-center !py-2 text-xs sm:text-sm">
                                    <EditIcon className="w-4 h-4 mr-1 text-gray-500"/> <span>Изм.</span>
                                </Button>
                                <Button size="md" variant="secondary" onClick={handleGenerateReceipt} className="flex-shrink-0 justify-center !py-2 text-xs sm:text-sm !bg-indigo-50 !text-indigo-700 dark:!bg-indigo-900/30 dark:!text-indigo-300" title="Чек и договор">
                                    <ReceiptIcon className="w-4 h-4 mr-1 text-indigo-600 dark:text-indigo-400"/> <span>Чек</span>
                                </Button>
                                <Button size="md" variant="secondary" onClick={handleClientMessage} className="flex-shrink-0 justify-center !py-2 text-xs sm:text-sm" title="Написать клиенту">
                                    <MessageIcon className="w-4 h-4 mr-1 text-gray-500"/> <span>SMS</span>
                                </Button>
                                <Button size="md" variant="secondary" onClick={handleAdminMessage} className="flex-shrink-0 justify-center !py-2 text-xs sm:text-sm !bg-blue-50 !text-blue-700 dark:!bg-blue-900/30 dark:!text-blue-300" title="Написать админу">
                                    <ShieldCheckIcon className="w-4 h-4 mr-1 text-blue-600 dark:text-blue-400"/> <span>Админу</span>
                                </Button>
                                <Button size="md" variant="secondary" onClick={handleNewOrder} className="flex-shrink-0 justify-center !py-2 text-xs sm:text-sm !bg-green-50 !text-green-700 hover:!bg-green-100 dark:!bg-green-950/40 dark:!text-green-300" title="Дополнительный комплект">
                                    <DocumentPlusIcon className="w-4 h-4 mr-1 text-green-600 dark:text-green-400"/> <span>+ Комплект</span>
                                </Button>
                                <Button size="md" variant="secondary" onClick={handleArchive} className="flex-shrink-0 justify-center !py-2 text-xs sm:text-sm !bg-orange-50 !text-orange-700 dark:!bg-orange-900/30 dark:!text-orange-300" title="Выдать и архивировать">
                                    <span>В архив</span>
                                </Button>
                                <Button size="md" variant="danger" onClick={handleDelete} className="flex-shrink-0 justify-center px-2.5 !py-2" title="Удалить">
                                    <DeleteIcon className="w-4 h-4"/>
                                </Button>
                            </div>
                        </>
                    )}

                    {mode === 'message' && (
                        <div className="flex w-full gap-3">
                            <Button variant="outline" onClick={() => setMode('view')} disabled={isSubmitting} className="flex-1">Назад</Button>
                            <Button onClick={handleSendMessage} disabled={isSubmitting || (messageTarget === 'client' && !client?.['Chat ID'])} className="flex-1">{isSubmitting ? 'Отправка...' : 'Отправить'}</Button>
                        </div>
                    )}
                </div>
            </div>

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
