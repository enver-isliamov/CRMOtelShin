import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole, Client, Master, Settings as SettingsType, MessageTemplate, SavedView } from './types';
import { api } from './services/api';
import { Dashboard } from './components/Dashboard';
import { ClientsView } from './components/ClientsView';
import { ClientDetailsPage } from './components/ClientDetailsPage';
import { MastersView } from './components/MastersView';
import { AddClient } from './components/AddClient';
import { Settings } from './components/Settings';
import { TelegramLK } from './components/TelegramLK';
import { ToastContainer, ToastMessage } from './components/ui/Toast';
import { ThemeSwitcher } from './components/ui/ThemeSwitcher';

const Layout: React.FC<{ user: User | null, onLogout: () => void, children: React.ReactNode, navDisabled?: boolean }> = ({ user, onLogout, children, navDisabled }) => {
  const location = useLocation();
  const isTg = location.pathname === '/tg-lk';

  if (isTg) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-xl font-bold text-primary-600 dark:text-primary-400">CRM ОтельШин</Link>
              </div>
              {!navDisabled && (
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link to="/" className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Дашборд</Link>
                  <Link to="/clients" className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Клиенты</Link>
                  <Link to="/masters" className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Мастера</Link>
                  <Link to="/add-client" className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">Новый заказ</Link>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
              {!navDisabled && <Link to="/settings" className="p-2 text-gray-400 hover:text-gray-500"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></Link>}
              {user && <button onClick={onLogout} className="text-sm font-medium text-gray-500 hover:text-gray-700">Выйти</button>}
            </div>
          </div>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [archive, setArchive] = useState<Client[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [masters, setMasters] = useState<Master[]>([]);
    const [settings, setSettings] = useState<SettingsType>({ adminIds: '', managerIds: '', googleSheetId: '', sheetName: '', apiMode: 'GAS' });
    const [user, setUser] = useState<User | null>(() => {
        const saved = sessionStorage.getItem('user');
        return saved ? JSON.parse(saved) : { username: 'Admin', role: UserRole.Admin };
    });
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [savedViews, setSavedViews] = useState<SavedView[]>([]);

    const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToasts(prev => [...prev, { id: Date.now().toString(), message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const refreshData = useCallback(async () => {
        try {
            const [clientData, templateData, masterData, settingsData] = await Promise.all([
                api.fetchClients(),
                api.fetchTemplates(),
                api.fetchMasters(),
                api.fetchSettings()
            ]);
            setClients(clientData.clients);
            setArchive(clientData.archive);
            setHeaders(clientData.headers);
            setTemplates(templateData);
            setMasters(masterData);
            setSettings(settingsData);
        } catch (e: any) {
            addToast(`Ошибка загрузки данных: ${e.message}`, 'error');
        }
    }, [addToast]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const logout = () => {
        sessionStorage.removeItem('user');
        setUser(null);
    };

    const needsSetup = !settings.googleSheetId && settings.apiMode === 'GAS';

    const handleSaveViews = (views: SavedView[]) => {
        setSavedViews(views);
        localStorage.setItem('saved_views', JSON.stringify(views));
    };

    useEffect(() => {
        const saved = localStorage.getItem('saved_views');
        if (saved) setSavedViews(JSON.parse(saved));
    }, []);

    return (
        <HashRouter>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <Routes>
                <Route path="/tg-lk" element={<TelegramLK />} />
                
                <Route path="/*" element={
                    <Layout user={user} onLogout={logout} navDisabled={needsSetup}>
                        <Routes>
                            <Route path="/" element={needsSetup ? <Navigate to="/settings" replace /> : <Dashboard clients={clients} archive={archive} templates={templates} />} />
                            <Route path="/clients" element={needsSetup ? <Navigate to="/settings" replace /> : <ClientsView clients={clients} headers={headers} templates={templates} refreshData={refreshData} savedViews={savedViews} onSaveViews={handleSaveViews} />} />
                            <Route path="/clients/:id" element={needsSetup ? <Navigate to="/settings" replace /> : <ClientDetailsPage clients={clients} headers={headers} templates={templates} refreshData={refreshData} settings={settings} />} />
                            <Route path="/masters" element={needsSetup ? <Navigate to="/settings" replace /> : <MastersView masters={masters} setMasters={setMasters} clients={clients} />} />
                            <Route path="/add-client" element={needsSetup ? <Navigate to="/settings" replace /> : <AddClient settings={settings} onClientAdd={refreshData} />} />
                            <Route path="/settings" element={<Settings initialSettings={settings} initialTemplates={templates} initialMasters={masters} clients={clients} onSave={refreshData} needsSetup={needsSetup} />} />
                        </Routes>
                    </Layout>
                } />
            </Routes>
        </HashRouter>
    );
};