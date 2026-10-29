import { Client, Settings, MessageTemplate, Master, ClientEvent, AppLog, parseCurrency, parseDuration } from '../types';
import { 
  INITIAL_CLIENTS, 
  INITIAL_ARCHIVE, 
  INITIAL_TEMPLATES, 
  INITIAL_MASTERS, 
  INITIAL_HISTORY 
} from '../data/mockData';

const getSettingsFromStorage = (): Settings => {
    try {
        const data = localStorage.getItem('crm_settings');
        // Default to VERCEL for native postgres integration
        const defaults: Settings = { adminIds: '', managerIds: '', googleSheetId: '', sheetName: 'WebBase', apiMode: 'VERCEL' };
        
        if (data) {
            const parsed = JSON.parse(data);
            // Smart fallback: If GAS is selected but no URL is present (migration case), force VERCEL to avoid "URL not set" error.
            if (parsed.apiMode === 'GAS' && !parsed.googleSheetId) {
                parsed.apiMode = 'VERCEL';
            }
            return { ...defaults, ...parsed };
        }
        return defaults;
    } catch (e) {
        console.error("Settings parse error, resetting defaults", e);
        return { adminIds: '', managerIds: '', googleSheetId: '', sheetName: 'WebBase', apiMode: 'VERCEL' };
    }
};

// Simulate API latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const getClientHeaders = (): string[] => {
    // Define a comprehensive set of headers to ensure consistency
    const clientKeys: Array<keyof Client> = [
      'id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто',
      'Заказ - QR', 'Бренд_Модель', 'DOT-код', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков',
      'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка',
      'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки',
      'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls', 'metadata'
    ];
    return clientKeys.filter(h => h !== 'id').map(String);
};

// Local storage helper for resilient offline / dev execution
export const LocalCRMStorage = {
    getClients(): Client[] {
        try {
            const data = localStorage.getItem('crm_clients');
            if (data) return JSON.parse(data);
            localStorage.setItem('crm_clients', JSON.stringify(INITIAL_CLIENTS));
            return [...INITIAL_CLIENTS];
        } catch (e) {
            return [...INITIAL_CLIENTS];
        }
    },
    saveClients(clients: Client[]) {
        try {
            localStorage.setItem('crm_clients', JSON.stringify(clients));
        } catch (e) {
            console.warn("Local storage save clients error:", e);
        }
    },
    getArchive(): Client[] {
        try {
            const data = localStorage.getItem('crm_archive');
            if (data) return JSON.parse(data);
            localStorage.setItem('crm_archive', JSON.stringify(INITIAL_ARCHIVE));
            return [...INITIAL_ARCHIVE];
        } catch (e) {
            return [...INITIAL_ARCHIVE];
        }
    },
    saveArchive(archive: Client[]) {
        try {
            localStorage.setItem('crm_archive', JSON.stringify(archive));
        } catch (e) {
            console.warn("Local storage save archive error:", e);
        }
    },
    getTemplates(): MessageTemplate[] {
        try {
            const data = localStorage.getItem('crm_templates');
            if (data) return JSON.parse(data);
            localStorage.setItem('crm_templates', JSON.stringify(INITIAL_TEMPLATES));
            return [...INITIAL_TEMPLATES];
        } catch (e) {
            return [...INITIAL_TEMPLATES];
        }
    },
    saveTemplates(templates: MessageTemplate[]) {
        try {
            localStorage.setItem('crm_templates', JSON.stringify(templates));
        } catch (e) {
            console.warn("Local storage save templates error:", e);
        }
    },
    getMasters(): Master[] {
        try {
            const data = localStorage.getItem('crm_masters');
            if (data) return JSON.parse(data);
            localStorage.setItem('crm_masters', JSON.stringify(INITIAL_MASTERS));
            return [...INITIAL_MASTERS];
        } catch (e) {
            return [...INITIAL_MASTERS];
        }
    },
    saveMasters(masters: Master[]) {
        try {
            localStorage.setItem('crm_masters', JSON.stringify(masters));
        } catch (e) {
            console.warn("Local storage save masters error:", e);
        }
    },
    getHistory(clientId: string): ClientEvent[] {
        try {
            const data = localStorage.getItem('crm_history');
            const allHistory = data ? JSON.parse(data) : INITIAL_HISTORY;
            return allHistory[clientId] || [];
        } catch (e) {
            return INITIAL_HISTORY[clientId] || [];
        }
    },
    logHistory(clientId: string, user: string, action: string, details: string) {
        try {
            const data = localStorage.getItem('crm_history');
            const allHistory = data ? JSON.parse(data) : { ...INITIAL_HISTORY };
            if (!allHistory[clientId]) allHistory[clientId] = [];
            allHistory[clientId].unshift({
                id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                clientId,
                timestamp: new Date().toISOString(),
                user: user || 'Admin',
                action,
                details
            });
            localStorage.setItem('crm_history', JSON.stringify(allHistory));
        } catch (e) {
            console.warn("Local storage log history error:", e);
        }
    }
};

