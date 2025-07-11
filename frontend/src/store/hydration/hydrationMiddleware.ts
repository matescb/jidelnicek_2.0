/**
 * Hydration Middleware for Zustand
 * 
 * Main hydration middleware with server-side state hydration support for SSR,
 * client-side rehydration, partial hydration, and state transformation
 */

import { StateCreator, StoreApi } from 'zustand';
import type { HydrationOptions, HydrationQueueItem, ServerStateSnapshot } from './types';
import { serialize, deserialize } from './stateSerializer';
import { deepMerge, shallowMerge, measureHydrationTime, isServer, isClient } from './utils';

/**
 * Global hydration registry
 */
const HYDRATION_REGISTRY = new Map<string, {
  store: StoreApi<any>;
  options: HydrationOptions;
}>();

/**
 * Hydration queue for managing dependencies
 */
const HYDRATION_QUEUE: HydrationQueueItem[] = [];
const HYDRATED_STORES = new Set<string>();
const HYDRATION_PROMISES = new Map<string, Promise<void>>();

/**
 * Hydration middleware factory
 */
export const hydrationMiddleware = <
  T,
  Mps extends [['zustand/hydration', never], ...any[]] = [['zustand/hydration', never]],
  Mcs extends [['zustand/hydration', never], ...any[]] = [['zustand/hydration', never]]
>(
  options: HydrationOptions<T>
) => (
  f: StateCreator<T, Mps, Mcs>
): StateCreator<T, Mps, Mcs> => (set, get, api) => {
  // Type assertion to work with the store API
  const store = api as StoreApi<T> & {
    hydrate?: (state: Partial<T>) => void;
    getHydrationOptions?: () => HydrationOptions<T>;
  };

  // Register store for hydration
  HYDRATION_REGISTRY.set(options.name, {
    store: store as StoreApi<any>,
    options: options as HydrationOptions,
  });

  // Add hydration methods to store
  store.hydrate = (state: Partial<T>) => {
    measureHydrationTime(() => {
      hydrateStore(options.name, state, options);
    }, `Hydrate ${options.name}`);
  };

  store.getHydrationOptions = () => options;

  // Initialize the store
  const state = f(set, get, api);

  // Auto-hydrate if data is available (client-side)
  if (isClient() && !options.skip) {
    scheduleHydration(options.name);
  }

  return state;
};

/**
 * Hydrate a specific store
 */
