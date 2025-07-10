import { User, LoginCredentials, RegisterData, AuthTokens } from '@/types'

interface AuthResponse {
  user: User
  tokens: AuthTokens
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return {
      user: {
        id: 'user-123',
        email: credentials.email,
        firstName: 'Test',
        lastName: 'User',
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tokens: {
        access: 'mock-access-token',
        refresh: 'mock-refresh-token',
      },
    }
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    return {
      user: {
        id: 'user-123',
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tokens: {
        access: 'mock-access-token',
        refresh: 'mock-refresh-token',
      },
    }
  },

  async logout(): Promise<void> {
    return Promise.resolve()
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    return {
      access: 'new-mock-access-token',
      refresh: 'new-mock-refresh-token',
    }
  },

  async getCurrentUser(): Promise<User> {
    return {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      avatar: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  },
}