

import React, { useState, useEffect, useRef } from 'react';

// Custom hook to animate numbers
const useAnimatedCounter = (endValue: number, duration = 400) => {
    const [count, setCount] = useState(0); // FIX: Start from 0 for initial animation
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        const startValue = count;
        let startTime: number | null = null;
        
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            
            // Ease-out function for smoother animation
            const easedPercentage = 1 - Math.pow(1 - percentage, 3);
            const currentValue = startValue + (endValue - startValue) * easedPercentage;
            
            setCount(currentValue);

            if (progress < duration) {
                frameRef.current = requestAnimationFrame(animate);
            } else {
                setCount(endValue); // Ensure it ends on the exact value
            }
        };
        
        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }
        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [endValue, duration]);

    return count;
};

interface LiveIncomeCounterProps {
    monthlyIncome: number;
}

const RATES = [
    { id: 'sec', label: 'сек', divisor: 30 * 24 * 60 * 60 },
    { id: 'min', label: 'мин', divisor: 30 * 24 * 60 },
    { id: 'hour', label: 'час', divisor: 30 * 24 },
    { id: 'day', label: 'день', divisor: 30 },
    { id: 'week', label: 'нед', divisor: 30 / 7 },
    { id: 'month', label: 'мес', divisor: 1 },
    { id: 'year', label: 'год', divisor: 1/12 },
];

const ClockIcon: React.FC<{className?: string}> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

export const LiveIncomeCounter: React.FC<LiveIncomeCounterProps> = ({ monthlyIncome }) => {
    const [activeRateId, setActiveRateId] = useState('hour');

    const currentRate = RATES.find(r => r.id === activeRateId) || RATES[2];
    const targetValue = monthlyIncome / currentRate.divisor;
    const animatedValue = useAnimatedCounter(targetValue, 400);
    
    const formatCurrency = (value: number) => {
        const options: Intl.NumberFormatOptions = {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: value < 10 ? 2 : 0,
            maximumFractionDigits: value < 10 ? 2 : 0,
        };
        return new Intl.NumberFormat('ru-RU', options).format(value);
    }
    
    return (
        <div className="h-full relative overflow-hidden">
            <div className="z-10 relative">
                <dl>
                    <dt className="text-sm font-medium text-white/80 truncate">Доход в реальном времени</dt>
                    <dd className="text-3xl font-bold tracking-tight">
                        {formatCurrency(animatedValue)}
                    </dd>
                </dl>
                <div className="mt-4 flex items-center space-x-1">
                    {RATES.map(rate => (
                       <button
                         key={rate.id}
                         onClick={() => setActiveRateId(rate.id)}
                         className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                            activeRateId === rate.id 
                                ? 'bg-white text-cyan-600 shadow' 
                                : 'bg-white/20 text-white/80 hover:bg-white/40'
                         }`}
                       >
                           {rate.label}
                       </button>
                    ))}
                </div>
            </div>
            
            <div className="absolute -bottom-4 -right-4 text-white/10">
                <ClockIcon className="h-28 w-28 animate-spin-slow" />
            </div>
        </div>
    );
};
