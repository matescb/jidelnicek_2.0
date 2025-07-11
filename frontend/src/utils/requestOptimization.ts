// Request Optimization Utilities

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface PendingRequest<T> {
  promise: Promise<T>
  timestamp: number
}

interface BatchRequest {
  url: string
  method: string
  body?: any
  headers?: Record<string, string>
  resolver: (data: any) => void
  rejecter: (error: any) => void
}

interface PrefetchConfig {
  url: string
  priority?: 'high' | 'low'
  cacheTime?: number
}

// Request deduplication manager
class RequestDeduplication {
  private pendingRequests: Map<string, PendingRequest<any>> = new Map()
  private requestTimeout = 5000 // 5 seconds

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already pending
    const pending = this.pendingRequests.get(key)
    if (pending) {
      // Return existing promise if request is still fresh
      if (Date.now() - pending.timestamp < this.requestTimeout) {
        return pending.promise
      } else {
        // Remove stale request
        this.pendingRequests.delete(key)
      }
    }

    // Create new request
    const promise = requestFn()
      .then((result) => {
        this.pendingRequests.delete(key)
        return result
      })
      .catch((error) => {
        this.pendingRequests.delete(key)
        throw error
      })

    // Store pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    })

    return promise
  }

  clear() {
    this.pendingRequests.clear()
  }
}

// Request batching manager
class RequestBatching {
  private batchQueue: Map<string, BatchRequest[]> = new Map()
  private batchTimers: Map<string, NodeJS.Timeout> = new Map()
  private batchDelay = 50 // 50ms
  private maxBatchSize = 10

  batch<T>(
    endpoint: string,
    request: Omit<BatchRequest, 'resolver' | 'rejecter'>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const batchRequest: BatchRequest = {
        ...request,
        resolver: resolve,
        rejecter: reject,
      }

      // Add to batch queue
      const queue = this.batchQueue.get(endpoint) || []
      queue.push(batchRequest)
      this.batchQueue.set(endpoint, queue)

      // Process batch if size limit reached
      if (queue.length >= this.maxBatchSize) {
        this.processBatch(endpoint)
      } else {
        // Schedule batch processing
        this.scheduleBatch(endpoint)
      }
    })
  }

  private scheduleBatch(endpoint: string) {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(endpoint)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processBatch(endpoint)
    }, this.batchDelay)

    this.batchTimers.set(endpoint, timer)
  }

  private async processBatch(endpoint: string) {
    const queue = this.batchQueue.get(endpoint)
    if (!queue || queue.length === 0) return

    // Clear queue and timer
    this.batchQueue.delete(endpoint)
    this.batchTimers.delete(endpoint)

    try {
      // Create batch request
      const batchPayload = {
        requests: queue.map((req) => ({
          url: req.url,
          method: req.method,
          body: req.body,
          headers: req.headers,
        })),
      }

      // Send batch request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Batch-Request': 'true',
        },
        body: JSON.stringify(batchPayload),
      })

      if (!response.ok) {
        throw new Error(`Batch request failed: ${response.statusText}`)
      }

      const results = await response.json()

      // Resolve individual requests
      queue.forEach((req, index) => {
        if (results.responses && results.responses[index]) {
          const result = results.responses[index]
          if (result.error) {
            req.rejecter(result.error)
          } else {
            req.resolver(result.data)
          }
        } else {
          req.rejecter(new Error('Invalid batch response'))
        }
      })
    } catch (error) {
      // Reject all requests in batch
      queue.forEach((req) => req.rejecter(error))
    }
  }

  clear() {
    this.batchQueue.clear()
    this.batchTimers.forEach((timer) => clearTimeout(timer))
    this.batchTimers.clear()
  }
}

