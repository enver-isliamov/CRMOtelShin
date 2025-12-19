
import React, { useState, useEffect } from 'react';
import { Client, parseDate, formatDateForDisplay } from '../types';
import NewUserForm from './NewUserForm';

const TelegramLK: React.FC = () => {
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [chatId, setChatId] = useState<string>('');

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.expand();
            tg.ready();
            
            const userChatId = String(tg.initDataUnsafe?.user?.id || '');
            setChatId(userChatId);

            if (userChatId) {
                checkUserStatus(userChatId);
            } else {
                // Для тестов в браузере
                setLoading(false);
            }
        }
    }, []);

    const checkUserStatus = async (id: string) => {
        try {
            const response = await fetch('/api/crm', {
                method: 'POST',
                body: JSON.stringify({ action: 'get_client_by_chatid', chatId: id })
            });
            const result = await response.json();
            if (result.status === 'success' && result.client) {
                setClient(result.client);
            }
        } catch (e) {
            console.error("Auth check failed", e);
        } finally {
            setLoading(false);
        }
    };

    const handleLeadSubmit = async (phone: string) => {
        const tg = (window as any).Telegram?.WebApp;
        const userData = tg?.initDataUnsafe?.user || {};
        
        await fetch('/api/crm', {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'submit_lead', 
                chatId,
                phone,
                name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Новый лид',
                username: userData.username
            })
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#f1f1f7] dark:bg-gray-950">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Если клиент не найден - показываем форму для новых пользователей
    if (!client) {
        return <NewUserForm chatId={chatId} onSubmit={handleLeadSubmit} />;
    }

    // Личный кабинет клиента
    return (
        <div className="min-h-screen bg-[#f1f1f7] dark:bg-gray-950 font-sans pb-10">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 px-6 pt-10 pb-8 rounded-b-[40px] shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                            Привет, <span className="text-blue-600">{client['Имя клиента'].split(' ')[1] || 'Гость'}</span>!
                        </h1>
                        <p className="text-gray-400 text-sm font-medium mt-1">Твои колеса в безопасности</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-3 rounded-2xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[30px] p-6 text-white shadow-xl shadow-blue-500/20">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">Статус договора</span>
                        <span className="bg-white/20 px-3 py-1 rounded-full text-[9px] font-bold uppercase">{client['Статус сделки']}</span>
                    </div>
                    <div className="text-3xl font-black mb-1">На складе</div>
                    <div className="text-blue-100 text-sm opacity-80">Договор №{client['Договор']}</div>
                    
                    <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-end">
                        <div>
                            <div className="text-[10px] text-blue-200 uppercase font-bold mb-1">Срок до</div>
                            <div className="text-xl font-black">{formatDateForDisplay(client['Окончание'])}</div>
                        </div>
                        <button className="bg-white text-blue-700 px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                            Продлить
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-5 mt-6 space-y-4">
                {/* Referal Program */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-lg font-black leading-tight mb-1">Приведи друга</h3>
                        <p className="text-xs text-orange-100 opacity-90 mb-3">Получи +1 месяц хранения бесплатно</p>
                        <button 
                            onClick={() => {
                                const tg = (window as any).Telegram?.WebApp;
                                tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/OtelShinBot?start=ref_${chatId}&text=Рекомендую классный сервис хранения шин!`);
                            }}
                            className="bg-white text-orange-600 px-4 py-2 rounded-xl text-xs font-black shadow-sm"
                        >
                            Пригласить
                        </button>
                    </div>
                    <svg className="absolute -right-4 -bottom-4 w-24 h-24 text-white/20 rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </div>

                {/* Details */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-4">Параметры комплекта</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Автомобиль</span>
                            <span className="font-bold text-sm dark:text-white">{client['Номер Авто']}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Размер</span>
                            <span className="font-bold text-sm dark:text-white">{client['Размер шин']?.split('\n')[0] || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Хранение</span>
                            <span className="font-bold text-sm dark:text-white">{client['Склад хранения']} / {client['Ячейка']}</span>
                        </div>
                    </div>
                </div>

                <button className="w-full py-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 font-bold text-red-500 active:scale-95 transition-transform flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Забрать колеса
                </button>
            </div>
        </div>
    );
};

export default TelegramLK;
