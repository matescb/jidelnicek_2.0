import React from 'react'
import { matchPath } from 'react-router-dom'
import { preloadComponents, preloadOnInteraction } from './lazyLoad'

// Route metadata for preloading
export interface RouteMetadata {
  path: string
  component: any
  preloadPriority?: 'high' | 'medium' | 'low'
  preloadOn?: 'hover' | 'visible' | 'idle' | 'immediate'
  dependencies?: string[] // Other routes that should be preloaded with this one
}

// Preloader configuration
export interface PreloaderConfig {
  enablePredictivePreloading?: boolean
  maxConcurrentPreloads?: number
  idleTimeout?: number
  intersectionObserverOptions?: IntersectionObserverInit
}

// Default configuration
const defaultConfig: Required<PreloaderConfig> = {
  enablePredictivePreloading: true,
  maxConcurrentPreloads: 2,
  idleTimeout: 2000,
  intersectionObserverOptions: {
    rootMargin: '50px',
    threshold: 0.1
  }
}

// Track user navigation patterns for predictive preloading
class NavigationTracker {
  private patterns: Map<string, Map<string, number>> = new Map()
  private history: string[] = []
  private maxHistorySize = 50
  
  recordNavigation(from: string, to: string): void {
    // Update patterns
    if (!this.patterns.has(from)) {
      this.patterns.set(from, new Map())
    }
    
    const fromPatterns = this.patterns.get(from)!
    fromPatterns.set(to, (fromPatterns.get(to) || 0) + 1)
    
    // Update history
    this.history.push(to)
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }
  }
  
  getPredictedRoutes(currentRoute: string, limit = 3): string[] {
    const fromPatterns = this.patterns.get(currentRoute)
    if (!fromPatterns) return []
    
    // Sort by frequency
    return Array.from(fromPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([route]) => route)
  }
  
  getMostVisitedRoutes(limit = 5): string[] {
    const frequency = new Map<string, number>()
    
    this.history.forEach(route => {
      frequency.set(route, (frequency.get(route) || 0) + 1)
    })
    
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([route]) => route)
  }
}

// Main route preloader class
export class RoutePreloader {
  private config: Required<PreloaderConfig>
  private routes: Map<string, RouteMetadata> = new Map()
  private preloadQueue: Set<string> = new Set()
  private activePreloads: Set<string> = new Set()
  private navigationTracker = new NavigationTracker()
  private intersectionObserver?: IntersectionObserver
  private idleCallbackId?: number
  
  constructor(
    routes: RouteMetadata[],
    config?: PreloaderConfig
  ) {
    this.config = { ...defaultConfig, ...config }
    
    // Index routes by path
    routes.forEach(route => {
      this.routes.set(route.path, route)
    })
    
    // Set up intersection observer for visible preloading
    if ('IntersectionObserver' in window) {
      this.setupIntersectionObserver()
    }
    
    // Set up idle preloading
    if ('requestIdleCallback' in window) {
      this.setupIdlePreloading()
    }
    
    // Preload immediate routes
    this.preloadImmediateRoutes()
  }
  
  // Register a route for preloading
  registerRoute(route: RouteMetadata): void {
    this.routes.set(route.path, route)
    
    if (route.preloadOn === 'immediate') {
      this.preloadRoute(route.path)
    }
  }
  
  // Preload a specific route
  async preloadRoute(path: string): Promise<void> {
    const route = this.routes.get(path)
    if (!route || !route.component?.preload) return
    
    // Check if already preloading or in queue
    if (this.activePreloads.has(path) || this.preloadQueue.has(path)) {
      return
    }
    
    // Add to queue if at capacity
    if (this.activePreloads.size >= this.config.maxConcurrentPreloads) {
      this.preloadQueue.add(path)
      return
    }
    
    // Start preloading
    this.activePreloads.add(path)
    
    try {
      await route.component.preload()
      
      // Preload dependencies
      if (route.dependencies) {
        await Promise.all(
          route.dependencies.map(dep => this.preloadRoute(dep))
        )
      }
    } catch (error) {
      console.error(`Failed to preload route ${path}:`, error)
    } finally {
      this.activePreloads.delete(path)
      this.processQueue()
    }
  }
  
  // Process preload queue
  private processQueue(): void {
    if (this.preloadQueue.size === 0) return
    
    const availableSlots = this.config.maxConcurrentPreloads - this.activePreloads.size
    const toPreload = Array.from(this.preloadQueue).slice(0, availableSlots)
    
    toPreload.forEach(path => {
      this.preloadQueue.delete(path)
      this.preloadRoute(path)
    })
  }
  
