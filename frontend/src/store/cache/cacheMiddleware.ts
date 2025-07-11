// Zustand middleware for automatic caching

import { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand'
import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { getCacheManager, cacheKeyGenerators } from './cacheManager'
import {
  CacheStrategy,
  CacheOptions,
  CacheMiddlewareConfig,
  CacheKeyConfig
} from './types'

// Default middleware configuration
const DEFAULT_MIDDLEWARE_CONFIG: CacheMiddlewareConfig = {
  enabled: true,
  defaultOptions: {
    ttl: 5 * 60 * 1000, // 5 minutes
    strategy: CacheStrategy.CacheFirst
  },
  excludePatterns: [
    /\/auth\//,
    /\/upload/,
    /\/ws\//,
    /\/stream\//
  ],
  includePatterns: [
    /\/api\//
  ],
  shouldCache: (response) => {
    // Only cache successful responses
    return response.status >= 200 && response.status < 300
  }
}

// Type for the cache-aware store
export interface CacheAwareStore {
  _cache?: {
    invalidate: (pattern: any) => void
    warmup: () => Promise<void>
    clear: () => void
    getStats: () => any
  }
}

// Helper to determine caching strategy from request config
const getCacheStrategy = (config: AxiosRequestConfig): CacheStrategy | null => {
  // Check for cache headers
  const cacheControl = config.headers?.['Cache-Control']
  if (cacheControl) {
    if (cacheControl.includes('no-cache')) return CacheStrategy.NetworkFirst
    if (cacheControl.includes('no-store')) return null
    if (cacheControl.includes('only-if-cached')) return CacheStrategy.CacheOnly
  }

  // Check for custom cache config
  const customCache = (config as any).cache
  if (customCache === false) return null
  if (customCache?.strategy) return customCache.strategy

  // Default strategies based on method
  switch (config.method?.toUpperCase()) {
    case 'GET':
    case 'HEAD':
      return CacheStrategy.CacheFirst
    case 'POST':
      // Only cache POST if explicitly configured
      return customCache ? CacheStrategy.NetworkFirst : null
    default:
      return null
  }
}

// Create cache key from axios config
const createCacheKey = (
  config: AxiosRequestConfig,
  keyGenerator?: (config: CacheKeyConfig) => string
): string => {
  const cacheManager = getCacheManager()
  
  if (keyGenerator) {
    return keyGenerator({
      endpoint: config.url || '',
      params: config.params,
      headers: config.headers as Record<string, string>
    })
  }

  return cacheManager.generateKey({
    endpoint: config.url || '',
    params: config.params,
    headers: config.headers as Record<string, string>
  })
}

// Execute network request
const executeNetworkRequest = async (
  config: AxiosRequestConfig,
  axiosInstance: any
): Promise<AxiosResponse> => {
  return axiosInstance.request(config)
}

// Cache middleware implementation
export const cacheMiddleware = <
  T extends CacheAwareStore,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: Partial<CacheMiddlewareConfig> = {}
): StateCreator<T, Mps, Mcs, T> => {
  const middlewareConfig = { ...DEFAULT_MIDDLEWARE_CONFIG, ...config }
  const cacheManager = getCacheManager()

  return (set, get, api) => {
    // Store original axios instance
    const axios = (globalThis as any).axios || (window as any).axios
    if (!axios) {
      console.warn('Cache middleware: axios not found globally')
      return set as any
    }

    // Add request interceptor
    axios.interceptors.request.use(async (requestConfig: AxiosRequestConfig) => {
      if (!middlewareConfig.enabled) return requestConfig

      // Check if URL should be cached
      const url = requestConfig.url || ''
      const shouldExclude = middlewareConfig.excludePatterns.some(pattern => pattern.test(url))
      const shouldInclude = middlewareConfig.includePatterns.length === 0 || 
                          middlewareConfig.includePatterns.some(pattern => pattern.test(url))

      if (shouldExclude || !shouldInclude) {
        return requestConfig
      }

      // Get cache strategy
      const strategy = getCacheStrategy(requestConfig)
      if (!strategy) return requestConfig

      // Get cache options
      const cacheOptions: CacheOptions = {
        ...middlewareConfig.defaultOptions,
        ...(requestConfig as any).cache
      }

      // Create cache key
      const cacheKey = createCacheKey(requestConfig, middlewareConfig.keyGenerator)

      // Handle different caching strategies
      switch (strategy) {
        case CacheStrategy.CacheFirst:
          const cachedData = cacheManager.get(cacheKey)
          if (cachedData) {
            // Call cache hit callback
            middlewareConfig.onCacheHit?.(cacheKey, cachedData)
            
            // Return cached response
            return Promise.reject({
              __cached: true,
              config: requestConfig,
              data: cachedData,
              status: 200,
              statusText: 'OK (from cache)',
              headers: { 'x-cache': 'HIT' }
            })
          }
          middlewareConfig.onCacheMiss?.(cacheKey)
          break

        case CacheStrategy.CacheOnly:
          const cacheOnlyData = cacheManager.get(cacheKey)
          if (cacheOnlyData) {
            middlewareConfig.onCacheHit?.(cacheKey, cacheOnlyData)
            return Promise.reject({
              __cached: true,
              config: requestConfig,
              data: cacheOnlyData,
              status: 200,
              statusText: 'OK (from cache)',
              headers: { 'x-cache': 'HIT' }
            })
          }
          // No cache, fail the request
          return Promise.reject({
            __cacheError: true,
            message: 'Cache miss in cache-only mode',
            config: requestConfig
          })

        case CacheStrategy.StaleWhileRevalidate:
          const staleData = cacheManager.get(cacheKey)
          if (staleData) {
            middlewareConfig.onCacheHit?.(cacheKey, staleData)
            
            // Return stale data immediately
            setTimeout(async () => {
              try {
                // Revalidate in background
                const freshResponse = await executeNetworkRequest(requestConfig, axios)
                if (middlewareConfig.shouldCache?.(freshResponse) ?? true) {
                  const transformedData = middlewareConfig.responseTransformer
                    ? middlewareConfig.responseTransformer(freshResponse.data)
                    : freshResponse.data
                  
                  cacheManager.set(cacheKey, transformedData, cacheOptions)
                  middlewareConfig.onCacheUpdate?.(cacheKey, transformedData)
                }
              } catch (error) {
                console.error('Background revalidation failed:', error)
              }
            }, 0)

            // Return stale data
            return Promise.reject({
              __cached: true,
              config: requestConfig,
              data: staleData,
              status: 200,
              statusText: 'OK (stale)',
              headers: { 'x-cache': 'STALE' }
            })
          }
          middlewareConfig.onCacheMiss?.(cacheKey)
          break
      }

      // Store cache key and options in config for response interceptor
      (requestConfig as any).__cacheKey = cacheKey
      (requestConfig as any).__cacheOptions = cacheOptions
      (requestConfig as any).__cacheStrategy = strategy

      return requestConfig
    })

    // Add response interceptor
    axios.interceptors.response.use(
      (response: AxiosResponse) => {
        // Check if response should be cached
        const cacheKey = (response.config as any).__cacheKey
        const cacheOptions = (response.config as any).__cacheOptions
        const cacheStrategy = (response.config as any).__cacheStrategy

        if (cacheKey && cacheOptions && middlewareConfig.shouldCache?.(response) !== false) {
          const transformedData = middlewareConfig.responseTransformer
            ? middlewareConfig.responseTransformer(response.data)
            : response.data

          // Cache the response
          cacheManager.set(cacheKey, transformedData, cacheOptions)
          middlewareConfig.onCacheUpdate?.(cacheKey, transformedData)

          // Add cache headers
          response.headers['x-cache'] = 'MISS'
          response.headers['x-cache-key'] = cacheKey
        }

        return response
      },
      (error: any) => {
        // Handle cached responses (not actual errors)
        if (error.__cached) {
          return Promise.resolve(error as AxiosResponse)
        }

        // Handle cache-only errors
        if (error.__cacheError) {
          throw new Error(error.message)
        }

        // For network errors with NetworkFirst strategy, try cache
        if (error.config && !error.response) {
          const cacheKey = (error.config as any).__cacheKey
          const cacheStrategy = (error.config as any).__cacheStrategy

          if (cacheStrategy === CacheStrategy.NetworkFirst && cacheKey) {
            const cachedData = cacheManager.get(cacheKey)
            if (cachedData) {
              middlewareConfig.onCacheHit?.(cacheKey, cachedData)
              return Promise.resolve({
                config: error.config,
                data: cachedData,
                status: 200,
                statusText: 'OK (from cache after network error)',
                headers: { 'x-cache': 'HIT-AFTER-ERROR' }
              } as AxiosResponse)
            }
          }
        }

        return Promise.reject(error)
      }
    )

    // Extend store with cache utilities
    const store = set as any
    store._cache = {
      invalidate: (pattern: any) => {
        return cacheManager.invalidate(pattern)
      },
      warmup: async () => {
        await cacheManager.warmCache()
      },
      clear: () => {
        cacheManager.clear()
      },
      getStats: () => {
        return cacheManager.getStats()
      }
    }

    return store
  }
}

