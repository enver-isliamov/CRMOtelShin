
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
const PlusIcon: React.FC<{className?: string}> = ({ className="w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const EditIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const MessageIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>;
const DeleteIcon: React.FC<{className?: string}> = ({ className="h-4 w-4" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const SyncIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18-3.183l-3.182-3.182a8.25 8.25 0 00-11.664 0l-3.18 3.185" /></svg>;
const SortIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" /></svg>;
const BookmarkIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>;
const XMarkIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const DocumentPlusIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
const FilterIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>;

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
            <dd className="mt-1 text-sm text-gray-900 dark:text-white break-words">{value || '-'}</dd>
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
                         <div className="grid grid-cols-2 gap-3">
                             <div className={`p-4 rounded-lg ${Number(formData['Долг'] || 0) > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>
                                <p className="text-xs sm:text-sm font-medium">Долг</p>
                                <p className="text-lg sm:text-xl font-bold">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(formData['Долг'] || 0))}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                <p className="text-xs sm:text-sm font-medium">Окончание</p>
                                <p className="text-lg sm:text-xl font-bold">{formatDateForDisplay(formData['Окончание'])}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-600">Детали заказа</h4>
                            {/* Force grid-cols-2 even on mobile as requested */}
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
                                <DetailItem label="Статус" value={formData['Статус сделки']} />
                                <DetailItem label="Склад / Ячейка" value={`${formData['Склад хранения']} / ${formData['Ячейка']}`} />
                                <DetailItem label="Размер шин" value={formData['Размер шин']} />
                                <DetailItem label="Сезон" value={formData['Сезон']} />
                                <DetailItem label="Кол-во" value={`${formData['Кол-во шин']} шт.`} />
                                <DetailItem label="Диски" value={formData['Наличие дисков']} />
                                <DetailItem label="DOT-код" value={formData['DOT-код']} />
                                
                                <DetailItem label="Заказ - QR (Бренд / Марка)" value={formData['Заказ - QR']} className="col-span-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md font-mono text-xs" />
                            </dl>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-600">Финансы и сроки</h4>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
                                <DetailItem label="Сумма" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(formData['Общая сумма'] || 0))} />
                                <DetailItem label="Цена/мес" value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(formData['Цена за месяц'] || 0))} />
                                <DetailItem label="Договор" value={formData['Договор']} />
                                <DetailItem label="Срок" value={`${formData['Срок']} мес.`} />
                                <DetailItem label="Начало" value={formatDateForDisplay(formData['Начало'])} />
                                <DetailItem label="Напомнить" value={formatDateForDisplay(formData['Напомнить'])} />
                            </dl>
                        </div>
                        
                        <div className="space-y-3">
                            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-600">Контакты</h4>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
                                <DetailItem label="Chat ID" value={formData['Chat ID']} className="col-span-2" />
                                <DetailItem label="Адрес клиента" value={formData['Адрес клиента']} className="col-span-2" />
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

    const modalTitleNode = (
        <div className="flex flex-col">
            <span className="text-xl font-bold leading-tight">{formData?.['Имя клиента']}</span>
            <div className="flex flex-wrap items-center gap-2 mt-1">
                 {formData?.['Номер Авто'] && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono">
                        {formData['Номер Авто']}
                    </span>
                 )}
                 {formData?.['Телефон'] && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formData['Телефон']}
                    </span>
                 )}
            </div>
        </div>
    );

    return (
        <Modal 
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitleNode}
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
  <span className="inline-flex items-center gap-x-1.5 bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-800/30 dark:text-blue-200 rounded-full whitespace-nowrap">
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
  const [showFilters, setShowFilters] = useState(false);
  
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

  const handleSortChange = (key: string) => {
      setSortConfig(prev => {
          if (prev && prev.key === key) {
              // Toggle direction if clicking the same key
              return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
          }
          // Default to descending for dates, ascending for text
          const isDate = key.includes('Дата') || key.includes('Окончание') || key.includes('Начало');
          return { key, direction: isDate ? 'descending' : 'ascending' };
      });
  };

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
  
  const isFiltersActive = filters.status !== 'all' || filters.warehouse !== 'all' || filters.debt;


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* COMPACT HEADER / FILTER BAR */}
      <Card className="!p-3 sm:!p-4">
        <div className="flex flex-col gap-3">
          {/* Top Row: Search + Actions */}
          <div className="flex gap-2 w-full">
            <div className="relative flex-grow">
               <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <SearchIcon className="h-5 w-5"/>
               </div>
               <input 
                  type="text"
                  placeholder="Поиск..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 pl-10 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-150 h-[42px]"
               />
            </div>
            
            <button 
                onClick={handleSync} 
                disabled={isSyncing}
                className="flex items-center justify-center w-[42px] h-[42px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-primary-500 transition-colors"
                title="Синхронизировать"
            >
                <SyncIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center w-[42px] h-[42px] rounded-md border ${isFiltersActive ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'} focus:ring-2 focus:ring-primary-500 transition-all`}
                title="Фильтры и Сортировка"
            >
                <FilterIcon className="w-5 h-5"/>
            </button>

            <Link to="/add-client" className="flex-shrink-0">
                <Button className="h-[42px] w-[42px] sm:w-auto !p-0 sm:!px-4 flex items-center justify-center">
                    <PlusIcon />
                    <span className="hidden sm:inline ml-1">Добавить</span>
                </Button>
            </Link>
          </div>

          {/* Collapsible Filter Panel */}
          {showFilters && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-200">
               <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Сортировка</label>
                  <select value={sortConfig?.key || ''} onChange={e => handleSortChange(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                      <option value="Начало">По дате (новые)</option>
                      <option value="Имя клиента">По имени (А-Я)</option>
                      <option value="Окончание">По окончанию</option>
                      <option value="Долг">По долгу</option>
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Статус</label>
                  <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                      <option value="all">Все статусы</option>
                      {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               </div>
               <div>
                   <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Склад</label>
                   <select value={filters.warehouse} onChange={e => handleFilterChange('warehouse', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                      <option value="all">Все склады</option>
                      {filterOptions.warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                   </select>
               </div>
               <div className="flex items-end gap-2">
                   <div className="flex-grow">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Сохранить вид</label>
                        <input 
                            type="text" 
                            value={newViewName} 
                            onChange={(e) => setNewViewName(e.target.value)} 
                            placeholder="Название..." 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
                   </div>
                   <Button variant="outline" onClick={handleSaveView} className="h-[34px] !px-3" title="Сохранить текущие фильтры">
                        <BookmarkIcon className="h-4 w-4"/>
                   </Button>
               </div>
            </div>
          )}
          
          {/* Active Filters & Saved Views Chips (Horizontal Scroll) */}
          {(isFiltersActive || savedViews.length > 0) && (
             <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {/* Active Filter Chips */}
                {filters.debt && <FilterBadge text="С долгом" onRemove={() => removeFilter('debt')} />}
                {filters.status !== 'all' && <FilterBadge text={filters.status} onRemove={() => removeFilter('status')} />}
                {filters.warehouse !== 'all' && <FilterBadge text={filters.warehouse} onRemove={() => removeFilter('warehouse')} />}
                
                {isFiltersActive && savedViews.length > 0 && <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 flex-shrink-0 mx-1"></div>}
                
                {/* Saved Views Chips */}
                {savedViews.map(view => (
                    <span key={view.id} className="inline-flex flex-shrink-0 items-center gap-x-1 bg-gray-100 pl-2.5 pr-1 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-full border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        <button onClick={() => handleLoadView(view.id)}>{view.name}</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }} className="p-0.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-400 hover:text-red-500">
                            <XMarkIcon className="h-3 w-3"/>
                        </button>
                    </span>
                ))}
             </div>
          )}
        </div>
      </Card>
      
      {/* Client List */}
      <Card className="!p-0 overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedClients.map(client => (
                <div 
                    key={client.id} 
                    onClick={(e) => handleRowClick(client, e)} 
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                             <span className="font-semibold text-gray-900 dark:text-white text-base truncate">
                                {client['Имя клиента']}
                             </span>
                             {(client['Долг'] || 0) > 0 && (
                                <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm ring-1 ring-red-400/50" title="Есть задолженность"></span>
                             )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                             <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {client['Номер Авто'] || 'Нет авто'}
                             </span>
                             {client['Телефон'] && (
                                <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="whitespace-nowrap">{client['Телефон']}</span>
                                </>
                             )}
                        </div>
                    </div>

                    <div className="text-right flex flex-col gap-1 flex-shrink-0">
                         <span className="text-sm text-gray-600 dark:text-gray-300">
                             {formatDateForDisplay(client['Окончание'])}
                         </span>
                         <span className={`font-bold text-sm ${
                             (client['Долг'] || 0) > 0 
                             ? 'text-red-600 dark:text-red-400' 
                             : 'text-gray-900 dark:text-white'
                         }`}>
                             {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(client['Долг'] || 0)}
                         </span>
                    </div>
                </div>
            ))}
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
