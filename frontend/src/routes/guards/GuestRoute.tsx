import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/slices/authStore';
import { LoadingScreen } from '@/components/common/LoadingScreen';

interface GuestRouteProps {
  children: React.ReactNode;
  /** Path to redirect authenticated users */
  redirectTo?: string;
  /** Show loading state while checking auth */
  showLoader?: boolean;
  /** Custom loading component */
  loader?: React.ComponentType;
}

/**
 * Guest route component - only allows access for non-authenticated users
 * Redirects authenticated users to dashboard or specified path
 */
export const GuestRoute: React.FC<GuestRouteProps> = ({
  children,
  redirectTo = '/dashboard',
  showLoader = true,
  loader: LoaderComponent = LoadingScreen,
}) => {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const location = useLocation();

  // Show loading state during auth check
  if (!isInitialized) {
    return showLoader ? <LoaderComponent /> : null;
  }

  // Redirect authenticated users
  if (isAuthenticated) {
    // Check if there's a redirect location from before login
    const from = location.state?.from?.pathname || redirectTo;
    return <Navigate to={from} replace />;
  }

  // Render guest content
  return <>{children}</>;
};