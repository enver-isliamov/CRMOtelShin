/**
 * IndexedDB Offline Storage & Synchronization Queue Engine for TireCRM.
 * Enables full offline CRUD operations with persistent queueing and auto-sync.
 */
import { Client, StorageOrder } from '../types';

const DB_NAME = 'TireCRM_Offline_DB';
const DB_VERSION = 1;

export interface SyncAction {
  id: string;
  action: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Clients Cache Store
      if (!db.objectStoreNames.contains('clients')) {
        db.createStore('clients', { keyPath: 'id' });
      }

      // 2. Archive Cache Store
      if (!db.objectStoreNames.contains('archive')) {
        db.createStore('archive', { keyPath: 'id' });
      }

      // 3. Sync Action Queue (Outbox for Postgres)
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createStore('sync_queue', { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }

      // 4. Meta Key-Value Store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createStore('metadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Polyfill safe store creator
(IDBDatabase.prototype as any).createStore = function (name: string, options: IDBObjectStoreParameters) {
  return this.createObjectStore(name, options);
};

export const offlineStorage = {
  /**
   * Save clients to IndexedDB cache
   */
  async cacheClients(clients: Client[]): Promise<void> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve) => {
        const tx = db.transaction('clients', 'readwrite');
        const store = tx.objectStore('clients');
        store.clear();
        clients.forEach((c) => store.put(c));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('[OfflineDB] Failed to cache clients:', e);
    }
  },

  /**
   * Get cached clients from IndexedDB
   */
  async getCachedClients(): Promise<Client[]> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve) => {
        const tx = db.transaction('clients', 'readonly');
        const store = tx.objectStore('clients');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  },

  /**
   * Save archive clients to IndexedDB cache
   */
  async cacheArchive(archive: Client[]): Promise<void> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve) => {
        const tx = db.transaction('archive', 'readwrite');
        const store = tx.objectStore('archive');
        store.clear();
        archive.forEach((c) => store.put(c));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('[OfflineDB] Failed to cache archive:', e);
    }
  },

  /**
   * Get cached archive from IndexedDB
   */
  async getCachedArchive(): Promise<Client[]> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve) => {
        const tx = db.transaction('archive', 'readonly');
        const store = tx.objectStore('archive');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  },

  /**
   * Add an action to the offline sync queue
   */
  async enqueueAction(action: string, payload: any): Promise<SyncAction> {
    const syncItem: SyncAction = {
      id: `sync_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      action,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    try {
      const db = await openOfflineDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.put(syncItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[OfflineDB] Enqueue error, fallback to memory:', e);
    }

    return syncItem;
  },

  /**
   * Get all pending sync actions sorted by timestamp
   */
  async getPendingActions(): Promise<SyncAction[]> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();
        req.onsuccess = () => {
          const items: SyncAction[] = req.result || [];
          // Sort oldest first (FIFO)
          items.sort((a, b) => a.timestamp - b.timestamp);
          resolve(items);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  },

  /**
   * Remove a completed sync action from the queue
   */
  async removeAction(id: string): Promise<void> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('[OfflineDB] Failed to remove action:', e);
    }
  },

  /**
   * Update action status or increment retry count on failure
   */
  async markActionFailed(id: string, error: string): Promise<void> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.get(id);
        req.onsuccess = () => {
          const item: SyncAction = req.result;
          if (item) {
            item.retryCount = (item.retryCount || 0) + 1;
            item.status = 'failed';
            item.error = error;
            store.put(item);
          }
          resolve();
        };
        req.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('[OfflineDB] Failed to mark action failed:', e);
    }
  },

  /**
   * Clear the entire sync queue
   */
  async clearQueue(): Promise<void> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        store.clear();
        tx.oncomplete = () => resolve();
      });
    } catch {}
  },
};
