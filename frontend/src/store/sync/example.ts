/**
 * Example implementation of the sync middleware with various use cases
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { syncMiddleware, createSyncConfig, getSyncActions } from './index'
import type { Trip, TripStore } from '../slices/tripStore'

/**
 * Example 1: Simple cross-tab synchronization
 */
export const useSimpleSyncStore = create(
  syncMiddleware({
    storeId: 'simple-store',
    mode: 'local',
    broadcast: {
      enabled: true,
      channel: 'simple-store-sync'
    }
  })(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 }))
    })
  )
)

/**
 * Example 2: Collaborative trip editing with WebSocket sync
 */
interface CollaborativeTripStore {
  trip: Trip | null
  participants: any[]
  shoppingList: any[]
  updateTrip: (updates: Partial<Trip>) => void
  addParticipant: (participant: any) => void
  updateShoppingItem: (itemId: string, updates: any) => void
}

export const useCollaborativeTripStore = create(
  devtools(
    immer(
      syncMiddleware<CollaborativeTripStore>({
        storeId: 'collaborative-trip',
        mode: 'both',
        
        // WebSocket configuration for real-time collaboration
        websocket: {
          enabled: true,
          room: 'trip-123', // Dynamic room based on trip ID
          reconnectOnError: true
        },
        
        // Local sync for cross-tab consistency
        broadcast: {
          enabled: true,
          leaderElection: true
        },
        
        // Only sync specific fields
        whitelist: ['trip', 'participants', 'shoppingList'],
        
        // Conflict resolution strategies
        conflictStrategy: 'custom',
        conflictResolvers: {
          'participants': {
            resolve: (local: any[], remote: any[]) => {
              // Merge participants by ID, remote wins for conflicts
              const merged = new Map()
              local.forEach(p => merged.set(p.id, p))
              remote.forEach(p => merged.set(p.id, p))
              return Array.from(merged.values())
            }
          },
          'shoppingList': {
            resolve: (local: any[], remote: any[]) => {
              // Merge shopping items, keeping both versions if different
              const merged = new Map()
              local.forEach(item => merged.set(item.id, { ...item, source: 'local' }))
              remote.forEach(item => {
                if (merged.has(item.id)) {
                  const localItem = merged.get(item.id)
                  if (localItem.quantity !== item.quantity) {
                    // Keep the higher quantity
                    merged.set(item.id, {
                      ...item,
                      quantity: Math.max(localItem.quantity, item.quantity)
                    })
                  }
                } else {
                  merged.set(item.id, item)
                }
              })
              return Array.from(merged.values())
            }
          }
        },
        
        // Callbacks
        onSyncStart: () => console.log('Sync started'),
        onSyncComplete: (updates) => console.log('Sync completed', updates),
        onSyncError: (error) => console.error('Sync error:', error),
        onConflict: (meta) => console.warn('Conflict detected:', meta)
      })(
        (set) => ({
          trip: null,
          participants: [],
          shoppingList: [],
          
          updateTrip: (updates) => set((state) => {
            if (state.trip) {
              Object.assign(state.trip, updates)
            }
          }),
          
          addParticipant: (participant) => set((state) => {
            state.participants.push({
              ...participant,
              id: `${Date.now()}-${Math.random()}`
            })
          }),
          
          updateShoppingItem: (itemId, updates) => set((state) => {
            const item = state.shoppingList.find(i => i.id === itemId)
            if (item) {
              Object.assign(item, updates)
            }
          })
        })
      )
    ),
    { name: 'CollaborativeTripStore' }
  )
)

/**
 * Example 3: User preferences with local-only sync
 */
interface UserPreferencesStore {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: {
    email: boolean
    push: boolean
    sound: boolean
  }
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setLanguage: (language: string) => void
  updateNotifications: (updates: Partial<UserPreferencesStore['notifications']>) => void
}

export const useUserPreferencesStore = create(
  syncMiddleware<UserPreferencesStore>({
    storeId: 'user-preferences',
    mode: 'local',
    
    // Enable persistence
    persistence: {
      enabled: true,
      storageKey: 'jidelnicek-user-preferences'
    },
    
    // User preferences should always prefer local values
    conflictStrategy: 'custom',
    conflictResolvers: {
      'theme': {
        resolve: (local: any) => local // Always keep local theme
      },
      'language': {
        resolve: (local: any) => local // Always keep local language
      }
    }
  })(
    (set) => ({
      theme: 'system',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sound: false
      },
      
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      updateNotifications: (updates) => set((state) => ({
        notifications: { ...state.notifications, ...updates }
      }))
    })
  )
)

