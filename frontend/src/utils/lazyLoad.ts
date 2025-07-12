import { lazy, ComponentType, LazyExoticComponent } from 'react'

// Cache for loaded components
const componentCache = new Map<string, ComponentType<any>>()
const loadingPromises = new Map<string, Promise<{ default: ComponentType<any> }>>()

// Configuration for lazy loading behavior
export interface LazyLoadConfig {
  maxRetries?: number
  retryDelay?: number
  onLoadStart?: (componentName: string) => void
  onLoadSuccess?: (componentName: string) => void
  onLoadError?: (componentName: string, error: Error, retryCount: number) => void
  preload?: boolean
  chunkName?: string
}

// Default configuration
const defaultConfig: Required<LazyLoadConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  onLoadStart: () => {},
  onLoadSuccess: () => {},
  onLoadError: (name, error) => {
    // Safe error logging to avoid object-to-string conversion issues
    try {
      const errorMessage = error?.message || (error && typeof error === 'object' ? JSON.stringify(error) : String(error))
      console.error(`Component load error for ${name}:`, errorMessage)
    } catch (e) {
      console.error(`Component load error for ${name}: [Error details unavailable]`)
    }
  },
  preload: false,
  chunkName: ''
}

// Error class for chunk load failures
export class ChunkLoadError extends Error {
  constructor(
    message: string,
    public readonly chunkName: string,
    public readonly retryCount: number,
    public readonly originalError: Error
  ) {
    super(message)
    this.name = 'ChunkLoadError'
  }
}

// Retry logic with exponential backoff
async function retryImport<T>(
  importFn: () => Promise<T>,
  componentName: string,
  config: Required<LazyLoadConfig>,
  retryCount = 0
): Promise<T> {
  try {
    return await importFn()
  } catch (error) {
    const err = error as Error
    
    // Check if it's a chunk load error (common in production)
    const isChunkLoadError = err.message.includes('Loading chunk') || 
                            err.message.includes('Failed to fetch') ||
                            err.name === 'ChunkLoadError'
    
    if (isChunkLoadError && retryCount < config.maxRetries) {
      config.onLoadError(componentName, err, retryCount)
      
      // Exponential backoff
      const delay = config.retryDelay * Math.pow(2, retryCount)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Retry the import
      return retryImport(importFn, componentName, config, retryCount + 1)
    }
    
    // Max retries reached or non-recoverable error
    throw new ChunkLoadError(
      `Failed to load component ${componentName} after ${retryCount} retries`,
      componentName,
      retryCount,
      err
    )
  }
}

// Enhanced lazy loading with retry and caching
export function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  config?: LazyLoadConfig
): LazyExoticComponent<T> {
  const finalConfig = { ...defaultConfig, ...config }
  
  // Create the lazy component with retry logic
  const LazyComponent = lazy(() => {
    // Check cache first
    if (componentCache.has(componentName)) {
      return Promise.resolve({ default: componentCache.get(componentName) as T })
    }
    
    // Check if already loading
    if (loadingPromises.has(componentName)) {
      return loadingPromises.get(componentName) as Promise<{ default: T }>
    }
    
    finalConfig.onLoadStart(componentName)
    
    // Create loading promise with retry logic
    const loadingPromise = retryImport(importFn, componentName, finalConfig)
      .then(module => {
        // Cache the component
        componentCache.set(componentName, module.default)
        loadingPromises.delete(componentName)
        finalConfig.onLoadSuccess(componentName)
        return module
      })
      .catch(error => {
        loadingPromises.delete(componentName)
        throw error
      })
    
    loadingPromises.set(componentName, loadingPromise)
    return loadingPromise
  })
  
  // Add preload method to the component
  ;(LazyComponent as any).preload = () => {
    if (!componentCache.has(componentName) && !loadingPromises.has(componentName)) {
      finalConfig.onLoadStart(componentName)
      
      const loadingPromise = retryImport(importFn, componentName, finalConfig)
        .then(module => {
          componentCache.set(componentName, module.default)
          loadingPromises.delete(componentName)
          finalConfig.onLoadSuccess(componentName)
          return module
        })
        .catch(error => {
          loadingPromises.delete(componentName)
          try {
            const errorMessage = error?.message || (error && typeof error === 'object' ? JSON.stringify(error) : String(error))
            console.error(`Failed to preload ${componentName}:`, errorMessage)
          } catch (e) {
            console.error(`Failed to preload ${componentName}: [Error details unavailable]`)
          }
          throw error
        })
      
      loadingPromises.set(componentName, loadingPromise)
      return loadingPromise
    }
    
    return loadingPromises.get(componentName) || Promise.resolve()
  }
  
  // Auto-preload if configured
  if (finalConfig.preload) {
    ;(LazyComponent as any).preload()
  }
  
  return LazyComponent
}

