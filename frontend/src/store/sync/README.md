# Zustand Global State Synchronization

A comprehensive state synchronization system for Zustand stores that supports both local (cross-tab) and remote (WebSocket) synchronization with advanced conflict resolution.

## Features

- 🔄 **Cross-tab synchronization** using BroadcastChannel API with localStorage fallback
- 🌐 **WebSocket synchronization** for real-time collaboration
- 🎯 **Selective field synchronization** with whitelist/blacklist support
- 🤝 **Conflict resolution** with multiple strategies (last-write-wins, version-based, custom)
- 📦 **State compression** for efficient network usage
- 🔋 **Offline queue** for syncing when reconnected
- 👑 **Leader election** for cross-tab coordination
- 💾 **Optional persistence** with customizable serialization
- 🎭 **TypeScript support** with full type safety

## Installation

The sync system is already included in the project. Required dependencies:

```bash
npm install zustand immer lodash-es pako
npm install -D @types/lodash-es
```

## Basic Usage

### Simple Cross-Tab Sync

```typescript
import { create } from 'zustand'
import { syncMiddleware } from '@/store/sync'

const useStore = create(
  syncMiddleware({
    storeId: 'my-store',
    mode: 'local'
  })(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }))
    })
  )
)
```

### Real-Time Collaboration

```typescript
const useCollaborativeStore = create(
  syncMiddleware({
    storeId: 'collab-store',
    mode: 'both',
    websocket: {
      enabled: true,
      room: 'project-123'
    }
  })(
    (set) => ({
      // Your collaborative state
    })
  )
)
```

## Configuration Options

### SyncConfig

| Option | Type | Description |
|--------|------|-------------|
| `storeId` | `string` | Unique identifier for the store |
| `mode` | `'local' \| 'remote' \| 'both'` | Synchronization mode |
| `whitelist` | `string[] \| Function` | Fields to include in sync |
| `blacklist` | `string[] \| Function` | Fields to exclude from sync |
| `debounceMs` | `number` | Debounce delay for updates (default: 50) |
| `batchUpdates` | `boolean` | Batch multiple updates together |
| `conflictStrategy` | `string` | Conflict resolution strategy |
| `conflictResolvers` | `Record<string, ConflictResolver>` | Custom field resolvers |

### WebSocket Options

```typescript
websocket: {
  enabled: boolean
  room?: string              // Room/channel for collaboration
  reconnectOnError?: boolean // Auto-reconnect on disconnect
  maxReconnectAttempts?: number
}
```

### Broadcast Options

```typescript
broadcast: {
  enabled: boolean
  channel?: string           // BroadcastChannel name
  fallbackToLocalStorage?: boolean
  leaderElection?: boolean   // Enable tab leadership
}
```

## Conflict Resolution

### Built-in Strategies

1. **Last Write Wins** (default)
   ```typescript
   conflictStrategy: 'lastWriteWins'
   ```

2. **Version-based**
   ```typescript
   conflictStrategy: 'version'
   ```

3. **Custom Resolvers**
   ```typescript
   conflictStrategy: 'custom',
   conflictResolvers: {
     'participants': arrayMergeResolver,
     'settings.theme': (local, remote) => local // Always keep local
   }
   ```

### Available Resolvers

- `lastWriteWinsResolver` - Uses timestamp to resolve
- `versionResolver` - Uses version numbers
- `arrayMergeResolver` - Intelligently merges arrays
- `objectMergeResolver` - Deep merges objects
- `counterResolver` - For numeric counters
- `setResolver` - Merges sets

## Advanced Usage

### Selective Field Synchronization

```typescript
syncMiddleware({
  storeId: 'selective-store',
  mode: 'both',
  
  // Only sync specific fields
  whitelist: ['sharedData', 'collaborativeItems'],
  
  // Or use a function
  whitelist: (path) => path[0] === 'public',
  
  // Exclude sensitive data
  blacklist: ['privateData', 'apiKeys']
})
```

