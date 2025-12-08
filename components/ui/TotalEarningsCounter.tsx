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
        <Card className="h-full bg-gradient-to-br from-primary-600 to-indigo-700 dark:from-primary-700 dark:to-indigo-800 text-white shadow-lg overflow-hidden relative">
             <div className="z-10 relative">
                <dl>
                    <dt className="text-sm font-medium text-white/80 truncate">Всего заработано</dt>
                    <dd className="text-3xl sm:text-4xl font-bold tracking-tight mt-1">
                        {formatCurrency(animatedDisplayValue)}
                    </dd>
                    <dd className="text-xs text-white/60 mt-1">
                        {firstDealDate 
                            ? `с ${firstDealDate.toLocaleDateString('ru-RU')}`
                            : 'Нет данных для расчета'}
                    </dd>
                </dl>
             </div>
             <div className="absolute -bottom-4 -right-4 sm:-bottom-8 sm:-right-8 text-white/10 pointer-events-none">
                <TrendingUpIcon className="h-24 w-24 sm:h-40 sm:w-40" />
            </div>
        </Card>
    );
};