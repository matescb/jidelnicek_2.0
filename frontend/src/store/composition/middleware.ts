/**
 * Composition Middleware
 * Middleware utilities for store composition
 */

import { StateCreator } from 'zustand';
import { devtools as zustandDevtools } from 'zustand/middleware';
import type {
  StoreMiddleware,
  LoggerConfig,
  PerformanceConfig,
  ActionTrackingConfig,
  TrackedAction,
} from './types';

/**
 * Logger middleware for development
 */
export function loggerMiddleware<T>(
  config: LoggerConfig = {}
): StoreMiddleware<T> {
  const {
    collapsed = true,
    diff = true,
    predicate,
    timestamp = true,
    duration = true,
    colors = {
      title: '#0066cc',
      prevState: '#9E9E9E',
      action: '#03A9F4',
      nextState: '#4CAF50',
      error: '#F44336',
    },
  } = config;

  return (stateCreator) => (set, get, api) => {
    const enhancedSet: typeof set = (partial, replace) => {
      const prevState = get();
      const startTime = performance.now();

      // Determine action type
      const actionType = typeof partial === 'function' ? 'State Update' : 'State Set';
      
      // Check predicate
      if (predicate && !predicate(prevState, { type: actionType, payload: partial })) {
        return set(partial, replace);
      }

      // Apply state change
      set(partial, replace);
      
      const nextState = get();
      const endTime = performance.now();
      const timeTaken = endTime - startTime;

      // Log to console
      const groupMethod = collapsed ? console.groupCollapsed : console.group;
      
      try {
        groupMethod(
          `%c ${actionType} ${timestamp ? `@ ${new Date().toLocaleTimeString()}` : ''} ${
            duration ? `(${timeTaken.toFixed(2)}ms)` : ''
          }`,
          `color: ${colors.title}; font-weight: bold;`
        );

        console.log('%c prev state', `color: ${colors.prevState}; font-weight: bold;`, prevState);
        console.log('%c action', `color: ${colors.action}; font-weight: bold;`, partial);
        console.log('%c next state', `color: ${colors.nextState}; font-weight: bold;`, nextState);

        if (diff) {
          console.log('%c diff', 'color: #FF6B6B; font-weight: bold;', {
            removed: findDifferences(prevState, nextState, 'removed'),
            added: findDifferences(prevState, nextState, 'added'),
            updated: findDifferences(prevState, nextState, 'updated'),
          });
        }

        console.groupEnd();
      } catch (error) {
        console.error('%c Error in logger middleware', `color: ${colors.error};`, error);
      }
    };

    return stateCreator(enhancedSet, get, api);
  };
}

/**
 * Find differences between two states
 */
function findDifferences(prevState: any, nextState: any, type: 'removed' | 'added' | 'updated'): any {
  const diff: any = {};

  if (type === 'removed') {
    for (const key in prevState) {
      if (!(key in nextState)) {
        diff[key] = prevState[key];
      }
    }
  } else if (type === 'added') {
    for (const key in nextState) {
      if (!(key in prevState)) {
        diff[key] = nextState[key];
      }
    }
  } else if (type === 'updated') {
    for (const key in nextState) {
      if (key in prevState && prevState[key] !== nextState[key]) {
        diff[key] = { prev: prevState[key], next: nextState[key] };
      }
    }
  }

  return Object.keys(diff).length > 0 ? diff : undefined;
}

/**
 * Redux DevTools integration middleware
 */
export function devtoolsMiddleware<T>(
  name = 'ZustandStore',
  options?: Parameters<typeof zustandDevtools>[1]
): StoreMiddleware<T> {
  return (stateCreator) => zustandDevtools(stateCreator, { name, ...options });
}

/**
 * Action tracking middleware
 */
