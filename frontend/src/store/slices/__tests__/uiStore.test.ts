import { act, renderHook } from '@testing-library/react'
import { useUIStore } from '../uiStore'
import type { Theme, Language, Toast, Modal } from '../uiStore'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// Mock document.documentElement
const mockDocumentElement = {
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
}
Object.defineProperty(document, 'documentElement', {
  value: mockDocumentElement,
  writable: true,
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock React component for modal testing
const MockComponent = () => null

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store state
    useUIStore.setState({
      theme: 'system',
      language: 'en',
      sidebarOpen: true,
      mobileMenuOpen: false,
      toasts: [],
      modals: [],
      globalLoading: false,
      loadingMessage: undefined,
      preferences: {
        compactView: false,
        showNutrition: true,
        defaultServings: 4,
        preferredUnits: 'metric'
      },
      loading: false,
      error: null,
    })
    
    // Reset all mocks
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useUIStore())
      
      expect(result.current.theme).toBe('system')
      expect(result.current.language).toBe('en')
      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.mobileMenuOpen).toBe(false)
      expect(result.current.toasts).toEqual([])
      expect(result.current.modals).toEqual([])
      expect(result.current.globalLoading).toBe(false)
      expect(result.current.loadingMessage).toBeUndefined()
      expect(result.current.preferences).toEqual({
        compactView: false,
        showNutrition: true,
        defaultServings: 4,
        preferredUnits: 'metric'
      })
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('theme management', () => {
    it('should set light theme', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setTheme('light')
      })

      expect(result.current.theme).toBe('light')
      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('dark')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light')
    })

    it('should set dark theme', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.theme).toBe('dark')
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark')
    })

    it('should set system theme with dark preference', () => {
      // Mock dark system preference
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true, // Dark mode
      })) as any

      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setTheme('system')
      })

      expect(result.current.theme).toBe('system')
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'system')
    })

    it('should set system theme with light preference', () => {
      // Mock light system preference
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false, // Light mode
      })) as any

      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setTheme('system')
      })

      expect(result.current.theme).toBe('system')
      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('dark')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'system')
    })
  })

  describe('language management', () => {
    it('should set language to Czech', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setLanguage('cs')
      })

      expect(result.current.language).toBe('cs')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('language', 'cs')
    })

    it('should set language to English', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setLanguage('en')
      })

      expect(result.current.language).toBe('en')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('language', 'en')
    })
  })

  describe('sidebar management', () => {
    it('should toggle sidebar', () => {
      const { result } = renderHook(() => useUIStore())

      expect(result.current.sidebarOpen).toBe(true)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.sidebarOpen).toBe(false)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.sidebarOpen).toBe(true)
    })

    it('should set sidebar open state', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setSidebarOpen(false)
      })

      expect(result.current.sidebarOpen).toBe(false)

      act(() => {
        result.current.setSidebarOpen(true)
      })

      expect(result.current.sidebarOpen).toBe(true)
    })
  })

  describe('mobile menu management', () => {
    it('should toggle mobile menu', () => {
      const { result } = renderHook(() => useUIStore())

      expect(result.current.mobileMenuOpen).toBe(false)

      act(() => {
        result.current.toggleMobileMenu()
      })

      expect(result.current.mobileMenuOpen).toBe(true)

      act(() => {
        result.current.toggleMobileMenu()
      })

      expect(result.current.mobileMenuOpen).toBe(false)
    })

    it('should set mobile menu open state', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setMobileMenuOpen(true)
      })

      expect(result.current.mobileMenuOpen).toBe(true)

      act(() => {
        result.current.setMobileMenuOpen(false)
      })

      expect(result.current.mobileMenuOpen).toBe(false)
    })
  })

  describe('toast management', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should show toast with default duration', () => {
      const { result } = renderHook(() => useUIStore())

      const toastData = {
        type: 'success' as const,
        title: 'Success!',
        message: 'Operation completed successfully'
      }

      act(() => {
        result.current.showToast(toastData)
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        ...toastData,
        duration: 5000
      })
      expect(typeof result.current.toasts[0].id).toBe('string')
    })

    it('should show toast with custom duration', () => {
      const { result } = renderHook(() => useUIStore())

      const toastData = {
        type: 'info' as const,
        title: 'Info',
        duration: 3000
      }

      act(() => {
        result.current.showToast(toastData)
      })

      expect(result.current.toasts[0].duration).toBe(3000)
    })

    it('should auto-remove toast after duration', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showToast({
          type: 'warning',
          title: 'Warning',
          duration: 2000
        })
      })

      expect(result.current.toasts).toHaveLength(1)

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(result.current.toasts).toHaveLength(0)
    })

    it('should not auto-remove toast with duration 0', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showToast({
          type: 'error',
          title: 'Error',
          duration: 0
        })
      })

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.toasts).toHaveLength(1)
    })

    it('should remove specific toast', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showToast({ type: 'info', title: 'Toast 1' })
        result.current.showToast({ type: 'info', title: 'Toast 2' })
      })

      expect(result.current.toasts).toHaveLength(2)

      const firstToastId = result.current.toasts[0].id

      act(() => {
        result.current.removeToast(firstToastId)
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Toast 2')
    })

    it('should clear all toasts', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showToast({ type: 'info', title: 'Toast 1' })
        result.current.showToast({ type: 'info', title: 'Toast 2' })
        result.current.showToast({ type: 'info', title: 'Toast 3' })
      })

      expect(result.current.toasts).toHaveLength(3)

      act(() => {
        result.current.clearToasts()
      })

      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('modal management', () => {
    it('should open modal with default settings', () => {
      const { result } = renderHook(() => useUIStore())

      const modalData = {
        component: MockComponent,
        props: { test: 'value' }
      }

      let modalId: string
      act(() => {
        modalId = result.current.openModal(modalData)
      })

      expect(result.current.modals).toHaveLength(1)
      expect(result.current.modals[0]).toMatchObject({
        ...modalData,
        id: modalId!,
        size: 'md',
        closeOnOverlay: true
      })
    })

    it('should open modal with custom settings', () => {
      const { result } = renderHook(() => useUIStore())

      const modalData = {
        component: MockComponent,
        size: 'lg' as const,
        closeOnOverlay: false
      }

      act(() => {
        result.current.openModal(modalData)
      })

      expect(result.current.modals[0]).toMatchObject({
        ...modalData
      })
    })

    it('should close specific modal', () => {
      const { result } = renderHook(() => useUIStore())

      let modalId1: string, modalId2: string

      act(() => {
        modalId1 = result.current.openModal({ component: MockComponent })
        modalId2 = result.current.openModal({ component: MockComponent })
      })

      expect(result.current.modals).toHaveLength(2)

      act(() => {
        result.current.closeModal(modalId1!)
      })

      expect(result.current.modals).toHaveLength(1)
      expect(result.current.modals[0].id).toBe(modalId2!)
    })

    it('should close all modals', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.openModal({ component: MockComponent })
        result.current.openModal({ component: MockComponent })
        result.current.openModal({ component: MockComponent })
      })

      expect(result.current.modals).toHaveLength(3)

      act(() => {
        result.current.closeAllModals()
      })

      expect(result.current.modals).toHaveLength(0)
    })
  })

  describe('loading state management', () => {
    it('should set global loading state', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setGlobalLoading(true, 'Loading data...')
      })

      expect(result.current.globalLoading).toBe(true)
      expect(result.current.loadingMessage).toBe('Loading data...')

      act(() => {
        result.current.setGlobalLoading(false)
      })

      expect(result.current.globalLoading).toBe(false)
      expect(result.current.loadingMessage).toBeUndefined()
    })

    it('should set loading without message', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setGlobalLoading(true)
      })

      expect(result.current.globalLoading).toBe(true)
      expect(result.current.loadingMessage).toBeUndefined()
    })
  })

  describe('preferences management', () => {
    it('should update preferences', () => {
      const { result } = renderHook(() => useUIStore())

      const updates = {
        compactView: true,
        defaultServings: 6
      }

      act(() => {
        result.current.updatePreferences(updates)
      })

      expect(result.current.preferences).toEqual({
        compactView: true,
        showNutrition: true,
        defaultServings: 6,
        preferredUnits: 'metric'
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ui-preferences',
        JSON.stringify(result.current.preferences)
      )
    })

    it('should partially update preferences', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.updatePreferences({ preferredUnits: 'imperial' })
      })

      expect(result.current.preferences.preferredUnits).toBe('imperial')
      expect(result.current.preferences.compactView).toBe(false) // Unchanged
      expect(result.current.preferences.showNutrition).toBe(true) // Unchanged
      expect(result.current.preferences.defaultServings).toBe(4) // Unchanged
    })
  })

  describe('utility functions', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        useUIStore.setState({ error: 'Test error' })
      })

      expect(result.current.error).toBe('Test error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })

    it('should reset UI state', () => {
      const { result } = renderHook(() => useUIStore())

      // Set some non-default state
      act(() => {
        useUIStore.setState({
          sidebarOpen: false,
          mobileMenuOpen: true,
          toasts: [{ id: '1', type: 'info', title: 'Test' }],
          modals: [{ id: '1', component: MockComponent }],
          globalLoading: true,
          loadingMessage: 'Loading...',
          error: 'Test error'
        })
      })

      act(() => {
        result.current.resetUI()
      })

      expect(result.current.sidebarOpen).toBe(true)
      expect(result.current.mobileMenuOpen).toBe(false)
      expect(result.current.toasts).toEqual([])
      expect(result.current.modals).toEqual([])
      expect(result.current.globalLoading).toBe(false)
      expect(result.current.loadingMessage).toBeUndefined()
      expect(result.current.error).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle multiple rapid toast additions', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.showToast({
            type: 'info',
            title: `Toast ${i}`
          })
        }
      })

      expect(result.current.toasts).toHaveLength(10)
      
      // All toasts should have unique IDs
      const ids = result.current.toasts.map(t => t.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(10)
    })

    it('should handle removing non-existent toast', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showToast({ type: 'info', title: 'Test' })
      })

      expect(result.current.toasts).toHaveLength(1)

      act(() => {
        result.current.removeToast('non-existent-id')
      })

      expect(result.current.toasts).toHaveLength(1) // Should remain unchanged
    })

    it('should handle closing non-existent modal', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.openModal({ component: MockComponent })
      })

      expect(result.current.modals).toHaveLength(1)

      act(() => {
        result.current.closeModal('non-existent-id')
      })

      expect(result.current.modals).toHaveLength(1) // Should remain unchanged
    })
  })

  describe('initialization', () => {
    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw errors
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      // This test verifies that the store initialization doesn't crash
      // when localStorage is unavailable or throws errors
      expect(() => {
        renderHook(() => useUIStore())
      }).not.toThrow()
    })
  })
})