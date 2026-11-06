import React, { useState, useMemo } from 'react';
import { Client, MessageTemplate, checkStorageExpiry, formatDateForDisplay } from '../../types';
import { api } from '../../services/api';
import { normalizePhone, extractPhones } from '../../utils/clientGrouping';

export type MessengerType = 'telegram_bot' | 'whatsapp' | 'telegram_direct' | 'sms';

export interface BulkMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  templates: MessageTemplate[];
  onRefresh?: () => void;
  initialFilter?: string;
}

export const BulkMessageModal: React.FC<BulkMessageModalProps> = ({
  isOpen,
  onClose,
  clients,
  templates,
  onRefresh,
}) => {
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(() => new Set(clients.map(c => c.id)));
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>(() => templates[0]?.['Название шаблона'] || '');
  const [customText, setCustomText] = useState<string>('');
  const [useCustomText, setUseCustomText] = useState(false);
  const [messenger, setMessenger] = useState<MessengerType>('telegram_bot');

  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; success: number; failed: number }>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [sendLogs, setSendLogs] = useState<Array<{ name: string; status: 'ok' | 'error'; message: string; link?: string }>>([]);
  const [filterAudience, setFilterAudience] = useState<'all' | 'expiring' | 'debt' | 'telegram_only'>('all');

  // Filter clients for audience selection
  const filteredAudience = useMemo(() => {
    return clients.filter(c => {
      if (filterAudience === 'expiring') {
        const exp = checkStorageExpiry(c['Окончание']);
        return exp?.isUrgent === true;
      }
      if (filterAudience === 'debt') {
        return (c['Долг'] || 0) > 0;
      }
      if (filterAudience === 'telegram_only') {
        return Boolean(c['Chat ID'] && String(c['Chat ID']) !== '0');
      }
      return true;
    });
  }, [clients, filterAudience]);

  // Current template content
  const activeTemplate = useMemo(() => {
    return templates.find(t => t['Название шаблона'] === selectedTemplateName);
  }, [templates, selectedTemplateName]);

  const rawTemplateBody = useCustomText ? customText : (activeTemplate?.['Содержимое (HTML)'] || '');

  // Helper to substitute placeholders for a specific client
  const renderMessageForClient = (client: Client, templateText: string): string => {
    let msg = templateText;
    const cleanDebt = Number(client['Долг'] || 0);
    const cleanTotal = Number(client['Общая сумма'] || 0);
    const cleanPriceMonth = Number(client['Цена за месяц'] || 0);

    const replacements: Record<string, string> = {
      '{{Имя клиента}}': String(client['Имя клиента'] || 'Уважаемый клиент'),
      '{{Телефон}}': String(client['Телефон'] || ''),
      '{{Номер Авто}}': String(client['Номер Авто'] || ''),
      '{{Договор}}': String(client['Договор'] || client.id || ''),
      '{{Начало}}': formatDateForDisplay(client['Начало']),
      '{{Окончание}}': formatDateForDisplay(client['Окончание']),
      '{{Срок}}': `${client['Срок'] || 0} мес.`,
      '{{Склад хранения}}': String(client['Склад хранения'] || 'Основной'),
      '{{Ячейка}}': String(client['Ячейка'] || ''),
      '{{Бренд_Модель}}': String(client['Бренд_Модель'] || 'Комплект шин'),
      '{{Размер шин}}': String(client['Размер шин'] || ''),
      '{{Сезон}}': String(client['Сезон'] || ''),
      '{{Кол-во шин}}': `${client['Кол-во шин'] || 4} шт.`,
      '{{Общая сумма}}': `${cleanTotal.toLocaleString('ru-RU')} ₽`,
      '{{Долг}}': `${cleanDebt.toLocaleString('ru-RU')} ₽`,
      '{{Цена за месяц}}': `${cleanPriceMonth.toLocaleString('ru-RU')} ₽`,
    };

    for (const [key, val] of Object.entries(replacements)) {
      msg = msg.split(key).join(val);
    }

    // Strip HTML tags for messengers that expect plain text / markdown
    return msg
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .trim();
  };

  // Preview message for the first selected client
  const previewClient = useMemo(() => {
    const firstSelectedId = Array.from(selectedClientIds)[0];
    return clients.find(c => c.id === firstSelectedId) || clients[0];
  }, [selectedClientIds, clients]);

  const previewMessage = useMemo(() => {
    if (!previewClient || !rawTemplateBody) return 'Выберите шаблон сообщения';
    return renderMessageForClient(previewClient, rawTemplateBody);
  }, [previewClient, rawTemplateBody]);

  // Toggle selection
  const toggleClientSelection = (id: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedClientIds(new Set(filteredAudience.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedClientIds(new Set());
  };

  // Build direct messenger link for a single client
  const getDirectMessengerLink = (client: Client, text: string): string => {
    const phones = extractPhones(client['Телефон']);
    const rawPhone = phones[0] || normalizePhone(client['Телефон']);
    const encodedText = encodeURIComponent(text);

    if (messenger === 'whatsapp') {
      const waNumber = rawPhone.length === 10 ? `7${rawPhone}` : rawPhone;
      return `https://wa.me/${waNumber}?text=${encodedText}`;
    }
    if (messenger === 'telegram_direct') {
      const tgNumber = rawPhone.length === 10 ? `+7${rawPhone}` : `+${rawPhone}`;
      return `https://t.me/${tgNumber}`;
    }
    if (messenger === 'sms') {
      const smsNumber = rawPhone.length === 10 ? `+7${rawPhone}` : `+${rawPhone}`;
      return `sms:${smsNumber}?body=${encodedText}`;
    }
    return '';
  };

  // Handle Mass Dispatch
  const handleMassSend = async () => {
    const targetClients = clients.filter(c => selectedClientIds.has(c.id));
    if (targetClients.length === 0) {
      alert('Выберите хотя бы одного получателя.');
      return;
    }
    if (!rawTemplateBody.trim()) {
      alert('Содержимое сообщения не может быть пустым.');
      return;
    }

    setIsSending(true);
    setSendLogs([]);
    setProgress({ current: 0, total: targetClients.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;
    const logs: Array<{ name: string; status: 'ok' | 'error'; message: string; link?: string }> = [];

    for (let i = 0; i < targetClients.length; i++) {
      const client = targetClients[i];
      const messageText = renderMessageForClient(client, rawTemplateBody);
      const clientName = client['Имя клиента'] || 'Клиент';

      if (messenger === 'telegram_bot') {
        const chatId = client['Chat ID'];
        if (!chatId || String(chatId) === '0') {
          failedCount++;
          logs.push({
            name: clientName,
            status: 'error',
            message: 'Нет Chat ID (клиент не запустил Telegram бота)',
          });
        } else {
          try {
            const res = await api.sendMessage(chatId, messageText);
            if (res.success) {
              successCount++;
              logs.push({
                name: clientName,
                status: 'ok',
                message: 'Доставлено через Telegram Bot',
              });
            } else {
              failedCount++;
              logs.push({
                name: clientName,
                status: 'error',
                message: res.message || 'Ошибка отправки в бота',
              });
            }
          } catch (e: any) {
            failedCount++;
            logs.push({
              name: clientName,
              status: 'error',
              message: e.message || 'Сбой сети',
            });
          }
        }
      } else {
        // Direct Links (WhatsApp, Telegram Direct, SMS)
        const link = getDirectMessengerLink(client, messageText);
        if (!link) {
          failedCount++;
          logs.push({
            name: clientName,
            status: 'error',
            message: 'Не указан корректный номер телефона',
          });
        } else {
          successCount++;
          logs.push({
            name: clientName,
            status: 'ok',
            message: 'Ссылка сформирована',
            link,
          });
        }
      }

      setProgress({
        current: i + 1,
        total: targetClients.length,
        success: successCount,
        failed: failedCount,
      });

      // Small delay between bot API calls to prevent Telegram rate limit
      if (messenger === 'telegram_bot' && i < targetClients.length - 1) {
        await new Promise(r => setTimeout(r, 120));
      }
    }

    setSendLogs(logs);
    setIsSending(false);
    if (onRefresh) onRefresh();
  };

  if (!isOpen) return null;

  const targetCount = selectedClientIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              ✉️
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                Массовая рассылка уведомлений
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Отправка напоминаний по шаблонам в Telegram, WhatsApp или SMS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* STEP 1: Choose Messenger */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              1. Выберите мессенджер для отправки
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setMessenger('telegram_bot')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
                  messenger === 'telegram_bot'
                    ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/30'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-xl">🤖</span>
                <span className="font-bold text-xs">Telegram Бот</span>
                <span className="text-[10px] text-gray-400">Автоматически</span>
              </button>

              <button
                type="button"
                onClick={() => setMessenger('whatsapp')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
                  messenger === 'whatsapp'
                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-xl">💬</span>
                <span className="font-bold text-xs">WhatsApp</span>
                <span className="text-[10px] text-gray-400">Чат по номеру</span>
              </button>

              <button
                type="button"
                onClick={() => setMessenger('telegram_direct')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
                  messenger === 'telegram_direct'
                    ? 'border-sky-600 bg-sky-50/80 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/30'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-xl">✈️</span>
                <span className="font-bold text-xs">Telegram Личка</span>
                <span className="text-[10px] text-gray-400">Прямой диалог</span>
              </button>

              <button
                type="button"
                onClick={() => setMessenger('sms')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
                  messenger === 'sms'
                    ? 'border-violet-600 bg-violet-50/80 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/30'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-xl">📱</span>
                <span className="font-bold text-xs">SMS</span>
                <span className="text-[10px] text-gray-400">По номеру телефона</span>
              </button>
            </div>
          </div>

          {/* STEP 2: Choose Template & Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  2. Шаблон сообщения
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomText(!useCustomText)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {useCustomText ? 'Выбрать готовый шаблон' : 'Написать свой текст'}
                </button>
              </div>

              {!useCustomText ? (
                <div>
                  <select
                    value={selectedTemplateName}
                    onChange={(e) => setSelectedTemplateName(e.target.value)}
                    className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {templates.map(t => (
                      <option key={t['Название шаблона']} value={t['Название шаблона']}>
                        {t['Название шаблона']}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Здравствуйте, {{Имя клиента}}! Напоминаем, что срок хранения шин по договору {{Договор}} истекает {{Окончание}}..."
                    className="w-full text-xs p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-sans"
                  />
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {['{{Имя клиента}}', '{{Договор}}', '{{Окончание}}', '{{Долг}}', '{{Бренд_Модель}}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setCustomText(prev => prev + ` ${tag}`)}
                        className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 font-mono"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Live Preview */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700/60 mb-2">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  Предпросмотр (для: {previewClient?.['Имя клиента'] || 'Клиент'})
                </span>
                <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                  {messenger.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800 text-xs whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 select-text overflow-y-auto max-h-36">
                {previewMessage}
              </div>
            </div>
          </div>

          {/* STEP 3: Audience Filters & Multi-Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                3. Выберите получателей ({targetCount} из {filteredAudience.length})
              </label>

              {/* Quick Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterAudience('all')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                    filterAudience === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Все ({clients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterAudience('expiring')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                    filterAudience === 'expiring'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                  }`}
                >
                  ⚠️ Истекает срок
                </button>
                <button
                  type="button"
                  onClick={() => setFilterAudience('debt')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                    filterAudience === 'debt'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                  }`}
                >
                  💰 С долгом
                </button>
                <button
                  type="button"
                  onClick={() => setFilterAudience('telegram_only')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                    filterAudience === 'telegram_only'
                      ? 'bg-sky-600 text-white'
                      : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900'
                  }`}
                >
                  🤖 Только с ботом
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pb-1">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Выбрать всех ({filteredAudience.length})
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs text-gray-500 hover:underline"
              >
                Снять выделение
              </button>
            </div>

            {/* Client Checklist Container */}
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900/60">
              {filteredAudience.map(c => {
                const isChecked = selectedClientIds.has(c.id);
                const hasChatId = Boolean(c['Chat ID'] && String(c['Chat ID']) !== '0');
                const exp = checkStorageExpiry(c['Окончание']);

                return (
                  <div
                    key={c.id}
                    onClick={() => toggleClientSelection(c.id)}
                    className={`flex items-center justify-between p-2.5 px-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer select-none transition-colors ${
                      isChecked ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent div
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 pointer-events-none"
                      />
                      <div className="truncate">
                        <span className="font-bold text-gray-900 dark:text-white block truncate">
                          {c['Имя клиента'] || 'Без имени'}
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {c['Телефон'] || 'Без телефона'} • {c['Договор'] || c.id}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {hasChatId ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800" title="Telegram Bot подключен">
                          🤖 Бот OK
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] text-gray-400 border border-gray-200 dark:border-gray-800" title="Нет Chat ID">
                          Нет бота
                        </span>
                      )}

                      {exp?.isUrgent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          ≤ 7 дн.
                        </span>
                      )}

                      {(c['Долг'] || 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Долг: {c['Долг']} ₽
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispatch Logs & Direct Links (when finished) */}
          {sendLogs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Результаты отправки ({progress.success} успешно, {progress.failed} с ошибками):
                </span>
                {progress.failed > 0 && messenger === 'telegram_bot' && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    💡 Для клиентов без бота переключитесь на WhatsApp или Telegram Личку
                  </span>
                )}
              </div>

              <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 bg-gray-50/50 dark:bg-gray-900/60 p-2">
                {sendLogs.map((log, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                    <div className="truncate">
                      <span className="font-semibold text-gray-900 dark:text-white mr-1.5">
                        {log.name}:
                      </span>
                      <span className={log.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {log.message}
                      </span>
                    </div>

                    {log.link && (
                      <a
                        href={log.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shrink-0 transition-colors shadow-2xs"
                      >
                        Открыть чат ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="text-xs text-gray-500">
            {targetCount > 0 ? (
              <span>
                Будет отправлено <b>{targetCount}</b> клиентам через <b>{messenger === 'telegram_bot' ? 'Telegram Bot' : messenger === 'whatsapp' ? 'WhatsApp' : messenger === 'telegram_direct' ? 'Telegram Личка' : 'SMS'}</b>
              </span>
            ) : (
              <span className="text-rose-500 font-medium">Выберите получателей</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Закрыть
            </button>

            <button
              type="button"
              onClick={handleMassSend}
              disabled={isSending || targetCount === 0}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>Отправка ({progress.current}/{progress.total})...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Отправить {targetCount > 0 ? `(${targetCount})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