// Execute action on local storage (when server is offline, DB is not connected, or dev mode)
export function executeLocalAction(action: string, payload: any = {}, user: string = 'Admin'): any {
    const clients = LocalCRMStorage.getClients();
    const archive = LocalCRMStorage.getArchive();

    switch (action) {
        case 'testconnection':
            return {
                status: 'success',
                message: 'Автономный режим: локальная база данных активна и готова к работе.',
                details: `Активных клиентов: ${clients.length}, В архиве: ${archive.length}`
            };

        case 'getclients':
            return {
                status: 'success',
                headers: getClientHeaders(),
                clients,
                archive
            };

        case 'add': {
            const newClient = { ...payload.client };
            if (!newClient.id) {
                newClient.id = `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            }
            if (!newClient['Дата добавления']) {
                newClient['Дата добавления'] = new Date().toISOString().split('T')[0];
            }
            LocalCRMStorage.saveClients([newClient, ...clients]);
            LocalCRMStorage.logHistory(newClient.id, user, 'Клиент создан', 'Добавлен через CRM');
            return { status: 'success', newId: newClient.id };
        }

        case 'update': {
            const updated = payload.client;
            let foundInActive = false;
            const updatedClients = clients.map(c => {
                if (c.id === updated.id) {
                    foundInActive = true;
                    return { ...c, ...updated };
                }
                return c;
            });

            if (foundInActive) {
                LocalCRMStorage.saveClients(updatedClients);
            } else {
                const updatedArchive = archive.map(c => c.id === updated.id ? { ...c, ...updated } : c);
                LocalCRMStorage.saveArchive(updatedArchive);
            }
            LocalCRMStorage.logHistory(updated.id, user, 'Данные обновлены', 'Изменено в CRM');
            return { status: 'success' };
        }

        case 'delete': {
            const clientId = payload.clientId;
            LocalCRMStorage.saveClients(clients.filter(c => c.id !== clientId));
            LocalCRMStorage.saveArchive(archive.filter(c => c.id !== clientId));
            return { status: 'success' };
        }

        case 'archive': {
            const clientId = payload.clientId;
            const target = clients.find(c => c.id === clientId);
            if (target) {
                const archivedClient = { ...target, is_archived: true, 'Статус сделки': 'Завершено' };
                LocalCRMStorage.saveClients(clients.filter(c => c.id !== clientId));
                LocalCRMStorage.saveArchive([archivedClient, ...archive]);
                LocalCRMStorage.logHistory(clientId, user, 'Заказ завершен', 'Переведен в архив');
            }
            return { status: 'success' };
        }

        case 'payment': {
            const { clientId, amount, paymentMethod, comment } = payload;
            let target = clients.find(c => c.id === clientId);
            let inArchive = false;
            if (!target) {
                target = archive.find(c => c.id === clientId);
                inArchive = true;
            }

            if (!target) {
                return { status: 'error', message: 'Клиент не найден' };
            }

            const currentDebt = Number(target['Долг'] || 0);
            const paidAmount = Number(amount) || 0;
            const newDebt = Math.max(0, currentDebt - paidAmount);
            target['Долг'] = newDebt;
            if (newDebt === 0 && target['Статус сделки'] !== 'Завершено') {
                target['Статус сделки'] = 'Оплачено';
            } else if (paidAmount > 0 && newDebt > 0) {
                target['Статус сделки'] = 'Частичная оплата';
            }

            if (inArchive) {
                LocalCRMStorage.saveArchive([...archive]);
            } else {
                LocalCRMStorage.saveClients([...clients]);
            }

            const methodStr = paymentMethod ? ` (${paymentMethod})` : '';
            const commentStr = comment ? `. ${comment}` : '';
            const details = `Принята оплата: ${paidAmount} ₽${methodStr}. Остаток долга: ${newDebt} ₽${commentStr}`;
            LocalCRMStorage.logHistory(clientId, user, 'Оплата', details);

            return {
                status: 'success',
                client: target,
                newDebt,
                message: details
            };
        }

        case 'reorder': {
            const oldId = payload.oldClientId;
            const freshData = { ...payload.client };
            if (!freshData.id) {
                freshData.id = `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            }

            const oldClient = clients.find(c => c.id === oldId);
            if (oldClient) {
                const archivedOld = { ...oldClient, is_archived: true, 'Статус сделки': 'Завершено' };
                LocalCRMStorage.saveClients([freshData, ...clients.filter(c => c.id !== oldId)]);
                LocalCRMStorage.saveArchive([archivedOld, ...archive]);
                LocalCRMStorage.logHistory(oldId, user, 'Заказ архивирован', 'Перенос в архив');
            } else {
                LocalCRMStorage.saveClients([freshData, ...clients]);
            }

            LocalCRMStorage.logHistory(freshData.id, user, 'Новый заказ создан', 'Повторный заказ');
            return { status: 'success', newId: freshData.id };
        }

        case 'bulkdelete': {
            const ids: string[] = payload.clientIds || [];
            LocalCRMStorage.saveClients(clients.filter(c => !ids.includes(c.id)));
            LocalCRMStorage.saveArchive(archive.filter(c => !ids.includes(c.id)));
            return { status: 'success' };
        }

        case 'getarchived': {
            const { clientId } = payload;
            const orders = clientId ? archive.filter(c => c.id === clientId) : archive;
            return { status: 'success', orders };
        }

        case 'gethistory':
            return { status: 'success', history: LocalCRMStorage.getHistory(payload.clientId) };

        case 'getlogs':
            return { status: 'success', logs: [] };

        case 'gettemplates':
            return { status: 'success', templates: LocalCRMStorage.getTemplates() };

        case 'savetemplates':
            LocalCRMStorage.saveTemplates(payload.templates || []);
            return { status: 'success' };

        case 'addtemplate': {
            const current = LocalCRMStorage.getTemplates();
            LocalCRMStorage.saveTemplates([...current, payload.template]);
            return { status: 'success' };
        }

        case 'updatetemplate': {
            const current = LocalCRMStorage.getTemplates();
            LocalCRMStorage.saveTemplates(current.map(t => t['Название шаблона'] === payload.template['Название шаблона'] ? payload.template : t));
            return { status: 'success' };
        }

        case 'deletetemplate': {
            const current = LocalCRMStorage.getTemplates();
            LocalCRMStorage.saveTemplates(current.filter(t => t['Название шаблона'] !== payload.templateName));
            return { status: 'success' };
        }

        case 'getmasters':
            return { status: 'success', masters: LocalCRMStorage.getMasters() };

        case 'addmaster': {
            const current = LocalCRMStorage.getMasters();
            LocalCRMStorage.saveMasters([...current, payload.master]);
            return { status: 'success' };
        }

        case 'updatemaster': {
            const current = LocalCRMStorage.getMasters();
            LocalCRMStorage.saveMasters(current.map(m => m.id === payload.master.id ? payload.master : m));
            return { status: 'success' };
        }

        case 'deletemaster': {
            const current = LocalCRMStorage.getMasters();
            LocalCRMStorage.saveMasters(current.filter(m => m.id !== payload.masterId));
            return { status: 'success' };
        }

        case 'sendMessage':
            return { status: 'success', message: 'Сообщение успешно отправлено (автономный режим).' };

        case 'bulksend':
            return { status: 'success', message: `Рассылка отправлена (${payload.clientIds?.length || 0} получателей)` };

        case 'uploadfile':
            return {
                status: 'success',
                fileUrl: `data:${payload.mimeType || 'image/jpeg'};base64,${payload.fileData}`
            };

        case 'import':
            if (payload.clients) LocalCRMStorage.saveClients(payload.clients);
            if (payload.archive) LocalCRMStorage.saveArchive(payload.archive);
            if (payload.masters) LocalCRMStorage.saveMasters(payload.masters);
            if (payload.templates) LocalCRMStorage.saveTemplates(payload.templates);
            return { status: 'success', count: (payload.clients?.length || 0) + (payload.archive?.length || 0) };

        case 'reset_db':
            LocalCRMStorage.saveClients([...INITIAL_CLIENTS]);
            LocalCRMStorage.saveArchive([...INITIAL_ARCHIVE]);
            LocalCRMStorage.saveTemplates([...INITIAL_TEMPLATES]);
            LocalCRMStorage.saveMasters([...INITIAL_MASTERS]);
            return { status: 'success' };

        default:
            return { status: 'success' };
    }
}

