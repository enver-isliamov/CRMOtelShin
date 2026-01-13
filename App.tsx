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
import TelegramLK from './components/TelegramLK';
import { ToastContainer, ToastMessage } from './components/ui/Toast';
import { ThemeSwitcher } from './components/ui/ThemeSwitcher';

// Icons
const HomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const CogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const MasterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;

function Layout({ children }: { children?: React.ReactNode }) {
    const location = useLocation();
    const isTGLK = location.pathname === '/tg-lk';

    if (isTGLK) return <>{children}</>;

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950 md:flex-row">
            {/* Sidebar-style Navigation */}
            <nav className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-2 flex justify-around md:flex-col md:w-20 md:justify-start md:border-t-0 md:border-r md:pt-8 md:gap-8 z-50 order-last md:order-first">
                <NavLink to="/" icon={<HomeIcon />} label="Главная" active={location.pathname === '/'} />
                <NavLink to="/clients" icon={<UsersIcon />} label="Клиенты" active={location.pathname === '/clients'} />
                <NavLink to="/add-client" icon={<PlusIcon />} label="Заказ" active={location.pathname === '/add-client'} />
                <NavLink to="/masters" icon={<MasterIcon />} label="Мастера" active={location.pathname === '/masters'} />
                <NavLink to="/settings" icon={<CogIcon />} label="Опции" active={location.pathname === '/settings'} />
            </nav>

            <div className="flex-1 overflow-y-auto">
                <header className="hidden md:flex bg-white dark:bg-gray-900 h-16 border-b border-gray-200 dark:border-gray-800 items-center justify-between px-8">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">Crm-OtelShun.ru</h2>
                    <ThemeSwitcher />
                </header>
                {children}
            </div>
        </div>
    );
}

function NavLink({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) {
    return (
        <Link to={to} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 ${active ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
        </Link>
    );
}

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [archive, setArchive] = useState<Client[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsType>({ adminIds: '', managerIds: '', googleSheetId: '', sheetName: '', apiMode: 'GAS' });
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    const saved = localStorage.getItem('crm_saved_views');
    return saved ? JSON.parse(saved) : [];
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addToast = (message: string, type: 'success' | 'error') => {
    setToasts(prev => [...prev, { id: Date.now().toString(), message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleSaveViews = (views: SavedView[]) => {
    setSavedViews(views);
    localStorage.setItem('crm_saved_views', JSON.stringify(views));
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 dark:bg-gray-950">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 font-medium">Загрузка CRM...</p>
        </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard clients={clients} archive={archive} templates={templates} />} />
          <Route path="/clients" element={<ClientsView clients={clients} headers={headers} templates={templates} savedViews={savedViews} onSaveViews={handleSaveViews} refreshData={fetchData} />} />
          <Route path="/clients/:id" element={<ClientDetailsPage clients={clients} headers={headers} templates={templates} refreshData={fetchData} settings={settings} />} />
          <Route path="/add-client" element={<AddClient settings={settings} onClientAdd={fetchData} />} />
          <Route path="/masters" element={<MastersView masters={masters} setMasters={setMasters} clients={clients} />} />
          <Route path="/settings" element={<Settings initialSettings={settings} initialTemplates={templates} initialMasters={masters} clients={clients} onSave={fetchData} needsSetup={!settings.googleSheetId && settings.apiMode === 'GAS'} />} />
          <Route path="/tg-lk" element={<TelegramLK />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </BrowserRouter>
  );
}