// Web Vitals and Performance Monitoring Utilities

import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB, Metric } from 'web-vitals'

// Performance metric types
export interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  entries: PerformanceEntry[]
}

export interface WebVitalsMetrics {
  lcp?: PerformanceMetric // Largest Contentful Paint
  fid?: PerformanceMetric // First Input Delay
  cls?: PerformanceMetric // Cumulative Layout Shift
  fcp?: PerformanceMetric // First Contentful Paint
  ttfb?: PerformanceMetric // Time to First Byte
  inp?: PerformanceMetric // Interaction to Next Paint
}

export interface CustomMetrics {
  [key: string]: {
    startTime: number
    endTime?: number
    duration?: number
    metadata?: Record<string, any>
  }
}

export interface ResourceMetrics {
  name: string
  type: string
  size: number
  duration: number
  transferSize: number
  cached: boolean
  protocol: string
}

// Performance monitoring class
class PerformanceMonitoring {
  private webVitals: WebVitalsMetrics = {}
  private customMetrics: CustomMetrics = {}
  private resourceMetrics: ResourceMetrics[] = []
  private reportCallback?: (metrics: any) => void
  private buffer: any[] = []
  private bufferSize = 100
  private analyticsEndpoint?: string

  constructor(config?: {
    reportCallback?: (metrics: any) => void
    bufferSize?: number
    analyticsEndpoint?: string
  }) {
    this.reportCallback = config?.reportCallback
    this.bufferSize = config?.bufferSize || 100
    this.analyticsEndpoint = config?.analyticsEndpoint
    
    this.initializeWebVitals()
    this.setupPerformanceObserver()
    this.setupNavigationTiming()
    this.setupResourceTiming()
  }

  // Initialize Web Vitals monitoring
  private initializeWebVitals() {
    onLCP(this.handleWebVital('lcp'))
    onFID(this.handleWebVital('fid'))
    onCLS(this.handleWebVital('cls'))
    onFCP(this.handleWebVital('fcp'))
    onTTFB(this.handleWebVital('ttfb'))
    onINP(this.handleWebVital('inp'))
  }

  // Handle Web Vital metric
  private handleWebVital = (metricName: keyof WebVitalsMetrics) => (metric: Metric) => {
    const rating = this.getRating(metric.name, metric.value)
    
    this.webVitals[metricName] = {
      name: metric.name,
      value: metric.value,
      rating,
      delta: metric.delta,
      entries: metric.entries,
    }

    this.log(`Web Vital: ${metric.name}`, {
      value: metric.value,
      rating,
      delta: metric.delta,
    })

    this.reportMetric({
      type: 'webvital',
      name: metric.name,
      value: metric.value,
      rating,
      timestamp: Date.now(),
    })
  }

  // Get rating for Web Vital
  private getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds: Record<string, [number, number]> = {
      LCP: [2500, 4000],
      FID: [100, 300],
      CLS: [0.1, 0.25],
      FCP: [1800, 3000],
      TTFB: [800, 1800],
      INP: [200, 500],
    }

    const [good, poor] = thresholds[name] || [0, 0]
    
