import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { useAuthStore } from '../slices/authStore'
import { useUIStore } from '../slices/uiStore'

// API Error Response types
interface ApiErrorResponse {
  message?: string
  errors?: Record<string, string | string[]>
}

// Retry configuration
interface RetryConfig {
  retries?: number
  retryDelay?: number | ((retryCount: number) => number)
  retryCondition?: (error: AxiosError) => boolean
  shouldResetTimeout?: boolean
}

// Enhanced request config
interface EnhancedAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean
  _retryCount?: number
  retry?: RetryConfig | boolean
  skipAuth?: boolean
  skipErrorHandling?: boolean
  timeout?: number
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  retries: 3,
  retryDelay: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000),
  retryCondition: (error) => {
    // Retry on network errors and 5xx errors
    return !error.response || (error.response.status >= 500 && error.response.status !== 501)
  },
  shouldResetTimeout: true
}

// Circuit breaker to prevent retry storms
class CircuitBreaker {
  private failures = new Map<string, number>()
  private lastFailureTime = new Map<string, number>()
  private readonly threshold = 5
  private readonly timeout = 60000 // 1 minute

  isOpen(url: string): boolean {
    const failures = this.failures.get(url) || 0
    const lastFailure = this.lastFailureTime.get(url) || 0
    const now = Date.now()

    // Reset if timeout has passed
    if (now - lastFailure > this.timeout) {
      this.failures.delete(url)
      this.lastFailureTime.delete(url)
      return false
    }

    return failures >= this.threshold
  }

  recordSuccess(url: string): void {
    this.failures.delete(url)
    this.lastFailureTime.delete(url)
  }

  recordFailure(url: string): void {
    const failures = (this.failures.get(url) || 0) + 1
    this.failures.set(url, failures)
    this.lastFailureTime.set(url, Date.now())
  }
}

const circuitBreaker = new CircuitBreaker()

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
axios.defaults.headers.common['Content-Type'] = 'application/json'

