import React, { memo, useState, useEffect, Suspense } from 'react'
import { useProgressiveEnhancement, useDeferredValue } from '@/hooks/useOptimization'

/**
 * Component that defers rendering of expensive children
 * Useful for improving initial page load and Time to Interactive
 */

interface DeferredComponentProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  delay?: number
  threshold?: 'immediate' | 'idle' | 'visible' | 'interaction'
  onDeferred?: () => void
  priority?: 'high' | 'normal' | 'low'
  className?: string
}

// Priority to delay mapping
const PRIORITY_DELAYS = {
  high: 0,
  normal: 100,
  low: 300
}

// Loading skeleton component
const DeferredSkeleton = memo(({ className }: { className?: string }) => (
  <div className={`animate-pulse ${className}`}>
    <div className="bg-gray-200 dark:bg-gray-700 rounded h-4 w-3/4 mb-2" />
    <div className="bg-gray-200 dark:bg-gray-700 rounded h-4 w-1/2" />
  </div>
))

// Main deferred component
const DeferredComponentBase: React.FC<DeferredComponentProps> = ({
  children,
  fallback,
  delay,
  threshold = 'idle',
  onDeferred,
  priority = 'normal',
  className
}) => {
  const [shouldRender, setShouldRender] = useState(threshold === 'immediate')
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = React.useRef<HTMLDivElement>(null)
  
  // Use progressive enhancement for automatic deferral
  const isEnhanced = useProgressiveEnhancement(
    delay ?? PRIORITY_DELAYS[priority]
  )
  
  // Handle different threshold types
  useEffect(() => {
    if (threshold === 'immediate') {
      setShouldRender(true)
      return
    }
    
    if (threshold === 'idle') {
      // Use requestIdleCallback if available
      if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(
          () => {
            setShouldRender(true)
            onDeferred?.()
          },
          { timeout: delay ?? PRIORITY_DELAYS[priority] }
        )
        return () => cancelIdleCallback(id)
      } else {
        // Fallback to setTimeout
        const timer = setTimeout(() => {
          setShouldRender(true)
          onDeferred?.()
        }, delay ?? PRIORITY_DELAYS[priority])
        return () => clearTimeout(timer)
      }
    }
    
    if (threshold === 'visible') {
      // Use Intersection Observer
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        },
        { rootMargin: '50px' }
      )
      
      if (elementRef.current) {
        observer.observe(elementRef.current)
      }
      
      return () => observer.disconnect()
    }
    
    if (threshold === 'interaction') {
      // Wait for user interaction
      const handleInteraction = () => {
        setShouldRender(true)
        onDeferred?.()
      }
      
      const events = ['click', 'touchstart', 'keydown', 'scroll']
      events.forEach(event => {
        window.addEventListener(event, handleInteraction, { once: true })
      })
      
      return () => {
        events.forEach(event => {
          window.removeEventListener(event, handleInteraction)
        })
      }
    }
  }, [threshold, delay, priority, onDeferred])
  
  // Handle visible threshold
  useEffect(() => {
    if (threshold === 'visible' && isVisible && isEnhanced) {
      setShouldRender(true)
      onDeferred?.()
    }
  }, [threshold, isVisible, isEnhanced, onDeferred])
  
  // Render logic
  if (!shouldRender) {
    return (
      <div ref={elementRef} className={className}>
        {fallback || <DeferredSkeleton className={className} />}
      </div>
    )
  }
  
  return <div className={className}>{children}</div>
}

// Export memoized component
export const DeferredComponent = memo(DeferredComponentBase)

// Hook for deferred rendering
export function useDeferred(
  threshold: 'immediate' | 'idle' | 'visible' | 'interaction' = 'idle',
  delay?: number
): boolean {
  const [isDeferred, setIsDeferred] = useState(threshold !== 'immediate')
  
  useEffect(() => {
    if (threshold === 'immediate') {
      setIsDeferred(false)
      return
    }
    
    if (threshold === 'idle') {
      if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(
          () => setIsDeferred(false),
          { timeout: delay ?? 100 }
        )
        return () => cancelIdleCallback(id)
      } else {
        const timer = setTimeout(() => setIsDeferred(false), delay ?? 100)
        return () => clearTimeout(timer)
      }
    }
    
    // Similar logic for other thresholds...
  }, [threshold, delay])
  
  return !isDeferred
}

// Batch deferred component for multiple items
interface BatchDeferredProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  batchSize?: number
  batchDelay?: number
  fallbackItem?: (index: number) => React.ReactNode
  className?: string
  itemClassName?: string
}

export function BatchDeferred<T>({
  items,
  renderItem,
  batchSize = 10,
  batchDelay = 50,
  fallbackItem,
  className,
  itemClassName
}: BatchDeferredProps<T>) {
  const [renderedCount, setRenderedCount] = useState(0)
  
  useEffect(() => {
    if (renderedCount < items.length) {
      const timer = setTimeout(() => {
        setRenderedCount(prev => Math.min(prev + batchSize, items.length))
      }, batchDelay)
      
      return () => clearTimeout(timer)
    }
  }, [renderedCount, items.length, batchSize, batchDelay])
  
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={index} className={itemClassName}>
          {index < renderedCount 
            ? renderItem(item, index)
            : fallbackItem?.(index) || <DeferredSkeleton />
          }
        </div>
      ))}
    </div>
  )
}

// Progressive disclosure component
interface ProgressiveDisclosureProps {
  stages: Array<{
    content: React.ReactNode
    delay?: number
    priority?: 'high' | 'normal' | 'low'
  }>
  className?: string
}

export const ProgressiveDisclosure = memo<ProgressiveDisclosureProps>(({
  stages,
  className
}) => {
  const [currentStage, setCurrentStage] = useState(0)
  
  useEffect(() => {
    if (currentStage < stages.length - 1) {
      const stage = stages[currentStage]
      const delay = stage.delay ?? PRIORITY_DELAYS[stage.priority ?? 'normal']
      
      const timer = setTimeout(() => {
        setCurrentStage(prev => prev + 1)
      }, delay)
      
      return () => clearTimeout(timer)
    }
  }, [currentStage, stages])
  
  return (
    <div className={className}>
      {stages.slice(0, currentStage + 1).map((stage, index) => (
        <div key={index}>{stage.content}</div>
      ))}
    </div>
  )
})

// Export utilities
export const DeferredUtils = {
  // Check if code splitting is supported
  isCodeSplittingSupported: () => 'IntersectionObserver' in window,
  
  // Preload component
  preloadComponent: (componentPromise: Promise<any>) => {
    componentPromise.then(() => {
      // Component preloaded
    }).catch(() => {
      // Handle error
    })
  },
  
  // Create lazy component with fallback
  createLazyComponent: <T extends React.ComponentType<any>>(
    loader: () => Promise<{ default: T }>,
    fallback?: React.ReactNode
  ) => {
    const LazyComponent = React.lazy(loader)
    
    return (props: React.ComponentProps<T>) => (
      <Suspense fallback={fallback || <DeferredSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}