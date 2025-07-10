import { useState, useEffect } from 'react'

/**
 * Hook to detect and track system theme preference
 * @returns The current system theme preference ('light' or 'dark')
 */
export const useSystemTheme = (): 'light' | 'dark' => {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    // Set initial value
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return systemTheme
}

/**
 * Hook to manage theme mode (light, dark, or system)
 * This hook works in conjunction with useTheme to provide system theme support
 */
export const useThemeMode = () => {
  const systemTheme = useSystemTheme()
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('themeMode')
    return (saved as 'light' | 'dark' | 'system') || 'system'
  })

  const effectiveTheme = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    localStorage.setItem('themeMode', mode)
  }, [mode])

  return {
    mode,
    setMode,
    effectiveTheme,
    systemTheme
  }
}