
import React, { useState, useEffect, useRef } from 'react';

interface SmartTireInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  season?: 'Лето' | 'Зима';
  onSeasonChange?: (season: 'Лето' | 'Зима') => void;
  tireCount?: number;
  onTireCountChange?: (count: number) => void;
  hasRims?: 'Да' | 'Нет';
  onHasRimsChange?: (val: 'Да' | 'Нет') => void;
}

// --- ICONS ---
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>;
const SnowflakeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25v6M12 15.75v6M4.5 12h5.25M14.25 12h5.25M6.375 6.375l3.712 3.713M13.913 13.913l3.712 3.712M6.375 17.625l3.712-3.712M13.913 10.088l3.712-3.713" /></svg>;
const DiscIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 8.625a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM12 12a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;


// --- CONSTANTS ---
const COMMON_WIDTHS = ['135', '145', '155', '165', '175', '185', '195', '205', '215', '225', '235', '245', '255', '265', '275', '285', '295', '305', '315', '325'];
const COMMON_PROFILES = ['25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80', '85', '90'];
const COMMON_DIAMETERS = ['12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'];
const TIRE_COUNTS = [1, 2, 3, 4, 5, 6, 8];

// Helper to parse the composite string
const parseValue = (value: string) => {
    const parts = value.split('>>');
    const brandAndModelPart = (parts[0] || '').trim();
    const sizePart = (parts[1] || '').trim();
    
    const firstSpaceIndex = brandAndModelPart.indexOf(' ');
    let parsedBrand = '', parsedModel = '';
    if (firstSpaceIndex > -1) {
        parsedBrand = brandAndModelPart.substring(0, firstSpaceIndex);
        parsedModel = brandAndModelPart.substring(firstSpaceIndex + 1);
    } else {
        parsedBrand = brandAndModelPart;
    }
    
    const sizeMatch = sizePart.match(/(\d+)\/?(\d*)[R]?(\d*)/);
    let parsedWidth = '', parsedProfile = '', parsedDiameter = '';
    if (sizeMatch) {
      parsedWidth = sizeMatch[1] || '';
      parsedProfile = sizeMatch[2] || '';
      parsedDiameter = sizeMatch[3] || '';
    }

    return { brand: parsedBrand, model: parsedModel, width: parsedWidth, profile: parsedProfile, diameter: parsedDiameter };
};

