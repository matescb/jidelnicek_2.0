import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

export interface PersistOptions<T> {
  name: string;
  storage?: StateStorage;
  serialize?: (state: T) => string;
  deserialize?: (str: string) => T;
  partialize?: (state: T) => Partial<T>;
  onRehydrateStorage?: (state: T) => ((state?: T, error?: unknown) => void) | void;
  version?: number;
  migrate?: (persistedState: any, version: number) => T;
  merge?: (persistedState: any, currentState: T) => T;
  skipHydration?: boolean;
  whitelist?: (keyof T)[];
  blacklist?: (keyof T)[];
  encrypt?: boolean | EncryptionOptions;
  compress?: boolean;
}

export interface StateStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

export interface EncryptionOptions {
  key: string;
  fields?: string[];
  algorithm?: 'AES-GCM' | 'AES-CBC';
}

export interface StorageAdapter extends StateStorage {
  clear?: () => void | Promise<void>;
  getAllKeys?: () => string[] | Promise<string[]>;
  multiGet?: (keys: string[]) => Record<string, string | null> | Promise<Record<string, string | null>>;
  multiSet?: (items: Record<string, string>) => void | Promise<void>;
  multiRemove?: (keys: string[]) => void | Promise<void>;
}

export interface MigrationManifest {
  [version: number]: (state: any) => any;
}

export interface PersistStorage<T> {
  getItem: (name: string) => T | null | Promise<T | null>;
  setItem: (name: string, value: T) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

export type Persist = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  initializer: StateCreator<T, [...Mps, ['zustand/persist', unknown]], Mcs>,
  options: PersistOptions<T>
) => StateCreator<T, Mps, [['zustand/persist', unknown], ...Mcs]>;

export interface PersistedState<T> {
  state: T;
  version: number;
}

export interface CompressionOptions {
  threshold?: number; // Minimum size in bytes before compression
  algorithm?: 'lz-string' | 'none';
}

export interface StorageMetrics {
  size: number;
  compressed: boolean;
  encrypted: boolean;
  lastWrite: number;
  writeCount: number;
}

export interface StorageQuota {
  maxSize?: number;
  warningThreshold?: number;
  onQuotaExceeded?: (size: number, maxSize: number) => void;
}

export type StorageBackend = 'localStorage' | 'sessionStorage' | 'indexedDB' | 'memory' | 'custom';

export interface MultiStorageOptions {
  primary: StorageBackend;
  fallback?: StorageBackend;
  sync?: boolean;
}