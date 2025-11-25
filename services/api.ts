
import { Client, Settings, MessageTemplate, Master, ClientEvent, AppLog, parseCurrency, parseDuration } from '../types';

const getSettingsFromStorage = (): Settings => {
    const data = localStorage.getItem('crm_settings');
    const defaults: Settings = { adminIds: '', managerIds: '', googleSheetId: '', sheetName: 'WebBase' };
    if (data) {
        return { ...defaults, ...JSON.parse(data) };
    }
    return defaults;
};

// Simulate API latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const getClientHeaders = (): string[] => {
    // Define a comprehensive set of headers to ensure consistency
    const clientKeys: Array<keyof Client> = [
      'id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто',
      'Заказ - QR', 'DOT-код', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков',
      'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка',
      'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки',
      'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls'
    ];
    return clientKeys.filter(h => h !== 'id').map(String);
}


// Google Sheets API interaction
async function postToGoogleSheet(payload: object, customUrl?: string) {
    const settings = getSettingsFromStorage();
    const url = customUrl ? customUrl.trim() : settings.googleSheetId.trim();
    
    if (!url) {
        throw new Error("Google Sheet URL не настроен.");
    }

    const userJson = sessionStorage.getItem('user');
    const user = userJson ? JSON.parse(userJson) : { username: 'Admin' };
    
    // Flatten the structure. Do not nest 'payload'.
    // GAS script should check e.postData.contents directly.
    const finalPayload = { 
        ...payload, 
        user: user.username // Add user context directly
    };
    
    let responseText = "";
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            // Use text/plain to avoid CORS preflight options request which GAS hates.
            // This is the standard "simple request" method for GAS.
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(finalPayload),
        });
        
        responseText = await response.text();
        
        if (!response.ok) {
            console.error("Google Script Network Error:", response.status, responseText);
            throw new Error(`Сетевая ошибка (${response.status}). Ответ: ${responseText.substring(0, 100)}`);
        }
    } catch (netError: any) {
        throw new Error(`Ошибка сети: ${netError.message}`);
    }
    
    let result;
    try {
        result = JSON.parse(responseText);
    } catch (e) {
        console.error("JSON Parse Error. Raw text:", responseText);
        throw new Error(`Ошибка обработки ответа сервера. Пришло: "${responseText.substring(0, 50)}..."`);
    }

    if (result.status !== 'success' && !result.success) { 
        const scriptError = result.message || result.error || 'Неизвестная ошибка от скрипта.';
        
        // --- INTELLIGENT ERROR HANDLING FOR DEPLOYMENT ISSUES ---
        // If the backend returns "Invalid Action" or the specific Russian translation "Неверное действие",
        // it means the script running on the server is OLD and doesn't know about the new action (like 'testconnection').
        // The user MUST redeploy a "New Version".
        if (scriptError.includes('Invalid Action') || scriptError.includes('Неверное действие')) {
             throw new Error(`ОШИБКА РАЗВЕРТЫВАНИЯ: Скрипт не узнал команду. \nПохоже, вы не создали "Новую Версию" при развертывании.\n\nЗайдите в редактор скриптов -> Начать развертывание -> Управление -> Редактировать -> Версия: "Новая версия" -> Развернуть.`);
        }
        
        // If debug info is present, include it
        const debugInfo = result.debug ? ` (Debug: ${result.debug})` : '';
        throw new Error(scriptError + debugInfo);
    }
    return result;
}


