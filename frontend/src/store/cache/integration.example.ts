// Example of integrating cache middleware with existing stores

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { 
  cacheMiddleware, 
  CacheStrategy, 
  withCacheInvalidation,
  createCachedAPI,
  cachePresets,
  getCacheManager
} from './index'
import type { Recipe } from '@/types/recipe'

// Example 1: Simple store with caching
export const useSimpleCachedStore = create(
  cacheMiddleware({
    defaultOptions: {
      ttl: 5 * 60 * 1000, // 5 minutes
      strategy: CacheStrategy.CacheFirst
    }
  })(
    (set, get) => ({
      data: [],
      loading: false,
      
      fetchData: async () => {
        set({ loading: true })
        try {
          // This request will be automatically cached
          const response = await fetch('/api/data', {
            cache: {
              ttl: 10 * 60 * 1000,
              tags: ['data']
            }
          })
          const data = await response.json()
          set({ data, loading: false })
        } catch (error) {
          set({ loading: false })
          throw error
        }
      }
    })
  )
)

// Example 2: Advanced recipe store with multiple caching strategies
interface RecipeStoreWithCache {
  recipes: Recipe[]
  userRecipes: Recipe[]
  currentRecipe: Recipe | null
  loading: boolean
  error: string | null
  
  // Read operations (cached)
  fetchRecipes: (filters?: any) => Promise<void>
  fetchRecipe: (id: string) => Promise<void>
  fetchUserRecipes: () => Promise<void>
  searchRecipes: (query: string) => Promise<void>
  
  // Write operations (with cache invalidation)
  createRecipe: (data: Partial<Recipe>) => Promise<Recipe>
  updateRecipe: (id: string, data: Partial<Recipe>) => Promise<void>
  deleteRecipe: (id: string) => Promise<void>
  
  // Cache utilities
  prefetchRecipes: (ids: string[]) => Promise<void>
  refreshCache: () => Promise<void>
  getCacheStats: () => any
}

