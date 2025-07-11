import type { StateCreator } from 'zustand';
import type {
  PersistOptions,
  PersistedState,
  StateStorage,
  StorageBackend,
  CompressionOptions,
} from './types';
import {
  createStorageAdapter,
  LocalStorageAdapter,
  SessionStorageAdapter,
  IndexedDBAdapter,
  MemoryAdapter,
} from './storageAdapters';
import { createEncryptedStorage } from './encryption';
import { MigrationRunner, SchemaValidator } from './migrations';

// Simple LZ-based compression utilities (no external dependencies)
const compressionUtils = {
  // Simple LZ77-like compression for JSON strings
  compress(data: string, algorithm: 'lz-string' | 'none' = 'lz-string'): string {
    if (algorithm === 'none') return data;
    
    try {
      // Simple compression using repeated string replacement
      const compressed = this.lzCompress(data);
      return btoa(compressed);
    } catch (error) {
      console.error('Compression error:', error);
      return data;
    }
  },

  decompress(data: string, algorithm: 'lz-string' | 'none' = 'lz-string'): string {
    if (algorithm === 'none') return data;
    
    try {
      const decoded = atob(data);
      return this.lzDecompress(decoded);
    } catch (error) {
      console.error('Decompression error:', error);
      return data;
    }
  },

  // Simple LZ compression implementation
  lzCompress(uncompressed: string): string {
    if (!uncompressed) return '';
    
    let dictionary: Record<string, number> = {};
    let data = (uncompressed + '').split('');
    let out: string[] = [];
    let currChar: string;
    let phrase = data[0];
    let code = 256;
    
    for (let i = 1; i < data.length; i++) {
      currChar = data[i];
      if (dictionary[phrase + currChar] != null) {
        phrase += currChar;
      } else {
        out.push(phrase.length > 1 ? String(dictionary[phrase]) : phrase);
        dictionary[phrase + currChar] = code;
        code++;
        phrase = currChar;
      }
    }
    out.push(phrase.length > 1 ? String(dictionary[phrase]) : phrase);
    
    return out.join(' ');
  },

  // Simple LZ decompression implementation
  lzDecompress(compressed: string): string {
    if (!compressed) return '';
    
    let dictionary: Record<number, string> = {};
    let data = compressed.split(' ');
    let currChar = data[0];
    let oldPhrase = currChar;
    let out = [currChar];
    let code = 256;
    let phrase: string;
    
    for (let i = 1; i < data.length; i++) {
      let currCode = data[i];
      
      if (/^\d+$/.test(currCode)) {
        phrase = dictionary[parseInt(currCode)] || (oldPhrase + currChar);
      } else {
        phrase = currCode;
      }
      
      out.push(phrase);
      currChar = phrase.charAt(0);
      dictionary[code] = oldPhrase + currChar;
      code++;
      oldPhrase = phrase;
    }
    
    return out.join('');
  },

  shouldCompress(data: string, threshold = 1024): boolean {
    return new Blob([data]).size > threshold;
  }
};

// Create storage with all features
function createStorage<T>(
  baseStorage: StateStorage,
  options: PersistOptions<T>
): StateStorage {
  let storage = baseStorage;

  // Add encryption if needed
  if (options.encrypt) {
    const encryptOptions = options.encrypt === true
      ? { key: 'default-key' } // You should provide a real key
      : options.encrypt;
    storage = createEncryptedStorage(storage, encryptOptions);
  }

  // Add compression wrapper
  if (options.compress) {
    const compressOptions: CompressionOptions = {
      threshold: 1024,
      algorithm: 'lz-string',
    };

    storage = {
      getItem: async (name: string) => {
        const compressed = await storage.getItem(name);
        if (!compressed) return null;
        
        try {
          const parsed = JSON.parse(compressed);
          if (parsed._compressed) {
            const decompressed = compressionUtils.decompress(
              parsed.data,
              parsed.algorithm || compressOptions.algorithm
            );
            return decompressed;
          }
          return compressed;
        } catch {
          return compressed;
        }
      },
      setItem: async (name: string, value: string) => {
        if (compressionUtils.shouldCompress(value, compressOptions.threshold)) {
          const compressed = compressionUtils.compress(
            value,
            compressOptions.algorithm
          );
          const wrapper = JSON.stringify({
            _compressed: true,
            algorithm: compressOptions.algorithm,
            data: compressed,
            originalSize: new Blob([value]).size,
            compressedSize: new Blob([compressed]).size,
          });
          await storage.setItem(name, wrapper);
        } else {
          await storage.setItem(name, value);
        }
      },
      removeItem: storage.removeItem.bind(storage),
    };
  }

  return storage;
}

