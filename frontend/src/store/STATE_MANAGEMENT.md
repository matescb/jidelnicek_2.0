# Jidelnicek 2.0 State Management Architecture

This document provides a comprehensive overview of the enhanced state management system built on top of Zustand.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                     React Components & Hooks                     │
├─────────────────────────────────────────────────────────────────┤
│                      Zustand Stores Layer                        │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Auth   │ │ Recipe  │ │   Trip   │ │Ingredient│ │ Admin  │ │
│  │  Store  │ │  Store  │ │  Store   │ │  Store   │ │ Store  │ │
│  └─────────┘ └─────────┘ └──────────┘ └──────────┘ └────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      Middleware Layer                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ │
│  │  Cache   │ │Persistence│ │Optimistic│ │  Sync  │ │Hydration│ │
│  │Middleware│ │Middleware │ │Middleware│ │  Mid.  │ │  Mid.   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ └────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                       API Layer                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │          Enhanced API Middleware (Retry, Circuit)           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Features

### 1. Cache Management (`/store/cache/`)
Advanced caching system with multiple strategies:
- **Strategies**: Cache-first, Network-first, Stale-while-revalidate
- **Eviction**: LRU, LFU, FIFO, TTL-based
- **Features**: Tag-based invalidation, pattern matching, compression
- **Integration**: Automatic API response caching

```typescript
// Example usage
const useStore = create(
  cacheMiddleware({
    maxAge: 5 * 60 * 1000, // 5 minutes
    strategy: 'stale-while-revalidate'
  })(/* store implementation */)
)
```

### 2. Persistence (`/store/persistence/`)
Flexible state persistence with security:
- **Storage**: LocalStorage, SessionStorage, IndexedDB
- **Security**: AES-GCM encryption for sensitive data
- **Features**: Selective persistence, migrations, compression
- **Performance**: Async storage support, quota management

```typescript
// Example usage
const useStore = create(
  persist(
    /* store implementation */,
    {
      name: 'app-state',
      encrypt: { fields: ['apiKey', 'tokens'] },
      compress: true,
      whitelist: ['user', 'preferences']
    }
  )
)
```

### 3. Optimistic Updates (`/store/optimistic/`)
Instant UI feedback with automatic rollback:
- **Features**: Queue management, conflict resolution, retries
- **Patterns**: Transaction-like behavior, priority updates
- **React**: Custom hooks for easy integration

```typescript
// Example usage
const mutation = useOptimisticMutation(useStore, 'updateItem', 
  async (data) => api.updateItem(data)
)

await mutation.mutate(newData) // Instant UI update, rollback on failure
```

### 4. State Synchronization (`/store/sync/`)
Real-time state synchronization across contexts:
- **Local**: Cross-tab sync via BroadcastChannel
- **Remote**: WebSocket-based collaborative sync
- **Features**: Conflict resolution, offline queue, leader election

```typescript
// Example usage
const useStore = create(
  syncMiddleware({
    mode: 'both',
    websocket: { room: 'collaboration-123' },
    conflictStrategy: 'lastWriteWins'
  })(/* store implementation */)
)
```

### 5. Enhanced API Middleware (`/store/middleware/`)
Robust HTTP request handling:
- **Retry**: Exponential backoff, smart conditions
- **Circuit Breaker**: Prevents cascade failures
- **Features**: Request cancellation, batch requests, type-safe clients

```typescript
// Example usage
const data = await apiGet('/users', {
  retry: {
    retries: 3,
    retryDelay: (count) => Math.min(1000 * 2 ** count, 10000)
  }
})
```

### 6. State Hydration (`/store/hydration/`)
SSR and client-side state hydration:
- **SSR**: Server-side rendering support
- **Features**: Partial hydration, dependency management
- **Types**: Safe serialization of Date, Map, Set, etc.

```typescript
// Example usage
const useStore = create(
  hydrate(
    /* store implementation */,
    {
      dependencies: ['authStore'],
      transform: (state) => ({
        ...state,
        createdAt: new Date(state.createdAt)
      })
    }
  )
)
```

### 7. Store Composition (`/store/composition/`)
Modular store architecture:
- **Factories**: Pre-built patterns (CRUD, async, forms, modals)
- **Composition**: Combine slices with namespacing
- **Selectors**: Memoized, cross-store selectors

```typescript
// Example usage
const useAppStore = composeStore({
  auth: authSlice,
  recipes: createCrudSlice<Recipe>({ name: 'recipes' }),
  ui: createModalSlice({ name: 'ui' })
})
```

## Usage Patterns

### Basic Store with All Features

