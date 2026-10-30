import React, { useState, useEffect, useRef } from 'react';
import { Card } from './Card';

// Custom hook to animate numbers
const useAnimatedCounter = (endValue: number, duration = 400) => {
    const [count, setCount] = useState(0);
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
    { id: 'sec', label: 'сек', fullLabel: 'в секунду', divisor: 30 * 24 * 60 * 60 },
    { id: 'min', label: 'мин', fullLabel: 'в минуту', divisor: 30 * 24 * 60 },
    { id: 'hour', label: 'час', fullLabel: 'в час', divisor: 30 * 24 },
    { id: 'day', label: 'день', fullLabel: 'в день', divisor: 30 },
    { id: 'week', label: 'нед', fullLabel: 'в неделю', divisor: 30 / 7 },
    { id: 'month', label: 'мес', fullLabel: 'в месяц', divisor: 1 },
    { id: 'year', label: 'год', fullLabel: 'в год', divisor: 1/12 },
];

const ClockIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

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
    };
    
    return (
        <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-lg overflow-hidden relative border-0">
            {/* Top row: Title and Badge Icon */}
            <div className="flex items-start justify-between z-10 relative">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Доход в реальном времени</p>
                    <h3 className="text-sm font-medium text-white/95 mt-0.5">Текущий темп поступлений</h3>
                </div>
                <div className="flex-shrink-0 bg-white/20 text-white rounded-xl p-2.5 backdrop-blur-xs">
                    <ClockIcon className="w-5 h-5 animate-spin-slow" />
                </div>
            </div>

            {/* Middle row: Big animated counter */}
            <div className="mt-3 flex-grow z-10 relative">
                <p className="text-3xl sm:text-4xl font-black tracking-tight">{formatCurrency(animatedValue)}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-white/80">
                    <span>в пересчете:</span>
                    <span className="font-semibold text-white bg-white/20 px-2 py-0.5 rounded-md">
                        {currentRate.fullLabel}
                    </span>
                </div>
            </div>
            
            {/* Bottom row: 7-slot segmented control */}
            <div className="mt-auto pt-3 z-10 relative border-t border-white/15">
                <div className="grid grid-cols-7 gap-1 p-1 bg-black/25 rounded-xl backdrop-blur-xs">
                    {RATES.map(rate => {
                        const isActive = activeRateId === rate.id;
                        return (
                            <button
                                key={rate.id}
                                type="button"
                                onClick={() => setActiveRateId(rate.id)}
                                className={`py-1 text-center font-semibold rounded-lg transition-all duration-150 text-[11px] sm:text-xs ${
                                    isActive 
                                        ? 'bg-white text-teal-800 shadow-sm font-bold' 
                                        : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                                title={`Доход ${rate.fullLabel}`}
                            >
                                {rate.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Decorative Background Icon */}
            <div className="absolute -bottom-6 -right-6 text-white/10 pointer-events-none">
                <ClockIcon className="h-32 w-32" />
            </div>
        </Card>
    );
};