export const api = {
  fetchClients: async (): Promise<{ headers: string[], clients: Client[], archive: Client[] }> => {
    const headers = getClientHeaders();
    try {
        const result = await postToGoogleSheet({ action: 'getclients' });

        const processClients = (data: any[]): Client[] => {
            return (data || []).map((c: any) => ({
                ...c,
                'Общая сумма': parseCurrency(c['Общая сумма']),
                'Долг': parseCurrency(c['Долг']),
                'Цена за месяц': parseCurrency(c['Цена за месяц']),
                'Срок': parseDuration(c['Срок']),
                'Кол-во шин': parseDuration(c['Кол-во шин']),
                photoUrls: typeof c.photoUrls === 'string' && c.photoUrls.length > 0 ? c.photoUrls.split(',') : []
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
    const clientToSend = {
      ...updatedClient,
      photoUrls: Array.isArray(updatedClient.photoUrls) ? updatedClient.photoUrls.join(',') : updatedClient.photoUrls,
    };
    await postToGoogleSheet({ action: 'update', client: clientToSend });
    return updatedClient as Client;
  },

  addClient: async (newClientData: Partial<Client>): Promise<Client> => {
    const clientForSheet = {
      ...newClientData,
      photoUrls: (newClientData.photoUrls || []).join(','),
    };

    const result = await postToGoogleSheet({ action: 'add', client: clientForSheet });
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
    
    const result = await postToGoogleSheet({
        action: 'reorder',
        oldClientId: oldClientId,
        client: clientForSheet
    });
    
    return {
      ...newClientData,
      id: result.newId || newClientData.id,
    } as Client;
  },

  deleteClient: async (clientId: string): Promise<void> => {
    await postToGoogleSheet({ action: 'delete', clientId: clientId });
  },
  
  bulkDeleteClients: async (clientIds: string[]): Promise<void> => {
    await postToGoogleSheet({ action: 'bulkdelete', clientIds: clientIds });
  },

  fetchArchivedOrders: async (clientId: string): Promise<Client[]> => {
    const result = await postToGoogleSheet({ action: 'getarchived', clientId });
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
        const result = await postToGoogleSheet({ action: 'gettemplates' });
        return result.templates || [];
    } catch (error) {
        // Suppress initial load error for cleaner UI if it's just empty
        console.warn("Template fetch failed:", error); 
        return [];
    }
  },

  updateTemplate: async (template: MessageTemplate): Promise<MessageTemplate> => {
    await postToGoogleSheet({ action: 'updatetemplate', template: template });
    return template;
  },
  
  deleteTemplate: async(templateName: string): Promise<void> => {
    await postToGoogleSheet({ action: 'deletetemplate', templateName: templateName });
  },

  saveTemplates: async (templates: MessageTemplate[]): Promise<MessageTemplate[]> => {
    try {
        await postToGoogleSheet({ action: 'savetemplates', templates: templates });
        return templates;
    } catch (error) {
        console.error("Не удалось сохранить шаблоны в Google Sheets:", error);
        throw error;
    }
  },

  sendMessage: async (chatId: string | number, message: string): Promise<{success: boolean, message: string}> => {
      if (!chatId) {
          return { success: false, message: 'Ошибка: Chat ID не указан.' };
      }
      
      try {
          const result = await postToGoogleSheet({
              action: 'sendMessage',
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
    await postToGoogleSheet({ action: 'bulksend', clientIds, templateName });
  },
  
  uploadFile: async (file: File, client: Partial<Client>): Promise<{ fileUrl: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            if (e.target?.result) {
                const dataUrl = e.target.result as string;
                const fileData = dataUrl.split(',')[1]; // Get base64 data
                try {
                    const result = await postToGoogleSheet({
                        action: 'uploadfile',
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
    const result = await postToGoogleSheet({ action: 'getphotos', contractNumber });
    return result.photoUrls || [];
  },

  fetchClientHistory: async (clientId: string): Promise<ClientEvent[]> => {
    const result = await postToGoogleSheet({ action: 'gethistory', clientId });
    return result.history || [];
  },

  fetchLogs: async (): Promise<AppLog[]> => {
    const result = await postToGoogleSheet({ action: 'getlogs' });
    return result.logs || [];
  },

  fetchMasters: async (): Promise<Master[]> => {
    try {
        const result = await postToGoogleSheet({ action: 'getmasters' });
        return result.masters || [];
    } catch (error) {
        console.warn("Fetch masters failed:", error);
        return [];
    }
  },
  addMaster: async (master: Omit<Master, 'id'>): Promise<Master> => {
    const newMaster: Master = { ...master, id: `master_${Date.now()}` } as Master;
    await postToGoogleSheet({ action: 'addmaster', master: newMaster });
    return newMaster;
  },
  updateMaster: async (master: Master): Promise<Master> => {
    await postToGoogleSheet({ action: 'updatemaster', master });
    return master;
  },
  deleteMaster: async (masterId: string): Promise<void> => {
    await postToGoogleSheet({ action: 'deletemaster', masterId });
  },
  // Specifically used for the "Test Connection" button
  testConnection: async (url: string): Promise<any> => {
    // We send a specific action to verify routing works
    // IMPORTANT: 'testconnection' is handled BEFORE the main switch to ensure it works even if payload is weird
    return await postToGoogleSheet({ action: 'testconnection' }, url);
  },
};
