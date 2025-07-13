import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react'
import { useSystemThemePreference, usePrefersReducedMotion } from '../useSystemThemePreference'

// Mock matchMedia
const createMockMediaQueryList = (matches: boolean): MediaQueryList => ({
  matches,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})

describe('useSystemThemePreference', () => {
  let originalMatchMedia: typeof window.matchMedia
  let listeners: Map<string, Array<(e: any) => void>>

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    listeners = new Map()

    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const mqList = createMockMediaQueryList(
        query === '(prefers-color-scheme: dark)' ? false : false
      )
      
      // Track listeners for each query
      if (!listeners.has(query)) {
        listeners.set(query, [])
      }

      const addListener = (listener: (e: any) => void) => {
        listeners.get(query)?.push(listener)
      }

      const removeListener = (listener: (e: any) => void) => {
        const queryListeners = listeners.get(query) || []
        const index = queryListeners.indexOf(listener)
        if (index > -1) {
          queryListeners.splice(index, 1)
        }
      }

      mqList.addEventListener = vi.fn((event, listener) => {
        if (event === 'change') addListener(listener)
      })
      
      mqList.removeEventListener = vi.fn((event, listener) => {
        if (event === 'change') removeListener(listener)
      })

      // Legacy support
      mqList.addListener = addListener as any
      mqList.removeListener = removeListener as any

      return mqList
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    listeners.clear()
  })

  describe('Initial State', () => {
    it('should return light theme by default', () => {
      const { result } = renderHook(() => useSystemThemePreference())

      expect(result.current.systemTheme).toBe('light')
      expect(result.current.isSystemDark).toBe(false)
      expect(result.current.mediaQuery).toBeDefined()
    })

    it('should return dark theme when system prefers dark', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => {
        const matches = query === '(prefers-color-scheme: dark)'
        return createMockMediaQueryList(matches)
      })

      const { result } = renderHook(() => useSystemThemePreference())

      expect(result.current.systemTheme).toBe('dark')
      expect(result.current.isSystemDark).toBe(true)
    })
  })

  describe('Theme Changes', () => {
    it('should respond to system theme changes', () => {
      const { result } = renderHook(() => useSystemThemePreference())

      expect(result.current.systemTheme).toBe('light')

      // Simulate system theme change to dark
      act(() => {
        const darkModeListeners = listeners.get('(prefers-color-scheme: dark)') || []
        darkModeListeners.forEach(listener => listener({ matches: true }))
      })

      expect(result.current.systemTheme).toBe('dark')
      expect(result.current.isSystemDark).toBe(true)

      // Change back to light
      act(() => {
        const darkModeListeners = listeners.get('(prefers-color-scheme: dark)') || []
        darkModeListeners.forEach(listener => listener({ matches: false }))
      })

      expect(result.current.systemTheme).toBe('light')
      expect(result.current.isSystemDark).toBe(false)
    })
  })

  describe('Listener Management', () => {
    it('should add and remove event listeners properly', () => {
      const mockMediaQuery = createMockMediaQueryList(false)
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery)

      const { unmount } = renderHook(() => useSystemThemePreference())

      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

      unmount()

      expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('should use legacy addListener/removeListener for older browsers', () => {
      const mockMediaQuery = {
        ...createMockMediaQueryList(false),
        addEventListener: undefined,
        removeEventListener: undefined,
      }

      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery)

      const { unmount } = renderHook(() => useSystemThemePreference())

      expect(mockMediaQuery.addListener).toHaveBeenCalled()

      unmount()

      expect(mockMediaQuery.removeListener).toHaveBeenCalled()
    })
  })

  describe('Server-Side Rendering', () => {
    it('should handle undefined window gracefully', () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      const { result } = renderHook(() => useSystemThemePreference())

      expect(result.current.systemTheme).toBe('light')
      expect(result.current.isSystemDark).toBe(false)
      expect(result.current.mediaQuery).toBeNull()

      global.window = originalWindow
    })
  })
})

describe('usePrefersReducedMotion', () => {
  let originalMatchMedia: typeof window.matchMedia
  let listeners: Array<(e: any) => void>

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    listeners = []

    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const mqList = createMockMediaQueryList(
        query === '(prefers-reduced-motion: reduce)' ? false : false
      )

      mqList.addEventListener = vi.fn((event, listener) => {
        if (event === 'change') listeners.push(listener)
      })

      mqList.removeEventListener = vi.fn((event, listener) => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      })

      // Legacy support
      mqList.addListener = ((listener: any) => listeners.push(listener)) as any
      mqList.removeListener = ((listener: any) => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }) as any

      return mqList
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    listeners = []
  })

  describe('Initial State', () => {
    it('should return false by default', () => {
      const { result } = renderHook(() => usePrefersReducedMotion())
      expect(result.current).toBe(false)
    })

    it('should return true when reduced motion is preferred', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => {
        const matches = query === '(prefers-reduced-motion: reduce)'
        return createMockMediaQueryList(matches)
      })

      const { result } = renderHook(() => usePrefersReducedMotion())
      expect(result.current).toBe(true)
    })
  })

  describe('Preference Changes', () => {
    it('should respond to reduced motion preference changes', () => {
      const { result } = renderHook(() => usePrefersReducedMotion())

      expect(result.current).toBe(false)

      // Simulate preference change to reduced motion
      act(() => {
        listeners.forEach(listener => listener({ matches: true }))
      })

      expect(result.current).toBe(true)

      // Change back
      act(() => {
        listeners.forEach(listener => listener({ matches: false }))
      })

      expect(result.current).toBe(false)
    })
  })

  describe('Listener Management', () => {
    it('should clean up listeners on unmount', () => {
      const mockMediaQuery = createMockMediaQueryList(false)
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery)

      const { unmount } = renderHook(() => usePrefersReducedMotion())

      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

      unmount()

      expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })
  })

  describe('Server-Side Rendering', () => {
    it('should handle undefined window gracefully', () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      const { result } = renderHook(() => usePrefersReducedMotion())

      expect(result.current).toBe(false)

      global.window = originalWindow
    })
  })
})