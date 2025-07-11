/**
 * Utilities for virtual scrolling performance optimization
 */

export interface SizeEstimationOptions {
  minSize?: number
  maxSize?: number
  averageSize?: number
  sampleSize?: number
}

/**
 * Estimate item sizes based on content characteristics
 */
export class SizeEstimator {
  private cache = new Map<string | number, number>()
  private samples: number[] = []
  private options: Required<SizeEstimationOptions>

  constructor(options: SizeEstimationOptions = {}) {
    this.options = {
      minSize: options.minSize ?? 50,
      maxSize: options.maxSize ?? 500,
      averageSize: options.averageSize ?? 100,
      sampleSize: options.sampleSize ?? 20
    }
  }

  /**
   * Record an actual measurement
   */
  recordMeasurement(key: string | number, size: number) {
    this.cache.set(key, size)
    
    // Update samples for better estimation
    this.samples.push(size)
    if (this.samples.length > this.options.sampleSize) {
      this.samples.shift()
    }
  }

  /**
   * Get estimated size for an item
   */
  estimateSize(key: string | number): number {
    // Return cached size if available
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached

    // Use average of samples if available
    if (this.samples.length > 0) {
      const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length
      return Math.max(this.options.minSize, Math.min(this.options.maxSize, avg))
    }

    // Fall back to configured average
    return this.options.averageSize
  }

  /**
   * Get average size from samples
   */
  getAverageSize(): number {
    if (this.samples.length === 0) return this.options.averageSize
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length
  }

  /**
   * Clear all cached measurements
   */
  clear() {
    this.cache.clear()
    this.samples = []
  }

  /**
   * Export cache for persistence
   */
  exportCache(): Record<string, number> {
    const obj: Record<string, number> = {}
    this.cache.forEach((value, key) => {
      obj[String(key)] = value
    })
    return obj
  }

  /**
   * Import cache from storage
   */
  importCache(cache: Record<string, number>) {
    Object.entries(cache).forEach(([key, value]) => {
      this.cache.set(key, value)
    })
  }
}

/**
 * Calculate optimal overscan based on viewport and performance
 */
export function calculateOverscan(options: {
  viewportSize: number
  itemSize: number
  scrollVelocity?: number
  devicePixelRatio?: number
  isTouch?: boolean
}): number {
  const {
    viewportSize,
    itemSize,
    scrollVelocity = 0,
    devicePixelRatio = window.devicePixelRatio || 1,
    isTouch = 'ontouchstart' in window
  } = options

  // Base overscan: ~1 viewport worth of items
  const itemsInViewport = Math.ceil(viewportSize / itemSize)
  let overscan = Math.ceil(itemsInViewport * 0.5)

  // Adjust for scroll velocity (fast scrolling needs more overscan)
  if (Math.abs(scrollVelocity) > 1000) {
    overscan = Math.ceil(overscan * 1.5)
  } else if (Math.abs(scrollVelocity) > 2000) {
    overscan = Math.ceil(overscan * 2)
  }

  // Adjust for device capabilities
  if (devicePixelRatio > 2) {
    // High DPI displays can handle more items
    overscan = Math.ceil(overscan * 1.2)
  }

  // Touch devices need more overscan for smooth scrolling
  if (isTouch) {
    overscan = Math.ceil(overscan * 1.3)
  }

  // Cap overscan to reasonable limits
  return Math.min(Math.max(overscan, 2), 10)
}

/**
 * Performance monitoring for virtual scrolling
 */
export class VirtualScrollPerformanceMonitor {
  private measurements: {
    timestamp: number
    fps: number
    renderTime: number
    scrollVelocity: number
    visibleItems: number
  }[] = []
  private lastScrollTime = 0
  private lastScrollPosition = 0
  private frameCount = 0
  private lastFrameTime = performance.now()
  private rafId?: number

  /**
   * Start monitoring performance
   */
  start(scrollElement: HTMLElement) {
    this.stop()
    
    // Monitor scroll velocity
    scrollElement.addEventListener('scroll', this.handleScroll)
    
    // Monitor frame rate
    const measureFrame = () => {
      const now = performance.now()
      const delta = now - this.lastFrameTime
      
      if (delta >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / delta)
        this.recordMeasurement({ fps })
        
        this.frameCount = 0
        this.lastFrameTime = now
      }
      
      this.frameCount++
      this.rafId = requestAnimationFrame(measureFrame)
    }
    
