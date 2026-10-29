import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TIRE_DATA } from '../../data/brands';

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

// --- CANONICAL ICONS ---
import { SunIcon, SnowflakeIcon, DiscIcon } from '../icons/Icons';


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

// Sub-component for a single interactive parameter selector
const TireParamSelector: React.FC<{
    label: string;
    value: string | number;
    options: (string | number)[];
    onSelect: (val: string) => void;
    isActive: boolean;
    onToggle: () => void;
    suffix?: string;
    placeholder?: string;
}> = ({ label, value, options, onSelect, isActive, onToggle, suffix, placeholder = '---' }) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [customVal, setCustomVal] = useState('');

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
            <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1 select-none text-center">
                {label || '\u00A0'}
            </span>
            
            <button
                type="button"
                onClick={onToggle}
                className={`min-w-[50px] sm:min-w-[64px] h-10 sm:h-11 px-2.5 rounded-lg border font-mono font-bold text-base sm:text-xl transition-all duration-150 flex items-center justify-center gap-0.5 select-none ${
                    isActive 
                        ? 'bg-primary-600 text-white border-primary-600 shadow-md ring-2 ring-primary-400/40 scale-105' 
                        : value 
                            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:border-primary-500 hover:shadow-xs' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
            >
                <span>{value || placeholder}</span>
                {suffix && <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{suffix}</span>}
            </button>
            
            {isActive && (
                <>
                    {/* Mobile backdrop overlay */}
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[99] sm:hidden" onClick={onToggle} />
                    
                    <div className={`
                        fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90vw] max-w-[320px] 
                        sm:absolute sm:top-full sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-0 sm:mt-2 sm:z-50 sm:w-[300px]
                        bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 
                        animate-in fade-in zoom-in-95 duration-100
                    `}>
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Выберите {label.toLowerCase() || 'значение'}
                            </span>
                            <button
                                type="button"
                                onClick={onToggle}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1 py-0.5"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-1.5 max-h-[220px] overflow-y-auto no-scrollbar py-1">
                            {options.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => { onSelect(String(opt)); onToggle(); }}
                                    className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                                        String(value) === String(opt)
                                        ? 'bg-primary-600 text-white shadow-xs'
                                        : 'bg-gray-100 dark:bg-gray-700/80 text-gray-800 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300'
                                    }`}
                                >
                                    {opt}{suffix}
                                </button>
                            ))}
                        </div>

                        {typeof options[0] === 'string' && (
                            <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700 flex gap-1.5">
                                <input 
                                    type="text" 
                                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1 text-sm dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="Свой вариант..."
                                    value={customVal}
                                    onChange={(e) => setCustomVal(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && customVal.trim()) {
                                            onSelect(customVal.trim());
                                            onToggle();
                                        }
                                    }}
                                />
                                <button 
                                    type="button"
                                    onClick={() => {
                                        if (customVal.trim()) {
                                            onSelect(customVal.trim());
                                            onToggle();
                                        }
                                    }}
                                    className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold"
                                >
                                    OK
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export const SmartTireInput: React.FC<SmartTireInputProps> = ({ 
    value, onChange, label, 
    season, onSeasonChange,
    tireCount, onTireCountChange,
    hasRims, onHasRimsChange
}) => {
  const [internalState, setInternalState] = useState(parseValue(value));
  const [activeParam, setActiveParam] = useState<string | null>(null);
  
  // Refs for Brand/Model Inputs
  const brandInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);

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
  };

  // --- BRAND SUGGESTION LOGIC ---
  const brandNames = useMemo(() => TIRE_DATA.map(d => d.brand), []);
  const filteredBrands = useMemo(() => {
      if (!internalState.brand) return [];
      const query = internalState.brand.toLowerCase();
      return brandNames.filter(b => b.toLowerCase().startsWith(query)).slice(0, 20); 
  }, [internalState.brand, brandNames]);

  const handleBrandSelect = (brand: string) => {
      updateState('brand', brand);
      updateState('model', ''); // Reset model on brand change
      setShowBrandSuggestions(false);
      if (modelInputRef.current) {
          modelInputRef.current.focus();
      }
  };

  const handleBrandBlur = () => {
      setTimeout(() => setShowBrandSuggestions(false), 200);
  };

  // --- MODEL SUGGESTION LOGIC ---
  const filteredModels = useMemo(() => {
      const selectedBrandData = TIRE_DATA.find(d => d.brand.toLowerCase() === internalState.brand.toLowerCase());
      if (selectedBrandData && selectedBrandData.models) {
          const query = (internalState.model || '').toLowerCase();
          return selectedBrandData.models.filter(m => m.toLowerCase().startsWith(query)).slice(0, 20);
      }
      return [];
  }, [internalState.brand, internalState.model]);

  const handleModelSelect = (model: string) => {
      updateState('model', model);
      setShowModelSuggestions(false);
  };

  const handleModelBlur = () => {
      setTimeout(() => setShowModelSuggestions(false), 200);
  };

  return (
    <div className="space-y-4">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      
      {/* Top: Brand & Model Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Бренд шин
              </label>
              <div className="relative">
                  <input
                    ref={brandInputRef}
                    type="text"
                    value={internalState.brand}
                    onChange={(e) => {
                        updateState('brand', e.target.value);
                        setShowBrandSuggestions(true);
                    }}
                    onFocus={() => setShowBrandSuggestions(true)}
                    onBlur={handleBrandBlur}
                    placeholder="Michelin, Nokian, Pirelli..."
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors shadow-xs"
                  />
                  {showBrandSuggestions && filteredBrands.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 text-sm divide-y divide-gray-100 dark:divide-gray-700/40">
                          {filteredBrands.map(brand => (
                              <li 
                                key={brand}
                                onMouseDown={(e) => {
                                    e.preventDefault(); 
                                    handleBrandSelect(brand);
                                }}
                                className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-800 dark:text-gray-200 font-medium transition-colors"
                              >
                                  {brand}
                              </li>
                          ))}
                      </ul>
                  )}
              </div>
          </div>

          <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Модель
              </label>
              <div className="relative">
                  <input
                    ref={modelInputRef}
                    type="text"
                    value={internalState.model}
                    onChange={(e) => {
                        updateState('model', e.target.value);
                        setShowModelSuggestions(true);
                    }}
                    onFocus={() => setShowModelSuggestions(true)}
                    onBlur={handleModelBlur}
                    placeholder="X-Ice, Pilot Sport, Hakkapeliitta..."
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors shadow-xs"
                  />
                  {showModelSuggestions && filteredModels.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 text-sm divide-y divide-gray-100 dark:divide-gray-700/40">
                          {filteredModels.map(model => (
                              <li 
                                key={model}
                                onMouseDown={(e) => {
                                    e.preventDefault(); 
                                    handleModelSelect(model);
                                }}
                                className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-800 dark:text-gray-200 font-medium transition-colors"
                              >
                                  {model}
                              </li>
                          ))}
                      </ul>
                  )}
              </div>
          </div>
      </div>

      {/* Main Interactive Dimensions & Parameters Dashboard */}
      <div className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-gray-900/70 rounded-xl border border-gray-200 dark:border-gray-700/80 shadow-xs">
          <div className="flex flex-wrap items-center justify-between sm:justify-center gap-y-3 gap-x-2 sm:gap-x-4 select-none">
              
              {/* Count selector */}
              {tireCount !== undefined && onTireCountChange && (
                  <div className="flex items-center gap-2 sm:gap-3">
                      <TireParamSelector 
                          label="Кол-во"
                          value={tireCount} 
                          options={TIRE_COUNTS} 
                          onSelect={(v) => onTireCountChange(Number(v))}
                          isActive={activeParam === 'count'}
                          onToggle={() => toggleParam('count')}
                          suffix=" шт"
                      />
                      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mt-4 hidden xs:block" />
                  </div>
              )}

              {/* Dimensions: Width / Profile R Diameter */}
              <div className="flex items-center gap-1 sm:gap-2">
                  <TireParamSelector 
                    label="Ширина" 
                    value={internalState.width} 
                    options={COMMON_WIDTHS} 
                    onSelect={(v) => updateState('width', v)}
                    isActive={activeParam === 'width'}
                    onToggle={() => toggleParam('width')}
                  />

                  <div className="flex flex-col items-center justify-center mt-5 text-gray-300 dark:text-gray-600 font-light text-xl select-none">
                     /
                  </div>

                  <TireParamSelector 
                    label="Профиль" 
                    value={internalState.profile} 
                    options={COMMON_PROFILES} 
                    onSelect={(v) => updateState('profile', v)}
                    isActive={activeParam === 'profile'}
                    onToggle={() => toggleParam('profile')}
                  />

                  <div className="flex flex-col items-center justify-center mt-5 text-gray-400 dark:text-gray-500 font-bold text-base sm:text-lg select-none px-0.5">
                     R
                  </div>

                  <TireParamSelector 
                    label="Радиус" 
                    value={internalState.diameter} 
                    options={COMMON_DIAMETERS} 
                    onSelect={(v) => updateState('diameter', v)}
                    isActive={activeParam === 'diameter'}
                    onToggle={() => toggleParam('diameter')}
                  />
              </div>

              {/* Divider on desktop */}
              {(onSeasonChange || onHasRimsChange) && (
                  <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mt-4 hidden md:block" />
              )}

              {/* Season & Disks Toggles */}
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end sm:justify-start pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200/60 dark:border-gray-700/60">
                  {/* Season Toggle */}
                  {season && onSeasonChange && (
                      <div className="flex flex-col items-center">
                          <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1 select-none">
                              Сезон
                          </span>
                          <div className="flex p-0.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 h-10 sm:h-11 items-center shadow-xs">
                              <button
                                  type="button"
                                  onClick={() => onSeasonChange('Лето')}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                      season === 'Лето'
                                          ? 'bg-amber-500 text-white shadow-xs'
                                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                  }`}
                                  title="Летние шины"
                              >
                                  <SunIcon />
                                  <span className="hidden xs:inline">Лето</span>
                              </button>
                              <button
                                  type="button"
                                  onClick={() => onSeasonChange('Зима')}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                      season === 'Зима'
                                          ? 'bg-sky-500 text-white shadow-xs'
                                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                  }`}
                                  title="Зимние шины"
                              >
                                  <SnowflakeIcon />
                                  <span className="hidden xs:inline">Зима</span>
                              </button>
                          </div>
                      </div>
                  )}

                  {/* Disks Presence Toggle */}
                  {hasRims && onHasRimsChange && (
                      <div className="flex flex-col items-center">
                          <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1 select-none">
                              Диски
                          </span>
                          <button
                              type="button"
                              onClick={toggleRims}
                              className={`h-10 sm:h-11 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                                  hasRims === 'Да'
                                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-400 dark:border-indigo-600'
                                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                              }`}
                          >
                              <DiscIcon className={hasRims === 'Да' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                              <span>{hasRims === 'Да' ? 'С дисками' : 'Без дисков'}</span>
                          </button>
                      </div>
                  )}
              </div>

          </div>
      </div>
    </div>
  );
};