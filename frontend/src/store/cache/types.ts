// Cache types and interfaces

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  expiresAt: number
  etag?: string
  metadata?: Record<string, any>
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  strategy?: CacheStrategy
  maxSize?: number // Maximum cache size in bytes
  staleWhileRevalidate?: number // Time window for stale-while-revalidate
  tags?: string[] // Cache tags for invalidation
  keyPrefix?: string // Prefix for cache keys
}

export enum CacheStrategy {
  CacheFirst = 'cache-first',
  NetworkFirst = 'network-first',
  NetworkOnly = 'network-only',
  CacheOnly = 'cache-only',
  StaleWhileRevalidate = 'stale-while-revalidate'
}

export interface CacheConfig {
  defaultTTL: number
  maxCacheSize: number // in bytes
  evictionPolicy: EvictionPolicy
  enablePersistence: boolean
  compressionThreshold: number // Size in bytes above which to compress
  globalKeyPrefix: string
}

export enum EvictionPolicy {
  LRU = 'lru', // Least Recently Used
  LFU = 'lfu', // Least Frequently Used
  FIFO = 'fifo', // First In First Out
  TTL = 'ttl' // Time based expiration only
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  itemCount: number
  hitRate: number
}

export interface CacheKeyConfig {
  endpoint: string
  params?: Record<string, any>
  headers?: Record<string, string>
  userId?: string
  tags?: string[]
}

export type CacheInvalidationPattern = 
  | { type: 'key'; key: string }
  | { type: 'prefix'; prefix: string }
  | { type: 'tag'; tag: string }
  | { type: 'tags'; tags: string[] }
  | { type: 'regex'; pattern: RegExp }
  | { type: 'all' }

export interface CacheWarmingConfig {
  endpoints: CacheWarmingEndpoint[]
  schedule?: 'startup' | 'interval' | 'manual'
  intervalMs?: number
  concurrent?: number
  priority?: 'high' | 'normal' | 'low'
}

export interface CacheWarmingEndpoint {
  url: string
  params?: Record<string, any>
  options?: CacheOptions
  transformKey?: (key: string) => string
}

export interface CacheMiddlewareConfig {
  enabled: boolean
  defaultOptions: CacheOptions
  excludePatterns: RegExp[]
  includePatterns: RegExp[]
  responseTransformer?: (response: any) => any
  keyGenerator?: (config: CacheKeyConfig) => string
  shouldCache?: (response: any) => boolean
  onCacheHit?: (key: string, data: any) => void
  onCacheMiss?: (key: string) => void
  onCacheUpdate?: (key: string, data: any) => void
  onCacheEvict?: (key: string) => void
}

// Type guards
export const isCacheEntry = <T>(value: any): value is CacheEntry<T> => {
  return (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    'timestamp' in value &&
    'expiresAt' in value
  )
}

export const isValidCacheStrategy = (value: any): value is CacheStrategy => {
  return Object.values(CacheStrategy).includes(value)
}