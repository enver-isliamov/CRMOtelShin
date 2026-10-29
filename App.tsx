
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Client, Settings as SettingsType, MessageTemplate, Master, SavedView, UserRole } from './types';
import { api } from './services/api';

// Components
import { Dashboard } from './components/Dashboard';
import { ClientsView } from './components/ClientsView';
import { ClientDetailsPage } from './components/ClientDetailsPage';
import { AddClient } from './components/AddClient';
import { Settings } from './components/Settings';
import { MastersView } from './components/MastersView';
import { Chat } from './components/Chat';
import TelegramLK from './components/TelegramLK';
import { ToastContainer, ToastMessage } from './components/ui/Toast';
import { ThemeSwitcher } from './components/ui/ThemeSwitcher';
import { ErrorBoundary } from './components/ErrorBoundary';

// Icons
import { 
    HomeIcon, 
    UserGroupIcon as UsersIcon, 
    PlusIcon, 
    CogIcon, 
    MasterIcon, 
    ChatIcon 
} from './components/icons/Icons';

function Layout({ children, isLoading, onRefresh }: { children?: React.ReactNode, isLoading: boolean, onRefresh: () => void }) {
    const location = useLocation();
    const isTGLK = location.pathname === '/tg-lk';

    if (isTGLK) return <>{children}</>;

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950 md:flex-row">
            {/* Sidebar-style Navigation (Mobile Bottom Bar + Desktop Sidebar) */}
            <nav className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 px-1 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex justify-around md:flex-col md:w-20 md:justify-start md:border-t-0 md:border-r md:pt-8 md:gap-8 z-50 order-last md:order-first shrink-0 shadow-lg md:shadow-none">
                <NavLink to="/" icon={<HomeIcon className="w-5 h-5 md:w-6 md:h-6" />} label="Главная" active={location.pathname === '/'} />
                <NavLink to="/clients" icon={<UsersIcon className="w-5 h-5 md:w-6 md:h-6" />} label="Клиенты" active={location.pathname === '/clients'} />
                <NavLink to="/chat" icon={<ChatIcon className="w-5 h-5 md:w-6 md:h-6" />} label="Чат" active={location.pathname === '/chat'} />
                <NavLink to="/add-client" icon={<PlusIcon className="w-5 h-5 md:w-6 md:h-6" />} label="Заказ" active={location.pathname === '/add-client'} />
                <NavLink to="/masters" icon={<MasterIcon className="w-5 h-5 md:w-6 md:h-6" />} label="Мастера" active={location.pathname === '/masters'} />
                <NavLink to="/settings" icon={<CogIcon className="w-5 h-5 md:w-6 md:h-6" />} label="Опции" active={location.pathname === '/settings'} />
            </nav>

            <div className="flex-1 overflow-y-auto flex flex-col">
                <header className="flex bg-white dark:bg-gray-900 h-16 border-b border-gray-200 dark:border-gray-800 items-center justify-between px-4 md:px-8 shrink-0">
                    <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tight truncate mr-2">Crm-OtelShun.ru</h2>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button 
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="flex items-center justify-center w-10 h-10 md:w-auto md:px-3 md:py-1.5 md:gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                            title="Обновить данные"
                        >
                            <svg className={`w-5 h-5 md:w-4 md:h-4 ${isLoading ? 'animate-spin text-primary-600 dark:text-primary-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="hidden md:inline">{isLoading ? 'Обновление...' : 'Обновить'}</span>
                        </button>
                        <ThemeSwitcher />
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto relative">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavLink({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) {
    return (
        <Link to={to} className={`flex flex-col items-center justify-center min-w-[44px] py-1 px-1.5 sm:px-2 rounded-xl transition-all duration-200 active:scale-95 ${active ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 shadow-xs' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-wide mt-0.5">{label}</span>
        </Link>
    );
}

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [archive, setArchive] = useState<Client[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsType>({ adminIds: '', managerIds: '', googleSheetId: '', sheetName: '', apiMode: 'VERCEL' });
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    const saved = localStorage.getItem('crm_saved_views');
    return saved ? JSON.parse(saved) : [];
  });

  const addToast = (message: string, type: 'success' | 'error') => {
    setToasts(prev => [...prev, { id: Date.now().toString(), message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchData = useCallback(async (isBackground: boolean = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const [clientData, settingsData, templatesData, mastersData] = await Promise.all([
        api.fetchClients(),
        api.fetchSettings(),
        api.fetchTemplates(),
        api.fetchMasters()
      ]);
      
      setClients(clientData.clients);
      setArchive(clientData.archive);
      setHeaders(clientData.headers);
      setSettings(settingsData);
      setTemplates(templatesData);
      setMasters(mastersData);
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveViews = (views: SavedView[]) => {
    setSavedViews(views);
    localStorage.setItem('crm_saved_views', JSON.stringify(views));
  };

  return (
    <BrowserRouter>
      <Layout isLoading={isLoading} onRefresh={() => fetchData(false)}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard clients={clients} archive={archive} templates={templates} />} />
            <Route path="/clients" element={<ClientsView clients={clients} headers={headers} templates={templates} savedViews={savedViews} onSaveViews={handleSaveViews} refreshData={fetchData} />} />
            <Route path="/clients/:id" element={<ClientDetailsPage clients={clients} headers={headers} templates={templates} refreshData={fetchData} settings={settings} />} />
            <Route path="/chat" element={<Chat clients={clients} />} />
            <Route path="/add-client" element={
              <ErrorBoundary fallbackTitle="Ошибка формы добавления заказа">
                <AddClient settings={settings} onClientAdd={() => fetchData(true)} showToast={addToast} />
              </ErrorBoundary>
            } />
            <Route path="/masters" element={<MastersView masters={masters} setMasters={setMasters} clients={clients} />} />
            <Route path="/settings" element={<Settings initialSettings={settings} initialTemplates={templates} initialMasters={masters} clients={clients} onSave={fetchData} needsSetup={!settings.googleSheetId && settings.apiMode === 'GAS'} />} />
            <Route path="/tg-lk" element={<TelegramLK />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </BrowserRouter>
  );
}
