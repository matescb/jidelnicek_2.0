import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@hooks/useAuth'
import { LoadingScreen } from '@components/common/LoadingScreen'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireEmailVerification?: boolean
  requiredRole?: 'user' | 'admin'
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireEmailVerification = false,
  requiredRole,
}) => {
  const { user, isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  useEffect(() => {
    // Store the attempted location for redirect after login
    if (!isAuthenticated && !isLoading) {
      sessionStorage.setItem('redirectAfterLogin', location.pathname)
    }
  }, [isAuthenticated, isLoading, location])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  if (requireEmailVerification && user && !user.emailVerified) {
    return <Navigate to="/auth/verify-email" replace />
  }

  if (requiredRole && user && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}