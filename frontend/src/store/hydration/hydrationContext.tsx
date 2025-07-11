/**
 * React Context for Hydration
 * 
 * Provides React components and hooks for managing state hydration
 */

import React, { createContext, useContext, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { StoreApi } from 'zustand';
import type { HydrationContextValue, HydrationState, HydrationOptions, ServerStateSnapshot } from './types';
import { 
  createServerSnapshot, 
  hydrateFromSnapshot, 
  getHydrationStatus,
  waitForStores,
  resetHydration 
} from './hydrationMiddleware';
import { isServer, isClient, getHydrationData } from './utils';

/**
 * Hydration context
 */
const HydrationContext = createContext<HydrationContextValue | null>(null);

/**
 * Hydration provider props
 */
interface HydrationProviderProps {
  children: React.ReactNode;
  /**
   * Initial server state snapshot (for SSR)
   */
  serverSnapshot?: ServerStateSnapshot | string;
  /**
   * Whether to auto-hydrate on mount
   */
  autoHydrate?: boolean;
  /**
   * Hydration options
   */
  options?: {
    parallel?: boolean;
    validate?: boolean;
  };
  /**
   * Callback when hydration completes
   */
  onHydrated?: () => void;
  /**
   * Callback on hydration error
   */
  onError?: (error: Error) => void;
}

/**
 * Hydration provider component
 */
export function HydrationProvider({
  children,
  serverSnapshot,
  autoHydrate = true,
  options = {},
  onHydrated,
  onError,
}: HydrationProviderProps): JSX.Element {
  const [state, setState] = useState<HydrationState>({
    isHydrating: false,
    isHydrated: false,
    errors: new Map(),
    hydrated: new Set(),
    pending: new Set(),
  });

  const registeredStores = useRef(new Map<string, { store: StoreApi<any>; options: HydrationOptions }>());
  const hydrationPromise = useRef<Promise<void> | null>(null);

  // Register a store for hydration
  const register = useCallback((name: string, store: StoreApi<any>, options: HydrationOptions) => {
    registeredStores.current.set(name, { store, options });
    
    // Update pending stores
    setState(prev => ({
      ...prev,
      pending: new Set([...prev.pending, name]),
    }));
  }, []);

  // Hydrate stores from snapshot
  const hydrate = useCallback(async (snapshot: ServerStateSnapshot | string): Promise<void> => {
    if (hydrationPromise.current) {
      return hydrationPromise.current;
    }

    setState(prev => ({ ...prev, isHydrating: true, errors: new Map() }));

    hydrationPromise.current = hydrateFromSnapshot(snapshot, options)
      .then(() => {
        const status = getHydrationStatus();
        setState({
          isHydrating: false,
          isHydrated: true,
          errors: new Map(),
          hydrated: new Set(status.hydrated),
          pending: new Set(status.pending),
        });
        onHydrated?.();
      })
      .catch((error: Error) => {
        setState(prev => ({
          ...prev,
          isHydrating: false,
          isHydrated: false,
          errors: new Map([...prev.errors, ['global', error]]),
        }));
        onError?.(error);
        throw error;
      })
      .finally(() => {
        hydrationPromise.current = null;
      });

    return hydrationPromise.current;
  }, [options, onHydrated, onError]);

  // Get current snapshot
  const getSnapshot = useCallback((): ServerStateSnapshot => {
    return createServerSnapshot();
  }, []);

  // Reset hydration state
  const reset = useCallback(() => {
    resetHydration();
    setState({
      isHydrating: false,
      isHydrated: false,
      errors: new Map(),
      hydrated: new Set(),
      pending: new Set(),
    });
    hydrationPromise.current = null;
  }, []);

  // Check if specific store is hydrated
  const isStoreHydrated = useCallback((name: string): boolean => {
    return state.hydrated.has(name);
  }, [state.hydrated]);

  // Auto-hydrate on mount
  useEffect(() => {
    if (!autoHydrate || isServer()) return;

    // Try to hydrate from server snapshot prop first
    if (serverSnapshot) {
      hydrate(serverSnapshot).catch(console.error);
      return;
    }

    // Try to hydrate from DOM data
    const domData = getHydrationData<ServerStateSnapshot>();
    if (domData) {
      hydrate(domData).catch(console.error);
    }
  }, [autoHydrate, serverSnapshot, hydrate]);

  // Update state when hydration status changes
  useEffect(() => {
    if (!state.isHydrating && !state.isHydrated) return;

    const interval = setInterval(() => {
      const status = getHydrationStatus();
      setState(prev => ({
        ...prev,
        hydrated: new Set(status.hydrated),
        pending: new Set(status.pending),
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [state.isHydrating, state.isHydrated]);

  const value = useMemo<HydrationContextValue>(() => ({
    state,
    register,
    hydrate,
    getSnapshot,
    reset,
    isStoreHydrated,
  }), [state, register, hydrate, getSnapshot, reset, isStoreHydrated]);

  return (
    <HydrationContext.Provider value={value}>
      {children}
    </HydrationContext.Provider>
  );
}

/**
 * Hook to access hydration context
 */
export function useHydration(): HydrationContextValue {
  const context = useContext(HydrationContext);
  if (!context) {
    throw new Error('useHydration must be used within HydrationProvider');
  }
  return context;
}

/**
 * Hook to wait for specific stores to be hydrated
 */
export function useWaitForHydration(
  storeNames: string[],
  options: {
    timeout?: number;
    onTimeout?: () => void;
  } = {}
): {
  isHydrated: boolean;
  isHydrating: boolean;
  error: Error | null;
} {
  const { state, isStoreHydrated } = useHydration();
  const [localState, setLocalState] = useState({
    isHydrated: false,
    isHydrating: true,
    error: null as Error | null,
  });

  useEffect(() => {
    // Check if already hydrated
    const allHydrated = storeNames.every(isStoreHydrated);
    if (allHydrated) {
      setLocalState({ isHydrated: true, isHydrating: false, error: null });
      return;
    }

    // Wait for hydration
    let cancelled = false;
    
    waitForStores(storeNames, options.timeout)
      .then(() => {
        if (!cancelled) {
          setLocalState({ isHydrated: true, isHydrating: false, error: null });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLocalState({ isHydrated: false, isHydrating: false, error });
          options.onTimeout?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storeNames, isStoreHydrated, options.timeout, options.onTimeout]);

  return localState;
}

/**
 * Hydration boundary component
 */
interface HydrationBoundaryProps {
  children: React.ReactNode;
  /**
   * Stores that must be hydrated before rendering children
   */
  stores?: string[];
  /**
   * Fallback to render while hydrating
   */
  fallback?: React.ReactNode;
  /**
   * Error fallback
   */
  errorFallback?: React.ComponentType<{ error: Error }>;
  /**
   * Timeout for hydration
   */
  timeout?: number;
}

/**
 * Component that waits for stores to be hydrated before rendering children
 */
export function HydrationBoundary({
  children,
  stores = [],
  fallback = null,
  errorFallback: ErrorFallback,
  timeout = 5000,
}: HydrationBoundaryProps): JSX.Element {
  const { isHydrated, isHydrating, error } = useWaitForHydration(stores, { timeout });

  // Show error state
  if (error && ErrorFallback) {
    return <ErrorFallback error={error} />;
  }

  // Show loading state
  if (isHydrating || !isHydrated) {
    return <>{fallback}</>;
  }

  // Render children when hydrated
  return <>{children}</>;
}

/**
 * HOC to wait for hydration
 */
export function withHydration<P extends object>(
  Component: React.ComponentType<P>,
  stores: string[] = [],
  options: {
    fallback?: React.ComponentType;
    errorFallback?: React.ComponentType<{ error: Error }>;
    timeout?: number;
  } = {}
): React.ComponentType<P> {
  return function HydratedComponent(props: P) {
    return (
      <HydrationBoundary
        stores={stores}
        fallback={options.fallback ? <options.fallback /> : null}
        errorFallback={options.errorFallback}
        timeout={options.timeout}
      >
        <Component {...props} />
      </HydrationBoundary>
    );
  };
}

/**
 * SSR helper to inject hydration data
 */
export function HydrationScript({ snapshot }: { snapshot: ServerStateSnapshot }): JSX.Element {
  if (isClient()) {
    return <></>;
  }

  const serialized = JSON.stringify(snapshot);
  
  return (
    <>
      <script
        id="__HYDRATION_DATA__"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: serialized }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__HYDRATION_DATA__ = ${serialized};`,
        }}
      />
    </>
  );
}

/**
 * Hook to get hydration status for a specific store
 */
export function useStoreHydrationStatus(storeName: string): {
  isHydrated: boolean;
  isPending: boolean;
  error: Error | null;
} {
  const { state, isStoreHydrated } = useHydration();

  return {
    isHydrated: isStoreHydrated(storeName),
    isPending: state.pending.has(storeName),
    error: state.errors.get(storeName) || null,
  };
}

/**
 * Hook to manually trigger hydration
 */
export function useManualHydration(): {
  hydrate: (snapshot?: ServerStateSnapshot) => Promise<void>;
  isHydrating: boolean;
  error: Error | null;
} {
  const { hydrate: contextHydrate, getSnapshot, state } = useHydration();
  const [error, setError] = useState<Error | null>(null);

  const hydrate = useCallback(async (snapshot?: ServerStateSnapshot) => {
    setError(null);
    try {
      await contextHydrate(snapshot || getSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [contextHydrate, getSnapshot]);

  return {
    hydrate,
    isHydrating: state.isHydrating,
    error: error || state.errors.get('global') || null,
  };
}