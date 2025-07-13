// Cache Manager implementation with advanced features

import {
  CacheEntry,
  CacheOptions,
  CacheConfig,
  CacheStats,
  CacheKeyConfig,
  CacheInvalidationPattern,
  CacheWarmingConfig,
  CacheWarmingEndpoint,
  CacheStrategy,
  EvictionPolicy,
  isCacheEntry
} from './types'

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 0, // No expiration by default  
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  evictionPolicy: EvictionPolicy.LRU,
  enablePersistence: false,
  compressionThreshold: 1024, // 1KB
  globalKeyPrefix: 'jidelnicek_cache_'
}

// Extended config interface for constructor that accepts additional options
interface ExtendedCacheConfig extends Partial<CacheConfig> {
  maxSize?: number // Maximum number of items (alternative to maxCacheSize)
}

export class CacheManager {
  private cache: Map<string, CacheEntry>
  private accessCount: Map<string, number>
  private accessTime: Map<string, number>
  private config: CacheConfig
  private maxItems?: number // If set, limit by item count instead of size
  private stats: CacheStats
  private warmingConfig?: CacheWarmingConfig
  private warmingInterval?: NodeJS.Timeout
  private tags: Map<string, Set<string>> // tag -> Set of cache keys

  constructor(config: ExtendedCacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.maxItems = config.maxSize // If maxSize is provided, use it as item count limit
    this.cache = new Map()
    this.accessCount = new Map()
    this.accessTime = new Map()
    this.tags = new Map()
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      itemCount: 0,
      hitRate: 0
    }

