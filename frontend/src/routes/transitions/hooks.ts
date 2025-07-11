import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { TransitionMode } from './PageTransitions';
import { useTransitionProvider } from './TransitionProvider';

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
  mode?: TransitionMode;
  duration?: number;
  onEnter?: () => void;
  onExit?: () => void;
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}

export const useRouteTransition = (options: RouteTransitionOptions = {}) => {
  const location = useLocation();
  const { settings } = useTransitionProvider();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      setIsTransitioning(true);
      setTransitionPhase('exit');
      
      if (options.onTransitionStart) {
        options.onTransitionStart();
      }
      
      if (options.onExit) {
        options.onExit();
      }

      const effectiveDuration = (options.duration || 0.3) * settings.speedMultiplier;
      
      const enterTimer = setTimeout(() => {
        setTransitionPhase('enter');
        
        if (options.onEnter) {
          options.onEnter();
        }
      }, effectiveDuration * 500);

      const completeTimer = setTimeout(() => {
        setIsTransitioning(false);
        setTransitionPhase('idle');
        
        if (options.onTransitionEnd) {
          options.onTransitionEnd();
        }
      }, effectiveDuration * 1000);

      previousPathRef.current = location.pathname;

      return () => {
        clearTimeout(enterTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [location.pathname, options, settings.speedMultiplier]);

  return {
    isTransitioning,
    transitionPhase,
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

// Hook for controlling page transitions programmatically
export const usePageTransition = () => {
  const location = useLocation();
  const { settings, updateSettings, setRouteTransition } = useTransitionProvider();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTransition = useCallback((duration?: number) => {
    setIsTransitioning(true);
    const effectiveDuration = (duration || 0.3) * settings.speedMultiplier * 1000;

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, effectiveDuration);
  }, [settings.speedMultiplier]);

  const completeTransition = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    setIsTransitioning(false);
  }, []);

  const setTransitionMode = useCallback((mode: TransitionMode, path?: string) => {
    if (path) {
      setRouteTransition(path, { mode });
    } else {
      updateSettings({ defaultTransition: mode });
    }
  }, [setRouteTransition, updateSettings]);

  const setTransitionSpeed = useCallback((multiplier: number) => {
    updateSettings({ speedMultiplier: Math.max(0.1, Math.min(10, multiplier)) });
  }, [updateSettings]);

  const disableTransitions = useCallback(() => {
    updateSettings({ enabled: false });
  }, [updateSettings]);

  const enableTransitions = useCallback(() => {
    updateSettings({ enabled: true });
  }, [updateSettings]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  return {
    isTransitioning,
    startTransition,
    completeTransition,
    setTransitionMode,
    setTransitionSpeed,
    disableTransitions,
    enableTransitions,
    currentPath: location.pathname,
    transitionsEnabled: settings.enabled,
  };
};

// Hook for detecting navigation direction
export const useNavigationDirection = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null);
  const historyRef = useRef<string[]>([location.pathname]);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    if (currentPath !== previousPath) {
      if (navigationType === 'POP') {
        // Browser back/forward navigation
        setDirection('backward');
        
        // Remove the last path from history
        const lastIndex = historyRef.current.lastIndexOf(currentPath);
        if (lastIndex > 0) {
          historyRef.current = historyRef.current.slice(0, lastIndex + 1);
        }
      } else {
        // Forward navigation (PUSH or REPLACE)
        setDirection('forward');
        
        // Add to history
        historyRef.current.push(currentPath);
        
        // Limit history size
        if (historyRef.current.length > 50) {
          historyRef.current = historyRef.current.slice(-50);
        }
      }

      previousPathRef.current = currentPath;
    }
  }, [location.pathname, navigationType]);

  return direction;
};

// Hook for tracking transition state
interface TransitionState {
  isEntering: boolean;
  isExiting: boolean;
  isActive: boolean;
  phase: 'idle' | 'exit' | 'enter';
  progress: number;
  direction: 'forward' | 'backward' | null;
}

export const useTransitionState = (duration: number = 300) => {
  const location = useLocation();
  const direction = useNavigationDirection();
  const { settings } = useTransitionProvider();
  const [state, setState] = useState<TransitionState>({
    isEntering: false,
    isExiting: false,
    isActive: false,
    phase: 'idle',
    progress: 0,
    direction: null,
  });
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const phaseRef = useRef<'idle' | 'exit' | 'enter'>('idle');

  const updateProgress = useCallback(() => {
    if (!startTimeRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);

    setState(prev => ({
      ...prev,
      progress: phaseRef.current === 'exit' ? progress : 1 - progress,
    }));

    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else if (phaseRef.current === 'exit') {
      // Start enter phase
      phaseRef.current = 'enter';
      startTimeRef.current = Date.now();
      setState(prev => ({
        ...prev,
        isExiting: false,
        isEntering: true,
        phase: 'enter',
        progress: 0,
        direction,
      }));
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      // Complete transition
      phaseRef.current = 'idle';
      setState({
        isEntering: false,
        isExiting: false,
        isActive: false,
        phase: 'idle',
        progress: 1,
        direction: null,
      });
    }
  }, [duration]);

  useEffect(() => {
    // Start exit phase
    phaseRef.current = 'exit';
    startTimeRef.current = Date.now();
    setState({
      isEntering: false,
      isExiting: true,
      isActive: true,
      phase: 'exit',
      progress: 0,
      direction,
    });

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [location.pathname, updateProgress, direction]);

  return state;
};

// Hook for animated route transitions with gesture support
export const useGestureTransition = () => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const { settings } = useTransitionProvider();
  
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  const handleDrag = useCallback((event: any, info: any) => {
    if (settings.enabled && !settings.reducedMotion) {
      setDragX(info.offset.x);
    }
  }, [settings.enabled, settings.reducedMotion]);
  
  const handleDragEnd = useCallback((event: any, info: any) => {
    setIsDragging(false);
    
    // Trigger navigation based on drag distance
    if (Math.abs(info.offset.x) > 100) {
      if (info.offset.x > 0) {
        // Navigate back
        window.history.back();
      } else {
        // Navigate forward
        window.history.forward();
      }
    }
    
    setDragX(0);
  }, []);
  
  return {
    dragX,
    isDragging,
    dragProps: {
      drag: 'x',
      dragConstraints: { left: -200, right: 200 },
      dragElastic: 0.2,
      onDragStart: handleDragStart,
      onDrag: handleDrag,
      onDragEnd: handleDragEnd,
    },
  };
};

// Hook for transition performance monitoring
export const useTransitionPerformance = () => {
  const [metrics, setMetrics] = useState({
    fps: 60,
    duration: 0,
    dropped: 0,
  });
  const frameCountRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const startMonitoring = useCallback(() => {
    startTimeRef.current = performance.now();
    frameCountRef.current = 0;
    
    const measureFrame = () => {
      frameCountRef.current++;
      
      const elapsed = performance.now() - (startTimeRef.current || 0);
      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        setMetrics(prev => ({
          ...prev,
          fps,
          duration: elapsed,
          dropped: Math.max(0, 60 - fps),
        }));
        
        startTimeRef.current = performance.now();
        frameCountRef.current = 0;
      }
      
      animationFrameRef.current = requestAnimationFrame(measureFrame);
    };
    
    animationFrameRef.current = requestAnimationFrame(measureFrame);
  }, []);
  
  const stopMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);
  
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);
  
  return {
    metrics,
    startMonitoring,
    stopMonitoring,
  };
};