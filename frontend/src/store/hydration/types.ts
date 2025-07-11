/**
 * State Hydration Types
 * 
 * Type definitions for the Zustand state hydration system
 */

import { StateCreator, StoreApi } from 'zustand';

/**
 * Hydration options for a store
 */
export interface HydrationOptions<T = any> {
  /**
   * Unique name for the store (used for identification during hydration)
   */
  name: string;

  /**
   * Whether to skip hydration for this store
   */
  skip?: boolean;

  /**
   * Transform function to modify state during hydration
   */
  transform?: (state: Partial<T>) => Partial<T>;

  /**
   * Validate hydrated state before applying
   */
  validate?: (state: unknown) => state is Partial<T>;

  /**
   * Merge strategy for partial hydration
   */
  merge?: 'shallow' | 'deep' | ((existing: T, hydrated: Partial<T>) => T);

  /**
   * Dependencies - other stores that must be hydrated first
   */
  dependencies?: string[];

  /**
   * Callback after successful hydration
   */
  onHydrated?: (state: T) => void;

  /**
   * Callback on hydration error
   */
  onError?: (error: Error) => void;

  /**
   * Custom serialization config
   */
  serialization?: SerializationConfig;
}

/**
 * Serialization configuration
 */
export interface SerializationConfig {
  /**
   * Enable compression
   */
  compress?: boolean;

  /**
   * Custom serializers for specific types
   */
  serializers?: Map<string, Serializer<any>>;

  /**
   * Custom deserializers for specific types
   */
  deserializers?: Map<string, Deserializer<any>>;

  /**
   * Maximum depth for circular reference detection
   */
  maxDepth?: number;
}

/**
 * Custom serializer function
 */
export type Serializer<T> = (value: T) => any;

/**
 * Custom deserializer function
 */
export type Deserializer<T> = (value: any) => T;

/**
 * Hydration state
 */
export interface HydrationState {
  /**
   * Whether hydration is in progress
   */
  isHydrating: boolean;

  /**
   * Whether hydration has completed
   */
  isHydrated: boolean;

  /**
   * Hydration errors by store name
   */
  errors: Map<string, Error>;

  /**
   * Successfully hydrated stores
   */
  hydrated: Set<string>;

  /**
   * Pending stores in hydration queue
   */
  pending: Set<string>;
}

/**
 * Server state snapshot
 */
export interface ServerStateSnapshot {
  /**
   * Timestamp when snapshot was taken
   */
  timestamp: number;

  /**
   * Store states by name
   */
  stores: Record<string, any>;

  /**
   * Additional metadata
   */
  meta?: Record<string, any>;
}

/**
 * Hydration context value
 */
export interface HydrationContextValue {
  /**
   * Current hydration state
   */
  state: HydrationState;

  /**
   * Register a store for hydration
   */
  register: (name: string, store: StoreApi<any>, options: HydrationOptions) => void;

  /**
   * Hydrate stores from server state
   */
  hydrate: (snapshot: ServerStateSnapshot) => Promise<void>;

  /**
   * Get server state snapshot
   */
  getSnapshot: () => ServerStateSnapshot;

  /**
   * Reset hydration state
   */
  reset: () => void;

  /**
   * Check if a specific store is hydrated
   */
  isStoreHydrated: (name: string) => boolean;
}

/**
 * Hydration middleware for Zustand
 */
export type HydrationMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, Mcs>,
  options: HydrationOptions<T>
) => StateCreator<T, Mps, Mcs>;

/**
 * Store mutator identifier for TypeScript
 */
declare module 'zustand/vanilla' {
  interface StoreMutators<S, A> {
    hydration: {
      hydrate: (state: Partial<S>) => void;
      getHydrationOptions: () => HydrationOptions<S>;
    };
  }
}

/**
 * Hydration queue item
 */
export interface HydrationQueueItem {
  name: string;
  store: StoreApi<any>;
  options: HydrationOptions;
  snapshot?: any;
}

/**
 * Deep merge options
 */
export interface DeepMergeOptions {
  /**
   * Whether to clone arrays instead of merging
   */
  cloneArrays?: boolean;

  /**
   * Custom merge function for specific keys
   */
  customMerge?: (key: string, target: any, source: any) => any;

  /**
   * Keys to skip during merge
   */
  skipKeys?: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Store mutator identifier
 */
type StoreMutatorIdentifier = string;