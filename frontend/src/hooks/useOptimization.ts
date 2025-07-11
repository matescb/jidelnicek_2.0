import { useCallback, useEffect, useRef, useState, useMemo, DependencyList } from 'react'
import { isEqual, debounce, throttle } from 'lodash'

/**
 * Custom hooks for React performance optimization
 */

// ===== MEMOIZATION HOOKS =====

/**
 * Enhanced useCallback with dependency tracking in development
 * Helps identify which dependencies are causing callback recreation
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList,
  debugName?: string
): T {
  const prevDepsRef = useRef<DependencyList>()
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && debugName && prevDepsRef.current) {
      const changedIndices: number[] = []
      deps.forEach((dep, index) => {
        if (!Object.is(dep, prevDepsRef.current![index])) {
          changedIndices.push(index)
        }
      })
      
      if (changedIndices.length > 0) {
        console.log(
          `[useMemoizedCallback] ${debugName} - Dependencies changed at indices:`,
          changedIndices,
          {
            prev: prevDepsRef.current,
            next: deps,
            changed: changedIndices.map(i => ({
              index: i,
              prev: prevDepsRef.current![i],
              next: deps[i]
            }))
          }
        )
      }
    }
    prevDepsRef.current = deps
  })
  
  return useCallback(callback, deps) as T
}

/**
 * Deep comparison memo hook for complex objects/arrays
 * Only triggers update when deep equality check fails
 */
export function useDeepCompareMemo<T>(
  factory: () => T,
  deps: DependencyList
): T {
  const ref = useRef<{ deps: DependencyList; value: T }>()
  
  if (!ref.current || !isEqual(deps, ref.current.deps)) {
    ref.current = {
      deps,
      value: factory()
    }
  }
  
  return ref.current.value
}

/**
 * Deep comparison effect hook
 * Only runs effect when dependencies deeply change
 */
export function useDeepCompareEffect(
  effect: React.EffectCallback,
  deps: DependencyList
): void {
  const ref = useRef<DependencyList>()
  
  if (!isEqual(deps, ref.current)) {
    ref.current = deps
  }
  
  useEffect(effect, [ref.current])
}

// ===== DEBOUNCE & THROTTLE HOOKS =====

/**
 * Debounce hook with value tracking
 * Returns both immediate and debounced values
 */
export function useDebounce<T>(
  value: T,
  delay: number,
  options?: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  }
): [T, T, boolean] {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const [isPending, setIsPending] = useState(false)
  
  const debouncedUpdate = useMemo(
    () => debounce(
      (newValue: T) => {
        setDebouncedValue(newValue)
        setIsPending(false)
      },
      delay,
      options
    ),
    [delay, options?.leading, options?.trailing, options?.maxWait]
  )
  
  useEffect(() => {
    setIsPending(true)
    debouncedUpdate(value)
    
    return () => {
      debouncedUpdate.cancel()
      setIsPending(false)
    }
  }, [value, debouncedUpdate])
  
  return [value, debouncedValue, isPending]
}

/**
 * Throttle hook for rate-limiting updates
 */
export function useThrottle<T>(
  value: T,
  delay: number,
  options?: {
    leading?: boolean
    trailing?: boolean
  }
): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  
  const throttledUpdate = useMemo(
    () => throttle(
      (newValue: T) => setThrottledValue(newValue),
      delay,
      options
    ),
    [delay, options?.leading, options?.trailing]
  )
  
  useEffect(() => {
    throttledUpdate(value)
    return () => throttledUpdate.cancel()
  }, [value, throttledUpdate])
  
  return throttledValue
}

// ===== DEBUG & ANALYSIS HOOKS =====

/**
 * Debug hook to track why a component re-rendered
 * Logs which props changed between renders
 */
