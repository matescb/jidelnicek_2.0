import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Progress bar state
interface ProgressBarState {
  progress: number;
  isLoading: boolean;
}

const progressBarState: ProgressBarState = {
  progress: 0,
  isLoading: false,
};

const progressListeners = new Set<(state: ProgressBarState) => void>();

const notifyProgressListeners = () => {
  progressListeners.forEach(listener => listener(progressBarState));
};

// Hook for controlling the progress bar
export const useProgressBar = () => {
  const [state, setState] = useState<ProgressBarState>(progressBarState);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const listener = (newState: ProgressBarState) => {
      setState(newState);
    };

    progressListeners.add(listener);
    return () => {
      progressListeners.delete(listener);
    };
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    progressBarState.progress = 0;
    progressBarState.isLoading = true;
    notifyProgressListeners();

    // Simulate progress
    intervalRef.current = setInterval(() => {
      if (progressBarState.progress < 90) {
        const increment = Math.random() * 10;
        progressBarState.progress = Math.min(90, progressBarState.progress + increment);
        notifyProgressListeners();
      }
    }, 200);
  }, []);

  const complete = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    progressBarState.progress = 100;
    notifyProgressListeners();

    // Hide after completion
    setTimeout(() => {
      progressBarState.isLoading = false;
      progressBarState.progress = 0;
      notifyProgressListeners();
    }, 300);
  }, []);

  const setProgress = useCallback((progress: number) => {
    progressBarState.progress = Math.min(100, Math.max(0, progress));
    notifyProgressListeners();
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    progress: state.progress,
    isLoading: state.isLoading,
    start,
    complete,
    setProgress,
  };
};

// Hook for route transitions
interface RouteTransitionOptions {
  mode?: 'fade' | 'slide' | 'scale' | 'none';
  duration?: number;
  onEnter?: () => void;
  onExit?: () => void;
}

export const useRouteTransition = (options: RouteTransitionOptions = {}) => {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      setIsTransitioning(true);
      
      if (options.onExit) {
        options.onExit();
      }

      const timer = setTimeout(() => {
        setIsTransitioning(false);
        
        if (options.onEnter) {
          options.onEnter();
        }
      }, (options.duration || 0.3) * 1000);

      previousPathRef.current = location.pathname;

      return () => clearTimeout(timer);
    }
  }, [location.pathname, options]);

  return {
    isTransitioning,
    currentPath: location.pathname,
    previousPath: previousPathRef.current,
  };
};

// Hook for loading states
interface LoadingStateOptions {
  delay?: number;
  minimum?: number;
}

export const useLoadingState = (
  isLoading: boolean,
  options: LoadingStateOptions = {}
) => {
  const { delay = 200, minimum = 500 } = options;
  const [showLoading, setShowLoading] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      // Start delay timer
      timeoutRef.current = setTimeout(() => {
        setShowLoading(true);
        setStartTime(Date.now());
      }, delay);
    } else {
      // Clear delay timer if loading finished before delay
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // If loading was shown, ensure minimum duration
      if (showLoading && startTime) {
        const elapsed = Date.now() - startTime;
        const remaining = minimum - elapsed;

        if (remaining > 0) {
          setTimeout(() => {
            setShowLoading(false);
            setStartTime(null);
          }, remaining);
        } else {
          setShowLoading(false);
          setStartTime(null);
        }
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, delay, minimum, showLoading, startTime]);

  return showLoading;
};

// Hook for progressive loading
interface ProgressiveLoadingState {
  header: boolean;
  content: boolean;
  sidebar: boolean;
}

export const useProgressiveLoading = (duration: number = 1000) => {
  const [loadingState, setLoadingState] = useState<ProgressiveLoadingState>({
    header: false,
    content: false,
    sidebar: false,
  });

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Progressive loading sequence
    timers.push(
      setTimeout(() => {
        setLoadingState(prev => ({ ...prev, header: true }));
      }, duration * 0.2)
    );

    timers.push(
      setTimeout(() => {
        setLoadingState(prev => ({ ...prev, sidebar: true }));
      }, duration * 0.5)
    );

    timers.push(
      setTimeout(() => {
        setLoadingState(prev => ({ ...prev, content: true }));
      }, duration * 0.8)
    );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [duration]);

  const reset = useCallback(() => {
    setLoadingState({
      header: false,
      content: false,
      sidebar: false,
    });
  }, []);

  return { ...loadingState, reset };
};

// Hook for managing multiple loading states
export const useMultipleLoadingStates = <T extends Record<string, boolean>>(
  initialStates: T
) => {
  const [loadingStates, setLoadingStates] = useState(initialStates);

  const setLoading = useCallback((key: keyof T, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading,
    }));
  }, []);

  const setMultiple = useCallback((updates: Partial<T>) => {
    setLoadingStates(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const isAnyLoading = Object.values(loadingStates).some(state => state);
  const isAllLoading = Object.values(loadingStates).every(state => state);

  return {
    states: loadingStates,
    setLoading,
    setMultiple,
    isAnyLoading,
    isAllLoading,
  };
};

// Hook for animated list loading
export const useAnimatedListLoading = <T>(
  items: T[],
  options: { delay?: number; stagger?: number } = {}
) => {
  const { delay = 0, stagger = 100 } = options;
  const [visibleItems, setVisibleItems] = useState<number[]>([]);

  useEffect(() => {
    setVisibleItems([]);
    const timers: NodeJS.Timeout[] = [];

    items.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleItems(prev => [...prev, index]);
      }, delay + index * stagger);
      
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [items, delay, stagger]);

  return visibleItems;
};

// Hook for route prefetching
export const useRoutePrefetch = () => {
  const prefetchedRoutes = useRef(new Set<string>());

  const prefetch = useCallback(async (path: string) => {
    if (prefetchedRoutes.current.has(path)) {
      return;
    }

    prefetchedRoutes.current.add(path);

    // Implement your prefetching logic here
    // For example, preload route components or data
    try {
      // Dynamic import example:
      // await import(`../pages${path}`);
      console.log(`Prefetched route: ${path}`);
    } catch (error) {
      console.error(`Failed to prefetch route: ${path}`, error);
      prefetchedRoutes.current.delete(path);
    }
  }, []);

  const isPrefetched = useCallback((path: string) => {
    return prefetchedRoutes.current.has(path);
  }, []);

  return { prefetch, isPrefetched };
};