export const useRecipeStoreWithCache = create<RecipeStoreWithCache>()(
  devtools(
    cacheMiddleware({
      defaultOptions: {
        ttl: 5 * 60 * 1000,
        strategy: CacheStrategy.StaleWhileRevalidate
      },
      onCacheHit: (key, data) => {
        console.log(`Cache hit: ${key}`)
      },
      onCacheMiss: (key) => {
        console.log(`Cache miss: ${key}`)
      }
    })(
      immer((set, get, api) => ({
        recipes: [],
        userRecipes: [],
        currentRecipe: null,
        loading: false,
        error: null,

        // Fetch recipes with different cache strategies based on context
        fetchRecipes: async (filters) => {
          set(state => { 
            state.loading = true 
            state.error = null
          })

          try {
            // Use different cache strategies based on filters
            const cacheOptions = filters?.realtime 
              ? cachePresets.realtime()
              : filters?.userId 
                ? cachePresets.dynamic()
                : cachePresets.static()

            const response = await fetch('/api/recipes', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              cache: {
                ...cacheOptions,
                tags: ['recipes', filters?.userId && `user-${filters.userId}`].filter(Boolean)
              }
            })

            const data = await response.json()
            
            set(state => {
              state.recipes = data.items
              state.loading = false
            })
          } catch (error: any) {
            set(state => {
              state.error = error.message
              state.loading = false
            })
          }
        },

        // Fetch single recipe with cache
        fetchRecipe: async (id) => {
          set(state => { state.loading = true })

          try {
            const response = await fetch(`/api/recipes/${id}`, {
              cache: {
                ttl: 15 * 60 * 1000, // 15 minutes for individual recipes
                strategy: CacheStrategy.CacheFirst,
                tags: ['recipes', `recipe-${id}`]
              }
            })

            const recipe = await response.json()
            
            set(state => {
              state.currentRecipe = recipe
              state.loading = false
            })
          } catch (error: any) {
            set(state => {
              state.error = error.message
              state.loading = false
            })
          }
        },

        // Fetch user recipes with network-first strategy
        fetchUserRecipes: async () => {
          const response = await fetch('/api/recipes/my-recipes', {
            cache: {
              ttl: 3 * 60 * 1000, // 3 minutes
              strategy: CacheStrategy.NetworkFirst,
              tags: ['recipes', 'user-recipes']
            }
          })

          const recipes = await response.json()
          set(state => { state.userRecipes = recipes })
        },

        // Search with minimal caching
        searchRecipes: async (query) => {
          const response = await fetch(`/api/recipes/search?q=${query}`, {
            cache: {
              ttl: 60 * 1000, // 1 minute for search results
              strategy: CacheStrategy.NetworkFirst,
              tags: ['recipes', 'search']
            }
          })

          const results = await response.json()
          set(state => { state.recipes = results })
        },

        // Create recipe with cache invalidation
        createRecipe: withCacheInvalidation(
          async (data) => {
            const response = await fetch('/api/recipes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
            
            const newRecipe = await response.json()
            
            // Update local state
            set(state => {
              state.userRecipes = [newRecipe, ...state.userRecipes]
            })
            
            return newRecipe
          },
          [
            // Invalidate all recipe lists
            () => ({ type: 'tag', tag: 'recipes' }),
            // Invalidate user recipes
            () => ({ type: 'tag', tag: 'user-recipes' })
          ]
        ),

        // Update recipe with targeted invalidation
        updateRecipe: withCacheInvalidation(
          async (id, data) => {
            const response = await fetch(`/api/recipes/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
            
            const updatedRecipe = await response.json()
            
            // Update local state
            set(state => {
              const index = state.recipes.findIndex(r => r.id === id)
              if (index !== -1) {
                state.recipes[index] = updatedRecipe
              }
              
              if (state.currentRecipe?.id === id) {
                state.currentRecipe = updatedRecipe
              }
            })
          },
          [
            // Invalidate specific recipe
            (args) => ({ type: 'tag', tag: `recipe-${args[0]}` }),
            // Invalidate recipe lists
            () => ({ type: 'tag', tag: 'recipes' })
          ]
        ),

        // Delete recipe with broad invalidation
        deleteRecipe: withCacheInvalidation(
          async (id) => {
            await fetch(`/api/recipes/${id}`, {
              method: 'DELETE'
            })
            
            // Update local state
            set(state => {
              state.recipes = state.recipes.filter(r => r.id !== id)
              state.userRecipes = state.userRecipes.filter(r => r.id !== id)
              
              if (state.currentRecipe?.id === id) {
                state.currentRecipe = null
              }
            })
          },
          [
            // Invalidate everything recipe-related
            () => ({ type: 'prefix', prefix: 'recipe' })
          ]
        ),

        // Prefetch multiple recipes
        prefetchRecipes: async (ids) => {
          await Promise.all(
            ids.map(id => 
              fetch(`/api/recipes/${id}`, {
                cache: {
                  ttl: 15 * 60 * 1000,
                  strategy: CacheStrategy.CacheFirst,
                  tags: ['recipes', `recipe-${id}`]
                }
              }).catch(() => {}) // Ignore errors during prefetch
            )
          )
        },

        // Refresh all recipe-related caches
        refreshCache: async () => {
          const cacheManager = getCacheManager()
          
          // Invalidate all recipe-related caches
          cacheManager.invalidate({ type: 'tag', tag: 'recipes' })
          
          // Refetch current data
          await Promise.all([
            get().fetchRecipes(),
            get().fetchUserRecipes()
          ])
        },

        // Get cache statistics
        getCacheStats: () => {
          const cacheManager = getCacheManager()
          return cacheManager.getStats()
        }
      }))
    )
  )
)

// Example 3: Using createCachedAPI helper
export const recipesAPI = createCachedAPI<Recipe>('/api/recipes', {
  ttl: 10 * 60 * 1000,
  strategy: CacheStrategy.StaleWhileRevalidate
})

// Usage:
// const recipes = await recipesAPI.list({ page: 1, pageSize: 20 })
// const recipe = await recipesAPI.get(123)
// recipesAPI.invalidate() // Invalidate all
// recipesAPI.invalidate({ type: 'key', key: '/api/recipes/123' })
// await recipesAPI.prefetch([{ id: 1 }, { id: 2 }, { id: 3 }])

// Example 4: Manual cache management in components
export const useCacheManagement = () => {
  const cacheManager = getCacheManager()

  return {
    clearUserData: () => {
      // Clear all user-specific caches when logging out
      cacheManager.invalidate({ type: 'regex', pattern: /user-\d+/ })
    },

    warmupEssentialData: async () => {
      // Warm up cache with essential data
      await cacheManager.warmCache({
        endpoints: [
          { url: '/api/user/profile', options: { ttl: 30 * 60 * 1000 } },
          { url: '/api/recipes?featured=true', options: { ttl: 60 * 60 * 1000 } },
          { url: '/api/categories', options: { ttl: 24 * 60 * 60 * 1000 } }
        ],
        schedule: 'manual'
      })
    },

    getCacheInfo: () => {
      const stats = cacheManager.getStats()
      return {
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        items: stats.itemCount
      }
    }
  }
}