export function actionTrackingMiddleware<T>(
  config: ActionTrackingConfig = {}
): StoreMiddleware<T> {
  const {
    maxActions = 100,
    persist = false,
    filter,
  } = config;

  const actions: TrackedAction[] = [];

  return (stateCreator) => (set, get, api) => {
    const enhancedSet: typeof set = (partial, replace) => {
      const startTime = performance.now();
      const actionType = typeof partial === 'function' ? 'State Update' : 'State Set';

      const action: TrackedAction = {
        type: actionType,
        payload: typeof partial === 'function' ? '[Function]' : partial,
        timestamp: Date.now(),
      };

      try {
        set(partial, replace);
        action.duration = performance.now() - startTime;
      } catch (error) {
        action.error = error as Error;
        throw error;
      } finally {
        if (!filter || filter(action)) {
          actions.push(action);
          
          // Limit actions array size
          if (actions.length > maxActions) {
            actions.shift();
          }

          // Persist if enabled
          if (persist) {
            try {
              localStorage.setItem(
                `zustand-actions-${(api as any).name || 'store'}`,
                JSON.stringify(actions)
              );
            } catch (e) {
              console.warn('Failed to persist actions:', e);
            }
          }
        }
      }
    };

    // Add getActions method to api
    (api as any).getActions = () => [...actions];
    (api as any).clearActions = () => {
      actions.length = 0;
      if (persist) {
        localStorage.removeItem(`zustand-actions-${(api as any).name || 'store'}`);
      }
    };

    // Load persisted actions if enabled
    if (persist) {
      try {
        const persistedActions = localStorage.getItem(
          `zustand-actions-${(api as any).name || 'store'}`
        );
        if (persistedActions) {
          actions.push(...JSON.parse(persistedActions));
        }
      } catch (e) {
        console.warn('Failed to load persisted actions:', e);
      }
    }

    return stateCreator(enhancedSet, get, api);
  };
}

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware<T>(
  config: PerformanceConfig = {}
): StoreMiddleware<T> {
  const {
    warnThreshold = 16, // 16ms = 60fps
    enableProfiling = true,
    logSlowUpdates = true,
  } = config;

  const updateMetrics = new Map<string, {
    count: number;
    totalTime: number;
    maxTime: number;
    minTime: number;
  }>();

  return (stateCreator) => (set, get, api) => {
    const enhancedSet: typeof set = (partial, replace) => {
      const updateId = typeof partial === 'function' ? 'function' : JSON.stringify(partial);
      const startTime = performance.now();

      if (enableProfiling && typeof performance.mark === 'function') {
        performance.mark(`zustand-update-start-${updateId}`);
      }

      set(partial, replace);

      const endTime = performance.now();
      const duration = endTime - startTime;

      if (enableProfiling && typeof performance.mark === 'function') {
        performance.mark(`zustand-update-end-${updateId}`);
        performance.measure(
          `zustand-update-${updateId}`,
          `zustand-update-start-${updateId}`,
          `zustand-update-end-${updateId}`
        );
      }

      // Update metrics
      const metrics = updateMetrics.get(updateId) || {
        count: 0,
        totalTime: 0,
        maxTime: 0,
        minTime: Infinity,
      };

      metrics.count++;
      metrics.totalTime += duration;
      metrics.maxTime = Math.max(metrics.maxTime, duration);
      metrics.minTime = Math.min(metrics.minTime, duration);

      updateMetrics.set(updateId, metrics);

      // Log slow updates
      if (logSlowUpdates && duration > warnThreshold) {
        console.warn(
          `Slow Zustand update detected: ${duration.toFixed(2)}ms`,
          {
            action: partial,
            threshold: warnThreshold,
            metrics,
          }
        );
      }
    };

    // Add performance methods to api
    (api as any).getPerformanceMetrics = () => {
      const result: any = {};
      updateMetrics.forEach((metrics, key) => {
        result[key] = {
          ...metrics,
          avgTime: metrics.totalTime / metrics.count,
        };
      });
      return result;
    };

    (api as any).clearPerformanceMetrics = () => {
      updateMetrics.clear();
    };

    return stateCreator(enhancedSet, get, api);
  };
}

/**
 * Compose multiple middleware
 */
export function composeMiddleware<T>(
  ...middlewares: StoreMiddleware<T>[]
): StoreMiddleware<T> {
  return (stateCreator) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      stateCreator
    );
  };
}

/**
 * Create conditional middleware
 */
export function conditionalMiddleware<T>(
  condition: () => boolean,
  middleware: StoreMiddleware<T>
): StoreMiddleware<T> {
  return (stateCreator) => {
    if (condition()) {
      return middleware(stateCreator);
    }
    return stateCreator;
  };
}

/**
 * Batch updates middleware
 */
export function batchingMiddleware<T>(
  batchTime = 0
): StoreMiddleware<T> {
  return (stateCreator) => (set, get, api) => {
    let batchedUpdates: Array<Parameters<typeof set>> = [];
    let batchTimeout: NodeJS.Timeout | null = null;

    const processBatch = () => {
      if (batchedUpdates.length === 0) return;

      const updates = [...batchedUpdates];
      batchedUpdates = [];

      // Apply all updates
      updates.forEach(([partial, replace]) => {
        set(partial, replace);
      });
    };

    const enhancedSet: typeof set = (partial, replace) => {
      if (batchTime === 0) {
        set(partial, replace);
        return;
      }

      batchedUpdates.push([partial, replace]);

      if (batchTimeout) {
        clearTimeout(batchTimeout);
      }

      batchTimeout = setTimeout(() => {
        batchTimeout = null;
        processBatch();
      }, batchTime);
    };

    // Add flush method
    (api as any).flush = () => {
      if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
      }
      processBatch();
    };

    return stateCreator(enhancedSet, get, api);
  };
}

/**
 * Validation middleware
 */
export function validationMiddleware<T>(
  validate: (state: T) => void | string | Error
): StoreMiddleware<T> {
  return (stateCreator) => (set, get, api) => {
    const enhancedSet: typeof set = (partial, replace) => {
      // Apply update to a copy first
      const prevState = get();
      let nextState: T;

      if (typeof partial === 'function') {
        nextState = { ...prevState, ...partial(prevState) };
      } else {
        nextState = replace ? (partial as T) : { ...prevState, ...partial };
      }

      // Validate
      try {
        const validationResult = validate(nextState);
        if (validationResult) {
          throw typeof validationResult === 'string'
            ? new Error(validationResult)
            : validationResult;
        }
      } catch (error) {
        console.error('State validation failed:', error);
        throw error;
      }

      // If validation passes, apply the update
      set(partial, replace);
    };

    return stateCreator(enhancedSet, get, api);
  };
}