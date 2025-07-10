import React, { createContext, useState, useEffect } from 'react'
import { 
  themes, 
  applyThemeToCSSVariables, 
  Theme as ThemeConfig,
  ThemeName,
  createCustomTheme,
  validateTheme 
} from '../config/theme'

type Theme = 'light' | 'dark' | string

interface ThemeContextType {
  theme: Theme
  themeConfig: ThemeConfig
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  registerCustomTheme: (name: string, theme: ThemeConfig) => void
  availableThemes: string[]
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
  customThemes?: Record<string, ThemeConfig>
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, customThemes = {} }) => {
  // Initialize custom themes
  const [registeredThemes, setRegisteredThemes] = useState<Record<string, ThemeConfig>>({
    ...themes,
    ...customThemes,
  })

  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    const savedMode = localStorage.getItem('themeMode') as string
    
    // If system mode is saved, use system preference
    if (savedMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    
    // Otherwise use saved theme or default to system preference
    if (savedTheme && savedTheme in registeredThemes) return savedTheme
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const themeConfig = registeredThemes[theme] || themes.light

  useEffect(() => {
    const root = document.documentElement
    
    // Apply theme class for Tailwind
    // Remove all theme classes first
    Object.keys(registeredThemes).forEach(themeName => {
      root.classList.remove(themeName)
    })
    
    // Add current theme class
    root.classList.add(theme)
    
    // Apply theme to CSS variables
    applyThemeToCSSVariables(themeConfig)
    
    // Save theme preference
    localStorage.setItem('theme', theme)
  }, [theme, themeConfig, registeredThemes])

  const toggleTheme = () => {
    setThemeState(prevTheme => {
      // If using default themes, toggle between them
      if (prevTheme === 'light') return 'dark'
      if (prevTheme === 'dark') return 'light'
      
      // If using custom theme, cycle through available themes
      const themeNames = Object.keys(registeredThemes)
      const currentIndex = themeNames.indexOf(prevTheme)
      const nextIndex = (currentIndex + 1) % themeNames.length
      return themeNames[nextIndex]
    })
  }

  const setTheme = (newTheme: Theme) => {
    if (newTheme in registeredThemes) {
      setThemeState(newTheme)
    } else {
      console.warn(`Theme "${newTheme}" not found. Available themes:`, Object.keys(registeredThemes))
    }
  }

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
        themeConfig,
        toggleTheme, 
        setTheme,
        registerCustomTheme,
        availableThemes: Object.keys(registeredThemes),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}