    if (value <= good) return 'good'
    if (value <= poor) return 'needs-improvement'
    return 'poor'
  }

  // Setup Performance Observer
  private setupPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return

    // Long Task Observer
    this.observeLongTasks()

    // Layout Shift Observer
    this.observeLayoutShifts()

    // Element Timing Observer
    this.observeElementTiming()

    // Event Timing Observer
    this.observeEventTiming()
  }

  // Observe long tasks
  private observeLongTasks() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            this.reportMetric({
              type: 'longtask',
              name: 'long-task',
              duration: entry.duration,
              startTime: entry.startTime,
              timestamp: Date.now(),
            })
          }
        }
      })
      observer.observe({ entryTypes: ['longtask'] })
    } catch (e) {
      // Long task observer not supported
    }
  }

  // Observe layout shifts
  private observeLayoutShifts() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as any
          if (!layoutShift.hadRecentInput) {
            this.reportMetric({
              type: 'layout-shift',
              value: layoutShift.value,
              sources: layoutShift.sources,
              timestamp: Date.now(),
            })
          }
        }
      })
      observer.observe({ entryTypes: ['layout-shift'] })
    } catch (e) {
      // Layout shift observer not supported
    }
  }

  // Observe element timing
  private observeElementTiming() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.reportMetric({
            type: 'element',
            name: entry.name,
            renderTime: (entry as any).renderTime,
            loadTime: (entry as any).loadTime,
            size: (entry as any).size,
            timestamp: Date.now(),
          })
        }
      })
      observer.observe({ entryTypes: ['element'] })
    } catch (e) {
      // Element timing observer not supported
    }
  }

  // Observe event timing
  private observeEventTiming() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const eventTiming = entry as any
          if (eventTiming.duration > 100) {
            this.reportMetric({
              type: 'event',
              name: eventTiming.name,
              duration: eventTiming.duration,
              processingStart: eventTiming.processingStart,
              processingEnd: eventTiming.processingEnd,
              timestamp: Date.now(),
            })
          }
        }
      })
      observer.observe({ entryTypes: ['event'] })
    } catch (e) {
      // Event timing observer not supported
    }
  }

  // Setup navigation timing
  private setupNavigationTiming() {
    if (!('performance' in window)) return

    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (!navigation) return

        const metrics = {
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ssl: navigation.secureConnectionStart > 0
            ? navigation.connectEnd - navigation.secureConnectionStart
            : 0,
          ttfb: navigation.responseStart - navigation.requestStart,
          download: navigation.responseEnd - navigation.responseStart,
          domInteractive: navigation.domInteractive - navigation.fetchStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          load: navigation.loadEventEnd - navigation.fetchStart,
        }

        this.reportMetric({
          type: 'navigation',
          metrics,
          timestamp: Date.now(),
        })
      }, 0)
    })
  }

  // Setup resource timing
  private setupResourceTiming() {
    if (!('PerformanceObserver' in window)) return

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming
        
        const metric: ResourceMetrics = {
          name: resource.name,
          type: this.getResourceType(resource.name),
          size: resource.encodedBodySize,
          duration: resource.duration,
          transferSize: resource.transferSize,
          cached: resource.transferSize === 0 && resource.encodedBodySize > 0,
          protocol: resource.nextHopProtocol,
        }

        this.resourceMetrics.push(metric)

        if (metric.duration > 1000) {
          this.reportMetric({
            type: 'slow-resource',
            ...metric,
            timestamp: Date.now(),
          })
        }
      }
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  // Get resource type from URL
  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase() || ''
    
    if (['js', 'mjs'].includes(extension)) return 'script'
    if (['css'].includes(extension)) return 'style'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(extension)) return 'image'
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension)) return 'font'
    if (url.includes('/api/')) return 'api'
    
    return 'other'
  }

  // Custom performance marks
  mark(name: string, metadata?: Record<string, any>) {
    performance.mark(name)
    
    this.customMetrics[name] = {
      startTime: performance.now(),
      metadata,
    }
  }

  // Custom performance measures
  measure(name: string, startMark?: string, endMark?: string) {
    if (startMark && endMark) {
      performance.measure(name, startMark, endMark)
    } else if (startMark) {
      performance.measure(name, startMark)
    } else if (this.customMetrics[name]) {
      const endTime = performance.now()
      const duration = endTime - this.customMetrics[name].startTime
      
      this.customMetrics[name].endTime = endTime
      this.customMetrics[name].duration = duration

      this.reportMetric({
        type: 'custom',
        name,
        duration,
        metadata: this.customMetrics[name].metadata,
        timestamp: Date.now(),
      })
    }

    const measure = performance.getEntriesByName(name, 'measure')[0]
    if (measure) {
      return measure.duration
    }
  }

  // Component render tracking
  trackComponentRender(componentName: string, props?: Record<string, any>) {
    const markName = `${componentName}-render-${Date.now()}`
    
    return {
      start: () => this.mark(markName, { componentName, props }),
      end: () => {
        const duration = this.measure(markName)
        this.reportMetric({
          type: 'component-render',
          componentName,
          duration,
          props,
          timestamp: Date.now(),
        })
        return duration
      },
    }
  }

  // API call tracking
  trackApiCall(url: string, method: string) {
    const markName = `api-${method}-${url}-${Date.now()}`
    
    return {
      start: () => this.mark(markName, { url, method }),
      end: (status?: number, size?: number) => {
        const duration = this.measure(markName)
        this.reportMetric({
          type: 'api-call',
          url,
          method,
          duration,
          status,
          size,
          timestamp: Date.now(),
        })
        return duration
      },
    }
  }

  // Route change tracking
  trackRouteChange(from: string, to: string) {
    const markName = `route-change-${Date.now()}`
    
    this.mark(markName, { from, to })
    
    return () => {
      const duration = this.measure(markName)
      this.reportMetric({
        type: 'route-change',
        from,
        to,
        duration,
        timestamp: Date.now(),
      })
    }
  }

  // Log performance data
  private log(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${message}`, data)
    }
  }

  // Report metric
  private reportMetric(metric: any) {
    // Add to buffer
    this.buffer.push(metric)
    
    // Send immediately if callback provided
    if (this.reportCallback) {
      this.reportCallback(metric)
    }

    // Flush buffer if full
    if (this.buffer.length >= this.bufferSize) {
      this.flush()
    }
  }

  // Flush metrics buffer
  flush() {
    if (this.buffer.length === 0) return

    const metrics = [...this.buffer]
    this.buffer = []

    // Send to analytics endpoint if configured
    if (this.analyticsEndpoint) {
      this.sendToAnalytics(metrics)
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.table(metrics)
    }
  }

  // Send metrics to analytics
  private async sendToAnalytics(metrics: any[]) {
    try {
      await fetch(this.analyticsEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: Date.now(),
        }),
      })
    } catch (error) {
      console.error('Failed to send performance metrics:', error)
    }
  }

  // Get current metrics
  getMetrics() {
    return {
      webVitals: this.webVitals,
      customMetrics: this.customMetrics,
      resourceMetrics: this.resourceMetrics,
      buffer: this.buffer,
    }
  }

  // Get summary
  getSummary() {
    const { webVitals, resourceMetrics } = this.getMetrics()
    
    // Resource summary
    const resourceSummary = resourceMetrics.reduce(
      (acc, resource) => {
        acc[resource.type] = acc[resource.type] || { count: 0, totalSize: 0, totalDuration: 0 }
        acc[resource.type].count++
        acc[resource.type].totalSize += resource.size
        acc[resource.type].totalDuration += resource.duration
        return acc
      },
      {} as Record<string, { count: number; totalSize: number; totalDuration: number }>
    )

    return {
      webVitals,
      resources: resourceSummary,
      totalResources: resourceMetrics.length,
      cachedResources: resourceMetrics.filter(r => r.cached).length,
      slowResources: resourceMetrics.filter(r => r.duration > 1000).length,
    }
  }

  // Clear metrics
  clear() {
    this.webVitals = {}
    this.customMetrics = {}
    this.resourceMetrics = []
    this.buffer = []
  }
}

// Global instance
let performanceMonitor: PerformanceMonitoring | null = null

// Initialize performance monitoring
export function initializePerformanceMonitoring(config?: {
  reportCallback?: (metrics: any) => void
  bufferSize?: number
  analyticsEndpoint?: string
}) {
  if (!performanceMonitor && typeof window !== 'undefined') {
    performanceMonitor = new PerformanceMonitoring(config)
    
    // Report metrics on page unload
    window.addEventListener('beforeunload', () => {
      performanceMonitor?.flush()
    })

    // Report metrics periodically
    setInterval(() => {
      performanceMonitor?.flush()
    }, 30000) // Every 30 seconds
  }
  
  return performanceMonitor
}

// Get performance monitor instance
export function getPerformanceMonitor(): PerformanceMonitoring | null {
  return performanceMonitor
}

// React hook for performance monitoring
import { useEffect, useRef } from 'react'

export function usePerformanceTracking(componentName: string, props?: Record<string, any>) {
  const renderTracker = useRef<ReturnType<PerformanceMonitoring['trackComponentRender']>>()
  
  useEffect(() => {
    const monitor = getPerformanceMonitor()
    if (!monitor) return
    
    renderTracker.current = monitor.trackComponentRender(componentName, props)
    renderTracker.current.start()
    
    return () => {
      renderTracker.current?.end()
    }
  }, [componentName, props])
}

// Route change hook
export function useRouteTracking(currentRoute: string) {
  const previousRoute = useRef(currentRoute)
  
  useEffect(() => {
    const monitor = getPerformanceMonitor()
    if (!monitor || previousRoute.current === currentRoute) return
    
    const endTracking = monitor.trackRouteChange(previousRoute.current, currentRoute)
    previousRoute.current = currentRoute
    
    // End tracking after route change completes
    requestAnimationFrame(() => {
      endTracking()
    })
  }, [currentRoute])
}

// API tracking wrapper
export function trackApiCall<T>(
  url: string,
  method: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const monitor = getPerformanceMonitor()
  if (!monitor) return apiCall()
  
  const tracker = monitor.trackApiCall(url, method)
  tracker.start()
  
  return apiCall()
    .then((response) => {
      tracker.end(200, JSON.stringify(response).length)
      return response
    })
    .catch((error) => {
      tracker.end(error.status || 500)
      throw error
    })
}

// Export types
export type { Metric } from 'web-vitals'