/**
 * Zustand middleware for global state synchronization
 */

import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import type {
  SyncConfig,
  SyncState,
  SyncActions,
  SyncableStore,
  StateDelta,
  SyncMessage,
  ConflictMeta,
  SyncMiddlewareApi
} from './types'
import { BroadcastSync, getBroadcastSync } from './broadcastSync'
import { WebSocketSync, getWebSocketSync } from './websocketSync'
import { 
  lastWriteWinsResolver, 
  createSmartResolver,
  fieldResolvers 
} from './conflictResolvers'
import { get, set, unset, isEqual, cloneDeep, debounce } from 'lodash-es'

// Sync middleware type definition
type SyncMiddleware = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: SyncConfig<T>
) => (
  f: StateCreator<T, Mps, Mcs, T>
) => StateCreator<T, Mps, [['zustand-sync', SyncableStore<T>], ...Mcs], T>

declare module 'zustand' {
  interface StoreMutators<S, A> {
    'zustand-sync': Write<Cast<S, object>, { _syncConfig: SyncConfig<Cast<S, object>> }>
  }
}

// Helper types
type Write<T, U> = Omit<T, keyof U> & U
type Cast<T, U> = T extends U ? T : U

/**
 * Create sync middleware for Zustand stores
 */
export const syncMiddleware: SyncMiddleware = (config) => (create) => {
  return (set, get, api) => {
    // Initialize sync state
    const syncState: SyncState = {
      isConnected: false,
      isSyncing: false,
      pendingUpdates: [],
      syncErrors: []
    }
    
    // Sync instances
    let broadcastSync: BroadcastSync | null = null
    let websocketSync: WebSocketSync | null = null
    
    // Track previous state for delta calculation
    let previousState: any = null
    
    // Conflict resolver
    const conflictResolver = config.conflictStrategy === 'custom' && config.conflictResolvers
      ? createCustomResolver(config.conflictResolvers)
      : config.conflictStrategy === 'version'
      ? versionResolver
      : config.conflictStrategy === 'lastWriteWins'
      ? lastWriteWinsResolver
      : createSmartResolver()
    
    // Initialize sync actions
    const syncActions: SyncActions<any> = {
      sync: async () => {
        if (syncState.isSyncing) return
        
        syncState.isSyncing = true
        config.onSyncStart?.()
        
        try {
          // Flush pending updates
          if (syncState.pendingUpdates.length > 0) {
            await flushPendingUpdates()
          }
          
          // Request latest state from remote
          if (websocketSync && config.websocket?.enabled) {
            websocketSync.requestState()
          }
          
          syncState.lastSyncTime = Date.now()
          config.onSyncComplete?.(syncState.pendingUpdates)
        } catch (error) {
          const err = error as Error
          syncState.syncErrors.push(err)
          config.onSyncError?.(err)
        } finally {
          syncState.isSyncing = false
        }
      },
      
      forceSyncFromRemote: async () => {
        if (websocketSync && config.websocket?.enabled) {
          websocketSync.requestState()
        }
      },
      
      forceSyncToRemote: async () => {
        const state = get()
        const updates = calculateStateDelta(previousState || {}, state)
        
        if (updates.length > 0) {
          broadcastUpdate(updates)
          websocketUpdate(updates)
        }
      },
      
      clearPendingUpdates: () => {
        syncState.pendingUpdates = []
      },
      
      resolveConflicts: (strategy) => {
        // Re-process pending updates with different strategy
        const resolver = strategy === 'lastWriteWins' 
          ? lastWriteWinsResolver
          : strategy === 'version'
          ? versionResolver
          : conflictResolver
        
        // Apply resolver to current conflicts
        // This would need to track conflicts in syncState
      },
      
      pauseSync: () => {
        syncState.isSyncing = true // Prevents new syncs
      },
      
      resumeSync: () => {
        syncState.isSyncing = false
        syncActions.sync()
      },
      
      getSyncState: () => ({ ...syncState })
    }
    
    // Initialize broadcast sync
    if (config.mode === 'local' || config.mode === 'both') {
      if (config.broadcast?.enabled !== false) {
        const broadcastConfig = {
          channel: config.broadcast?.channel || `zustand-sync-${config.storeId}`,
          leaderElection: config.broadcast?.leaderElection ?? true,
          fallbackToLocalStorage: config.broadcast?.fallbackToLocalStorage ?? true
        }
        
        broadcastSync = getBroadcastSync(broadcastConfig)
        
        // Subscribe to broadcast messages
        broadcastSync.subscribe(config.storeId, (message) => {
          handleSyncMessage(message)
        })
      }
    }
    
    // Initialize WebSocket sync
    if (config.mode === 'remote' || config.mode === 'both') {
      if (config.websocket?.enabled) {
        websocketSync = getWebSocketSync(config.storeId, {
          room: config.websocket.room
        })
        
        // Subscribe to WebSocket messages
        websocketSync.subscribe((message) => {
          handleSyncMessage(message)
        })
        
        // Update connection status
        syncState.isConnected = websocketSync.getIsConnected()
      }
    }
    
    // Handle incoming sync messages
    const handleSyncMessage = (message: SyncMessage) => {
      switch (message.type) {
        case 'state-update':
          if (message.payload && Array.isArray(message.payload)) {
            applyRemoteUpdates(message.payload, message.meta)
          }
          break
          
        case 'state-request':
          // Send current state if we're the leader or in a room
          if (broadcastSync?.getIsLeader() || config.websocket?.room) {
            const state = get()
            const filteredState = filterState(state)
            
            if (websocketSync) {
              websocketSync.sendState(filteredState, message.meta?.sessionId ? [message.meta.sessionId] : undefined)
            }
          }
          break
          
        case 'state-response':
          if (message.payload) {
            applyFullState(message.payload, message.meta)
          }
          break
          
        case 'sync-error':
          console.error('Sync error:', message.payload)
          syncState.syncErrors.push(new Error(message.payload as string))
          break
      }
    }
    
    // Apply remote updates
    const applyRemoteUpdates = (updates: StateDelta[], meta?: any) => {
      const currentState = get()
      let newState = cloneDeep(currentState)
      let hasChanges = false
      
      updates.forEach(update => {
        // Check if update should be applied
        if (!shouldSyncPath(update.path)) return
        
        // Get current value
        const currentValue = get(newState, update.path)
        
        // Check for conflicts
        if (!isEqual(currentValue, update.oldValue)) {
          // Conflict detected
          const conflictMeta: ConflictMeta = {
            localTimestamp: previousState?._lastUpdate || Date.now(),
            remoteTimestamp: meta?.timestamp || Date.now(),
            localVersion: previousState?._version,
            remoteVersion: meta?.version,
            localUserId: previousState?._userId,
            remoteUserId: meta?.userId
          }
          
          config.onConflict?.(conflictMeta)
          
          // Resolve conflict
          const resolved = resolveConflict(
            currentValue,
            update.newValue,
            update.path,
            conflictMeta
          )
          
          update.newValue = resolved
        }
        
        // Apply update
        switch (update.operation) {
          case 'set':
            set(newState, update.path, update.newValue)
            hasChanges = true
            break
            
          case 'delete':
            unset(newState, update.path)
            hasChanges = true
            break
            
          case 'merge':
            const existing = get(newState, update.path) || {}
            set(newState, update.path, { ...existing, ...update.newValue })
            hasChanges = true
            break
        }
      })
      
      if (hasChanges) {
        // Update store with batching disabled to prevent echo
        isApplyingRemoteUpdate = true
        set(newState, false)
        isApplyingRemoteUpdate = false
      }
    }
    
    // Apply full state (from state-response)
    const applyFullState = (remoteState: any, meta?: any) => {
      const currentState = get()
      
      // Filter remote state
      const filteredRemote = filterState(remoteState)
      
      // Merge with conflict resolution
      const merged = conflictResolver.resolve(currentState, filteredRemote, {
        localTimestamp: Date.now(),
        remoteTimestamp: meta?.timestamp || Date.now()
      })
      
      // Update store
      isApplyingRemoteUpdate = true
      set(merged, true) // Replace entire state
      isApplyingRemoteUpdate = false
    }
    
    // Resolve conflicts
    const resolveConflict = (local: any, remote: any, path: string[], meta: ConflictMeta): any => {
      // Check for field-specific resolver
      const pathStr = path.join('.')
      if (config.conflictResolvers?.[pathStr]) {
        return config.conflictResolvers[pathStr].resolve(local, remote, meta)
      }
      
      // Use default resolver
      return conflictResolver.resolve(local, remote, meta)
    }
    
    // Filter state based on whitelist/blacklist
    const filterState = (state: any): any => {
      if (!config.whitelist && !config.blacklist) return state
      
      const filtered: any = {}
      
      const checkPath = (path: string[]): boolean => {
        if (config.whitelist) {
          if (typeof config.whitelist === 'function') {
            return config.whitelist(path)
          }
          return config.whitelist.some(pattern => {
            return path.join('.').startsWith(pattern)
          })
        }
        
        if (config.blacklist) {
          if (typeof config.blacklist === 'function') {
            return !config.blacklist(path)
          }
          return !config.blacklist.some(pattern => {
            return path.join('.').startsWith(pattern)
          })
        }
        
        return true
      }
      
      const traverse = (obj: any, path: string[] = []): any => {
        if (typeof obj !== 'object' || obj === null) return obj
        
        const result: any = Array.isArray(obj) ? [] : {}
        
        for (const key in obj) {
          const currentPath = [...path, key]
          if (checkPath(currentPath)) {
            result[key] = traverse(obj[key], currentPath)
          }
        }
        
        return result
      }
      
      return traverse(state)
    }
    
    // Check if path should be synced
    const shouldSyncPath = (path: string[]): boolean => {
      if (config.whitelist) {
        if (typeof config.whitelist === 'function') {
          return config.whitelist(path)
        }
        return config.whitelist.some(pattern => {
          return path.join('.').startsWith(pattern)
        })
      }
      
      if (config.blacklist) {
        if (typeof config.blacklist === 'function') {
          return !config.blacklist(path)
        }
        return !config.blacklist.some(pattern => {
          return path.join('.').startsWith(pattern)
        })
      }
      
      return true
    }
    
    // Calculate state delta
    const calculateStateDelta = (oldState: any, newState: any, path: string[] = []): StateDelta[] => {
      const deltas: StateDelta[] = []
      
      // Handle null/undefined
      if (oldState === newState) return deltas
      if (oldState === undefined || oldState === null || newState === undefined || newState === null) {
        if (shouldSyncPath(path)) {
          deltas.push({
            path,
            oldValue: oldState,
            newValue: newState,
            operation: 'set'
          })
        }
        return deltas
      }
      
      // Handle different types
      if (typeof oldState !== typeof newState || Array.isArray(oldState) !== Array.isArray(newState)) {
        if (shouldSyncPath(path)) {
          deltas.push({
            path,
            oldValue: oldState,
            newValue: newState,
            operation: 'set'
          })
        }
        return deltas
      }
      
      // Handle arrays
      if (Array.isArray(oldState) && Array.isArray(newState)) {
        if (!isEqual(oldState, newState) && shouldSyncPath(path)) {
          deltas.push({
            path,
            oldValue: oldState,
            newValue: newState,
            operation: 'set'
          })
        }
        return deltas
      }
      
      // Handle objects
      if (typeof oldState === 'object' && typeof newState === 'object') {
        const allKeys = new Set([...Object.keys(oldState), ...Object.keys(newState)])
        
        allKeys.forEach(key => {
          const currentPath = [...path, key]
          
          if (!(key in newState)) {
            // Property deleted
            if (shouldSyncPath(currentPath)) {
              deltas.push({
                path: currentPath,
                oldValue: oldState[key],
                operation: 'delete'
              })
            }
          } else if (!(key in oldState)) {
            // Property added
            if (shouldSyncPath(currentPath)) {
              deltas.push({
                path: currentPath,
                newValue: newState[key],
                operation: 'set'
              })
            }
          } else if (!isEqual(oldState[key], newState[key])) {
            // Property changed - recurse
            deltas.push(...calculateStateDelta(oldState[key], newState[key], currentPath))
          }
        })
        
        return deltas
      }
      
      // Handle primitives
      if (oldState !== newState && shouldSyncPath(path)) {
        deltas.push({
          path,
          oldValue: oldState,
          newValue: newState,
          operation: 'set'
        })
      }
      
      return deltas
    }
    
    // Broadcast state updates
    const broadcastUpdate = debounce((updates: StateDelta[]) => {
      if (!broadcastSync) return
      
      if (config.batchUpdates) {
        syncState.pendingUpdates.push(...updates)
      }
      
      broadcastSync.sendUpdate(config.storeId, updates)
    }, config.debounceMs || 50)
    
    // WebSocket state updates
    const websocketUpdate = debounce((updates: StateDelta[]) => {
      if (!websocketSync) return
      
      if (config.batchUpdates) {
        syncState.pendingUpdates.push(...updates)
      }
      
      websocketSync.sendUpdate(updates)
    }, config.debounceMs || 50)
    
    // Flush pending updates
    const flushPendingUpdates = async () => {
      if (syncState.pendingUpdates.length === 0) return
      
      const updates = [...syncState.pendingUpdates]
      syncState.pendingUpdates = []
      
      if (broadcastSync) {
        broadcastSync.sendUpdate(config.storeId, updates)
      }
      
      if (websocketSync) {
        websocketSync.sendUpdate(updates)
      }
    }
    
    // Track if we're applying remote updates to prevent echo
    let isApplyingRemoteUpdate = false
    
    // Create store with sync capabilities
    const store = create((setState, getState, storeApi) => {
      // Override setState to track changes
      const originalSetState = setState
      
      const syncSetState: typeof setState = (partial, replace) => {
        // Don't sync if we're applying remote updates
        if (isApplyingRemoteUpdate) {
          return originalSetState(partial, replace)
        }
        
        // Get state before update
        const oldState = getState()
        
        // Apply update
        originalSetState(partial, replace)
        
        // Get state after update
        const newState = getState()
        
        // Calculate and broadcast changes
        const updates = calculateStateDelta(oldState, newState)
        
        if (updates.length > 0) {
          // Update previous state
          previousState = cloneDeep(newState)
          
          // Broadcast updates
          if (config.mode === 'local' || config.mode === 'both') {
            broadcastUpdate(updates)
          }
          
          if (config.mode === 'remote' || config.mode === 'both') {
            websocketUpdate(updates)
          }
        }
      }
      
      // Return state with sync-aware setState
      return {
        ...initialState,
        setState: syncSetState
      }
    })(set, get, api)
    
    // Attach sync config and actions to store
    const syncApi = api as SyncMiddlewareApi<T>
    syncApi.syncConfig = config
    syncApi.syncState = syncState
    syncApi.syncActions = syncActions
    
    // Restore from persistence if enabled
    if (config.persistence?.enabled) {
      const storageKey = config.persistence.storageKey || `zustand-sync-${config.storeId}`
      
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const state = config.persistence.deserialize
            ? config.persistence.deserialize(stored)
            : JSON.parse(stored)
          
          set(filterState(state), true)
          previousState = cloneDeep(state)
        }
      } catch (error) {
        console.error('Failed to restore persisted state:', error)
      }
      
      // Persist on changes
      api.subscribe((state) => {
        if (!isApplyingRemoteUpdate) {
          try {
            const filtered = filterState(state)
            const serialized = config.persistence?.serialize
              ? config.persistence.serialize(filtered)
              : JSON.stringify(filtered)
            
            localStorage.setItem(storageKey, serialized)
          } catch (error) {
            console.error('Failed to persist state:', error)
          }
        }
      })
    }
    
    // Initialize previous state
    previousState = cloneDeep(get())
    
    return store
  }
}

// Custom resolver creator
function createCustomResolver(resolvers: Record<string, any>) {
  return {
    resolve: (local: any, remote: any, meta?: ConflictMeta) => {
      // Implementation would check field-specific resolvers
      return lastWriteWinsResolver.resolve(local, remote, meta)
    }
  }
}

// Version resolver placeholder
const versionResolver = {
  resolve: (local: any, remote: any, meta?: ConflictMeta) => {
    // Would use version metadata
    return lastWriteWinsResolver.resolve(local, remote, meta)
  }
}