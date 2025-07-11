import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../context/ThemeContext'
import { ThemeToggle } from '../components/navigation/ThemeToggle'
import { ThemeToggleAdvanced } from '../components/navigation/ThemeToggleAdvanced'
import { useSystemThemePreference } from '../hooks/useSystemThemePreference'
import { themes } from '../config/theme'

// Mock matchMedia
const createMockMediaQueryList = (matches: boolean): MediaQueryList => ({
  matches,
  media: '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
})

// Component that displays current theme information
const ThemeInfo = () => {
  const { systemTheme } = useSystemThemePreference()
  
  return (
    <div data-testid="theme-info">
      <div data-testid="system-theme">{systemTheme}</div>
      <div data-testid="dom-theme">{document.documentElement.className}</div>
      <div data-testid="data-theme">{document.documentElement.getAttribute('data-theme')}</div>
    </div>
  )
}

describe('Theme System Integration', () => {
  let originalMatchMedia: typeof window.matchMedia
  let mediaQueryListeners: Map<string, Array<(e: MediaQueryListEvent) => void>>

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    mediaQueryListeners = new Map()

    // Mock matchMedia with ability to trigger changes
    window.matchMedia = jest.fn().mockImplementation((query: string) => {
      const mqList = createMockMediaQueryList(
        query === '(prefers-color-scheme: dark)' ? false : false
      )

      if (!mediaQueryListeners.has(query)) {
        mediaQueryListeners.set(query, [])
      }

      mqList.addEventListener = jest.fn((event, listener) => {
        if (event === 'change') {
          mediaQueryListeners.get(query)?.push(listener)
        }
      })

      mqList.removeEventListener = jest.fn((event, listener) => {
        if (event === 'change') {
          const listeners = mediaQueryListeners.get(query) || []
          const index = listeners.indexOf(listener)
          if (index > -1) {
            listeners.splice(index, 1)
          }
        }
      })

      return mqList
    })

    // Clear localStorage and DOM
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    mediaQueryListeners.clear()
  })

  describe('Complete Theme Flow', () => {
    it('should handle full theme lifecycle from system to manual modes', async () => {
      const { rerender } = render(
        <ThemeProvider>
          <ThemeToggle />
          <ThemeToggleAdvanced />
          <ThemeInfo />
        </ThemeProvider>
      )

      // Initial state - system mode, light theme
      expect(screen.getByTestId('system-theme')).toHaveTextContent('light')
      expect(document.documentElement.classList.contains('light')).toBe(true)

      // Toggle theme - should switch to manual dark mode
      const simpleToggle = screen.getAllByRole('button')[0]
      fireEvent.click(simpleToggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(localStorage.getItem('themeMode')).toBe('dark')
      })

      // Open advanced toggle
      const advancedToggle = screen.getByRole('button', { name: /theme settings/i })
      fireEvent.click(advancedToggle)

      // Switch back to system mode
      const systemOption = await screen.findByRole('menuitem', { name: /system/i })
      fireEvent.click(systemOption)

      await waitFor(() => {
        expect(localStorage.getItem('themeMode')).toBe('system')
        expect(document.documentElement.classList.contains('light')).toBe(true)
      })

      // Simulate system theme change
      const darkModeListeners = mediaQueryListeners.get('(prefers-color-scheme: dark)') || []
      darkModeListeners.forEach(listener => 
        listener({ matches: true } as MediaQueryListEvent)
      )

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })
    })

    it('should persist theme across component remounts', async () => {
      const { unmount } = render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      // Set to dark theme
      const toggle = screen.getByRole('button')
      fireEvent.click(toggle)

      await waitFor(() => {
        expect(localStorage.getItem('themeMode')).toBe('dark')
      })

      // Unmount and remount
      unmount()

      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      // Should still be dark theme
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      const newToggle = screen.getByRole('button')
      expect(newToggle).toHaveAttribute('aria-label', 'Switch to light theme')
    })
  })

  describe('Custom Theme Integration', () => {
    it('should integrate custom themes with toggle components', async () => {
      const customThemes = {
        ocean: {
          ...themes.light,
          name: 'Ocean'
        },
        forest: {
          ...themes.dark,
          name: 'Forest'
        }
      }

      render(
        <ThemeProvider customThemes={customThemes}>
          <ThemeToggle />
          <div data-testid="theme-name">
            {document.documentElement.className}
          </div>
        </ThemeProvider>
      )

      // Should start with default theme
      expect(document.documentElement.classList.contains('light')).toBe(true)

      // Register and set custom theme
      const toggle = screen.getByRole('button')
      
      // First click goes to dark
      fireEvent.click(toggle)
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // Next clicks should cycle through all themes
      fireEvent.click(toggle)
      await waitFor(() => {
        expect(document.documentElement.classList.contains('ocean')).toBe(true)
      })

      fireEvent.click(toggle)
      await waitFor(() => {
        expect(document.documentElement.classList.contains('forest')).toBe(true)
      })
    })
  })

  describe('Multi-Component Synchronization', () => {
    it('should synchronize theme changes across multiple components', async () => {
      const ThemeDisplay1 = () => {
        const context = React.useContext(ThemeProvider)
        return <div data-testid="display1">{document.documentElement.className}</div>
      }

      const ThemeDisplay2 = () => {
        const context = React.useContext(ThemeProvider)
        return <div data-testid="display2">{document.documentElement.className}</div>
      }

      render(
        <ThemeProvider>
          <ThemeToggle />
          <ThemeToggleAdvanced />
          <ThemeDisplay1 />
          <ThemeDisplay2 />
        </ThemeProvider>
      )

      // Change theme using simple toggle
      const simpleToggle = screen.getAllByRole('button')[0]
      fireEvent.click(simpleToggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // Change theme using advanced toggle
      const advancedToggle = screen.getByRole('button', { name: /theme settings/i })
      fireEvent.click(advancedToggle)

      const lightOption = await screen.findByRole('menuitem', { name: /light/i })
      fireEvent.click(lightOption)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true)
      })
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle rapid theme changes without issues', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      const toggle = screen.getByRole('button')

      // Rapidly click toggle
      for (let i = 0; i < 10; i++) {
        fireEvent.click(toggle)
      }

      // Should end up on a valid theme
      await waitFor(() => {
        const classList = document.documentElement.classList
        expect(classList.contains('light') || classList.contains('dark')).toBe(true)
      })
    })

    it('should handle simultaneous system and manual theme changes', async () => {
      render(
        <ThemeProvider>
          <ThemeToggleAdvanced />
        </ThemeProvider>
      )

      const toggle = screen.getByRole('button', { name: /theme settings/i })

      // Start changing system theme
      const darkModeListeners = mediaQueryListeners.get('(prefers-color-scheme: dark)') || []
      darkModeListeners.forEach(listener => 
        listener({ matches: true } as MediaQueryListEvent)
      )

      // Simultaneously change to manual mode
      fireEvent.click(toggle)
      const lightOption = await screen.findByRole('menuitem', { name: /light/i })
      fireEvent.click(lightOption)

      // Manual mode should take precedence
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true)
        expect(localStorage.getItem('themeMode')).toBe('light')
      })
    })

    it('should recover from localStorage corruption', async () => {
      // Corrupt localStorage
      localStorage.setItem('themeMode', '{"corrupted": true}')
      localStorage.setItem('theme', 'null')

      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      // Should fall back to defaults
      expect(document.documentElement.classList.contains('light')).toBe(true)

      // Should be able to change theme normally
      const toggle = screen.getByRole('button')
      fireEvent.click(toggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain accessibility through theme changes', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
          <ThemeToggleAdvanced />
        </ThemeProvider>
      )

      const simpleToggle = screen.getAllByRole('button')[0]
      const advancedToggle = screen.getByRole('button', { name: /theme settings/i })

      // Check initial accessibility
      expect(simpleToggle).toHaveAttribute('aria-label', 'Switch to dark theme')
      expect(simpleToggle).toHaveAttribute('aria-pressed', 'false')
      expect(advancedToggle).toHaveAttribute('aria-expanded', 'false')

      // Change theme
      fireEvent.click(simpleToggle)

      await waitFor(() => {
        expect(simpleToggle).toHaveAttribute('aria-label', 'Switch to light theme')
        expect(simpleToggle).toHaveAttribute('aria-pressed', 'true')
      })

      // Open dropdown
      fireEvent.click(advancedToggle)

      await waitFor(() => {
        expect(advancedToggle).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })
    })

    it('should support keyboard navigation across theme controls', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
          <ThemeToggleAdvanced />
        </ThemeProvider>
      )

      // Tab through controls
      await userEvent.tab()
      const simpleToggle = screen.getAllByRole('button')[0]
      expect(simpleToggle).toHaveFocus()

      // Activate with keyboard
      await userEvent.keyboard('{Enter}')
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // Tab to advanced toggle
      await userEvent.tab()
      const advancedToggle = screen.getByRole('button', { name: /theme settings/i })
      expect(advancedToggle).toHaveFocus()

      // Open with keyboard
      await userEvent.keyboard('{Enter}')
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      // Navigate menu with keyboard
      await userEvent.keyboard('{ArrowDown}')
      await userEvent.keyboard('{ArrowDown}')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(localStorage.getItem('themeMode')).toBe('dark')
      })
    })
  })
})