    this.rafId = requestAnimationFrame(measureFrame)
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = undefined
    }
  }

  /**
   * Handle scroll events
   */
  private handleScroll = (e: Event) => {
    const element = e.target as HTMLElement
    const now = performance.now()
    const scrollPosition = element.scrollTop
    const timeDelta = now - this.lastScrollTime
    
    if (timeDelta > 0) {
      const scrollVelocity = Math.abs(scrollPosition - this.lastScrollPosition) / timeDelta * 1000
      this.recordMeasurement({ scrollVelocity })
    }
    
    this.lastScrollTime = now
    this.lastScrollPosition = scrollPosition
  }

  /**
   * Record a measurement
   */
  private recordMeasurement(data: Partial<VirtualScrollPerformanceMonitor['measurements'][0]>) {
    this.measurements.push({
      timestamp: performance.now(),
      fps: 60,
      renderTime: 0,
      scrollVelocity: 0,
      visibleItems: 0,
      ...data
    })
    
    // Keep only last 100 measurements
    if (this.measurements.length > 100) {
      this.measurements.shift()
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    if (this.measurements.length === 0) {
      return {
        averageFps: 60,
        minFps: 60,
        maxFps: 60,
        averageScrollVelocity: 0,
        maxScrollVelocity: 0
      }
    }
    
    const fps = this.measurements.map(m => m.fps)
    const scrollVelocities = this.measurements.map(m => m.scrollVelocity)
    
    return {
      averageFps: Math.round(fps.reduce((a, b) => a + b, 0) / fps.length),
      minFps: Math.min(...fps),
      maxFps: Math.max(...fps),
      averageScrollVelocity: Math.round(scrollVelocities.reduce((a, b) => a + b, 0) / scrollVelocities.length),
      maxScrollVelocity: Math.round(Math.max(...scrollVelocities))
    }
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded(): boolean {
    const metrics = this.getMetrics()
    return metrics.averageFps < 30 || metrics.minFps < 20
  }
}

/**
 * Batch updates for better performance
 */
export class BatchUpdater {
  private pending = new Map<string, () => void>()
  private rafId?: number

  /**
   * Schedule an update
   */
  schedule(key: string, update: () => void) {
    this.pending.set(key, update)
    
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.flush()
      })
    }
  }

  /**
   * Execute all pending updates
   */
  flush() {
    const updates = Array.from(this.pending.values())
    this.pending.clear()
    this.rafId = undefined
    
    updates.forEach(update => update())
  }

  /**
   * Cancel all pending updates
   */
  cancel() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = undefined
    }
    this.pending.clear()
  }
}

/**
 * Debounced scroll handler for better performance
 */
export function createScrollHandler(
  callback: (e: Event) => void,
  delay = 150
): (e: Event) => void {
  let timeoutId: NodeJS.Timeout
  let lastCallTime = 0
  
  return (e: Event) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime
    
    clearTimeout(timeoutId)
    
    if (timeSinceLastCall >= delay) {
      lastCallTime = now
      callback(e)
    } else {
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now()
        callback(e)
      }, delay)
    }
  }
}

/**
 * Get optimal item height based on content type
 */
export function getOptimalItemHeight(contentType: 'text' | 'card' | 'table' | 'media'): number {
  const baseHeights = {
    text: 60,
    card: 200,
    table: 48,
    media: 300
  }
  
  // Adjust for device pixel ratio
  const dpr = window.devicePixelRatio || 1
  const multiplier = dpr > 1 ? 1.1 : 1
  
  return Math.round(baseHeights[contentType] * multiplier)
}

/**
 * Calculate visible range with buffer
 */
export function calculateVisibleRange(options: {
  scrollOffset: number
  viewportSize: number
  itemCount: number
  itemSize: number | ((index: number) => number)
  overscan?: number
}): { startIndex: number; endIndex: number } {
  const { scrollOffset, viewportSize, itemCount, itemSize, overscan = 3 } = options
  
  if (itemCount === 0) {
    return { startIndex: 0, endIndex: 0 }
  }
  
  // Fixed size calculation
  if (typeof itemSize === 'number') {
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemSize) - overscan)
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollOffset + viewportSize) / itemSize) + overscan
    )
    
    return { startIndex, endIndex }
  }
  
  // Variable size calculation
  let accumulatedSize = 0
  let startIndex = 0
  let endIndex = itemCount - 1
  
  // Find start index
  for (let i = 0; i < itemCount; i++) {
    const size = itemSize(i)
    if (accumulatedSize + size > scrollOffset - overscan * 100) {
      startIndex = Math.max(0, i - overscan)
      break
    }
    accumulatedSize += size
  }
  
  // Find end index
  accumulatedSize = 0
  for (let i = startIndex; i < itemCount; i++) {
    if (accumulatedSize > scrollOffset + viewportSize + overscan * 100) {
      endIndex = Math.min(itemCount - 1, i + overscan)
      break
    }
    accumulatedSize += itemSize(i)
  }
  
  return { startIndex, endIndex }
}