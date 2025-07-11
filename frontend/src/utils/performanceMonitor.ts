// Performance monitoring utilities for code splitting

export interface ChunkLoadMetrics {
  chunkName: string
  loadTime: number
  size?: number
  fromCache: boolean
  retryCount: number
  timestamp: number
}

export interface PerformanceMetrics {
  initialLoadTime: number
  chunkLoads: ChunkLoadMetrics[]
  cacheHitRate: number
  averageChunkLoadTime: number
  totalChunksLoaded: number
  failedLoads: number
}

class PerformanceMonitor {
  private metrics: ChunkLoadMetrics[] = []
  private initialLoadTime: number = 0
  private startTime: number = performance.now()

  constructor() {
    this.measureInitialLoad()
    this.setupPerformanceObserver()
  }

  // Measure initial load time
  private measureInitialLoad() {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigationEntry) {
        this.initialLoadTime = navigationEntry.loadEventEnd - navigationEntry.fetchStart
      }
    }
  }

  // Set up performance observer for resource timing
  private setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource' && entry.name.includes('.js')) {
            this.trackResourceLoad(entry as PerformanceResourceTiming)
          }
        }
      })

      observer.observe({ entryTypes: ['resource'] })
    }
  }

  // Track resource load
  private trackResourceLoad(entry: PerformanceResourceTiming) {
    const isChunk = entry.name.includes('-') && entry.name.includes('.js')
    if (isChunk) {
      const chunkName = this.extractChunkName(entry.name)
      const fromCache = entry.transferSize === 0 && entry.decodedBodySize > 0
      
      this.recordChunkLoad({
        chunkName,
        loadTime: entry.duration,
        size: entry.decodedBodySize,
        fromCache,
        retryCount: 0,
        timestamp: entry.startTime
      })
    }
  }

  // Extract chunk name from URL
  private extractChunkName(url: string): string {
    const parts = url.split('/')
    const filename = parts[parts.length - 1]
    return filename.split('-')[0].replace('.js', '')
  }

  // Record chunk load
  recordChunkLoad(metrics: ChunkLoadMetrics) {
    this.metrics.push(metrics)
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Chunk Load] ${metrics.chunkName}:`, {
        loadTime: `${metrics.loadTime.toFixed(2)}ms`,
        fromCache: metrics.fromCache,
        size: metrics.size ? `${(metrics.size / 1024).toFixed(2)}KB` : 'unknown',
        retryCount: metrics.retryCount
      })
    }
  }

  // Get performance metrics
  getMetrics(): PerformanceMetrics {
    const totalChunks = this.metrics.length
    const cachedChunks = this.metrics.filter(m => m.fromCache).length
    const failedLoads = this.metrics.filter(m => m.retryCount > 0).length
    
    const averageLoadTime = totalChunks > 0
      ? this.metrics.reduce((sum, m) => sum + m.loadTime, 0) / totalChunks
      : 0

    return {
      initialLoadTime: this.initialLoadTime,
      chunkLoads: [...this.metrics],
      cacheHitRate: totalChunks > 0 ? (cachedChunks / totalChunks) * 100 : 0,
      averageChunkLoadTime: averageLoadTime,
      totalChunksLoaded: totalChunks,
      failedLoads
    }
  }

  // Get metrics summary
  getSummary(): string {
    const metrics = this.getMetrics()
    return `
Performance Summary:
- Initial Load Time: ${metrics.initialLoadTime.toFixed(2)}ms
- Total Chunks Loaded: ${metrics.totalChunksLoaded}
- Average Chunk Load Time: ${metrics.averageChunkLoadTime.toFixed(2)}ms
- Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%
- Failed Loads: ${metrics.failedLoads}
    `.trim()
  }

  // Log metrics to console
  logMetrics() {
    console.group('📊 Code Splitting Performance Metrics')
    console.log(this.getSummary())
    console.table(this.metrics.map(m => ({
      chunk: m.chunkName,
      loadTime: `${m.loadTime.toFixed(2)}ms`,
      size: m.size ? `${(m.size / 1024).toFixed(2)}KB` : 'N/A',
      cached: m.fromCache ? '✓' : '✗',
      retries: m.retryCount
    })))
    console.groupEnd()
  }

  // Send metrics to analytics (placeholder)
  sendToAnalytics() {
    const metrics = this.getMetrics()
    
    // Example: Send to your analytics service
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'performance_metrics', {
        event_category: 'Performance',
        event_label: 'Code Splitting',
        initial_load_time: Math.round(metrics.initialLoadTime),
        average_chunk_load_time: Math.round(metrics.averageChunkLoadTime),
        cache_hit_rate: Math.round(metrics.cacheHitRate),
        total_chunks: metrics.totalChunksLoaded
      })
    }
  }

  // Reset metrics
  reset() {
    this.metrics = []
    this.startTime = performance.now()
  }
}

// Global instance
let monitor: PerformanceMonitor | null = null

// Get or create monitor instance
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitor && typeof window !== 'undefined') {
    monitor = new PerformanceMonitor()
  }
  return monitor!
}

// Utility to measure component render time
export function measureComponentRender(componentName: string) {
  const startMark = `${componentName}-render-start`
  const endMark = `${componentName}-render-end`
  const measureName = `${componentName}-render`

  return {
    start: () => performance.mark(startMark),
    end: () => {
      performance.mark(endMark)
      performance.measure(measureName, startMark, endMark)
      
      const measure = performance.getEntriesByName(measureName)[0]
      if (measure && process.env.NODE_ENV === 'development') {
        console.log(`[Render] ${componentName}: ${measure.duration.toFixed(2)}ms`)
      }
      
      // Clean up marks
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
      performance.clearMeasures(measureName)
      
      return measure?.duration || 0
    }
  }
}

// React hook for performance monitoring
import { useEffect, useRef } from 'react'

export function usePerformanceMonitor(componentName: string) {
  const renderTimer = useRef(measureComponentRender(componentName))
  
  useEffect(() => {
    renderTimer.current.start()
    return () => {
      renderTimer.current.end()
    }
  })
  
  return getPerformanceMonitor()
}

// Webpack/Vite chunk load error detection
export function detectChunkLoadErrors() {
  window.addEventListener('error', (event) => {
    if (event.message?.includes('Loading chunk') || 
        event.message?.includes('Failed to fetch dynamically imported module')) {
      console.error('Chunk load error detected:', event.message)
      
      // Track the error
      const monitor = getPerformanceMonitor()
      monitor.recordChunkLoad({
        chunkName: 'unknown',
        loadTime: 0,
        fromCache: false,
        retryCount: 1,
        timestamp: Date.now()
      })
      
      // Optionally reload the page
      if (confirm('Failed to load application resources. Would you like to reload the page?')) {
        window.location.reload()
      }
    }
  })
}

// Initialize monitoring
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Auto-log metrics every 30 seconds in development
  setInterval(() => {
    const monitor = getPerformanceMonitor()
    if (monitor) {
      monitor.logMetrics()
    }
  }, 30000)
  
  // Log metrics on page unload
  window.addEventListener('beforeunload', () => {
    const monitor = getPerformanceMonitor()
    if (monitor) {
      monitor.sendToAnalytics()
    }
  })
  
  // Detect chunk load errors
  detectChunkLoadErrors()
}