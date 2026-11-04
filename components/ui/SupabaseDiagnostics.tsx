import React, { useState, useEffect } from 'react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection, 
  fetchServerPublicConfig, 
  supabaseService, 
  isSupabaseConfigured 
} from '../../services/supabaseClient';

interface EnvVarStatus {
  name: string;
  scope: 'Client (Vite)' | 'Server (Vercel)' | 'Browser (Storage)';
  value: string;
  isSet: boolean;
  masked: string;
  description: string;
}

export const SupabaseDiagnostics: React.FC<{
  onConfigUpdated?: (url: string, key: string) => void;
  className?: string;
  defaultExpanded?: boolean;
}> = ({ onConfigUpdated, className = '', defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isTesting, setIsTesting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    clientsCount?: number;
    tablesFound?: boolean;
  }>({
    tested: false,
    success: false,
    message: '',
  });

  const [inputUrl, setInputUrl] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const [serverVars, setServerVars] = useState<{
    supabaseUrl?: string;
    supabaseKey?: string;
    hasPostgresUrl?: boolean;
    checked: boolean;
  }>({ checked: false });

  // Load current values
  const refreshConfig = () => {
    const cfg = getSupabaseConfig();
    setInputUrl(cfg.url || '');
    setInputKey(cfg.key || '');
  };

  useEffect(() => {
    refreshConfig();

    // Query server public config (e.g. if set in Vercel environment variables)
    setIsAutoDetecting(true);
    fetchServerPublicConfig()
      .then((data) => {
        setServerVars({
          supabaseUrl: data.supabaseUrl || '',
          supabaseKey: data.supabaseKey || '',
          hasPostgresUrl: Boolean(data.hasPostgres),
          checked: true,
        });

        // If local storage is empty but server has them, populate immediately
        const currentCfg = getSupabaseConfig();
        if ((!currentCfg.url || !currentCfg.key) && data.supabaseUrl && data.supabaseKey) {
          setInputUrl(data.supabaseUrl);
          setInputKey(data.supabaseKey);
          saveSupabaseConfig(data.supabaseUrl, data.supabaseKey);
          if (onConfigUpdated) onConfigUpdated(data.supabaseUrl, data.supabaseKey);
        }
      })
      .finally(() => setIsAutoDetecting(false));
  }, []);

  const maskValue = (val: string): string => {
    if (!val) return 'Не задано';
    if (val.length <= 12) return '••••••••';
    if (val.startsWith('http')) {
      try {
        const u = new URL(val);
        return `${u.protocol}//${u.hostname.slice(0, 8)}••••${u.hostname.slice(-7)}`;
      } catch {
        return `${val.slice(0, 10)}••••`;
      }
    }
    return `${val.slice(0, 10)}••••••••${val.slice(-6)}`;
  };

  // Variable inspection list
  const envStatuses: EnvVarStatus[] = [
    {
      name: 'VITE_SUPABASE_URL',
      scope: 'Client (Vite)',
      value: typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_SUPABASE_URL || '') : '',
      isSet: Boolean(typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL),
      masked: maskValue(typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_SUPABASE_URL || '') : ''),
      description: 'URL проекта в файле .env при сборке Vite (https://<project-ref>.supabase.co)',
    },
    {
      name: 'VITE_SUPABASE_ANON_KEY',
      scope: 'Client (Vite)',
      value: typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_SUPABASE_ANON_KEY || '') : '',
      isSet: Boolean(typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY),
      masked: maskValue(typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_SUPABASE_ANON_KEY || '') : ''),
      description: 'Публичный анонимный JWT ключ anon public в сборке Vite',
    },
    {
      name: 'SUPABASE_URL (или VITE_SUPABASE_URL)',
      scope: 'Server (Vercel)',
      value: serverVars.supabaseUrl || '',
      isSet: Boolean(serverVars.supabaseUrl),
      masked: maskValue(serverVars.supabaseUrl || ''),
      description: 'Переменная окружения в панели Vercel (Project Settings ➔ Environment Variables)',
    },
    {
      name: 'SUPABASE_ANON_KEY (или VITE_SUPABASE_ANON_KEY)',
      scope: 'Server (Vercel)',
      value: serverVars.supabaseKey || '',
      isSet: Boolean(serverVars.supabaseKey),
      masked: maskValue(serverVars.supabaseKey || ''),
      description: 'Анонимный ключ в Vercel Environment Variables',
    },
    {
      name: 'POSTGRES_URL',
      scope: 'Server (Vercel)',
      value: serverVars.hasPostgresUrl ? 'configured' : '',
      isSet: Boolean(serverVars.hasPostgresUrl),
      masked: serverVars.hasPostgresUrl ? 'postgres://••••:••••@aws-0-••••' : 'Не задано',
      description: 'Прямая строка подключения к Postgres в Vercel (для пула соединений)',
    },
    {
      name: 'Локальное хранилище CRM (URL + Key)',
      scope: 'Browser (Storage)',
      value: inputUrl && inputKey ? `${inputUrl}|${inputKey}` : '',
      isSet: Boolean(inputUrl && inputKey),
      masked: inputUrl && inputKey ? `${maskValue(inputUrl)} / ${maskValue(inputKey)}` : 'Не настроено',
      description: 'Сохраненные ключи в браузере (работают прямо сейчас без пересборки проекта)',
    },
  ];

  const handleCopy = (text: string, varName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 2500);
  };

  const handleSaveAndTest = async () => {
    const cleanUrl = inputUrl.trim();
    const cleanKey = inputKey.trim();

    if (!cleanUrl || !cleanKey) {
      setTestResult({
        tested: true,
        success: false,
        message: 'Заполните оба поля: Project URL и API Key.',
      });
      return;
    }

    saveSupabaseConfig(cleanUrl, cleanKey);
    if (onConfigUpdated) onConfigUpdated(cleanUrl, cleanKey);

    setIsTesting(true);
    setTestResult({ tested: false, success: false, message: '' });

    try {
      const res = await testSupabaseConnection(cleanUrl, cleanKey);
      setTestResult({
        tested: true,
        success: res.success,
        message: res.message,
        clientsCount: res.clientsCount,
        tablesFound: res.tablesFound,
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        message: `Ошибка связи: ${err?.message || err}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleApplyServerVars = () => {
    if (serverVars.supabaseUrl && serverVars.supabaseKey) {
      setInputUrl(serverVars.supabaseUrl);
      setInputKey(serverVars.supabaseKey);
      saveSupabaseConfig(serverVars.supabaseUrl, serverVars.supabaseKey);
      if (onConfigUpdated) onConfigUpdated(serverVars.supabaseUrl, serverVars.supabaseKey);
      handleSaveAndTest();
    }
  };

  const handleImportClients = async () => {
    const cleanUrl = inputUrl.trim();
    const cleanKey = inputKey.trim();

    if (!cleanUrl || !cleanKey) {
      setTestResult({
        tested: true,
        success: false,
        message: 'Сначала заполните Project URL и API Key.',
      });
      return;
    }

    saveSupabaseConfig(cleanUrl, cleanKey);
    setIsImporting(true);

    try {
      const res = await supabaseService.importLocalData(cleanUrl, cleanKey);
      setTestResult({
        tested: true,
        success: res.success,
        message: res.message,
        clientsCount: res.count,
      });
    } catch (e: any) {
      setTestResult({
        tested: true,
        success: false,
        message: `Ошибка загрузки: ${e?.message || e}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const isConfigured = isSupabaseConfigured() || Boolean(inputUrl && inputKey);

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
      isConfigured 
        ? 'border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/40 via-white to-gray-50/50 dark:from-indigo-950/20 dark:via-gray-900 dark:to-gray-900/50' 
        : 'border-amber-300 dark:border-amber-900/60 bg-gradient-to-b from-amber-50/50 via-white to-amber-50/20 dark:from-amber-950/20 dark:via-gray-900 dark:to-gray-900/50'
    } ${className}`}>
      {/* Header bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
            isConfigured
              ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950'
              : 'bg-amber-500 text-white ring-4 ring-amber-100 dark:ring-amber-950 animate-pulse'
          }`}>
            ⚡️
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white">
                Диагностика и статус подключения Supabase
              </h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isConfigured
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {isConfigured ? 'Настроено' : 'Требуется настройка'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Мониторинг переменных VITE_*, серверных секретов Vercel и прямого подключения без пароля
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <svg 
              className={`w-5 h-5 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Quick Notice if server detected secrets */}
          {serverVars.supabaseUrl && serverVars.supabaseKey && (!inputUrl || !inputKey) && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200 font-medium">
                <span className="text-base">💡</span>
                <span>В Vercel обнаружены переменные Supabase! Нажмите кнопку, чтобы применить их в 1 клик:</span>
              </div>
              <button
                type="button"
                onClick={handleApplyServerVars}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
              >
                Применить из Vercel
              </button>
            </div>
          )}

          {/* TABLE: Environment Variables Status Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Таблица статуса переменных окружения (Environment Status)
              </h4>
              <span className="text-[11px] text-gray-400">
                {isAutoDetecting ? 'Проверка переменных...' : 'Все источники проверены'}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3">Переменная</th>
                    <th className="py-2.5 px-3">Область видимости</th>
                    <th className="py-2.5 px-3">Текущее состояние</th>
                    <th className="py-2.5 px-3 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300 font-mono">
                  {envStatuses.map((item) => (
                    <tr key={item.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-900 dark:text-white font-sans flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${item.isSet ? 'bg-emerald-500' : 'bg-rose-400'}`}></span>
                          <code>{item.name}</code>
                        </div>
                        <div className="text-[10px] text-gray-400 font-sans mt-0.5 max-w-sm">
                          {item.description}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                          {item.scope}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {item.isSet ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="text-emerald-500 font-bold">✓</span>
                            <span className="truncate max-w-[200px]" title={item.masked}>
                              {item.masked}
                            </span>
                          </div>
                        ) : (
                          <div className="text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1">
                            <span>✗</span>
                            <span className="font-sans text-[11px]">Не обнаружено</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-sans">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.name.split(' ')[0], item.name)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold transition-colors"
                        >
                          {copiedVar === item.name ? 'Скопировано!' : 'Копировать имя'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Connect Inputs: Live Browser Config */}
          <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <span>🔑</span> Быстрое сохранение ключей в CRM (Способ 2: Без пароля)
              </h4>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                Сохраняется мгновенно в браузере и не требует сборки Vercel
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Project URL
                </label>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Project Settings ➔ API ➔ Project URL
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Project API Key (anon / public)
                </label>
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Project Settings ➔ API ➔ Project API keys (anon public)
                </span>
              </div>
            </div>

            {/* Test result banner */}
            {testResult.tested && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}>
                <span className="text-base leading-none font-bold">
                  {testResult.success ? '✅' : '⚠️'}
                </span>
                <div className="flex-1">
                  <div className="font-bold">{testResult.success ? 'Успешно' : 'Внимание'}</div>
                  <div>{testResult.message}</div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveAndTest}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>Проверка связи...</span>
                  </>
                ) : (
                  <>
                    <span>⚡️</span>
                    <span>Сохранить и проверить подключение</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleImportClients}
                disabled={isImporting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>Загрузка...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Загрузить 27 клиентов в Supabase в 1 клик</span>
                  </>
                )}
              </button>

              <a
                href="/schema.sql"
                download="schema.sql"
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Скачать schema.sql
              </a>
            </div>
          </div>

          {/* STEP-BY-STEP CONNECT GUIDE WITH DIRECT LINKS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span>📖</span> Пошаговая инструкция подключения (Connect Guide)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center">
                    1
                  </span>
                  <a
                    href="https://supabase.com/dashboard/projects"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>Панель Supabase</span>
                    <span>↗</span>
                  </a>
                </div>
                <div className="font-bold text-xs text-gray-900 dark:text-white">
                  Откройте ваш проект
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Войдите на <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">supabase.com/dashboard</a> (через Google или Email) и выберите ваш проект.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center">
                    2
                  </span>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Settings ➔ API</span>
                </div>
                <div className="font-bold text-xs text-gray-900 dark:text-white">
                  Скопируйте URL и Anon Key
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Перейдите в <b>Project Settings ➔ API</b>. Скопируйте <b>Project URL</b> и <b>Project API keys (anon public)</b> и вставьте в поля выше.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center">
                    3
                  </span>
                  <a
                    href="https://supabase.com/dashboard/project/_/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>SQL Editor</span>
                    <span>↗</span>
                  </a>
                </div>
                <div className="font-bold text-xs text-gray-900 dark:text-white">
                  Создайте таблицы в 1 клик
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  В Supabase откройте <b>SQL Editor ➔ New query</b>, вставьте SQL-схему (кнопка «Скопировать SQL-схему») и нажмите <b>Run</b>. Затем нажмите зеленую кнопку «Загрузить 27 клиентов».
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
