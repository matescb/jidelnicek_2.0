/**
 * Selector Composition Utilities
 * Utilities for creating and composing memoized selectors
 */

import { StoreApi, useStore } from 'zustand';
import { useCallback, useMemo, useRef } from 'react';
import type { Selector, ParametricSelector, SelectorOptions } from './types';

/**
 * Default equality function
 */
const defaultEqualityFn = (a: any, b: any): boolean => {
  return a === b;
};

/**
 * Deep equality function for objects and arrays
 */
const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
};

/**
 * Create a memoized selector
 */
export function createSelector<State, Result>(
  selector: Selector<State, Result>,
  options: SelectorOptions = {}
): Selector<State, Result> {
  const { memoize = true, equalityFn = defaultEqualityFn } = options;

  if (!memoize) return selector;

  let lastArgs: State | undefined;
  let lastResult: Result;

  return (state: State) => {
    if (lastArgs === undefined || !equalityFn(state, lastArgs)) {
      lastArgs = state;
      lastResult = selector(state);
    }

    return lastResult;
  };
}

/**
 * Create a selector from multiple input selectors
 */
export function combineSelectors<State, R1, R2, Result>(
  selector1: Selector<State, R1>,
  selector2: Selector<State, R2>,
  combiner: (r1: R1, r2: R2) => Result,
  options?: SelectorOptions
): Selector<State, Result>;

export function combineSelectors<State, R1, R2, R3, Result>(
  selector1: Selector<State, R1>,
  selector2: Selector<State, R2>,
  selector3: Selector<State, R3>,
  combiner: (r1: R1, r2: R2, r3: R3) => Result,
  options?: SelectorOptions
): Selector<State, Result>;

export function combineSelectors<State, R1, R2, R3, R4, Result>(
  selector1: Selector<State, R1>,
  selector2: Selector<State, R2>,
  selector3: Selector<State, R3>,
  selector4: Selector<State, R4>,
  combiner: (r1: R1, r2: R2, r3: R3, r4: R4) => Result,
  options?: SelectorOptions
): Selector<State, Result>;

export function combineSelectors<State>(
  ...args: any[]
): Selector<State, any> {
  const selectors = args.slice(0, -2) as Selector<State, any>[];
  const combiner = args[args.length - 2] as (...results: any[]) => any;
  const options = (args[args.length - 1] as SelectorOptions) || {};

  const { memoize = true, equalityFn = deepEqual } = options;

  let lastInputs: any[] | undefined;
  let lastResult: any;

  return (state: State) => {
    const inputs = selectors.map((selector) => selector(state));

    if (!memoize || lastInputs === undefined || !arrayEqual(inputs, lastInputs, equalityFn)) {
      lastInputs = inputs;
      lastResult = combiner(...inputs);
    }

    return lastResult;
  };
}

/**
 * Array equality helper
 */