// Higher-order function to wrap store actions with cache invalidation
export const withCacheInvalidation = <T extends (...args: any[]) => any>(
  action: T,
  invalidationPatterns: ((args: Parameters<T>) => any)[]
): T => {
  return ((...args: Parameters<T>) => {
    const result = action(...args)
    
    // Handle async actions
    if (result instanceof Promise) {
      return result.then((res) => {
        const cacheManager = getCacheManager()
        invalidationPatterns.forEach(getPattern => {
          const pattern = getPattern(args)
          if (pattern) {
            cacheManager.invalidate(pattern)
          }
        })
        return res
      })
    }

    // Handle sync actions
    const cacheManager = getCacheManager()
    invalidationPatterns.forEach(getPattern => {
      const pattern = getPattern(args)
      if (pattern) {
        cacheManager.invalidate(pattern)
      }
    })

    return result
  }) as T
}

// Preset cache configurations for common use cases
export const cachePresets = {
  // Aggressive caching for mostly static data
  static: (): Partial<CacheOptions> => ({
    ttl: 60 * 60 * 1000, // 1 hour
    strategy: CacheStrategy.CacheFirst
  }),

  // Moderate caching with background updates
  dynamic: (): Partial<CacheOptions> => ({
    ttl: 5 * 60 * 1000, // 5 minutes
    strategy: CacheStrategy.StaleWhileRevalidate,
    staleWhileRevalidate: 30 * 1000 // 30 seconds
  }),

  // Minimal caching for frequently changing data
  realtime: (): Partial<CacheOptions> => ({
    ttl: 30 * 1000, // 30 seconds
    strategy: CacheStrategy.NetworkFirst
  }),

  // No caching
  bypass: (): Partial<CacheOptions> => ({
    strategy: CacheStrategy.NetworkOnly
  })
}

