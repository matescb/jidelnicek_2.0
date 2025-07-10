import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { BaseStore } from '../types'

// UI related types
export type Theme = 'light' | 'dark' | 'system'
export type Language = 'en' | 'cs'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

export interface Modal {
  id: string
  component: React.ComponentType<any>
  props?: any
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlay?: boolean
}

export interface UIStore extends BaseStore {
  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void
  
  // Language
  language: Language
  setLanguage: (language: Language) => void
  
  // Sidebar
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  
  // Mobile menu
  mobileMenuOpen: boolean
  toggleMobileMenu: () => void
  setMobileMenuOpen: (open: boolean) => void
  
  // Toasts
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
  
  // Modals
  modals: Modal[]
  openModal: (modal: Omit<Modal, 'id'>) => string
  closeModal: (id: string) => void
  closeAllModals: () => void
  
  // Loading states
  globalLoading: boolean
  loadingMessage?: string
  setGlobalLoading: (loading: boolean, message?: string) => void
  
  // Preferences
  preferences: {
    compactView: boolean
    showNutrition: boolean
    defaultServings: number
    preferredUnits: 'metric' | 'imperial'
  }
  updatePreferences: (updates: Partial<UIStore['preferences']>) => void
  
  // Utility
  resetUI: () => void
}

export const useUIStore = create<UIStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
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

      // Actions
      clearError: () => set((state) => {
        state.error = null
      }),

      // Theme
      setTheme: (theme) => {
        set((state) => {
          state.theme = theme
        })
        
        // Apply theme to document
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        
        // Save to localStorage
        localStorage.setItem('theme', theme)
      },

      // Language
      setLanguage: (language) => {
        set((state) => {
          state.language = language
        })
        
        // Save to localStorage
        localStorage.setItem('language', language)
      },

      // Sidebar
      toggleSidebar: () => {
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen
        })
      },

      setSidebarOpen: (open) => {
        set((state) => {
          state.sidebarOpen = open
        })
      },

      // Mobile menu
      toggleMobileMenu: () => {
        set((state) => {
          state.mobileMenuOpen = !state.mobileMenuOpen
        })
      },

      setMobileMenuOpen: (open) => {
        set((state) => {
          state.mobileMenuOpen = open
        })
      },

      // Toasts
      showToast: (toast) => {
        const id = `toast-${Date.now()}`
        const newToast: Toast = {
          id,
          duration: 5000,
          ...toast
        }
        
        set((state) => {
          state.toasts.push(newToast)
        })
        
        // Auto remove after duration
        if (newToast.duration && newToast.duration > 0) {
          setTimeout(() => {
            get().removeToast(id)
          }, newToast.duration)
        }
      },

      removeToast: (id) => {
        set((state) => {
          state.toasts = state.toasts.filter(t => t.id !== id)
        })
      },

      clearToasts: () => {
        set((state) => {
          state.toasts = []
        })
      },

      // Modals
      openModal: (modal) => {
        const id = `modal-${Date.now()}`
        const newModal: Modal = {
          id,
          closeOnOverlay: true,
          size: 'md',
          ...modal
        }
        
        set((state) => {
          state.modals.push(newModal)
        })
        
        return id
      },

      closeModal: (id) => {
        set((state) => {
          state.modals = state.modals.filter(m => m.id !== id)
        })
      },

      closeAllModals: () => {
        set((state) => {
          state.modals = []
        })
      },

      // Loading states
      setGlobalLoading: (loading, message) => {
        set((state) => {
          state.globalLoading = loading
          state.loadingMessage = message
        })
      },

      // Preferences
      updatePreferences: (updates) => {
        set((state) => {
          state.preferences = { ...state.preferences, ...updates }
        })
        
        // Save to localStorage
        localStorage.setItem('ui-preferences', JSON.stringify(get().preferences))
      },

      // Utility
      resetUI: () => {
        set((state) => {
          state.sidebarOpen = true
          state.mobileMenuOpen = false
          state.toasts = []
          state.modals = []
          state.globalLoading = false
          state.loadingMessage = undefined
          state.error = null
        })
      }
    })),
    {
      name: 'UIStore'
    }
  )
)

// Initialize theme and preferences on load
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('theme') as Theme
  const savedLanguage = localStorage.getItem('language') as Language
  const savedPreferences = localStorage.getItem('ui-preferences')
  
  const store = useUIStore.getState()
  
  if (savedTheme) {
    store.setTheme(savedTheme)
  } else {
    store.setTheme('system')
  }
  
  if (savedLanguage) {
    store.setLanguage(savedLanguage)
  }
  
  if (savedPreferences) {
    try {
      const preferences = JSON.parse(savedPreferences)
      store.updatePreferences(preferences)
    } catch (error) {
      console.error('Failed to load UI preferences:', error)
    }
  }
}