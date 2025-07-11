import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/slices/authStore';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { useRedirectAfterLogin } from './hooks';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Require email verification for access */
  requireEmailVerification?: boolean;
  /** Show loading state while checking auth */
  showLoader?: boolean;
  /** Custom loading component */
  loader?: React.ComponentType;
  /** Redirect path when not authenticated */
  redirectTo?: string;
  /** Store current location for post-login redirect */
  rememberLocation?: boolean;
}

/**
 * Main protected route component that checks authentication status
 * and redirects to login if user is not authenticated
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireEmailVerification = false,
  showLoader = true,
  loader: LoaderComponent = LoadingScreen,
  redirectTo = '/auth/login',
  rememberLocation = true,
}) => {
  const { isAuthenticated, isInitialized, user } = useAuthStore();
  const location = useLocation();
  const { saveIntendedDestination } = useRedirectAfterLogin();

  useEffect(() => {
    // Store the attempted location for redirect after login
    if (!isAuthenticated && isInitialized && rememberLocation) {
      saveIntendedDestination(location.pathname + location.search);
    }
  }, [isAuthenticated, isInitialized, location, rememberLocation, saveIntendedDestination]);

  // Show loading state during auth check
  if (!isInitialized) {
    return showLoader ? <LoaderComponent /> : null;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check email verification requirement
  if (requireEmailVerification && user && !user.emailVerified) {
    return <Navigate to="/auth/verify-email" replace />;
  }

  // Render protected content
  return <>{children}</>;
};