  // Set up intersection observer for visible preloading
  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const path = entry.target.getAttribute('data-preload-route')
            if (path) {
              this.preloadRoute(path)
            }
          }
        })
      },
      this.config.intersectionObserverOptions
    )
  }
  
  // Observe an element for preloading
  observeElement(element: HTMLElement, path: string): void {
    if (!this.intersectionObserver) return
    
    element.setAttribute('data-preload-route', path)
    this.intersectionObserver.observe(element)
  }
  
  // Set up idle preloading
  private setupIdlePreloading(): void {
    const scheduleIdlePreload = () => {
      this.idleCallbackId = (window as any).requestIdleCallback(
        () => {
          this.preloadIdleRoutes()
          scheduleIdlePreload()
        },
        { timeout: this.config.idleTimeout }
      )
    }
    
    scheduleIdlePreload()
  }
  
  // Preload routes during idle time
  private preloadIdleRoutes(): void {
    // Get routes to preload based on priority and patterns
    const routesToPreload = this.getIdlePreloadCandidates()
    
    routesToPreload.forEach(path => {
      if (this.activePreloads.size < this.config.maxConcurrentPreloads) {
        this.preloadRoute(path)
      }
    })
  }
  
  // Get candidates for idle preloading
  private getIdlePreloadCandidates(): string[] {
    const candidates: string[] = []
    
    // Add high priority routes
    this.routes.forEach((route, path) => {
      if (route.preloadPriority === 'high' && route.preloadOn === 'idle') {
        candidates.push(path)
      }
    })
    
    // Add predicted routes if enabled
    if (this.config.enablePredictivePreloading) {
      const currentPath = window.location.pathname
      const predicted = this.navigationTracker.getPredictedRoutes(currentPath)
      candidates.push(...predicted)
    }
    
    // Add most visited routes
    const mostVisited = this.navigationTracker.getMostVisitedRoutes()
    candidates.push(...mostVisited)
    
    // Remove duplicates and already loaded routes
    return [...new Set(candidates)].filter(path => {
      const route = this.routes.get(path)
      return route && !this.activePreloads.has(path)
    })
  }
  
  // Preload immediate routes
  private preloadImmediateRoutes(): void {
    this.routes.forEach((route, path) => {
      if (route.preloadOn === 'immediate') {
        this.preloadRoute(path)
      }
    })
  }
  
  // Record navigation for predictive preloading
  recordNavigation(from: string, to: string): void {
    this.navigationTracker.recordNavigation(from, to)
    
    // Preload predicted next routes
    if (this.config.enablePredictivePreloading) {
      const predicted = this.navigationTracker.getPredictedRoutes(to, 2)
      predicted.forEach(path => this.preloadRoute(path))
    }
  }
  
  // Set up hover preloading for a link
  setupLinkPreloading(
    element: HTMLElement,
    path: string,
    events: string[] = ['mouseenter', 'focus']
  ): () => void {
    const route = this.routes.get(path)
    if (!route || route.preloadOn !== 'hover') {
      return () => {}
    }
    
    return preloadOnInteraction(route.component, element, events)
  }
  
  // Network-aware preloading
  shouldPreload(): boolean {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      
      // Don't preload on slow connections or data saver mode
      if (connection?.effectiveType === '2g' || 
          connection?.effectiveType === 'slow-2g' ||
          connection?.saveData) {
        return false
      }
    }
    
    return true
  }
  
  // Clean up
  destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
    }
    
    if (this.idleCallbackId) {
      (window as any).cancelIdleCallback(this.idleCallbackId)
    }
    
    this.preloadQueue.clear()
    this.activePreloads.clear()
  }
  
  // Get preloader statistics
  getStats(): {
    totalRoutes: number
    activePreloads: string[]
    queuedPreloads: string[]
    predictedRoutes: string[]
  } {
    return {
      totalRoutes: this.routes.size,
      activePreloads: Array.from(this.activePreloads),
      queuedPreloads: Array.from(this.preloadQueue),
      predictedRoutes: this.navigationTracker.getPredictedRoutes(
        window.location.pathname
      )
    }
  }
}

// React hook for route preloading
export function useRoutePreloader(
  routes: RouteMetadata[],
  config?: PreloaderConfig
): RoutePreloader {
  const [preloader] = React.useState(() => new RoutePreloader(routes, config))
  
  React.useEffect(() => {
    return () => preloader.destroy()
  }, [preloader])
  
  return preloader
}

// HOC for adding preload capabilities to route components
export function withRoutePreloading<P extends object>(
  Component: React.ComponentType<P>,
  metadata: Omit<RouteMetadata, 'component'>
) {
  const PreloadableComponent = React.forwardRef<any, P>((props, ref) => {
    return <Component {...props} ref={ref} />
  })
  
  // Add preload method
  ;(PreloadableComponent as any).preload = (Component as any).preload
  ;(PreloadableComponent as any).routeMetadata = metadata
  
  PreloadableComponent.displayName = `withRoutePreloading(${
    Component.displayName || Component.name
  })`
  
  return PreloadableComponent
}