/**
 * Example 4: Advanced sync with selective field synchronization
 */
interface AdvancedStore {
  // Public data - synced
  publicData: {
    sharedDocuments: any[]
    collaborators: any[]
    comments: any[]
  }
  
  // Private data - not synced
  privateData: {
    drafts: any[]
    personalNotes: string
    apiKeys: Record<string, string>
  }
  
  // UI state - not synced
  ui: {
    selectedTab: string
    expandedItems: string[]
    searchQuery: string
  }
  
  // Actions
  addDocument: (doc: any) => void
  saveDraft: (draft: any) => void
  setSelectedTab: (tab: string) => void
}

export const useAdvancedStore = create(
  syncMiddleware<AdvancedStore>({
    storeId: 'advanced-store',
    mode: 'both',
    
    // Only sync public data
    whitelist: ['publicData'],
    
    // Or use a function for more control
    // whitelist: (path) => path[0] === 'publicData',
    
    // Explicitly exclude sensitive data
    blacklist: ['privateData.apiKeys'],
    
    websocket: {
      enabled: true,
      room: 'workspace-123'
    },
    
    // Batch updates for performance
    batchUpdates: true,
    debounceMs: 100,
    
    // Compress large payloads
    compressDeltas: true
  })(
    (set) => ({
      publicData: {
        sharedDocuments: [],
        collaborators: [],
        comments: []
      },
      privateData: {
        drafts: [],
        personalNotes: '',
        apiKeys: {}
      },
      ui: {
        selectedTab: 'documents',
        expandedItems: [],
        searchQuery: ''
      },
      
      addDocument: (doc) => set((state) => ({
        publicData: {
          ...state.publicData,
          sharedDocuments: [...state.publicData.sharedDocuments, doc]
        }
      })),
      
      saveDraft: (draft) => set((state) => ({
        privateData: {
          ...state.privateData,
          drafts: [...state.privateData.drafts, draft]
        }
      })),
      
      setSelectedTab: (tab) => set((state) => ({
        ui: { ...state.ui, selectedTab: tab }
      }))
    })
  )
)

/**
 * Example 5: Using sync actions programmatically
 */
export function demonstrateSyncActions() {
  const store = useCollaborativeTripStore.getState()
  const syncActions = getSyncActions(store)
  
  if (syncActions) {
    // Force sync from remote
    syncActions.forceSyncFromRemote()
    
    // Get sync state
    const syncState = syncActions.getSyncState()
    console.log('Is connected:', syncState.isConnected)
    console.log('Is syncing:', syncState.isSyncing)
    console.log('Last sync:', new Date(syncState.lastSyncTime || 0))
    
    // Manually trigger sync
    syncActions.sync().then(() => {
      console.log('Manual sync completed')
    })
    
    // Pause sync during bulk operations
    syncActions.pauseSync()
    
    // Do bulk operations...
    store.addParticipant({ name: 'John' })
    store.addParticipant({ name: 'Jane' })
    
    // Resume sync
    syncActions.resumeSync()
  }
}

/**
 * Example 6: Dynamic room switching for WebSocket sync
 */
export function switchSyncRoom(newTripId: string) {
  // Get the WebSocket sync instance
  const { getWebSocketSync } = require('./websocketSync')
  const wsSync = getWebSocketSync('collaborative-trip')
  
  // Leave current room
  wsSync.leaveRoom()
  
  // Join new room
  wsSync.joinRoom(`trip-${newTripId}`)
}

/**
 * Example 7: Custom sync configuration factory
 */
export function createTripSyncConfig(tripId: string, isOwner: boolean) {
  return createSyncConfig<CollaborativeTripStore>('trip-sync', {
    mode: 'both',
    websocket: {
      enabled: true,
      room: `trip-${tripId}`
    },
    
    // Owners can override conflicts
    conflictStrategy: isOwner ? 'lastWriteWins' : 'version',
    
    // Different sync fields based on role
    whitelist: isOwner 
      ? ['trip', 'participants', 'shoppingList'] 
      : ['shoppingList', 'participants'],
    
    // Persist locally
    persistence: {
      enabled: true,
      storageKey: `trip-${tripId}-cache`
    }
  })
}