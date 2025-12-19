
import React, { useState, useEffect, useMemo } from 'react';
import { Client, parseDate, formatDateForDisplay } from '../types';

export const TelegramLK: React.FC = () => {
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.expand(); // Развернуть на весь экран
            tg.ready();
            
            // Получаем ID пользователя из Telegram
            const userId = tg.initDataUnsafe?.user?.id;
            if (userId) {
                fetchClientData(String(userId));
            } else {
                // Для тестов в браузере, если нет ID
                setError("Пользователь не определен. Откройте через Telegram.");
                setLoading(false);
            }
        }
    }, []);

    const fetchClientData = async (chatId: string) => {
        try {
            // Используем существующий API, добавим в него поиск по chatId
            const res = await fetch('/api/crm', {
                method: 'POST',
                body: JSON.stringify({ action: 'get_client_by_chatid', chatId })
            });
            const data = await res.json();
            if (data.status === 'success' && data.client) {
                setClient(data.client);
            } else {
                setError("Договор не найден. Пожалуйста, свяжитесь с менеджером.");
            }
        } catch (e) {
            setError("Ошибка загрузки данных.");
        } finally {
            setLoading(false);
        }
    };

    const daysLeft = useMemo(() => {
        if (!client) return 0;
        const end = parseDate(client['Окончание']);
        if (!end) return 0;
        const diff = end.getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }, [client]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#f1f1f7]">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 font-medium">Загружаем ваш Отель Шин...</p>
        </div>
    );

    if (error) return (
        <div className="p-6 flex flex-col items-center justify-center h-screen text-center bg-white">
            <div className="text-5xl mb-4">🏠</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Упс!</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <button 
                onClick={() => (window as any).Telegram?.WebApp?.close()}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold"
            >
                Закрыть
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f1f1f7] pb-10 font-sans selection:bg-blue-100">
            {/* Header Area */}
            <div className="bg-white px-6 pt-8 pb-6 rounded-b-[40px] shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 leading-tight">
                            Привет, <span className="text-blue-600">{client?.['Имя клиента'].split(' ')[1] || 'Гость'}</span>!
                        </h1>
                        <p className="text-gray-400 text-sm font-medium mt-1">Твои колеса в полной безопасности</p>
                    </div>
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                </div>

                {/* Main Status Card */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[30px] p-6 text-white shadow-xl shadow-blue-500/20">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-blue-100 text-xs font-bold uppercase tracking-widest">Статус хранения</span>
                        <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold">АКТИВЕН</span>
                    </div>
                    <div className="text-3xl font-black mb-1">{client?.['Статус сделки']}</div>
                    <div className="text-blue-100 text-sm opacity-80">Договор №{client?.['Договор']}</div>
                    
                    <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-end">
                        <div>
                            <div className="text-[10px] text-blue-200 uppercase font-bold mb-1">Осталось</div>
                            <div className="text-2xl font-black">{daysLeft} <span className="text-sm font-normal">дн.</span></div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-blue-200 uppercase font-bold mb-1">До даты</div>
                            <div className="text-sm font-bold">{formatDateForDisplay(client?.['Окончание'])}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="px-6 -mt-4 space-y-4">
                {/* Tire Details Card */}
                <div className="bg-white rounded-[30px] p-5 shadow-sm border border-gray-100">
                    <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-wider mb-4">Параметры комплекта</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-2xl">
                            <div className="text-[10px] text-gray-400 font-bold mb-1">Авто</div>
                            <div className="text-sm font-bold text-gray-800">{client?.['Номер Авто']}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl">
                            <div className="text-[10px] text-gray-400 font-bold mb-1">Размер</div>
                            <div className="text-sm font-bold text-gray-800">{client?.['Размер шин']?.split('\n')[0]}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl">
                            <div className="text-[10px] text-gray-400 font-bold mb-1">Кол-во</div>
                            <div className="text-sm font-bold text-gray-800">{client?.['Кол-во шин']} шт.</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl">
                            <div className="text-[10px] text-gray-400 font-bold mb-1">Диски</div>
                            <div className="text-sm font-bold text-gray-800">{client?.['Наличие дисков'] === 'Да' ? 'С дисками' : 'Без дисков'}</div>
                        </div>
                    </div>
                </div>

                {/* Photos Section */}
                {client?.photoUrls && client.photoUrls.length > 0 && (
                    <div className="bg-white rounded-[30px] p-5 shadow-sm border border-gray-100">
                        <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-wider mb-4">Фотоотчет при приемке</h3>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                            {client.photoUrls.map((url, i) => (
                                <div key={i} className="w-32 h-32 flex-shrink-0 rounded-2xl overflow-hidden shadow-inner bg-gray-100">
                                    <img src={url} className="w-full h-full object-cover" alt="Tire" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <button className="flex flex-col items-center justify-center p-5 bg-white rounded-[30px] shadow-sm border border-gray-100 active:scale-95 transition-transform">
                        <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <span className="text-xs font-bold text-gray-700">Забрать шины</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-5 bg-white rounded-[30px] shadow-sm border border-gray-100 active:scale-95 transition-transform">
                        <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-xs font-bold text-gray-700">Продлить</span>
                    </button>
                </div>

                <div className="text-center pt-4 pb-8">
                    <p className="text-[10px] text-gray-400 font-medium">Хранение осуществляется по договору оферты<br/>otelshin.ru/dogovor</p>
                </div>
            </div>
        </div>
    );
};