// Unified Request Handler with automatic offline / local storage fallback
async function requestAPI(action: string, payload: any = {}, customUrl?: string, forceMode?: 'GAS' | 'VERCEL') {
    const settings = getSettingsFromStorage();
    const mode = forceMode || settings.apiMode || 'VERCEL';
    const userJson = sessionStorage.getItem('user');
    const user = userJson ? JSON.parse(userJson) : { username: 'Admin' };

    // Common payload enrichment
    const finalPayload = { 
        action,
        ...payload, 
        user: user.username,
        googleSheetId: settings.googleSheetId
    };

    if (mode === 'VERCEL') {
        // --- VERCEL MODE ---
        // Vercel handles requests via internal API routes (/api/crm)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        try {
            let response: Response;
            try {
                response = await fetch('/api/crm', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(finalPayload),
                    signal: controller.signal
                });
            } catch (networkErr: any) {
                console.info("[CRM API] Сервер недоступен, используется локальное хранилище данных:", networkErr?.message);
                return executeLocalAction(action, finalPayload, user.username);
            } finally {
                clearTimeout(timeoutId);
            }

            // Check Content-Type to avoid parsing HTML (Vite fallback) as JSON
            const contentType = response.headers.get("content-type") || "";
            if (contentType.indexOf("application/json") === -1) {
                console.info("[CRM API] Получен не-JSON ответ от /api/crm, переключение на локальное хранилище.");
                return executeLocalAction(action, finalPayload, user.username);
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.info(`[CRM API] Сервер вернул код ${response.status}: ${errorText.substring(0, 60)}. Переключение на локальное хранилище.`);
                return executeLocalAction(action, finalPayload, user.username);
            }

            const result = await response.json();
            if (result.status === 'error') {
                // If database is not configured (e.g. POSTGRES_URL missing), fall back to local store
                if (result.code === 'NO_DATABASE_URL' || (result.message && (result.message.includes('POSTGRES_URL') || result.message.includes('Configuration Error')))) {
                    console.info("[CRM API] База данных не подключена к серверу. Используется автономное хранилище.");
                    return executeLocalAction(action, finalPayload, user.username);
                }
                throw new Error(result.message);
            }
            return result;
        } catch (e: any) {
            console.warn("[CRM API] Ошибка Vercel API, переход на локальное хранилище:", e?.message);
            return executeLocalAction(action, finalPayload, user.username);
        }
    } else {
        // --- GOOGLE SHEETS MODE (LEGACY) ---
        const url = customUrl ? customUrl.trim() : settings.googleSheetId.trim();
        if (!url) {
            console.info("[CRM API] Google Sheet URL не настроен, используется локальное хранилище.");
            return executeLocalAction(action, finalPayload, user.username);
        }

        let responseText = "";
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(finalPayload),
            });
            responseText = await response.text();
            if (!response.ok) {
                console.warn(`[CRM API] Ошибка сети GAS (${response.status}), fallback на локальное хранилище.`);
                return executeLocalAction(action, finalPayload, user.username);
            }
        } catch (netError: any) {
            console.warn("[CRM API] Ошибка сети GAS, fallback на локальное хранилище:", netError?.message);
            return executeLocalAction(action, finalPayload, user.username);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.warn("[CRM API] Ошибка парсинга ответа GAS, fallback на локальное хранилище.");
            return executeLocalAction(action, finalPayload, user.username);
        }

        if (result.status !== 'success' && !result.success) { 
            const scriptError = result.message || result.error || 'Неизвестная ошибка от скрипта.';
            console.warn("[CRM API] Ошибка от скрипта GAS:", scriptError);
            return executeLocalAction(action, finalPayload, user.username);
        }
        return result;
    }
}