// Preload multiple components
export async function preloadComponents(
  components: Array<{ component: any; name: string }>
): Promise<void> {
  const promises = components
    .filter(({ component }) => typeof component.preload === 'function')
    .map(({ component, name }) => 
      component.preload().catch((error: Error) => {
        console.error(`Failed to preload ${name}:`, error)
      })
    )
  
  await Promise.all(promises)
}

// Preload component on interaction (hover, focus)
export function preloadOnInteraction(
  component: any,
  element: HTMLElement,
  events: string[] = ['mouseenter', 'focus']
): () => void {
  if (typeof component.preload !== 'function') {
    return () => {}
  }
  
  let preloaded = false
  
  const handleInteraction = () => {
    if (!preloaded) {
      preloaded = true
      component.preload()
    }
  }
  
  events.forEach(event => {
    element.addEventListener(event, handleInteraction, { passive: true })
  })
  
  // Return cleanup function
  return () => {
    events.forEach(event => {
      element.removeEventListener(event, handleInteraction)
    })
  }
}

// Clear component cache (useful for testing or memory management)
export function clearComponentCache(componentName?: string): void {
  if (componentName) {
    componentCache.delete(componentName)
    loadingPromises.delete(componentName)
  } else {
    componentCache.clear()
    loadingPromises.clear()
  }
}

// Get cache statistics
export function getCacheStats(): {
  cachedComponents: string[]
  loadingComponents: string[]
  cacheSize: number
} {
  return {
    cachedComponents: Array.from(componentCache.keys()),
    loadingComponents: Array.from(loadingPromises.keys()),
    cacheSize: componentCache.size
  }
}

// Network-aware loading configuration
export function getNetworkAwareConfig(): Partial<LazyLoadConfig> {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection
    
    // Check for slow connections
    if (connection?.effectiveType === '2g' || connection?.saveData) {
      return {
        maxRetries: 5,
        retryDelay: 2000,
        preload: false
      }
    }
    
    // Fast connections can be more aggressive
    if (connection?.effectiveType === '4g') {
      return {
        maxRetries: 2,
        retryDelay: 500,
        preload: true
      }
    }
  }
  
  return {}
}

// Helper to create lazy loaded routes with error boundaries
export function lazyRoute<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  routeName: string,
  config?: LazyLoadConfig
): LazyExoticComponent<T> {
  return lazyLoad(importFn, `Route:${routeName}`, {
    ...getNetworkAwareConfig(),
    ...config,
    onLoadError: (name, error, retryCount) => {
      try {
        const errorMessage = error?.message || (error && typeof error === 'object' ? JSON.stringify(error) : String(error))
        console.error(`Failed to load route ${name}:`, errorMessage)
      } catch (e) {
        console.error(`Failed to load route ${name}: [Error details unavailable]`)
      }
      
      // Report to error tracking service
      if (retryCount === (config?.maxRetries ?? defaultConfig.maxRetries)) {
        // Could integrate with error logging service here
        console.error('Max retries reached for route:', name)
      }
    }
  })
}