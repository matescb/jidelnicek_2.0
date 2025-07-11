/**
 * Store Composition Types
 * Type definitions for the Zustand store composition system
 */

import { StoreApi, UseBoundStore, StateCreator } from 'zustand';

// Base slice type
export interface SliceBase {
  _sliceName?: string;
}

// Slice configuration
export interface SliceConfig<T extends SliceBase = SliceBase> {
  name: string;
  create: StateCreator<T, [], [], T>;
  dependencies?: string[];
}

// Store composition configuration
export interface StoreCompositionConfig<T extends Record<string, SliceBase>> {
  slices: {
    [K in keyof T]: SliceConfig<T[K]>;
  };
  middleware?: StoreMiddleware<T>[];
  computed?: ComputedValues<T>;
  devtools?: DevtoolsConfig;
}

// Middleware types
export type StoreMiddleware<T> = (
  config: StateCreator<T, [], [], T>
) => StateCreator<T, [], [], T>;

// Computed values configuration
export type ComputedValues<T> = {
  [key: string]: (state: T) => any;
};

// DevTools configuration
export interface DevtoolsConfig {
  name?: string;
  enabled?: boolean;
  trace?: boolean;
  anonymize?: boolean;
}

// Cross-slice communication
export interface SliceActions<T = any> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
}

// Factory types
export interface CrudSliceConfig<T, Id = string | number> {
  name: string;
  initialItems?: T[];
  idField?: keyof T;
  sortField?: keyof T;
  sortOrder?: 'asc' | 'desc';
}

export interface AsyncSliceConfig<T> {
  name: string;
  initialData?: T;
  fetchFn: () => Promise<T>;
  updateFn?: (data: T) => Promise<T>;
  errorHandler?: (error: Error) => void;
}

export interface ListSliceConfig<T> {
  name: string;
  initialItems?: T[];
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
}

export interface FormSliceConfig<T> {
  name: string;
  initialValues: T;
  validationSchema?: any; // Can be Zod, Yup, etc.
  onSubmit: (values: T) => Promise<void> | void;
  resetOnSubmit?: boolean;
}

export interface ModalSliceConfig {
  name: string;
  modals: Record<string, {
    defaultOpen?: boolean;
    data?: any;
  }>;
}

// CRUD operations interface
export interface CrudOperations<T, Id = string | number> {
  items: T[];
  selectedId: Id | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  add: (item: T) => void;
  update: (id: Id, updates: Partial<T>) => void;
  remove: (id: Id) => void;
  select: (id: Id | null) => void;
  setItems: (items: T[]) => void;
  clear: () => void;
  
  // Computed
  selectedItem: T | undefined;
  count: number;
}

// Async state interface
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  lastFetch: Date | null;
  
  // Actions
  fetch: () => Promise<void>;
  update: (data: T) => Promise<void>;
  reset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

// List state interface
export interface ListState<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  sortBy: keyof T | null;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, any>;
  searchQuery: string;
  loading: boolean;
  
  // Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (field: keyof T, order?: 'asc' | 'desc') => void;
  setFilter: (key: string, value: any) => void;
  clearFilters: () => void;
  setSearchQuery: (query: string) => void;
  refresh: () => Promise<void>;
}

// Form state interface
export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  
  // Actions
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setFieldError: (field: keyof T, error: string) => void;
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  setValues: (values: Partial<T>) => void;
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  submit: () => Promise<void>;
  reset: () => void;
  validate: () => boolean;
}

// Modal state interface
export interface ModalState {
  modals: Record<string, {
    isOpen: boolean;
    data?: any;
  }>;
  
  // Actions
  open: (modalId: string, data?: any) => void;
  close: (modalId: string) => void;
  toggle: (modalId: string) => void;
  closeAll: () => void;
  isOpen: (modalId: string) => boolean;
  getData: (modalId: string) => any;
}

// Selector types
export type Selector<State, Result> = (state: State) => Result;
export type ParametricSelector<State, Params, Result> = (
  params: Params
) => (state: State) => Result;

export interface SelectorOptions {
  memoize?: boolean;
  equalityFn?: (a: any, b: any) => boolean;
}

// Store type helpers
export type InferStoreState<T> = T extends UseBoundStore<infer S> ? S : never;
export type InferSliceState<T> = T extends SliceConfig<infer S> ? S : never;

// Composed store type
export type ComposedStore<T extends Record<string, SliceBase>> = UseBoundStore<
  StoreApi<UnionToIntersection<T[keyof T]> & {
    _computed?: Record<string, any>;
  }>
>;

// Utility types
type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

// Middleware configuration
export interface LoggerConfig {
  collapsed?: boolean;
  diff?: boolean;
  predicate?: (state: any, action: any) => boolean;
  timestamp?: boolean;
  duration?: boolean;
  colors?: {
    title?: string;
    prevState?: string;
    action?: string;
    nextState?: string;
    error?: string;
  };
}

export interface PerformanceConfig {
  warnThreshold?: number;
  enableProfiling?: boolean;
  logSlowUpdates?: boolean;
}

// Action tracking
export interface TrackedAction {
  type: string;
  payload?: any;
  timestamp: number;
  duration?: number;
  error?: Error;
}

export interface ActionTrackingConfig {
  maxActions?: number;
  persist?: boolean;
  filter?: (action: TrackedAction) => boolean;
}

// Slice inheritance
export interface ExtendableSlice<T extends SliceBase> {
  base: SliceConfig<T>;
  extensions?: {
    state?: Partial<T>;
    actions?: Record<string, (state: T, ...args: any[]) => void>;
    computed?: Record<string, (state: T) => any>;
  };
}