import React from 'react'
import { isEqual, throttle, debounce } from 'lodash'

/**
 * Performance optimization utilities for React components
 * Provides custom memo comparison functions, HOCs, and performance tracking
 */

// ===== CUSTOM MEMO COMPARISON FUNCTIONS =====

/**
 * Deep comparison function for React.memo
 * Use when props contain objects or arrays that might be recreated but have same values
 */
export const deepMemoCompare = <P extends Record<string, any>>(
  prevProps: Readonly<P>,
  nextProps: Readonly<P>
): boolean => {
  return isEqual(prevProps, nextProps)
}

/**
 * Shallow comparison with exclusion list
 * Use when certain props should not trigger re-renders
 */
export const shallowCompareExcept = <P extends Record<string, any>>(
  excludeKeys: (keyof P)[]
) => (prevProps: Readonly<P>, nextProps: Readonly<P>): boolean => {
  const keys = Object.keys(prevProps) as (keyof P)[]
  
  for (const key of keys) {
    if (excludeKeys.includes(key)) continue
    if (!Object.is(prevProps[key], nextProps[key])) {
      return false
    }
  }
  
  return true
}

/**
 * Comparison function that only checks specific props
 * Use when only certain props affect rendering
 */
export const compareOnly = <P extends Record<string, any>>(
  includeKeys: (keyof P)[]
) => (prevProps: Readonly<P>, nextProps: Readonly<P>): boolean => {
  for (const key of includeKeys) {
    if (!Object.is(prevProps[key], nextProps[key])) {
      return false
    }
  }
  
  return true
}

/**
 * Smart comparison that handles common patterns
 * - Functions are compared by reference
 * - Primitives use Object.is
 * - Objects/arrays use deep comparison
 */
export const smartMemoCompare = <P extends Record<string, any>>(
  prevProps: Readonly<P>,
  nextProps: Readonly<P>
): boolean => {
  const keys = Object.keys(prevProps) as (keyof P)[]
  
  for (const key of keys) {
    const prevValue = prevProps[key]
    const nextValue = nextProps[key]
    
    // Handle functions - compare by reference
    if (typeof prevValue === 'function' && typeof nextValue === 'function') {
      if (prevValue !== nextValue) return false
      continue
    }
    
    // Handle primitives
    if (
      typeof prevValue !== 'object' || 
      prevValue === null ||
      typeof nextValue !== 'object' ||
      nextValue === null
    ) {
      if (!Object.is(prevValue, nextValue)) return false
      continue
    }
    
    // Handle objects/arrays with deep comparison
    if (!isEqual(prevValue, nextValue)) return false
  }
  
  return true
}

// ===== HIGHER ORDER COMPONENTS =====

/**
 * HOC for automatic memoization with custom comparison
 */
export function withMemo<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prev: Readonly<P>, next: Readonly<P>) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  const displayName = Component.displayName || Component.name || 'Component'
  const MemoizedComponent = React.memo(Component, propsAreEqual)
  MemoizedComponent.displayName = `withMemo(${displayName})`
  return MemoizedComponent
}

/**
 * HOC that adds performance tracking to a component
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const name = componentName || Component.displayName || Component.name || 'Component'
  
  return React.forwardRef<any, P>((props, ref) => {
    const renderStartTime = React.useRef<number>()
    
    React.useEffect(() => {
      if (renderStartTime.current && process.env.NODE_ENV === 'development') {
        const renderTime = performance.now() - renderStartTime.current
        if (renderTime > 16) { // Log slow renders (> 16ms)
          console.warn(`[Performance] ${name} render took ${renderTime.toFixed(2)}ms`)
        }
      }
    })
    
    renderStartTime.current = performance.now()
    
    return <Component {...props} ref={ref} />
  }) as React.ComponentType<P>
}

/**
 * HOC that throttles prop updates
 */
export function withThrottledProps<P extends object>(
  Component: React.ComponentType<P>,
  throttleKeys: (keyof P)[],
  wait: number = 100
): React.ComponentType<P> {
  return React.forwardRef<any, P>((props, ref) => {
    const throttledProps = React.useRef<Partial<P>>({})
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0)
    
    // Create throttled update functions
    const throttledUpdates = React.useMemo(() => {
      const updates: Record<string, any> = {}
      
      throttleKeys.forEach(key => {
        updates[key as string] = throttle((value: any) => {
          throttledProps.current[key] = value
          forceUpdate()
        }, wait)
      })
      
      return updates
    }, [wait])
    
    // Update throttled props
    React.useEffect(() => {
      throttleKeys.forEach(key => {
        if (props[key] !== throttledProps.current[key]) {
          throttledUpdates[key as string](props[key])
        }
      })
    })
    
    // Merge props with throttled values
    const mergedProps = React.useMemo(() => ({
      ...props,
      ...throttledProps.current
    }), [props, throttledProps.current])
    
    return <Component {...mergedProps} ref={ref} />
  }) as React.ComponentType<P>
}

// ===== PERFORMANCE TRACKING UTILITIES =====