export const api = {
  fetchClients: async (): Promise<{ headers: string[], clients: Client[], archive: Client[] }> => {
    const headers = getClientHeaders();
    try {
        const result = await requestAPI('getclients');

        const processClients = (data: any[]): Client[] => {
            return (data || []).map((c: any) => ({
                ...c,
                'Общая сумма': parseCurrency(c['Общая сумма']),
                'Долг': parseCurrency(c['Долг']),
                'Цена за месяц': parseCurrency(c['Цена за месяц']),
                'Срок': parseDuration(c['Срок']),
                'Кол-во шин': parseDuration(c['Кол-во шин']),
                photoUrls: typeof c.photoUrls === 'string' && c.photoUrls.length > 0 ? c.photoUrls.split(',') : (Array.isArray(c.photoUrls) ? c.photoUrls : [])
            }));
        };

        const clients = processClients(result.clients);
        const archive = processClients(result.archive);

        return { headers: result.headers || headers, clients, archive };
    } catch (error) {
        console.warn("API Error fallback in fetchClients:", error);
        const local = executeLocalAction('getclients');
        return {
            headers,
            clients: local.clients || [],
            archive: local.archive || []
        };
    }
  },

  updateClient: async (updatedClient: Partial<Client>): Promise<Client> => {
    const clientToSend = {
      ...updatedClient,
      photoUrls: Array.isArray(updatedClient.photoUrls) ? updatedClient.photoUrls.join(',') : updatedClient.photoUrls,
    };
    await requestAPI('update', { client: clientToSend });
    return updatedClient as Client;
  },

  addClient: async (newClientData: Partial<Client>): Promise<Client> => {
    const clientForSheet = {
      ...newClientData,
      photoUrls: (newClientData.photoUrls || []).join(','),
    };

    const result = await requestAPI('add', { client: clientForSheet });
    return { 
        ...newClientData, 
        id: result?.newId || newClientData.id,
    } as Client;
  },

  reorderClient: async (oldClientId: string, newClientData: Partial<Client>): Promise<Client> => {
    const clientForSheet = {
      ...newClientData,
      photoUrls: (newClientData.photoUrls || []).join(','),
    };
    
    const result = await requestAPI('reorder', {
        oldClientId: oldClientId,
        client: clientForSheet
    });
    
    return {
      ...newClientData,
      id: result?.newId || newClientData.id,
    } as Client;
  },

  deleteClient: async (clientId: string): Promise<void> => {
    await requestAPI('delete', { clientId: clientId });
  },

  archiveClient: async (clientId: string): Promise<void> => {
    await requestAPI('archive', { clientId: clientId });
  },

  recordPayment: async (
    clientId: string,
    amount: number,
    paymentMethod: string,
    comment?: string
  ): Promise<{ newDebt?: number; message: string; client?: Client }> => {
    const result = await requestAPI('payment', {
      clientId,
      amount,
      paymentMethod,
      comment: comment || '',
    });
    return result;
  },
  
  bulkDeleteClients: async (clientIds: string[]): Promise<void> => {
    await requestAPI('bulkdelete', { clientIds: clientIds });
  },

  fetchArchivedOrders: async (clientId: string): Promise<Client[]> => {
    const result = await requestAPI('getarchived', { clientId });
    return (result?.orders || []).map((c: any) => ({
        ...c,
        photoUrls: typeof c.photoUrls === 'string' && c.photoUrls.length > 0 ? c.photoUrls.split(',') : []
    }));
  },

  fetchSettings: async (): Promise<Settings> => {
    await delay(30);
    return getSettingsFromStorage();
  },

  saveSettings: async (settings: Settings): Promise<Settings> => {
    await delay(100);
    localStorage.setItem('crm_settings', JSON.stringify(settings));
    return settings;
  },

  fetchTemplates: async (): Promise<MessageTemplate[]> => {
    try {
        const result = await requestAPI('gettemplates');
        return result?.templates || [];
    } catch (error) {
        console.warn("Template fetch failed:", error); 
        return LocalCRMStorage.getTemplates();
    }
  },

  updateTemplate: async (template: MessageTemplate): Promise<MessageTemplate> => {
    await requestAPI('updatetemplate', { template: template });
    return template;
  },
  
  addTemplate: async (template: MessageTemplate): Promise<MessageTemplate> => {
    await requestAPI('addtemplate', { template: template });
    return template;
  },
  
  deleteTemplate: async(templateName: string): Promise<void> => {
    await requestAPI('deletetemplate', { templateName: templateName });
  },

  saveTemplates: async (templates: MessageTemplate[]): Promise<MessageTemplate[]> => {
    await requestAPI('savetemplates', { templates: templates });
    return templates;
  },

  sendMessage: async (chatId: string | number, message: string): Promise<{success: boolean, message: string}> => {
      if (!chatId) {
          return { success: false, message: 'Ошибка: Chat ID не указан.' };
      }
      
      try {
          const result = await requestAPI('sendMessage', {
              chatId: chatId,
              message: message,
          });
          return { success: true, message: result?.message || `Сообщение успешно отправлено.` };
      } catch (e: any) {
          console.error("Send message error:", e);
          return { success: false, message: e.message };
      }
  },
  
  bulkSendMessage: async (clientIds: string[], templateName: string): Promise<void> => {
    await requestAPI('bulksend', { clientIds, templateName });
  },
  
  uploadFile: async (file: File, client: Partial<Client>): Promise<{ fileUrl: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            if (e.target?.result) {
                const dataUrl = e.target.result as string;
                const fileData = dataUrl.split(',')[1]; // Get base64 data
                try {
                    const result = await requestAPI('uploadfile', {
                        client: {
                            id: client.id,
                            'Имя клиента': client['Имя клиента'],
                            'Договор': client['Договор']
                        },
                        filename: file.name,
                        mimeType: file.type,
                        fileData: fileData,
                    });
                    resolve({ fileUrl: result?.fileUrl || dataUrl });
                } catch (error) {
                    reject(error);
                }
            } else {
                reject(new Error("Не удалось прочитать файл"));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
  },
  
  fetchPhotosForContract: async (contractNumber: string): Promise<string[]> => {
    if (!contractNumber) return [];
    try {
        const result = await requestAPI('getphotos', { contractNumber });
        return result?.photoUrls || [];
    } catch(e) {
        return [];
    }
  },

  fetchClientHistory: async (clientId: string): Promise<ClientEvent[]> => {
    try {
        const result = await requestAPI('gethistory', { clientId });
        return result?.history || [];
    } catch (e) {
        return LocalCRMStorage.getHistory(clientId);
    }
  },

  fetchLogs: async (): Promise<AppLog[]> => {
    try {
        const result = await requestAPI('getlogs');
        return result?.logs || [];
    } catch (e) {
        return [];
    }
  },

  fetchMasters: async (): Promise<Master[]> => {
    try {
        const result = await requestAPI('getmasters');
        return result?.masters || [];
    } catch (error) {
        console.warn("Fetch masters failed:", error);
        return LocalCRMStorage.getMasters();
    }
  },
  addMaster: async (master: Omit<Master, 'id'>): Promise<Master> => {
    const newMaster: Master = { ...master, id: `master_${Date.now()}` } as Master;
    await requestAPI('addmaster', { master: newMaster });
    return newMaster;
  },
  updateMaster: async (master: Master): Promise<Master> => {
    await requestAPI('updatemaster', { master });
    return master;
  },
  deleteMaster: async (masterId: string): Promise<void> => {
    await requestAPI('deletemaster', { masterId });
  },
  
  // Helper for Settings page
  testConnection: async (url: string): Promise<any> => {
    return await requestAPI('testconnection', {}, url, 'GAS');
  },

  // Migration tools
  fetchDataForMigration: async (): Promise<{ clients: any[], archive: any[], masters: any[], templates: any[] }> => {
      const [clientsData, mastersData, templatesData] = await Promise.all([
          requestAPI('getclients', {}, undefined, 'GAS'),
          requestAPI('getmasters', {}, undefined, 'GAS'),
          requestAPI('gettemplates', {}, undefined, 'GAS')
      ]);

      return { 
          clients: clientsData?.clients || [], 
          archive: clientsData?.archive || [],
          masters: mastersData?.masters || [],
          templates: templatesData?.templates || []
      };
  },

  importDataToVercel: async (clients: any[], archive: any[], masters?: any[], templates?: any[]): Promise<any> => {
      return await requestAPI('import', { clients, archive, masters, templates }, undefined, 'VERCEL');
  },
  
  clearDatabase: async (): Promise<void> => {
      return await requestAPI('reset_db', {}, undefined, 'VERCEL');
  },

  getDbSettings: async (): Promise<any> => {
      const result = await requestAPI('get_settings');
      return result?.settings || {};
  },

  updateDbSetting: async (key: string, value: any): Promise<void> => {
      await requestAPI('update_setting', { key, value });
  }
};
