import { User, LoginCredentials, RegisterData, AuthTokens } from '@/types'

interface AuthResponse {
  user: User
  tokens: AuthTokens
}

// Mock user data
const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  emailVerified: true,
  role: 'user',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
}

const mockTokens: AuthTokens = {
  accessToken: 'mock-access-token-' + Date.now(),
  refreshToken: 'mock-refresh-token-' + Date.now()
}

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const mockAuthApi = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await delay(500) // Simulate network delay
    
    // Accept any email/password for mock login
    const user = {
      ...mockUser,
      email: credentials.email
    }
    
    return {
      user,
      tokens: mockTokens
    }
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    await delay(500)
    
    const user = {
      ...mockUser,
      email: data.email,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'User',
      emailVerified: false
    }
    
    return {
      user,
      tokens: mockTokens
    }
  },

  async logout(): Promise<void> {
    await delay(200)
    // Nothing to do for mock logout
  },

  async refreshToken(refreshToken: string): Promise<{ tokens: AuthTokens }> {
    await delay(300)
    return {
      tokens: {
        ...mockTokens,
        accessToken: 'mock-access-token-refreshed-' + Date.now()
      }
    }
  },

  async getMe(): Promise<User> {
    await delay(200)
    return mockUser
  },

  async forgotPassword(email: string): Promise<void> {
    await delay(500)
    console.log('Mock: Password reset email sent to', email)
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await delay(500)
    console.log('Mock: Password reset successful')
  },

  async verifyEmail(token: string): Promise<void> {
    await delay(500)
    console.log('Mock: Email verified')
  },

  async resendVerificationEmail(): Promise<void> {
    await delay(500)
    console.log('Mock: Verification email resent')
  }
}