function arrayEqual(a: any[], b: any[], equalityFn: (a: any, b: any) => boolean): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!equalityFn(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Create a parametric selector
 */
export function createParametricSelector<State, Params, Result>(
  selectorFactory: (params: Params) => Selector<State, Result>,
  options: SelectorOptions = {}
): ParametricSelector<State, Params, Result> {
  const cache = new Map<string, Selector<State, Result>>();
  const { memoize = true } = options;

  return (params: Params) => {
    if (!memoize) {
      return selectorFactory(params);
    }

    const key = JSON.stringify(params);
    
    if (!cache.has(key)) {
      cache.set(key, createSelector(selectorFactory(params), options));
    }

    return cache.get(key)!;
  };
}

/**
 * Create a selector with dependencies from multiple stores
 */
export function createCrossStoreSelector<Stores extends Record<string, StoreApi<any>>, Result>(
  stores: Stores,
  selector: (states: { [K in keyof Stores]: ReturnType<Stores[K]['getState']> }) => Result,
  options: SelectorOptions = {}
): () => Result {
  const { memoize = true, equalityFn = deepEqual } = options;

  let lastStates: any;
  let lastResult: Result;

  return () => {
    const states: any = {};
    
    for (const [key, store] of Object.entries(stores)) {
      states[key] = store.getState();
    }

    if (!memoize || !lastStates || !equalityFn(states, lastStates)) {
      lastStates = states;
      lastResult = selector(states);
    }

    return lastResult;
  };
}

/**
 * Use a selector hook with automatic re-rendering
 */
export function useSelectorHook<State, Result>(
  store: StoreApi<State>,
  selector: Selector<State, Result>,
  equalityFn: (a: Result, b: Result) => boolean = defaultEqualityFn
): Result {
  return useStore(store, selector, equalityFn);
}

/**
 * Create derived state selector
 */
export function createDerivedSelector<State, Result>(
  selectors: Record<string, Selector<State, any>>,
  derive: (values: Record<string, any>) => Result,
  options: SelectorOptions = {}
): Selector<State, Result> {
  const selectorEntries = Object.entries(selectors);
  const { memoize = true, equalityFn = deepEqual } = options;

  let lastValues: Record<string, any> | undefined;
  let lastResult: Result;

  return (state: State) => {
    const values: Record<string, any> = {};

    for (const [key, selector] of selectorEntries) {
      values[key] = selector(state);
    }

    if (!memoize || !lastValues || !equalityFn(values, lastValues)) {
      lastValues = values;
      lastResult = derive(values);
    }

    return lastResult;
  };
}

/**
 * Performance-optimized selector hook for lists
 */
export function useListSelector<State, Item, Result>(
  store: StoreApi<State>,
  listSelector: Selector<State, Item[]>,
  itemSelector: (item: Item) => Result,
  equalityFn: (a: Result, b: Result) => boolean = defaultEqualityFn
): Result[] {
  const items = useStore(store, listSelector);
  const prevItemsRef = useRef<Item[]>([]);
  const prevResultsRef = useRef<Result[]>([]);

  return useMemo(() => {
    const prevItems = prevItemsRef.current;
    const prevResults = prevResultsRef.current;

    // Check if items array reference changed
    if (items === prevItems) {
      return prevResults;
    }

    // Check if items are the same
    if (
      items.length === prevItems.length &&
      items.every((item, index) => item === prevItems[index])
    ) {
      prevItemsRef.current = items;
      return prevResults;
    }

    // Compute new results
    const results = items.map(itemSelector);
    
    prevItemsRef.current = items;
    prevResultsRef.current = results;
    
    return results;
  }, [items, itemSelector]);
}

/**
 * Create a slice selector for accessing nested state
 */
export function createSliceSelector<State, SliceKey extends keyof State>(
  sliceKey: SliceKey
): Selector<State, State[SliceKey]> {
  return (state: State) => state[sliceKey];
}

/**
 * Create a property selector for accessing nested properties
 */
export function createPropertySelector<State, Result>(
  path: string
): Selector<State, Result> {
  const pathParts = path.split('.');
  
  return (state: State) => {
    let current: any = state;
    
    for (const part of pathParts) {
      if (current == null) return undefined as any;
      current = current[part];
    }
    
    return current as Result;
  };
}

/**
 * Compose multiple selectors into a pipeline
 */
export function pipeSelectors<State, R1>(
  s1: Selector<State, R1>
): Selector<State, R1>;

export function pipeSelectors<State, R1, R2>(
  s1: Selector<State, R1>,
  s2: Selector<R1, R2>
): Selector<State, R2>;

export function pipeSelectors<State, R1, R2, R3>(
  s1: Selector<State, R1>,
  s2: Selector<R1, R2>,
  s3: Selector<R2, R3>
): Selector<State, R3>;

export function pipeSelectors<State>(...selectors: Selector<any, any>[]): Selector<State, any> {
  return (state: State) => {
    return selectors.reduce((acc, selector) => selector(acc), state);
  };
}

/**
 * Create a filtered selector
 */
export function createFilteredSelector<State, Item>(
  listSelector: Selector<State, Item[]>,
  predicate: (item: Item) => boolean,
  options: SelectorOptions = {}
): Selector<State, Item[]> {
  return createSelector((state: State) => {
    const items = listSelector(state);
    return items.filter(predicate);
  }, options);
}

/**
 * Create a sorted selector
 */
export function createSortedSelector<State, Item>(
  listSelector: Selector<State, Item[]>,
  compareFn: (a: Item, b: Item) => number,
  options: SelectorOptions = {}
): Selector<State, Item[]> {
  return createSelector((state: State) => {
    const items = listSelector(state);
    return [...items].sort(compareFn);
  }, options);
}

/**
 * Create a paginated selector
 */
export function createPaginatedSelector<State, Item>(
  listSelector: Selector<State, Item[]>,
  pageSelector: Selector<State, number>,
  pageSizeSelector: Selector<State, number>,
  options: SelectorOptions = {}
): Selector<State, { items: Item[]; totalPages: number; hasMore: boolean }> {
  return combineSelectors(
    listSelector,
    pageSelector,
    pageSizeSelector,
    (items, page, pageSize) => {
      const totalPages = Math.ceil(items.length / pageSize);
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      
      return {
        items: items.slice(start, end),
        totalPages,
        hasMore: page < totalPages,
      };
    },
    options
  );
}