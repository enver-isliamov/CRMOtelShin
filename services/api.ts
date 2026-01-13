
import { Client, Settings, MessageTemplate, Master, ClientEvent, AppLog, parseCurrency, parseDuration } from '../types';

const getSettingsFromStorage = (): Settings => {
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
}

// Unified Request Handler
// Added 'forceMode' to explicitly bypass settings (useful for migration)
async function requestAPI(action: string, payload: any = {}, customUrl?: string, forceMode?: 'GAS' | 'VERCEL') {
    const settings = getSettingsFromStorage();
    const mode = forceMode || settings.apiMode || 'VERCEL';
    const userJson = sessionStorage.getItem('user');
    const user = userJson ? JSON.parse(userJson) : { username: 'Admin' };

    // Common payload enrichment
    const finalPayload = { 
        action,
        ...payload, 
        user: user.username 
    };

    if (mode === 'VERCEL') {
        // --- VERCEL MODE ---
        // Vercel handles requests via internal API routes (/api/crm)
        try {
            const response = await fetch('/api/crm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(finalPayload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                // If endpoint not found (404), it means Vercel functions aren't deployed or path is wrong
                if (response.status === 404) {
                     throw new Error(`API Vercel не найден (/api/crm). Проверьте деплой.`);
                }
                throw new Error(`Vercel API Error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            if (result.status === 'error') {
                throw new Error(result.message);
            }
            return result;
        } catch (e: any) {
            console.error("Vercel API Error:", e);
            throw e;
        }
    } else {
        // --- GOOGLE SHEETS MODE (LEGACY) ---
        const url = customUrl ? customUrl.trim() : settings.googleSheetId.trim();
        if (!url) throw new Error("Google Sheet URL не настроен.");

        let responseText = "";
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(finalPayload),
            });
            responseText = await response.text();
            if (!response.ok) {
                throw new Error(`Сетевая ошибка (${response.status}). Ответ: ${responseText.substring(0, 100)}`);
            }
        } catch (netError: any) {
            throw new Error(`Ошибка сети GAS: ${netError.message}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Ошибка обработки ответа сервера. Пришло: "${responseText.substring(0, 50)}..."`);
        }

        if (result.status !== 'success' && !result.success) { 
            const scriptError = result.message || result.error || 'Неизвестная ошибка от скрипта.';
            if (scriptError.includes('Invalid Action') || scriptError.includes('Неверное действие')) {
                 throw new Error(`ОШИБКА РАЗВЕРТЫВАНИЯ: Скрипт не узнал команду.`);
            }
            throw new Error(scriptError);
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
        }

        const clients = processClients(result.clients);
        const archive = processClients(result.archive);

        return { headers: result.headers || headers, clients, archive };
    } catch (error) {
        console.error("API Error (fetchClients):", error);
        throw error;
    }
  },

  updateClient: async (updatedClient: Partial<Client>): Promise<Client> => {
    // GAS expects comma string, Vercel can handle arrays but let's keep consistency for now
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
        id: result.newId || newClientData.id,
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
      id: result.newId || newClientData.id,
    } as Client;
  },

  deleteClient: async (clientId: string): Promise<void> => {
    await requestAPI('delete', { clientId: clientId });
  },
  
  bulkDeleteClients: async (clientIds: string[]): Promise<void> => {
    await requestAPI('bulkdelete', { clientIds: clientIds });
  },

  fetchArchivedOrders: async (clientId: string): Promise<Client[]> => {
    const result = await requestAPI('getarchived', { clientId });
    return (result.orders || []).map((c: any) => ({
        ...c,
        photoUrls: typeof c.photoUrls === 'string' && c.photoUrls.length > 0 ? c.photoUrls.split(',') : []
    }));
  },

  fetchSettings: async (): Promise<Settings> => {
    await delay(200);
    return getSettingsFromStorage();
  },

  saveSettings: async (settings: Settings): Promise<Settings> => {
    await delay(300);
    localStorage.setItem('crm_settings', JSON.stringify(settings));
    return settings;
  },

  fetchTemplates: async (): Promise<MessageTemplate[]> => {
    try {
        const result = await requestAPI('gettemplates');
        return result.templates || [];
    } catch (error) {
        console.warn("Template fetch failed:", error); 
        return [];
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
    try {
        await requestAPI('savetemplates', { templates: templates });
        return templates;
    } catch (error) {
        throw error;
    }
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
          return { success: true, message: result.message || `Сообщение успешно отправлено.` };
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
                    resolve({ fileUrl: result.fileUrl });
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
        return result.photoUrls || [];
    } catch(e) {
        return [];
    }
  },

  fetchClientHistory: async (clientId: string): Promise<ClientEvent[]> => {
    const result = await requestAPI('gethistory', { clientId });
    return result.history || [];
  },

  fetchLogs: async (): Promise<AppLog[]> => {
    const result = await requestAPI('getlogs');
    return result.logs || [];
  },

  fetchMasters: async (): Promise<Master[]> => {
    try {
        const result = await requestAPI('getmasters');
        return result.masters || [];
    } catch (error) {
        console.warn("Fetch masters failed:", error);
        return [];
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

  // Migration tools - UPGRADED to fetch everything
  fetchDataForMigration: async (): Promise<{ clients: any[], archive: any[], masters: any[], templates: any[] }> => {
      // Force GAS request for all entities
      const [clientsData, mastersData, templatesData] = await Promise.all([
          requestAPI('getclients', {}, undefined, 'GAS'),
          requestAPI('getmasters', {}, undefined, 'GAS'),
          requestAPI('gettemplates', {}, undefined, 'GAS')
      ]);

      return { 
          clients: clientsData.clients || [], 
          archive: clientsData.archive || [],
          masters: mastersData.masters || [],
          templates: templatesData.templates || []
      };
  },

  importDataToVercel: async (clients: any[], archive: any[], masters?: any[], templates?: any[]): Promise<any> => {
      // Force Vercel request with comprehensive payload
      return await requestAPI('import', { clients, archive, masters, templates }, undefined, 'VERCEL');
  },
  
  clearDatabase: async (): Promise<void> => {
      return await requestAPI('reset_db', {}, undefined, 'VERCEL');
  }
};