// Main persistence middleware
export const persist = <T extends object>(
  config: StateCreator<T>,
  options: PersistOptions<T>
): StateCreator<T> => {
  return (set, get, api) => {
    const {
      name,
      storage: customStorage,
      serialize = JSON.stringify,
      deserialize = JSON.parse,
      partialize,
      onRehydrateStorage,
      version = 0,
      migrate,
      merge = (persistedState, currentState) => ({ ...currentState, ...persistedState }),
      skipHydration = false,
      whitelist,
      blacklist,
    } = options;

    // Create storage adapter
    const baseStorage = customStorage || new LocalStorageAdapter();
    const storage = createStorage(baseStorage, options);

    // Schema validator for migrations
    const schemaValidator = new SchemaValidator();

    // Filter state based on whitelist/blacklist
    const partializeState = (state: T): Partial<T> => {
      if (partialize) {
        return partialize(state);
      }

      if (whitelist) {
        const filtered: Partial<T> = {};
        whitelist.forEach(key => {
          if (key in state) {
            filtered[key] = state[key];
          }
        });
        return filtered;
      }

      if (blacklist) {
        const filtered = { ...state };
        blacklist.forEach(key => {
          delete filtered[key];
        });
        return filtered;
      }

      return state;
    };

    // Persist state
    const persistState = async () => {
      const state = partializeState(get());
      const persistedState: PersistedState<Partial<T>> = {
        state,
        version,
      };

      try {
        await storage.setItem(name, serialize(persistedState));
      } catch (error) {
        console.error(`Failed to persist state for ${name}:`, error);
      }
    };

    // Rehydrate state
    const rehydrateState = async () => {
      const onRehydrateStorageCallback = onRehydrateStorage?.(get());

      try {
        const storedValue = await storage.getItem(name);
        if (!storedValue) {
          onRehydrateStorageCallback?.(undefined);
          return;
        }

        let persistedState = deserialize(storedValue) as PersistedState<Partial<T>>;

        // Handle migration
        if (persistedState.version !== version && migrate) {
          const migrationRunner = new MigrationRunner(
            {
              version,
              migrations: { [version]: migrate },
            },
            schemaValidator
          );

          const migrated = await migrationRunner.migrate(
            persistedState.state,
            persistedState.version
          );
          persistedState = {
            state: migrated.data,
            version: migrated.version,
          };
        }

        const mergedState = merge(persistedState.state, get());
        set(mergedState as T);
        onRehydrateStorageCallback?.(mergedState);
      } catch (error) {
        console.error(`Failed to rehydrate state for ${name}:`, error);
        onRehydrateStorageCallback?.(undefined, error);
      }
    };

    // Initialize store
    const store = config(
      (partial, replace) => {
        set(partial, replace);
        void persistState();
      },
      get,
      api
    );

    // Rehydrate on initialization
    if (!skipHydration) {
      void rehydrateState();
    }

    // Add persist API to store
    const persistApi = {
      persist: {
        setOptions: (newOptions: Partial<PersistOptions<T>>) => {
          Object.assign(options, newOptions);
        },
        clearStorage: () => {
          storage.removeItem(name);
        },
        rehydrate: () => rehydrateState(),
        hasHydrated: () => {
          // This would need to be tracked in the actual implementation
          return true;
        },
        onHydrate: (fn: (state: T) => void) => {
          // This would need to be implemented with event emitters
        },
        onFinishHydration: (fn: (state: T) => void) => {
          // This would need to be implemented with event emitters
        },
        getOptions: () => options,
      },
    };

    return Object.assign(store, persistApi);
  };
};

// Helper to create persisted store with multiple storage backends
export function createPersistedStore<T extends object>(
  config: StateCreator<T>,
  options: PersistOptions<T> & {
    storageBackend?: StorageBackend;
    fallbackStorage?: StorageBackend;
  }
): StateCreator<T> {
  const { storageBackend = 'localStorage', fallbackStorage, ...persistOptions } = options;

  // Create primary storage
  let storage: StateStorage;
  try {
    storage = createStorageAdapter(storageBackend, {
      prefix: options.name,
    });
  } catch (error) {
    console.warn(`Failed to create ${storageBackend} adapter, falling back to memory storage`);
    storage = new MemoryAdapter();
  }

  // Create fallback storage if specified
  if (fallbackStorage) {
    const primaryStorage = storage;
    const fallback = createStorageAdapter(fallbackStorage, {
      prefix: options.name,
    });

    storage = {
      getItem: async (name: string) => {
        try {
          const value = await primaryStorage.getItem(name);
          if (value !== null) return value;
        } catch (error) {
          console.warn('Primary storage failed, trying fallback');
        }
        return fallback.getItem(name);
      },
      setItem: async (name: string, value: string) => {
        try {
          await primaryStorage.setItem(name, value);
        } catch (error) {
          console.warn('Primary storage failed, using fallback');
          await fallback.setItem(name, value);
        }
      },
      removeItem: async (name: string) => {
        await Promise.all([
          primaryStorage.removeItem(name).catch(() => {}),
          fallback.removeItem(name).catch(() => {}),
        ]);
      },
    };
  }

  return persist(config, { ...persistOptions, storage });
}

// Utility to create a store with sensible defaults
export function persistWithDefaults<T extends object>(
  config: StateCreator<T>,
  name: string,
  options?: Partial<PersistOptions<T>>
): StateCreator<T> {
  return persist(config, {
    name,
    version: 1,
    storage: new LocalStorageAdapter(name),
    compress: true,
    ...options,
  });
}