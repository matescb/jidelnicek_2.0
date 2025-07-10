import React, { createContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LoginCredentials, RegisterData } from '@/types'
import { authApi } from '@/api/auth'
import { tokenStorage } from '@/utils/tokenStorage'
import toast from 'react-hot-toast'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  updateUser: (user: User) => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const isAuthenticated = !!user

  // Initialize auth state from stored tokens
  useEffect(() => {
    const initAuth = async () => {
      const tokens = tokenStorage.getTokens()
      if (tokens?.accessToken) {
        try {
          const userData = await authApi.getMe()
          setUser(userData)
        } catch (error) {
          tokenStorage.clearTokens()
        }
      }
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const response = await authApi.login(credentials)
      tokenStorage.setTokens(response.tokens)
      setUser(response.user)
      
      // Redirect to stored location or dashboard
      const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/dashboard'
      sessionStorage.removeItem('redirectAfterLogin')
      navigate(redirectPath)
      
      toast.success('Successfully logged in!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to login')
      throw error
    }
  }, [navigate])

  const register = useCallback(async (data: RegisterData) => {
    try {
      const response = await authApi.register(data)
      tokenStorage.setTokens(response.tokens)
      setUser(response.user)
      navigate('/auth/verify-email')
      toast.success('Account created successfully! Please verify your email.')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to register')
      throw error
    }
  }, [navigate])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // Continue with logout even if API call fails
    }
    
    tokenStorage.clearTokens()
    setUser(null)
    navigate('/auth/login')
    toast.success('Successfully logged out')
  }, [navigate])

  const refreshToken = useCallback(async () => {
    try {
      const tokens = tokenStorage.getTokens()
      if (!tokens?.refreshToken) {
        throw new Error('No refresh token')
      }
      
      const response = await authApi.refreshToken(tokens.refreshToken)
      tokenStorage.setTokens(response.tokens)
    } catch (error) {
      await logout()
      throw error
    }
  }, [logout])

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
  }, [])

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}