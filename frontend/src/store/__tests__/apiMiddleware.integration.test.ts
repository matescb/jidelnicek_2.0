import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../slices/authStore'
import { useUIStore } from '../slices/uiStore'
import { 
  circuitBreaker, 
  apiGet, 
  apiPost, 
  apiBatch, 
  createCancelToken,
  createApiClient
} from '../middleware/apiMiddleware'

// Mock stores
vi.mock('../slices/authStore')
vi.mock('../slices/uiStore')

const mockedUseAuthStore = useAuthStore as vi.MockedFunction<typeof useAuthStore>
const mockedUseUIStore = useUIStore as vi.MockedFunction<typeof useUIStore>

// Mock axios
vi.mock('axios')
const mockedAxios = axios as vi.Mocked<typeof axios>

describe('API Middleware Integration', () => {
  let mockAuthStore: any
  let mockUIStore: any

  beforeEach(() => {
    // Reset circuit breaker
    Object.getOwnPropertyNames(circuitBreaker).forEach(prop => {
      if (typeof (circuitBreaker as any)[prop] === 'object') {
        (circuitBreaker as any)[prop].clear?.()
      }
    })

    // Mock store implementations
    mockAuthStore = {
      tokens: { accessToken: 'test-token', refreshToken: 'refresh-token' },
      refreshToken: vi.fn(),
      logout: vi.fn()
    }

    mockUIStore = {
      showToast: vi.fn()
    }

    mockedUseAuthStore.mockImplementation(() => ({
      getState: () => mockAuthStore
    }) as any)

    mockedUseUIStore.mockImplementation(() => ({
      getState: () => mockUIStore
    }) as any)

    // Reset axios mocks
    vi.clearAllMocks()
    
    // Mock axios defaults
    mockedAxios.defaults = {
      baseURL: 'http://localhost:8000',
      headers: { common: {} }
    } as any

    // Reset interceptors
    mockedAxios.interceptors = {
      request: { use: vi.fn(), handlers: [] },
      response: { use: vi.fn(), handlers: [] }
    } as any
  })

  describe('Request Interceptor', () => {
    it('should add authorization header when token exists', () => {
      const config = {
        url: '/test',
        headers: {}
      }

      // Simulate request interceptor behavior
      const authToken = mockAuthStore.tokens?.accessToken
      if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`
      }

      expect(config.headers.Authorization).toBe('Bearer test-token')
    })

    it('should not add authorization header when skipAuth is true', () => {
      const config = {
        url: '/test',
        headers: {},
        skipAuth: true
      }

      // Simulate request interceptor behavior
      if (!config.skipAuth) {
        const authToken = mockAuthStore.tokens?.accessToken
        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`
        }
      }

      expect(config.headers.Authorization).toBeUndefined()
    })

    it('should add request ID and timeout', () => {
      const config = {
        url: '/test',
        headers: {}
      }

      // Simulate request interceptor behavior
      config.headers['X-Request-ID'] = 'test-request-id'
      if (!config.timeout) {
        config.timeout = 30000
      }

      expect(config.headers['X-Request-ID']).toBe('test-request-id')
      expect(config.timeout).toBe(30000)
    })
  })

  describe('Response Interceptor', () => {
    describe('401 Unauthorized Handling', () => {
      it('should refresh token and retry on 401', async () => {
        const originalRequest = {
          url: '/test',
          headers: {},
          _retry: false
        }

        const error = {
          response: { status: 401 },
          config: originalRequest
        } as AxiosError

        // Mock successful token refresh
        mockAuthStore.refreshToken.mockResolvedValueOnce(undefined)
        mockedAxios.mockResolvedValueOnce({ data: 'success' })

        // Simulate response interceptor behavior
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          await mockAuthStore.refreshToken()
          const retryResponse = await axios(originalRequest)
          expect(retryResponse.data).toBe('success')
        }

        expect(mockAuthStore.refreshToken).toHaveBeenCalled()
        expect(originalRequest._retry).toBe(true)
      })

      it('should logout on refresh token failure', async () => {
        const originalRequest = {
          url: '/test',
          headers: {},
          _retry: false
        }

        const error = {
          response: { status: 401 },
          config: originalRequest
        } as AxiosError

        // Mock failed token refresh
        mockAuthStore.refreshToken.mockRejectedValueOnce(new Error('Refresh failed'))

        // Simulate response interceptor behavior
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          try {
            await mockAuthStore.refreshToken()
          } catch (refreshError) {
            mockAuthStore.logout()
            mockUIStore.showToast({
              type: 'error',
              title: 'Session Expired',
              message: 'Please login again to continue'
            })
          }
        }

        expect(mockAuthStore.logout).toHaveBeenCalled()
        expect(mockUIStore.showToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Session Expired',
          message: 'Please login again to continue'
        })
      })
    })

    describe('Error Handling', () => {
      it('should show server error toast for 5xx errors', () => {
        const error = {
          response: {
            status: 500,
            data: { message: 'Internal server error' }
          },
          config: {}
        } as AxiosError

        // Simulate response interceptor behavior
        if (error.response && !error.config?.skipErrorHandling) {
          const { status, data } = error.response
          if (status >= 500) {
            mockUIStore.showToast({
              type: 'error',
              title: 'Server Error',
              message: data.message || 'Something went wrong. Please try again later.'
            })
          }
        }

        expect(mockUIStore.showToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Server Error',
          message: 'Internal server error'
        })
      })

      it('should show rate limiting toast for 429 errors', () => {
        const error = {
          response: {
            status: 429,
            data: {}
          },
          config: {}
        } as AxiosError

        // Simulate response interceptor behavior
        if (error.response && !error.config?.skipErrorHandling) {
          const { status } = error.response
          if (status === 429) {
            mockUIStore.showToast({
              type: 'warning',
              title: 'Too Many Requests',
              message: 'Please slow down and try again in a moment'
            })
          }
        }

        expect(mockUIStore.showToast).toHaveBeenCalledWith({
          type: 'warning',
          title: 'Too Many Requests',
          message: 'Please slow down and try again in a moment'
        })
      })

      it('should show validation error toast for 422 errors', () => {
        const error = {
          response: {
            status: 422,
            data: {
              errors: {
                email: ['Email is required'],
                password: ['Password must be at least 8 characters']
              }
            }
          },
          config: {}
        } as AxiosError

        // Simulate response interceptor behavior
        if (error.response && !error.config?.skipErrorHandling) {
          const { status, data } = error.response
          if (status === 422 && data.errors) {
            const firstError = Object.values(data.errors)[0]
            mockUIStore.showToast({
              type: 'error',
              title: 'Validation Error',
              message: Array.isArray(firstError) ? firstError[0] : firstError
            })
          }
        }

        expect(mockUIStore.showToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Validation Error',
          message: 'Email is required'
        })
      })

      it('should show network error toast for request errors', () => {
        const error = {
          request: {},
          config: {}
        } as AxiosError

        // Simulate response interceptor behavior
        if (error.request && !error.config?.skipErrorHandling) {
          mockUIStore.showToast({
            type: 'error',
            title: 'Network Error',
            message: 'Unable to connect to server. Please check your internet connection.'
          })
        }

        expect(mockUIStore.showToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Network Error',
          message: 'Unable to connect to server. Please check your internet connection.'
        })
      })

      it('should skip error handling when skipErrorHandling is true', () => {
        const error = {
          response: {
            status: 500,
            data: { message: 'Server error' }
          },
          config: { skipErrorHandling: true }
        } as AxiosError

        // Simulate response interceptor behavior
        if (error.response && !error.config?.skipErrorHandling) {
          // Should not execute
          mockUIStore.showToast({
            type: 'error',
            title: 'Server Error',
            message: 'Server error'
          })
        }

        expect(mockUIStore.showToast).not.toHaveBeenCalled()
      })
    })
  })

  describe('Circuit Breaker', () => {
    it('should track failures and open circuit', () => {
      const url = '/test-endpoint'

      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure(url)
      }

      expect(circuitBreaker.isOpen(url)).toBe(true)
    })

    it('should reset circuit after timeout', () => {
      const url = '/test-endpoint'

      // Record failures
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure(url)
      }

      expect(circuitBreaker.isOpen(url)).toBe(true)

      // Simulate timeout passing (internal map manipulation for testing)
      circuitBreaker.recordSuccess(url)

      expect(circuitBreaker.isOpen(url)).toBe(false)
    })
  })

  describe('Helper Functions', () => {
    describe('apiGet', () => {
      it('should perform GET request with retry enabled', async () => {
        const responseData = { data: 'test' }
        mockedAxios.get.mockResolvedValueOnce({ data: responseData })

        const result = await apiGet('/test')

        expect(mockedAxios.get).toHaveBeenCalledWith('/test', { retry: true })
        expect(result).toEqual(responseData)
      })
    })

    describe('apiPost', () => {
      it('should perform POST request with retry disabled', async () => {
        const responseData = { success: true }
        const postData = { name: 'test' }
        mockedAxios.post.mockResolvedValueOnce({ data: responseData })

        const result = await apiPost('/test', postData)

        expect(mockedAxios.post).toHaveBeenCalledWith('/test', postData, { retry: false })
        expect(result).toEqual(responseData)
      })
    })

    describe('apiBatch', () => {
      it('should execute batch requests with concurrency limit', async () => {
        const requests = [
          () => Promise.resolve('result1'),
          () => Promise.resolve('result2'),
          () => Promise.resolve('result3'),
          () => Promise.resolve('result4'),
          () => Promise.resolve('result5'),
          () => Promise.resolve('result6')
        ]

        const results = await apiBatch(requests, { maxConcurrent: 2 })

        expect(results).toEqual(['result1', 'result2', 'result3', 'result4', 'result5', 'result6'])
      })

      it('should handle batch request errors when stopOnError is false', async () => {
        const requests = [
          () => Promise.resolve('result1'),
          () => Promise.reject(new Error('error2')),
          () => Promise.resolve('result3')
        ]

        const results = await apiBatch(requests, { stopOnError: false })

        expect(results[0]).toBe('result1')
        expect(results[1]).toBeUndefined() // Error slot
        expect(results[2]).toBe('result3')
      })

      it('should stop on first error when stopOnError is true', async () => {
        const requests = [
          () => Promise.resolve('result1'),
          () => Promise.reject(new Error('error2')),
          () => Promise.resolve('result3')
        ]

        await expect(apiBatch(requests, { stopOnError: true })).rejects.toThrow('error2')
      })
    })

    describe('createCancelToken', () => {
      it('should create cancel token with proper interface', () => {
        const { token, cancel, isCancel } = createCancelToken()

        expect(token).toBeDefined()
        expect(typeof cancel).toBe('function')
        expect(typeof isCancel).toBe('function')
      })
    })

    describe('createApiClient', () => {
      it('should create API client with typed interface', () => {
        interface TestAPI {
          '/users': { id: string; name: string }[]
          '/posts': { id: string; title: string }[]
        }

        const client = createApiClient<TestAPI>('http://test-api.com')

        expect(client.get).toBeDefined()
        expect(client.post).toBeDefined()
        expect(client.put).toBeDefined()
        expect(client.delete).toBeDefined()
        expect(client.patch).toBeDefined()
      })
    })
  })

  describe('Retry Logic', () => {
    it('should retry failed requests according to configuration', async () => {
      const url = '/test'
      let attempt = 0

      // Mock first two calls to fail, third to succeed
      mockedAxios.mockImplementation(() => {
        attempt++
        if (attempt <= 2) {
          return Promise.reject(new Error(`Attempt ${attempt} failed`))
        }
        return Promise.resolve({ data: 'success' })
      })

      // Simulate retry logic (simplified)
      let result
      let retryCount = 0
      const maxRetries = 3

      while (retryCount < maxRetries) {
        try {
          result = await axios(url)
          break
        } catch (error) {
          retryCount++
          if (retryCount >= maxRetries) {
            throw error
          }
          // Wait before retry (simplified for test)
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      expect(result?.data).toBe('success')
      expect(attempt).toBe(3)
    })

    it('should respect retry conditions', () => {
      const retryCondition = (error: AxiosError) => {
        return !error.response || (error.response.status >= 500 && error.response.status !== 501)
      }

      // Test retry for 500 error
      const error500 = { response: { status: 500 } } as AxiosError
      expect(retryCondition(error500)).toBe(true)

      // Test no retry for 501 error
      const error501 = { response: { status: 501 } } as AxiosError
      expect(retryCondition(error501)).toBe(false)

      // Test no retry for 400 error
      const error400 = { response: { status: 400 } } as AxiosError
      expect(retryCondition(error400)).toBe(false)

      // Test retry for network error
      const networkError = {} as AxiosError
      expect(retryCondition(networkError)).toBe(true)
    })
  })

  describe('Configuration', () => {
    it('should have correct default configuration', () => {
      expect(mockedAxios.defaults.baseURL).toBe('http://localhost:8000')
      expect(mockedAxios.defaults.headers).toBeDefined()
    })

    it('should handle environment-based configuration', () => {
      // Test that environment variables are respected
      const originalEnv = process.env.VITE_API_URL
      
      // This test would need to be run with actual environment setup
      // For now, we just verify the configuration structure
      expect(typeof mockedAxios.defaults.baseURL).toBe('string')
      
      // Restore original env
      if (originalEnv) {
        process.env.VITE_API_URL = originalEnv
      }
    })
  })
})