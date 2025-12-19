
import React, { useState, useEffect } from 'react';

interface NewUserFormProps {
  chatId: string;
  onSubmit: (phone: string) => Promise<void>;
}

const ROTATING_BENEFITS = [
    {
        title: "Ваша квартира — не склад",
        text: "Квадратный метр жилья стоит сотни тысяч. Хранить на нем грязную резину — невыгодно. Освободите место для жизни."
    },
    {
        title: "Один бизнес-ланч в месяц",
        text: "Семья оценит отсутствие запаха резины и грязи дома. Сумма, которую вы даже не заметите."
    },
    {
        title: "Вы покупаете свободное время",
        text: "Никаких поездок в гараж. Приехали на переобувку и уехали за 15 минут. Ваше время стоит дороже."
    }
];

const NewUserForm: React.FC<NewUserFormProps> = ({ chatId, onSubmit }) => {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [benefitIndex, setBenefitIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
        setBenefitIndex((prev) => (prev + 1) % ROTATING_BENEFITS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Введите полный номер телефона');
      return;
    }
    setError('');
    setStatus('submitting');
    try {
      await onSubmit(phone);
      setStatus('success');
      const tg = (window as any).Telegram?.WebApp;
      tg?.HapticFeedback?.notificationOccurred('success');
    } catch (err) {
      setStatus('error');
      setError('Произошла ошибка. Попробуйте еще раз.');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-in fade-in zoom-in duration-300 bg-white dark:bg-gray-950">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
           <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-black mb-4 dark:text-white">Заявка принята!</h2>
        <p className="text-gray-500 dark:text-gray-400">Менеджер свяжется с вами в течение 15 минут для уточнения деталей забора шин.</p>
        <button 
            onClick={() => (window as any).Telegram?.WebApp?.close()}
            className="mt-8 text-blue-600 font-bold"
        >
            Закрыть окно
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 font-sans overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-64 px-6 pt-12 scrollbar-hide">
        <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter">Отель Шин</h1>
            <p className="text-blue-600 font-bold">Сезонное хранение с забором</p>
        </div>

        <div className="space-y-4 mb-10">
            {ROTATING_BENEFITS.map((b, idx) => (
                <div key={idx} className={`p-5 rounded-3xl transition-all duration-500 ${idx === benefitIndex ? 'bg-white dark:bg-gray-900 shadow-xl scale-100' : 'bg-transparent opacity-30 scale-95'}`}>
                    <h3 className="font-black text-gray-900 dark:text-white mb-2">{b.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{b.text}</p>
                </div>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
             <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl text-center shadow-sm">
                <div className="text-blue-500 mb-2">🚿</div>
                <span className="text-[10px] font-black uppercase dark:text-white">Мойка включена</span>
             </div>
             <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl text-center shadow-sm">
                <div className="text-blue-500 mb-2">🚚</div>
                <span className="text-[10px] font-black uppercase dark:text-white">Забор сегодня</span>
             </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white dark:bg-gray-900 rounded-t-[40px] shadow-2xl border-t border-gray-100 dark:border-gray-800">
          <h4 className="text-center font-black mb-4 dark:text-white">Получить доступ к сервису</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">+7</span>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="999 000-00-00"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-lg font-bold focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                  />
              </div>
              {error && <p className="text-center text-red-500 text-xs font-bold">{error}</p>}
              <button 
                disabled={status === 'submitting' || phone.length < 10}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-lg shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {status === 'submitting' ? 'Отправка...' : 'Хочу сдать шины'}
              </button>
          </form>
          <p className="text-[9px] text-center text-gray-400 mt-4 leading-tight">Нажимая кнопку, вы соглашаетесь с условиями хранения и обработки данных.</p>
      </div>
    </div>
  );
};

export default NewUserForm;
