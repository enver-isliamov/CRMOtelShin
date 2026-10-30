import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from './ui/Card';
import { LiveIncomeCounter } from './ui/LiveIncomeCounter';
import { ExpiringClientsList } from './ui/ExpiringClientsList';
import { Client, MessageTemplate, parseDate } from '../types';
import { Toast } from './ui/Toast';
import { api } from '../services/api';
import { DebtorsList } from './ui/DebtorsList';
import { TotalEarningsCounter } from './ui/TotalEarningsCounter';

// --- CANONICAL ICONS ---
import { 
    UserGroupIcon, 
    CurrencyRubleIcon, 
    ExclamationTriangleIcon,
    TireIcon,
    DiscIcon,
    SunIcon,
    SnowflakeIcon,
    PlusIcon,
    CalendarDaysIcon,
    BanknotesIcon,
    ReceiptIcon
} from './icons/Icons';

// Custom hook to animate numbers smoothly
const useAnimatedValue = (endValue: number, duration = 1000) => {
    const [count, setCount] = useState(0);
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
                setCount(endValue);
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

// 1. Existing Total Revenue Card (Preserved Logic & Animated Counter)
const TotalRevenueCard: React.FC<{allOrders: Client[]}> = ({ allOrders }) => {
    const totalRevenue = useMemo(() => {
        return allOrders.reduce((acc, c) => acc + (Number(c['Общая сумма']) || 0), 0);
    }, [allOrders]);

    const animatedValue = useAnimatedValue(totalRevenue);

    const formatCurrency = (value: number) => 
        new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value);
    
    return (
        <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-700 text-white shadow-lg overflow-hidden relative">
            <div className="flex items-start justify-between z-10 relative">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Оборот договоров</p>
                    <h3 className="text-sm font-medium text-white/95 mt-0.5">Общая выручка</h3>
                </div>
                <div className="flex-shrink-0 bg-white/20 text-white rounded-xl p-2.5 backdrop-blur-xs">
                    <CurrencyRubleIcon className="w-5 h-5" />
                </div>
            </div>
            <div className="mt-3 flex-grow z-10 relative">
                <p className="text-3xl sm:text-4xl font-black tracking-tight">{formatCurrency(animatedValue)}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
                    <span className="font-semibold">{allOrders.length}</span>
                    <span>заказов за всё время</span>
                </div>
            </div>
            <div className="mt-auto pt-3 z-10 relative border-t border-white/15">
                <p className="text-[11px] text-white/70">Сумма всех активных и архивных заказов</p>
            </div>
            {/* Decorative Background Icon */}
            <div className="absolute -bottom-6 -right-6 text-white/10 pointer-events-none">
                <CurrencyRubleIcon className="h-32 w-32 rotate-12" />
            </div>
        </Card>
    );
};

