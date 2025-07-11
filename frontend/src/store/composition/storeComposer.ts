/**
 * Store Composer
 * Main utility for composing multiple store slices into a single Zustand store
 */

import { create, StateCreator, StoreApi } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  SliceBase,
  SliceConfig,
  StoreCompositionConfig,
  ComposedStore,
  SliceActions,
  ComputedValues,
  StoreMiddleware,
} from './types';

/**
 * Compose multiple store slices into a single store
 */
export function composeStore<T extends Record<string, SliceBase>>(
  config: StoreCompositionConfig<T>
): ComposedStore<T> {
  const { slices, middleware = [], computed = {}, devtools: devtoolsConfig } = config;

  // Validate slice dependencies
  validateDependencies(slices);

  // Create slice actions for cross-slice communication
  let storeApi: StoreApi<any>;
  const sliceActions: SliceActions = {
    getState: () => storeApi.getState(),
    setState: (partial) => storeApi.setState(partial),
    subscribe: (listener) => storeApi.subscribe(listener),
  };

  // Build the combined state creator
  const combinedStateCreator: StateCreator<any, [], [], any> = (set, get, api) => {
    storeApi = api;

    // Initialize state object
    let state: any = {};

    // Create slices in dependency order
    const sliceOrder = getSliceOrder(slices);
    
    for (const sliceName of sliceOrder) {
      const sliceConfig = slices[sliceName];
      
      // Create slice with namespaced actions
      const sliceState = createSliceWithNamespace(
        sliceConfig,
        sliceName as string,
        set,
        get,
        sliceActions
      );

      // Merge into combined state
      state = { ...state, ...sliceState };
    }

    // Add computed values
    if (Object.keys(computed).length > 0) {
      state._computed = createComputedGetters(computed, get);
    }

    return state;
  };

  // Apply middleware
  let enhancedStateCreator = combinedStateCreator;

  // Always apply immer for immutability
  enhancedStateCreator = immer(enhancedStateCreator) as any;

  // Always apply subscribeWithSelector for better subscriptions
  enhancedStateCreator = subscribeWithSelector(enhancedStateCreator) as any;

  // Apply custom middleware
  for (const mw of middleware) {
    enhancedStateCreator = mw(enhancedStateCreator) as any;
  }

  // Apply devtools if enabled
  if (devtoolsConfig?.enabled !== false) {
    enhancedStateCreator = devtools(enhancedStateCreator, {
      name: devtoolsConfig?.name || 'ComposedStore',
      trace: devtoolsConfig?.trace,
      anonymize: devtoolsConfig?.anonymize,
    }) as any;
  }

  // Create the store
  return create(enhancedStateCreator);
}

/**
 * Create a slice with namespaced actions
 */
function createSliceWithNamespace<T extends SliceBase>(
  sliceConfig: SliceConfig<T>,
  sliceName: string,
  set: (partial: any) => void,
  get: () => any,
  sliceActions: SliceActions
): T {
  const { create: createSlice } = sliceConfig;

  // Create namespaced set function
  const namespacedSet = (partial: any) => {
    if (typeof partial === 'function') {
      set((state: any) => {
        const sliceState = state[sliceName] || {};
        const newSliceState = partial(sliceState);
        return { [sliceName]: { ...sliceState, ...newSliceState } };
      });
    } else {
      set({ [sliceName]: partial });
    }
  };

  // Create namespaced get function
  const namespacedGet = () => {
    const state = get();
    return state[sliceName] || {};
  };

  // Create the slice
  const slice = createSlice(
    namespacedSet as any,
    namespacedGet,
    {
      getState: get,
      setState: set,
      subscribe: sliceActions.subscribe,
    } as any
  );

  // Add slice metadata
  return {
    ...slice,
    _sliceName: sliceName,
  };
}

/**
 * Validate slice dependencies
 */
