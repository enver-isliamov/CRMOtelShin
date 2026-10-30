import React, { useState, useEffect, useMemo } from 'react';
import { Client, parseDate } from '../../types';
import { Card } from './Card';

// Custom hook to animate numbers - for smooth transitions
const useAnimatedCounter = (endValue: number, duration = 990) => {
    const [count, setCount] = useState(0);
    const frameRef = React.useRef<number | null>(null);

    useEffect(() => {
        // Set initial value without animation on first load
        if (count === 0 && endValue > 0) {
            setCount(endValue);
            return;
        }

        const startValue = count;
        let startTime: number | null = null;
        
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            
            const easedPercentage = 1 - Math.pow(1 - percentage, 2); // easeOutQuad
            const currentValue = startValue + (endValue - startValue) * easedPercentage;
            
            setCount(currentValue);

            if (progress < duration) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [endValue]);

    return count;
};

const TrendingUpIcon: React.FC<{className?: string}> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-.625m3.75.625l-6.25 3.75" /></svg>;

interface TotalEarningsCounterProps {
    clients: Client[];
    totalArchivedRevenue: number;
    firstDealDate: Date | null;
}

export const TotalEarningsCounter: React.FC<TotalEarningsCounterProps> = ({ clients, totalArchivedRevenue, firstDealDate }) => {
    const [liveValue, setLiveValue] = useState(0);

    useEffect(() => {
        const calculateProRata = () => {
            const now = new Date().getTime();
            const proRataRevenue = clients.reduce((acc, c) => {
                const startDate = parseDate(c['Начало']);
                const endDate = parseDate(c['Окончание']);
                
                if (!startDate || !endDate || endDate <= startDate) {
                    // if contract has no duration or is finished before it starts, do not count pro-rata
                    return acc;
                };

                const totalDuration = endDate.getTime() - startDate.getTime();
                if (totalDuration <= 0) return acc;

                const elapsedDuration = now - startDate.getTime();

                // Clamp progress between 0% and 100%
                const progress = Math.max(0, Math.min(elapsedDuration / totalDuration, 1));
                
                return acc + (c['Общая сумма'] || 0) * progress;
            }, 0);

            setLiveValue(totalArchivedRevenue + proRataRevenue);
        };
        
        const intervalId = setInterval(calculateProRata, 1000);
        calculateProRata(); // Initial calculation

        return () => clearInterval(intervalId);
    }, [clients, totalArchivedRevenue]);
    
    const animatedDisplayValue = useAnimatedCounter(liveValue);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    }
    
    return (
        <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between bg-gradient-to-br from-primary-600 to-indigo-700 dark:from-primary-700 dark:to-indigo-800 text-white shadow-lg overflow-hidden relative border-0">
             {/* Top row: Title and Badge Icon */}
             <div className="flex items-start justify-between z-10 relative">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Всего заработано</p>
                    <h3 className="text-sm font-medium text-white/95 mt-0.5">Накопительный итог</h3>
                </div>
                <div className="flex-shrink-0 bg-white/20 text-white rounded-xl p-2.5 backdrop-blur-xs">
                    <TrendingUpIcon className="w-5 h-5" />
                </div>
             </div>

             {/* Middle row: Big animated counter */}
             <div className="mt-3 flex-grow z-10 relative">
                <p className="text-3xl sm:text-4xl font-black tracking-tight">{formatCurrency(animatedDisplayValue)}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
                    <span>активные и архивные договоры</span>
                </div>
             </div>

             {/* Bottom row: Deal start note */}
             <div className="mt-auto pt-3 z-10 relative border-t border-white/15">
                <p className="text-[11px] text-white/70">
                    {firstDealDate 
                        ? `Начало учета: с ${firstDealDate.toLocaleDateString('ru-RU')}`
                        : 'Расчет по всем сделкам'}
                </p>
             </div>

             {/* Decorative Background Icon */}
             <div className="absolute -bottom-6 -right-6 text-white/10 pointer-events-none">
                <TrendingUpIcon className="h-32 w-32 rotate-6" />
             </div>
        </Card>
    );
};