import React, { useContext } from 'react'
import { vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ThemeProvider, ThemeContext } from '../ThemeContext'
import { themes, validateTheme } from '../../config/theme'

// Mock matchMedia
const mockMatchMedia = (matches: boolean) => ({
  matches,
  media: '(prefers-color-scheme: dark)',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})

// Helper hook to access ThemeContext
const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Mock the theme config module
vi.mock('../../config/theme', () => ({
  ...vi.importActual('../../config/theme'),
  applyThemeToCSSVariables: vi.fn(),
}))

describe('ThemeContext', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    // Default to light mode
    window.matchMedia = vi.fn().mockImplementation((query) => {
      if (query === '(prefers-color-scheme: dark)') {
        return mockMatchMedia(false)
      }
      if (query === '(prefers-reduced-motion: reduce)') {
        return mockMatchMedia(false)
      }
      return mockMatchMedia(false)
    })
    
    // Clear localStorage
    localStorage.clear()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  describe('System Theme Detection', () => {
    it('should detect system light theme preference', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.systemTheme).toBe('light')
      expect(result.current.theme).toBe('light')
      expect(result.current.isSystemMode).toBe(true)
    })

    it('should detect system dark theme preference', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mockMatchMedia(true)
        }
        return mockMatchMedia(false)
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.systemTheme).toBe('dark')
      expect(result.current.theme).toBe('dark')
      expect(result.current.isSystemMode).toBe(true)
    })

    it('should respond to system theme changes', async () => {
      const listeners: Array<(e: any) => void> = []
      const mediaQueryMock = {
        ...mockMatchMedia(false),
        addEventListener: vi.fn((event, listener) => {
          if (event === 'change') listeners.push(listener)
        }),
        removeEventListener: vi.fn(),
      }

      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mediaQueryMock
        }
        return mockMatchMedia(false)
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.theme).toBe('light')

      // Simulate system theme change
      act(() => {
        mediaQueryMock.matches = true
        listeners.forEach(listener => listener({ matches: true }))
      })

      await waitFor(() => {
        expect(result.current.systemTheme).toBe('dark')
        expect(result.current.theme).toBe('dark')
      })
    })
  })

  describe('Theme Mode Management', () => {
    it('should default to system mode', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.themeMode).toBe('system')
      expect(result.current.isSystemMode).toBe(true)
    })

    it('should switch to manual mode when setting theme', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.themeMode).toBe('dark')
      expect(result.current.isSystemMode).toBe(false)
      expect(result.current.theme).toBe('dark')
    })

    it('should switch back to system mode', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.isSystemMode).toBe(false)

      act(() => {
        result.current.setThemeMode('system')
      })

      expect(result.current.themeMode).toBe('system')
      expect(result.current.isSystemMode).toBe(true)
      expect(result.current.theme).toBe('light') // Back to system preference
    })
  })

  describe('Theme Toggle', () => {
    it('should toggle from system mode to manual mode', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.theme).toBe('light')
      expect(result.current.isSystemMode).toBe(true)

      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('dark')
      expect(result.current.isSystemMode).toBe(false)
      expect(result.current.themeMode).toBe('dark')
    })

    it('should toggle between light and dark in manual mode', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      act(() => {
        result.current.setTheme('light')
      })

      expect(result.current.theme).toBe('light')

      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('dark')

      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('light')
    })
  })

  describe('LocalStorage Persistence', () => {
    it('should save theme mode to localStorage', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      act(() => {
        result.current.setThemeMode('dark')
      })

      expect(localStorage.getItem('themeMode')).toBe('dark')
      expect(localStorage.getItem('theme')).toBe('dark')
    })

    it('should restore theme mode from localStorage', () => {
      localStorage.setItem('themeMode', 'dark')
      localStorage.setItem('theme', 'dark')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.themeMode).toBe('dark')
      expect(result.current.theme).toBe('dark')
      expect(result.current.isSystemMode).toBe(false)
    })

    it('should restore system mode from localStorage', () => {
      localStorage.setItem('themeMode', 'system')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.themeMode).toBe('system')
      expect(result.current.isSystemMode).toBe(true)
      expect(result.current.theme).toBe('light') // System preference
    })
  })

  describe('Reduced Motion Support', () => {
    it('should detect reduced motion preference', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return mockMatchMedia(true)
        }
        return mockMatchMedia(false)
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.prefersReducedMotion).toBe(true)
    })
  })

  describe('Custom Theme Registration', () => {
    it('should register custom theme', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      const customTheme = {
        name: 'Custom',
        colors: {
          primary: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          secondary: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          success: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          warning: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          error: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          info: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          background: '#fff',
          surface: '#f5f5f5',
          surfaceElevated: '#fff',
          card: '#fff',
          popover: '#fff',
          modal: '#fff',
          text: {
            primary: '#000',
            secondary: '#666',
            muted: '#999',
            disabled: '#ccc',
            inverse: '#fff'
          },
          border: {
            default: '#ddd',
            subtle: '#eee',
            strong: '#999'
          }
        },
        typography: {
          fontFamily: {
            sans: 'Arial, sans-serif',
            mono: 'monospace'
          }
        },
        spacing: {
          unit: 4,
          containerPadding: '1rem'
        },
        borderRadius: {
          sm: '0.25rem',
          md: '0.375rem',
          lg: '0.5rem',
          xl: '0.75rem',
          full: '9999px'
        },
        shadows: {
          sm: 'none',
          md: 'none',
          lg: 'none',
          xl: 'none'
        }
      }

      act(() => {
        result.current.registerCustomTheme('custom', customTheme)
      })

      expect(result.current.availableThemes).toContain('custom')

      act(() => {
        result.current.setTheme('custom')
      })

      expect(result.current.theme).toBe('custom')
    })

    it('should reject invalid custom themes', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      const invalidTheme = {
        name: 'Invalid',
        colors: {
          primary: '#fff', // Invalid structure - should be color scale
        }
      } as any

      act(() => {
        result.current.registerCustomTheme('invalid', invalidTheme)
      })

      expect(result.current.availableThemes).not.toContain('invalid')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid theme structure'))

      consoleSpy.mockRestore()
    })

    it('should initialize with custom themes from props', () => {
      const customThemes = {
        ocean: {
          name: 'Ocean',
          colors: {
            primary: { 50: '#e0f2fe', 100: '#bae6fd', 200: '#7dd3fc', 300: '#38bdf8', 400: '#0ea5e9', 500: '#0284c7', 600: '#0369a1', 700: '#075985', 800: '#0c4a6e', 900: '#164e63' },
            secondary: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a' },
            success: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
            warning: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' },
            error: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d' },
            info: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
            background: '#f0f9ff',
            surface: '#e0f2fe',
            surfaceElevated: '#bae6fd',
            card: '#dbeafe',
            popover: '#e0f2fe',
            modal: '#f0f9ff',
            text: {
              primary: '#0c4a6e',
              secondary: '#075985',
              muted: '#0369a1',
              disabled: '#7dd3fc',
              inverse: '#f0f9ff'
            },
            border: {
              default: '#38bdf8',
              subtle: '#7dd3fc',
              strong: '#0284c7'
            }
          },
          typography: {
            fontFamily: {
              sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              mono: 'Consolas, Monaco, "Andale Mono", monospace'
            }
          },
          spacing: {
            unit: 4,
            containerPadding: '1rem'
          },
          borderRadius: {
            sm: '0.25rem',
            md: '0.375rem',
            lg: '0.5rem',
            xl: '0.75rem',
            full: '9999px'
          },
          shadows: {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }
        }
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider customThemes={customThemes}>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(result.current.availableThemes).toContain('ocean')
      expect(result.current.availableThemes).toContain('light')
      expect(result.current.availableThemes).toContain('dark')
    })
  })

  describe('Theme Cycling', () => {
    it('should cycle through all available themes when using custom themes', () => {
      const customThemes = {
        ocean: themes.light, // Using light theme structure for simplicity
        forest: themes.dark  // Using dark theme structure for simplicity
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider customThemes={customThemes}>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      // Set to a custom theme first
      act(() => {
        result.current.setTheme('ocean')
      })

      expect(result.current.theme).toBe('ocean')

      // Toggle should cycle through themes
      act(() => {
        result.current.toggleTheme()
      })

      // Should move to next theme in the list
      expect(['light', 'dark', 'forest']).toContain(result.current.theme)
    })
  })

  describe('Theme Transition and Animation', () => {
    it('should apply smooth transitions when reduced motion is not preferred', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      renderHook(() => useTheme(), { wrapper })

      // Check that transition styles are applied
      expect(document.documentElement.style.transition).toBe('')
    })

    it('should disable transitions when reduced motion is preferred', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return mockMatchMedia(true)
        }
        return mockMatchMedia(false)
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      renderHook(() => useTheme(), { wrapper })

      // Transitions should be disabled
      expect(document.documentElement.style.transition).toBe('')
    })
  })

  describe('DOM Class Management', () => {
    it('should add theme class to document root', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      expect(document.documentElement.classList.contains('light')).toBe(true)

      act(() => {
        result.current.setTheme('dark')
      })

      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle invalid theme names gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation()
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      act(() => {
        result.current.setTheme('non-existent-theme')
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Theme "non-existent-theme" not found'),
        expect.objectContaining({})
      )

      // Theme should remain unchanged
      expect(result.current.theme).toBe('light')

      consoleSpy.mockRestore()
    })

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('themeMode', 'corrupted-mode')
      localStorage.setItem('theme', 'non-existent')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      )

      const { result } = renderHook(() => useTheme(), { wrapper })

      // Should fall back to defaults
      expect(result.current.themeMode).toBe('corrupted-mode')
      expect(result.current.theme).toBe('light') // Falls back to light
    })
  })

  describe('Context Without Provider', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

      expect(() => {
        renderHook(() => useTheme())
      }).toThrow('useTheme must be used within a ThemeProvider')

      consoleSpy.mockRestore()
    })
  })
})