import React, { useState, useEffect, useRef } from 'react';
import { SmartTireInput } from './SmartTireInput';
import { TireGroup, PRICE_BY_DIAMETER, DEFAULT_PRICE } from '../../types';
import { Button } from './Button';

interface MultiTireInputProps {
  groups: TireGroup[];
  onGroupsChange: (groups: TireGroup[]) => void;
  onDraftChange: (draft: TireGroup | null) => void;
}

import { 
  TrashIcon, 
  PlusIcon, 
  CheckIcon, 
  EditIcon, 
  SunIcon as SunSmallIcon, 
  SnowflakeIcon as SnowflakeSmallIcon 
} from '../icons/Icons';


export const MultiTireInput: React.FC<MultiTireInputProps> = ({ groups, onGroupsChange, onDraftChange }) => {
  const [currentValue, setCurrentValue] = useState('');
  const [currentSeason, setCurrentSeason] = useState<'Лето' | 'Зима'>('Лето');
  const [currentCount, setCurrentCount] = useState<number>(4);
  const [currentHasRims, setCurrentHasRims] = useState<'Да' | 'Нет'>('Нет');
  const [dotInputs, setDotInputs] = useState<string[]>(Array(4).fill(''));
  
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(groups.length === 0);

  // Ref to track the last notified draft to prevent infinite loops
  const prevDraftJSON = useRef<string>('');

  // Automatically open form if last group is removed
  useEffect(() => {
      if (groups.length === 0 && !isFormOpen) {
          setIsFormOpen(true);
      }
  }, [groups.length]);

  const parseValue = (val: string) => {
    const parts = val.split('>>');
    const brandAndModelPart = (parts[0] || '').trim();
    const sizePart = (parts[1] || '').trim();
    
    const firstSpaceIndex = brandAndModelPart.indexOf(' ');
    let brand = '', model = '';
    if (firstSpaceIndex > -1) {
        brand = brandAndModelPart.substring(0, firstSpaceIndex);
        model = brandAndModelPart.substring(firstSpaceIndex + 1);
    } else {
        brand = brandAndModelPart;
    }
    
    const sizeMatch = sizePart.match(/(\d+)\/?(\d*)[R]?(\d*)/);
    let width = '', profile = '', diameter = '';
    if (sizeMatch) {
      width = sizeMatch[1] || '';
      profile = sizeMatch[2] || '';
      diameter = sizeMatch[3] || '';
    }
    return { brand, model, width, profile, diameter };
  };

  const calculatePrice = (diameter: string) => {
      return PRICE_BY_DIAMETER[diameter] || DEFAULT_PRICE;
  };

  useEffect(() => {
      const { brand, model, width, profile, diameter } = parseValue(currentValue);
      
      const draft: TireGroup = {
          id: editingGroupId || 'draft',
          brand: brand || '',
          model: model || '',
          width,
          profile,
          diameter,
          count: currentCount,
          season: currentSeason,
          hasRims: currentHasRims,
          pricePerMonth: diameter ? calculatePrice(diameter) : 0,
          dot: dotInputs.filter(Boolean).join(' / ')
      };
      
      const payload = isFormOpen ? draft : null;
      const payloadJSON = JSON.stringify(payload);

      // CRITICAL: Only call onDraftChange if the object actually changed.
      // This prevents infinite render loops with the parent component.
      if (prevDraftJSON.current !== payloadJSON) {
          prevDraftJSON.current = payloadJSON;
          onDraftChange(payload);
      }
  }, [currentValue, currentSeason, currentCount, currentHasRims, dotInputs, isFormOpen, editingGroupId, onDraftChange]);

  useEffect(() => {
      setDotInputs(prev => {
          const newArr = [...prev];
          if (newArr.length < currentCount) {
              while(newArr.length < currentCount) newArr.push('');
          } else if (newArr.length > currentCount) {
              return newArr.slice(0, currentCount);
          }
          return newArr;
      });
  }, [currentCount]);

  const handleDotChange = (index: number, val: string) => {
      const newDots = [...dotInputs];
      newDots[index] = val;
      setDotInputs(newDots);
  };

  const resetForm = () => {
      setCurrentValue(''); 
      setCurrentCount(4); 
      setDotInputs(Array(4).fill(''));
      setEditingGroupId(null);
  };

  const handleSaveGroup = () => {
    const { brand, model, width, profile, diameter } = parseValue(currentValue);
    if (!diameter) return;

    const combinedDot = dotInputs.map(d => d.trim()).filter(Boolean).length > 0 
        ? dotInputs.map(d => d.trim() || '?').join(' / ')
        : '';

    const newGroup: TireGroup = {
        id: editingGroupId || `g-${Date.now()}`,
        brand: brand || 'Не указан',
        model: model || '',
        width,
        profile,
        diameter,
        count: currentCount,
        season: currentSeason,
        hasRims: currentHasRims,
        pricePerMonth: calculatePrice(diameter),
        dot: combinedDot
    };

    if (editingGroupId) {
        onGroupsChange(groups.map(g => g.id === editingGroupId ? newGroup : g));
    } else {
        onGroupsChange([...groups, newGroup]);
    }
    
    resetForm();
    setIsFormOpen(false);
  };

  const handleEditGroup = (group: TireGroup) => {
      setEditingGroupId(group.id);
      
      const brandModel = `${group.brand} ${group.model}`.trim();
      const size = `${group.width}/${group.profile}R${group.diameter}`;
      setCurrentValue(`${brandModel} >> ${size}`);
      
      setCurrentSeason(group.season);
      setCurrentCount(group.count);
      setCurrentHasRims(group.hasRims);
      
      if (group.dot) {
          const parts = group.dot.split('/').map(s => s.trim());
          while(parts.length < group.count) parts.push('');
          setDotInputs(parts.slice(0, group.count));
      } else {
          setDotInputs(Array(group.count).fill(''));
      }
      
      setIsFormOpen(true);
  };

  const handleRemoveGroup = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (editingGroupId === id) {
          handleCancel();
      }
      onGroupsChange(groups.filter(g => g.id !== id));
  };

  const handleCancel = () => {
      resetForm();
      if (groups.length > 0) {
          setIsFormOpen(false);
      }
  };

  const handleAddNew = () => {
      resetForm();
      setIsFormOpen(true);
  };

  const isInputValid = () => {
      const { diameter } = parseValue(currentValue);
      return !!diameter;
  };

  return (
    <div className="space-y-4">
        {/* List of Added Groups */}
        {groups.length > 0 && (
            <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">
                    <span>Добавленные шины ({groups.reduce((acc, g) => acc + g.count, 0)} шт)</span>
                    {groups.length > 1 && <span className="text-primary-600 dark:text-primary-400">Разноширокий комплект</span>}
                </div>
                
                {groups.map((group, index) => {
                    const groupLabel = groups.length > 1 
                        ? (index === 0 ? 'Передняя ось' : index === 1 ? 'Задняя ось' : `Группа ${index + 1}`)
                        : 'Основной комплект';

                    const isEditing = editingGroupId === group.id;

                    return (
                        <div 
                            key={group.id} 
                            onClick={() => handleEditGroup(group)}
                            className={`
                                group relative p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs
                                ${isEditing 
                                    ? 'bg-primary-50/70 border-primary-500 ring-2 ring-primary-500/30 dark:bg-primary-950/30 dark:border-primary-500' 
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                                }
                            `}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    {/* Top meta tags */}
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/80 px-2 py-0.5 rounded-md">
                                            {groupLabel}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/80 px-2 py-0.5 rounded-md">
                                            {group.season === 'Лето' ? <SunSmallIcon /> : <SnowflakeSmallIcon />}
                                            {group.season}
                                        </span>
                                        {group.hasRims === 'Да' && (
                                            <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                                                С дисками
                                            </span>
                                        )}
                                    </div>

                                    {/* Brand & Model + Dimensions */}
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="text-base font-bold text-gray-900 dark:text-white">
                                            {group.brand} {group.model}
                                        </span>
                                        <span className="text-sm font-mono font-semibold text-primary-600 dark:text-primary-400">
                                            {group.width}/{group.profile} R{group.diameter}
                                        </span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                            {group.count} шт
                                        </span>
                                    </div>

                                    {/* DOT Codes Preview */}
                                    {group.dot && (
                                        <div className="text-xs text-gray-400 dark:text-gray-400 font-mono mt-1.5 flex items-center gap-1 truncate">
                                            <span className="text-[10px] font-sans font-semibold text-gray-400 uppercase">DOT:</span>
                                            <span>{group.dot}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {isEditing ? (
                                        <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 animate-pulse px-2 py-1">
                                            Изменяется...
                                        </span>
                                    ) : (
                                        <button 
                                            type="button" 
                                            onClick={(e) => { e.stopPropagation(); handleEditGroup(group); }}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            title="Редактировать группу"
                                        >
                                            <EditIcon />
                                        </button>
                                    )}
                                    <button 
                                        type="button" 
                                        onClick={(e) => handleRemoveGroup(group.id, e)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                        title="Удалить группу"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Add Group Button (when form closed) */}
        {!isFormOpen && (
            <button
                type="button"
                onClick={handleAddNew}
                className="w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-xl text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 bg-gray-50/70 dark:bg-gray-800/40 hover:bg-primary-50/30 dark:hover:bg-primary-950/20 transition-all flex items-center justify-center gap-2 font-medium text-sm shadow-2xs"
            >
                <PlusIcon />
                <span>Добавить группу шин / разноширокую ось</span>
            </button>
        )}

        {/* Edit/Create Form Block */}
        {isFormOpen && (
            <div className={`p-4 sm:p-5 rounded-xl border bg-white dark:bg-gray-800 shadow-sm transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
                editingGroupId 
                    ? 'border-primary-500 ring-2 ring-primary-500/20' 
                    : 'border-gray-200 dark:border-gray-700'
            }`}>
                <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary-600 dark:bg-primary-400 animate-ping" />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {editingGroupId ? "Редактирование параметров шин" : "Параметры комплекта шин"}
                        </span>
                    </div>
                    {groups.length > 0 && (
                        <button 
                            type="button" 
                            onClick={handleCancel} 
                            className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium hover:underline px-2 py-1"
                        >
                            Отменить
                        </button>
                    )}
                </div>
                
                <SmartTireInput
                    label=""
                    value={currentValue}
                    onChange={setCurrentValue}
                    season={currentSeason}
                    onSeasonChange={setCurrentSeason}
                    tireCount={currentCount}
                    onTireCountChange={setCurrentCount}
                    hasRims={currentHasRims}
                    onHasRimsChange={setCurrentHasRims}
                />
                
                {/* DOT Codes Grid - Separated per tire */}
                <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                            DOT-коды шин (неделя и год выпуска)
                        </label>
                        <span className="text-[11px] text-gray-400">по 4 цифры, напр. 4223</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {dotInputs.map((dot, idx) => (
                            <div key={idx} className="relative">
                                <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-bold select-none">
                                    #{idx + 1}
                                </span>
                                <input 
                                    type="text"
                                    value={dot}
                                    onChange={(e) => handleDotChange(idx, e.target.value)}
                                    placeholder="4523"
                                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-2xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 py-1.5 pl-8 pr-2 text-sm dark:bg-gray-800 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 text-center font-mono uppercase transition-colors"
                                    maxLength={4}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Action Controls */}
                <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2.5">
                    {groups.length > 0 && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            Закрыть
                        </button>
                    )}
                    <Button 
                        type="button" 
                        variant="primary"
                        size="md"
                        onClick={handleSaveGroup}
                        disabled={!isInputValid()}
                        className={!isInputValid() ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                        {editingGroupId ? <CheckIcon /> : <PlusIcon />} 
                        <span className="ml-1.5 font-semibold">
                            {editingGroupId ? "Сохранить изменения" : "Добавить в заказ"}
                        </span>
                    </Button>
                </div>
            </div>
        )}
    </div>
  );
};
