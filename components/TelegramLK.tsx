import React, { useState, useEffect } from 'react';
import { Client, parseDate, formatDateForDisplay } from '../types';
import NewUserForm from './NewUserForm';
import { PhotoGallery } from './ui/PhotoGallery';

const TelegramLK: React.FC = () => {
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [chatId, setChatId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'info' | 'photos'>('info');

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.expand();
            tg.ready();
            const userChatId = String(tg.initDataUnsafe?.user?.id || '');
            setChatId(userChatId);
            if (userChatId) checkUserStatus(userChatId);
            else setLoading(false);
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
                action: 'submit_lead', chatId, phone,
                name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Новый лид',
                username: userData.username
            })
        });
    };

    const handleAction = async (action: 'pickup' | 'extend') => {
        if (!client) return;
        const tg = (window as any).Telegram?.WebApp;
        tg.HapticFeedback.impactOccurred('medium');
        
        await fetch('/api/crm', {
            method: 'POST',
            body: JSON.stringify({ 
                action: `lk_${action}`, 
                chatId, 
                contract: client['Договор'],
                name: client['Имя клиента']
            })
        });
        
        tg.showAlert(action === 'pickup' ? "Заявка на выдачу отправлена менеджеру!" : "Заявка на продление отправлена!");
    };

    const shareRefLink = () => {
        const tg = (window as any).Telegram?.WebApp;
        const url = `https://t.me/share/url?url=https://t.me/OtelShinBot?start=ref_${chatId}&text=Рекомендую сервис хранения шин Отель Шин! С этим кодом +1 месяц в подарок 🎁`;
        tg.openTelegramLink(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-tg-bg">
                <div className="w-10 h-10 border-4 border-tg-link border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!client) {
        return <NewUserForm chatId={chatId} onSubmit={handleLeadSubmit} />;
    }

    // Расчет остатка дней
    const endDate = parseDate(client['Окончание']);
    const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <div className="min-h-screen bg-tg-secondary-bg font-sans pb-20">
            {/* Header / Summary Card */}
            <div className="bg-tg-bg px-5 pt-8 pb-6 rounded-b-[32px] shadow-sm border-b border-tg-hint/10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-tg-text">
                            Личный кабинет
                        </h1>
                        <p className="text-tg-hint text-sm mt-1">{client['Имя клиента']}</p>
                    </div>
                    <div className="bg-tg-link/10 text-tg-link p-2.5 rounded-2xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                </div>

                <div className={`rounded-[24px] p-5 text-white shadow-lg overflow-hidden relative ${daysLeft < 14 ? 'bg-gradient-to-br from-red-500 to-orange-600' : 'bg-gradient-to-br from-blue-600 to-indigo-700'}`}>
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Договор №{client['Договор']}</span>
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">На складе</span>
                        </div>
                        <div className="text-3xl font-black mb-4">
                            {daysLeft > 0 ? `${daysLeft} дн. осталось` : 'Срок истек'}
                        </div>
                        <div className="flex justify-between items-end border-t border-white/10 pt-4">
                            <div>
                                <p className="text-[10px] text-white/60 uppercase font-bold">Хранение до</p>
                                <p className="text-lg font-bold">{formatDateForDisplay(client['Окончание'])}</p>
                            </div>
                            <button 
                                onClick={() => handleAction('extend')}
                                className="bg-white text-blue-700 px-4 py-2 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-transform"
                            >
                                Продлить
                            </button>
                        </div>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex px-5 mt-6 gap-2">
                <button 
                    onClick={() => setActiveTab('info')}
                    className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'info' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-bg text-tg-hint border border-tg-hint/10'}`}
                >
                    Детали
                </button>
                <button 
                    onClick={() => setActiveTab('photos')}
                    className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'photos' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-bg text-tg-hint border border-tg-hint/10'}`}
                >
                    Фотоотчет
                </button>
            </div>

            {/* Content Area */}
            <div className="px-5 mt-4">
                {activeTab === 'info' ? (
                    <div className="space-y-4">
                        {/* Referral Section */}
                        <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-3xl p-5 text-white shadow-md">
                            <h3 className="text-lg font-black mb-1">Месяц в подарок 🎁</h3>
                            <p className="text-xs text-white/90 mb-4 leading-tight">Пригласи друга по своей ссылке и получи месяц бесплатного хранения для своего комплекта.</p>
                            <button 
                                onClick={shareRefLink}
                                className="w-full bg-white/20 backdrop-blur-md border border-white/30 py-3 rounded-2xl text-xs font-black uppercase tracking-wider active:scale-[0.98] transition-all"
                            >
                                Пригласить друга
                            </button>
                        </div>

                        {/* Specs */}
                        <div className="bg-tg-bg rounded-3xl p-5 border border-tg-hint/5 shadow-sm space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-tg-hint text-sm">Автомобиль</span>
                                <span className="text-tg-text font-bold text-sm">{client['Номер Авто']}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <span className="text-tg-hint text-sm">Размер шин</span>
                                <span className="text-tg-text font-bold text-sm text-right leading-tight">{client['Размер шин'] || 'Не указан'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-tg-hint text-sm">Склад / Ячейка</span>
                                <span className="text-tg-text font-bold text-sm">{client['Склад хранения']} / {client['Ячейка']}</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => handleAction('pickup')}
                            className="w-full py-4 bg-tg-bg text-red-500 font-bold rounded-2xl border border-red-500/10 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Забрать колеса
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <PhotoGallery 
                            client={client} 
                            refreshClientData={async () => {}} 
                            showToast={(m, t) => {}} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TelegramLK;