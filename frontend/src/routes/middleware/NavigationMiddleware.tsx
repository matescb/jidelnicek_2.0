import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, UNSAFE_NavigationContext } from 'react-router-dom';
import type {
  NavigationContext,
  NavigationMiddleware,
  MiddlewareResult,
  MiddlewareError,
  RouteGuardOptions,
  MiddlewareChainOptions,
} from './types';

interface NavigationMiddlewareContextValue {
  registerMiddleware: (middleware: NavigationMiddleware[]) => void;
  unregisterMiddleware: (middleware: NavigationMiddleware[]) => void;
  setGlobalMiddleware: (middleware: NavigationMiddleware[]) => void;
  executeMiddleware: (context: NavigationContext) => Promise<MiddlewareResult>;
}

const NavigationMiddlewareContext = createContext<NavigationMiddlewareContextValue | null>(null);

export const useNavigationMiddleware = () => {
  const context = useContext(NavigationMiddlewareContext);
  if (!context) {
    throw new Error('useNavigationMiddleware must be used within NavigationMiddlewareProvider');
  }
  return context;
};

interface NavigationMiddlewareProviderProps {
  children: React.ReactNode;
  globalMiddleware?: NavigationMiddleware[];
  options?: RouteGuardOptions;
  chainOptions?: MiddlewareChainOptions;
}

export const NavigationMiddlewareProvider: React.FC<NavigationMiddlewareProviderProps> = ({
  children,
  globalMiddleware = [],
  options = {},
  chainOptions = { stopOnFailure: true, parallel: false, timeout: 5000 },
}) => {
  const [middleware, setMiddleware] = useState<NavigationMiddleware[]>(globalMiddleware);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const blockedNavigationRef = useRef<any>(null);
  const previousLocationRef = useRef(location);

  const executeMiddlewareChain = async (
    middlewareList: NavigationMiddleware[],
    context: NavigationContext
  ): Promise<MiddlewareResult> => {
    if (middlewareList.length === 0) {
      return { allow: true };
    }

    const executeWithTimeout = async (
      fn: NavigationMiddleware,
      ctx: NavigationContext
    ): Promise<MiddlewareResult> => {
      return Promise.race([
        Promise.resolve(fn(ctx)),
        new Promise<MiddlewareResult>((_, reject) =>
          setTimeout(() => reject(new Error('Middleware timeout')), chainOptions.timeout)
        ),
      ]);
    };

    try {
      if (chainOptions.parallel) {
        // Execute all middleware in parallel
        const results = await Promise.all(
          middlewareList.map((mw) => executeWithTimeout(mw, context))
        );
        
        // Check if any middleware blocked navigation
        const blocked = results.find((result) => !result.allow);
        return blocked || { allow: true };
      } else {
        // Execute middleware sequentially
        for (const mw of middlewareList) {
          const result = await executeWithTimeout(mw, context);
          
          if (!result.allow && chainOptions.stopOnFailure) {
            return result;
          }
        }
        
        return { allow: true };
      }
    } catch (error) {
      if (options.onError) {
        options.onError({
          middleware: 'unknown',
          error: error as Error,
          context,
        });
      }
      
      return {
        allow: false,
        redirect: options.fallbackRoute,
        reason: 'Middleware error',
      };
    }
  };

  const executeMiddleware = async (context: NavigationContext): Promise<MiddlewareResult> => {
    return executeMiddlewareChain(middleware, context);
  };

  const registerMiddleware = (newMiddleware: NavigationMiddleware[]) => {
    setMiddleware((prev) => [...prev, ...newMiddleware]);
  };

  const unregisterMiddleware = (middlewareToRemove: NavigationMiddleware[]) => {
    setMiddleware((prev) => prev.filter((mw) => !middlewareToRemove.includes(mw)));
  };

  const setGlobalMiddleware = (newMiddleware: NavigationMiddleware[]) => {
    setMiddleware(newMiddleware);
  };

  // Intercept navigation
  useEffect(() => {
    if (!navigationContext) return;

    const { navigator } = navigationContext;
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    const originalGo = navigator.go;

    const handleNavigation = async (
      to: any,
      action: 'PUSH' | 'REPLACE',
      originalMethod: Function
    ) => {
      const navigationCtx: NavigationContext = {
        from: previousLocationRef.current,
        to: typeof to === 'string' ? { pathname: to } as any : to,
        action,
        navigate,
      };

      const result = await executeMiddleware(navigationCtx);

      if (result.allow) {
        previousLocationRef.current = navigationCtx.to;
        originalMethod.call(navigator, to);
      } else if (result.redirect) {
        previousLocationRef.current = { pathname: result.redirect } as any;
        originalMethod.call(navigator, result.redirect);
      }
    };

    navigator.push = (to: any) => handleNavigation(to, 'PUSH', originalPush);
    navigator.replace = (to: any) => handleNavigation(to, 'REPLACE', originalReplace);
    
    // Handle browser back/forward
    navigator.go = async (delta: number) => {
      const navigationCtx: NavigationContext = {
        from: previousLocationRef.current,
        to: location, // This is approximate
        action: 'POP',
        navigate,
      };

      const result = await executeMiddleware(navigationCtx);

      if (result.allow) {
        originalGo.call(navigator, delta);
      }
    };

    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
      navigator.go = originalGo;
    };
  }, [navigationContext, middleware, navigate, location, executeMiddleware]);

  // Update previous location
  useEffect(() => {
    previousLocationRef.current = location;
  }, [location]);

  const value: NavigationMiddlewareContextValue = {
    registerMiddleware,
    unregisterMiddleware,
    setGlobalMiddleware,
    executeMiddleware,
  };

  return (
    <NavigationMiddlewareContext.Provider value={value}>
      {children}
    </NavigationMiddlewareContext.Provider>
  );
};

// Higher-order component for route-level middleware
export const withRouteMiddleware = (
  Component: React.ComponentType<any>,
  routeMiddleware: NavigationMiddleware[]
) => {
  return (props: any) => {
    const { registerMiddleware, unregisterMiddleware } = useNavigationMiddleware();

    useEffect(() => {
      registerMiddleware(routeMiddleware);
      return () => unregisterMiddleware(routeMiddleware);
    }, []);

    return <Component {...props} />;
  };
};