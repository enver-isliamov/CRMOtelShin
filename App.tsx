
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { ClientsView } from './components/ClientsView';
import { ClientDetailsPage } from './components/ClientDetailsPage';
import { Settings } from './components/Settings';
import { MastersView } from './components/MastersView';
import { AddClient } from './components/AddClient';
import { UserRole, Client, MessageTemplate, Settings as SettingsType, Master, SavedView } from './types';
import { api, getClientHeaders } from './services/api';
import { ThemeSwitcher } from './components/ui/ThemeSwitcher';
import { ToastContainer, ToastMessage } from './components/ui/Toast';

const getInitialSettings = (): SettingsType => {
    const data = localStorage.getItem('crm_settings');
    const defaults: SettingsType = { adminIds: '', managerIds: '', googleSheetId: '', sheetName: 'WebBase', apiMode: 'GAS' };
    try {
        if (data) {
            return { ...defaults, ...JSON.parse(data) };
        }
    } catch (e) {
        console.error("Could not parse settings from localStorage", e);
    }
    return defaults;
};


// --- ICONS ---
const DashboardIcon: React.FC<{className?: string}> = ({ className="h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const ClientsIcon: React.FC<{className?: string}> = ({ className="h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97M15 21h3.75a.75.75 0 00.75-.75V13.5A2.25 2.25 0 0017.25 11.25h-2.5A2.25 2.25 0 0012.5 13.5v6.75a.75.75 0 00.75.75H15z" /></svg>;
const SettingsIcon: React.FC<{className?: string}> = ({ className="h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.608 3.292 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const PlusCircleIcon: React.FC<{className?: string}> = ({ className="h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const LogoutIcon: React.FC<{className?: string}> = ({ className="h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const BadgeIcon: React.FC<{className?: string}> = ({ className="h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>;

const NavLink: React.FC<{ to: string, icon: React.ReactNode, children: React.ReactNode, disabled?: boolean }> = ({ to, icon, children, disabled = false }) => {
    const location = useLocation();
    const isActive = !disabled && (location.pathname === to || (to !== '/' && location.pathname.startsWith(to)));
    
    const commonClasses = `flex items-center space-x-3 rounded-lg transition-colors duration-200 px-3 py-2`;
    const activeClasses = `bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 font-semibold`;
    const inactiveClasses = `text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50`;
    const disabledClasses = `text-gray-400 dark:text-gray-500 cursor-not-allowed bg-transparent`;

    if (disabled) {
        return (
            <span className={`${commonClasses} ${disabledClasses}`}>
                {icon}
                <span>{children}</span>
            </span>
        );
    }

    return (
        <Link to={to} className={`${commonClasses} ${isActive ? activeClasses : inactiveClasses}`}>
            {icon}
            <span>{children}</span>
        </Link>
    );
};

const BottomNavLink: React.FC<{ to: string, icon: React.ReactNode, children?: React.ReactNode, disabled?: boolean, label: string }> = ({ to, icon, disabled = false, label }) => {
    const location = useLocation();
    const isActive = !disabled && (location.pathname === to || (to !== '/' && location.pathname.startsWith(to)));

    // Mobile nav optimized: No text, bigger icons, centered
    const commonClasses = `flex items-center justify-center flex-1 py-3 transition-colors duration-200 select-none`;
    const activeClasses = `text-primary-600 dark:text-primary-300 bg-primary-50/50 dark:bg-primary-900/20`; 
    const inactiveClasses = `text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800`;
    const disabledClasses = `text-gray-300 dark:text-gray-600 cursor-not-allowed`;

    // Clone icon to increase size for mobile touch targets
    const sizedIcon = React.isValidElement(icon) 
        ? React.cloneElement(icon, { className: "h-7 w-7" } as React.SVGProps<SVGSVGElement>) 
        : icon;

    if (disabled) {
        const disabledIcon = to === '/add-client'
            ? <PlusCircleIcon className="h-7 w-7 text-gray-300 dark:text-gray-600" />
            : sizedIcon;

        return (
            <span className={`${commonClasses} ${disabledClasses}`} aria-label={label}>
                {disabledIcon}
            </span>
        );
    }
    
    return (
        <Link to={to} className={`${commonClasses} ${isActive ? activeClasses : inactiveClasses}`} aria-label={label}>
            {sizedIcon}
        </Link>
    );
}

const Layout: React.FC<{ children: React.ReactNode, user: { username: string, role: UserRole }, onLogout: () => void, navDisabled?: boolean }> = ({ children, user, onLogout, navDisabled = false }) => {
    const location = useLocation();
    // Check if we are on a detail page to potentially hide elements or change layout style
    const isDetailPage = location.pathname.startsWith('/clients/') && location.pathname !== '/clients';

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 z-50">
                <div className="flex items-center space-x-3 mb-8">
                     <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/50">
                        <svg className="h-8 w-auto text-primary-600 dark:text-primary-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 9.068l.44-2.396M11.25 9.068l-3.41 1.936m3.41-1.936l1.936 3.41m-1.936-3.41a4.5 4.5 0 013.182-.968h.063a4.5 4.5 0 013.478 5.432l-1.29 7.234a.75.75 0 01-1.42-.25l-1.29-7.234a2.25 2.25 0 00-2.208-1.956H9.413a2.25 2.25 0 00-2.208 1.956l-1.29 7.234a.75.75 0 01-1.42-.25l-1.29-7.234A4.5 4.5 0 016.12 6.132h.063a4.5 4.5 0 013.182.968z" />
                        </svg>
                     </div>
                    <span className="text-xl font-bold">Tire CRM</span>
                </div>

                <nav className="flex flex-col space-x-0 space-y-2">
                    <NavLink to="/" icon={<DashboardIcon />} disabled={navDisabled}>Дашборд</NavLink>
                    <NavLink to="/clients" icon={<ClientsIcon />} disabled={navDisabled}>Клиенты</NavLink>
                    <NavLink to="/masters" icon={<BadgeIcon />} disabled={navDisabled}>Мастера</NavLink>
                    <NavLink to="/add-client" icon={<PlusCircleIcon />} disabled={navDisabled}>Добавить</NavLink>
                    <NavLink to="/settings" icon={<SettingsIcon />}>Настройки</NavLink>
                </nav>
                <div className="mt-auto space-y-4">
                    <ThemeSwitcher />
                     <button onClick={onLogout} className="flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                        <LogoutIcon />
                        <span>Выйти</span>
                    </button>
                    <div className="text-center text-xs text-gray-400">
                        <p>{user.username} ({user.role})</p>
                    </div>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col h-full relative">
                 {/* Mobile Header - Hide on Detail Page to allow custom header */}
                {!isDetailPage && (
                    <header className="md:hidden flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 z-[60] sticky top-0">
                         <div className="flex items-center space-x-2">
                            <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/50">
                               <svg className="h-6 w-auto text-primary-600 dark:text-primary-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 9.068l.44-2.396M11.25 9.068l-3.41 1.936m3.41-1.936l1.936 3.41m-1.936-3.41a4.5 4.5 0 013.182-.968h.063a4.5 4.5 0 013.478 5.432l-1.29 7.234a.75.75 0 01-1.42-.25l-1.29-7.234a2.25 2.25 0 00-2.208-1.956H9.413a2.25 2.25 0 00-2.208 1.956l-1.29 7.234a.75.75 0 01-1.42-.25l-1.29-7.234A4.5 4.5 0 016.12 6.132h.063a4.5 4.5 0 013.182.968z" /></svg>
                            </div>
                            <span className="text-lg font-bold">Tire CRM</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <ThemeSwitcher />
                            <button onClick={onLogout} className="p-2 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                <LogoutIcon/>
                            </button>
                        </div>
                    </header>
                )}
                
                {/* Scrollable Content Area */}
                <main className={`flex-1 overflow-y-auto relative z-0 ${!isDetailPage ? 'pb-20 md:pb-0' : 'pb-0'}`}>
                    {children}
                </main>
                
                 {/* Mobile Bottom Nav - Completely isolated z-context. Hide on Detail Page */}
                {!isDetailPage && (
                    <nav className="md:hidden flex items-center justify-around bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 px-2 z-[100] fixed bottom-0 left-0 right-0 pb-safe safe-area-inset-bottom shadow-[0_-1px_10px_rgba(0,0,0,0.05)] h-14">
                        <BottomNavLink to="/" icon={<DashboardIcon/>} disabled={navDisabled} label="Дашборд" />
                        <BottomNavLink to="/clients" icon={<ClientsIcon/>} disabled={navDisabled} label="Клиенты" />
                        <BottomNavLink to="/masters" icon={<BadgeIcon/>} disabled={navDisabled} label="Мастера" />
                        <BottomNavLink to="/add-client" icon={<PlusCircleIcon className="text-primary-600 dark:text-primary-400"/>} disabled={navDisabled} label="Добавить" />
                        <BottomNavLink to="/settings" icon={<SettingsIcon/>} label="Настройки" />
                    </nav>
                )}
            </div>
        </div>
    );
};

export const App: React.FC = () => {
    // ... (App logic remains same, but we must include it to be valid XML response)
    const user = { username: 'Admin', role: UserRole.Admin };
    const logout = () => {
        console.log("Logout clicked. Authentication is disabled.");
    };
    
    const [clients, setClients] = useState<Client[]>([]);
    const [archive, setArchive] = useState<Client[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [settings, setSettings] = useState<SettingsType>(getInitialSettings);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [masters, setMasters] = useState<Master[]>([]);
    const [savedViews, setSavedViews] = useState<SavedView[]>([]);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') || 'system';
        if (storedTheme === 'dark' || (storedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const addToast = (message: string, type: 'success' | 'error', title?: string) => {
        const id = Date.now().toString() + Math.random().toString();
        const duration = type === 'error' ? 0 : 4000; 
        
        setToasts(prev => [...prev, { id, message, type, title, duration }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const fetchData = useCallback(async () => {
        try {
            const settingsData = await api.fetchSettings();
            setSettings(settingsData);
            
            const viewsData = localStorage.getItem('crm_saved_views');
            setSavedViews(viewsData ? JSON.parse(viewsData) : []);

            if (!settingsData.googleSheetId) {
                setClients([]);
                setArchive([]);
                setHeaders(getClientHeaders());
                setTemplates([]);
                setMasters([]);
            } else {
                const [clientsData, templatesData, mastersData] = await Promise.all([
                    api.fetchClients(),
                    api.fetchTemplates(),
                    api.fetchMasters(),
                ]);
                setClients(clientsData.clients);
                setArchive(clientsData.archive);
                setHeaders(clientsData.headers.length > 0 ? clientsData.headers : getClientHeaders());
                setTemplates(templatesData);
                setMasters(mastersData);
            }
        } catch (error: any) {
            console.error("Failed to fetch data:", error);
            addToast(`Ошибка синхронизации: ${error.message}`, 'error', 'Сбой сети или API');
            setClients([]);
            setArchive([]);
            setHeaders(getClientHeaders());
            setTemplates([]);
            setMasters([]);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refreshData = useCallback(async () => {
        addToast("Обновление данных...", "success");
        await fetchData();
    }, [fetchData]);

    const handleSaveViews = (views: SavedView[]) => {
        setSavedViews(views);
        localStorage.setItem('crm_saved_views', JSON.stringify(views));
    };
    
    const needsSetup = !settings.googleSheetId;

    return (
        <HashRouter>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <Layout user={user} onLogout={logout} navDisabled={needsSetup}>
                <Routes>
                    <Route path="/" element={needsSetup ? <Navigate to="/settings" replace /> : <Dashboard clients={clients} archive={archive} templates={templates} />} />
                    <Route path="/clients" element={needsSetup ? <Navigate to="/settings" replace /> : <ClientsView clients={clients} headers={headers} templates={templates} refreshData={refreshData} savedViews={savedViews} onSaveViews={handleSaveViews} />} />
                    <Route path="/clients/:id" element={needsSetup ? <Navigate to="/settings" replace /> : <ClientDetailsPage clients={clients} headers={headers} templates={templates} refreshData={refreshData} settings={settings} />} />
                    <Route path="/masters" element={needsSetup ? <Navigate to="/settings" replace /> : <MastersView masters={masters} setMasters={setMasters} clients={clients} />} />
                    <Route path="/add-client" element={needsSetup ? <Navigate to="/settings" replace /> : <AddClient settings={settings} onClientAdd={refreshData} />} />
                    <Route path="/settings" element={<Settings initialSettings={settings} initialTemplates={templates} initialMasters={masters} clients={clients} onSave={refreshData} needsSetup={needsSetup} />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Layout>
        </HashRouter>
    );
};