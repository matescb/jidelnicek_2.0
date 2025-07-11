import { networkMonitor, NetworkStatus } from '@/services/networkMonitor';
import { errorLogger, ErrorSeverity } from '@/services/errorLogger';

// Offline cache configuration
export interface OfflineCacheConfig {
  maxSize: number; // in bytes
  maxAge: number; // in milliseconds
  storageKey: string;
  enableCompression: boolean;
}

// Cached request
export interface CachedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: Date;
  expiresAt: Date;
  response?: any;
  priority: number;
}

// Sync conflict
export interface SyncConflict {
  id: string;
  localData: any;
  serverData: any;
  timestamp: Date;
  resolved: boolean;
  resolution?: 'local' | 'server' | 'merge';
  mergedData?: any;
}

// Conflict resolution strategy
export enum ConflictResolution {
  LOCAL_WINS = 'local_wins',
  SERVER_WINS = 'server_wins',
  NEWEST_WINS = 'newest_wins',
  MANUAL = 'manual',
  MERGE = 'merge'
}

// Sync status
export interface SyncStatus {
  inProgress: boolean;
  itemsToSync: number;
  itemsSynced: number;
  conflicts: SyncConflict[];
  lastSyncTime?: Date;
  errors: Error[];
}

type ConflictResolver = (conflict: SyncConflict) => Promise<any>;
type SyncProgressListener = (status: SyncStatus) => void;

class OfflineManager {
  private cache: Map<string, CachedRequest> = new Map();
  private syncQueue: Map<string, CachedRequest> = new Map();
  private conflicts: Map<string, SyncConflict> = new Map();
  private syncListeners: Set<SyncProgressListener> = new Set();
  private conflictResolvers: Map<string, ConflictResolver> = new Map();
  private isSyncing = false;
  private lastSyncTime?: Date;

  private config: OfflineCacheConfig = {
    maxSize: 50 * 1024 * 1024, // 50MB
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    storageKey: 'jidelnicek_offline_cache',
    enableCompression: true
  };

  constructor() {
    this.initialize();
  }

  /**
   * Configure offline manager
   */
  configure(config: Partial<OfflineCacheConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cache a request and response
   */
  async cacheRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    response: any,
    priority: number = 5
  ): Promise<string> {
    const id = this.generateCacheId(url, method, body);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.maxAge);

    const cachedRequest: CachedRequest = {
      id,
      url,
      method,
      headers,
      body,
      response,
      timestamp: now,
      expiresAt,
      priority
    };

    // Check cache size
    await this.ensureCacheSize();

    this.cache.set(id, cachedRequest);
    await this.persistCache();

