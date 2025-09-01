

import React from 'react';

interface CardProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noOverflow?: boolean;
}

export const Card: React.FC<CardProps> = ({ title, actions, children, className = '', noOverflow = false }) => {
  const baseClasses = "bg-white dark:bg-gray-800 rounded-lg shadow";
  const overflowClass = noOverflow ? '' : 'overflow-hidden';
  
  // Check if the custom className is overriding padding
  const hasCustomPadding = className.includes('p-') || className.includes('!p-');
  const paddingClasses = hasCustomPadding ? '' : "p-4 sm:p-6";

  return (
    <div className={`${baseClasses} ${overflowClass} ${className}`}>
      {(title || actions) && (
        <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700`}>
          {title && <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white truncate">{title}</h3>}
          {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className={paddingClasses}>
        {children}
      </div>
    </div>
  );
};