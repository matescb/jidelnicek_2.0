import type { StorageAdapter, StorageQuota, StorageMetrics } from './types';

// Base storage adapter with quota management
abstract class BaseStorageAdapter implements StorageAdapter {
  protected quota?: StorageQuota;
  protected metrics: Map<string, StorageMetrics> = new Map();

  constructor(quota?: StorageQuota) {
    this.quota = quota;
  }

  protected checkQuota(key: string, value: string): void {
    if (!this.quota?.maxSize) return;

    const size = new Blob([value]).size;
    const totalSize = Array.from(this.metrics.values()).reduce((acc, m) => acc + m.size, 0) + size;

    if (totalSize > this.quota.maxSize) {
      this.quota.onQuotaExceeded?.(totalSize, this.quota.maxSize);
      throw new Error(`Storage quota exceeded: ${totalSize} > ${this.quota.maxSize}`);
    }

    if (this.quota.warningThreshold && totalSize > this.quota.warningThreshold) {
      console.warn(`Storage usage warning: ${totalSize} bytes (${Math.round(totalSize / this.quota.maxSize * 100)}%)`);
    }
  }

  protected updateMetrics(key: string, value: string, compressed = false, encrypted = false): void {
    this.metrics.set(key, {
      size: new Blob([value]).size,
      compressed,
      encrypted,
      lastWrite: Date.now(),
      writeCount: (this.metrics.get(key)?.writeCount ?? 0) + 1,
    });
  }

  abstract getItem(name: string): string | null | Promise<string | null>;
  abstract setItem(name: string, value: string): void | Promise<void>;
  abstract removeItem(name: string): void | Promise<void>;
}

// LocalStorage adapter with size limit handling
export class LocalStorageAdapter extends BaseStorageAdapter {
  private readonly prefix: string;

  constructor(prefix = 'zustand', quota?: StorageQuota) {
    super(quota);
    this.prefix = prefix;
  }

  getItem(name: string): string | null {
    try {
      return localStorage.getItem(`${this.prefix}:${name}`);
    } catch (error) {
      console.error('LocalStorage getItem error:', error);
      return null;
    }
  }

  setItem(name: string, value: string): void {
    const key = `${this.prefix}:${name}`;
    try {
      this.checkQuota(key, value);
      localStorage.setItem(key, value);
      this.updateMetrics(key, value);
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        // QuotaExceededError
        console.error('LocalStorage quota exceeded');
        this.handleQuotaExceeded();
      }
      throw error;
    }
  }

  removeItem(name: string): void {
    const key = `${this.prefix}:${name}`;
    localStorage.removeItem(key);
    this.metrics.delete(key);
  }

  clear(): void {
    const keys = this.getAllKeys();
    keys.forEach(key => this.removeItem(key.replace(`${this.prefix}:`, '')));
  }

  getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${this.prefix}:`)) {
        keys.push(key);
      }
    }
    return keys;
  }

  private handleQuotaExceeded(): void {
    // Implement LRU cache eviction
    const entries = Array.from(this.metrics.entries())
      .sort(([, a], [, b]) => a.lastWrite - b.lastWrite);
    
    // Remove oldest entries until we have space
    for (const [key] of entries) {
      this.removeItem(key.replace(`${this.prefix}:`, ''));
      if (this.hasSpace()) break;
    }
  }

  private hasSpace(): boolean {
    try {
      const testKey = `${this.prefix}:__test__`;
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}

// SessionStorage adapter
export class SessionStorageAdapter extends BaseStorageAdapter {
  private readonly prefix: string;

  constructor(prefix = 'zustand', quota?: StorageQuota) {
    super(quota);
    this.prefix = prefix;
  }

  getItem(name: string): string | null {
    try {
      return sessionStorage.getItem(`${this.prefix}:${name}`);
    } catch (error) {
      console.error('SessionStorage getItem error:', error);
      return null;
    }
  }

  setItem(name: string, value: string): void {
    const key = `${this.prefix}:${name}`;
    try {
      this.checkQuota(key, value);
      sessionStorage.setItem(key, value);
      this.updateMetrics(key, value);
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        console.error('SessionStorage quota exceeded');
      }
      throw error;
    }
  }

  removeItem(name: string): void {
    const key = `${this.prefix}:${name}`;
    sessionStorage.removeItem(key);
    this.metrics.delete(key);
  }

  clear(): void {
    const keys = this.getAllKeys();
    keys.forEach(key => this.removeItem(key.replace(`${this.prefix}:`, '')));
  }

  getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(`${this.prefix}:`)) {
        keys.push(key);
      }
    }
    return keys;
  }
}

// IndexedDB adapter for large data
export class IndexedDBAdapter extends BaseStorageAdapter {
  private readonly dbName: string;
  private readonly storeName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName = 'zustand-persist', storeName = 'states', quota?: StorageQuota) {
    super(quota);
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
      });
    }
    return this.dbPromise;
  }

  async getItem(name: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(name);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB getItem error:', error);
      return null;
    }
  }

  async setItem(name: string, value: string): Promise<void> {
    try {
      this.checkQuota(name, value);
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.put({ id: name, value });
        request.onsuccess = () => {
          this.updateMetrics(name, value);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB setItem error:', error);
      throw error;
    }
  }

  async removeItem(name: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.delete(name);
        request.onsuccess = () => {
          this.metrics.delete(name);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB removeItem error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          this.metrics.clear();
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB clear error:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB getAllKeys error:', error);
      return [];
    }
  }
}

// Memory adapter for testing
export class MemoryAdapter extends BaseStorageAdapter {
  private storage: Map<string, string> = new Map();

  getItem(name: string): string | null {
    return this.storage.get(name) ?? null;
  }

  setItem(name: string, value: string): void {
    this.checkQuota(name, value);
    this.storage.set(name, value);
    this.updateMetrics(name, value);
  }

  removeItem(name: string): void {
    this.storage.delete(name);
    this.metrics.delete(name);
  }

  clear(): void {
    this.storage.clear();
    this.metrics.clear();
  }

  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }

  // Testing utility methods
  getStorage(): Map<string, string> {
    return new Map(this.storage);
  }

  getMetrics(): Map<string, StorageMetrics> {
    return new Map(this.metrics);
  }
}

// Factory function to create storage adapters
export function createStorageAdapter(
  type: 'localStorage' | 'sessionStorage' | 'indexedDB' | 'memory',
  options?: {
    prefix?: string;
    dbName?: string;
    storeName?: string;
    quota?: StorageQuota;
  }
): StorageAdapter {
  switch (type) {
    case 'localStorage':
      return new LocalStorageAdapter(options?.prefix, options?.quota);
    case 'sessionStorage':
      return new SessionStorageAdapter(options?.prefix, options?.quota);
    case 'indexedDB':
      return new IndexedDBAdapter(options?.dbName, options?.storeName, options?.quota);
    case 'memory':
      return new MemoryAdapter(options?.quota);
    default:
      throw new Error(`Unknown storage adapter type: ${type}`);
  }
}