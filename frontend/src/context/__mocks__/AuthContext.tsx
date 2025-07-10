import React from 'react'
import { User } from '@/types'

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: jest.Mock
  register: jest.Mock
  logout: jest.Mock
  refreshToken: jest.Mock
  updateUser: jest.Mock
}

export const mockAuthContext: AuthContextType = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  updateUser: jest.fn(),
}

export const AuthContext = React.createContext<AuthContextType | undefined>(mockAuthContext)

export const useAuth = jest.fn(() => mockAuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AuthContext.Provider value={mockAuthContext}>{children}</AuthContext.Provider>
}