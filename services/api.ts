import { Client, Settings, MessageTemplate, Master, ClientEvent, AppLog, parseCurrency, parseDuration } from '../types';
import { photoStorage } from '../utils/photoStorage';
import { offlineStorage } from './offlineStorage';
import { syncManager } from './syncManager';
import { 
  INITIAL_CLIENTS, 
  INITIAL_ARCHIVE, 
  INITIAL_TEMPLATES, 
  INITIAL_MASTERS, 
  INITIAL_HISTORY 
} from '../data/mockData';

// ============================================================================
// Settings & Headers Helpers
// ============================================================================

const getSettingsFromStorage = (): Settings => {
    try {
        const data = localStorage.getItem('crm_settings');
        // Independent PostgreSQL / Local engine mode (no Google Apps Script)
        const defaults: Settings = { adminIds: '', managerIds: '', googleSheetId: '', sheetName: 'WebBase', apiMode: 'VERCEL' };
        
        if (data) {
            const parsed = JSON.parse(data);
            return { ...defaults, ...parsed, apiMode: 'VERCEL' };
        }
        return defaults;
    } catch (e) {
        console.error("Settings parse error, resetting defaults", e);
        return { adminIds: '', managerIds: '', googleSheetId: '', sheetName: 'WebBase', apiMode: 'VERCEL' };
    }
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const getClientHeaders = (): string[] => {
    const clientKeys: Array<keyof Client> = [
      'id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто',
      'Заказ - QR', 'Бренд_Модель', 'DOT-код', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков',
      'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка',
      'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки',
      'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls', 'metadata'
    ];
    return clientKeys.filter(h => h !== 'id').map(String);
};

// ============================================================================
// Local CRM Storage (Resilient Offline & Dev Execution)
// ============================================================================

export const LocalCRMStorage = {
    getClients(): Client[] {
        try {
            const data = localStorage.getItem('crm_clients');
            if (data) {
                const parsed: Client[] = JSON.parse(data);
                // Auto-sync real imported database if not yet present in localStorage
                if (!parsed.some(c => c['Имя клиента'] === 'Enrike Tomas' || c.id === 'c_real_1')) {
                    const combined = [...INITIAL_CLIENTS, ...parsed.filter(c => !c.id.startsWith('c_171060000'))];
                    localStorage.setItem('crm_clients', JSON.stringify(combined));
                    return combined;
                }
                return parsed;
            }
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
            console.warn("Local storage save clients quota exceeded, storing sanitized records:", e);
            try {
                const sanitized = clients.map(c => ({
                    ...c,
                    photoUrls: (Array.isArray(c.photoUrls) ? c.photoUrls : []).filter(u => !u.startsWith('data:'))
                }));
                localStorage.setItem('crm_clients', JSON.stringify(sanitized));
            } catch (err2) {
                console.error("Local storage completely failed to save clients:", err2);
            }
        }
    },
    getArchive(): Client[] {
        try {
            const data = localStorage.getItem('crm_archive');
            if (data) {
                const parsed: Client[] = JSON.parse(data);
                if (!parsed.some(c => c['Имя клиента'] === 'Денис Грошев' || c.id === 'arc_1')) {
                    const customUserItems = parsed.filter(c => !c.id.startsWith('arc_real_') && !c.id.startsWith('c_171060004'));
                    const combined = [...INITIAL_ARCHIVE, ...customUserItems.filter(u => !INITIAL_ARCHIVE.some(a => a.id === u.id || (a['Договор'] && a['Договор'] === u['Договор'])))];
                    localStorage.setItem('crm_archive', JSON.stringify(combined));
                    return combined;
                }
                return parsed;
            }
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
            if (data) {
                const parsed: MessageTemplate[] = JSON.parse(data);
                if (!parsed.some(t => t['Название шаблона'] === 'Отзыв в Авито')) {
                    localStorage.setItem('crm_templates', JSON.stringify(INITIAL_TEMPLATES));
                    return [...INITIAL_TEMPLATES];
                }
                return parsed;
            }
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
            if (data) {
                const parsed: Master[] = JSON.parse(data);
                if (!parsed.some(m => m['Имя'] === 'Спиридон')) {
                    localStorage.setItem('crm_masters', JSON.stringify(INITIAL_MASTERS));
                    return [...INITIAL_MASTERS];
                }
                return parsed;
            }
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

// ============================================================================
// Local Action Fallback Processor
// ============================================================================

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
            const updated = { ...payload.client };
            if (typeof updated.photoUrls === 'string') {
                updated.photoUrls = updated.photoUrls.length > 0 ? updated.photoUrls.split(',') : [];
            }
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
                freshData.id = oldId || `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            }

            const oldClient = clients.find(c => c.id === oldId);
            if (oldClient) {
                const archivedOld = { 
                    ...oldClient, 
                    id: `${oldId}_arch_${Date.now()}`, 
                    is_archived: true, 
                    'Статус сделки': 'Завершено' 
                };
                LocalCRMStorage.saveClients([freshData, ...clients.filter(c => c.id !== oldId)]);
                LocalCRMStorage.saveArchive([archivedOld, ...archive]);
                LocalCRMStorage.logHistory(
                    oldId, 
                    user, 
                    payload.archiveAction || 'Комплект выдан', 
                    payload.archiveDetails || 'Выдан со склада при сезонной замене'
                );
            } else {
                LocalCRMStorage.saveClients([freshData, ...clients]);
            }

            LocalCRMStorage.logHistory(
                freshData.id, 
                user, 
                payload.newAction || 'Комплект принят', 
                payload.newDetails || 'Принят на сезонное хранение'
            );
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
            const current = clients.find(c => c.id === clientId) || archive.find(c => c.id === clientId);
            const orders = clientId ? archive.filter(c => {
                if (c.id === clientId) return true;
                if (current) {
                    const p1 = current['Телефон'] ? String(current['Телефон']).replace(/\D/g, '') : '';
                    const p2 = c['Телефон'] ? String(c['Телефон']).replace(/\D/g, '') : '';
                    if (p1 && p2 && p1 === p2) return true;

                    const a1 = current['Номер Авто'] ? String(current['Номер Авто']).trim().toUpperCase() : '';
                    const a2 = c['Номер Авто'] ? String(c['Номер Авто']).trim().toUpperCase() : '';
                    if (a1 && a2 && a1 === a2) return true;

                    if (current['Chat ID'] && c['Chat ID'] && String(current['Chat ID']) === String(c['Chat ID'])) return true;
                }
                return false;
            }) : archive;
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

        case 'getphotos': {
            const { contractNumber, clientId } = payload;
            let found = clients.find(c => (contractNumber && c['Договор'] === contractNumber) || (clientId && c.id === clientId));
            if (!found) {
                found = archive.find(c => (contractNumber && c['Договор'] === contractNumber) || (clientId && c.id === clientId));
            }
            const rawPhotos = found?.photoUrls;
            const photoUrls = Array.isArray(rawPhotos)
                ? rawPhotos
                : (typeof (rawPhotos as unknown) === 'string' && (rawPhotos as unknown as string).trim().length > 0
                    ? (rawPhotos as unknown as string).split(',')
                    : []);
            return { status: 'success', photoUrls };
        }

        case 'import': {
            const mode = payload.mode || 'merge';
            if (mode === 'replace') {
                if (payload.clients) LocalCRMStorage.saveClients(payload.clients);
                if (payload.archive) LocalCRMStorage.saveArchive(payload.archive);
            } else {
                if (payload.clients && Array.isArray(payload.clients)) {
                    const currentClients = LocalCRMStorage.getClients();
                    const mergedClients = [...currentClients];
                    for (const inc of payload.clients) {
                        const incId = inc.id || `c_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
                        const incClean = { ...inc, id: incId };
                        const idx = mergedClients.findIndex(c => 
                            (c.id && incClean.id && c.id === incClean.id) ||
                            (c['Договор'] && incClean['Договор'] && String(c['Договор']).trim() === String(incClean['Договор']).trim()) ||
                            (c['Телефон'] && incClean['Телефон'] && String(c['Телефон']).replace(/\D/g, '') === String(incClean['Телефон']).replace(/\D/g, '') && String(c['Телефон']).replace(/\D/g, '').length >= 10)
                        );
                        if (idx > -1) {
                            mergedClients[idx] = { ...mergedClients[idx], ...incClean };
                        } else {
                            mergedClients.push(incClean);
                        }
                    }
                    LocalCRMStorage.saveClients(mergedClients);
                }

                if (payload.archive && Array.isArray(payload.archive)) {
                    const currentArchive = LocalCRMStorage.getArchive();
                    const mergedArchive = [...currentArchive];
                    for (const inc of payload.archive) {
                        const incId = inc.id || `arc_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
                        const incClean = { ...inc, id: incId, is_archived: true };
                        const idx = mergedArchive.findIndex(c => 
                            (c.id && incClean.id && c.id === incClean.id) ||
                            (c['Договор'] && incClean['Договор'] && String(c['Договор']).trim() === String(incClean['Договор']).trim())
                        );
                        if (idx > -1) {
                            mergedArchive[idx] = { ...mergedArchive[idx], ...incClean };
                        } else {
                            mergedArchive.push(incClean);
                        }
                    }
                    LocalCRMStorage.saveArchive(mergedArchive);
                }
            }
            if (payload.masters) LocalCRMStorage.saveMasters(payload.masters);
            if (payload.templates) LocalCRMStorage.saveTemplates(payload.templates);
            return { status: 'success', count: (payload.clients?.length || 0) + (payload.archive?.length || 0) };
        }

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

// ============================================================================
// ICRMProvider Interface
// ============================================================================

export interface ICRMProvider {
    readonly name: string;
    isAvailable(): Promise<boolean>;
    getClients(): Promise<{ headers: string[]; clients: Client[]; archive: Client[] }>;
    addClient(clientData: Partial<Client>): Promise<Client>;
    updateClient(updatedClient: Partial<Client>): Promise<Client>;
    deleteClient(clientId: string): Promise<void>;
    archiveClient(clientId: string): Promise<void>;
    recordPayment(clientId: string, amount: number, paymentMethod: string, comment?: string): Promise<{ newDebt?: number; message: string; client?: Client }>;
    reorderClient(oldClientId: string, newClientData: Partial<Client>): Promise<Client>;
    seasonalSwap(oldClientId: string, newClientData: Partial<Client>, swapMeta?: {
        archiveAction?: string;
        archiveDetails?: string;
        newAction?: string;
        newDetails?: string;
    }): Promise<Client>;
    bulkDeleteClients(clientIds: string[]): Promise<void>;
    fetchArchivedOrders(clientId: string): Promise<Client[]>;
    fetchMasters(): Promise<Master[]>;
    addMaster(master: Omit<Master, 'id'>): Promise<Master>;
    updateMaster(master: Master): Promise<Master>;
    deleteMaster(masterId: string): Promise<void>;
    fetchTemplates(): Promise<MessageTemplate[]>;
    addTemplate(template: MessageTemplate): Promise<MessageTemplate>;
    updateTemplate(template: MessageTemplate): Promise<MessageTemplate>;
    deleteTemplate(templateName: string): Promise<void>;
    saveTemplates(templates: MessageTemplate[]): Promise<MessageTemplate[]>;
    fetchHistory(clientId: string): Promise<ClientEvent[]>;
    fetchLogs(): Promise<AppLog[]>;
    sendMessage(chatId: string | number, message: string): Promise<{ success: boolean; message: string }>;
    bulkSendMessage(clientIds: string[], templateName: string): Promise<void>;
    uploadFile(file: File, client: Partial<Client>): Promise<{ fileUrl: string }>;
    fetchPhotos(contractNumber?: string, clientId?: string): Promise<string[]>;
    testConnection(): Promise<any>;
    clearDatabase(): Promise<void>;
    importData(clients: Partial<Client>[], archive: Partial<Client>[], masters?: Master[], templates?: MessageTemplate[], mode?: 'merge' | 'replace'): Promise<{ count: number; status: string }>;
}

// ============================================================================
// Postgres Client Provider (PostgresCRMProvider)
// Реализует взаимодействие с PostgreSQL базой данных через API (/api/crm)
// с автоматическим fallback на локальное хранилище при отсутствии соединения
// ============================================================================

export class PostgresCRMProvider implements ICRMProvider {
    readonly name = 'PostgreSQL';
    private endpoint: string = '/api/crm';
    private timeoutMs: number = 8000;

    /**
     * Выполняет типовой запрос к PostgreSQL серверу через /api/crm
     * с поддержкой фоновой очереди синхронизации (Offline Outbox)
     */
    async executeQuery<T = any>(action: string, payload: any = {}): Promise<T> {
        const userJson = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null;
        const user = userJson ? JSON.parse(userJson) : { username: 'Admin' };
        const settings = getSettingsFromStorage();

        const finalPayload = {
            action,
            ...payload,
            user: user.username,
            googleSheetId: settings.googleSheetId
        };

        const isMutation = ['add', 'edit', 'record_payment', 'archive', 'reorder', 'seasonal_swap', 'delete', 'bulk_delete'].includes(action);

        const handleOfflineFallback = async (reason: string) => {
            console.info(`[PostgresProvider] ${reason}. Применение изменений локально.`);
            const localResult = executeLocalAction(action, finalPayload, user.username) as T;
            if (isMutation) {
                try {
                    await offlineStorage.enqueueAction(action, payload);
                    syncManager.notifyQueueChanged();
                } catch (e) {
                    console.warn('[PostgresProvider] Не удалось добавить в очередь синхронизации:', e);
                }
            }
            return localResult;
        };

        // Если устройство явно отключено от интернета, сразу применяем локально без ожидания таймаута
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return handleOfflineFallback('Устройство в режиме офлайн (нет интернет-соединения)');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            let response: Response;
            try {
                response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalPayload),
                    signal: controller.signal
                });
            } catch (networkErr: any) {
                return handleOfflineFallback(`Сервер недоступен (${networkErr?.message})`);
            } finally {
                clearTimeout(timeoutId);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                return handleOfflineFallback('Не-JSON ответ от сервера');
            }

            if (!response.ok) {
                const errorText = await response.text();
                return handleOfflineFallback(`Код ответа ${response.status}: ${errorText.substring(0, 60)}`);
            }

            const result = await response.json();
            if (result.status === 'error') {
                if (result.code === 'NO_DATABASE_URL' || (result.message && (result.message.includes('POSTGRES_URL') || result.message.includes('Configuration Error')))) {
                    // База данных пока не настроена — штатный локальный режим без накопления ошибок
                    return executeLocalAction(action, finalPayload, user.username) as T;
                }
                throw new Error(result.message || 'Ошибка PostgreSQL');
            }

            return result as T;
        } catch (e: any) {
            return handleOfflineFallback(`Ошибка: ${e?.message}`);
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const res = await this.testConnection();
            return res?.status === 'success';
        } catch {
            return false;
        }
    }

    async getClients(): Promise<{ headers: string[]; clients: Client[]; archive: Client[] }> {
        const headers = getClientHeaders();
        const result = await this.executeQuery('getclients');

        const processClients = async (data: any[]): Promise<Client[]> => {
            const list: Client[] = (data || []).map((c: any) => ({
                ...c,
                'Общая сумма': parseCurrency(c['Общая сумма']),
                'Долг': parseCurrency(c['Долг']),
                'Цена за месяц': parseCurrency(c['Цена за месяц']),
                'Срок': parseDuration(c['Срок']),
                'Кол-во шин': parseDuration(c['Кол-во шин']),
                photoUrls: typeof c.photoUrls === 'string' && c.photoUrls.length > 0 ? c.photoUrls.split(',') : (Array.isArray(c.photoUrls) ? c.photoUrls : [])
            }));
            
            // Объединяем с IndexedDB фото
            for (const client of list) {
                const localPhotos = await photoStorage.getPhotosForClient(client['Договор'], client.id);
                if (localPhotos.length > 0) {
                    client.photoUrls = Array.from(new Set([...(client.photoUrls || []), ...localPhotos]));
                }
            }
            return list;
        };

        const clients = await processClients(result.clients);
        const archive = await processClients(result.archive);

        // Кэшируем актуальные данные клиентов в IndexedDB для быстрого офлайн-доступа
        offlineStorage.cacheClients(clients).catch(() => {});
        offlineStorage.cacheArchive(archive).catch(() => {});

        return { headers: result.headers || headers, clients, archive };
    }

    async addClient(clientData: Partial<Client>): Promise<Client> {
        const payloadClient = {
            ...clientData,
            photoUrls: (clientData.photoUrls || []).join(','),
        };
        const result = await this.executeQuery('add', { client: payloadClient });
        return {
            ...clientData,
            id: result?.newId || clientData.id,
        } as Client;
    }

    async updateClient(updatedClient: Partial<Client>): Promise<Client> {
        const clientToSend = {
            ...updatedClient,
            photoUrls: Array.isArray(updatedClient.photoUrls) ? updatedClient.photoUrls.join(',') : updatedClient.photoUrls,
        };

        if (Array.isArray(updatedClient.photoUrls) && updatedClient.photoUrls.length > 0) {
            const photosToStore = updatedClient.photoUrls.map(url => ({
                id: url,
                clientId: updatedClient.id,
                contractNumber: updatedClient['Договор'],
                dataUrl: url
            }));
            photoStorage.saveBatch(photosToStore);
        }

        await this.executeQuery('update', { client: clientToSend });
        return updatedClient as Client;
    }

    async deleteClient(clientId: string): Promise<void> {
        await this.executeQuery('delete', { clientId });
    }

    async archiveClient(clientId: string): Promise<void> {
        await this.executeQuery('archive', { clientId });
    }

    async recordPayment(clientId: string, amount: number, paymentMethod: string, comment?: string): Promise<{ newDebt?: number; message: string; client?: Client }> {
        return await this.executeQuery('payment', {
            clientId,
            amount,
            paymentMethod,
            comment: comment || ''
        });
    }

    async reorderClient(oldClientId: string, newClientData: Partial<Client>): Promise<Client> {
        const clientForDb = {
            ...newClientData,
            photoUrls: (newClientData.photoUrls || []).join(','),
        };
        const result = await this.executeQuery('reorder', {
            oldClientId,
            client: clientForDb
        });
        return {
            ...newClientData,
            id: result?.newId || newClientData.id,
        } as Client;
    }

    async seasonalSwap(oldClientId: string, newClientData: Partial<Client>, swapMeta?: {
        archiveAction?: string;
        archiveDetails?: string;
        newAction?: string;
        newDetails?: string;
    }): Promise<Client> {
        const clientForDb = {
            ...newClientData,
            photoUrls: Array.isArray(newClientData.photoUrls) ? newClientData.photoUrls.join(',') : (newClientData.photoUrls || ''),
        };
        const result = await this.executeQuery('reorder', {
            oldClientId,
            client: clientForDb,
            archiveAction: swapMeta?.archiveAction,
            archiveDetails: swapMeta?.archiveDetails,
            newAction: swapMeta?.newAction,
            newDetails: swapMeta?.newDetails
        });
        return {
            ...newClientData,
            id: result?.newId || newClientData.id || oldClientId,
        } as Client;
    }

    async bulkDeleteClients(clientIds: string[]): Promise<void> {
        await this.executeQuery('bulkdelete', { clientIds });
    }

    async fetchArchivedOrders(clientId: string): Promise<Client[]> {
        const result = await this.executeQuery('getarchived', { clientId });
        return (result?.orders || []).map((c: any) => ({
            ...c,
            photoUrls: typeof c.photoUrls === 'string' && c.photoUrls.length > 0 ? c.photoUrls.split(',') : (Array.isArray(c.photoUrls) ? c.photoUrls : [])
        }));
    }

    async fetchMasters(): Promise<Master[]> {
        const result = await this.executeQuery('getmasters');
        return result?.masters || [];
    }

    async addMaster(master: Omit<Master, 'id'>): Promise<Master> {
        const newMaster: Master = { ...master, id: `master_${Date.now()}` } as Master;
        await this.executeQuery('addmaster', { master: newMaster });
        return newMaster;
    }

    async updateMaster(master: Master): Promise<Master> {
        await this.executeQuery('updatemaster', { master });
        return master;
    }

    async deleteMaster(masterId: string): Promise<void> {
        await this.executeQuery('deletemaster', { masterId });
    }

    async fetchTemplates(): Promise<MessageTemplate[]> {
        const result = await this.executeQuery('gettemplates');
        return result?.templates || [];
    }

    async addTemplate(template: MessageTemplate): Promise<MessageTemplate> {
        await this.executeQuery('addtemplate', { template });
        return template;
    }

    async updateTemplate(template: MessageTemplate): Promise<MessageTemplate> {
        await this.executeQuery('updatetemplate', { template });
        return template;
    }

    async deleteTemplate(templateName: string): Promise<void> {
        await this.executeQuery('deletemplate', { templateName });
    }

    async saveTemplates(templates: MessageTemplate[]): Promise<MessageTemplate[]> {
        await this.executeQuery('savetemplates', { templates });
        return templates;
    }

    async fetchHistory(clientId: string): Promise<ClientEvent[]> {
        const result = await this.executeQuery('gethistory', { clientId });
        return result?.history || [];
    }

    async fetchLogs(): Promise<AppLog[]> {
        const result = await this.executeQuery('getlogs');
        return result?.logs || [];
    }

    async sendMessage(chatId: string | number, message: string): Promise<{ success: boolean; message: string }> {
        if (!chatId) {
            return { success: false, message: 'Ошибка: Chat ID не указан.' };
        }
        try {
            const result = await this.executeQuery('sendMessage', { chatId, message });
            return { success: true, message: result?.message || 'Сообщение успешно отправлено.' };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async bulkSendMessage(clientIds: string[], templateName: string): Promise<void> {
        await this.executeQuery('bulksend', { clientIds, templateName });
    }

    async uploadFile(file: File, client: Partial<Client>): Promise<{ fileUrl: string }> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                if (e.target?.result) {
                    const dataUrl = e.target.result as string;
                    const fileData = dataUrl.split(',')[1];
                    try {
                        const result = await this.executeQuery('uploadfile', {
                            client: {
                                id: client.id,
                                'Имя клиента': client['Имя клиента'],
                                'Договор': client['Договор']
                            },
                            filename: file.name,
                            mimeType: file.type,
                            fileData: fileData,
                        });
                        const finalUrl = result?.fileUrl || dataUrl;

                        await photoStorage.savePhoto({
                            id: finalUrl,
                            clientId: client.id,
                            contractNumber: client['Договор'],
                            dataUrl: finalUrl
                        });

                        resolve({ fileUrl: finalUrl });
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new Error('Не удалось прочитать файл'));
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }

    async fetchPhotos(contractNumber?: string, clientId?: string): Promise<string[]> {
        let serverUrls: string[] = [];
        if (contractNumber || clientId) {
            try {
                const result = await this.executeQuery('getphotos', { contractNumber, clientId });
                if (result?.photoUrls && Array.isArray(result.photoUrls)) {
                    serverUrls = result.photoUrls;
                }
            } catch (e) {}
        }
        const localUrls = await photoStorage.getPhotosForClient(contractNumber, clientId);
        return Array.from(new Set([...serverUrls, ...localUrls]));
    }

    async testConnection(): Promise<any> {
        return await this.executeQuery('testconnection');
    }

    async clearDatabase(): Promise<void> {
        await this.executeQuery('reset_db');
    }

    async importData(
        clients: Partial<Client>[], 
        archive: Partial<Client>[], 
        masters?: Master[], 
        templates?: MessageTemplate[], 
        mode: 'merge' | 'replace' = 'merge'
    ): Promise<{ count: number; status: string }> {
        return await this.executeQuery('import', { clients, archive, masters, templates, mode });
    }
}

// Экспортируем глобальный экземпляр провайдера PostgreSQL
export const postgresProvider = new PostgresCRMProvider();

// ============================================================================
// Unified Request API & Public Export
// ============================================================================

export async function requestAPI(action: string, payload: any = {}, _customUrl?: string, _forceMode?: 'GAS' | 'VERCEL') {
    return postgresProvider.executeQuery(action, payload);
}

export const api = {
    // Прямой доступ к провайдеру Postgres
    postgres: postgresProvider,
    provider: postgresProvider,

    fetchClients: () => postgresProvider.getClients(),
    updateClient: (updatedClient: Partial<Client>) => postgresProvider.updateClient(updatedClient),
    addClient: (newClientData: Partial<Client>) => postgresProvider.addClient(newClientData),
    reorderClient: (oldClientId: string, newClientData: Partial<Client>) => postgresProvider.reorderClient(oldClientId, newClientData),
    seasonalSwap: (oldClientId: string, newClientData: Partial<Client>, swapMeta?: {
        archiveAction?: string;
        archiveDetails?: string;
        newAction?: string;
        newDetails?: string;
    }) => postgresProvider.seasonalSwap(oldClientId, newClientData, swapMeta),
    deleteClient: (clientId: string) => postgresProvider.deleteClient(clientId),
    archiveClient: (clientId: string) => postgresProvider.archiveClient(clientId),
    recordPayment: (clientId: string, amount: number, paymentMethod: string, comment?: string) => 
        postgresProvider.recordPayment(clientId, amount, paymentMethod, comment),
    bulkDeleteClients: (clientIds: string[]) => postgresProvider.bulkDeleteClients(clientIds),
    fetchArchivedOrders: (clientId: string) => postgresProvider.fetchArchivedOrders(clientId),

    fetchSettings: async (): Promise<Settings> => {
        await delay(30);
        return getSettingsFromStorage();
    },
    saveSettings: async (settings: Settings): Promise<Settings> => {
        await delay(100);
        localStorage.setItem('crm_settings', JSON.stringify(settings));
        return settings;
    },

    fetchTemplates: () => postgresProvider.fetchTemplates(),
    updateTemplate: (template: MessageTemplate) => postgresProvider.updateTemplate(template),
    addTemplate: (template: MessageTemplate) => postgresProvider.addTemplate(template),
    deleteTemplate: (templateName: string) => postgresProvider.deleteTemplate(templateName),
    saveTemplates: (templates: MessageTemplate[]) => postgresProvider.saveTemplates(templates),

    sendMessage: (chatId: string | number, message: string) => postgresProvider.sendMessage(chatId, message),
    bulkSendMessage: (clientIds: string[], templateName: string) => postgresProvider.bulkSendMessage(clientIds, templateName),
    uploadFile: (file: File, client: Partial<Client>) => postgresProvider.uploadFile(file, client),
    fetchPhotosForContract: (contractNumber?: string, clientId?: string) => postgresProvider.fetchPhotos(contractNumber, clientId),
    fetchClientHistory: (clientId: string) => postgresProvider.fetchHistory(clientId),
    fetchLogs: () => postgresProvider.fetchLogs(),

    fetchMasters: () => postgresProvider.fetchMasters(),
    addMaster: (master: Omit<Master, 'id'>) => postgresProvider.addMaster(master),
    updateMaster: (master: Master) => postgresProvider.updateMaster(master),
    deleteMaster: (masterId: string) => postgresProvider.deleteMaster(masterId),

    testConnection: async (_url?: string): Promise<any> => {
        return await postgresProvider.testConnection();
    },

    fetchDataForMigration: async (): Promise<{ clients: any[], archive: any[], masters: any[], templates: any[] }> => {
        const [clientsData, mastersData, templatesData] = await Promise.all([
            postgresProvider.getClients(),
            postgresProvider.fetchMasters(),
            postgresProvider.fetchTemplates()
        ]);
        return {
            clients: clientsData?.clients || [],
            archive: clientsData?.archive || [],
            masters: mastersData || [],
            templates: templatesData || []
        };
    },

    importDataToVercel: async (clients: any[], archive: any[], masters?: any[], templates?: any[]): Promise<any> => {
        return await postgresProvider.importData(clients, archive, masters, templates);
    },

    importClientsBatch: async (clients: Partial<Client>[], archive: Partial<Client>[], mode: 'merge' | 'replace' = 'merge'): Promise<{ count: number; status: string }> => {
        return await postgresProvider.importData(clients, archive, undefined, undefined, mode);
    },

    fetchGoogleSheetCsv: async (urlOrId: string): Promise<{ success: boolean; csv?: string; error?: string; code?: string }> => {
        const parsed = extractGoogleSheetExportUrl(urlOrId);
        if (!parsed) {
            return { 
                success: false, 
                error: 'Некорректная ссылка на Google Таблицу. Пример правильной ссылки: https://docs.google.com/spreadsheets/d/1BxiMVs0X.../edit#gid=0' 
            };
        }

        try {
            const res = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'fetch_google_sheet_csv',
                    url: parsed.exportUrl
                })
            });

            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
                const data = await res.json();
                if (data.status === 'success' && typeof data.csv === 'string' && data.csv.trim().length > 0) {
                    if (!data.csv.includes('<html') && !data.csv.includes('<!DOCTYPE') && !data.csv.includes('404 NOT_FOUND')) {
                        return { success: true, csv: data.csv };
                    }
                }
                if (data.status === 'error') {
                    return { success: false, error: data.message, code: data.code };
                }
            }
        } catch (e: any) {
            console.warn("Server proxy failed, trying direct browser fetch fallback:", e);
        }

        try {
            const directResp = await fetch(parsed.exportUrl);
            if (directResp.ok) {
                const text = await directResp.text();
                if (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('404 NOT_FOUND') || text.includes('accounts.google.com')) {
                    return {
                        success: false,
                        code: 'PRIVATE_SHEET',
                        error: 'Таблица закрыта настройками приватности Google. Откройте доступ по ссылке: в таблице нажмите «Поделиться» ➔ «Все, у кого есть ссылка: Читатель».'
                    };
                }
                return { success: true, csv: text };
            } else if (directResp.status === 404) {
                return {
                    success: false,
                    error: 'Таблица Google не найдена по указанной ссылке (ошибка 404).'
                };
            }
        } catch (directErr: any) {
            // Browser CORS blocked
        }

        return { 
            success: false, 
            error: 'Не удалось загрузить данные по ссылке.' 
        };
    },

    clearDatabase: async (): Promise<void> => {
        return await postgresProvider.clearDatabase();
    },

    getDbSettings: async (): Promise<any> => {
        const result = await postgresProvider.executeQuery('get_settings');
        return result?.settings || {};
    },

    updateDbSetting: async (key: string, value: any): Promise<void> => {
        await postgresProvider.executeQuery('update_setting', { key, value });
    }
};

// ============================================================================
// CSV Parsing & Utility Functions
// ============================================================================

export function extractGoogleSheetExportUrl(rawUrl: string): { exportUrl: string; sheetId?: string; gid?: string } | null {
    const clean = (rawUrl || '').trim();
    if (!clean) return null;

    if (clean.includes('export?format=csv') || clean.includes('/pub?output=csv')) {
        const gidMatch = clean.match(/[?&#]gid=([0-9]+)/);
        return { exportUrl: clean, gid: gidMatch ? gidMatch[1] : undefined };
    }

    const pubMatch = clean.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
    if (pubMatch) {
        const pubId = pubMatch[1];
        const gidMatch = clean.match(/[?&#]gid=([0-9]+)/);
        const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
        return {
            exportUrl: `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv${gidParam}`,
            gid: gidMatch ? gidMatch[1] : undefined
        };
    }

    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
        const sheetId = match[1];
        const gidMatch = clean.match(/[?&#]gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : undefined;
        const gidParam = gid ? `&gid=${gid}` : '';
        return {
            exportUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`,
            sheetId,
            gid
        };
    }

    if (/^[a-zA-Z0-9-_]{20,}$/.test(clean)) {
        return {
            exportUrl: `https://docs.google.com/spreadsheets/d/${clean}/export?format=csv`,
            sheetId: clean
        };
    }

    return null;
}
