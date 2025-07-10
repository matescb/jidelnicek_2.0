import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../slices/authStore'
import { useUIStore } from '../slices/uiStore'

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
axios.defaults.headers.common['Content-Type'] = 'application/json'

// Request interceptor
axios.interceptors.request.use(
  (config) => {
    // Get auth token from store
    const tokens = useAuthStore.getState().tokens
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`
    }
    
    // Add request ID for tracking
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
axios.interceptors.response.use(
  (response) => {
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any
    
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
    
    // Handle other errors
    if (error.response) {
      const { status, data } = error.response
      
      // Show error toast for server errors
      if (status >= 500) {
        useUIStore.getState().showToast({
          type: 'error',
          title: 'Server Error',
          message: data.message || 'Something went wrong. Please try again later.'
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
      if (status === 422 && data.errors) {
        const firstError = Object.values(data.errors)[0]
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

// Helper functions for API calls
export const apiGet = <T = any>(url: string, config?: any) => 
  axios.get<T>(url, config).then(res => res.data)

export const apiPost = <T = any>(url: string, data?: any, config?: any) => 
  axios.post<T>(url, data, config).then(res => res.data)

export const apiPut = <T = any>(url: string, data?: any, config?: any) => 
  axios.put<T>(url, data, config).then(res => res.data)

export const apiDelete = <T = any>(url: string, config?: any) => 
  axios.delete<T>(url, config).then(res => res.data)

export const apiPatch = <T = any>(url: string, data?: any, config?: any) => 
  axios.patch<T>(url, data, config).then(res => res.data)

// Export configured axios instance
export default axios