import type { NavigationMiddleware, NavigationContext, MiddlewareResult } from './types';

// Auth check middleware
export const createAuthMiddleware = (
  isAuthenticated: () => boolean,
  loginRoute: string = '/login'
): NavigationMiddleware => {
  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.some(route => 
      context.to.pathname?.startsWith(route)
    );

    if (!isPublicRoute && !isAuthenticated()) {
      return {
        allow: false,
        redirect: `${loginRoute}?redirect=${encodeURIComponent(context.to.pathname || '/')}`,
        reason: 'Authentication required',
      };
    }

    return { allow: true };
  };
};

// Permission validation middleware
export const createPermissionMiddleware = (
  getPermissions: () => string[],
  routePermissions: Record<string, string[]>
): NavigationMiddleware => {
  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    const pathname = context.to.pathname || '';
    const userPermissions = getPermissions();

    // Find matching route pattern
    for (const [pattern, requiredPermissions] of Object.entries(routePermissions)) {
      if (pathname.match(new RegExp(pattern))) {
        const hasPermission = requiredPermissions.every(perm =>
          userPermissions.includes(perm)
        );

        if (!hasPermission) {
          return {
            allow: false,
            redirect: '/unauthorized',
            reason: 'Insufficient permissions',
          };
        }
      }
    }

    return { allow: true };
  };
};

// Unsaved changes guard middleware
export const createUnsavedChangesMiddleware = (
  hasUnsavedChanges: () => boolean,
  confirmMessage: string = 'You have unsaved changes. Are you sure you want to leave?'
): NavigationMiddleware => {
  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    if (hasUnsavedChanges()) {
      const confirmed = window.confirm(confirmMessage);
      
      if (!confirmed) {
        return {
          allow: false,
          reason: 'User cancelled due to unsaved changes',
        };
      }
    }

    return { allow: true };
  };
};

// Analytics tracking middleware
export const createAnalyticsMiddleware = (
  trackEvent: (eventName: string, data: any) => void
): NavigationMiddleware => {
  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    trackEvent('navigation', {
      from: context.from.pathname,
      to: context.to.pathname,
      action: context.action,
      timestamp: new Date().toISOString(),
      userId: context.userId,
    });

    return { allow: true };
  };
};

// Route logging middleware
export const createRouteLoggingMiddleware = (
  logger: (entry: any) => void,
  options: { includeTimestamp?: boolean; includeUserInfo?: boolean } = {}
): NavigationMiddleware => {
  const startTimes = new Map<string, number>();

  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    const key = `${context.from.pathname}->${context.to.pathname}`;
    const now = Date.now();

    if (startTimes.has(key)) {
      const duration = now - startTimes.get(key)!;
      startTimes.delete(key);

      logger({
        from: context.from.pathname,
        to: context.to.pathname,
        action: context.action,
        duration,
        ...(options.includeTimestamp && { timestamp: now }),
        ...(options.includeUserInfo && { userId: context.userId }),
      });
    } else {
      startTimes.set(key, now);
    }

    return { allow: true };
  };
};

// Maintenance mode check middleware
export const createMaintenanceModeMiddleware = (
  isMaintenanceMode: () => boolean | Promise<boolean>,
  maintenanceRoute: string = '/maintenance',
  allowedRoutes: string[] = []
): NavigationMiddleware => {
  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    const pathname = context.to.pathname || '';
    
    // Don't redirect if already on maintenance page or allowed route
    if (pathname === maintenanceRoute || allowedRoutes.includes(pathname)) {
      return { allow: true };
    }

    const inMaintenance = await Promise.resolve(isMaintenanceMode());
    
    if (inMaintenance) {
      return {
        allow: false,
        redirect: maintenanceRoute,
        reason: 'System is in maintenance mode',
      };
    }

    return { allow: true };
  };
};

// Feature flag validation middleware
export const createFeatureFlagMiddleware = (
  getFeatureFlags: () => Record<string, boolean> | Promise<Record<string, boolean>>,
  routeFeatureFlags: Record<string, string>
): NavigationMiddleware => {
  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    const pathname = context.to.pathname || '';
    const featureFlags = await Promise.resolve(getFeatureFlags());

    // Check if route requires specific feature flag
    for (const [pattern, requiredFlag] of Object.entries(routeFeatureFlags)) {
      if (pathname.match(new RegExp(pattern))) {
        if (!featureFlags[requiredFlag]) {
          return {
            allow: false,
            redirect: '/feature-unavailable',
            reason: `Feature "${requiredFlag}" is not enabled`,
          };
        }
      }
    }

    return { allow: true };
  };
};

// Rate limiting middleware
export const createRateLimitMiddleware = (
  maxNavigationsPerMinute: number = 60
): NavigationMiddleware => {
  const navigationHistory: number[] = [];

  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old entries
    while (navigationHistory.length > 0 && navigationHistory[0] < oneMinuteAgo) {
      navigationHistory.shift();
    }

    // Check rate limit
    if (navigationHistory.length >= maxNavigationsPerMinute) {
      return {
        allow: false,
        reason: 'Navigation rate limit exceeded',
      };
    }

    navigationHistory.push(now);
    return { allow: true };
  };
};

// Debug middleware
export const createDebugMiddleware = (
  enabled: boolean = process.env.NODE_ENV === 'development'
): NavigationMiddleware => {
  return async (context: NavigationContext): Promise<MiddlewareResult> => {
    if (enabled) {
      console.group('Navigation Middleware Debug');
      console.log('From:', context.from);
      console.log('To:', context.to);
      console.log('Action:', context.action);
      console.log('Context:', context);
      console.groupEnd();
    }

    return { allow: true };
  };
};