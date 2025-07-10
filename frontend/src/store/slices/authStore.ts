import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import axios from 'axios'
import type { BaseStore } from '../types'

// Auth related types
export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  emailVerified: boolean
  role: 'user' | 'admin'
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export interface AuthStore extends BaseStore {
  // State
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isInitialized: boolean

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  verifyEmail: (token: string) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  checkAuth: () => Promise<void>
  setTokens: (tokens: AuthTokens | null) => void
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        user: null,
        tokens: null,
        isAuthenticated: false,
        isInitialized: false,
        loading: false,
        error: null,

        // Actions
        clearError: () => set((state) => {
          state.error = null
        }),

        setTokens: (tokens) => set((state) => {
          state.tokens = tokens
          state.isAuthenticated = !!tokens
        }),

        setUser: (user) => set((state) => {
          state.user = user
        }),

        login: async (credentials) => {
          set((state) => {
            state.loading = true
            state.error = null
          })

          try {
            const response = await axios.post('/api/v1/auth/login', credentials)
            const { user, tokens } = response.data

            set((state) => {
              state.user = user
              state.tokens = tokens
              state.isAuthenticated = true
              state.loading = false
            })

            // Set auth header for future requests
            axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`
          } catch (error: any) {
            set((state) => {
              state.loading = false
              state.error = error.response?.data?.message || 'Login failed'
            })
            throw error
          }
        },

        register: async (data) => {
          set((state) => {
            state.loading = true
            state.error = null
          })

          try {
            const response = await axios.post('/api/v1/auth/register', data)
            const { user, tokens } = response.data

            set((state) => {
              state.user = user
              state.tokens = tokens
              state.isAuthenticated = true
              state.loading = false
            })

            // Set auth header for future requests
            axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`
          } catch (error: any) {
            set((state) => {
              state.loading = false
              state.error = error.response?.data?.message || 'Registration failed'
            })
            throw error
          }
        },

        logout: async () => {
          try {
            await axios.post('/api/v1/auth/logout')
          } catch (error) {
            // Ignore logout errors
          } finally {
            set((state) => {
              state.user = null
              state.tokens = null
              state.isAuthenticated = false
            })

            // Remove auth header
            delete axios.defaults.headers.common['Authorization']
          }
        },

        refreshToken: async () => {
          const { tokens } = get()
          if (!tokens?.refreshToken) {
            throw new Error('No refresh token available')
          }

          try {
            const response = await axios.post('/api/v1/auth/refresh', {
              refreshToken: tokens.refreshToken
            })
            const newTokens = response.data.tokens

            set((state) => {
              state.tokens = newTokens
            })

            // Update auth header
            axios.defaults.headers.common['Authorization'] = `Bearer ${newTokens.accessToken}`
          } catch (error) {
            // If refresh fails, logout
            get().logout()
            throw error
          }
        },

        verifyEmail: async (token) => {
          set((state) => {
            state.loading = true
            state.error = null
          })

          try {
            await axios.post('/api/v1/auth/verify-email', { token })
            
            // Update user's email verified status
            set((state) => {
              if (state.user) {
                state.user.emailVerified = true
              }
              state.loading = false
            })
          } catch (error: any) {
            set((state) => {
              state.loading = false
              state.error = error.response?.data?.message || 'Email verification failed'
            })
            throw error
          }
        },

        forgotPassword: async (email) => {
          set((state) => {
            state.loading = true
            state.error = null
          })

          try {
            await axios.post('/api/v1/auth/forgot-password', { email })
            set((state) => {
              state.loading = false
            })
          } catch (error: any) {
            set((state) => {
              state.loading = false
              state.error = error.response?.data?.message || 'Failed to send reset email'
            })
            throw error
          }
        },

        resetPassword: async (token, password) => {
          set((state) => {
            state.loading = true
            state.error = null
          })

          try {
            await axios.post('/api/v1/auth/reset-password', { token, password })
            set((state) => {
              state.loading = false
            })
          } catch (error: any) {
            set((state) => {
              state.loading = false
              state.error = error.response?.data?.message || 'Password reset failed'
            })
            throw error
          }
        },

        updateProfile: async (data) => {
          set((state) => {
            state.loading = true
            state.error = null
          })

          try {
            const response = await axios.put('/api/v1/auth/profile', data)
            const updatedUser = response.data.user

            set((state) => {
              state.user = updatedUser
              state.loading = false
            })
          } catch (error: any) {
            set((state) => {
              state.loading = false
              state.error = error.response?.data?.message || 'Profile update failed'
            })
            throw error
          }
        },

        checkAuth: async () => {
          const { tokens } = get()
          if (!tokens?.accessToken) {
            set((state) => {
              state.isInitialized = true
            })
            return
          }

          try {
            // Set auth header
            axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`
            
            // Get current user
            const response = await axios.get('/api/v1/auth/me')
            const user = response.data.user

            set((state) => {
              state.user = user
              state.isAuthenticated = true
              state.isInitialized = true
            })
          } catch (error) {
            // Token might be expired, try to refresh
            try {
              await get().refreshToken()
              await get().checkAuth() // Retry after refresh
            } catch (refreshError) {
              // Refresh failed, logout
              get().logout()
              set((state) => {
                state.isInitialized = true
              })
            }
          }
        }
      })),
      {
        name: 'auth-storage',
        partialize: (state) => ({ tokens: state.tokens })
      }
    ),
    {
      name: 'AuthStore'
    }
  )
)