import React, { useState, useEffect } from 'react';
import { Client, formatDateForDisplay } from '../../types';
import { api } from '../../services/api';
import { Modal } from './Modal';
import { Button } from './Button';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  onPaymentSuccess: (newDebt: number, paidAmount: number, sendReceipt: boolean, receiptHtml?: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const PAYMENT_METHODS = [
  { id: 'sbp', label: '💳 Перевод / СБП', value: 'Перевод на карту / СБП' },
  { id: 'cash', label: '💵 Наличные', value: 'Наличные' },
  { id: 'card', label: '💳 Терминал / Карта', value: 'Терминал / Карта' },
  { id: 'bank', label: '🏛️ По счету (Безнал)', value: 'По счету (Безнал)' },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  client,
  onPaymentSuccess,
  showToast,
}) => {
  const currentDebt = Math.max(0, Number(client['Долг'] || 0));
  const totalSum = Number(client['Общая сумма'] || 0);

  const [amountStr, setAmountStr] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Перевод на карту / СБП');
  const [comment, setComment] = useState<string>('');
  const [sendReceipt, setSendReceipt] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // When modal opens or client changes, set default amount to current debt
  useEffect(() => {
    if (isOpen) {
      setAmountStr(currentDebt > 0 ? String(currentDebt) : '');
      setPaymentMethod('Перевод на карту / СБП');
      setComment('');
      setSendReceipt(false);
      setIsSubmitting(false);
    }
  }, [isOpen, currentDebt]);

  const parsedAmount = Math.max(0, parseFloat(amountStr) || 0);
  const remainingDebt = Math.max(0, currentDebt - parsedAmount);
  const overpayment = parsedAmount > currentDebt ? parsedAmount - currentDebt : 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      showToast('Введите корректную сумму оплаты', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.recordPayment(client.id, parsedAmount, paymentMethod, comment);
      const newDebt = res.newDebt !== undefined ? res.newDebt : remainingDebt;

      let receiptHtml: string | undefined = undefined;
      if (sendReceipt) {
        receiptHtml = `
<b>🧾 ПОДТВЕРЖДЕНИЕ ОПЛАТЫ</b>

👤 <b>Клиент:</b> ${client['Имя клиента']}
🚗 <b>Авто:</b> ${client['Номер Авто']}
📄 <b>Договор №:</b> <code>${client['Договор']}</code>

✅ <b>Принята оплата:</b> <b>${formatCurrency(parsedAmount)}</b>
💳 <b>Способ:</b> ${paymentMethod}
${newDebt > 0 ? `❗️ <b>Остаток долга:</b> ${formatCurrency(newDebt)}` : `🎉 <b>Долг:</b> Оплачено полностью (0 ₽)`}
${comment ? `📝 <i>Примечание: ${comment}</i>\n` : ''}
<i>Спасибо за оплату! Отель шин.</i>
        `.trim().replace(/\n/g, '<br/>');
      }

      showToast(`Оплата ${formatCurrency(parsedAmount)} успешно зачислена!`, 'success');
      onPaymentSuccess(newDebt, parsedAmount, sendReceipt, receiptHtml);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Ошибка проведения оплаты', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setFullDebt = () => {
    setAmountStr(String(currentDebt));
  };

  const addAmount = (delta: number) => {
    const cur = parseFloat(amountStr) || 0;
    setAmountStr(String(cur + delta));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Приём оплаты</h3>
            <p className="text-xs text-gray-500 font-normal">
              {client['Имя клиента']} • {client['Номер Авто']}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto justify-center">
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || parsedAmount <= 0}
            className="w-full sm:w-auto justify-center !bg-emerald-600 hover:!bg-emerald-700 !text-white px-5 shadow-sm active:scale-[0.99] transition-transform"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Сохранение...</span>
              </span>
            ) : (
              `Провести оплату ${parsedAmount > 0 ? `(${formatCurrency(parsedAmount)})` : ''}`
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info card */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold block">Сумма заказа</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              {formatCurrency(totalSum)}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase font-bold block text-red-500">Текущий долг</span>
            <span className={`text-lg font-black ${currentDebt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {formatCurrency(currentDebt)}
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
            Сумма к списанию (₽)
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              min="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              className="w-full text-2xl font-bold px-4 py-3 bg-white dark:bg-gray-800 border-2 border-emerald-500 dark:border-emerald-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 pr-12 shadow-sm"
              autoFocus
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">
              ₽
            </span>
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {currentDebt > 0 && (
              <button
                type="button"
                onClick={setFullDebt}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-300 transition-colors"
              >
                Весь долг ({formatCurrency(currentDebt)})
              </button>
            )}
            <button
              type="button"
              onClick={() => addAmount(1000)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 transition-colors"
            >
              +1 000 ₽
            </button>
            <button
              type="button"
              onClick={() => addAmount(3000)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 transition-colors"
            >
              +3 000 ₽
            </button>
            <button
              type="button"
              onClick={() => addAmount(5000)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 transition-colors"
            >
              +5 000 ₽
            </button>
            <button
              type="button"
              onClick={() => setAmountStr('')}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-auto"
            >
              Очистить
            </button>
          </div>
        </div>

        {/* Result status preview */}
        {parsedAmount > 0 && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
              remainingDebt === 0 && overpayment === 0
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : overpayment > 0
                ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 text-purple-800 dark:text-purple-300'
                : 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 text-blue-800 dark:text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {remainingDebt === 0 ? '🎉' : '📊'}
              </span>
              <span className="text-sm font-semibold">
                {remainingDebt === 0
                  ? overpayment > 0
                    ? `Долг закрыт + переплата: ${formatCurrency(overpayment)}`
                    : 'Долг будет полностью закрыт (0 ₽)'
                  : `Остаток долга после оплаты:`}
              </span>
            </div>
            {remainingDebt > 0 && (
              <span className="text-base font-black">
                {formatCurrency(remainingDebt)}
              </span>
            )}
          </div>
        )}

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
            Способ оплаты
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold text-left border transition-all ${
                  paymentMethod === m.value
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-400 dark:text-emerald-200 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Примечание (необязательно)
          </label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Например: скинул на Сбер, чек 4829..."
            className="w-full text-sm px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Receipt / SMS toggle */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sendReceipt}
              onChange={(e) => setSendReceipt(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Сформировать электронный чек для клиента (SMS / Telegram)
            </span>
          </label>
        </div>
      </form>
    </Modal>
  );
};
