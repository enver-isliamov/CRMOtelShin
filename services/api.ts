

import { Client, Settings, MessageTemplate, Master, ClientEvent, AppLog, parseCurrency, parseDuration } from '../types';

const getSettingsFromStorage = (): Settings => {
    const data = localStorage.getItem('crm_settings');
    const defaults: Settings = { telegramBotToken: '', adminIds: '', managerIds: '', googleSheetId: '', sheetName: 'WebBase' };
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
      'Заказ - QR', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков',
      'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка',
      'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки',
      'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls'
    ];
    return clientKeys.filter(h => h !== 'id').map(String);
}


// Google Sheets API interaction
async function postToGoogleSheet(payload: object, customUrl?: string) {
    const settings = getSettingsFromStorage();
    const url = customUrl || settings.googleSheetId;
    
    if (!url) {
        throw new Error("Google Sheet URL не настроен.");
    }

    const userJson = sessionStorage.getItem('user');
    const user = userJson ? JSON.parse(userJson) : { username: 'System' };
    
    const payloadWithContext = { 
        ...payload, 
        user: user.username,
        telegramBotToken: settings.telegramBotToken
    };
    
    const formData = new FormData();
    formData.append('payload', JSON.stringify(payloadWithContext));

    const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        body: formData,
    });
    
    const responseText = await response.text();
    if (!response.ok) {
        console.error("Google Script Network Error Response:", responseText);
        throw new Error(`Сетевая ошибка: ${response.status} ${response.statusText}. Возможно, неверный URL или проблема с доступом к скрипту.`);
    }
    
    let result;
    try {
        result = JSON.parse(responseText);
    } catch (e) {
        console.error("Failed to parse Google Script JSON response:", responseText);
        throw new Error("Не удалось обработать ответ от Google Script. Ответ не является корректным JSON. Проверьте URL и настройки доступа к скрипту.");
    }

    if (result.status !== 'success' && !result.success) { 
        const scriptError = result.message || result.error || 'Неизвестная ошибка от скрипта.';
        throw new Error(scriptError);
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
        console.error("Не удалось получить данные из Google Sheets:", error);
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
        console.error("Не удалось получить шаблоны из Google Sheets:", error);
        throw error; // Re-throw to be caught by App.tsx
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
        console.error("Не удалось получить мастеров из Google Sheets:", error);
        throw error;
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
  testConnection: async (url: string): Promise<any> => {
    return await postToGoogleSheet({ action: 'testconnection' }, url);
  },
};