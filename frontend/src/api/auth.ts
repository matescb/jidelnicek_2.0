import { apiClient } from './client'
import { User, LoginCredentials, RegisterData, AuthTokens } from '@/types'
import { mockAuthApi } from './mockAuth'

interface AuthResponse {
  user: User
  tokens: AuthTokens
}

// Use mock auth if enabled in environment
const useMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === 'true'

export const authApi = useMockAuth ? mockAuthApi : {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/login', credentials)
    return response.data
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/register', data)
    return response.data
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  },

  async refreshToken(refreshToken: string): Promise<{ tokens: AuthTokens }> {
    const response = await apiClient.post('/auth/refresh', { refreshToken })
    return response.data
  },

  async getMe(): Promise<User> {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email })
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password })
  },

  async verifyEmail(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { token })
  },

  async resendVerificationEmail(): Promise<void> {
    await apiClient.post('/auth/resend-verification')
  },
}