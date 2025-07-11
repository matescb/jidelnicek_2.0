/**
 * Global state synchronization for Zustand stores
 * 
 * @example
 * ```typescript
 * import { create } from 'zustand'
 * import { syncMiddleware } from '@/store/sync'
 * 
 * const useStore = create(
 *   syncMiddleware({
 *     storeId: 'my-store',
 *     mode: 'both',
 *     websocket: {
 *       enabled: true,
 *       room: 'trip-123'
 *     },
 *     conflictStrategy: 'lastWriteWins',
 *     whitelist: ['sharedData', 'collaborativeItems']
 *   })(
 *     (set) => ({
 *       // Your store state and actions
 *       sharedData: {},
 *       updateData: (data) => set({ sharedData: data })
 *     })
 *   )
 * )
 * ```
 */

export { syncMiddleware } from './syncMiddleware'
export { BroadcastSync, getBroadcastSync } from './broadcastSync'
export { WebSocketSync, getWebSocketSync } from './websocketSync'
export * from './conflictResolvers'
export * from './types'

// Re-export commonly used resolvers
export {
  lastWriteWinsResolver,
  versionResolver,
  arrayMergeResolver,
  objectMergeResolver,
  counterResolver,
  setResolver,
  fieldResolvers,
  createFieldResolver,
  createSmartResolver
} from './conflictResolvers'

// Helper function to create sync config
export function createSyncConfig<T = any>(
  storeId: string,
  options?: Partial<import('./types').SyncConfig<T>>
): import('./types').SyncConfig<T> {
  return {
    storeId,
    mode: 'both',
    debounceMs: 50,
    batchUpdates: true,
    conflictStrategy: 'lastWriteWins',
    broadcast: {
      enabled: true,
      fallbackToLocalStorage: true,
      leaderElection: true
    },
    websocket: {
      enabled: false,
      reconnectOnError: true,
      maxReconnectAttempts: 5
    },
    ...options
  }
}

// Utility to check if store has sync capabilities
export function isSyncableStore(store: any): store is import('./types').SyncableStore<any> {
  return '_syncConfig' in store && '_syncState' in store && '_syncActions' in store
}

// Get sync actions from a store
export function getSyncActions<T>(store: T): import('./types').SyncActions<T> | null {
  if (isSyncableStore(store)) {
    return store._syncActions || null
  }
  return null
}

// Get sync state from a store
export function getSyncState<T>(store: T): import('./types').SyncState | null {
  if (isSyncableStore(store)) {
    return store._syncState || null
  }
  return null
}