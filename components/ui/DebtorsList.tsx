

import React from 'react';
import { Card } from './Card';
import { Client } from '../../types';

const PaperAirplaneIcon: React.FC<{className?: string}> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>;

interface DebtorsListProps {
  debtors: Client[];
  onRemind: (client: Client) => void;
  dragHandle?: React.ReactNode;
}

export const DebtorsList: React.FC<DebtorsListProps> = ({ debtors, onRemind, dragHandle }) => {
    
    return (
        <Card title="Должники" actions={dragHandle} className="h-full flex flex-col">
             <div className="flex-grow overflow-y-auto space-y-2 pr-2 -mr-2">
                {debtors.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Должников нет. Отличная работа!</p>
                ) : (
                    debtors.map(client => (
                        <div key={client.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex justify-between items-center gap-4">
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-100">{client['Имя клиента']}</p>
                                <p className="text-sm text-red-600 dark:text-red-400 font-bold">
                                   {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(client['Долг'])}
                                </p>
                            </div>
                            <button
                                onClick={() => onRemind(client)}
                                className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-200 bg-white dark:bg-red-800/30 rounded-md shadow-sm hover:bg-red-100 dark:hover:bg-red-800/60 border border-red-200 dark:border-red-700 transition-all"
                            >
                                <PaperAirplaneIcon className="h-4 w-4" />
                                Напомнить
                            </button>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
};