### Custom Conflict Resolution

```typescript
syncMiddleware({
  conflictStrategy: 'custom',
  conflictResolvers: {
    'shoppingList': {
      resolve: (local, remote) => {
        // Merge items by ID, sum quantities
        const merged = new Map()
        
        local.forEach(item => merged.set(item.id, item))
        remote.forEach(item => {
          const existing = merged.get(item.id)
          if (existing) {
            merged.set(item.id, {
              ...item,
              quantity: existing.quantity + item.quantity
            })
          } else {
            merged.set(item.id, item)
          }
        })
        
        return Array.from(merged.values())
      }
    }
  }
})
```

### Programmatic Sync Control

```typescript
import { getSyncActions } from '@/store/sync'

const store = useMyStore.getState()
const syncActions = getSyncActions(store)

if (syncActions) {
  // Manual sync
  await syncActions.sync()
  
  // Force sync from remote
  await syncActions.forceSyncFromRemote()
  
  // Pause during bulk operations
  syncActions.pauseSync()
  // ... do bulk updates
  syncActions.resumeSync()
  
  // Get sync state
  const state = syncActions.getSyncState()
  console.log('Connected:', state.isConnected)
  console.log('Leader:', state.isLeader)
}
```

### Dynamic Room Switching

```typescript
import { getWebSocketSync } from '@/store/sync'

function switchRoom(newRoomId: string) {
  const wsSync = getWebSocketSync('my-store')
  wsSync.leaveRoom()
  wsSync.joinRoom(newRoomId)
}
```

## Integration with Existing Stores

### Trip Store Example

```typescript
import { syncMiddleware } from '@/store/sync'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export const useTripStore = create(
  devtools(
    immer(
      syncMiddleware({
        storeId: 'trip-store',
        mode: 'both',
        websocket: {
          enabled: true,
          room: 'trip-123'
        },
        whitelist: ['trips', 'participants', 'shoppingList'],
        conflictResolvers: {
          'participants': arrayMergeResolver,
          'shoppingList': arrayMergeResolver
        }
      })(
        (set, get) => ({
          // Your existing store implementation
        })
      )
    )
  )
)
```

## Performance Considerations

1. **Debouncing**: Updates are debounced by default (50ms)
2. **Batching**: Enable `batchUpdates` for high-frequency updates
3. **Compression**: Large payloads are automatically compressed
4. **Selective Sync**: Use whitelist/blacklist to minimize data transfer
5. **Leader Election**: Reduces redundant operations across tabs

## Troubleshooting

### Common Issues

1. **Updates not syncing**
   - Check if WebSocket is connected
   - Verify field is not blacklisted
   - Check browser console for errors

2. **Conflicts occurring frequently**
   - Implement custom conflict resolvers
   - Use version-based resolution
   - Consider different sync strategies per field

3. **Performance issues**
   - Enable batching
   - Increase debounce delay
   - Use selective field sync
   - Check for circular references

### Debug Mode

```typescript
syncMiddleware({
  storeId: 'debug-store',
  mode: 'both',
  onSyncStart: () => console.log('🔄 Sync started'),
  onSyncComplete: (updates) => console.log('✅ Sync complete', updates),
  onSyncError: (error) => console.error('❌ Sync error', error),
  onConflict: (meta) => console.warn('⚠️ Conflict', meta)
})
```

## Security Considerations

1. **Never sync sensitive data** (passwords, API keys, tokens)
2. **Use blacklist** to explicitly exclude sensitive fields
3. **Validate incoming data** in conflict resolvers
4. **Use room-based isolation** for access control
5. **Implement server-side validation** for WebSocket sync

## Browser Support

- **BroadcastChannel**: Chrome 54+, Firefox 38+
- **localStorage fallback**: All modern browsers
- **WebSocket**: All modern browsers

The system automatically falls back to localStorage for older browsers that don't support BroadcastChannel.