/**
 * Network Sync Manager for TireCRM.
 * Handles online/offline detection, background sync queue processing,
 * and automatic retries for pending Postgres mutations.
 */
import { offlineStorage, SyncAction } from './offlineStorage';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  lastError: string | null;
  failedActions: SyncAction[];
}

type SyncListener = (status: SyncStatus) => void;

class SyncManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private retryTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());

      // Periodic queue check every 25 seconds
      setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.checkAndProcessQueue();
        }
      }, 25000);

      // Initial check on boot
      setTimeout(() => this.checkAndProcessQueue(), 2000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.getStatus().then(status => listener(status));
    return () => this.listeners.delete(listener);
  }

  private async notifyListeners() {
    const status = await this.getStatus();
    this.listeners.forEach(fn => fn(status));
  }

  public async getStatus(): Promise<SyncStatus> {
    const pending = await offlineStorage.getPendingActions();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: pending.length,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      failedActions: pending.filter(a => a.status === 'failed' || a.retryCount > 0),
    };
  }

  private handleOnline() {
    this.isOnline = true;
    this.lastError = null;
    this.notifyListeners();
    // Immediate sync when connection returns
    this.checkAndProcessQueue();
  }

  private handleOffline() {
    this.isOnline = false;
    this.notifyListeners();
  }

  public async notifyQueueChanged() {
    await this.notifyListeners();
    if (this.isOnline && !this.isSyncing) {
      this.checkAndProcessQueue();
    }
  }

  /**
   * Process all queued actions against Postgres API
   */
  public async checkAndProcessQueue(): Promise<{ success: boolean; syncedCount: number; remainingCount: number }> {
    if (this.isSyncing) return { success: false, syncedCount: 0, remainingCount: 0 };

    const queue = await offlineStorage.getPendingActions();
    if (queue.length === 0) {
      return { success: true, syncedCount: 0, remainingCount: 0 };
    }

    this.isSyncing = true;
    await this.notifyListeners();

    let syncedCount = 0;
    const userJson = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null;
    const user = userJson ? JSON.parse(userJson) : { username: 'Admin' };

    try {
      for (const item of queue) {
        try {
          const payload = {
            action: item.action,
            ...item.payload,
            user: user.username,
            _syncQueueId: item.id,
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch('/api/crm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 80)}`);
          }

          const result = await response.json();
          if (result.status === 'error' && result.code !== 'NO_DATABASE_URL') {
            throw new Error(result.message || 'Server error');
          }

          // Successfully processed
          await offlineStorage.removeAction(item.id);
          syncedCount++;
          this.lastSyncTime = Date.now();
          this.lastError = null;
        } catch (itemErr: any) {
          console.warn(`[SyncManager] Action ${item.action} failed:`, itemErr?.message);
          await offlineStorage.markActionFailed(item.id, itemErr?.message || 'Sync failed');
          this.lastError = itemErr?.message || 'Ошибка синхронизации';
          
          // Stop sequential processing if network failed to prevent out-of-order execution
          break;
        }
      }
    } finally {
      this.isSyncing = false;
      const remaining = await offlineStorage.getPendingActions();
      await this.notifyListeners();
      return { success: true, syncedCount, remainingCount: remaining.length };
    }
  }

  /**
   * Manual retry trigger
   */
  public async retrySync(): Promise<{ success: boolean; syncedCount: number; remainingCount: number }> {
    return this.checkAndProcessQueue();
  }
}

export const syncManager = new SyncManager();