```typescript
import { create } from 'zustand'
import { composeMiddleware } from '@/store/utils'
import { 
  cacheMiddleware, 
  persistMiddleware, 
  optimisticMiddleware,
  syncMiddleware 
} from '@/store'

const useStore = create(
  composeMiddleware(
    cacheMiddleware({ maxAge: 5 * 60 * 1000 }),
    persistMiddleware({ name: 'app-state' }),
    optimisticMiddleware({ maxRetries: 3 }),
    syncMiddleware({ mode: 'local' })
  )(
    (set, get) => ({
      // State
      items: [],
      
      // Actions
      addItem: async (item) => {
        // Optimistic update happens automatically
        const result = await api.createItem(item)
        set({ items: [...get().items, result] })
        return result
      }
    })
  )
)
```

### Collaborative Features

```typescript
// Real-time collaborative editing
const useTripStore = create(
  syncMiddleware({
    mode: 'websocket',
    websocket: {
      room: `trip-${tripId}`,
      events: ['trip:updated', 'participant:joined']
    }
  })(tripSlice)
)

// Cross-tab cart synchronization
const useCartStore = create(
  syncMiddleware({ mode: 'local' })(cartSlice)
)
```

### Performance Optimization

```typescript
// Cached API data with background refresh
const useRecipeStore = create(
  cacheMiddleware({
    strategy: 'stale-while-revalidate',
    maxAge: 10 * 60 * 1000, // 10 minutes
    prefetch: ['/api/recipes/popular']
  })(recipeSlice)
)

// Memoized selectors for expensive computations
const selectFilteredRecipes = createSelector(
  [(state) => state.recipes, (state) => state.filters],
  (recipes, filters) => applyFilters(recipes, filters)
)
```

## Best Practices

1. **Layer Middleware Appropriately**
   ```typescript
   // Order matters: cache → persist → optimistic → sync
   composeMiddleware(cache, persist, optimistic, sync)
   ```

2. **Use Factories for Common Patterns**
   ```typescript
   // Don't reinvent the wheel
   const userStore = createCrudSlice<User>({ 
     name: 'users',
     endpoint: '/api/users'
   })
   ```

3. **Configure Based on Data Type**
   - **Static Data**: Heavy caching, network-first
   - **User Data**: Persistence, encryption
   - **Collaborative**: WebSocket sync, conflict resolution
   - **Forms**: Optimistic updates, validation

4. **Monitor Performance**
   ```typescript
   // Enable in development
   const middleware = process.env.NODE_ENV === 'development'
     ? [logger, devtools, performance]
     : []
   ```

5. **Handle Errors Gracefully**
   ```typescript
   // All middleware support error callbacks
   optimisticMiddleware({
     onError: (error, context) => {
       logger.error('Optimistic update failed', { error, context })
       showErrorToast(error.message)
     }
   })
   ```

## Migration Guide

### From Plain Zustand

```typescript
// Before
const useStore = create((set) => ({
  items: [],
  fetchItems: async () => {
    const items = await api.getItems()
    set({ items })
  }
}))

// After
const useStore = create(
  composeMiddleware(
    cacheMiddleware({ maxAge: 5 * 60 * 1000 }),
    persistMiddleware({ name: 'items' })
  )(
    (set) => ({
      items: [],
      fetchItems: async () => {
        const items = await apiGet('/items') // Automatic retry
        set({ items })
      }
    })
  )
)
```

### From Redux

```typescript
// Redux pattern
const slice = createSlice({
  name: 'recipes',
  initialState: { items: [], loading: false },
  reducers: { /* ... */ }
})

// Zustand with factories
const useRecipeStore = createAsyncSlice<Recipe>({
  name: 'recipes',
  fetchFn: () => apiGet('/recipes')
})
```

## Testing

All middleware support testing modes:

```typescript
// Disable persistence in tests
const testStore = create(
  persistMiddleware({ 
    name: 'test',
    storage: createMemoryStorage() 
  })(storeImplementation)
)

// Mock API calls
const mockApi = createApiClient<TestEndpoints>('/test')
jest.mock('@/store/middleware/apiMiddleware', () => ({ 
  apiGet: mockApi.get 
}))
```

## Performance Considerations

1. **Cache Size**: Monitor cache size and configure limits
2. **Persistence**: Use IndexedDB for large data
3. **Sync Frequency**: Debounce/throttle sync operations
4. **Selector Memoization**: Use for expensive computations
5. **Hydration**: Hydrate only necessary state

## Debugging

Enable debug mode for detailed logging:

```typescript
// Enable all debug logs
localStorage.setItem('DEBUG', 'store:*')

// Enable specific logs
localStorage.setItem('DEBUG', 'store:cache,store:sync')
```

## Future Enhancements

1. **Time-Travel Debugging**: Record and replay state changes
2. **State Machines**: Integration with XState
3. **GraphQL Cache**: Normalized caching for GraphQL
4. **Worker Support**: Offload heavy computations
5. **React Native**: Support for mobile persistence