    // Initialize persistence if enabled
    if (this.config.enablePersistence) {
      this.loadFromStorage()
      window.addEventListener('beforeunload', () => this.saveToStorage())
    }
  }

  // Generate cache key
  generateKey(config: CacheKeyConfig | string): string {
    if (typeof config === 'string') {
      return this.config.globalKeyPrefix + config
    }

    const { endpoint, params, headers, userId } = config
    const keyParts = [endpoint]

    if (params) {
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${JSON.stringify(params[key])}`)
        .join('&')
      keyParts.push(sortedParams)
    }

    if (headers) {
      const relevantHeaders = ['accept', 'content-type', 'authorization']
      const headerString = relevantHeaders
        .filter(h => headers[h])
        .map(h => `${h}=${headers[h]}`)
        .join('&')
      if (headerString) keyParts.push(headerString)
    }

    if (userId) {
      keyParts.push(`user=${userId}`)
    }

    const key = keyParts.join('|')
    return this.config.globalKeyPrefix + btoa(key).replace(/[^a-zA-Z0-9]/g, '')
  }

  // Get item from cache
  get<T = any>(key: string): T | null {
    const fullKey = this.ensurePrefix(key)
    const entry = this.cache.get(fullKey)

    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(fullKey)
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Update access tracking
    this.accessTime.set(fullKey, Date.now())
    this.accessCount.set(fullKey, (this.accessCount.get(fullKey) || 0) + 1)
    
    this.stats.hits++
    this.updateHitRate()

    return entry.data as T
  }

  // Set item in cache
  set<T = any>(
    key: string, 
    data: T, 
    options: CacheOptions = {}
  ): void {
    const fullKey = this.ensurePrefix(key)
    const ttl = options.ttl !== undefined ? options.ttl : this.config.defaultTTL
    const timestamp = Date.now()
    // If ttl is 0 or not specified (and defaultTTL is 0), never expire
    const expiresAt = ttl === 0 ? Number.MAX_SAFE_INTEGER : timestamp + ttl

    // Calculate size (rough estimation)
    const size = this.estimateSize(data)

    // Check if we need to evict (either by size or count)
    const needsEviction = this.maxItems 
      ? this.cache.size >= this.maxItems  // Only evict when we would exceed maxItems
      : this.stats.size + size > this.config.maxCacheSize
    
    if (needsEviction) {
      this.evict(size)
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp,
      expiresAt,
      metadata: options
    }

    // Compress if needed
    if (size > this.config.compressionThreshold && this.shouldCompress(data)) {
      entry.data = this.compress(data) as T
      entry.metadata = { ...entry.metadata, compressed: true }
    }

    this.cache.set(fullKey, entry)
    // Only set initial access time if this is a new entry
    if (!this.accessTime.has(fullKey)) {
      this.accessTime.set(fullKey, timestamp)
    }
    this.accessCount.set(fullKey, 0)

    // Update tags
    if (options.tags) {
      options.tags.forEach(tag => {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set())
        }
        this.tags.get(tag)!.add(fullKey)
      })
    }

    this.stats.size += size
    this.stats.itemCount = this.cache.size
  }

  // Delete item from cache
  delete(key: string): boolean {
    const fullKey = this.ensurePrefix(key)
    const entry = this.cache.get(fullKey)
    
    if (!entry) return false

    const size = this.estimateSize(entry.data)
    this.cache.delete(fullKey)
    this.accessTime.delete(fullKey)
    this.accessCount.delete(fullKey)

    // Remove from tags
    this.tags.forEach(keySet => keySet.delete(fullKey))

    this.stats.size -= size
    this.stats.itemCount = this.cache.size

    return true
  }

  // Clear entire cache or by pattern
  clear(pattern?: CacheInvalidationPattern): void {
    if (!pattern || pattern.type === 'all') {
      this.cache.clear()
      this.accessTime.clear()
      this.accessCount.clear()
      this.tags.clear()
      this.stats.size = 0
      this.stats.itemCount = 0
      this.stats.evictions = 0
      return
    }

    const keysToDelete = this.getKeysToInvalidate(pattern)
    keysToDelete.forEach(key => this.delete(key))
  }

  // Invalidate cache by pattern or key
  invalidate(pattern: CacheInvalidationPattern | string): number {
    if (typeof pattern === 'string') {
      // Handle simple key invalidation
      const deleted = this.delete(pattern)
      return deleted ? 1 : 0
    }
    
    const keysToDelete = this.getKeysToInvalidate(pattern)
    keysToDelete.forEach(key => this.delete(key))
    return keysToDelete.length
  }

  // Invalidate cache by regex pattern (convenience method)
  invalidatePattern(pattern: RegExp): number {
    return this.invalidate({
      type: 'regex',
      pattern
    })
  }

  // Get keys to invalidate based on pattern
  private getKeysToInvalidate(pattern: CacheInvalidationPattern): string[] {
    const keys: string[] = []

    switch (pattern.type) {
      case 'key':
        if (this.cache.has(this.ensurePrefix(pattern.key))) {
          keys.push(pattern.key)
        }
        break

      case 'prefix':
        const prefix = this.ensurePrefix(pattern.prefix)
        this.cache.forEach((_, key) => {
          if (key.startsWith(prefix)) {
            keys.push(this.removePrefix(key))
          }
        })
        break

      case 'tag':
        const tagKeys = this.tags.get(pattern.tag)
        if (tagKeys) {
          keys.push(...Array.from(tagKeys).map(k => this.removePrefix(k)))
        }
        break

      case 'tags':
        pattern.tags.forEach(tag => {
          const tagKeys = this.tags.get(tag)
          if (tagKeys) {
            keys.push(...Array.from(tagKeys).map(k => this.removePrefix(k)))
          }
        })
        break

      case 'regex':
        this.cache.forEach((_, key) => {
          const cleanKey = this.removePrefix(key)
          if (pattern.pattern.test(cleanKey)) {
            keys.push(cleanKey)
          }
        })
        break
    }

    return [...new Set(keys)] // Remove duplicates
  }

  // Eviction logic
  private evict(requiredSize: number): void {
    const entries = Array.from(this.cache.entries())
    let freedSize = 0
    let evictedCount = 0

    // Sort based on eviction policy
    switch (this.config.evictionPolicy) {
      case EvictionPolicy.LRU:
        entries.sort((a, b) => {
          const aTime = this.accessTime.get(a[0]) || 0
          const bTime = this.accessTime.get(b[0]) || 0
          return aTime - bTime
        })
        break

      case EvictionPolicy.LFU:
        entries.sort((a, b) => {
          const aCount = this.accessCount.get(a[0]) || 0
          const bCount = this.accessCount.get(b[0]) || 0
          return aCount - bCount
        })
        break

      case EvictionPolicy.FIFO:
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
        break

      case EvictionPolicy.TTL:
        entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
        break
    }

    // Determine how many items to evict
    const targetEvictCount = this.maxItems ? 1 : Math.ceil(entries.length * 0.25) // Evict 25% or 1 item

    // Evict until we have enough space or items
    for (const [key, entry] of entries) {
      if (this.maxItems ? evictedCount >= targetEvictCount : freedSize >= requiredSize) break
      
      freedSize += this.estimateSize(entry.data)
      this.delete(this.removePrefix(key))
      this.stats.evictions++
      evictedCount++
    }
  }

  // Cache warming
  async warmCache(config?: CacheWarmingConfig): Promise<void> {
    const warmingConfig = config || this.warmingConfig
    if (!warmingConfig) return

    const { endpoints, concurrent = 3 } = warmingConfig

    // Process endpoints in batches
    for (let i = 0; i < endpoints.length; i += concurrent) {
      const batch = endpoints.slice(i, i + concurrent)
      await Promise.all(batch.map(endpoint => this.warmEndpoint(endpoint)))
    }
  }

  private async warmEndpoint(endpoint: CacheWarmingEndpoint): Promise<void> {
    try {
      const { url, params, options, transformKey } = endpoint
      
      // Generate cache key
      let key = this.generateKey({ endpoint: url, params })
      if (transformKey) {
        key = transformKey(key)
      }

      // Check if already cached
      if (this.get(key)) return

      // Fetch data (this would be replaced with actual API call in middleware)
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        this.set(key, data, options)
      }
    } catch (error) {
      console.error('Cache warming failed for endpoint:', endpoint.url, error)
    }
  }

  // Start automatic cache warming
  startWarming(config: CacheWarmingConfig): void {
    this.warmingConfig = config

    if (config.schedule === 'startup') {
      this.warmCache(config)
    } else if (config.schedule === 'interval' && config.intervalMs) {
      this.warmingInterval = setInterval(() => {
        this.warmCache(config)
      }, config.intervalMs)
    }
  }

  // Stop cache warming
  stopWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval)
      this.warmingInterval = undefined
    }
  }

  // Persistence methods
  private saveToStorage(): void {
    if (!this.config.enablePersistence) return

    try {
      const data = {
        cache: Array.from(this.cache.entries()),
        accessTime: Array.from(this.accessTime.entries()),
        accessCount: Array.from(this.accessCount.entries()),
        tags: Array.from(this.tags.entries()).map(([tag, keys]) => [tag, Array.from(keys)]),
        stats: this.stats
      }

      localStorage.setItem(
        `${this.config.globalKeyPrefix}data`,
        JSON.stringify(data)
      )
    } catch (error) {
      console.error('Failed to save cache to storage:', error)
    }
  }

  private loadFromStorage(): void {
    if (!this.config.enablePersistence) return

    try {
      const stored = localStorage.getItem(`${this.config.globalKeyPrefix}data`)
      if (!stored) return

      const data = JSON.parse(stored)
      
      // Restore cache entries, filtering out expired ones
      const now = Date.now()
      data.cache.forEach(([key, entry]: [string, CacheEntry]) => {
        if (entry.expiresAt > now) {
          this.cache.set(key, entry)
        }
      })

      // Restore metadata
      this.accessTime = new Map(data.accessTime)
      this.accessCount = new Map(data.accessCount)
      this.tags = new Map(data.tags.map(([tag, keys]: [string, string[]]) => [tag, new Set(keys)]))
      this.stats = data.stats
      
      // Update stats
      this.stats.itemCount = this.cache.size
      this.stats.size = Array.from(this.cache.values())
        .reduce((sum, entry) => sum + this.estimateSize(entry.data), 0)
    } catch (error) {
      console.error('Failed to load cache from storage:', error)
    }
  }

  // Utility methods
  private ensurePrefix(key: string): string {
    return key.startsWith(this.config.globalKeyPrefix) 
      ? key 
      : this.config.globalKeyPrefix + key
  }

  private removePrefix(key: string): string {
    return key.startsWith(this.config.globalKeyPrefix)
      ? key.slice(this.config.globalKeyPrefix.length)
      : key
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2 // UTF-16 chars
    } catch {
      return 1024 // Default 1KB for non-serializable objects
    }
  }

  private shouldCompress(data: any): boolean {
    return typeof data === 'object' && data !== null
  }

  private compress(data: any): any {
    // Simple compression using JSON stringify
    // In production, you might use a real compression library
    return JSON.stringify(data)
  }

  private decompress(data: any): any {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch {
        return data
      }
    }
    return data
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  // Public API for stats and debugging
  getStats(): CacheStats {
    return { ...this.stats }
  }

  getSize(): number {
    return this.stats.size
  }

  getItemCount(): number {
    return this.stats.itemCount
  }

  has(key: string): boolean {
    const fullKey = this.ensurePrefix(key)
    const entry = this.cache.get(fullKey)
    return !!entry && Date.now() <= entry.expiresAt
  }

  // Export/Import for debugging
  exportCache(): Record<string, any> {
    const data: Record<string, any> = {}
    this.cache.forEach((entry, key) => {
      data[this.removePrefix(key)] = entry
    })
    return data
  }

  importCache(data: Record<string, CacheEntry>): void {
    Object.entries(data).forEach(([key, entry]) => {
      if (isCacheEntry(entry)) {
        this.cache.set(this.ensurePrefix(key), entry)
      }
    })
    this.stats.itemCount = this.cache.size
  }
}

// Singleton instance
let cacheManagerInstance: CacheManager | null = null

export const getCacheManager = (config?: Partial<CacheConfig>): CacheManager => {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager(config)
  }
  return cacheManagerInstance
}

// Cache key generators for common patterns
export const cacheKeyGenerators = {
  // For API endpoints with pagination
  paginated: (endpoint: string, page: number, pageSize: number, filters?: any) => {
    return getCacheManager().generateKey({
      endpoint,
      params: { page, pageSize, ...filters }
    })
  },

  // For single entity fetch
  entity: (endpoint: string, id: string | number) => {
    return getCacheManager().generateKey(`${endpoint}/${id}`)
  },

  // For user-specific data
  userScoped: (endpoint: string, userId: string, params?: any) => {
    return getCacheManager().generateKey({
      endpoint,
      params,
      userId
    })
  },

  // For search queries
  search: (endpoint: string, query: string, filters?: any) => {
    return getCacheManager().generateKey({
      endpoint,
      params: { q: query, ...filters }
    })
  }
}

// Cache warming presets
export const cacheWarmingPresets = {
  // Warm essential data on app startup
  essential: (): CacheWarmingConfig => ({
    endpoints: [
      { url: '/api/user/profile', options: { ttl: 30 * 60 * 1000 } }, // 30 min
      { url: '/api/recipes', params: { page: 1, pageSize: 20 }, options: { ttl: 10 * 60 * 1000 } },
      { url: '/api/trips/active', options: { ttl: 5 * 60 * 1000 } }
    ],
    schedule: 'startup',
    concurrent: 3,
    priority: 'high'
  }),

  // Periodic refresh of frequently accessed data
  periodic: (): CacheWarmingConfig => ({
    endpoints: [
      { url: '/api/notifications/unread', options: { ttl: 1 * 60 * 1000 } },
      { url: '/api/trips/upcoming', options: { ttl: 15 * 60 * 1000 } }
    ],
    schedule: 'interval',
    intervalMs: 5 * 60 * 1000, // Every 5 minutes
    concurrent: 2,
    priority: 'normal'
  })
}