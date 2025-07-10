import { useState, useEffect } from 'react'
import { breakpoints } from '@styles/design-tokens'

/**
 * Custom hook for responsive design using media queries
 * @param query - Media query string or breakpoint key
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string | keyof typeof breakpoints): boolean {
  // Convert breakpoint key to media query if needed
  const mediaQuery = query in breakpoints 
    ? `(min-width: ${breakpoints[query as keyof typeof breakpoints]})`
    : query

  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(mediaQuery).matches
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQueryList = window.matchMedia(mediaQuery)
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Set initial value
    setMatches(mediaQueryList.matches)

    // Modern browsers
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange)
      return () => mediaQueryList.removeEventListener('change', handleChange)
    } 
    // Legacy browsers
    else {
      mediaQueryList.addListener(handleChange)
      return () => mediaQueryList.removeListener(handleChange)
    }
  }, [mediaQuery])

  return matches
}

/**
 * Preset media query hooks for common breakpoints
 */
export const useIsMobile = () => !useMediaQuery('md')
export const useIsTablet = () => useMediaQuery('md') && !useMediaQuery('lg')
export const useIsDesktop = () => useMediaQuery('lg')
export const useIsLargeScreen = () => useMediaQuery('xl')

/**
 * Hook to get current breakpoint
 */
export function useBreakpoint() {
  const isXs = !useMediaQuery('sm')
  const isSm = useMediaQuery('sm') && !useMediaQuery('md')
  const isMd = useMediaQuery('md') && !useMediaQuery('lg')
  const isLg = useMediaQuery('lg') && !useMediaQuery('xl')
  const isXl = useMediaQuery('xl') && !useMediaQuery('2xl')
  const is2xl = useMediaQuery('2xl')

  if (is2xl) return '2xl'
  if (isXl) return 'xl'
  if (isLg) return 'lg'
  if (isMd) return 'md'
  if (isSm) return 'sm'
  return 'xs'
}