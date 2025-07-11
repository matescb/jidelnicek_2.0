import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, Location } from 'react-router-dom';
import { useNavigationMiddleware } from './NavigationMiddleware';
import type { NavigationMiddleware, NavigationBlocker, NavigationContext } from './types';

// Hook to prevent navigation
export const useNavigationGuard = (
  when: boolean,
  handler: (context: NavigationContext) => boolean | Promise<boolean>,
  message?: string
) => {
  const { registerMiddleware, unregisterMiddleware } = useNavigationMiddleware();
  const middlewareRef = useRef<NavigationMiddleware | null>(null);

  useEffect(() => {
    if (when) {
      const middleware: NavigationMiddleware = async (context) => {
        const shouldAllow = await Promise.resolve(handler(context));
        
        if (!shouldAllow) {
          if (message) {
            console.warn(`Navigation blocked: ${message}`);
          }
          return { allow: false, reason: message };
        }
        
        return { allow: true };
      };

      middlewareRef.current = middleware;
      registerMiddleware([middleware]);
    }

    return () => {
      if (middlewareRef.current) {
        unregisterMiddleware([middlewareRef.current]);
        middlewareRef.current = null;
      }
    };
  }, [when, handler, message, registerMiddleware, unregisterMiddleware]);
};

// Hook for browser close warning
export const useBeforeUnload = (
  when: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave?'
) => {
  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [when, message]);
};

// Hook to apply middleware to component
export const useRouteMiddleware = (middleware: NavigationMiddleware[]) => {
  const { registerMiddleware, unregisterMiddleware } = useNavigationMiddleware();

  useEffect(() => {
    registerMiddleware(middleware);
    return () => unregisterMiddleware(middleware);
  }, [middleware, registerMiddleware, unregisterMiddleware]);
};

// Hook to temporarily block navigation
export const useNavigationBlock = () => {
  const [blockers, setBlockers] = useState<NavigationBlocker[]>([]);
  const { registerMiddleware, unregisterMiddleware } = useNavigationMiddleware();
  const middlewareRef = useRef<NavigationMiddleware | null>(null);

  useEffect(() => {
    const activeBlockers = blockers.filter((blocker) => {
      const when = typeof blocker.when === 'function' ? blocker.when() : blocker.when;
      return when;
    });

    if (activeBlockers.length > 0) {
      const middleware: NavigationMiddleware = async (context) => {
        for (const blocker of activeBlockers) {
          if (blocker.onBlock) {
            blocker.onBlock(context);
          }
          
          if (blocker.message) {
            const confirmed = window.confirm(blocker.message);
            if (!confirmed) {
              return { allow: false, reason: `Blocked by ${blocker.id}` };
            }
          } else {
            return { allow: false, reason: `Blocked by ${blocker.id}` };
          }
        }
        
        return { allow: true };
      };

      middlewareRef.current = middleware;
      registerMiddleware([middleware]);
    }

    return () => {
      if (middlewareRef.current) {
        unregisterMiddleware([middlewareRef.current]);
        middlewareRef.current = null;
      }
    };
  }, [blockers, registerMiddleware, unregisterMiddleware]);

  const block = useCallback((blocker: Omit<NavigationBlocker, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newBlocker: NavigationBlocker = { ...blocker, id };
    
    setBlockers((prev) => [...prev, newBlocker]);
    
    return () => {
      setBlockers((prev) => prev.filter((b) => b.id !== id));
    };
  }, []);

  const unblock = useCallback((id: string) => {
    setBlockers((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const unblockAll = useCallback(() => {
    setBlockers([]);
  }, []);

  return {
    block,
    unblock,
    unblockAll,
    activeBlockers: blockers.filter((b) => 
      typeof b.when === 'function' ? b.when() : b.when
    ),
  };
};

// Hook to track navigation history
export const useNavigationHistory = (maxSize: number = 10) => {
  const location = useLocation();
  const [history, setHistory] = useState<Location[]>([location]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setHistory((prev) => {
      const newHistory = [...prev.slice(0, currentIndex + 1), location];
      return newHistory.slice(-maxSize);
    });
    setCurrentIndex((prev) => Math.min(prev + 1, maxSize - 1));
  }, [location, maxSize, currentIndex]);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  const goBack = useCallback(() => {
    if (canGoBack) {
      setCurrentIndex((prev) => prev - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [canGoBack, currentIndex, history]);

  const goForward = useCallback(() => {
    if (canGoForward) {
      setCurrentIndex((prev) => prev + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [canGoForward, currentIndex, history]);

  return {
    history,
    currentIndex,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
  };
};

// Hook for route transitions
export const useRouteTransition = (
  onEnter?: (location: Location) => void | Promise<void>,
  onExit?: (location: Location) => void | Promise<void>
) => {
  const location = useLocation();
  const previousLocationRef = useRef<Location | null>(null);

  useEffect(() => {
    const handleTransition = async () => {
      // Handle exit of previous route
      if (previousLocationRef.current && onExit) {
        await Promise.resolve(onExit(previousLocationRef.current));
      }

      // Handle enter of current route
      if (onEnter) {
        await Promise.resolve(onEnter(location));
      }

      previousLocationRef.current = location;
    };

    handleTransition();
  }, [location, onEnter, onExit]);

  return location;
};

// Hook to confirm navigation
export const useConfirmNavigation = (
  when: boolean,
  message: string = 'Are you sure you want to leave this page?'
) => {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);

  useNavigationGuard(
    when && !isConfirming,
    async (context) => {
      setPendingLocation(context.to.pathname || null);
      setIsConfirming(true);
      return false;
    }
  );

  const confirm = useCallback(() => {
    setIsConfirming(false);
    if (pendingLocation) {
      navigate(pendingLocation);
      setPendingLocation(null);
    }
  }, [navigate, pendingLocation]);

  const cancel = useCallback(() => {
    setIsConfirming(false);
    setPendingLocation(null);
  }, []);

  return {
    isConfirming,
    pendingLocation,
    confirm,
    cancel,
    message,
  };
};