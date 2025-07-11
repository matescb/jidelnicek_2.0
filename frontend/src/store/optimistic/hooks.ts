import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { StoreApi } from 'zustand';
import { OptimisticActions, OptimisticUpdate } from './types';

interface OptimisticUpdateOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
  immediate?: boolean;
}

/**
 * Hook for performing optimistic updates with automatic state management
 */
export function useOptimisticUpdate<T extends OptimisticActions<any>>(
  store: StoreApi<T>,
  action: string,
  options: OptimisticUpdateOptions = {}
) {
  const optimisticUpdate = useStore(store, (state) => state.optimisticUpdate);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<any>(null);

  const execute = useCallback(
    async <P = any>(
      payload: P,
      asyncFn: () => Promise<any>,
      updateOptions?: Partial<OptimisticUpdate>
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await optimisticUpdate(action, payload, asyncFn, updateOptions);
        setData(result);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
        options.onSettled?.();
      }
    },
    [optimisticUpdate, action, options]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    execute,
    isLoading,
    error,
    data,
    reset,
  };
}

/**
 * Hook for accessing optimistic state with pending updates information
 */
export function useOptimisticState<T extends OptimisticActions<any>>(
  store: StoreApi<T>,
  selector: (state: T) => any
) {
  const state = useStore(store, selector);
  const getPendingUpdates = useStore(store, (state) => state.getPendingUpdates);
  const [pendingUpdates, setPendingUpdates] = useState<OptimisticUpdate[]>([]);

  useEffect(() => {
    // Poll for pending updates
    const interval = setInterval(() => {
      setPendingUpdates(getPendingUpdates());
    }, 100);

    return () => clearInterval(interval);
  }, [getPendingUpdates]);

  const hasPendingUpdates = pendingUpdates.length > 0;
  const pendingActions = useMemo(
    () => pendingUpdates.map(update => update.action),
    [pendingUpdates]
  );

  return {
    state,
    hasPendingUpdates,
    pendingUpdates,
    pendingActions,
  };
}

/**
 * Hook for monitoring and managing pending updates
 */
export function usePendingUpdates<T extends OptimisticActions<any>>(
  store: StoreApi<T>
) {
  const getPendingUpdates = useStore(store, (state) => state.getPendingUpdates);
  const rollback = useStore(store, (state) => state.rollback);
  const clearOptimisticState = useStore(store, (state) => state.clearOptimisticState);
  
  const [updates, setUpdates] = useState<OptimisticUpdate[]>([]);
  const [updateStats, setUpdateStats] = useState({
    total: 0,
    pending: 0,
    success: 0,
    failed: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const pendingUpdates = getPendingUpdates();
      setUpdates(pendingUpdates);
      
      // Calculate stats
      const stats = pendingUpdates.reduce(
        (acc, update) => {
          acc.total++;
          acc[update.status]++;
          return acc;
        },
        { total: 0, pending: 0, success: 0, failed: 0, rollback: 0 }
      );
      
      setUpdateStats(stats);
    }, 100);

    return () => clearInterval(interval);
  }, [getPendingUpdates]);

  const rollbackUpdate = useCallback(
    (updateId: string) => {
      rollback({ targetUpdateId: updateId });
    },
    [rollback]
  );

  const rollbackAll = useCallback(() => {
    rollback({ cascade: true });
  }, [rollback]);

  const clearAll = useCallback(() => {
    clearOptimisticState();
  }, [clearOptimisticState]);

  const getUpdatesByAction = useCallback(
    (action: string) => {
      return updates.filter(update => update.action === action);
    },
    [updates]
  );

  const getFailedUpdates = useCallback(() => {
    return updates.filter(update => update.status === 'failed');
  }, [updates]);

  return {
    updates,
    stats: updateStats,
    rollbackUpdate,
    rollbackAll,
    clearAll,
    getUpdatesByAction,
    getFailedUpdates,
  };
}

/**
 * Hook for creating optimistic mutations with React Query-like API
 */
export function useOptimisticMutation<TData = unknown, TError = unknown, TVariables = void>(
  store: StoreApi<OptimisticActions<any>>,
  action: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: OptimisticUpdateOptions & {
    optimisticData?: (variables: TVariables) => any;
    rollbackOnError?: boolean;
  } = {}
) {
  const { execute, ...rest } = useOptimisticUpdate(store, action, options);
  
  const mutate = useCallback(
    async (variables: TVariables) => {
      const optimisticPayload = options.optimisticData?.(variables) ?? variables;
      
      return execute(
        optimisticPayload,
        () => mutationFn(variables),
        {
          priority: 1,
          maxRetries: options.rollbackOnError ? 0 : 3,
        }
      );
    },
    [execute, mutationFn, options]
  );

  const mutateAsync = useCallback(
    (variables: TVariables) => mutate(variables),
    [mutate]
  );

  return {
    mutate,
    mutateAsync,
    ...rest,
  };
}

/**
 * Hook for batch optimistic updates
 */
export function useBatchOptimisticUpdate<T extends OptimisticActions<any>>(
  store: StoreApi<T>
) {
  const optimisticUpdate = useStore(store, (state) => state.optimisticUpdate);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Error[]>([]);
  const [results, setResults] = useState<any[]>([]);

  const executeBatch = useCallback(
    async (
      updates: Array<{
        action: string;
        payload: any;
        asyncFn: () => Promise<any>;
        options?: Partial<OptimisticUpdate>;
      }>
    ) => {
      setIsLoading(true);
      setErrors([]);
      setResults([]);

      const batchResults = await Promise.allSettled(
        updates.map(({ action, payload, asyncFn, options }) =>
          optimisticUpdate(action, payload, asyncFn, options)
        )
      );

      const successResults: any[] = [];
      const errorResults: Error[] = [];

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          successResults.push(result.value);
        } else {
          errorResults.push(result.reason);
        }
      });

      setResults(successResults);
      setErrors(errorResults);
      setIsLoading(false);

      return {
        results: successResults,
        errors: errorResults,
        hasErrors: errorResults.length > 0,
      };
    },
    [optimisticUpdate]
  );

  return {
    executeBatch,
    isLoading,
    errors,
    results,
    hasErrors: errors.length > 0,
  };
}