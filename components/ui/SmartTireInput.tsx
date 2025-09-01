

import React, { useState, useEffect, useMemo } from 'react';

interface SmartTireInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

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


export const SmartTireInput: React.FC<SmartTireInputProps> = ({ value, onChange, label }) => {
  // This state is now fully controlled by the parent's `value` prop
  const [internalState, setInternalState] = useState(parseValue(value));

  // When the prop from the parent changes, we must update our internal state.
  useEffect(() => {
    setInternalState(parseValue(value));
  }, [value]);

  const handlePartChange = (part: keyof typeof internalState, newValue: string) => {
    // Create the next state based on the change
    const nextInternalState = { ...internalState, [part]: newValue };
    
    // Update the local state immediately for a responsive UI
    setInternalState(nextInternalState);

    // Compose the new string and notify the parent
    const brandAndModelPart = `${nextInternalState.brand} ${nextInternalState.model}`.trim();
    const sizePart = `${nextInternalState.width}/${nextInternalState.profile}R${nextInternalState.diameter}`;
    const finalOutput = `${brandAndModelPart} >> ${sizePart}`;
    
    // Call parent onChange only if the final composed string is different
    // from the initial value prop, to prevent loops.
    if (finalOutput !== value) {
        onChange(finalOutput);
    }
  };
  
  const handleNumericChange = (part: keyof typeof internalState, val: string) => {
    handlePartChange(part, val.replace(/\D/g, ''));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <input
          type="text"
          value={internalState.brand}
          onChange={(e) => handlePartChange('brand', e.target.value)}
          placeholder="Бренд"
          className="col-span-1 sm:col-span-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <input
          type="text"
          value={internalState.model}
          onChange={(e) => handlePartChange('model', e.target.value)}
          placeholder="Модель"
          className="col-span-1 sm:col-span-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <input
          type="text"
          inputMode="numeric"
          value={internalState.width}
          onChange={(e) => handleNumericChange('width', e.target.value)}
          placeholder="Ширина"
          className="col-span-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <input
          type="text"
          inputMode="numeric"
          value={internalState.profile}
          onChange={(e) => handleNumericChange('profile', e.target.value)}
          placeholder="Профиль"
          className="col-span-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <input
          type="text"
          inputMode="numeric"
          value={internalState.diameter}
          onChange={(e) => handleNumericChange('diameter', e.target.value)}
          placeholder="Диаметр"
          className="col-span-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>
    </div>
  );
};
