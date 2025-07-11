import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/slices/authStore';
import { UserRole, RouteGuardContext } from '../types';
import { hasRole, hasAnyRole, hasAllRoles, isAdmin } from './guards';

/**
 * Custom hook for route guard functionality
 */
export const useRouteGuard = (
  guard: (context: RouteGuardContext) => boolean | Promise<boolean>
) => {
  const { user } = useAuthStore();
  const location = useLocation();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkGuard = async () => {
      try {
        setIsChecking(true);
        setError(null);

        const context: RouteGuardContext = {
          user,
          route: {
            id: location.pathname,
            path: location.pathname,
            component: null as any,
            meta: { title: '' },
          },
          params: {},
          query: Object.fromEntries(new URLSearchParams(location.search)),
        };

        const result = await Promise.resolve(guard(context));
        setIsAllowed(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Guard check failed'));
        setIsAllowed(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkGuard();
  }, [guard, user, location]);

  return {
    isAllowed,
    isChecking,
    error,
  };
};

/**
 * Hook for checking user permissions
 */
export const usePermissions = () => {
  const { user } = useAuthStore();
  
  const checkRole = useCallback((role: UserRole): boolean => {
    if (!user) return false;
    return hasRole(user.role as UserRole, role);
  }, [user]);

  const checkAnyRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return hasAnyRole(user.role as UserRole, roles);
  }, [user]);

  const checkAllRoles = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return hasAllRoles(user.role as UserRole, roles);
  }, [user]);

  const checkAdmin = useCallback((): boolean => {
    return isAdmin(user);
  }, [user]);

  const canEdit = useCallback((resourceOwnerId: string): boolean => {
    if (!user) return false;
    return user.id === resourceOwnerId || isAdmin(user);
  }, [user]);

  const canDelete = useCallback((resourceOwnerId: string): boolean => {
    if (!user) return false;
    return user.id === resourceOwnerId || isAdmin(user);
  }, [user]);

  const canView = useCallback((resourceOwnerId: string, isPublic: boolean): boolean => {
    if (isPublic) return true;
    if (!user) return false;
    return user.id === resourceOwnerId || isAdmin(user);
  }, [user]);

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: checkAdmin(),
    checkRole,
    checkAnyRole,
    checkAllRoles,
    checkAdmin,
    canEdit,
    canDelete,
    canView,
  };
};

/**
 * Hook for managing post-login redirects
 */
export const useRedirectAfterLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const REDIRECT_KEY = 'redirectAfterLogin';
  const DEFAULT_REDIRECT = '/dashboard';

  const saveIntendedDestination = useCallback((path?: string) => {
    const destination = path || location.pathname + location.search;
    sessionStorage.setItem(REDIRECT_KEY, destination);
  }, [location]);

  const getIntendedDestination = useCallback((): string => {
    const stored = sessionStorage.getItem(REDIRECT_KEY);
    const fromState = location.state?.from?.pathname;
    
    return stored || fromState || DEFAULT_REDIRECT;
  }, [location]);

  const clearIntendedDestination = useCallback(() => {
    sessionStorage.removeItem(REDIRECT_KEY);
  }, []);

  const redirectToIntended = useCallback(() => {
    const destination = getIntendedDestination();
    clearIntendedDestination();
    navigate(destination, { replace: true });
  }, [navigate, getIntendedDestination, clearIntendedDestination]);

  const redirectToDefault = useCallback(() => {
    clearIntendedDestination();
    navigate(DEFAULT_REDIRECT, { replace: true });
  }, [navigate, clearIntendedDestination]);

  return {
    saveIntendedDestination,
    getIntendedDestination,
    clearIntendedDestination,
    redirectToIntended,
    redirectToDefault,
  };
};

/**
 * Hook for checking feature flags
 */
export const useFeatureFlags = (features: string[] = []) => {
  const checkFeature = useCallback((feature: string): boolean => {
    return features.includes(feature);
  }, [features]);

  const checkAllFeatures = useCallback((requiredFeatures: string[]): boolean => {
    return requiredFeatures.every(feature => features.includes(feature));
  }, [features]);

  const checkAnyFeature = useCallback((requiredFeatures: string[]): boolean => {
    return requiredFeatures.some(feature => features.includes(feature));
  }, [features]);

  return {
    features,
    checkFeature,
    checkAllFeatures,
    checkAnyFeature,
  };
};

/**
 * Hook for auth state with loading
 */
export const useAuthState = () => {
  const { user, isAuthenticated, isInitialized, loading } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      setAuthChecked(true);
    }
  }, [isInitialized]);

  return {
    user,
    isAuthenticated,
    isLoading: !authChecked || loading,
    isInitialized,
    authChecked,
  };
};

/**
 * Hook for protected actions
 */
export const useProtectedAction = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const executeProtected = useCallback((
    action: () => void | Promise<void>,
    options?: {
      requireAuth?: boolean;
      redirectTo?: string;
      saveLocation?: boolean;
    }
  ) => {
    const { 
      requireAuth = true, 
      redirectTo = '/auth/login',
      saveLocation = true,
    } = options || {};

    if (requireAuth && !isAuthenticated) {
      if (saveLocation) {
        sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search);
      }
      navigate(redirectTo, { state: { from: location } });
      return;
    }

    return action();
  }, [isAuthenticated, navigate, location]);

  return { executeProtected };
};