import {
  getThemePreference,
  getResolvedTheme,
  applyTheme,
  toggleTheme,
  initializeTheme,
  getSystemTheme
} from '../theme'

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

describe('Theme Utilities', () => {
  let originalMatchMedia: typeof window.matchMedia
  let originalDocumentElement: HTMLElement

  beforeEach(() => {
    // Store originals
    originalMatchMedia = window.matchMedia
    originalDocumentElement = document.documentElement

    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => {
      if (query === '(prefers-color-scheme: dark)') {
        return mockMatchMedia(false)
      }
      return mockMatchMedia(false)
    })

    // Clear localStorage
    localStorage.clear()

    // Reset DOM
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    document.documentElement = originalDocumentElement
  })

  describe('getThemePreference', () => {
    it('should return system by default', () => {
      expect(getThemePreference()).toBe('system')
    })

    it('should return saved theme preference', () => {
      localStorage.setItem('theme', 'dark')
      expect(getThemePreference()).toBe('dark')
    })

    it('should validate theme preference', () => {
      localStorage.setItem('theme', 'invalid-theme')
      expect(getThemePreference()).toBe('system')
    })
  })

  describe('getSystemTheme', () => {
    it('should return light when system prefers light', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mockMatchMedia(false)
        }
        return mockMatchMedia(false)
      })

      expect(getSystemTheme()).toBe('light')
    })

    it('should return dark when system prefers dark', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mockMatchMedia(true)
        }
        return mockMatchMedia(false)
      })

      expect(getSystemTheme()).toBe('dark')
    })
  })

  describe('getResolvedTheme', () => {
    it('should return light for light mode', () => {
      expect(getResolvedTheme('light')).toBe('light')
    })

    it('should return dark for dark mode', () => {
      expect(getResolvedTheme('dark')).toBe('dark')
    })

    it('should return system theme when mode is system', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mockMatchMedia(true)
        }
        return mockMatchMedia(false)
      })

      expect(getResolvedTheme('system')).toBe('dark')
    })

    it('should default to light for invalid mode', () => {
      expect(getResolvedTheme('invalid' as any)).toBe('light')
    })
  })

  describe('applyTheme', () => {
    it('should apply light theme to DOM', () => {
      applyTheme('light')

      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('should apply dark theme to DOM', () => {
      applyTheme('dark')

      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('should apply smooth transition when requested', () => {
      const addEventListenerSpy = vi.spyOn(document.documentElement, 'addEventListener')
      
      applyTheme('dark', true)

      expect(document.documentElement.classList.contains('theme-transition')).toBe(true)
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'transitionend',
        expect.any(Function),
        { once: true }
      )

      // Simulate transition end
      const transitionEndHandler = addEventListenerSpy.mock.calls[0][1] as EventListener
      transitionEndHandler(new Event('transitionend'))

      expect(document.documentElement.classList.contains('theme-transition')).toBe(false)

      addEventListenerSpy.mockRestore()
    })

    it('should not apply transition when not requested', () => {
      applyTheme('dark', false)

      expect(document.documentElement.classList.contains('theme-transition')).toBe(false)
    })
  })

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      localStorage.setItem('theme', 'light')
      
      const newTheme = toggleTheme()

      expect(newTheme).toBe('dark')
      expect(localStorage.getItem('theme')).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should toggle from dark to light', () => {
      localStorage.setItem('theme', 'dark')
      
      const newTheme = toggleTheme()

      expect(newTheme).toBe('light')
      expect(localStorage.getItem('theme')).toBe('light')
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })

    it('should toggle from system to opposite of system theme', () => {
      localStorage.setItem('theme', 'system')
      
      // Mock system prefers light
      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mockMatchMedia(false)
        }
        return mockMatchMedia(false)
      })

      const newTheme = toggleTheme()

      expect(newTheme).toBe('dark')
      expect(localStorage.getItem('theme')).toBe('dark')
    })

    it('should handle invalid stored theme', () => {
      localStorage.setItem('theme', 'invalid')
      
      const newTheme = toggleTheme()

      expect(newTheme).toBe('dark')
      expect(localStorage.getItem('theme')).toBe('dark')
    })
  })

  describe('initializeTheme', () => {
    it('should initialize with stored theme preference', () => {
      localStorage.setItem('theme', 'dark')
      
      initializeTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('should initialize with system theme when preference is system', () => {
      localStorage.setItem('theme', 'system')
      
      // Mock dark system preference
      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mockMatchMedia(true)
        }
        return mockMatchMedia(false)
      })

      initializeTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should apply transition when requested', () => {
      localStorage.setItem('theme', 'light')
      
      initializeTheme(true)

      expect(document.documentElement.classList.contains('theme-transition')).toBe(true)
    })

    it('should add no-transition class when transition is false', () => {
      initializeTheme(false)

      expect(document.documentElement.classList.contains('no-transition')).toBe(true)
    })

    it('should handle initialization errors gracefully', () => {
      // Mock localStorage to throw error
      const originalGetItem = Storage.prototype.getItem
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

      expect(() => initializeTheme()).not.toThrow()

      Storage.prototype.getItem = originalGetItem
      consoleSpy.mockRestore()
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing window.matchMedia', () => {
      // @ts-ignore
      delete window.matchMedia

      expect(getSystemTheme()).toBe('light')
      expect(getResolvedTheme('system')).toBe('light')

      window.matchMedia = originalMatchMedia
    })

    it('should handle localStorage quota exceeded', () => {
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError')
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation()

      expect(() => toggleTheme()).not.toThrow()

      Storage.prototype.setItem = originalSetItem
      consoleSpy.mockRestore()
    })

    it('should handle concurrent theme changes', () => {
      // Simulate rapid theme changes
      const themes: Array<'light' | 'dark'> = []
      
      for (let i = 0; i < 10; i++) {
        const theme = toggleTheme()
        themes.push(theme)
      }

      // Should alternate between light and dark
      expect(themes[0]).toBe('dark')
      expect(themes[1]).toBe('light')
      expect(themes[2]).toBe('dark')
    })
  })

  describe('CSS Custom Properties', () => {
    it('should update CSS variables for light theme', () => {
      applyTheme('light')

      const styles = window.getComputedStyle(document.documentElement)
      
      // Check that theme-specific CSS variables would be applied
      // Note: In a real environment, these would be set by CSS
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })

    it('should update CSS variables for dark theme', () => {
      applyTheme('dark')

      const styles = window.getComputedStyle(document.documentElement)
      
      // Check that theme-specific CSS variables would be applied
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })
})