function validateDependencies<T extends Record<string, SliceBase>>(
  slices: StoreCompositionConfig<T>['slices']
): void {
  const sliceNames = Object.keys(slices);

  for (const [name, config] of Object.entries(slices)) {
    if (config.dependencies) {
      for (const dep of config.dependencies) {
        if (!sliceNames.includes(dep)) {
          throw new Error(
            `Slice "${name}" depends on "${dep}", but "${dep}" is not defined`
          );
        }

        // Check for circular dependencies
        if (hasCircularDependency(name, dep, slices)) {
          throw new Error(
            `Circular dependency detected between "${name}" and "${dep}"`
          );
        }
      }
    }
  }
}

/**
 * Check for circular dependencies
 */
function hasCircularDependency<T extends Record<string, SliceBase>>(
  start: string,
  current: string,
  slices: StoreCompositionConfig<T>['slices'],
  visited = new Set<string>()
): boolean {
  if (visited.has(current)) {
    return current === start;
  }

  visited.add(current);

  const currentSlice = slices[current];
  if (currentSlice?.dependencies) {
    for (const dep of currentSlice.dependencies) {
      if (hasCircularDependency(start, dep, slices, visited)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get slice creation order based on dependencies
 */
function getSliceOrder<T extends Record<string, SliceBase>>(
  slices: StoreCompositionConfig<T>['slices']
): string[] {
  const order: string[] = [];
  const visited = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);

    const slice = slices[name];
    if (slice?.dependencies) {
      for (const dep of slice.dependencies) {
        visit(dep);
      }
    }

    order.push(name);
  }

  for (const name of Object.keys(slices)) {
    visit(name);
  }

  return order;
}

/**
 * Create computed value getters
 */
function createComputedGetters<T>(
  computed: ComputedValues<T>,
  get: () => T
): Record<string, any> {
  const getters: Record<string, any> = {};

  for (const [key, computeFn] of Object.entries(computed)) {
    Object.defineProperty(getters, key, {
      get: () => computeFn(get()),
      enumerable: true,
      configurable: true,
    });
  }

  return getters;
}

/**
 * Combine multiple stores into one
 */
export function combineStores<T extends Record<string, any>>(
  stores: T
): UseBoundStore<StoreApi<UnionToIntersection<T[keyof T]>>> {
  const storeEntries = Object.entries(stores);
  
  return create((set, get) => {
    const combined: any = {};

    for (const [name, store] of storeEntries) {
      const storeState = (store as any).getState();
      combined[name] = storeState;

      // Subscribe to store changes
      (store as any).subscribe((newState: any) => {
        set({ [name]: newState });
      });
    }

    return combined;
  });
}

/**
 * Create a store slice with automatic action namespacing
 */
export function createSlice<T extends SliceBase>(
  name: string,
  initialState: Omit<T, '_sliceName'>,
  actions: Record<string, (state: T, ...args: any[]) => void | T>
): SliceConfig<T> {
  return {
    name,
    create: (set, get) => {
      const slice: any = {
        ...initialState,
        _sliceName: name,
      };

      // Add actions to slice
      for (const [actionName, actionFn] of Object.entries(actions)) {
        slice[actionName] = (...args: any[]) => {
          set((state: T) => {
            const result = actionFn(state, ...args);
            return result !== undefined ? result : state;
          });
        };
      }

      return slice;
    },
  };
}

/**
 * Extend an existing slice with additional state and actions
 */
export function extendSlice<T extends SliceBase, E extends Partial<T>>(
  baseSlice: SliceConfig<T>,
  extensions: {
    state?: E;
    actions?: Record<string, (state: T & E, ...args: any[]) => void | (T & E)>;
  }
): SliceConfig<T & E> {
  return {
    name: baseSlice.name,
    dependencies: baseSlice.dependencies,
    create: (set, get, api) => {
      // Create base slice
      const base = baseSlice.create(set, get, api);

      // Merge with extensions
      const extended: any = {
        ...base,
        ...extensions.state,
      };

      // Add extended actions
      if (extensions.actions) {
        for (const [actionName, actionFn] of Object.entries(extensions.actions)) {
          extended[actionName] = (...args: any[]) => {
            set((state: T & E) => {
              const result = actionFn(state, ...args);
              return result !== undefined ? result : state;
            });
          };
        }
      }

      return extended;
    },
  };
}

// Type helpers
type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

type UseBoundStore<T> = T;