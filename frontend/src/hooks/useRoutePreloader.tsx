import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RoutePreloader } from '@utils/routePreloader'
import { routeMetadata } from '@router/index'

// Global route preloader instance
let routePreloader: RoutePreloader | null = null

// Initialize the route preloader
function getRoutePreloader(): RoutePreloader {
  if (!routePreloader) {
    routePreloader = new RoutePreloader(routeMetadata, {
      enablePredictivePreloading: true,
      maxConcurrentPreloads: 2,
      idleTimeout: 2000,
    })
  }
  return routePreloader
}

// Hook to use route preloader in components
export function useRoutePreloader() {
  const location = useLocation()
  const previousLocation = useRef(location.pathname)
  const preloader = useRef(getRoutePreloader())

  // Track navigation patterns
  useEffect(() => {
    if (previousLocation.current !== location.pathname) {
      preloader.current.recordNavigation(
        previousLocation.current,
        location.pathname
      )
      previousLocation.current = location.pathname
    }
  }, [location.pathname])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Don't destroy the global instance
    }
  }, [])

  return {
    preloadRoute: (path: string) => preloader.current.preloadRoute(path),
    setupLinkPreloading: (element: HTMLElement, path: string) => 
      preloader.current.setupLinkPreloading(element, path),
    observeElement: (element: HTMLElement, path: string) =>
      preloader.current.observeElement(element, path),
    getStats: () => preloader.current.getStats(),
  }
}

// Hook to preload a route on hover
export function usePreloadOnHover(path: string) {
  const ref = useRef<HTMLElement>(null)
  const { setupLinkPreloading } = useRoutePreloader()

  useEffect(() => {
    if (ref.current) {
      const cleanup = setupLinkPreloading(ref.current, path)
      return cleanup
    }
  }, [path, setupLinkPreloading])

  return ref
}

// Hook to preload when element is visible
export function usePreloadOnVisible(path: string) {
  const ref = useRef<HTMLElement>(null)
  const { observeElement } = useRoutePreloader()

  useEffect(() => {
    if (ref.current) {
      observeElement(ref.current, path)
    }
  }, [path, observeElement])

  return ref
}

// Enhanced Link component with preloading
import React from 'react'
import { Link as RouterLink, LinkProps } from 'react-router-dom'

export const PreloadLink = React.forwardRef<
  HTMLAnchorElement,
  LinkProps & { preload?: boolean; preloadOn?: 'hover' | 'visible' }
>(({ preload = true, preloadOn = 'hover', ...props }, ref) => {
  const internalRef = useRef<HTMLAnchorElement>(null)
  const { setupLinkPreloading, observeElement } = useRoutePreloader()

  useEffect(() => {
    const element = (ref as any)?.current || internalRef.current
    if (!element || !preload || typeof props.to !== 'string') return

    if (preloadOn === 'hover') {
      const cleanup = setupLinkPreloading(element, props.to)
      return cleanup
    } else if (preloadOn === 'visible') {
      observeElement(element, props.to)
    }
  }, [props.to, preload, preloadOn, ref, setupLinkPreloading, observeElement])

  return <RouterLink ref={ref || internalRef} {...props} />
})

PreloadLink.displayName = 'PreloadLink'

// Hook for programmatic navigation with preloading
export function usePreloadNavigate() {
  const navigate = useNavigate()
  const { preloadRoute } = useRoutePreloader()

  return async (to: string, options?: any) => {
    // Start preloading immediately
    const preloadPromise = preloadRoute(to)
    
    // Navigate without waiting for preload to complete
    navigate(to, options)
    
    // Optionally wait for preload
    try {
      await preloadPromise
    } catch (error) {
      console.error('Preload failed during navigation:', error)
    }
  }
}