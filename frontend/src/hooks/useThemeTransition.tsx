import { useCallback, useRef, useEffect } from 'react'
import { usePrefersReducedMotion } from './useColorScheme'

interface ThemeTransitionOptions {
  /**
   * Duration of the transition disable period in milliseconds
   * @default 50
   */
  duration?: number
  /**
   * CSS classes to temporarily add during transition
   */
  transitionClasses?: string[]
  /**
   * Whether to respect prefers-reduced-motion
   * @default true
   */
  respectReducedMotion?: boolean
  /**
   * Callback when transition starts
   */
  onTransitionStart?: () => void
  /**
   * Callback when transition ends
   */
  onTransitionEnd?: () => void
}

interface UseThemeTransitionReturn {
  /**
   * Wrap theme changes in this function to manage transitions
   */
  executeTransition: (callback: () => void) => void
  /**
   * Whether a transition is currently in progress
   */
  isTransitioning: boolean
  /**
   * Manually disable transitions
   */
  disableTransitions: () => void
  /**
   * Manually enable transitions
   */
  enableTransitions: () => void
}

const TRANSITION_DISABLE_CLASS = 'theme-transitioning'
const DEFAULT_DURATION = 50

/**
 * Hook to manage theme transition animations
 * Prevents flash of unstyled content during theme changes
 * 
 * @param options - Configuration options
 * @returns Object with transition control methods
 * 
 * @example
 * ```tsx
 * const { executeTransition } = useThemeTransition()
 * 
 * const changeTheme = () => {
 *   executeTransition(() => {
 *     setTheme('dark')
 *   })
 * }
 * ```
 */
export const useThemeTransition = (options: ThemeTransitionOptions = {}): UseThemeTransitionReturn => {
  const {
    duration = DEFAULT_DURATION,
    transitionClasses = [],
    respectReducedMotion = true,
    onTransitionStart,
    onTransitionEnd
  } = options

  const prefersReducedMotion = usePrefersReducedMotion()
  const isTransitioningRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const disableTransitions = useCallback(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    
    // Add transition disable class
    root.classList.add(TRANSITION_DISABLE_CLASS)
    
    // Add any custom transition classes
    transitionClasses.forEach(className => {
      root.classList.add(className)
    })

    // Force reflow to ensure styles are applied
    void root.offsetHeight
  }, [transitionClasses])

  const enableTransitions = useCallback(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    
    // Remove transition disable class
    root.classList.remove(TRANSITION_DISABLE_CLASS)
    
    // Remove any custom transition classes
    transitionClasses.forEach(className => {
      root.classList.remove(className)
    })
  }, [transitionClasses])

  const executeTransition = useCallback((callback: () => void) => {
    // Skip transition management if reduced motion is preferred
    if (respectReducedMotion && prefersReducedMotion) {
      callback()
      return
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    isTransitioningRef.current = true
    onTransitionStart?.()

    // Disable transitions
    disableTransitions()

    // Execute the theme change
    // Use requestAnimationFrame to ensure DOM updates are batched
    requestAnimationFrame(() => {
      callback()

      // Re-enable transitions after a short delay
      timeoutRef.current = setTimeout(() => {
        enableTransitions()
        isTransitioningRef.current = false
        onTransitionEnd?.()
      }, duration)
    })
  }, [
    respectReducedMotion,
    prefersReducedMotion,
    duration,
    disableTransitions,
    enableTransitions,
    onTransitionStart,
    onTransitionEnd
  ])

  return {
    executeTransition,
    isTransitioning: isTransitioningRef.current,
    disableTransitions,
    enableTransitions
  }
}

/**
 * Hook to add theme transition styles to the document
 * Call this once in your app root
 * 
 * @param selector - CSS selector for elements to disable transitions on
 * @default '*'
 */
export const useThemeTransitionStyles = (selector: string = '*') => {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const styleId = 'theme-transition-styles'
    
    // Check if styles already exist
    if (document.getElementById(styleId)) return

    // Create and inject styles
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .${TRANSITION_DISABLE_CLASS} ${selector},
      .${TRANSITION_DISABLE_CLASS} ${selector}::before,
      .${TRANSITION_DISABLE_CLASS} ${selector}::after {
        transition: none !important;
        animation-duration: 0s !important;
      }
      
      /* Preserve specific transitions that should always run */
      .${TRANSITION_DISABLE_CLASS} .preserve-transition {
        transition: inherit !important;
      }
      
      /* Smooth color transitions when enabled */
      :root:not(.${TRANSITION_DISABLE_CLASS}) {
        transition: background-color 0.3s ease, color 0.3s ease;
      }
      
      /* Respect reduced motion preference */
      @media (prefers-reduced-motion: reduce) {
        ${selector},
        ${selector}::before,
        ${selector}::after {
          transition-duration: 0.01ms !important;
          animation-duration: 0.01ms !important;
        }
      }
    `

    document.head.appendChild(style)

    // Cleanup
    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [selector])
}

/**
 * Higher-order component to wrap theme changes with transitions
 * 
 * @example
 * ```tsx
 * const ThemeToggle = withThemeTransition(({ executeTransition, currentTheme, setTheme }) => {
 *   return (
 *     <button onClick={() => executeTransition(() => setTheme('dark'))}>
 *       Toggle Theme
 *     </button>
 *   )
 * })
 * ```
 */
export const withThemeTransition = <P extends object>(
  Component: React.ComponentType<P & { executeTransition: (callback: () => void) => void }>,
  options?: ThemeTransitionOptions
) => {
  return (props: P) => {
    const { executeTransition } = useThemeTransition(options)
    return <Component {...props} executeTransition={executeTransition} />
  }
}