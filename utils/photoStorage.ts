/**
 * IndexedDB storage for client and order photos.
 * Ensures persistent storage across page reloads and browser sessions without hitting
 * the 5MB browser localStorage limit (QuotaExceededError).
 */
const DB_NAME = 'TireCRM_Photos_DB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

export interface StoredPhoto {
  id: string; // unique URL or hash
  clientId?: string;
  contractNumber?: string;
  dataUrl: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('clientId', 'clientId', { unique: false });
        store.createIndex('contractNumber', 'contractNumber', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const photoStorage = {
  async savePhoto(photo: { id: string; clientId?: string; contractNumber?: string; dataUrl: string }): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ ...photo, createdAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('Failed to save photo to IndexedDB:', e);
    }
  },

  async saveBatch(photos: Array<{ id: string; clientId?: string; contractNumber?: string; dataUrl: string }>): Promise<void> {
    if (!photos || photos.length === 0) return;
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        photos.forEach(p => {
          store.put({ ...p, createdAt: Date.now() });
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('Failed to save batch photos to IndexedDB:', e);
    }
  },

  async getPhotosForClient(contractNumber?: string, clientId?: string): Promise<string[]> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const results: string[] = [];
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const val = cursor.value as StoredPhoto;
            const matchClient = clientId && val.clientId && String(val.clientId) === String(clientId);
            const matchContract = contractNumber && val.contractNumber && String(val.contractNumber).trim() === String(contractNumber).trim();
            if (matchClient || matchContract) {
              if (val.dataUrl) results.push(val.dataUrl);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  },

  async deletePhoto(photoId: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(photoId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      // ignore
    }
  }
};