export function useWhyDidYouUpdate<P extends Record<string, any>>(
  name: string,
  props: P
): void {
  const previousProps = useRef<P>()
  
  useEffect(() => {
    if (previousProps.current && process.env.NODE_ENV === 'development') {
      const allKeys = Object.keys({ ...previousProps.current, ...props })
      const changedProps: Record<string, { from: any; to: any }> = {}
      
      allKeys.forEach(key => {
        if (!Object.is(previousProps.current![key], props[key])) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key]
          }
        }
      })
      
      if (Object.keys(changedProps).length > 0) {
        console.group(`[WhyDidYouUpdate] ${name}`)
        console.log('Changed props:', changedProps)
        console.log('All props:', props)
        console.groupEnd()
      }
    }
    
    previousProps.current = props
  })
}

/**
 * Track render count and performance
 */
export function useRenderTracking(componentName: string): {
  renderCount: number
  renderTime: number
  averageRenderTime: number
} {
  const renderCount = useRef(0)
  const totalRenderTime = useRef(0)
  const renderStartTime = useRef<number>()
  
  // Track render start
  renderStartTime.current = performance.now()
  
  useEffect(() => {
    renderCount.current++
    
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current
      totalRenderTime.current += renderTime
      
      if (process.env.NODE_ENV === 'development' && renderTime > 16) {
        console.warn(
          `[RenderTracking] ${componentName} slow render: ${renderTime.toFixed(2)}ms`
        )
      }
    }
  })
  
  return {
    renderCount: renderCount.current,
    renderTime: renderStartTime.current ? performance.now() - renderStartTime.current : 0,
    averageRenderTime: renderCount.current > 0 
      ? totalRenderTime.current / renderCount.current 
      : 0
  }
}

// ===== OPTIMIZATION HOOKS =====

/**
 * Lazy initial state with caching
 * Prevents expensive computations on every render
 */
export function useLazyInitialState<T>(
  factory: () => T,
  deps: DependencyList = []
): T {
  const [state] = useState(() => factory())
  const depsRef = useRef(deps)
  
  if (!isEqual(deps, depsRef.current)) {
    depsRef.current = deps
    return factory()
  }
  
  return state
}

/**
 * Stable callback that maintains reference but updates implementation
 * Useful for callbacks passed to memoized child components
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const ref = useRef<T>(callback)
  
  useEffect(() => {
    ref.current = callback
  })
  
  return useCallback((...args: Parameters<T>) => {
    return ref.current(...args)
  }, []) as T
}

/**
 * Deferred value hook for non-critical updates
 * Similar to React 18's useDeferredValue but with custom delay
 */
export function useDeferredValue<T>(
  value: T,
  delay: number = 200
): T {
  const [deferredValue, setDeferredValue] = useState(value)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDeferredValue(value)
    }, delay)
    
    return () => clearTimeout(timer)
  }, [value, delay])
  
  return deferredValue
}

/**
 * Progressive enhancement hook
 * Delays expensive features until after initial render
 */
export function useProgressiveEnhancement(
  delay: number = 100
): boolean {
  const [isEnhanced, setIsEnhanced] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEnhanced(true)
    }, delay)
    
    return () => clearTimeout(timer)
  }, [delay])
  
  return isEnhanced
}

/**
 * Intersection observer hook for lazy loading
 */
export function useLazyLoad<T extends HTMLElement>(
  options?: IntersectionObserverInit
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  
  useEffect(() => {
    const element = ref.current
    if (!element) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true)
          observer.disconnect()
        }
      },
      options
    )
    
    observer.observe(element)
    
    return () => observer.disconnect()
  }, [options])
  
  return [ref, isIntersecting]
}

/**
 * Virtual scrolling helper hook
 */
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3
}: {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
}): {
  visibleItems: T[]
  totalHeight: number
  offsetY: number
  startIndex: number
  endIndex: number
} {
  const [scrollTop, setScrollTop] = useState(0)
  
  const { visibleItems, totalHeight, offsetY, startIndex, endIndex } = useMemo(() => {
    const totalHeight = items.length * itemHeight
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return {
      visibleItems: items.slice(startIndex, endIndex + 1),
      totalHeight,
      offsetY: startIndex * itemHeight,
      startIndex,
      endIndex
    }
  }, [items, itemHeight, containerHeight, scrollTop, overscan])
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    handleScroll
  }
}