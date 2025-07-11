// Cache system exports

export * from './types'
export * from './cacheManager'
export * from './cacheMiddleware'

// Re-export commonly used items for convenience
export { getCacheManager, cacheKeyGenerators, cacheWarmingPresets } from './cacheManager'
export { cacheMiddleware, withCacheInvalidation, cachePresets, createCachedAPI } from './cacheMiddleware'

// Export cache strategies enum for easy access
export { CacheStrategy, EvictionPolicy } from './types'

// Default cache instance
import { getCacheManager } from './cacheManager'
export const cache = getCacheManager()

// Utility function to clear all caches
export const clearAllCaches = () => {
  const cacheManager = getCacheManager()
  cacheManager.clear()
  
  // Also clear any browser caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name))
    })
  }
}

// Debug utilities for development
export const cacheDebug = {
  // Log cache statistics
  logStats: () => {
    const stats = cache.getStats()
    console.table(stats)
    console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`)
    console.log(`Cache size: ${(stats.size / 1024).toFixed(2)} KB`)
    console.log(`Items in cache: ${stats.itemCount}`)
  },

  // Inspect cache contents
  inspect: (pattern?: string) => {
    const data = cache.exportCache()
    const entries = Object.entries(data)
    
    if (pattern) {
      const regex = new RegExp(pattern)
      const filtered = entries.filter(([key]) => regex.test(key))
      console.log(`Found ${filtered.length} entries matching "${pattern}":`)
      filtered.forEach(([key, entry]) => {
        console.log(`  ${key}: ${JSON.stringify(entry).substring(0, 100)}...`)
      })
    } else {
      console.log(`Total cache entries: ${entries.length}`)
      entries.forEach(([key, entry]) => {
        console.log(`  ${key}: ${JSON.stringify(entry).substring(0, 100)}...`)
      })
    }
  },

  // Test cache performance
  benchmark: async (iterations = 1000) => {
    const testData = { test: 'data', timestamp: Date.now() }
    const key = 'benchmark-test'

    console.log(`Running cache benchmark with ${iterations} iterations...`)

    // Write benchmark
    const writeStart = performance.now()
    for (let i = 0; i < iterations; i++) {
      cache.set(`${key}-${i}`, { ...testData, index: i })
    }
    const writeTime = performance.now() - writeStart

    // Read benchmark
    const readStart = performance.now()
    for (let i = 0; i < iterations; i++) {
      cache.get(`${key}-${i}`)
    }
    const readTime = performance.now() - readStart

    // Cleanup
    for (let i = 0; i < iterations; i++) {
      cache.delete(`${key}-${i}`)
    }

    console.log(`Write performance: ${(iterations / writeTime * 1000).toFixed(0)} ops/sec`)
    console.log(`Read performance: ${(iterations / readTime * 1000).toFixed(0)} ops/sec`)
    console.log(`Average write time: ${(writeTime / iterations).toFixed(3)} ms`)
    console.log(`Average read time: ${(readTime / iterations).toFixed(3)} ms`)
  }
}

// Initialize cache warming for essential data
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Warm cache with essential data after page load
    import('./cacheManager').then(({ cacheWarmingPresets }) => {
      cache.startWarming(cacheWarmingPresets.essential())
    })
  })
}