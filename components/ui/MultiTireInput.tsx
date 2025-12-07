
import React, { useState, useEffect } from 'react';
import { SmartTireInput } from './SmartTireInput';
import { TireGroup, PRICE_BY_DIAMETER, DEFAULT_PRICE } from '../../types';
import { Button } from './Button';

interface MultiTireInputProps {
  groups: TireGroup[];
  onGroupsChange: (groups: TireGroup[]) => void;
  onDraftChange: (draft: TireGroup | null) => void;
}

const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;

export const MultiTireInput: React.FC<MultiTireInputProps> = ({ groups, onGroupsChange, onDraftChange }) => {
  const [currentValue, setCurrentValue] = useState('');
  const [currentSeason, setCurrentSeason] = useState<'Лето' | 'Зима'>('Лето');
  const [currentCount, setCurrentCount] = useState<number>(4);
  const [currentHasRims, setCurrentHasRims] = useState<'Да' | 'Нет'>('Нет');
  const [dotInputs, setDotInputs] = useState<string[]>(Array(4).fill(''));
  
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(groups.length === 0);

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
      
      onDraftChange(isFormOpen ? draft : null);
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
  }

  const isInputValid = () => {
      const { diameter } = parseValue(currentValue);
      return !!diameter;
  };

  return (
    <div className="space-y-4">
        {/* List of Added Groups */}
        {groups.length > 0 && (
            <div className="space-y-2 mb-4">
                {groups.map((group) => (
                    <div 
                        key={group.id} 
                        onClick={() => handleEditGroup(group)}
                        className={`
                            relative flex items-center justify-between p-3 border rounded-lg shadow-sm cursor-pointer transition-all hover:border-gray-300 dark:hover:border-gray-600
                            ${editingGroupId === group.id 
                                ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500 dark:bg-primary-900/30' 
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }
                        `}
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900 dark:text-white">{group.count} шт</span>
                                <span className="text-gray-400">|</span>
                                <span className="font-semibold text-primary-600 dark:text-primary-400">{group.width}/{group.profile} R{group.diameter}</span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                {group.brand} {group.model} 
                                <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">
                                    {group.season}
                                </span>
                                {group.hasRims === 'Да' && <span className="ml-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Диски</span>}
                            </div>
                            {/* Short DOT preview */}
                            {group.dot && (
                                <div className="text-xs text-gray-400 font-mono mt-1 truncate max-w-[250px]">
                                    DOT: {group.dot}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {editingGroupId === group.id && (
                                <span className="text-xs font-bold text-primary-600 mr-2 animate-pulse">Редактируется...</span>
                            )}
                            <button 
                                type="button" 
                                onClick={(e) => handleRemoveGroup(group.id, e)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors z-10"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Add Button */}
        {!isFormOpen && (
            <button
                type="button"
                onClick={handleAddNew}
                className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-all flex items-center justify-center gap-2 font-medium bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800"
            >
                <PlusIcon /> Добавить группу шин / ось
            </button>
        )}

        {/* Edit/Create Block */}
        {isFormOpen && (
            <div className={`transition-all duration-300 animate-in fade-in slide-in-from-top-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-sm ring-1 ring-black/5 ${editingGroupId ? 'ring-primary-500 border-primary-500' : ''}`}>
                <div className="flex justify-between items-center mb-4">
                    <span className={`text-sm font-bold uppercase tracking-wider ${editingGroupId ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {editingGroupId ? "Редактирование группы" : "Новая группа шин"}
                    </span>
                    {groups.length > 0 && (
                        <button type="button" onClick={handleCancel} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline">
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
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">DOT-коды (для каждой шины)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {dotInputs.map((dot, idx) => (
                            <div key={idx} className="relative">
                                <span className="absolute left-2 top-1.5 text-[10px] text-gray-400 font-bold select-none">#{idx + 1}</span>
                                <input 
                                    type="text"
                                    value={dot}
                                    onChange={(e) => handleDotChange(idx, e.target.value)}
                                    placeholder="4523"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 pl-7 pr-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-300 text-center font-mono uppercase"
                                    maxLength={4}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button 
                        type="button" 
                        variant={editingGroupId ? "primary" : "secondary"}
                        size="md"
                        onClick={handleSaveGroup}
                        disabled={!isInputValid()}
                        className={!isInputValid() ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                        {editingGroupId ? <CheckIcon /> : <PlusIcon />} 
                        <span className="ml-1">
                            {editingGroupId ? "Сохранить изменения" : "Добавить в заказ"}
                        </span>
                    </Button>
                </div>
            </div>
        )}
    </div>
  );
};
