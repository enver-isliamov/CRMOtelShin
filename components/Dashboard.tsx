

import React, { useMemo, useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { LiveIncomeCounter } from './ui/LiveIncomeCounter';
import { ExpiringClientsList } from './ui/ExpiringClientsList';
import { Client, MessageTemplate, parseDate } from '../types';
import { Toast } from './ui/Toast';
import { api } from '../services/api';
import { DebtorsList } from './ui/DebtorsList';
import { TotalEarningsCounter } from './ui/TotalEarningsCounter';


// --- Icons ---
const UserGroupIcon: React.FC<{className?: string}> = ({ className="h-6 w-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.962a3.75 3.75 0 015.25 0m-5.25 0a3.75 3.75 0 00-5.25 0M3 16.5v-1.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 15v1.5m-18 0l-2.25.625a3.375 3.375 0 00-1.125 4.125l1.5 3.75a3.375 3.375 0 004.125 1.125L12 18.75l8.25 4.5a3.375 3.375 0 004.125-1.125l1.5-3.75a3.375 3.375 0 00-1.125-4.125L18 16.5m-18 0h18" /></svg>;
const CurrencyRubleIcon: React.FC<{className?: string}> = ({ className="h-6 w-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5l3 4.5m0 0l3-4.5M12 12v5.25M15 12H9m6 3H9m12-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ExclamationTriangleIcon: React.FC<{className?: string}> = ({ className="h-6 w-6" }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;

// Custom hook to animate numbers
const useAnimatedValue = (endValue: number, duration = 1000) => {
    const [count, setCount] = useState(0); // Start from 0 for initial animation
    const frameRef = React.useRef<number | null>(null);

    useEffect(() => {
        const startValue = count;
        let startTime: number | null = null;
        
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            const easedPercentage = 1 - Math.pow(1 - percentage, 3); // easeOutCubic
            const currentValue = startValue + (endValue - startValue) * easedPercentage;
            setCount(currentValue);

            if (progress < duration) {
                frameRef.current = requestAnimationFrame(animate);
            } else {
                setCount(endValue); // Snap to the final value
            }
        };
        
        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }
        frameRef.current = requestAnimationFrame(animate);

        return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
    }, [endValue, duration]);

    return count;
};

const TotalRevenueCard: React.FC<{allOrders: Client[]}> = ({ allOrders }) => {
    
    const totalRevenue = useMemo(() => {
        return allOrders.reduce((acc, c) => acc + (c['Общая сумма'] || 0), 0);
    }, [allOrders]);

    const animatedValue = useAnimatedValue(totalRevenue);

    const formatCurrency = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value);
    
    return (
         <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col bg-gradient-to-br from-blue-500 to-sky-600 dark:from-blue-600 dark:to-sky-700 text-white shadow-lg">
            <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-white/80 truncate">Общая выручка</p>
                <div className="flex-shrink-0 bg-white/20 text-white rounded-lg p-2">
                    <CurrencyRubleIcon />
                </div>
            </div>
            <div className="mt-1 flex-grow">
                <p className="text-3xl font-bold">{formatCurrency(animatedValue)}</p>
            </div>
             <div className="mt-auto pt-4">
               <p className="text-xs text-white/70">Сумма всех активных и архивных заказов.</p>
            </div>
        </Card>
    );
};


interface DashboardProps {
  clients: Client[];
  archive: Client[];
  templates: MessageTemplate[];
}

export const Dashboard: React.FC<DashboardProps> = ({ clients, archive, templates }) => {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const allOrders = useMemo(() => [...clients, ...archive], [clients, archive]);

    const { 
        globalStats, 
        totalArchivedRevenue, 
        firstDealDate 
    } = useMemo(() => {
        const now = new Date();

        const activeClients = clients.filter(c => {
             const contractStartDate = parseDate(c['Начало']);
             const contractEndDate = parseDate(c['Окончание']);
             return contractStartDate && contractEndDate && now >= contractStartDate && now <= contractEndDate;
        });
        
        const debtors = allOrders.filter(c => (c['Долг'] || 0) > 0);

        const stats = {
            totalClients: clients.length,
            totalDebt: debtors.reduce((acc, c) => acc + (c['Долг'] || 0), 0),
            debtors: debtors,
            activeContractsMonthlyIncome: activeClients.reduce((acc, c) => acc + (c['Цена за месяц'] || 0), 0)
        };
        
        const archivedRevenue = archive.reduce((acc, c) => acc + (c['Общая сумма'] || 0), 0);

        let fDate: Date | null = null;
        if (allOrders.length > 0) {
            allOrders.forEach(order => {
                const startDate = parseDate(order['Начало']);
                if (startDate && (!fDate || startDate < fDate)) {
                    fDate = startDate;
                }
            });
        }

        return { 
            globalStats: stats, 
            totalArchivedRevenue: archivedRevenue, 
            firstDealDate: fDate 
        };
    }, [clients, archive, allOrders]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    const processTemplate = (templateContent: string, client: Client): string => {
        let content = templateContent;
        Object.keys(client).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            let value = String(client[key as keyof Client] || '');
             if ((key === 'Окончание' || key === 'Напомнить' || key === 'Начало') && value) {
                const parsed = parseDate(value);
                if (parsed) value = parsed.toLocaleDateString('ru-RU');
            }
            if ((key === 'Долг' || key === 'Общая сумма') && typeof client[key] === 'number') {
                value = new Intl.NumberFormat('ru-RU').format(client[key]);
            }
            content = content.replace(placeholder, value);
        });
        return content;
    }

    const handleSendExpiryReminder = async (client: Client) => {
        const template = templates.find(t => t['Название шаблона'] === 'Напоминание об окончании хранения');
        if (!template) return showToast('Шаблон для напоминаний об окончании не найден.', 'error');
        if (!client['Chat ID']) return showToast('У клиента не указан Chat ID.', 'error');

        const message = processTemplate(template['Содержимое (HTML)'], client);
        showToast('Отправка напоминания...', 'success');
        const result = await api.sendMessage(client['Chat ID'] as string, message);
        showToast(result.message, result.success ? 'success' : 'error');
    };

    const handleSendDebtReminder = async (client: Client) => {
        const template = templates.find(t => t['Название шаблона'] === 'Напоминание о задолженности');
        if (!template) return showToast('Шаблон для напоминаний о долге не найден.', 'error');
        if (!client['Chat ID']) return showToast('У клиента не указан Chat ID.', 'error');
        
        const message = processTemplate(template['Содержимое (HTML)'], client);
        showToast('Отправка напоминания о долге...', 'success');
        const result = await api.sendMessage(client['Chat ID'] as string, message);
        showToast(result.message, result.success ? 'success' : 'error');
    };
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value);
    
    const StatCard: React.FC<{title:string, value:string, icon:React.ReactNode, colorClass: string}> = 
        ({ title, value, icon, colorClass }) => (
        <div className="h-full w-full">
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
                    <div className={`flex-shrink-0 ${colorClass} rounded-lg p-2`}>
                        {icon}
                    </div>
                </div>
                <div className="mt-1">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
            </Card>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                {/* Row 1: Main Financial Widgets */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-2 animate-slide-in-bottom" style={{animationDelay: '0ms'}}>
                    <TotalEarningsCounter 
                        clients={clients} 
                        totalArchivedRevenue={totalArchivedRevenue}
                        firstDealDate={firstDealDate}
                    />
                </div>
                
                <div className="col-span-1 sm:col-span-1 lg:col-span-2 animate-slide-in-bottom" style={{animationDelay: '50ms'}}>
                    <Card className="h-full bg-gradient-to-br from-green-500 to-cyan-600 dark:from-green-600 dark:to-cyan-700 text-white shadow-lg">
                        <LiveIncomeCounter monthlyIncome={globalStats.activeContractsMonthlyIncome} />
                    </Card>
                </div>
                
                <div className="col-span-1 sm:col-span-1 lg:col-span-2 animate-slide-in-bottom" style={{animationDelay: '100ms'}}>
                     <TotalRevenueCard allOrders={allOrders} />
                </div>
                
                {/* Row 2: Stat Cards */}
                <div className="col-span-1 sm:col-span-1 lg:col-span-3 animate-slide-in-bottom" style={{animationDelay: '150ms'}}>
                    <StatCard title="Активных клиентов" value={`${globalStats.totalClients}`} icon={<UserGroupIcon />} colorClass="bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300" />
                </div>
                 <div className="col-span-1 sm:col-span-1 lg:col-span-3 animate-slide-in-bottom" style={{animationDelay: '200ms'}}>
                    <StatCard title="Общий долг" value={formatCurrency(globalStats.totalDebt)} icon={<ExclamationTriangleIcon />} colorClass="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300" />
                </div>
                
                {/* Row 3: Lists */}
                 <div className="col-span-1 sm:col-span-2 lg:col-span-3 min-h-[450px] animate-slide-in-bottom" style={{animationDelay: '250ms'}}>
                    <ExpiringClientsList clients={clients} onRemind={handleSendExpiryReminder} />
                </div>
                 <div className="col-span-1 sm:col-span-2 lg:col-span-3 min-h-[450px] animate-slide-in-bottom" style={{animationDelay: '300ms'}}>
                    <DebtorsList debtors={globalStats.debtors} onRemind={handleSendDebtReminder} />
                </div>
            </div>
        </div>
    );
};