function hydrateStore<T>(
  name: string,
  state: Partial<T>,
  options: HydrationOptions<T>
): void {
  const registration = HYDRATION_REGISTRY.get(name);
  if (!registration) {
    throw new Error(`Store "${name}" not registered for hydration`);
  }

  const { store } = registration;

  try {
    // Validate state if validator provided
    if (options.validate && !options.validate(state)) {
      throw new Error(`Invalid state shape for store "${name}"`);
    }

    // Transform state if transformer provided
    let transformedState = state;
    if (options.transform) {
      transformedState = options.transform(state);
    }

    // Get current state
    const currentState = store.getState();

    // Apply merge strategy
    let mergedState: T;
    if (options.merge === 'shallow') {
      mergedState = shallowMerge(currentState, transformedState);
    } else if (options.merge === 'deep') {
      mergedState = deepMerge(currentState, transformedState);
    } else if (typeof options.merge === 'function') {
      mergedState = options.merge(currentState, transformedState);
    } else {
      // Default to shallow merge
      mergedState = { ...currentState, ...transformedState };
    }

    // Update store state
    store.setState(mergedState);

    // Mark as hydrated
    HYDRATED_STORES.add(name);

    // Call success callback
    options.onHydrated?.(mergedState);

    // Process dependent stores
    processDependentStores(name);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[Hydration] Failed to hydrate store "${name}":`, err);
    options.onError?.(err);
    throw err;
  }
}

/**
 * Schedule hydration for a store
 */
function scheduleHydration(name: string): void {
  const registration = HYDRATION_REGISTRY.get(name);
  if (!registration) return;

  const { options } = registration;

  // Check dependencies
  if (options.dependencies && options.dependencies.length > 0) {
    const unhydratedDeps = options.dependencies.filter(dep => !HYDRATED_STORES.has(dep));
    if (unhydratedDeps.length > 0) {
      // Add to queue for later processing
      HYDRATION_QUEUE.push({
        name,
        store: registration.store,
        options,
      });
      return;
    }
  }

  // Try to hydrate immediately
  const hydrationData = getClientHydrationData();
  if (hydrationData && hydrationData.stores[name]) {
    hydrateStore(name, hydrationData.stores[name], options);
  }
}

/**
 * Process stores that depend on the newly hydrated store
 */
function processDependentStores(hydratedStoreName: string): void {
  const toProcess: HydrationQueueItem[] = [];
  
  // Find stores that were waiting for this one
  for (let i = HYDRATION_QUEUE.length - 1; i >= 0; i--) {
    const item = HYDRATION_QUEUE[i];
    if (item.options.dependencies?.includes(hydratedStoreName)) {
      // Check if all dependencies are now satisfied
      const allDepsHydrated = item.options.dependencies.every(dep => 
        HYDRATED_STORES.has(dep)
      );
      
      if (allDepsHydrated) {
        toProcess.push(item);
        HYDRATION_QUEUE.splice(i, 1);
      }
    }
  }

  // Process stores that are now ready
  toProcess.forEach(item => {
    scheduleHydration(item.name);
  });
}

/**
 * Get client-side hydration data
 */
function getClientHydrationData(): ServerStateSnapshot | null {
  if (isServer()) return null;

  // Check for hydration data in window
  if ('__HYDRATION_DATA__' in window) {
    const data = (window as any).__HYDRATION_DATA__;
    if (data) {
      return deserialize<ServerStateSnapshot>(
        typeof data === 'string' ? data : JSON.stringify(data)
      );
    }
  }

  // Check for hydration data in DOM
  const element = document.getElementById('__HYDRATION_DATA__');
  if (element) {
    try {
      const content = element.textContent || '';
      return deserialize<ServerStateSnapshot>(content);
    } catch (error) {
      console.error('[Hydration] Failed to parse hydration data from DOM:', error);
    }
  }

  return null;
}

/**
 * Create server state snapshot
 */
export function createServerSnapshot(
  storeNames?: string[]
): ServerStateSnapshot {
  const stores: Record<string, any> = {};
  const registryEntries = Array.from(HYDRATION_REGISTRY.entries());

  // Filter stores if specific names provided
  const entriesToSnapshot = storeNames
    ? registryEntries.filter(([name]) => storeNames.includes(name))
    : registryEntries;

  // Collect state from each store
  entriesToSnapshot.forEach(([name, { store, options }]) => {
    if (!options.skip) {
      stores[name] = store.getState();
    }
  });

  return {
    timestamp: Date.now(),
    stores,
  };
}

/**
 * Hydrate all stores from snapshot
 */
export async function hydrateFromSnapshot(
  snapshot: ServerStateSnapshot | string,
  options: {
    validate?: boolean;
    parallel?: boolean;
  } = {}
): Promise<void> {
  const { validate = true, parallel = false } = options;

  // Parse snapshot if string
  const data = typeof snapshot === 'string'
    ? deserialize<ServerStateSnapshot>(snapshot)
    : snapshot;

  // Validate snapshot structure
  if (validate) {
    if (!data || typeof data !== 'object' || !data.stores) {
      throw new Error('Invalid snapshot structure');
    }
  }

  // Reset hydration state
  HYDRATED_STORES.clear();
  HYDRATION_QUEUE.length = 0;
  HYDRATION_PROMISES.clear();

  // Create hydration promises for each store
  const hydrationTasks: Array<() => Promise<void>> = [];

  Object.entries(data.stores).forEach(([name, state]) => {
    const registration = HYDRATION_REGISTRY.get(name);
    if (!registration) {
      console.warn(`[Hydration] Store "${name}" not registered, skipping`);
      return;
    }

    const task = async () => {
      // Wait for dependencies
      if (registration.options.dependencies) {
        await Promise.all(
          registration.options.dependencies.map(dep => 
            HYDRATION_PROMISES.get(dep) || Promise.resolve()
          )
        );
      }

      // Hydrate the store
      hydrateStore(name, state, registration.options);
    };

    // Store promise for dependency resolution
    const promise = task();
    HYDRATION_PROMISES.set(name, promise);
    hydrationTasks.push(() => promise);
  });

  // Execute hydration
  if (parallel) {
    await Promise.all(hydrationTasks.map(task => task()));
  } else {
    for (const task of hydrationTasks) {
      await task();
    }
  }
}

/**
 * Get hydration status
 */
export function getHydrationStatus(): {
  hydrated: string[];
  pending: string[];
  registered: string[];
} {
  return {
    hydrated: Array.from(HYDRATED_STORES),
    pending: HYDRATION_QUEUE.map(item => item.name),
    registered: Array.from(HYDRATION_REGISTRY.keys()),
  };
}

/**
 * Wait for specific stores to be hydrated
 */
export async function waitForStores(
  storeNames: string[],
  timeout: number = 5000
): Promise<void> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const allHydrated = storeNames.every(name => HYDRATED_STORES.has(name));
      
      if (allHydrated) {
        resolve();
        return;
      }

      if (Date.now() - start > timeout) {
        const pending = storeNames.filter(name => !HYDRATED_STORES.has(name));
        reject(new Error(`Timeout waiting for stores: ${pending.join(', ')}`));
        return;
      }

      setTimeout(check, 50);
    };

    check();
  });
}

/**
 * Reset hydration state (useful for testing)
 */
export function resetHydration(): void {
  HYDRATION_REGISTRY.clear();
  HYDRATED_STORES.clear();
  HYDRATION_QUEUE.length = 0;
  HYDRATION_PROMISES.clear();
}

/**
 * Create SSR-safe hydration script
 */
export function createHydrationScript(snapshot: ServerStateSnapshot): string {
  const serialized = serialize(snapshot);
  return `
    <script id="__HYDRATION_DATA__" type="application/json">
      ${serialized}
    </script>
    <script>
      window.__HYDRATION_DATA__ = ${serialized};
    </script>
  `;
}