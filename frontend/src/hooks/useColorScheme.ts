import { useState, useEffect, useCallback } from 'react'

export type ColorScheme = 'light' | 'dark'
export type ColorSchemePreference = 'light' | 'dark' | 'system'

interface UseColorSchemeReturn {
  /**
   * The current color scheme (resolved from preference and system)
   */
  colorScheme: ColorScheme
  /**
   * The user's preference (can be 'system')
   */
  preference: ColorSchemePreference
  /**
   * The system's color scheme preference
   */
  systemColorScheme: ColorScheme
  /**
   * Set the user's color scheme preference
   */
  setPreference: (preference: ColorSchemePreference) => void
  /**
   * Toggle between light and dark (ignores system)
   */
  toggle: () => void
  /**
   * Check if currently using system preference
   */
  isUsingSystem: boolean
}

const STORAGE_KEY = 'jidelnicek-color-scheme-preference'

/**
 * Hook to detect and manage color scheme preference
 * Handles system preference detection, user overrides, and persistence
 * 
 * @returns Object with color scheme state and control methods
 * 
 * @example
 * ```tsx
 * const { colorScheme, preference, setPreference, toggle } = useColorScheme()
 * 
 * // Use the resolved color scheme
 * <div className={colorScheme === 'dark' ? 'dark-mode' : 'light-mode'}>
 * 
 * // Allow user to choose
 * <select value={preference} onChange={(e) => setPreference(e.target.value)}>
 *   <option value="system">System</option>
 *   <option value="light">Light</option>
 *   <option value="dark">Dark</option>
 * </select>
 * ```
 */
export const useColorScheme = (): UseColorSchemeReturn => {
  // Get initial system preference
  const getSystemColorScheme = (): ColorScheme => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // Get initial preference from storage
  const getStoredPreference = (): ColorSchemePreference => {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
    return 'system'
  }

  const [systemColorScheme, setSystemColorScheme] = useState<ColorScheme>(getSystemColorScheme)
  const [preference, setPreferenceState] = useState<ColorSchemePreference>(getStoredPreference)

  // Resolve the actual color scheme based on preference
  const colorScheme = preference === 'system' ? systemColorScheme : preference

  // Update preference and persist to storage
  const setPreference = useCallback((newPreference: ColorSchemePreference) => {
    setPreferenceState(newPreference)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newPreference)
      
      // Dispatch custom event for other components/tabs
      window.dispatchEvent(new CustomEvent('colorSchemeChange', {
        detail: { preference: newPreference }
      }))
    }
  }, [])

  // Toggle between light and dark
  const toggle = useCallback(() => {
    const newPreference = colorScheme === 'dark' ? 'light' : 'dark'
    setPreference(newPreference as ColorSchemePreference)
  }, [colorScheme, setPreference])

  // Listen for system color scheme changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemColorScheme(e.matches ? 'dark' : 'light')
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    
    // Legacy browsers
    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  // Listen for storage changes (from other tabs)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newPreference = e.newValue as ColorSchemePreference
        if (newPreference === 'light' || newPreference === 'dark' || newPreference === 'system') {
          setPreferenceState(newPreference)
        }
      }
    }

    // Listen for custom event (same tab)
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.preference) {
        setPreferenceState(customEvent.detail.preference)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('colorSchemeChange', handleCustomEvent)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('colorSchemeChange', handleCustomEvent)
    }
  }, [])

  // Apply color scheme to document
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      
      // Remove both classes first
      root.classList.remove('light', 'dark')
      
      // Add the current scheme
      root.classList.add(colorScheme)
      
      // Also set data attribute for CSS selectors
      root.setAttribute('data-color-scheme', colorScheme)
    }
  }, [colorScheme])

  return {
    colorScheme,
    preference,
    systemColorScheme,
    setPreference,
    toggle,
    isUsingSystem: preference === 'system'
  }
}

/**
 * Hook to check if user prefers reduced motion
 * Useful for disabling transitions during theme changes
 * 
 * @returns boolean indicating if reduced motion is preferred
 */
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    
    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return prefersReducedMotion
}