// Sub-component for a single interactive parameter
const TireParamSelector: React.FC<{
    label: string;
    value: string | number;
    options: (string | number)[];
    onSelect: (val: string) => void;
    isActive: boolean;
    onToggle: () => void;
    suffix?: string;
}> = ({ label, value, options, onSelect, isActive, onToggle, suffix }) => {
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                if (isActive) onToggle();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isActive, onToggle]);

    return (
        <div className="relative flex flex-col items-center group" ref={wrapperRef}>
            {/* Always render the label span to maintain height, use invisible char if empty */}
            <span className="text-[10px] uppercase text-gray-400 font-medium tracking-wider mb-1 select-none min-h-[15px]">{label || '\u00A0'}</span>
            
            {/* Fixed height container for value to align baseline */}
            <div className="h-8 sm:h-10 flex items-end">
                <button
                    type="button"
                    onClick={onToggle}
                    className={`flex items-baseline font-black leading-none border-b-2 transition-all duration-200 pb-1 ${
                        isActive 
                        ? 'text-primary-600 border-primary-500 scale-110' 
                        : 'text-gray-800 dark:text-gray-100 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                >
                    <span className="text-xl sm:text-3xl">{value || '---'}</span>
                    {suffix && <span className="text-xs sm:text-lg font-normal text-gray-500 ml-0.5">{suffix}</span>}
                </button>
            </div>
            
            {isActive && (
                <div className={`
                    fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90vw] max-w-[320px] 
                    sm:absolute sm:top-full sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-0 sm:mt-2 sm:z-50 sm:w-[320px]
                    bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 
                    animate-in fade-in zoom-in-95 duration-100
                `}>
                    <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto no-scrollbar">
                        {options.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => { onSelect(String(opt)); onToggle(); }}
                                className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                                    String(value) === String(opt)
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                                }`}
                            >
                                {opt}{suffix}
                            </button>
                        ))}
                    </div>
                    {/* Only show manual input if options are strings (simplified check for tire params) */}
                    {typeof options[0] === 'string' && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                            <input 
                                type="number" 
                                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:text-white"
                                placeholder="Свой вариант..."
                                onChange={(e) => onSelect(e.target.value)}
                            />
                            <button 
                                onClick={onToggle}
                                className="px-3 py-1 bg-primary-100 text-primary-700 rounded text-xs font-bold uppercase"
                            >
                                OK
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


export const SmartTireInput: React.FC<SmartTireInputProps> = ({ 
    value, onChange, label, 
    season, onSeasonChange,
    tireCount, onTireCountChange,
    hasRims, onHasRimsChange
}) => {
  const [internalState, setInternalState] = useState(parseValue(value));
  const [activeParam, setActiveParam] = useState<string | null>(null);

  useEffect(() => {
    setInternalState(parseValue(value));
  }, [value]);

  const updateState = (key: keyof typeof internalState, val: string) => {
    const nextState = { ...internalState, [key]: val };
    setInternalState(nextState); // Optimistic update

    const brandAndModelPart = `${nextState.brand} ${nextState.model}`.trim();
    let sizePart = '';
    if (nextState.width || nextState.profile || nextState.diameter) {
        sizePart = `${nextState.width}/${nextState.profile}R${nextState.diameter}`;
    }
    
    const finalOutput = `${brandAndModelPart} >> ${sizePart}`;
    if (finalOutput !== value) {
        onChange(finalOutput);
    }
  };

  const toggleParam = (param: string) => {
      setActiveParam(activeParam === param ? null : param);
  };
  
  const toggleSeason = () => {
      if (onSeasonChange) {
          onSeasonChange(season === 'Лето' ? 'Зима' : 'Лето');
      }
  };

  const toggleRims = () => {
      if (onHasRimsChange) {
          onHasRimsChange(hasRims === 'Да' ? 'Нет' : 'Да');
      }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      
      {/* Top: Brand & Model Inputs */}
      <div className="grid grid-cols-2 gap-4">
          <div>
              <input
                type="text"
                value={internalState.brand}
                onChange={(e) => updateState('brand', e.target.value)}
                placeholder="Бренд (Michelin)"
                className="block w-full border-0 border-b-2 border-gray-200 dark:border-gray-700 bg-transparent py-1.5 px-0 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-0 focus:border-primary-500 transition-colors sm:text-sm"
              />
          </div>
          <div>
              <input
                type="text"
                value={internalState.model}
                onChange={(e) => updateState('model', e.target.value)}
                placeholder="Модель (X-Ice)"
                className="block w-full border-0 border-b-2 border-gray-200 dark:border-gray-700 bg-transparent py-1.5 px-0 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-0 focus:border-primary-500 transition-colors sm:text-sm"
              />
          </div>
      </div>

      {/* Main Interactive String */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-nowrap items-end justify-center gap-x-0.5 sm:gap-x-4 select-none">
          
          {tireCount !== undefined && onTireCountChange && (
              <>
                <TireParamSelector 
                    label="Кол-во"
                    value={tireCount} 
                    options={TIRE_COUNTS} 
                    onSelect={(v) => onTireCountChange(Number(v))}
                    isActive={activeParam === 'count'}
                    onToggle={() => toggleParam('count')}
                    suffix=" шт"
                />
                <div className="flex flex-col justify-end pb-1 h-full mx-1 sm:mx-2">
                    <span className="min-h-[15px] mb-1"></span>
                    <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
                </div>
              </>
          )}

          <TireParamSelector 
            label="" 
            value={internalState.width} 
            options={COMMON_WIDTHS} 
            onSelect={(v) => updateState('width', v)}
            isActive={activeParam === 'width'}
            onToggle={() => toggleParam('width')}
          />

          <div className="flex flex-col items-center justify-end pb-1">
             <span className="min-h-[15px] mb-1"></span>
             <span className="text-xl sm:text-2xl text-gray-300 font-light leading-none">/</span>
          </div>

          <TireParamSelector 
            label="" 
            value={internalState.profile} 
            options={COMMON_PROFILES} 
            onSelect={(v) => updateState('profile', v)}
            isActive={activeParam === 'profile'}
            onToggle={() => toggleParam('profile')}
          />

          <div className="flex flex-col items-center justify-end pb-1">
             <span className="min-h-[15px] mb-1"></span>
             <span className="text-lg sm:text-2xl font-bold text-gray-400 leading-none">R</span>
          </div>

          <TireParamSelector 
            label="" 
            value={internalState.diameter} 
            options={COMMON_DIAMETERS} 
            onSelect={(v) => updateState('diameter', v)}
            isActive={activeParam === 'diameter'}
            onToggle={() => toggleParam('diameter')}
          />
          
          {(onSeasonChange || onHasRimsChange) && (
              <div className="flex flex-col justify-end pb-1 h-full mx-1 sm:mx-2">
                  <span className="min-h-[15px] mb-1"></span>
                  <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
              </div>
          )}

          {hasRims && onHasRimsChange && (
              <div className="flex flex-col items-center group">
                <span className="text-[10px] uppercase text-gray-400 font-medium tracking-wider mb-1 opacity-50 min-h-[15px]">Диски</span>
                <div className="h-8 sm:h-10 flex items-end pb-1">
                    <button
                        type="button"
                        onClick={toggleRims}
                        className={`flex items-center gap-1 leading-none group transition-transform active:scale-95 px-1 ${hasRims === 'Да' ? 'text-gray-800 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}
                    >
                        <DiscIcon />
                    </button>
                </div>
              </div>
          )}

          {season && onSeasonChange && (
              <div className="flex flex-col items-center group ml-1 sm:ml-2">
                <span className="text-[10px] uppercase text-gray-400 font-medium tracking-wider mb-1 opacity-50 min-h-[15px]">Сезон</span>
                <div className="h-8 sm:h-10 flex items-end pb-1">
                    <button
                        type="button"
                        onClick={toggleSeason}
                        className={`flex items-center gap-1 leading-none group transition-transform active:scale-95 px-1 ${season === 'Лето' ? 'text-amber-500' : 'text-sky-500'}`}
                    >
                        {season === 'Лето' ? <SunIcon/> : <SnowflakeIcon/>}
                    </button>
                </div>
              </div>
          )}
          
      </div>
    </div>
  );
};