// Helper to create cache-aware API methods
export const createCachedAPI = <T = any>(
  endpoint: string,
  defaultCacheOptions?: Partial<CacheOptions>
) => {
  const cacheManager = getCacheManager()

  return {
    get: async (
      id?: string | number,
      params?: any,
      cacheOptions?: Partial<CacheOptions>
    ): Promise<T> => {
      const url = id ? `${endpoint}/${id}` : endpoint
      const cacheKey = cacheKeyGenerators.entity(endpoint, String(id || ''))
      
      // Try cache first if using cache-first strategy
      const options = { ...defaultCacheOptions, ...cacheOptions }
      if (options.strategy === CacheStrategy.CacheFirst) {
        const cached = cacheManager.get<T>(cacheKey)
        if (cached) return cached
      }

      // Make request (will be intercepted by middleware)
      const axios = (globalThis as any).axios
      const response = await axios.get(url, { params, cache: options })
      return response.data
    },

    list: async (
      params?: any,
      cacheOptions?: Partial<CacheOptions>
    ): Promise<T[]> => {
      const cacheKey = cacheKeyGenerators.paginated(
        endpoint,
        params?.page || 1,
        params?.pageSize || 20,
        params
      )

      // Try cache first if using cache-first strategy
      const options = { ...defaultCacheOptions, ...cacheOptions }
      if (options.strategy === CacheStrategy.CacheFirst) {
        const cached = cacheManager.get<T[]>(cacheKey)
        if (cached) return cached
      }

      // Make request
      const axios = (globalThis as any).axios
      const response = await axios.get(endpoint, { params, cache: options })
      return response.data
    },

    invalidate: (pattern?: any) => {
      if (!pattern) {
        // Invalidate all entries for this endpoint
        cacheManager.invalidate({ type: 'prefix', prefix: endpoint })
      } else {
        cacheManager.invalidate(pattern)
      }
    },

    prefetch: async (
      requests: Array<{ id?: string | number; params?: any }>
    ): Promise<void> => {
      await Promise.all(
        requests.map(({ id, params }) => {
          const url = id ? `${endpoint}/${id}` : endpoint
          const axios = (globalThis as any).axios
          return axios.get(url, { 
            params, 
            cache: { ...defaultCacheOptions, strategy: CacheStrategy.CacheFirst }
          }).catch(() => {}) // Ignore errors during prefetch
        })
      )
    }
  }
}