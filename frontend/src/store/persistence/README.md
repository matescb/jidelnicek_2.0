# Zustand Persistence Middleware

A comprehensive persistence solution for Zustand stores with support for multiple storage backends, encryption, compression, migrations, and more.

## Features

- **Multiple Storage Backends**: LocalStorage, SessionStorage, IndexedDB, and Memory storage
- **Selective Persistence**: Whitelist/blacklist specific state fields
- **Data Encryption**: AES-GCM encryption with field-level encryption support
- **Compression**: Built-in LZ compression for large state objects
- **Schema Migrations**: Version tracking and automatic state migration
- **Storage Quotas**: Monitor and manage storage usage with configurable limits
- **TypeScript Support**: Full type safety and IntelliSense
- **Fallback Support**: Automatic fallback to alternative storage when primary fails

## Installation

The persistence middleware is already included in the project. No additional dependencies are required.

## Basic Usage

```typescript
import { create } from 'zustand';
import { persist } from '@/store/persistence';

interface Store {
  count: number;
  increment: () => void;
}

const useStore = create<Store>()(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
    {
      name: 'my-store', // unique name for storage key
    }
  )
);
```

## Storage Adapters

### LocalStorage (Default)

```typescript
import { LocalStorageAdapter } from '@/store/persistence';

const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storage: new LocalStorageAdapter('prefix'), // optional prefix
    }
  )
);
```

### SessionStorage

```typescript
import { SessionStorageAdapter } from '@/store/persistence';

const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storage: new SessionStorageAdapter(),
    }
  )
);
```

### IndexedDB (For Large Data)

```typescript
import { IndexedDBAdapter } from '@/store/persistence';

const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storage: new IndexedDBAdapter('myapp-db', 'stores'),
    }
  )
);
```

### Memory Storage (For Testing)

```typescript
import { MemoryAdapter } from '@/store/persistence';

const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storage: new MemoryAdapter(),
    }
  )
);
```

## Selective Persistence

### Using Partialize

```typescript
const useStore = create()(
  persist(
    (set) => ({
      user: null,
      preferences: {},
      temporaryData: {}, // This won't be persisted
    }),
    {
      name: 'my-store',
      partialize: (state) => ({
        user: state.user,
        preferences: state.preferences,
        // temporaryData is excluded
      }),
    }
  )
);
```

### Using Whitelist

```typescript
const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      whitelist: ['user', 'preferences'], // Only these fields will be persisted
    }
  )
);
```

### Using Blacklist

```typescript
const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      blacklist: ['temporaryData', 'cache'], // These fields will be excluded
    }
  )
);
```

## Encryption

### Basic Encryption

```typescript
const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      encrypt: true, // Uses default encryption key (not recommended for production)
    }
  )
);
```

### Advanced Encryption with Field Selection

```typescript
const useStore = create()(
  persist(
    (set) => ({
      publicData: 'visible',
      apiKey: 'secret',
      user: {
        name: 'public',
        password: 'secret',
      },
    }),
    {
      name: 'my-store',
      encrypt: {
        key: process.env.REACT_APP_ENCRYPTION_KEY!,
        fields: ['apiKey', 'user.password'], // Only encrypt specific fields
        algorithm: 'AES-GCM',
      },
    }
  )
);
```

### Generating Encryption Keys

```typescript
import { generateSecureKey } from '@/store/persistence';

// Generate a secure key for encryption
const encryptionKey = generateSecureKey(32); // 32 bytes = 256 bits
console.log('Save this key securely:', encryptionKey);
```

## Compression

```typescript
const useStore = create()(
  persist(
    (set) => ({
      largeDataArray: Array(1000).fill({ /* ... */ }),
    }),
    {
      name: 'my-store',
      compress: true, // Enable compression for all data
    }
  )
);
```

## Migrations

### Simple Migration

```typescript
const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 1) {
          // Migrate from v1 to v2
          return {
            ...persistedState,
            newField: 'default value',
          };
        }
        return persistedState;
      },
    }
  )
);
```

### Complex Migrations with Helpers

```typescript
import { migrationHelpers, createMigrationManifest } from '@/store/persistence';

const migrations = createMigrationManifest();

// Add migrations for each version
migrations.addMigration(2, migrationHelpers.addField('theme', 'light'));
migrations.addMigration(3, migrationHelpers.renameField('theme', 'colorScheme'));
migrations.addMigration(4, migrationHelpers.compose(
  migrationHelpers.transformField('colorScheme', (value) => 
    value === 'light' || value === 'dark' ? value : 'auto'
  ),
  migrationHelpers.removeField('deprecatedField')
));

const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      version: 4,
      migrate: (persistedState: any, version: number) => {
        const manifest = migrations.getManifest();
        let state = persistedState;
        
        // Apply all migrations sequentially
        for (let v = version + 1; v <= 4; v++) {
          if (manifest[v]) {
            state = manifest[v](state);
          }
        }
        
        return state;
      },
    }
  )
);
```

## Storage Quotas