// 2. Existing Stat Card with modern styling
const StatCard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    colorClass: string;
    onClick?: () => void;
}> = ({ title, value, subtitle, icon, colorClass, onClick }) => (
    <div className={`h-full w-full ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
        <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md border border-gray-200/80 dark:border-gray-800">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</p>
                    <div className="mt-1.5">
                        <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white break-words">{value}</p>
                    </div>
                </div>
                <div className={`flex-shrink-0 ${colorClass} rounded-xl p-2.5 shadow-2xs`}>
                    {icon}
                </div>
            </div>
            {subtitle && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">
                    {subtitle}
                </p>
            )}
        </Card>
    </div>
);

// 3. NEW: Warehouse & Tires Storage Stats Widget
const WarehouseStatsWidget: React.FC<{
    totalTires: number;
    withRimsCount: number;
    withoutRimsCount: number;
    avgMonths: number;
    avgMonthlyRate: number;
    warehouses: { name: string; count: number }[];
}> = ({ totalTires, withRimsCount, withoutRimsCount, avgMonths, avgMonthlyRate, warehouses }) => {
    const totalSets = withRimsCount + withoutRimsCount;
    const rimsPercentage = totalSets > 0 ? Math.round((withRimsCount / totalSets) * 100) : 0;

    return (
        <Card 
            title={
                <div className="flex items-center gap-2">
                    <TireIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    <span>Склад и шины на хранении</span>
                </div>
            }
            className="h-full flex flex-col justify-between"
        >
            <div className="space-y-4">
                {/* Total tires highlight */}
                <div className="flex items-baseline justify-between p-3.5 bg-primary-50/70 dark:bg-primary-950/30 rounded-xl border border-primary-200/60 dark:border-primary-900/40">
                    <div>
                        <p className="text-xs font-semibold uppercase text-primary-700 dark:text-primary-300">Всего шин на складе</p>
                        <p className="text-3xl font-black text-primary-900 dark:text-primary-100 mt-0.5">{totalTires} <span className="text-sm font-semibold text-primary-600">шт.</span></p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-bold text-primary-700 dark:text-primary-300">
                            {totalSets} комплектов
                        </span>
                        <p className="text-[11px] text-primary-600/80 dark:text-primary-400/80">в активном хранении</p>
                    </div>
                </div>

                {/* Rims distribution */}
                <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                            <DiscIcon className="w-3.5 h-3.5 text-indigo-500" /> С дисками: {withRimsCount} ({rimsPercentage}%)
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">
                            Без дисков: {withoutRimsCount} ({100 - rimsPercentage}%)
                        </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div 
                            style={{ width: `${rimsPercentage}%` }} 
                            className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-500"
                            title={`С дисками: ${withRimsCount}`}
                        />
                        <div 
                            style={{ width: `${100 - rimsPercentage}%` }} 
                            className="bg-slate-400 dark:bg-slate-500 h-full transition-all duration-500"
                            title={`Без дисков: ${withoutRimsCount}`}
                        />
                    </div>
                </div>

                {/* Averages and Warehouse locations */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-gray-400 font-medium">Ср. тариф</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(avgMonthlyRate)}/мес
                        </p>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-gray-400 font-medium">Ср. срок</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                            {avgMonths > 0 ? `${avgMonths} мес.` : '—'}
                        </p>
                    </div>
                </div>

                {warehouses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {warehouses.map(w => (
                            <span key={w.name} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                🏬 {w.name}: <b>{w.count}</b>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
};

// 4. Seasonality Breakdown Widget
const SeasonalityWidget: React.FC<{
    summerCount: number;
    winterCount: number;
    allSeasonCount: number;
}> = ({ summerCount, winterCount, allSeasonCount }) => {
    const total = summerCount + winterCount + allSeasonCount;
    const summerPct = total > 0 ? Math.round((summerCount / total) * 100) : 0;
    const winterPct = total > 0 ? Math.round((winterCount / total) * 100) : 0;
    const allSeasonPct = total > 0 ? Math.max(0, 100 - summerPct - winterPct) : 0;

    return (
        <Card 
            title={
                <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-1 p-1 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200/50 dark:border-amber-900/30">
                        <SunIcon className="w-4 h-4 text-amber-500" />
                        <SnowflakeIcon className="w-4 h-4 text-sky-500" />
                    </div>
                    <span>Сезонность комплектов</span>
                </div>
            }
            className="h-full flex flex-col justify-between"
        >
            <div className="space-y-4">
                {/* Total Sets Summary Banner matching WarehouseStatsWidget */}
                <div className="flex items-baseline justify-between p-3.5 bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-teal-500/10 dark:from-amber-500/15 dark:to-sky-500/15 rounded-xl border border-amber-200/60 dark:border-gray-800">
                    <div>
                        <p className="text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Всего комплектов</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white mt-0.5">
                            {total} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">компл.</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            {summerCount >= winterCount ? 'Лето преобладает' : 'Зима преобладает'}
                        </span>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">на хранении в отеле</p>
                    </div>
                </div>

                {/* Visual Ratio Bar */}
                <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <SunIcon className="w-3.5 h-3.5 text-amber-500" /> Лето: {summerCount} ({summerPct}%)
                        </span>
                        <span className="text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                            <SnowflakeIcon className="w-3.5 h-3.5 text-sky-500" /> Зима: {winterCount} ({winterPct}%)
                        </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div 
                            style={{ width: `${summerPct}%` }} 
                            className="bg-amber-500 dark:bg-amber-500 h-full transition-all duration-500" 
                            title={`Лето: ${summerCount} (${summerPct}%)`}
                        />
                        <div 
                            style={{ width: `${winterPct}%` }} 
                            className="bg-sky-500 dark:bg-sky-500 h-full transition-all duration-500" 
                            title={`Зима: ${winterCount} (${winterPct}%)`}
                        />
                        {allSeasonPct > 0 && (
                            <div 
                                style={{ width: `${allSeasonPct}%` }} 
                                className="bg-emerald-500 dark:bg-emerald-500 h-full transition-all duration-500" 
                                title={`Всесезон: ${allSeasonCount} (${allSeasonPct}%)`}
                            />
                        )}
                    </div>
                </div>

                {/* Metrics Breakdown Grid matching WarehouseStatsWidget */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                            <SunIcon className="w-3 h-3 text-amber-500" /> Летние шины
                        </p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                            {summerCount} компл. <span className="text-xs font-normal text-gray-500">({summerPct}%)</span>
                        </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                            <SnowflakeIcon className="w-3 h-3 text-sky-500" /> Зимние шины
                        </p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                            {winterCount} компл. <span className="text-xs font-normal text-gray-500">({winterPct}%)</span>
                        </p>
                    </div>
                </div>

                {/* Meta note and All-season tag */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {allSeasonCount > 0 ? (
                        <span className="font-mono px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Всесезон: <b>{allSeasonCount}</b> ({allSeasonPct}%)
                        </span>
                    ) : (
                        <span className="text-gray-400 dark:text-gray-500">2 основных сезона</span>
                    )}
                    <span className="italic text-gray-500 dark:text-gray-400">
                        {summerCount >= winterCount ? 'Зимний период хранения' : 'Летний период хранения'}
                    </span>
                </div>
            </div>
        </Card>
    );
};

// 5. NEW: Status & Pipeline Breakdown Widget
const PipelineStatusWidget: React.FC<{
    statusCounts: Record<string, number>;
    serviceCounts: { wash: number; package: number; delivery: number };
}> = ({ statusCounts, serviceCounts }) => {
    const navigate = useNavigate();

    return (
        <Card 
            title={
                <div className="flex items-center gap-2">
                    <ReceiptIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Статусы и услуги заказов</span>
                </div>
            }
            className="h-full flex flex-col justify-between"
        >
            <div className="space-y-4">
                {/* Status Chips with Click to Filter */}
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Статусы активных сделок:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                            type="button"
                            onClick={() => navigate('/clients')}
                            className="p-2.5 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/40 text-left transition-all"
                        >
                            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">На складе</span>
                            <span className="text-lg font-black text-emerald-900 dark:text-emerald-100">{statusCounts['На складе'] || 0}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/clients')}
                            className="p-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/40 text-left transition-all"
                        >
                            <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 block">Оплачено</span>
                            <span className="text-lg font-black text-blue-900 dark:text-blue-100">{statusCounts['Оплачено'] || 0}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/clients?filter=debt')}
                            className="p-2.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-left transition-all"
                        >
                            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block">Частичная оплата</span>
                            <span className="text-lg font-black text-amber-900 dark:text-amber-100">{statusCounts['Частичная оплата'] || 0}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/clients?filter=debt')}
                            className="p-2.5 rounded-xl bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/40 text-left transition-all"
                        >
                            <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 block">Без оплаты</span>
                            <span className="text-lg font-black text-rose-900 dark:text-rose-100">{statusCounts['Без оплаты'] || 0}</span>
                        </button>
                    </div>
                </div>

                {/* Extra Services Counter */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Дополнительные услуги:</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                            <span className="text-base select-none">🚿</span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Мойка</p>
                            <p className="font-bold text-gray-900 dark:text-white mt-0.5">{serviceCounts.wash}</p>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                            <span className="text-base select-none">📦</span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Пакеты</p>
                            <p className="font-bold text-gray-900 dark:text-white mt-0.5">{serviceCounts.package}</p>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                            <span className="text-base select-none">🚚</span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Вывоз</p>
                            <p className="font-bold text-gray-900 dark:text-white mt-0.5">{serviceCounts.delivery}</p>
                        </div>
                    </div>
                </div>
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
    const navigate = useNavigate();

    const allOrders = useMemo(() => [...clients, ...archive], [clients, archive]);

    // Enhanced calculations preserving all original formulas + adding deep analytics
    const { 
        globalStats, 
        totalArchivedRevenue, 
        firstDealDate,
        inventoryStats,
        urgentExpiringCount
    } = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const activeClients = clients.filter(c => {
             const contractStartDate = parseDate(c['Начало']);
             const contractEndDate = parseDate(c['Окончание']);
             return contractStartDate && contractEndDate && now >= contractStartDate && now <= contractEndDate;
        });
        
        const debtors = allOrders.filter(c => (Number(c['Долг']) || 0) > 0);

        const stats = {
            totalClients: clients.length,
            totalDebt: debtors.reduce((acc, c) => acc + (Number(c['Долг']) || 0), 0),
            debtors: debtors,
            activeContractsMonthlyIncome: activeClients.reduce((acc, c) => acc + (Number(c['Цена за месяц']) || 0), 0)
        };
        
        const archivedRevenue = archive.reduce((acc, c) => acc + (Number(c['Общая сумма']) || 0), 0);

        let fDate: Date | null = null;
        if (allOrders.length > 0) {
            allOrders.forEach(order => {
                const startDate = parseDate(order['Начало']);
                if (startDate && (!fDate || startDate < fDate)) {
                    fDate = startDate;
                }
            });
        }

        // Additional metrics for tire hotel operations
        let totalTires = 0;
        let withRims = 0;
        let withoutRims = 0;
        let summer = 0;
        let winter = 0;
        let allSeason = 0;
        let totalMonths = 0;
        let totalMonthlyRates = 0;
        let washCount = 0;
        let packageCount = 0;
        let deliveryCount = 0;
        const statusMap: Record<string, number> = {
            'На складе': 0,
            'Оплачено': 0,
            'Частичная оплата': 0,
            'Без оплаты': 0
        };
        const warehouseMap: Record<string, number> = {};

        // Urgent expiring in <= 7 days
        const sevenDaysAhead = new Date();
        sevenDaysAhead.setDate(now.getDate() + 7);
        let urgentCount = 0;

        clients.forEach(c => {
            const tireCount = Number(c['Кол-во шин']) || 4;
            totalTires += tireCount;

            if (c['Наличие дисков'] === 'Да') {
                withRims += 1;
            } else {
                withoutRims += 1;
            }

            const season = c['Сезон'];
            if (season === 'Лето') summer += 1;
            else if (season === 'Зима') winter += 1;
            else allSeason += 1;

            totalMonths += Number(c['Срок']) || 0;
            totalMonthlyRates += Number(c['Цена за месяц']) || 0;

            if (c['Услуга: Мойка']) washCount += 1;
            if (c['Услуга: Упаковка']) packageCount += 1;
            if (c['Услуга: Вывоз']) deliveryCount += 1;

            const st = c['Статус сделки'] || 'На складе';
            statusMap[st] = (statusMap[st] || 0) + 1;

            const wh = (c['Склад хранения'] || 'Основной').trim();
            warehouseMap[wh] = (warehouseMap[wh] || 0) + 1;

            const endDate = parseDate(c['Окончание']);
            if (endDate && endDate >= now && endDate <= sevenDaysAhead) {
                urgentCount += 1;
            }
        });

        const activeCount = clients.length || 1;
        const avgMonths = Math.round((totalMonths / activeCount) * 10) / 10;
        const avgMonthlyRate = Math.round(totalMonthlyRates / activeCount);

        const warehouseList = Object.entries(warehouseMap).map(([name, count]) => ({ name, count }));

        return { 
            globalStats: stats, 
            totalArchivedRevenue: archivedRevenue, 
            firstDealDate: fDate,
            inventoryStats: {
                totalTires,
                withRims,
                withoutRims,
                summer,
                winter,
                allSeason,
                avgMonths,
                avgMonthlyRate,
                warehouses: warehouseList,
                statusMap,
                serviceCounts: { wash: washCount, package: packageCount, delivery: deliveryCount }
            },
            urgentExpiringCount: urgentCount
        };
    }, [clients, archive, allOrders]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    // Retained message template processing
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
    };

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
    
    const formatCurrency = (value: number) => 
        new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Quick Action & Operations Bar */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                        Шинный отель · Обзор склада
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Активно {clients.length} клиентов · {inventoryStats.totalTires} шин на хранении · {archive.length} заказов в архиве
                    </p>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                    <Link
                        to="/add-client"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                    >
                        <PlusIcon className="w-4 h-4 text-white" />
                        <span>Новый заказ</span>
                    </Link>

                    {globalStats.debtors.length > 0 && (
                        <Link
                            to="/clients?filter=debt"
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap"
                            title="Открыть должников в базе клиентов"
                        >
                            <ExclamationTriangleIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                            <span>Должники ({globalStats.debtors.length})</span>
                        </Link>
                    )}

                    <Link
                        to="/clients"
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap"
                    >
                        <UserGroupIcon className="w-4 h-4 text-gray-500" />
                        <span>Все клиенты</span>
                    </Link>
                </div>
            </div>

            {/* Urgent Expiry Alert Banner (if <= 7 days remaining) */}
            {urgentExpiringCount > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                            <CalendarDaysIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                Внимание: {urgentExpiringCount} {urgentExpiringCount === 1 ? 'договор заканчивается' : 'договора заканчиваются'} в ближайшие 7 дней!
                            </h4>
                            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                                Свяжитесь с клиентами для согласования выдачи шин или продления срока хранения.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            const expiringSection = document.getElementById('expiring-section');
                            if (expiringSection) {
                                expiringSection.scrollIntoView({ behavior: 'smooth' });
                            }
                        }}
                        className="self-end sm:self-center px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 whitespace-nowrap"
                    >
                        Смотреть список ➔
                    </button>
                </div>
            )}
            
            {/* ROW 1: Main Financial Real-Time Counters (100% PRESERVED LOGIC) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
                <div className="col-span-1 sm:col-span-2 lg:col-span-2 animate-slide-in-bottom" style={{animationDelay: '0ms'}}>
                    <TotalEarningsCounter 
                        clients={clients} 
                        totalArchivedRevenue={totalArchivedRevenue}
                        firstDealDate={firstDealDate}
                    />
                </div>
                
                <div className="col-span-1 sm:col-span-1 lg:col-span-2 animate-slide-in-bottom" style={{animationDelay: '50ms'}}>
                    <Card className="h-full bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-lg overflow-hidden border-0">
                        <LiveIncomeCounter monthlyIncome={globalStats.activeContractsMonthlyIncome} />
                    </Card>
                </div>
                
                <div className="col-span-1 sm:col-span-1 lg:col-span-2 animate-slide-in-bottom" style={{animationDelay: '100ms'}}>
                    <TotalRevenueCard allOrders={allOrders} />
                </div>
            </div>

            {/* ROW 2: Primary KPI Cards (Active Clients, Total Debt, Storage Count, Avg Rate) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="animate-slide-in-bottom" style={{animationDelay: '150ms'}}>
                    <StatCard 
                        title="Активных клиентов" 
                        value={`${globalStats.totalClients}`} 
                        subtitle={`${clients.length} комплектов на хранении`}
                        icon={<UserGroupIcon className="w-5 h-5" />} 
                        colorClass="bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300"
                        onClick={() => navigate('/clients')}
                    />
                </div>

                <div className="animate-slide-in-bottom" style={{animationDelay: '180ms'}}>
                    <StatCard 
                        title="Общий долг" 
                        value={formatCurrency(globalStats.totalDebt)} 
                        subtitle={`${globalStats.debtors.length} клиентов с задолженностью`}
                        icon={<ExclamationTriangleIcon className="w-5 h-5" />} 
                        colorClass={globalStats.totalDebt > 0 ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300"} 
                        onClick={() => navigate('/clients?filter=debt')}
                    />
                </div>

                <div className="animate-slide-in-bottom" style={{animationDelay: '210ms'}}>
                    <StatCard 
                        title="Шин на складе" 
                        value={`${inventoryStats.totalTires} шт.`} 
                        subtitle={`${inventoryStats.withRims} компл. на дисках (${inventoryStats.withoutRims} без)`}
                        icon={<TireIcon className="w-5 h-5" />} 
                        colorClass="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300"
                        onClick={() => navigate('/clients')}
                    />
                </div>

                <div className="animate-slide-in-bottom" style={{animationDelay: '240ms'}}>
                    <StatCard 
                        title="Средний тариф" 
                        value={formatCurrency(inventoryStats.avgMonthlyRate)} 
                        subtitle={`Средний срок: ${inventoryStats.avgMonths} мес.`}
                        icon={<BanknotesIcon className="w-5 h-5" />} 
                        colorClass="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300"
                    />
                </div>
            </div>

            {/* ROW 3: Strategic Warehouse Insights (NEW Widgets) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="animate-slide-in-bottom" style={{animationDelay: '270ms'}}>
                    <WarehouseStatsWidget 
                        totalTires={inventoryStats.totalTires}
                        withRimsCount={inventoryStats.withRims}
                        withoutRimsCount={inventoryStats.withoutRims}
                        avgMonths={inventoryStats.avgMonths}
                        avgMonthlyRate={inventoryStats.avgMonthlyRate}
                        warehouses={inventoryStats.warehouses}
                    />
                </div>

                <div className="animate-slide-in-bottom" style={{animationDelay: '300ms'}}>
                    <SeasonalityWidget 
                        summerCount={inventoryStats.summer}
                        winterCount={inventoryStats.winter}
                        allSeasonCount={inventoryStats.allSeason}
                    />
                </div>

                <div className="animate-slide-in-bottom" style={{animationDelay: '330ms'}}>
                    <PipelineStatusWidget 
                        statusCounts={inventoryStats.statusMap}
                        serviceCounts={inventoryStats.serviceCounts}
                    />
                </div>
            </div>

            {/* ROW 4: Actionable Client Lists (PRESERVED LOGIC & TELEGRAM/CALENDAR ACTIONS) */}
            <div id="expiring-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="min-h-[460px] animate-slide-in-bottom" style={{animationDelay: '360ms'}}>
                    <ExpiringClientsList clients={clients} onRemind={handleSendExpiryReminder} />
                </div>
                
                <div className="min-h-[460px] animate-slide-in-bottom" style={{animationDelay: '400ms'}}>
                    <DebtorsList debtors={globalStats.debtors} onRemind={handleSendDebtReminder} />
                </div>
            </div>
        </div>
    );
};