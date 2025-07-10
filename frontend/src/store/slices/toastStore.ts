import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info'
export type ToastPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right'

export interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
  persistent?: boolean
  showProgress?: boolean
  onClose?: () => void
  createdAt: number
}

export interface ToastStore {
  toasts: ToastData[]
  position: ToastPosition
  maxVisible: number
  defaultDuration: number
  
  // Actions
  addToast: (toast: Omit<ToastData, 'id' | 'createdAt'>) => string
  updateToast: (id: string, updates: Partial<ToastData>) => void
  removeToast: (id: string) => void
  removeAllToasts: () => void
  
  // Settings
  setPosition: (position: ToastPosition) => void
  setMaxVisible: (max: number) => void
  setDefaultDuration: (duration: number) => void
  
  // Utility
  toast: {
    success: (title: string, description?: string, options?: Partial<ToastData>) => string
    error: (title: string, description?: string, options?: Partial<ToastData>) => string
    warning: (title: string, description?: string, options?: Partial<ToastData>) => string
    info: (title: string, description?: string, options?: Partial<ToastData>) => string
    default: (title: string, description?: string, options?: Partial<ToastData>) => string
    promise: <T>(
      promise: Promise<T>,
      messages: {
        loading: string
        success: string | ((data: T) => string)
        error: string | ((error: any) => string)
      },
      options?: Partial<ToastData>
    ) => Promise<T>
  }
}

export const useToastStore = create<ToastStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      toasts: [],
      position: 'bottom-right',
      maxVisible: 5,
      defaultDuration: 5000,

      // Actions
      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newToast: ToastData = {
          ...toast,
          id,
          createdAt: Date.now(),
          duration: toast.duration ?? get().defaultDuration,
        }

        set((state) => {
          state.toasts.push(newToast)
        })

        // Auto-remove after duration if not persistent
        if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
          setTimeout(() => {
            get().removeToast(id)
          }, newToast.duration)
        }

        return id
      },

      updateToast: (id, updates) => {
        set((state) => {
          const index = state.toasts.findIndex(t => t.id === id)
          if (index !== -1) {
            state.toasts[index] = { ...state.toasts[index], ...updates }
          }
        })
      },

      removeToast: (id) => {
        set((state) => {
          const index = state.toasts.findIndex(t => t.id === id)
          if (index !== -1) {
            const toast = state.toasts[index]
            if (toast.onClose) {
              toast.onClose()
            }
            state.toasts.splice(index, 1)
          }
        })
      },

      removeAllToasts: () => {
        set((state) => {
          // Call onClose for each toast
          state.toasts.forEach(toast => {
            if (toast.onClose) {
              toast.onClose()
            }
          })
          state.toasts = []
        })
      },

      // Settings
      setPosition: (position) => {
        set((state) => {
          state.position = position
        })
        localStorage.setItem('toast-position', position)
      },

      setMaxVisible: (max) => {
        set((state) => {
          state.maxVisible = max
        })
        localStorage.setItem('toast-max-visible', max.toString())
      },

      setDefaultDuration: (duration) => {
        set((state) => {
          state.defaultDuration = duration
        })
        localStorage.setItem('toast-default-duration', duration.toString())
      },

      // Utility methods
      toast: {
        success: (title, description, options) => {
          return get().addToast({
            title,
            description,
            variant: 'success',
            ...options,
          })
        },

        error: (title, description, options) => {
          return get().addToast({
            title,
            description,
            variant: 'error',
            ...options,
          })
        },

        warning: (title, description, options) => {
          return get().addToast({
            title,
            description,
            variant: 'warning',
            ...options,
          })
        },

        info: (title, description, options) => {
          return get().addToast({
            title,
            description,
            variant: 'info',
            ...options,
          })
        },

        default: (title, description, options) => {
          return get().addToast({
            title,
            description,
            variant: 'default',
            ...options,
          })
        },

        promise: async (promise, messages, options) => {
          const toastId = get().addToast({
            title: messages.loading,
            variant: 'default',
            persistent: true,
            showProgress: false,
            ...options,
          })

          try {
            const result = await promise
            const successMessage = typeof messages.success === 'function' 
              ? messages.success(result) 
              : messages.success

            get().updateToast(toastId, {
              title: successMessage,
              variant: 'success',
              persistent: false,
              duration: options?.duration ?? get().defaultDuration,
            })

            // Auto-remove after duration
            setTimeout(() => {
              get().removeToast(toastId)
            }, options?.duration ?? get().defaultDuration)

            return result
          } catch (error) {
            const errorMessage = typeof messages.error === 'function'
              ? messages.error(error)
              : messages.error

            get().updateToast(toastId, {
              title: errorMessage,
              variant: 'error',
              persistent: false,
              duration: options?.duration ?? get().defaultDuration,
            })

            // Auto-remove after duration
            setTimeout(() => {
              get().removeToast(toastId)
            }, options?.duration ?? get().defaultDuration)

            throw error
          }
        },
      },
    })),
    {
      name: 'ToastStore',
    }
  )
)

// Initialize settings from localStorage
if (typeof window !== 'undefined') {
  const savedPosition = localStorage.getItem('toast-position') as ToastPosition
  const savedMaxVisible = localStorage.getItem('toast-max-visible')
  const savedDefaultDuration = localStorage.getItem('toast-default-duration')

  const store = useToastStore.getState()

  if (savedPosition) {
    store.setPosition(savedPosition)
  }

  if (savedMaxVisible) {
    const max = parseInt(savedMaxVisible, 10)
    if (!isNaN(max) && max > 0) {
      store.setMaxVisible(max)
    }
  }

  if (savedDefaultDuration) {
    const duration = parseInt(savedDefaultDuration, 10)
    if (!isNaN(duration) && duration > 0) {
      store.setDefaultDuration(duration)
    }
  }
}