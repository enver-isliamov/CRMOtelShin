


import React, { useState, useMemo, useEffect, useCallback, Fragment, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Client, MessageTemplate, ClientEvent, SavedView, formatDateForDisplay } from '../types';
import { api } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Toast } from './ui/Toast';
import { Modal } from './ui/Modal';
import { ImageUpload } from './ui/ImageUpload';
import { PhotoGallery } from './ui/PhotoGallery';
import { OrderHistory } from './ui/Timeline';


// --- ICONS ---
const SearchIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
const PlusIcon: React.FC<{className?: string}> = ({ className="w-5 h-5 -ml-1 mr-2" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const EditIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const MessageIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>;
const DeleteIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const SyncIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18-3.183l-3.182-3.182a8.25 8.25 0 00-11.664 0l-3.18 3.185" /></svg>;
const SortIcon: React.FC<{ direction?: 'ascending' | 'descending' }> = ({ direction }) => {
    if (!direction) return <svg className="w-4 h-4 text-gray-400 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    if (direction === 'ascending') return <svg className="w-4 h-4 text-primary-500 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;
    return <svg className="w-4 h-4 text-primary-500 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
};
const BookmarkIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>;
const XMarkIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const ArchiveIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M.5 3.75A.75.75 0 011.25 3h17.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75h-17.5a.75.75 0 01-.75-.75v-3zM1.25 9h17.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75h-17.5a.75.75 0 01-.75-.75v-3A.75.75 0 011.25 9z" /><path d="M2 15.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" /></svg>;
const DocumentPlusIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;


const getFieldType = (fieldName: string) => {
    const name = fieldName.toLowerCase();
    if (name.includes('дата') || name.includes('начало') || name.includes('окончание') || name.includes('напомнить')) return 'date';
    if (name.includes('цена') || name.includes('кол-во') || name.includes('сумма') || name.includes('долг') || name.includes('срок')) return 'number';
    if (name.includes('телефон')) return 'tel';
    return 'text';
}

const TabButton: React.FC<{active: boolean, onClick: ()=>void, children: React.ReactNode}> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-200 focus:outline-none ${
            active
            ? 'border-primary-500 text-primary-600 dark:text-primary-300'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
    >
        {children}
    </button>
)

const ClientDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  headers: string[];
  templates: MessageTemplate[];
  onSave: (clientData: Partial<Client>) => Promise<void>;
  onDelete: (clientId: string) => Promise<void>;
  onSendMessage: (client: Client, templateContent: string) => Promise<void>;
  refreshData: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
}> = ({ isOpen, onClose, client, headers, templates, onSave, onDelete, onSendMessage, refreshData, showToast }) => {
    
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'photos'>('details');
    const [mode, setMode] = useState<'view' | 'edit' | 'message'>('view');
    const [formData, setFormData] = useState<Partial<Client>>(client);
    const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');
    const [preview, setPreview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        // When the client prop changes (e.g., modal is opened for a new client),
        // reset the form data and view state to ensure the correct information is displayed.
        setFormData(client);
        setActiveTab('details');
        setMode('view');
    }, [client]);

    useEffect(() => {
        if (templates.length > 0 && !selectedTemplateName) {
            setSelectedTemplateName(templates[0]?.['Название шаблона'] || '');
        }
    }, [templates, selectedTemplateName]);

    useEffect(() => {
        const selectedTemplate = templates.find(t => t['Название шаблона'] === selectedTemplateName);
        if (selectedTemplate && formData) {
            let content = selectedTemplate['Содержимое (HTML)'];
            Object.keys(formData).forEach(key => {
                content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(formData[key as keyof Client] || ''));
            });
            setPreview(content);
        }
    }, [selectedTemplateName, templates, formData]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isNumber = type === 'number';
        setFormData(prev => prev ? ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }) : null);
    };

    const handleSave = async () => {
        if (!formData) return;
        setIsSubmitting(true);
        await onSave(formData);
        setIsSubmitting(false);
        setMode('view');
    };

    const handleDelete = async () => {
        if (window.confirm(`Вы уверены, что хотите удалить клиента "${client['Имя клиента']}"?`)) {
            setIsSubmitting(true);
            await onDelete(client.id);
            setIsSubmitting(false);
            // The modal will be closed by the parent component's effect
        }
    };
    
    const handleSendMessage = async () => {
        if (preview) {
            setIsSubmitting(true);
            await onSendMessage(client, preview);
            setIsSubmitting(false);
            setMode('view');
        }
    };

    const handleNewOrder = () => {
        navigate('/add-client', { state: { clientToReorder: client } });
        onClose();
    };
    
    const DetailItem: React.FC<{ label: string; value: React.ReactNode, className?: string }> = ({ label, value, className }) => (
        <div className={className}>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{label}</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">{value || '-'}</dd>
        </div>
    );
    
    const renderContent = () => {
        if (!formData) return null;
        
        if (mode === 'edit') {
            return (
                 <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {headers.filter(h => h !== 'id' && h !== 'photoUrls').map(header => (
                            <Input
                                key={header}
                                label={header}
                                name={header}
                                value={formData[header as keyof Client] || ''}
                                type={getFieldType(header)}
                                onChange={handleChange}
                                required={header === 'Имя клиента'}
                            />
                        ))}
                    </div>
                </form>
            );
        }
        
        if (mode === 'message') {
             return (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="template" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Шаблон</label>
                        <select id="template" value={selectedTemplateName} onChange={e => setSelectedTemplateName(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition duration-150">
                            {templates.map(t => <option key={t['Название шаблона']} value={t['Название шаблона']}>{t['Название шаблона']}</option>)}
                        </select>
                    </div>
                    <div>
                        <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Предпросмотр</h4>
                        <div className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 min-h-[150px] max-h-[30vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: preview.replace(/\n/g, '<br />') }} />
                    </div>
                </div>
            )
        }
        
        return (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                {activeTab === 'details' && (
                    <div className="space-y-6">
                         <div className="grid grid-cols-2 gap-4">
                             <div className={`p-4 rounded-lg ${Number(formData['Долг'] || 0) > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>
                                <p className="text-sm font-medium">Долг</p>
                                <p className="text-xl font-bold">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(formData['Долг'] || 0))}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                <p className="text-sm font-medium">Окончание хранения</p>
                                <p className="text-xl font-bold">{formatDateForDisplay(formData['Окончание'])}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-600">Детали заказа</h4>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                <DetailItem label="Статус сделки" value={formData['Статус сделки']} />
                                <DetailItem label="Номер Авто" value={formData['Номер Авто']} />
                                <DetailItem label="Размер шин" value={formData['Размер шин']} />
                                <DetailItem label="Кол-во шин" value={`${formData['Кол-во шин']} шт.`} />
                                <DetailItem label="Сезон" value={formData['Сезон']} />
                                <DetailItem label="Наличие дисков" value={formData['Наличие дисков']} />
                                <div className="sm:col-span-2">
                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Заказ - QR (Бренд / Марка / Размер)</dt>
                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono bg-gray-100 dark:bg-gray-700/50 p-3 rounded-md">{formData['Заказ - QR'] || '-'}</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-600">Финансы и сроки</h4>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                <DetailItem label="Общая сумма" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(formData['Общая сумма'] || 0))} />
                                <DetailItem label="Цена за месяц" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(formData['Цена за месяц'] || 0))} />
                                <DetailItem label="Договор №" value={formData['Договор']} />
                                <DetailItem label="Срок хранения" value={`${formData['Срок']} мес.`} />
                                <DetailItem label="Начало хранения" value={formatDateForDisplay(formData['Начало'])} />
                                <DetailItem label="Дата напоминания" value={formatDateForDisplay(formData['Напомнить'])} />
                            </dl>
                        </div>
                        
                        <div className="space-y-3">
                            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-600">Контакты и склад</h4>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                <DetailItem label="Телефон" value={formData['Телефон']} />
                                <DetailItem label="Chat ID" value={formData['Chat ID']} />
                                <DetailItem label="Адрес клиента" value={formData['Адрес клиента']} className="sm:col-span-2" />
                                <DetailItem label="Склад хранения" value={formData['Склад хранения']} />
                                <DetailItem label="Ячейка" value={formData['Ячейка']} />
                            </dl>
                        </div>
                    </div>
                )}
                {activeTab === 'history' && <OrderHistory client={client} />}
                {activeTab === 'photos' && <PhotoGallery client={client} refreshClientData={refreshData} showToast={showToast} />}
            </div>
        )
    }

    const renderFooter = () => {
        if (mode === 'edit') {
            return (
                <>
                    <Button variant="outline" onClick={() => setMode('view')} disabled={isSubmitting}>Отмена</Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>{isSubmitting ? 'Сохранение...' : 'Сохранить'}</Button>
                </>
            );
        }
        if (mode === 'message') {
            return (
                <>
                    <Button variant="outline" onClick={() => setMode('view')} disabled={isSubmitting}>Назад</Button>
                    <Button onClick={handleSendMessage} disabled={isSubmitting || templates.length === 0 || !client?.['Chat ID']}>{isSubmitting ? 'Отправка...' : 'Отправить'}</Button>
                </>
            );
        }
        // View mode
        return (
            <div className='flex flex-wrap gap-2 w-full justify-start'>
                <Button size="sm" variant="primary" onClick={() => setMode('edit')}><EditIcon/> <span className="ml-1">Изменить</span></Button>
                <Button size="sm" variant="secondary" onClick={handleNewOrder} className="!bg-green-100 !text-green-800 hover:!bg-green-200 dark:!bg-green-800/40 dark:!text-green-200 dark:hover:!bg-green-800/60"><DocumentPlusIcon className="h-4 w-4"/> <span className="ml-1">Новый заказ</span></Button>
                <Button size="sm" variant="secondary" onClick={() => setMode('message')}><MessageIcon/> <span className="ml-1">Сообщение</span></Button>
                <div className="flex-grow"></div>
                <Button size="sm" variant="danger" onClick={handleDelete} disabled={isSubmitting}><DeleteIcon/> <span className="ml-1">Удалить</span></Button>
            </div>
        )
    }

    return (
        <Modal 
            isOpen={isOpen}
            onClose={onClose}
            title={formData?.['Имя клиента'] || 'Карточка клиента'}
            footer={<div className="flex justify-end w-full space-x-2">{renderFooter()}</div>}
        >
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Детали</TabButton>
                    <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>История заказов</TabButton>
                    <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')}>Фото</TabButton>
                </nav>
            </div>
            {renderContent()}
        </Modal>
    );
};

const FilterBadge: React.FC<{text: string; onRemove: () => void}> = ({ text, onRemove }) => (
  <span className="inline-flex items-center gap-x-1.5 bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-800/30 dark:text-blue-200 rounded-full">
    {text}
    <button
        type="button"
        onClick={onRemove}
        className="group relative -mr-0.5 h-3.5 w-3.5 rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-500/30"
    >
        <span className="sr-only">Remove</span>
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 stroke-blue-600/50 group-hover:stroke-blue-600/75 dark:stroke-blue-400/50 dark:group-hover:stroke-blue-400">
            <path d="M4 4l6 6m0-6l-6 6" />
        </svg>
    </button>
  </span>
);


export const ClientsView: React.FC<{
    clients: Client[];
    headers: string[];
    templates: MessageTemplate[];
    savedViews: SavedView[];
    onSaveViews: (views: SavedView[]) => void;
    refreshData: () => Promise<void>;
}> = ({ clients, headers, templates, savedViews, onSaveViews, refreshData }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    warehouse: 'all',
    debt: searchParams.get('filter') === 'debt',
  });
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'ascending' | 'descending' } | null>({ key: 'Начало', direction: 'descending' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  
  const mainColumns = ['Имя клиента', 'Телефон', 'Номер Авто', 'Окончание', 'Долг', 'Статус сделки'];
  
  const filterOptions = useMemo(() => {
    const statuses = new Set(clients.map(c => c['Статус сделки']).filter(Boolean));
    const warehouses = new Set(clients.map(c => c['Склад хранения']).filter(Boolean));
    return {
      statuses: Array.from(statuses),
      warehouses: Array.from(warehouses),
    };
  }, [clients]);
  
  const sortedClients = useMemo(() => {
    let clientsToFilter = [...clients];

    if (filters.debt) {
        clientsToFilter = clientsToFilter.filter(client => (client['Долг'] || 0) > 0);
    }
    if (filters.status !== 'all') {
      clientsToFilter = clientsToFilter.filter(c => c['Статус сделки'] === filters.status);
    }
    if (filters.warehouse !== 'all') {
      clientsToFilter = clientsToFilter.filter(c => c['Склад хранения'] === filters.warehouse);
    }
    
    if (searchTerm) {
        clientsToFilter = clientsToFilter.filter(client =>
            Object.values(client).some(value =>
                String(value).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }
    
    if (sortConfig !== null) {
        clientsToFilter.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            
            const type = getFieldType(sortConfig.key);

            let compareA = valA, compareB = valB;

            if (type === 'date') {
                compareA = valA ? new Date(valA as string).getTime() : 0;
                compareB = valB ? new Date(valB as string).getTime() : 0;
            }

            if (compareA === undefined || compareA === null) return 1;
            if (compareB === undefined || compareB === null) return -1;
            
            if (compareA < compareB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (compareA > compareB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }

    return clientsToFilter;
  }, [clients, searchTerm, filters, sortConfig]);

  const openModal = (client: Client) => {
    setSelectedClient(client);
    setModalOpen(true);
  };
  
  const closeModal = useCallback(() => {
      setModalOpen(false);
      setSelectedClient(null);
  }, []);
  
  // Effect to auto-close modal if the selected client disappears from the list after a data refresh
  useEffect(() => {
    if (selectedClient && !clients.some(c => c.id === selectedClient.id)) {
      closeModal();
    }
  }, [clients, selectedClient, closeModal]);

  useEffect(() => {
    // Sync filters with URL params on mount
    const debtFilter = searchParams.get('filter') === 'debt';
    if(debtFilter) {
        setFilters(prev => ({...prev, debt: true}));
    }
  }, [searchParams]);

  const handleFilterChange = (type: 'status' | 'warehouse', value: string) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const removeFilter = (type: keyof typeof filters) => {
    if (type === 'debt') {
      setFilters(prev => ({...prev, debt: false}));
      setSearchParams(params => {
        params.delete('filter');
        return params;
      });
    } else {
      setFilters(prev => ({ ...prev, [type]: 'all' }));
    }
  }

  const requestSort = (key: string) => {
      let direction: 'ascending' | 'descending' = 'ascending';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
      }
      setSortConfig({ key, direction });
  };
  
  const getSortDirection = (key: string) => {
      if (!sortConfig || sortConfig.key !== key) return undefined;
      return sortConfig.direction;
  }

  const handleRowClick = (client: Client, e: React.MouseEvent) => {
    // Prevent opening modal if a link inside the row was clicked
    if ((e.target as HTMLElement).closest('a')) return;
    openModal(client);
  };
  
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleSaveClient = async (clientData: Partial<Client>) => {
    try {
        if (clientData.id) {
            await api.updateClient(clientData as Client);
            showToast('Клиент успешно обновлен', 'success');
        }
        await refreshData();
    } catch (e: any) {
        showToast(e.message || 'Ошибка при сохранении клиента', 'error');
    }
  };

  const handleDeleteClient = async (clientId: string) => {
      try {
          await api.deleteClient(clientId);
          showToast('Клиент удален', 'success');
          await refreshData();
      } catch(e: any) {
          showToast(e.message || 'Ошибка при удалении клиента', 'error');
      }
  };
  
  const handleSendMessage = async (client: Client, messageContent: string) => {
      if (!client) return;
      const result = await api.sendMessage(client['Chat ID'] as string, messageContent);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        await refreshData();
      }
  }

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refreshData();
      showToast('Данные синхронизированы', 'success');
    } catch(e: any) {
      showToast(`Ошибка синхронизации: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }

  const handleSaveView = () => {
    if (!newViewName) {
        showToast("Введите имя для нового представления", 'error');
        return;
    }
    const newView: SavedView = {
        id: `view_${Date.now()}`,
        name: newViewName,
        filters,
        sortConfig
    };
    onSaveViews([...savedViews, newView]);
    setNewViewName('');
    showToast(`Представление "${newViewName}" сохранено`, 'success');
  };

  const handleLoadView = (viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    if (view) {
        setFilters(view.filters);
        setSortConfig(view.sortConfig);
        showToast(`Загружено представление: ${view.name}`, 'success');
    }
  };

  const handleDeleteView = (viewId: string) => {
    onSaveViews(savedViews.filter(v => v.id !== viewId));
    showToast('Представление удалено', 'success');
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Card>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="w-full sm:flex-1">
                 <Input
                    placeholder="Поиск по клиентам..."
                    value={searchTerm}
                    icon={<SearchIcon/>}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
                 <Button onClick={handleSync} variant="outline" title="Синхронизировать" className="!p-2.5 aspect-square" disabled={isSyncing}>
                    <SyncIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>
                <Link to="/add-client">
                    <Button>
                        <PlusIcon />
                        Добавить клиента
                    </Button>
                </Link>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-grow">
              <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="w-full sm:w-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500">
                  <option value="all">Все статусы</option>
                  {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filters.warehouse} onChange={e => handleFilterChange('warehouse', e.target.value)} className="w-full sm:w-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500">
                  <option value="all">Все склады</option>
                  {filterOptions.warehouses.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            {/* Saved Views */}
            <div className="flex flex-col sm:flex-row gap-2 items-center border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 border-gray-200 dark:border-gray-700">
                <Input value={newViewName} onChange={(e) => setNewViewName(e.target.value)} placeholder="Имя нового вида" className="h-10"/>
                <Button onClick={handleSaveView} variant="outline" className="h-10 w-full sm:w-auto" title="Сохранить текущие фильтры и сортировку"><BookmarkIcon className="h-5 w-5"/></Button>
            </div>
          </div>
        </div>
        
         <div className="mt-4 flex flex-wrap gap-2 items-center">
            {filters.debt && <FilterBadge text="С долгом" onRemove={() => removeFilter('debt')} />}
            {filters.status !== 'all' && <FilterBadge text={`Статус: ${filters.status}`} onRemove={() => removeFilter('status')} />}
            {filters.warehouse !== 'all' && <FilterBadge text={`Склад: ${filters.warehouse}`} onRemove={() => removeFilter('warehouse')} />}
            
            {savedViews.length > 0 && <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>}
            {savedViews.map(view => (
                <span key={view.id} className="group inline-flex items-center gap-x-0.5 bg-gray-100 pl-2 pr-1 py-1 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                    <button onClick={() => handleLoadView(view.id)} className="group-hover:underline">{view.name}</button>
                    <button type="button" onClick={() => handleDeleteView(view.id)} className="group relative h-4 w-4 rounded-full hover:bg-red-200/60 dark:hover:bg-red-500/30">
                        <XMarkIcon className="h-4 w-4 stroke-gray-500/50 group-hover:stroke-red-600/75 dark:stroke-gray-400/50 dark:group-hover:stroke-red-400"/>
                    </button>
                </span>
            ))}
        </div>
      </Card>
      
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        {mainColumns.map(header => (
                            <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestSort(header)}>
                                <span className="flex items-center">
                                    {header}
                                    <SortIcon direction={getSortDirection(header)} />
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800/20 divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedClients.map(client => (
                        <tr key={client.id} onClick={(e) => handleRowClick(client, e)} className="transition-colors duration-150 hover:bg-gray-100/50 dark:hover:bg-gray-700/40 cursor-pointer">
                            {mainColumns.map(header => {
                                const value = client[header as keyof Client];
                                const isDebt = header === 'Долг';
                                return (
                                <td key={`${client.id}-${header}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                                  <div className={` ${isDebt && Number(value) > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                                    {header === 'Окончание' ? formatDateForDisplay(value as string) : (isDebt && typeof value === 'number' ? new Intl.NumberFormat('ru-RU', {style:'currency', currency: 'RUB'}).format(value) : String(value || '-'))}
                                  </div>
                                </td>
                            )})}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {sortedClients.length === 0 && (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <SearchIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Клиенты не найдены</h3>
                <p className="mt-1 text-sm text-gray-500">Попробуйте изменить условия поиска или фильтры.</p>
            </div>
        )}
      </Card>
      
      {isModalOpen && selectedClient && <ClientDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        client={selectedClient}
        headers={headers}
        templates={templates}
        onSave={handleSaveClient}
        onDelete={handleDeleteClient}
        onSendMessage={handleSendMessage}
        refreshData={refreshData}
        showToast={showToast}
      />}
    </div>
  );
};