```typescript
import { createStorageAdapter } from '@/store/persistence';

const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storage: createStorageAdapter('localStorage', {
        quota: {
          maxSize: 5 * 1024 * 1024, // 5MB limit
          warningThreshold: 4 * 1024 * 1024, // Warn at 4MB
          onQuotaExceeded: (size, maxSize) => {
            console.error(`Storage quota exceeded: ${size} > ${maxSize}`);
            // Show user notification
            // Clear old data
            // etc.
          },
        },
      }),
    }
  )
);
```

## Advanced Patterns

### Multi-Storage with Fallback

```typescript
const useStore = create()(
  createPersistedStore(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storageBackend: 'localStorage',
      fallbackStorage: 'indexedDB', // Fallback if localStorage fails
    }
  )
);
```

### Custom Storage Adapter

```typescript
import { StateStorage } from '@/store/persistence';

class CustomStorageAdapter implements StateStorage {
  async getItem(name: string): Promise<string | null> {
    // Custom implementation
    return null;
  }
  
  async setItem(name: string, value: string): Promise<void> {
    // Custom implementation
  }
  
  async removeItem(name: string): Promise<void> {
    // Custom implementation
  }
}

const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storage: new CustomStorageAdapter(),
    }
  )
);
```

### Hydration Control

```typescript
const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      skipHydration: true, // Don't hydrate on initialization
      onRehydrateStorage: (state) => {
        console.log('Starting hydration...');
        
        return (state, error) => {
          if (error) {
            console.error('Hydration failed:', error);
          } else {
            console.log('Hydration completed:', state);
          }
        };
      },
    }
  )
);

// Manually trigger hydration later
useStore.persist.rehydrate();
```

## API Reference

### PersistOptions

```typescript
interface PersistOptions<T> {
  name: string;                    // Unique storage key
  storage?: StateStorage;          // Storage adapter
  serialize?: (state: T) => string; // Custom serialization
  deserialize?: (str: string) => T; // Custom deserialization
  partialize?: (state: T) => Partial<T>; // Selective persistence
  onRehydrateStorage?: (state: T) => ((state?: T, error?: unknown) => void) | void;
  version?: number;                // State version for migrations
  migrate?: (persistedState: any, version: number) => T;
  merge?: (persistedState: any, currentState: T) => T;
  skipHydration?: boolean;         // Skip auto hydration
  whitelist?: (keyof T)[];        // Fields to include
  blacklist?: (keyof T)[];        // Fields to exclude
  encrypt?: boolean | EncryptionOptions;
  compress?: boolean;
}
```

### Persist API

The persist middleware adds a `persist` object to your store with these methods:

```typescript
store.persist.setOptions(options)    // Update options at runtime
store.persist.clearStorage()         // Clear persisted data
store.persist.rehydrate()           // Manually trigger rehydration
store.persist.hasHydrated()         // Check if hydration is complete
store.persist.onHydrate(callback)   // Subscribe to hydration start
store.persist.onFinishHydration(cb) // Subscribe to hydration end
store.persist.getOptions()          // Get current options
```

## Best Practices

1. **Use unique store names**: Each persisted store should have a unique name to avoid conflicts.

2. **Handle hydration properly**: Always check if data has been hydrated before relying on persisted values.

3. **Secure encryption keys**: Never hardcode encryption keys. Use environment variables or secure key management.

4. **Test migrations**: Always test your migrations with real data before deploying.

5. **Monitor storage usage**: Set up quota monitoring to prevent storage errors.

6. **Use appropriate storage backends**:
   - LocalStorage: Small data (<5MB), simple key-value pairs
   - SessionStorage: Temporary data that should expire with the session
   - IndexedDB: Large data, complex objects, binary data
   - Memory: Testing and temporary caches

7. **Consider performance**: 
   - Enable compression for large state objects
   - Use partialize to persist only necessary data
   - Consider using IndexedDB for frequently updated large data

## Troubleshooting

### Storage Quota Exceeded

```typescript
// Handle quota errors gracefully
storage: createStorageAdapter('localStorage', {
  quota: {
    maxSize: 5 * 1024 * 1024,
    onQuotaExceeded: async (size, maxSize) => {
      // Clear old data
      const stores = await getAllStoreKeys();
      for (const key of stores) {
        if (isOldData(key)) {
          localStorage.removeItem(key);
        }
      }
    },
  },
}),
```

### Encryption/Decryption Errors

```typescript
// Add error handling for encryption
onRehydrateStorage: (state) => {
  return (state, error) => {
    if (error?.message?.includes('decrypt')) {
      console.error('Decryption failed, clearing corrupted data');
      store.persist.clearStorage();
    }
  };
},
```

### Migration Failures

```typescript
// Add validation to migrations
migrate: (persistedState: any, version: number) => {
  try {
    const migrated = runMigrations(persistedState, version);
    validateSchema(migrated);
    return migrated;
  } catch (error) {
    console.error('Migration failed:', error);
    return getDefaultState(); // Return fresh state
  }
},
```

## Examples

See `integration.example.ts` for comprehensive examples of all features.