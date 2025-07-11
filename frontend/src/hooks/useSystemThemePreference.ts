import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for detecting and monitoring system theme preference changes
 * 
 * @returns {Object} Object containing:
 *   - systemTheme: 'light' | 'dark' - Current system theme preference
 *   - isSystemDark: boolean - Whether system prefers dark mode
 *   - mediaQuery: MediaQueryList | null - The media query object for advanced use cases
 */
export function useSystemThemePreference() {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const [mediaQuery, setMediaQuery] = useState<MediaQueryList | null>(null)

  const handleThemeChange = useCallback((e: MediaQueryListEvent | MediaQueryList) => {
    setSystemTheme(e.matches ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(prefers-color-scheme: dark)')
    setMediaQuery(query)
    
    // Set initial value
    handleThemeChange(query)

    // Modern browsers support addEventListener
    if (query.addEventListener) {
      query.addEventListener('change', handleThemeChange)
      return () => query.removeEventListener('change', handleThemeChange)
    } 
    // Fallback for older browsers
    else if (query.addListener) {
      query.addListener(handleThemeChange)
      return () => query.removeListener(handleThemeChange)
    }
  }, [handleThemeChange])

  return {
    systemTheme,
    isSystemDark: systemTheme === 'dark',
    mediaQuery
  }
}

/**
 * Hook for detecting if user prefers reduced motion
 * Useful for theme transitions and animations
 * 
 * @returns {boolean} Whether user prefers reduced motion
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(e.matches)
    }

    // Set initial value
    handleChange(query)

    // Modern browsers support addEventListener
    if (query.addEventListener) {
      query.addEventListener('change', handleChange)
      return () => query.removeEventListener('change', handleChange)
    }
    // Fallback for older browsers
    else if (query.addListener) {
      query.addListener(handleChange)
      return () => query.removeListener(handleChange)
    }
  }, [])

  return prefersReducedMotion
}