import React from 'react';

export interface RussianCarPlateBadgeProps {
  plate?: string;
  className?: string;
}

/**
 * Authentic Russian Car License Plate Badge
 * Format: 1 letter + 3 digits + 2 letters + 2-3 digits region
 * Allowed Cyrillic/Latin letters: А, В, Е, К, М, Н, О, Р, С, Т, У, Х (and A, B, E, K, M, H, O, P, C, T, Y, X)
 */
export const RussianCarPlateBadge: React.FC<RussianCarPlateBadgeProps> = ({ plate, className = '' }) => {
  if (!plate || !plate.trim()) return null;
  const raw = plate.trim().toUpperCase();
  const clean = raw.replace(/\s+/g, '');

  const match = clean.match(/^([АВЕКМНОРСТУХABEKMHOPCTYX])(\d{3})([АВЕКМНОРСТУХABEKMHOPCTYX]{2})(\d{2,3})$/i);

  if (match) {
    const [, l1, digits, l2, region] = match;
    return (
      <div 
        className={`inline-flex items-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xs select-all whitespace-nowrap shrink-0 overflow-hidden font-mono tracking-tight leading-none ${className}`}
        title={`Госномер: ${l1} ${digits} ${l2} ${region}`}
      >
        {/* Main section: Letter Digits Letters */}
        <div className="flex items-center px-2 py-1 gap-1 text-[13px] font-bold">
          <span className="text-[12px]">{l1}</span>
          <span className="text-[14px] font-extrabold tracking-wider">{digits}</span>
          <span className="text-[12px]">{l2}</span>
        </div>

        {/* Vertical Partition */}
        <div className="w-px bg-gray-300 dark:bg-gray-600 self-stretch my-0.5" />

        {/* Region Code */}
        <div className="flex items-center justify-center px-1.5 py-1 min-w-[24px]">
          <span className="text-[12px] font-extrabold tracking-normal">
            {region}
          </span>
        </div>
      </div>
    );
  }

  // Secondary match: e.g. "А123ВС 77"
  const generalMatch = raw.match(/^(.*?)[-\s]+(\d{2,3})$/);
  if (generalMatch) {
    const [, mainPart, region] = generalMatch;
    return (
      <div 
        className={`inline-flex items-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xs select-all whitespace-nowrap shrink-0 overflow-hidden font-mono leading-none ${className}`}
        title={`Госномер: ${raw}`}
      >
        <div className="flex items-center px-2 py-1 text-[13px] font-bold">
          {mainPart}
        </div>
        <div className="w-px bg-gray-300 dark:bg-gray-600 self-stretch my-0.5" />
        <div className="flex items-center justify-center px-1.5 py-1 min-w-[22px]">
          <span className="text-[12px] font-extrabold tracking-normal">{region}</span>
        </div>
      </div>
    );
  }

  // Generic plate badge fallback
  return (
    <div 
      className={`inline-flex items-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xs px-2 py-1 font-mono text-xs font-bold whitespace-nowrap shrink-0 ${className}`}
      title={`Госномер: ${raw}`}
    >
      {raw}
    </div>
  );
};
