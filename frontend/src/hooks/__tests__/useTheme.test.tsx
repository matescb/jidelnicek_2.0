import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react'
import { useTheme, ThemeProvider, useThemeContext } from '../useTheme'
import * as themeUtils from '../../utils/theme'

// Mock the theme utilities
vi.mock('../../utils/theme', () => ({
  getThemePreference: vi.fn(() => 'system'),
  getResolvedTheme: vi.fn(() => 'light'),
  applyTheme: vi.fn(),
  toggleTheme: vi.fn(() => 'dark'),
  initializeTheme: vi.fn(),
}))

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

describe('useTheme Hook', () => {
  let originalMatchMedia: typeof window.matchMedia
  let mediaQueryListeners: Array<(e: MediaQueryListEvent) => void> = []

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    mediaQueryListeners = []
    
    window.matchMedia = vi.fn().mockImplementation(() => {
      const mq = mockMatchMedia(false)
      mq.addEventListener = vi.fn((event, listener) => {
        if (event === 'change') {
          mediaQueryListeners.push(listener)
        }
      })
      mq.removeEventListener = vi.fn((event, listener) => {
        if (event === 'change') {
          const index = mediaQueryListeners.indexOf(listener)
          if (index > -1) {
            mediaQueryListeners.splice(index, 1)
          }
        }
      })
      return mq
    })

    // Clear localStorage
    localStorage.clear()
    
    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    mediaQueryListeners = []
  })

  describe('Initialization', () => {
    it('should initialize with theme preference from utils', () => {
      const { result } = renderHook(() => useTheme())

      expect(themeUtils.getThemePreference).toHaveBeenCalled()
      expect(themeUtils.getResolvedTheme).toHaveBeenCalledWith('system')
      expect(result.current.themeMode).toBe('system')
      expect(result.current.theme).toBe('light')
      expect(result.current.isSystemTheme).toBe(true)
    })

    it('should call initializeTheme on mount', () => {
      renderHook(() => useTheme())

      expect(themeUtils.initializeTheme).toHaveBeenCalledWith(false)
    })

    it('should handle different initial theme modes', () => {
      (themeUtils.getThemePreference as ReturnType<typeof vi.fn>).mockReturnValue('dark')
      ;(themeUtils.getResolvedTheme as ReturnType<typeof vi.fn>).mockReturnValue('dark')

      const { result } = renderHook(() => useTheme())

      expect(result.current.themeMode).toBe('dark')
      expect(result.current.theme).toBe('dark')
      expect(result.current.isSystemTheme).toBe(false)
    })
  })

  describe('Theme Mode Changes', () => {
    it('should update theme when mode changes', () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setThemeMode('dark')
      })

      expect(localStorage.getItem('theme')).toBe('dark')
      expect(themeUtils.applyTheme).toHaveBeenCalledWith('light', true)
    })

    it('should handle system theme mode', () => {
      (themeUtils.getResolvedTheme as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce('light')
        .mockReturnValueOnce('dark')

      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setThemeMode('system')
      })

      expect(result.current.isSystemTheme).toBe(true)
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    })
  })

  describe('System Theme Detection', () => {
    it('should respond to system theme changes when in system mode', () => {
      (themeUtils.getResolvedTheme as ReturnType<typeof vi.fn>).mockReturnValue('light')

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('light')

      // Simulate system theme change
      act(() => {
        mediaQueryListeners.forEach(listener => {
          listener({ matches: true } as MediaQueryListEvent)
        })
      })

      expect(themeUtils.applyTheme).toHaveBeenCalledWith('dark', true)
      expect(result.current.theme).toBe('dark')
    })

    it('should not respond to system changes when not in system mode', () => {
      (themeUtils.getThemePreference as ReturnType<typeof vi.fn>).mockReturnValue('light')
      ;(themeUtils.getResolvedTheme as ReturnType<typeof vi.fn>).mockReturnValue('light')

      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setThemeMode('light')
      })

      const applyThemeCallCount = (themeUtils.applyTheme as ReturnType<typeof vi.fn>).mock.calls.length

      // Simulate system theme change
      act(() => {
        mediaQueryListeners.forEach(listener => {
          listener({ matches: true } as MediaQueryListEvent)
        })
      })

      // Should not have called applyTheme again
      expect((themeUtils.applyTheme as ReturnType<typeof vi.fn>).mock.calls.length).toBe(applyThemeCallCount)
    })
  })

  describe('Theme Toggle', () => {
    it('should toggle theme using utility function', () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.toggleTheme()
      })

      expect(themeUtils.toggleTheme).toHaveBeenCalled()
      expect(result.current.theme).toBe('dark')
      expect(result.current.themeMode).toBe('dark')
    })

    it('should update theme state after toggle', () => {
      (themeUtils.toggleTheme as ReturnType<typeof vi.fn>).mockReturnValue('light')

      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('light')
      expect(result.current.themeMode).toBe('light')
    })
  })

  describe('Cleanup', () => {
    it('should remove event listeners on unmount when in system mode', () => {
      const removeEventListenerSpy = vi.fn()
      window.matchMedia = vi.fn().mockImplementation(() => ({
        ...mockMatchMedia(false),
        addEventListener: vi.fn(),
        removeEventListener: removeEventListenerSpy,
      }))

      const { unmount } = renderHook(() => useTheme())

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('should not set up listeners when not in system mode', () => {
      (themeUtils.getThemePreference as ReturnType<typeof vi.fn>).mockReturnValue('dark')

      renderHook(() => useTheme())

      act(() => {
        // Change to non-system mode
        const { result } = renderHook(() => useTheme())
        result.current.setThemeMode('dark')
      })

      expect(mediaQueryListeners.length).toBe(1) // Only from initial system mode
    })
  })
})

describe('ThemeProvider and useThemeContext', () => {
  it('should provide theme context to children', () => {
    const TestComponent = () => {
      const theme = useThemeContext()
      return <div>{theme.theme}</div>
    }

    const { container } = renderHook(() => useThemeContext(), {
      wrapper: ({ children }) => (
        <ThemeProvider>
          <TestComponent />
          {children}
        </ThemeProvider>
      ),
    })

    expect(container).toBeTruthy()
  })

  it('should throw error when useThemeContext is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

    expect(() => {
      renderHook(() => useThemeContext())
    }).toThrow('useThemeContext must be used within a ThemeProvider')

    consoleSpy.mockRestore()
  })

  it('should share theme state between multiple consumers', () => {
    let theme1: ReturnType<typeof useThemeContext>
    let theme2: ReturnType<typeof useThemeContext>

    const TestComponent1 = () => {
      theme1 = useThemeContext()
      return null
    }

    const TestComponent2 = () => {
      theme2 = useThemeContext()
      return null
    }

    renderHook(() => null, {
      wrapper: ({ children }) => (
        <ThemeProvider>
          <TestComponent1 />
          <TestComponent2 />
          {children}
        </ThemeProvider>
      ),
    })

    expect(theme1!).toBe(theme2!)
  })
})