// Request interceptor
axios.interceptors.request.use(
  (config: EnhancedAxiosRequestConfig) => {
    // Check circuit breaker
    const url = config.url || ''
    if (circuitBreaker.isOpen(url)) {
      return Promise.reject(new Error(`Circuit breaker open for ${url}`))
    }

    // Get auth token from store
    if (!config.skipAuth) {
      const tokens = useAuthStore.getState().tokens
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`
      }
    }
    
    // Add request ID for tracking
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Add default timeout if not specified
    if (!config.timeout) {
      config.timeout = 30000 // 30 seconds
    }

    // Initialize retry configuration
    if (config.retry === true) {
      config.retry = DEFAULT_RETRY_CONFIG
    } else if (config.retry === false) {
      config.retry = undefined
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Retry logic helper
async function retryRequest(
  error: AxiosError,
  config: EnhancedAxiosRequestConfig
): Promise<AxiosResponse> {
  const retryConfig = config.retry as RetryConfig
  
  if (!retryConfig || !config) {
    throw error
  }

  const { retries = 3, retryDelay, retryCondition, shouldResetTimeout } = retryConfig
  config._retryCount = config._retryCount || 0

  if (
    config._retryCount >= retries ||
    (retryCondition && !retryCondition(error))
  ) {
    throw error
  }

  config._retryCount += 1

  // Calculate delay
  const delay = typeof retryDelay === 'function' 
    ? retryDelay(config._retryCount) 
    : retryDelay || 1000

  // Reset timeout for retry
  if (shouldResetTimeout && config.timeout) {
    config.timeout = (config.timeout as number) + delay
  }

  // Wait before retrying
  await new Promise(resolve => setTimeout(resolve, delay))

  // Log retry attempt
  console.log(`Retrying request to ${config.url} (attempt ${config._retryCount}/${retries})`)

  return axios(config)
}

// Response interceptor
axios.interceptors.response.use(
  (response) => {
    // Record success for circuit breaker
    const url = response.config.url || ''
    circuitBreaker.recordSuccess(url)
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as EnhancedAxiosRequestConfig
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        // Try to refresh token
        await useAuthStore.getState().refreshToken()
        
        // Retry original request
        return axios(originalRequest)
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout()
        
        // Show error toast
        useUIStore.getState().showToast({
          type: 'error',
          title: 'Session Expired',
          message: 'Please login again to continue'
        })
        
        // Redirect to login
        window.location.href = '/auth/login'
        
        return Promise.reject(refreshError)
      }
    }
    
    // Try retry logic if configured
    if (originalRequest?.retry && !originalRequest._retry) {
      try {
        return await retryRequest(error, originalRequest)
      } catch (retryError) {
        // Record failure for circuit breaker
        const url = originalRequest.url || ''
        circuitBreaker.recordFailure(url)
        error = retryError as AxiosError
      }
    }

    // Skip error handling if requested
    if (originalRequest?.skipErrorHandling) {
      return Promise.reject(error)
    }
    
    // Handle other errors
    if (error.response) {
      const { status, data } = error.response
      const apiError = data as ApiErrorResponse
      
      // Show error toast for server errors
      if (status >= 500) {
        useUIStore.getState().showToast({
          type: 'error',
          title: 'Server Error',
          message: apiError.message || 'Something went wrong. Please try again later.'
        })
      }
      
      // Handle rate limiting
      if (status === 429) {
        useUIStore.getState().showToast({
          type: 'warning',
          title: 'Too Many Requests',
          message: 'Please slow down and try again in a moment'
        })
      }
      
      // Handle validation errors
      if (status === 422 && apiError.errors) {
        const firstError = Object.values(apiError.errors)[0]
        useUIStore.getState().showToast({
          type: 'error',
          title: 'Validation Error',
          message: Array.isArray(firstError) ? firstError[0] : firstError
        })
      }
    } else if (error.request) {
      // Network error
      useUIStore.getState().showToast({
        type: 'error',
        title: 'Network Error',
        message: 'Unable to connect to server. Please check your internet connection.'
      })
    }
    
    return Promise.reject(error)
  }
)

// Helper functions for API calls with retry enabled by default
export const apiGet = <T = any>(url: string, config?: EnhancedAxiosRequestConfig) => 
  axios.get<T>(url, { retry: true, ...config }).then(res => res.data)

export const apiPost = <T = any>(url: string, data?: any, config?: EnhancedAxiosRequestConfig) => 
  axios.post<T>(url, data, { retry: false, ...config }).then(res => res.data)

export const apiPut = <T = any>(url: string, data?: any, config?: EnhancedAxiosRequestConfig) => 
  axios.put<T>(url, data, { retry: false, ...config }).then(res => res.data)

export const apiDelete = <T = any>(url: string, config?: EnhancedAxiosRequestConfig) => 
  axios.delete<T>(url, { retry: false, ...config }).then(res => res.data)

export const apiPatch = <T = any>(url: string, data?: any, config?: EnhancedAxiosRequestConfig) => 
  axios.patch<T>(url, data, { retry: false, ...config }).then(res => res.data)

// Batch API request helper
export async function apiBatch<T extends any[]>(
  requests: Array<() => Promise<any>>,
  options: { maxConcurrent?: number; stopOnError?: boolean } = {}
): Promise<T> {
  const { maxConcurrent = 5, stopOnError = false } = options
  const results: any[] = []
  const errors: any[] = []
  
  // Process in chunks
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const chunk = requests.slice(i, i + maxConcurrent)
    const chunkPromises = chunk.map((request, index) => 
      request()
        .then(result => { results[i + index] = result })
        .catch(error => {
          errors[i + index] = error
          if (stopOnError) throw error
        })
    )
    
    try {
      await Promise.all(chunkPromises)
    } catch (error) {
      if (stopOnError) throw error
    }
  }
  
  if (errors.length > 0 && !stopOnError) {
    console.warn('Batch API request had errors:', errors)
  }
  
  return results as T
}

// Request cancellation helper
export function createCancelToken() {
  const source = axios.CancelToken.source()
  return {
    token: source.token,
    cancel: source.cancel,
    isCancel: axios.isCancel
  }
}

// Type-safe API client factory
export function createApiClient<T extends Record<string, any>>(baseURL: string) {
  const client = axios.create({
    baseURL,
    timeout: 30000,
  })

  // Apply same interceptors
  client.interceptors.request.use(
    axios.interceptors.request.handlers[0].fulfilled,
    axios.interceptors.request.handlers[0].rejected
  )
  
  client.interceptors.response.use(
    axios.interceptors.response.handlers[0].fulfilled,
    axios.interceptors.response.handlers[0].rejected
  )

  return {
    get: <K extends keyof T>(url: K, config?: EnhancedAxiosRequestConfig) =>
      client.get<T[K]>(url as string, { retry: true, ...config }).then(res => res.data),
    
    post: <K extends keyof T>(url: K, data?: any, config?: EnhancedAxiosRequestConfig) =>
      client.post<T[K]>(url as string, data, { retry: false, ...config }).then(res => res.data),
    
    put: <K extends keyof T>(url: K, data?: any, config?: EnhancedAxiosRequestConfig) =>
      client.put<T[K]>(url as string, data, { retry: false, ...config }).then(res => res.data),
    
    delete: <K extends keyof T>(url: K, config?: EnhancedAxiosRequestConfig) =>
      client.delete<T[K]>(url as string, { retry: false, ...config }).then(res => res.data),
    
    patch: <K extends keyof T>(url: K, data?: any, config?: EnhancedAxiosRequestConfig) =>
      client.patch<T[K]>(url as string, data, { retry: false, ...config }).then(res => res.data),
  }
}

// Export configured axios instance and utilities
export default axios
export { circuitBreaker, DEFAULT_RETRY_CONFIG }
export type { RetryConfig, EnhancedAxiosRequestConfig }