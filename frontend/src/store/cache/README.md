# Cache Management System

A comprehensive caching solution for Zustand stores with advanced features including TTL support, multiple caching strategies, cache invalidation, and automatic cache warming.

## Features

- **In-memory caching** with configurable TTL (Time To Live)
- **Multiple caching strategies**:
  - Cache First
  - Network First
  - Cache Only
  - Network Only
  - Stale While Revalidate
- **Cache invalidation** by key, prefix, tag, or regex pattern
- **Eviction policies**: LRU, LFU, FIFO, TTL-based
- **Cache warming** capabilities
- **Size limits** with automatic eviction
- **Persistence** support (localStorage)
- **Compression** for large objects
- **Cache statistics** and debugging tools

## Basic Usage

### 1. Import the cache middleware

```typescript
import { cacheMiddleware, CacheStrategy } from '@/store/cache'
import { create } from 'zustand'
```

### 2. Apply middleware to your store

```typescript
import { create } from 'zustand'
import { cacheMiddleware } from '@/store/cache'

const useMyStore = create(
  cacheMiddleware({
    defaultOptions: {
      ttl: 5 * 60 * 1000, // 5 minutes
      strategy: CacheStrategy.CacheFirst
    }
  })(
    (set, get) => ({
      // Your store implementation
    })
  )
)
```

### 3. Configure caching for API calls

```typescript
// In your API calls, add cache configuration
const response = await apiClient.get('/recipes', {
  cache: {
    ttl: 10 * 60 * 1000, // 10 minutes
    strategy: CacheStrategy.StaleWhileRevalidate,
    tags: ['recipes']
  }
})
```

## Advanced Usage

### Cache Invalidation

```typescript
import { withCacheInvalidation } from '@/store/cache'

// Wrap actions that should invalidate cache
const updateRecipe = withCacheInvalidation(
  async (id: string, data: any) => {
    // Update logic
  },
  [
    // Invalidate specific recipe
    (args) => ({ type: 'key', key: `/recipes/${args[0]}` }),
    // Invalidate recipe list
    (args) => ({ type: 'prefix', prefix: '/recipes' })
  ]
)
```

### Cache Warming

```typescript
import { getCacheManager, cacheWarmingPresets } from '@/store/cache'

// Warm cache on app startup
const cacheManager = getCacheManager()
cacheManager.startWarming({
  endpoints: [
    { url: '/api/user/profile', options: { ttl: 30 * 60 * 1000 } },
    { url: '/api/recipes', params: { page: 1 }, options: { ttl: 10 * 60 * 1000 } }
  ],
  schedule: 'startup'
})
```

### Using Cache Presets

```typescript
import { cachePresets } from '@/store/cache'

// For static data (1 hour cache)
await apiClient.get('/api/categories', {
  cache: cachePresets.static()
})

// For dynamic data (5 min cache with background refresh)
await apiClient.get('/api/recipes', {
  cache: cachePresets.dynamic()
})

// For real-time data (30 sec cache, network first)
await apiClient.get('/api/notifications', {
  cache: cachePresets.realtime()
})
```

### Manual Cache Management

```typescript
import { cache } from '@/store/cache'

// Set cache manually
cache.set('my-key', { data: 'value' }, { ttl: 60000 })

// Get from cache
const data = cache.get('my-key')

// Check if exists
if (cache.has('my-key')) {
  // Key exists and is not expired
}

// Delete specific key
cache.delete('my-key')

// Clear all cache
cache.clear()

// Invalidate by pattern
cache.invalidate({ type: 'prefix', prefix: 'recipes-' })
cache.invalidate({ type: 'tag', tag: 'user-data' })
cache.invalidate({ type: 'regex', pattern: /^temp-/ })
```

## Example: Recipe Store with Caching

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { cacheMiddleware, CacheStrategy, withCacheInvalidation } from '@/store/cache'
import { apiClient } from '@/api/client'

interface RecipeStore {
  recipes: Recipe[]
  loading: boolean
  fetchRecipes: (page?: number) => Promise<void>
  createRecipe: (data: Partial<Recipe>) => Promise<Recipe>
  updateRecipe: (id: string, data: Partial<Recipe>) => Promise<void>
  deleteRecipe: (id: string) => Promise<void>
}