    return id;
  }

  /**
   * Get cached response
   */
  getCachedResponse(url: string, method: string, body?: any): any | null {
    const id = this.generateCacheId(url, method, body);
    const cached = this.cache.get(id);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (new Date() > cached.expiresAt) {
      this.cache.delete(id);
      this.persistCache();
      return null;
    }

    return cached.response;
  }

  /**
   * Queue request for sync
   */
  queueForSync(request: Omit<CachedRequest, 'id' | 'timestamp' | 'expiresAt'>): string {
    const id = this.generateRequestId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.maxAge);

    const queuedRequest: CachedRequest = {
      ...request,
      id,
      timestamp: now,
      expiresAt
    };

    this.syncQueue.set(id, queuedRequest);
    this.persistSyncQueue();

    // Auto-sync if online
    if (networkMonitor.isOnline()) {
      this.sync();
    }

    return id;
  }

  /**
   * Remove from sync queue
   */
  removeFromSyncQueue(id: string): boolean {
    const removed = this.syncQueue.delete(id);
    if (removed) {
      this.persistSyncQueue();
    }
    return removed;
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      inProgress: this.isSyncing,
      itemsToSync: this.syncQueue.size,
      itemsSynced: 0,
      conflicts: Array.from(this.conflicts.values()),
      lastSyncTime: this.lastSyncTime,
      errors: []
    };
  }

  /**
   * Register conflict resolver
   */
  registerConflictResolver(pattern: string, resolver: ConflictResolver) {
    this.conflictResolvers.set(pattern, resolver);
  }

  /**
   * Add sync progress listener
   */
  addSyncListener(listener: SyncProgressListener) {
    this.syncListeners.add(listener);
  }

  /**
   * Remove sync progress listener
   */
  removeSyncListener(listener: SyncProgressListener) {
    this.syncListeners.delete(listener);
  }

  /**
   * Manually trigger sync
   */
  async sync(strategy: ConflictResolution = ConflictResolution.NEWEST_WINS): Promise<void> {
    if (this.isSyncing || !networkMonitor.isOnline()) {
      return;
    }

    this.isSyncing = true;
    const syncStatus: SyncStatus = {
      inProgress: true,
      itemsToSync: this.syncQueue.size,
      itemsSynced: 0,
      conflicts: [],
      lastSyncTime: this.lastSyncTime,
      errors: []
    };

    this.notifySyncListeners(syncStatus);

    const requests = Array.from(this.syncQueue.values())
      .sort((a, b) => b.priority - a.priority || a.timestamp.getTime() - b.timestamp.getTime());

    for (const request of requests) {
      try {
        const response = await this.executeSyncRequest(request);
        
        // Check for conflicts
        if (this.isConflictResponse(response)) {
          const conflict = await this.handleConflict(request, response, strategy);
          syncStatus.conflicts.push(conflict);
        } else {
          // Success - remove from queue
          this.syncQueue.delete(request.id);
          syncStatus.itemsSynced++;
        }
      } catch (error) {
        syncStatus.errors.push(error as Error);
        
        errorLogger.logError(
          error as Error,
          ErrorSeverity.MEDIUM,
          undefined,
          {
            action: 'offline_sync_failed',
            url: request.url,
            method: request.method
          }
        );

        // Stop syncing if offline
        if (networkMonitor.getStatus() === NetworkStatus.OFFLINE) {
          break;
        }
      }

      syncStatus.itemsToSync = this.syncQueue.size;
      this.notifySyncListeners(syncStatus);
    }

    this.lastSyncTime = new Date();
    this.isSyncing = false;
    syncStatus.inProgress = false;
    
    this.notifySyncListeners(syncStatus);
    this.persistSyncQueue();
  }

  /**
   * Resolve a conflict manually
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'server' | 'merge',
    mergedData?: any
  ): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    conflict.resolved = true;
    conflict.resolution = resolution;
    
    if (resolution === 'merge' && mergedData) {
      conflict.mergedData = mergedData;
    }

    // Apply resolution
    const request = this.syncQueue.get(conflict.id);
    if (request) {
      switch (resolution) {
        case 'local':
          // Retry with force flag
          await this.executeSyncRequest({ ...request, headers: { ...request.headers, 'X-Force-Update': 'true' } });
          break;
        case 'server':
          // Discard local changes
          this.syncQueue.delete(request.id);
          break;
        case 'merge':
          // Send merged data
          await this.executeSyncRequest({ ...request, body: mergedData });
          break;
      }
    }

    this.conflicts.delete(conflictId);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.persistCache();
  }

  /**
   * Clear sync queue
   */
  clearSyncQueue() {
    this.syncQueue.clear();
    this.persistSyncQueue();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    itemCount: number;
    totalSize: number;
    oldestItem?: Date;
    newestItem?: Date;
  } {
    const items = Array.from(this.cache.values());
    const totalSize = this.calculateCacheSize();

    const timestamps = items.map(item => item.timestamp.getTime());
    const oldestItem = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined;
    const newestItem = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;

    return {
      itemCount: items.length,
      totalSize,
      oldestItem,
      newestItem
    };
  }

  private initialize() {
    this.loadPersistedData();
    
    // Listen for network changes
    networkMonitor.addListener((event) => {
      if (event.currentStatus === NetworkStatus.ONLINE) {
        // Auto-sync when coming back online
        this.sync();
      }
    });
  }

  private generateCacheId(url: string, method: string, body?: any): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    return btoa(`${method}:${url}:${bodyStr}`).replace(/[^a-zA-Z0-9]/g, '');
  }

  private generateRequestId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureCacheSize() {
    const currentSize = this.calculateCacheSize();
    
    if (currentSize > this.config.maxSize) {
      // Remove oldest items until under limit
      const items = Array.from(this.cache.values())
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      let sizeToRemove = currentSize - this.config.maxSize;
      
      for (const item of items) {
        if (sizeToRemove <= 0) break;
        
        const itemSize = this.estimateItemSize(item);
        this.cache.delete(item.id);
        sizeToRemove -= itemSize;
      }
    }
  }

  private calculateCacheSize(): number {
    let totalSize = 0;
    
    this.cache.forEach(item => {
      totalSize += this.estimateItemSize(item);
    });
    
    return totalSize;
  }

  private estimateItemSize(item: CachedRequest): number {
    // Rough estimate of object size in bytes
    const str = JSON.stringify(item);
    return new Blob([str]).size;
  }

  private async executeSyncRequest(request: CachedRequest): Promise<any> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? JSON.stringify(request.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Sync request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private isConflictResponse(response: any): boolean {
    return response.status === 409 || response.conflict === true;
  }

  private async handleConflict(
    request: CachedRequest,
    response: any,
    strategy: ConflictResolution
  ): Promise<SyncConflict> {
    const conflict: SyncConflict = {
      id: request.id,
      localData: request.body,
      serverData: response.data || response,
      timestamp: new Date(),
      resolved: false
    };

    // Try to find a resolver
    const resolver = this.findConflictResolver(request.url);
    if (resolver) {
      try {
        const resolved = await resolver(conflict);
        conflict.resolved = true;
        conflict.resolution = 'merge';
        conflict.mergedData = resolved;
        
        // Retry with resolved data
        await this.executeSyncRequest({ ...request, body: resolved });
        this.syncQueue.delete(request.id);
        
        return conflict;
      } catch (error) {
        console.error('Conflict resolver failed:', error);
      }
    }

    // Apply automatic strategy
    switch (strategy) {
      case ConflictResolution.LOCAL_WINS:
        await this.resolveConflict(conflict.id, 'local');
        break;
      case ConflictResolution.SERVER_WINS:
        await this.resolveConflict(conflict.id, 'server');
        break;
      case ConflictResolution.NEWEST_WINS:
        const localTime = request.timestamp.getTime();
        const serverTime = new Date(response.timestamp || 0).getTime();
        await this.resolveConflict(conflict.id, localTime > serverTime ? 'local' : 'server');
        break;
      case ConflictResolution.MANUAL:
        // Store for manual resolution
        this.conflicts.set(conflict.id, conflict);
        break;
    }

    return conflict;
  }

  private findConflictResolver(url: string): ConflictResolver | undefined {
    for (const [pattern, resolver] of this.conflictResolvers) {
      if (url.includes(pattern)) {
        return resolver;
      }
    }
    return undefined;
  }

  private async persistCache() {
    try {
      const cacheData = Array.from(this.cache.values()).map(item => ({
        ...item,
        timestamp: item.timestamp.toISOString(),
        expiresAt: item.expiresAt.toISOString()
      }));
      
      const data = this.config.enableCompression 
        ? await this.compress(JSON.stringify(cacheData))
        : JSON.stringify(cacheData);
      
      localStorage.setItem(this.config.storageKey, data);
    } catch (error) {
      console.error('Failed to persist cache:', error);
    }
  }

  private async persistSyncQueue() {
    try {
      const queueData = Array.from(this.syncQueue.values()).map(item => ({
        ...item,
        timestamp: item.timestamp.toISOString(),
        expiresAt: item.expiresAt.toISOString()
      }));
      
      localStorage.setItem(`${this.config.storageKey}_sync`, JSON.stringify(queueData));
    } catch (error) {
      console.error('Failed to persist sync queue:', error);
    }
  }

  private async loadPersistedData() {
    // Load cache
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const data = this.config.enableCompression 
          ? await this.decompress(stored)
          : stored;
        
        const cacheData = JSON.parse(data);
        
        cacheData.forEach((item: any) => {
          this.cache.set(item.id, {
            ...item,
            timestamp: new Date(item.timestamp),
            expiresAt: new Date(item.expiresAt)
          });
        });
        
        // Clean expired items
        this.cleanExpiredItems();
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }

    // Load sync queue
    try {
      const stored = localStorage.getItem(`${this.config.storageKey}_sync`);
      if (stored) {
        const queueData = JSON.parse(stored);
        
        queueData.forEach((item: any) => {
          this.syncQueue.set(item.id, {
            ...item,
            timestamp: new Date(item.timestamp),
            expiresAt: new Date(item.expiresAt)
          });
        });
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private cleanExpiredItems() {
    const now = new Date();
    
    // Clean cache
    for (const [id, item] of this.cache) {
      if (now > item.expiresAt) {
        this.cache.delete(id);
      }
    }
    
    // Clean sync queue
    for (const [id, item] of this.syncQueue) {
      if (now > item.expiresAt) {
        this.syncQueue.delete(id);
      }
    }
  }

  private async compress(data: string): Promise<string> {
    // Simple compression using browser's CompressionStream API if available
    if ('CompressionStream' in window) {
      try {
        const stream = new Blob([data]).stream();
        const compressedStream = stream.pipeThrough(new (window as any).CompressionStream('gzip'));
        const compressedBlob = await new Response(compressedStream).blob();
        return await compressedBlob.text();
      } catch (error) {
        console.warn('Compression failed, using uncompressed data:', error);
      }
    }
    return data;
  }

  private async decompress(data: string): Promise<string> {
    // Simple decompression using browser's DecompressionStream API if available
    if ('DecompressionStream' in window) {
      try {
        const stream = new Blob([data]).stream();
        const decompressedStream = stream.pipeThrough(new (window as any).DecompressionStream('gzip'));
        const decompressedBlob = await new Response(decompressedStream).blob();
        return await decompressedBlob.text();
      } catch (error) {
        console.warn('Decompression failed, assuming uncompressed data:', error);
      }
    }
    return data;
  }

  private notifySyncListeners(status: SyncStatus) {
    this.syncListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();

// Export convenience functions
export const cacheRequest = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  response: any,
  priority?: number
) => offlineManager.cacheRequest(url, method, headers, body, response, priority);

export const getCachedResponse = (url: string, method: string, body?: any) =>
  offlineManager.getCachedResponse(url, method, body);

export const queueForSync = (request: Omit<CachedRequest, 'id' | 'timestamp' | 'expiresAt'>) =>
  offlineManager.queueForSync(request);

export const syncOfflineData = (strategy?: ConflictResolution) =>
  offlineManager.sync(strategy);