import React, { createContext, useState, useEffect, useCallback } from 'react'
import { 
  themes, 
  applyThemeToCSSVariables, 
  Theme as ThemeConfig,
  ThemeName,
  createCustomTheme,
  validateTheme 
} from '../config/theme'
import { useSystemThemePreference, usePrefersReducedMotion } from '../hooks/useSystemThemePreference'

type Theme = 'light' | 'dark' | string
type ThemeMode = 'light' | 'dark' | 'system' | string

interface ThemeContextType {
  theme: Theme
  themeMode: ThemeMode
  themeConfig: ThemeConfig
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  setThemeMode: (mode: ThemeMode) => void
  registerCustomTheme: (name: string, theme: ThemeConfig) => void
  availableThemes: string[]
  systemTheme: 'light' | 'dark'
  isSystemMode: boolean
  prefersReducedMotion: boolean
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
  customThemes?: Record<string, ThemeConfig>
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, customThemes = {} }) => {
  // Use system theme preference hook
  const { systemTheme } = useSystemThemePreference()
  const prefersReducedMotion = usePrefersReducedMotion()

  // Initialize custom themes
  const [registeredThemes, setRegisteredThemes] = useState<Record<string, ThemeConfig>>({
    ...themes,
    ...customThemes,
  })

  // Theme mode determines whether to use system preference or manual selection
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem('themeMode') as ThemeMode
    return savedMode || 'system'
  })

  // Actual theme value (can be from saved preference or system)
  const [manualTheme, setManualTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && savedTheme in registeredThemes) return savedTheme
    return 'light'
  })

  // Determine effective theme based on mode
  const theme = themeMode === 'system' ? systemTheme : manualTheme
  const isSystemMode = themeMode === 'system'

  const themeConfig = registeredThemes[theme] || themes.light

  // Handle theme transitions with smooth animation
  useEffect(() => {
    const root = document.documentElement
    
    // Add transition class for smooth theme changes (unless user prefers reduced motion)
    if (!prefersReducedMotion) {
      root.style.transition = 'background-color 0.3s ease, color 0.3s ease'
    } else {
      root.style.transition = 'none'
    }
    
    // Apply theme class for Tailwind
    // Remove all theme classes first
    Object.keys(registeredThemes).forEach(themeName => {
      root.classList.remove(themeName)
    })
    
    // Add current theme class
    root.classList.add(theme)
    
    // Apply theme to CSS variables
    applyThemeToCSSVariables(themeConfig)
    
    // Clean up transition after theme change
    const transitionTimeout = setTimeout(() => {
      if (!prefersReducedMotion) {
        root.style.transition = ''
      }
    }, 300)
    
    return () => clearTimeout(transitionTimeout)
  }, [theme, themeConfig, registeredThemes, prefersReducedMotion])

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode)
    if (themeMode !== 'system') {
      localStorage.setItem('theme', manualTheme)
    }
  }, [themeMode, manualTheme])

  const toggleTheme = useCallback(() => {
    // If in system mode, switch to manual mode with opposite of current theme
    if (themeMode === 'system') {
      const newTheme = theme === 'light' ? 'dark' : 'light'
      setThemeModeState(newTheme)
      setManualTheme(newTheme)
    } else {
      // If in manual mode, cycle through themes
      setManualTheme(prevTheme => {
        // If using default themes, toggle between them
        if (prevTheme === 'light') return 'dark'
        if (prevTheme === 'dark') return 'light'
        
        // If using custom theme, cycle through available themes
        const themeNames = Object.keys(registeredThemes)
        const currentIndex = themeNames.indexOf(prevTheme)
        const nextIndex = (currentIndex + 1) % themeNames.length
        return themeNames[nextIndex]
      })
      
      // Update theme mode to match if it was a basic theme
      if (themeMode === 'light' || themeMode === 'dark') {
        setThemeModeState(prevMode => prevMode === 'light' ? 'dark' : 'light')
      }
    }
  }, [themeMode, theme, registeredThemes])

  const setTheme = useCallback((newTheme: Theme) => {
    if (newTheme in registeredThemes) {
      setManualTheme(newTheme)
      // Switch to manual mode when explicitly setting a theme
      if (themeMode === 'system') {
        setThemeModeState(newTheme === 'light' || newTheme === 'dark' ? newTheme : 'manual')
      }
    } else {
      console.warn(`Theme "${newTheme}" not found. Available themes:`, Object.keys(registeredThemes))
    }
  }, [registeredThemes, themeMode])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
    // If switching to a specific theme mode (not system), update manual theme
    if (mode === 'light' || mode === 'dark') {
      setManualTheme(mode)
    }
  }, [])

  const registerCustomTheme = (name: string, theme: ThemeConfig) => {
    if (validateTheme(theme)) {
      setRegisteredThemes(prev => ({
        ...prev,
        [name]: theme,
      }))
    } else {
      console.error(`Invalid theme structure for theme "${name}"`)
    }
  }

  return (
    <ThemeContext.Provider 
      value={{ 
        theme,
        themeMode,
        themeConfig,
        toggleTheme, 
        setTheme,
        setThemeMode,
        registerCustomTheme,
        availableThemes: Object.keys(registeredThemes),
        systemTheme,
        isSystemMode,
        prefersReducedMotion,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}