// Response caching manager
class ResponseCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes
  private maxCacheSize = 100
  private cacheHits = 0
  private cacheMisses = 0

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.cacheMisses++
      return null
    }

    // Check if cache is expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.cacheMisses++
      return null
    }

    this.cacheHits++
    return entry.data
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL)
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt,
    })
  }

  invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear()
      return
    }

    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    
    Array.from(this.cache.keys()).forEach((key) => {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    })
  }

  getStats() {
    const total = this.cacheHits + this.cacheMisses
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0

    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate.toFixed(2)}%`,
    }
  }

  clear() {
    this.cache.clear()
    this.cacheHits = 0
    this.cacheMisses = 0
  }
}

// Prefetching manager
class PrefetchManager {
  private prefetchQueue: Set<string> = new Set()
  private prefetchCache: ResponseCache
  private observer?: IntersectionObserver

  constructor(cache: ResponseCache) {
    this.prefetchCache = cache
    this.setupIntersectionObserver()
  }

  private setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement
            const prefetchUrl = element.dataset.prefetch
            
            if (prefetchUrl) {
              this.prefetch({ url: prefetchUrl })
            }
          }
        })
      },
      {
        rootMargin: '50px',
      }
    )
  }

  observeElement(element: HTMLElement) {
    if (this.observer && element.dataset.prefetch) {
      this.observer.observe(element)
    }
  }

  unobserveElement(element: HTMLElement) {
    if (this.observer) {
      this.observer.unobserve(element)
    }
  }

  async prefetch(config: PrefetchConfig): Promise<void> {
    const { url, priority = 'low', cacheTime } = config

    // Skip if already prefetched or in queue
    if (this.prefetchCache.get(url) || this.prefetchQueue.has(url)) {
      return
    }

    // Add to queue
    this.prefetchQueue.add(url)

    try {
      // Use requestIdleCallback for low priority
      if (priority === 'low' && 'requestIdleCallback' in window) {
        await new Promise<void>((resolve) => {
          requestIdleCallback(() => resolve(), { timeout: 2000 })
        })
      }

      // Prefetch with lower priority
      const response = await fetch(url, {
        method: 'GET',
        priority: priority as RequestPriority,
        credentials: 'same-origin',
      })

      if (response.ok) {
        const data = await response.json()
        this.prefetchCache.set(url, data, cacheTime)
      }
    } catch (error) {
      console.error(`Prefetch failed for ${url}:`, error)
    } finally {
      this.prefetchQueue.delete(url)
    }
  }

  async prefetchRoute(routePatterns: string[]) {
    // Get current route
    const currentPath = window.location.pathname

    // Find matching routes to prefetch
    const routesToPrefetch = routePatterns.filter((pattern) => {
      // Simple pattern matching (can be enhanced)
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(currentPath)
    })

    // Prefetch routes in parallel
    await Promise.all(
      routesToPrefetch.map((route) =>
        this.prefetch({ url: route, priority: 'low' })
      )
    )
  }

  clear() {
    this.prefetchQueue.clear()
    if (this.observer) {
      this.observer.disconnect()
    }
  }
}

// Request optimization facade
export class RequestOptimization {
  private deduplication = new RequestDeduplication()
  private batching = new RequestBatching()
  private cache = new ResponseCache()
  private prefetchManager = new PrefetchManager(this.cache)

  // Optimized fetch with deduplication and caching
  async fetch<T>(
    url: string,
    options?: RequestInit & {
      cacheKey?: string
      cacheTTL?: number
      deduplicate?: boolean
      skipCache?: boolean
    }
  ): Promise<T> {
    const {
      cacheKey = url,
      cacheTTL,
      deduplicate = true,
      skipCache = false,
      ...fetchOptions
    } = options || {}

    // Check cache first
    if (!skipCache && fetchOptions.method === 'GET') {
      const cached = this.cache.get<T>(cacheKey)
      if (cached !== null) {
        return cached
      }
    }

    // Create request function
    const requestFn = async () => {
      const response = await fetch(url, fetchOptions)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Cache successful GET requests
      if (fetchOptions.method === 'GET' || !fetchOptions.method) {
        this.cache.set(cacheKey, data, cacheTTL)
      }

      return data
    }

    // Deduplicate if enabled
    if (deduplicate && (fetchOptions.method === 'GET' || !fetchOptions.method)) {
      return this.deduplication.deduplicate(cacheKey, requestFn)
    }

    return requestFn()
  }

  // Batch multiple requests
  async batchRequest<T>(
    endpoint: string,
    request: {
      url: string
      method?: string
      body?: any
      headers?: Record<string, string>
    }
  ): Promise<T> {
    return this.batching.batch(endpoint, {
      method: 'POST',
      ...request,
    })
  }

  // Prefetch data
  prefetch(config: PrefetchConfig | PrefetchConfig[]) {
    const configs = Array.isArray(config) ? config : [config]
    
    configs.forEach((c) => {
      this.prefetchManager.prefetch(c)
    })
  }

  // Prefetch routes
  prefetchRoutes(patterns: string[]) {
    return this.prefetchManager.prefetchRoute(patterns)
  }

  // Observe element for prefetching
  observePrefetch(element: HTMLElement) {
    this.prefetchManager.observeElement(element)
  }

  // Invalidate cache
  invalidateCache(pattern?: string | RegExp) {
    this.cache.invalidate(pattern)
  }

  // Get cache stats
  getCacheStats() {
    return this.cache.getStats()
  }

  // Clear all optimizations
  clear() {
    this.deduplication.clear()
    this.batching.clear()
    this.cache.clear()
    this.prefetchManager.clear()
  }
}

// Global instance
let requestOptimization: RequestOptimization | null = null

export function getRequestOptimization(): RequestOptimization {
  if (!requestOptimization) {
    requestOptimization = new RequestOptimization()
  }
  return requestOptimization
}

// React hooks
import { useCallback, useEffect, useRef } from 'react'

export function useOptimizedFetch<T>(
  url: string,
  options?: RequestInit & {
    cacheKey?: string
    cacheTTL?: number
    deduplicate?: boolean
    skipCache?: boolean
  }
) {
  const optimizer = getRequestOptimization()
  
  return useCallback(
    () => optimizer.fetch<T>(url, options),
    [url, options]
  )
}

export function usePrefetch(config: PrefetchConfig | PrefetchConfig[]) {
  const optimizer = getRequestOptimization()
  
  useEffect(() => {
    optimizer.prefetch(config)
  }, [config])
}

export function usePrefetchOnHover(url: string, cacheTime?: number) {
  const optimizer = getRequestOptimization()
  const prefetched = useRef(false)
  
  const handleMouseEnter = useCallback(() => {
    if (!prefetched.current) {
      optimizer.prefetch({ url, priority: 'low', cacheTime })
      prefetched.current = true
    }
  }, [url, cacheTime])

  return { onMouseEnter: handleMouseEnter }
}

export function useBatchRequests<T>(
  endpoint: string
) {
  const optimizer = getRequestOptimization()
  
  return useCallback(
    (request: {
      url: string
      method?: string
      body?: any
      headers?: Record<string, string>
    }) => optimizer.batchRequest<T>(endpoint, request),
    [endpoint]
  )
}

// Axios interceptor for optimization
export function createAxiosOptimizationInterceptor(axiosInstance: any) {
  const optimizer = getRequestOptimization()

  // Request interceptor
  axiosInstance.interceptors.request.use(
    async (config: any) => {
      // Add request deduplication for GET requests
      if (config.method === 'get' && config.deduplicate !== false) {
        const cacheKey = `${config.url}?${new URLSearchParams(config.params).toString()}`
        const cached = optimizer.getCacheStats()
        
        // Log cache hit rate in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Cache] Hit rate: ${cached.hitRate}`)
        }
      }

      return config
    },
    (error: any) => Promise.reject(error)
  )

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response: any) => {
      // Cache successful GET responses
      if (response.config.method === 'get' && response.config.cache !== false) {
        const cacheKey = `${response.config.url}?${new URLSearchParams(response.config.params).toString()}`
        const cacheTTL = response.config.cacheTTL
        
        // Note: This is a simplified example. In real implementation,
        // you would integrate with the optimizer's cache
      }

      return response
    },
    (error: any) => Promise.reject(error)
  )
}

// Export types
export type { PrefetchConfig, CacheEntry }