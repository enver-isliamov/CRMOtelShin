
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  prefix?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, icon, prefix, className, helperText, ...props }) => {
  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && !prefix && <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">{icon}</div>}
        
        {prefix && (
           <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
             <span className="text-gray-500 dark:text-gray-400 font-medium sm:text-sm pt-0.5">{prefix}</span>
           </div>
        )}

        <input
          id={id}
          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-150 
            ${icon && !prefix ? 'pl-10' : ''} 
            ${prefix ? 'pl-10' : ''} 
            ${className}`}
          {...props}
        />
      </div>
      {helperText && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
};
