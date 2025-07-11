import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/slices/authStore';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { RouteGuardContext } from '../types';

interface RouteGuardProps {
  children: React.ReactNode;
  /** Custom guard function */
  guard: (context: RouteGuardContext) => boolean | Promise<boolean>;
  /** Loading component while checking guard */
  loader?: React.ComponentType;
  /** Fallback component when guard fails */
  fallback?: React.ComponentType<{ context: RouteGuardContext }>;
  /** Redirect path when guard fails */
  redirectTo?: string;
  /** Error boundary for guard function errors */
  onError?: (error: Error, context: RouteGuardContext) => void;
  /** Cache guard results */
  cache?: boolean;
  /** Cache key (required if cache is true) */
  cacheKey?: string;
}

// Cache for guard results
const guardCache = new Map<string, boolean>();

/**
 * Default error component
 */
const DefaultError: React.FC<{ context: RouteGuardContext }> = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-red-600">Guard Error</h1>
      <p className="mt-2 text-lg text-gray-600">
        An error occurred while checking access permissions
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  </div>
);

/**
 * Generic route guard wrapper that supports custom guard functions
 * Provides loading states, error boundaries, and caching
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  guard,
  loader: LoaderComponent = LoadingScreen,
  fallback: FallbackComponent = DefaultError,
  redirectTo,
  onError,
  cache = false,
  cacheKey,
}) => {
  const { user } = useAuthStore();
  const location = useLocation();
  const params = useParams();
  const [checking, setChecking] = useState(!cache || !cacheKey || !guardCache.has(cacheKey));
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkGuard = async () => {
      // Check cache first
      if (cache && cacheKey && guardCache.has(cacheKey)) {
        setAllowed(guardCache.get(cacheKey)!);
        setChecking(false);
        return;
      }

      try {
        setChecking(true);
        setError(null);

        // Build guard context
        const context: RouteGuardContext = {
          user,
          route: {
            id: location.pathname,
            path: location.pathname,
            component: null as any, // Not available in this context
            meta: { title: '' }, // Not available in this context
          },
          params: params as Record<string, string>,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        };

        // Execute guard function
        const result = await Promise.resolve(guard(context));

        // Cache result if enabled
        if (cache && cacheKey) {
          guardCache.set(cacheKey, result);
        }

        setAllowed(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Guard check failed');
        setError(error);
        
        // Call error handler if provided
        if (onError) {
          onError(error, {
            user,
            route: {
              id: location.pathname,
              path: location.pathname,
              component: null as any,
              meta: { title: '' },
            },
            params: params as Record<string, string>,
            query: Object.fromEntries(new URLSearchParams(location.search)),
          });
        }
      } finally {
        setChecking(false);
      }
    };

    checkGuard();
  }, [guard, user, location, params, cache, cacheKey, onError]);

  // Clear cache on unmount if no cache key (route-specific cache)
  useEffect(() => {
    return () => {
      if (cache && !cacheKey) {
        guardCache.clear();
      }
    };
  }, [cache, cacheKey]);

  // Show loading state
  if (checking) {
    return <LoaderComponent />;
  }

  // Show error state
  if (error) {
    return (
      <FallbackComponent
        context={{
          user,
          route: {
            id: location.pathname,
            path: location.pathname,
            component: null as any,
            meta: { title: '' },
          },
          params: params as Record<string, string>,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        }}
      />
    );
  }

  // Guard check failed
  if (!allowed) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    return (
      <FallbackComponent
        context={{
          user,
          route: {
            id: location.pathname,
            path: location.pathname,
            component: null as any,
            meta: { title: '' },
          },
          params: params as Record<string, string>,
          query: Object.fromEntries(new URLSearchParams(location.search)),
        }}
      />
    );
  }

  // Guard check passed
  return <>{children}</>;
};