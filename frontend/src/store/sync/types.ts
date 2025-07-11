/**
 * Global state synchronization types for Zustand stores
 */

import { StoreApi } from 'zustand'

// Sync modes
export type SyncMode = 'local' | 'remote' | 'both'
export type ConflictResolutionStrategy = 'lastWriteWins' | 'version' | 'custom'

// Sync message types
export interface SyncMessage<T = any> {
  type: 'state-update' | 'state-request' | 'state-response' | 'sync-error'
  storeId: string
  timestamp: number
  payload?: T
  meta?: SyncMeta
}

export interface SyncMeta {
  userId?: string
  sessionId?: string
  version?: number
  source?: 'local' | 'remote'
  conflictResolution?: ConflictResolutionStrategy
}

// State delta for efficient updates
export interface StateDelta<T = any> {
  path: string[]
  oldValue?: T
  newValue?: T
  operation: 'set' | 'delete' | 'merge'
}

// Conflict resolution
export interface ConflictResolver<T = any> {
  resolve: (local: T, remote: T, meta?: ConflictMeta) => T
  shouldResolve?: (path: string[]) => boolean
}

export interface ConflictMeta {
  localTimestamp: number
  remoteTimestamp: number
  localVersion?: number
  remoteVersion?: number
  localUserId?: string
  remoteUserId?: string
}

// Sync configuration
export interface SyncConfig<T = any> {
  storeId: string
  mode: SyncMode
  
  // Field configuration
  whitelist?: string[] | ((path: string[]) => boolean)
  blacklist?: string[] | ((path: string[]) => boolean)
  
  // Sync options
  debounceMs?: number
  batchUpdates?: boolean
  compressDeltas?: boolean
  
  // Conflict resolution
  conflictStrategy?: ConflictResolutionStrategy
  conflictResolvers?: Record<string, ConflictResolver<any>>
  
  // WebSocket configuration
  websocket?: {
    enabled: boolean
    room?: string
    reconnectOnError?: boolean
    maxReconnectAttempts?: number
  }
  
  // Broadcast configuration
  broadcast?: {
    enabled: boolean
    channel?: string
    fallbackToLocalStorage?: boolean
    leaderElection?: boolean
  }
  
  // Persistence
  persistence?: {
    enabled: boolean
    storageKey?: string
    serialize?: (state: T) => string
    deserialize?: (data: string) => T
  }
  
  // Callbacks
  onSyncStart?: () => void
  onSyncComplete?: (updates: StateDelta[]) => void
  onSyncError?: (error: Error) => void
  onConflict?: (conflict: ConflictMeta) => void
}

// Sync middleware types
export interface SyncMiddlewareApi<T = any> extends StoreApi<T> {
  syncConfig: SyncConfig<T>
  syncState: SyncState
  syncActions: SyncActions<T>
}

export interface SyncState {
  isConnected: boolean
  isSyncing: boolean
  lastSyncTime?: number
  pendingUpdates: StateDelta[]
  syncErrors: Error[]
  isLeader?: boolean
  peers?: string[]
}

export interface SyncActions<T = any> {
  sync: () => Promise<void>
  forceSyncFromRemote: () => Promise<void>
  forceSyncToRemote: () => Promise<void>
  clearPendingUpdates: () => void
  resolveConflicts: (strategy?: ConflictResolutionStrategy) => void
  pauseSync: () => void
  resumeSync: () => void
  getSyncState: () => SyncState
}

// WebSocket sync types
export interface WebSocketSyncOptions {
  url?: string
  room?: string
  auth?: Record<string, any>
  reconnectDelay?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

export interface WebSocketSyncMessage extends SyncMessage {
  room?: string
  targetPeers?: string[]
}

// Broadcast sync types
export interface BroadcastSyncOptions {
  channel: string
  leaderElection?: boolean
  leaderTimeout?: number
  fallbackToLocalStorage?: boolean
  storagePrefix?: string
}

export interface BroadcastMessage extends SyncMessage {
  senderId: string
  isLeader?: boolean
}

// Tab leader election
export interface LeaderElectionState {
  leaderId?: string
  electionTime?: number
  candidates: Map<string, number>
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type PathValue<T, P extends string[]> = P extends []
  ? T
  : P extends [infer K, ...infer R]
  ? K extends keyof T
    ? R extends string[]
      ? PathValue<T[K], R>
      : never
    : never
  : never

export type SyncableStore<T> = T & {
  _syncConfig?: SyncConfig<T>
  _syncState?: SyncState
  _syncActions?: SyncActions<T>
}