export const useRecipeStore = create<RecipeStore>()(
  devtools(
    cacheMiddleware({
      defaultOptions: {
        ttl: 5 * 60 * 1000,
        strategy: CacheStrategy.CacheFirst
      }
    })(
      immer((set, get) => ({
        recipes: [],
        loading: false,

        fetchRecipes: async (page = 1) => {
          set(state => { state.loading = true })
          
          try {
            const response = await apiClient.get('/recipes', {
              params: { page, pageSize: 20 },
              cache: {
                ttl: 10 * 60 * 1000,
                strategy: CacheStrategy.StaleWhileRevalidate,
                tags: ['recipes', `recipes-page-${page}`]
              }
            })
            
            set(state => {
              state.recipes = response.data.items
              state.loading = false
            })
          } catch (error) {
            set(state => { state.loading = false })
            throw error
          }
        },

        createRecipe: withCacheInvalidation(
          async (data) => {
            const response = await apiClient.post('/recipes', data)
            return response.data
          },
          [
            // Invalidate all recipe lists
            () => ({ type: 'tag', tag: 'recipes' })
          ]
        ),

        updateRecipe: withCacheInvalidation(
          async (id, data) => {
            await apiClient.put(`/recipes/${id}`, data)
          },
          [
            // Invalidate specific recipe
            (args) => ({ type: 'key', key: `/recipes/${args[0]}` }),
            // Invalidate recipe lists
            () => ({ type: 'tag', tag: 'recipes' })
          ]
        ),

        deleteRecipe: withCacheInvalidation(
          async (id) => {
            await apiClient.delete(`/recipes/${id}`)
          },
          [
            // Invalidate specific recipe
            (args) => ({ type: 'key', key: `/recipes/${args[0]}` }),
            // Invalidate recipe lists
            () => ({ type: 'tag', tag: 'recipes' })
          ]
        )
      }))
    )
  )
)
```

## Debugging

```typescript
import { cacheDebug } from '@/store/cache'

// Log cache statistics
cacheDebug.logStats()

// Inspect cache contents
cacheDebug.inspect() // Show all entries
cacheDebug.inspect('recipe') // Show entries matching 'recipe'

// Benchmark cache performance
await cacheDebug.benchmark(1000) // Run 1000 iterations
```

## Configuration Options

### CacheOptions

```typescript
interface CacheOptions {
  ttl?: number              // Time to live in milliseconds
  strategy?: CacheStrategy  // Caching strategy
  maxSize?: number         // Max cache size in bytes
  staleWhileRevalidate?: number // Stale window in ms
  tags?: string[]          // Tags for invalidation
  keyPrefix?: string       // Key prefix
}
```

### CacheMiddlewareConfig

```typescript
interface CacheMiddlewareConfig {
  enabled: boolean         // Enable/disable caching
  defaultOptions: CacheOptions
  excludePatterns: RegExp[] // URLs to exclude
  includePatterns: RegExp[] // URLs to include
  responseTransformer?: (response: any) => any
  keyGenerator?: (config: CacheKeyConfig) => string
  shouldCache?: (response: any) => boolean
  onCacheHit?: (key: string, data: any) => void
  onCacheMiss?: (key: string) => void
  onCacheUpdate?: (key: string, data: any) => void
  onCacheEvict?: (key: string) => void
}
```

## Best Practices

1. **Choose appropriate TTL values**:
   - Static data: 1-24 hours
   - Semi-dynamic data: 5-30 minutes
   - Dynamic data: 30 seconds - 5 minutes

2. **Use tags for grouped invalidation**:
   ```typescript
   cache: { tags: ['recipes', 'user-123'] }
   ```

3. **Implement proper error handling**:
   ```typescript
   try {
     const data = await fetchWithCache()
   } catch (error) {
     if (error.message.includes('Cache miss in cache-only mode')) {
       // Handle offline scenario
     }
   }
   ```

4. **Monitor cache performance**:
   - Check hit rate regularly
   - Adjust TTL based on usage patterns
   - Monitor cache size

5. **Use appropriate strategies**:
   - `CacheFirst`: For mostly static data
   - `NetworkFirst`: For important dynamic data
   - `StaleWhileRevalidate`: For good UX with fresh data
   - `CacheOnly`: For offline support
   - `NetworkOnly`: For real-time data

## Performance Considerations

- Cache operations are synchronous and fast (< 1ms for most operations)
- Compression is applied automatically for objects > 1KB
- LRU eviction ensures most-used data stays in cache
- Background revalidation doesn't block the UI
- Persistence adds ~10-20ms overhead on startup

## Limitations

- Maximum cache size: 50MB (configurable)
- localStorage persistence: ~10MB limit
- No cross-tab synchronization (planned for future)
- Compression is basic (JSON stringify)