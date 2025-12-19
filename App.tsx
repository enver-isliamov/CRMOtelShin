
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation, NavLink } from 'react-router-dom';
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
import { DevViewToggle } from './components/ui/DevViewToggle';

// --- Иконки для меню ---
const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" /></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const WrenchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M11.423 20.217a12.318 12.318 0 01-6.424-3.524 12.318 12.318 0 01-3.524-6.424m16.962-6.912a12.318 12.318 0 01-6.424 3.524 12.318 12.318 0 01-3.524 6.424m16.962-6.912l-1.923 1.923m-10.423 10.423l-1.923 1.923" /></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.59c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.127c-.332.183-.582.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.59c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

const Layout: React.FC<{ user: User | null, onLogout: () => void, children: React.ReactNode, navDisabled?: boolean }> = ({ user, onLogout, children, navDisabled }) => {
  const location = useLocation();
  const isTg = location.pathname === '/tg-lk';

  if (isTg) return <>{children}</>;

  const menuItems = [
    { to: '/', label: 'Дашборд', icon: <DashboardIcon /> },
    { to: '/clients', label: 'Клиенты', icon: <UsersIcon /> },
    { to: '/masters', label: 'Мастера', icon: <WrenchIcon /> },
    { to: '/add-client', label: 'Новый заказ', icon: <PlusIcon /> },
    { to: '/settings', label: 'Настройки', icon: <SettingsIcon /> },
  ];

  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-gray-100 dark:bg-gray-950 transition-colors duration-200">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden sm:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 sticky top-0 h-screen overflow-y-auto z-50">
        <div className="p-6">
          <Link to="/" className="text-xl font-black text-primary-600 dark:text-primary-400 tracking-tighter flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white">О</div>
            CRM ОтельШин
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {!navDisabled && menuItems.map(item => (
            <NavLink 
              key={item.to}
              to={item.to} 
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                isActive 
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' 
                : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
              }`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Тема</span>
            <ThemeSwitcher />
          </div>
          {user && (
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              Выйти
            </button>
          )}
        </div>
      </aside>

      {/* --- MOBILE HEADER --- */}
      <header className="sm:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link to="/" className="text-lg font-black text-primary-600 dark:text-primary-400 tracking-tighter">
          CRM ОтельШин
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {user && <button onClick={onLogout} className="p-2 text-red-500"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg></button>}
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-x-hidden pb-20 sm:pb-0">
        <div className="max-w-7xl mx-auto py-4 sm:py-8">
          {children}
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAV --- */}
      {!navDisabled && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 flex items-center justify-around py-2 px-4 z-50 safe-area-inset-bottom">
          {menuItems.map(item => (
            <NavLink 
              key={item.to}
              to={item.to} 
              className={({ isActive }) => `flex flex-col items-center gap-1 p-2 transition-colors ${
                isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
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
            <DevViewToggle />
        </HashRouter>
    );
};
