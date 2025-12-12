
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Client, MessageTemplate, TireGroup, formatDateForDisplay, Settings } from '../types';
import { api } from '../services/api';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { PhotoGallery } from './ui/PhotoGallery';
import { OrderHistory } from './ui/Timeline';

// --- ICONS ---
const ArrowLeftIcon: React.FC<{className?: string}> = ({ className="w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>;
const EditIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const MessageIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>;
const DeleteIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const DocumentPlusIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
const ReceiptIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
const ShieldCheckIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;

// Section Icons
const TireIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z" clipRule="evenodd" /></svg>;
const CashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M1 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H2a1 1 0 01-1-1V4zm12 4a3 3 0 11-6 0 3 3 0 016 0zM4 9a1 1 0 100-2 1 1 0 000 2zm13-1a1 1 0 11-2 0 1 1 0 012 0zM1.75 14.5a.75.75 0 000 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 00-1.5 0v.784a.25.25 0 01-.35.216C11.536 15.583 7.772 15 4.25 15h-.75A1.5 1.5 0 002 16.5v.75a.75.75 0 001.5 0v-.75a.25.25 0 01.25-.25h.75c4.363 0 8.514.836 12.25 2.302a.75.75 0 00.55-1.396 35.808 35.808 0 00-14.73-2.003.75.75 0 00-.82.647z" clipRule="evenodd" /></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.25 1.25 0 002.228-1.417a6.002 6.002 0 019.614 0a1.25 1.25 0 002.228 1.417a8.502 8.502 0 00-14.07 0z" /></svg>;

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

    useEffect(() => {
        // PRIORITY 1: Check if client object was passed in navigation state
        if (location.state?.client) {
            setClient(location.state.client);
            return;
        }

        // PRIORITY 2: Fallback to ID lookup (e.g. on direct link or reload)
        if (!id) return;
        const foundClient = clients.find(c => String(c.id) === String(id));
        setClient(foundClient);
    }, [id, clients, location.state]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    // Template Logic
    useEffect(() => {
        if (mode === 'message' && messageTarget === 'client' && templates.length > 0 && !selectedTemplateName && preview === '') {
            setSelectedTemplateName(templates[0]?.['Название шаблона'] || '');
        }
    }, [templates, selectedTemplateName, mode, preview, messageTarget]);

    useEffect(() => {
        if (selectedTemplateName && client && messageTarget === 'client') {
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
    }, [selectedTemplateName, templates, client, messageTarget]);

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
        const groups = getTireGroups(client);
        let tiresText = '';
        if (groups.length > 0) {
            tiresText = groups.map(g => `${g.count}шт ${g.brand} ${g.model} ${g.width}/${g.profile}R${g.diameter}`).join('\n');
        } else {
            tiresText = (client['Заказ - QR'] || '').split('||JSON:')[0];
        }
        
        const summary = `
<b>👤 Информация о клиенте</b>

Клиент: <b>${client['Имя клиента']}</b>
Авто: <b>${client['Номер Авто']}</b>
Тел: <code>${client['Телефон']}</code>

Договор: ${client['Договор']}
Склад: ${client['Склад хранения']} / ${client['Ячейка']}
Срок: до ${formatDateForDisplay(client['Окончание'])}

📦 Шины:
${tiresText}

💰 Долг: ${client['Долг']} ₽
`.trim().replace(/\n/g, '<br/>');

        setPreview(summary);
        setSelectedTemplateName('');
        setMessageTarget('admin');
        setMode('message');
    }

    const handleClientMessage = () => {
        setMessageTarget('client');
        setMode('message');
        setPreview(''); // Will trigger template effect
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

    const descClean = (client['Заказ - QR'] || '').split('||JSON:')[0];

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-950">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
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
                                {messageTarget === 'client' && (
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
                                )}
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
                            <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')}>Фото</TabButton>
                        </div>

                        {activeTab === 'details' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                {/* Key Metrics Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                     <div className={`p-4 rounded-xl border ${Number(client['Долг'] || 0) > 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-800' : 'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-800'}`}>
                                        <p className={`text-xs font-bold uppercase tracking-wider ${Number(client['Долг'] || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>Долг</p>
                                        <p className={`text-xl sm:text-2xl font-black mt-1 ${Number(client['Долг'] || 0) > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(client['Долг'] || 0))}
                                        </p>
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

                                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-4">
                                    <h4 className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase mb-2">Заметки</h4>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap">{descClean || 'Нет описания'}</p>
                                </div>

                                <SectionBlock title="Финансы" icon={<CashIcon/>}>
                                     <DetailItem label="Общая сумма" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(client['Общая сумма'] || 0))} className="col-span-1 sm:col-span-1" />
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
            <div className="sticky bottom-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-3 sm:p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] safe-area-inset-bottom">
                <div className="max-w-4xl mx-auto flex flex-wrap gap-2 justify-between items-center">
                    
                    {mode === 'view' && (
                        <>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button size="md" variant="secondary" onClick={handleEditClient} className="flex-1 sm:flex-none justify-center">
                                    <EditIcon/> <span className="ml-1">Изм.</span>
                                </Button>
                                {/* SMS Button */}
                                <Button size="md" variant="secondary" onClick={handleClientMessage} className="flex-1 sm:flex-none justify-center" title="Написать клиенту">
                                    <MessageIcon/> <span className="ml-1">SMS</span>
                                </Button>
                                {/* Admin Button */}
                                <Button size="md" variant="secondary" onClick={handleAdminMessage} className="flex-1 sm:flex-none justify-center !bg-blue-50 !text-blue-600 dark:!bg-blue-900/30 dark:!text-blue-300" title="Написать админу">
                                    <ShieldCheckIcon className="w-5 h-5"/> <span className="ml-1">Админу</span>
                                </Button>
                                <Button size="md" variant="secondary" onClick={handleGenerateReceipt} className="flex-1 sm:flex-none justify-center !bg-indigo-50 !text-indigo-600 dark:!bg-indigo-900/30 dark:!text-indigo-300" title="Чек">
                                    <ReceiptIcon className="w-5 h-5"/>
                                </Button>
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <Button size="md" variant="primary" onClick={handleNewOrder} className="flex-1 sm:flex-none justify-center !bg-green-600 hover:!bg-green-700">
                                    <DocumentPlusIcon className="w-5 h-5 mr-1"/> Новый заказ
                                </Button>
                                <Button size="md" variant="danger" onClick={handleDelete} className="justify-center px-3">
                                    <DeleteIcon/>
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
        </div>
    );
};
