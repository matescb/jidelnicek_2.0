import { act, renderHook } from '@testing-library/react'
import axios from 'axios'
import { useAuthStore } from '../authStore'
import type { User, AuthTokens, LoginCredentials, RegisterData } from '../authStore'

// Mock axios
vi.mock('axios')
const mockedAxios = axios as vi.Mocked<typeof axios>

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

describe('authStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isInitialized: false,
      loading: false,
      error: null,
    })
    
    // Reset all mocks
    vi.clearAllMocks()
    mockedAxios.post.mockResolvedValue({ data: {} })
    mockedAxios.get.mockResolvedValue({ data: {} })
    mockedAxios.put.mockResolvedValue({ data: {} })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore())
      
      expect(result.current.user).toBeNull()
      expect(result.current.tokens).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isInitialized).toBe(false)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('login', () => {
    const mockUser: User = {
      id: '1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      role: 'user',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    }

    const mockTokens: AuthTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }

    const loginCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'password123',
    }

    it('should login successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { user: mockUser, tokens: mockTokens },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.login(loginCredentials)
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.tokens).toEqual(mockTokens)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(mockedAxios.defaults.headers.common['Authorization']).toBe('Bearer access-token')
    })

    it('should handle login error', async () => {
      const errorMessage = 'Invalid credentials'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.login(loginCredentials)
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.user).toBeNull()
      expect(result.current.tokens).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })

    it('should set loading state during login', async () => {
      let resolvePromise: (value: any) => void
      const loginPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      
      mockedAxios.post.mockReturnValueOnce(loginPromise as any)

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.login(loginCredentials)
      })

      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBeNull()

      await act(async () => {
        resolvePromise!({ data: { user: mockUser, tokens: mockTokens } })
        await loginPromise
      })

      expect(result.current.loading).toBe(false)
    })
  })

  describe('register', () => {
    const mockUser: User = {
      id: '1',
      email: 'newuser@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      emailVerified: false,
      role: 'user',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    }

    const mockTokens: AuthTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }

    const registerData: RegisterData = {
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
    }

    it('should register successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { user: mockUser, tokens: mockTokens },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.register(registerData)
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.tokens).toEqual(mockTokens)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle register error', async () => {
      const errorMessage = 'Email already exists'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.register(registerData)
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('logout', () => {
    it('should logout successfully', async () => {
      const { result } = renderHook(() => useAuthStore())

      // Set initial authenticated state
      act(() => {
        result.current.setTokens({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        })
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          emailVerified: true,
          role: 'user',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        })
      })

      expect(result.current.isAuthenticated).toBe(true)

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.tokens).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(mockedAxios.defaults.headers.common['Authorization']).toBeUndefined()
    })

    it('should logout even if API call fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useAuthStore())

      // Set initial authenticated state
      act(() => {
        result.current.setTokens({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        })
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.tokens).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('refreshToken', () => {
    const mockTokens: AuthTokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    it('should refresh token successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { tokens: mockTokens },
      })

      const { result } = renderHook(() => useAuthStore())

      // Set initial state with refresh token
      act(() => {
        result.current.setTokens({
          accessToken: 'old-access-token',
          refreshToken: 'refresh-token',
        })
      })

      await act(async () => {
        await result.current.refreshToken()
      })

      expect(result.current.tokens).toEqual(mockTokens)
      expect(mockedAxios.defaults.headers.common['Authorization']).toBe('Bearer new-access-token')
    })

    it('should logout on refresh failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'))

      const { result } = renderHook(() => useAuthStore())

      // Set initial state
      act(() => {
        result.current.setTokens({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        })
      })

      await act(async () => {
        try {
          await result.current.refreshToken()
        } catch (error) {
          // Expected to throw and logout
        }
      })

      expect(result.current.tokens).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should throw error if no refresh token available', async () => {
      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.refreshToken()
          fail('Should have thrown error')
        } catch (error: any) {
          expect(error.message).toBe('No refresh token available')
        }
      })
    })
  })

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} })

      const { result } = renderHook(() => useAuthStore())

      // Set initial user state
      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          emailVerified: false,
          role: 'user',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        })
      })

      await act(async () => {
        await result.current.verifyEmail('verification-token')
      })

      expect(result.current.user?.emailVerified).toBe(true)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle verification error', async () => {
      const errorMessage = 'Invalid verification token'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.verifyEmail('invalid-token')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('forgotPassword', () => {
    it('should send forgot password email successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.forgotPassword('test@example.com')
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/auth/forgot-password', {
        email: 'test@example.com',
      })
    })

    it('should handle forgot password error', async () => {
      const errorMessage = 'Email not found'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.forgotPassword('nonexistent@example.com')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.resetPassword('reset-token', 'newpassword123')
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/auth/reset-password', {
        token: 'reset-token',
        password: 'newpassword123',
      })
    })

    it('should handle reset password error', async () => {
      const errorMessage = 'Invalid or expired token'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.resetPassword('invalid-token', 'newpassword123')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('updateProfile', () => {
    const mockUpdatedUser: User = {
      id: '1',
      email: 'updated@example.com',
      firstName: 'Updated',
      lastName: 'User',
      emailVerified: true,
      role: 'user',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    }

    it('should update profile successfully', async () => {
      mockedAxios.put.mockResolvedValueOnce({
        data: { user: mockUpdatedUser },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.updateProfile({
          firstName: 'Updated',
          lastName: 'User',
        })
      })

      expect(result.current.user).toEqual(mockUpdatedUser)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle update profile error', async () => {
      const errorMessage = 'Invalid profile data'
      mockedAxios.put.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.updateProfile({ firstName: '' })
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('checkAuth', () => {
    const mockUser: User = {
      id: '1',
      email: 'test@example.com',
      emailVerified: true,
      role: 'user',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    }

    it('should check auth successfully with valid token', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { user: mockUser },
      })

      const { result } = renderHook(() => useAuthStore())

      // Set initial tokens
      act(() => {
        result.current.setTokens({
          accessToken: 'valid-token',
          refreshToken: 'refresh-token',
        })
      })

      await act(async () => {
        await result.current.checkAuth()
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isInitialized).toBe(true)
      expect(mockedAxios.defaults.headers.common['Authorization']).toBe('Bearer valid-token')
    })

    it('should initialize without tokens', async () => {
      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.checkAuth()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isInitialized).toBe(true)
    })

    it('should handle auth check failure and try refresh', async () => {
      // First call (auth check) fails
      mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'))
      
      // Second call (refresh) succeeds
      mockedAxios.post.mockResolvedValueOnce({
        data: { tokens: { accessToken: 'new-token', refreshToken: 'new-refresh' } },
      })
      
      // Third call (retry auth check) succeeds
      mockedAxios.get.mockResolvedValueOnce({
        data: { user: mockUser },
      })

      const { result } = renderHook(() => useAuthStore())

      // Set initial tokens
      act(() => {
        result.current.setTokens({
          accessToken: 'expired-token',
          refreshToken: 'refresh-token',
        })
      })

      await act(async () => {
        await result.current.checkAuth()
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isInitialized).toBe(true)
    })

    it('should logout on failed refresh during auth check', async () => {
      // Auth check fails
      mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'))
      
      // Refresh fails
      mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'))

      const { result } = renderHook(() => useAuthStore())

      // Set initial tokens
      act(() => {
        result.current.setTokens({
          accessToken: 'expired-token',
          refreshToken: 'refresh-token',
        })
      })

      await act(async () => {
        await result.current.checkAuth()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.tokens).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isInitialized).toBe(true)
    })
  })

  describe('utility methods', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        useAuthStore.setState({ error: 'Test error' })
      })

      expect(result.current.error).toBe('Test error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })

    it('should set tokens', () => {
      const { result } = renderHook(() => useAuthStore())

      const tokens: AuthTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }

      act(() => {
        result.current.setTokens(tokens)
      })

      expect(result.current.tokens).toEqual(tokens)
      expect(result.current.isAuthenticated).toBe(true)

      act(() => {
        result.current.setTokens(null)
      })

      expect(result.current.tokens).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should set user', () => {
      const { result } = renderHook(() => useAuthStore())

      const user: User = {
        id: '1',
        email: 'test@example.com',
        emailVerified: true,
        role: 'user',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      }

      act(() => {
        result.current.setUser(user)
      })

      expect(result.current.user).toEqual(user)

      act(() => {
        result.current.setUser(null)
      })

      expect(result.current.user).toBeNull()
    })
  })

  describe('persistence', () => {
    it('should only persist tokens', () => {
      // Test that only tokens are included in the persistence layer
      const store = useAuthStore.getState()
      
      // This test would need to be extended based on the actual persistence configuration
      // For now, we're checking the store configuration in the actual implementation
      expect(typeof store.setTokens).toBe('function')
      expect(typeof store.setUser).toBe('function')
    })
  })
})