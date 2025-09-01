

import React, { useMemo, useState } from 'react';
import { Card } from './Card';
import { Client, parseDate } from '../../types';

// --- Icons ---
const PaperAirplaneIcon: React.FC<{className?: string}> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>;
const CalendarDaysIcon: React.FC<{className?: string}> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M-4.5 12h27" /></svg>;
const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 w-4"} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;


interface ExpiringClientsListProps {
  clients: Client[];
  onRemind: (client: Client) => void;
  dragHandle?: React.ReactNode;
}

export const ExpiringClientsList: React.FC<ExpiringClientsListProps> = ({ clients, onRemind, dragHandle }) => {
     const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

     const expiringClients = useMemo(() => {
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        return clients
            .map(client => ({ ...client, endDate: parseDate(client['Окончание']) }))
            .filter((client): client is Client & { endDate: Date } => !!client.endDate && client.endDate >= now && client.endDate <= thirtyDaysFromNow)
            .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    }, [clients]);
    
    const createCalendarLink = (client: Client, isMeeting: boolean) => {
        const title = isMeeting
            ? `Выдача шин: ${client['Имя клиента']} (${client['Номер Авто']})`
            : `Окончание хранения: ${client['Имя клиента']}`;
        
        const endDateObj = parseDate(client['Окончание']);
        if (!endDateObj) {
            alert("Некорректная дата окончания для создания события.");
            return '#';
        }
        
        const calendarDate = endDateObj.toISOString().split('T')[0].replace(/-/g, '');
        const dates = isMeeting 
            ? `${calendarDate}T150000/${calendarDate}T160000` // Default meeting time 15:00-16:00
            : `${calendarDate}/${calendarDate}`;

        const details = `Клиент: ${client['Имя клиента']}\nТелефон: ${client['Телефон']}\nАвто: ${client['Номер Авто']}\nЗаказ: ${client['Заказ - QR']}\n\nСгенерировано CRM.`;
        const location = client['Адрес клиента'] || '';
        
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${encodeURIComponent(dates)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    };

    const ActionButton: React.FC<{onClick:()=>void, children: React.ReactNode}> = ({ onClick, children }) => (
        <button
            onClick={onClick}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-md shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-all"
        >
            {children}
        </button>
    );

    return (
        <Card title="Окончание хранения (30 дн.)" actions={dragHandle} className="h-full flex flex-col">
             <div className="flex-grow overflow-y-auto space-y-3 pr-2 -mr-2">
                {expiringClients.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Нет клиентов, у которых хранение заканчивается в ближайшие 30 дней.</p>
                ) : (
                    expiringClients.map(client => (
                        <div key={client.id} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">{client['Имя клиента']}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{client['Номер Авто']}</p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                <p className="text-sm font-bold text-red-500 dark:text-red-400">
                                    {client.endDate?.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}
                                </p>
                                <p className="text-xs text-gray-400">Окончание</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t dark:border-gray-600/50">
                                <ActionButton onClick={() => onRemind(client)}>
                                    <PaperAirplaneIcon className="h-4 w-4" /> Напомнить
                                </ActionButton>
                                <div className="relative flex-1">
                                    <button
                                        onClick={() => setMenuOpenFor(menuOpenFor === client.id ? null : client.id)}
                                        className="w-full flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-md shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-all"
                                    >
                                        <CalendarDaysIcon className="h-4 w-4" /> В календарь <ChevronDownIcon className={`h-4 w-4 transition-transform ${menuOpenFor === client.id ? 'rotate-180' : ''}`}/>
                                    </button>
                                    {menuOpenFor === client.id && (
                                        <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-600 z-10 p-1 text-sm">
                                            <a href={createCalendarLink(client, false)} target="_blank" rel="noopener noreferrer" className="block text-left w-full px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Напоминание</a>
                                            <a href={createCalendarLink(client, true)} target="_blank" rel="noopener noreferrer" className="block text-left w-full px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Встреча для выдачи</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
};