interface RenderMetrics {
  componentName: string
  renderCount: number
  totalRenderTime: number
  averageRenderTime: number
  slowRenders: number
  lastRenderTime: number
}

class PerformanceTracker {
  private metrics: Map<string, RenderMetrics> = new Map()
  
  recordRender(componentName: string, renderTime: number) {
    const existing = this.metrics.get(componentName) || {
      componentName,
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      slowRenders: 0,
      lastRenderTime: 0
    }
    
    existing.renderCount++
    existing.totalRenderTime += renderTime
    existing.averageRenderTime = existing.totalRenderTime / existing.renderCount
    existing.lastRenderTime = renderTime
    
    if (renderTime > 16) { // 16ms = 60fps threshold
      existing.slowRenders++
    }
    
    this.metrics.set(componentName, existing)
  }
  
  getMetrics(componentName?: string): RenderMetrics | RenderMetrics[] {
    if (componentName) {
      return this.metrics.get(componentName) || {
        componentName,
        renderCount: 0,
        totalRenderTime: 0,
        averageRenderTime: 0,
        slowRenders: 0,
        lastRenderTime: 0
      }
    }
    
    return Array.from(this.metrics.values())
  }
  
  logReport() {
    const metrics = this.getMetrics() as RenderMetrics[]
    const slowComponents = metrics
      .filter(m => m.slowRenders > 0)
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
    
    if (slowComponents.length > 0) {
      console.group('📊 Performance Report - Slow Components')
      console.table(slowComponents.map(m => ({
        Component: m.componentName,
        'Renders': m.renderCount,
        'Avg Time (ms)': m.averageRenderTime.toFixed(2),
        'Slow Renders': m.slowRenders,
        'Last Render (ms)': m.lastRenderTime.toFixed(2)
      })))
      console.groupEnd()
    }
  }
  
  reset() {
    this.metrics.clear()
  }
}

export const performanceTracker = new PerformanceTracker()

// ===== MEMOIZATION HELPERS =====

/**
 * Creates a memoized callback with dependency tracking
 */
export function createTrackedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  name?: string
): T {
  if (process.env.NODE_ENV === 'development' && name) {
    const prevDepsRef = React.useRef<React.DependencyList>()
    
    React.useEffect(() => {
      if (prevDepsRef.current) {
        const changedDeps = deps
          .map((dep, i) => dep !== prevDepsRef.current![i] ? i : -1)
          .filter(i => i >= 0)
        
        if (changedDeps.length > 0) {
          console.log(`[Callback Update] ${name} - Changed deps:`, changedDeps)
        }
      }
      prevDepsRef.current = deps
    })
  }
  
  return React.useCallback(callback, deps) as T
}

/**
 * Creates a stable object reference that only changes when values change
 */
export function useStableObject<T extends Record<string, any>>(obj: T): T {
  const ref = React.useRef<T>(obj)
  
  const isEqual = React.useMemo(() => {
    const keys = Object.keys(obj) as (keyof T)[]
    for (const key of keys) {
      if (!Object.is(obj[key], ref.current[key])) {
        return false
      }
    }
    return true
  }, [obj])
  
  if (!isEqual) {
    ref.current = obj
  }
  
  return ref.current
}

/**
 * Defers expensive computations until after render
 */
export function useDeferredComputation<T>(
  computation: () => T,
  deps: React.DependencyList
): T | undefined {
  const [result, setResult] = React.useState<T>()
  
  React.useEffect(() => {
    const id = requestIdleCallback(() => {
      setResult(computation())
    })
    
    return () => cancelIdleCallback(id)
  }, deps)
  
  return result
}

// ===== OPTIMIZATION GUIDELINES =====

/**
 * Guidelines for using React.memo effectively:
 * 
 * 1. When to use React.memo:
 *    - Components that receive complex props (objects, arrays)
 *    - Components that render frequently with same props
 *    - List items in large lists
 *    - Components with expensive render logic
 * 
 * 2. When NOT to use React.memo:
 *    - Components that rarely re-render
 *    - Components with mostly primitive props
 *    - Components that always receive new props
 *    - Simple components with cheap renders
 * 
 * 3. Best practices:
 *    - Use custom comparison functions for complex props
 *    - Memoize callbacks passed as props with useCallback
 *    - Memoize expensive computations with useMemo
 *    - Profile before and after optimization
 * 
 * 4. Common pitfalls:
 *    - Over-memoizing simple components
 *    - Forgetting to memoize callbacks/objects passed as props
 *    - Using inline objects/functions as props
 *    - Not considering the cost of comparison functions
 */

// Export optimization presets for common use cases
export const OptimizationPresets = {
  // For list items - shallow compare except handlers
  listItem: shallowCompareExcept(['onClick', 'onSelect', 'onDelete']),
  
  // For forms - only re-render on value/error changes
  formField: compareOnly(['value', 'error', 'disabled']),
  
  // For data displays - deep comparison
  dataDisplay: deepMemoCompare,
  
  // For interactive components - smart comparison
  interactive: smartMemoCompare
}