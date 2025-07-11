# Migration Guide: From Zustand Built-in Persist to Enhanced Persistence

This guide shows how to migrate from Zustand's built-in `persist` middleware to our enhanced persistence system.

## Why Migrate?

Our enhanced persistence middleware offers:
- Better encryption support with field-level encryption
- Built-in compression for large state
- Multiple storage backend support (LocalStorage, SessionStorage, IndexedDB)
- Storage quota management
- Advanced migration utilities
- Better TypeScript support

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
```

**After:**
```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { persist } from '@/store/persistence'
```

### 2. Update Store Configuration

**Before (Basic):**
```typescript
export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        tokens: null,
        // ... rest of store
      }),
      {
        name: 'auth-storage',
      }
    )
  )
)
```

**After (With Enhanced Features):**
```typescript
export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        tokens: null,
        // ... rest of store
      }),
      {
        name: 'auth-storage',
        // New: Encrypt sensitive data
        encrypt: {
          key: process.env.REACT_APP_AUTH_ENCRYPTION_KEY!,
          fields: ['tokens.accessToken', 'tokens.refreshToken'],
          algorithm: 'AES-GCM',
        },
        // New: Only persist necessary fields
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
          // Exclude loading states and temporary data
        }),
        // New: Add version for future migrations
        version: 1,
      }
    )
  )
)
```

### 3. Handle Different Storage Requirements

**Example: Auth Store with Secure Storage**
```typescript
import { IndexedDBAdapter } from '@/store/persistence'

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'auth-storage',
      // Use IndexedDB for better security and larger storage
      storage: new IndexedDBAdapter('myapp-secure-db', 'auth-store'),
      encrypt: {
        key: process.env.REACT_APP_AUTH_ENCRYPTION_KEY!,
        fields: ['tokens', 'user.email'], // Encrypt sensitive fields
      },
    }
  )
)
```

**Example: UI Store with Session Storage**
```typescript
import { SessionStorageAdapter } from '@/store/persistence'

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'ui-storage',
      // Use session storage for temporary UI state
      storage: new SessionStorageAdapter(),
      // No encryption needed for UI state
      encrypt: false,
    }
  )
)
```

**Example: Large Data Store with Compression**
```typescript
export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'recipe-storage',
      // Enable compression for large recipe data
      compress: true,
      // Use IndexedDB for large storage capacity
      storage: new IndexedDBAdapter('myapp-db', 'recipes'),
      // Only persist actual data, not UI state
      blacklist: ['isLoading', 'error', 'selectedRecipeId'],
    }
  )
)
```

### 4. Add Migrations for Existing Data

If you have existing persisted data, add a migration to handle the transition:

```typescript
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'auth-storage', // Keep the same name to preserve data
      version: 2, // Increment version
      migrate: (persistedState: any, version: number) => {
        if (version === 1) {
          // Handle migration from old format
          // The built-in persist stores data directly, 
          // our version wraps it in { state, version }
          return {
            ...persistedState,
            // Add any new fields or transformations
          };
        }
        return persistedState;
      },
    }
  )
)
```

### 5. Storage Migration Strategy

For a smooth transition without data loss:

```typescript
import { LocalStorageAdapter } from '@/store/persistence'

class MigrationStorageAdapter extends LocalStorageAdapter {
  async getItem(name: string): Promise<string | null> {
    // First try to get from new format
    let data = await super.getItem(name);
    
    if (!data) {
      // Try to get from old format (Zustand built-in persist)
      const oldData = localStorage.getItem(name);
      if (oldData) {
        // Wrap old data in new format
        const wrapped = {
          state: JSON.parse(oldData),
          version: 1,
        };
        // Save in new format
        await this.setItem(name, JSON.stringify(wrapped));
        // Remove old format
        localStorage.removeItem(name);
        return JSON.stringify(wrapped);
      }
    }
    
    return data;
  }
}

// Use in store
export const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storage: new MigrationStorageAdapter(),
      version: 2,
    }
  )
)
```

## Complete Migration Example

Here's a complete example migrating an auth store:

```typescript
// Before: Using Zustand's built-in persist
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface AuthStore {
  user: User | null
  tokens: { access: string; refresh: string } | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        tokens: null,
        isAuthenticated: false,
        login: async (email, password) => {
          // ... login logic
        },
        logout: () => {
          set({ user: null, tokens: null, isAuthenticated: false })
        },
      }),
      {
        name: 'auth-storage',
        getStorage: () => localStorage,
      }
    )
  )
)
```

```typescript
// After: Using enhanced persistence
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { persist, generateSecureKey } from '@/store/persistence'

interface AuthStore {
  user: User | null
  tokens: { access: string; refresh: string } | null
  isAuthenticated: boolean
  isLoading: boolean // New: won't be persisted
  error: string | null // New: won't be persisted
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

// Generate and save this key securely
// console.log('Auth encryption key:', generateSecureKey())

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: async (email, password) => {
          set({ isLoading: true, error: null })
          try {
            // ... login logic
            set({ 
              user: userData, 
              tokens: tokenData, 
              isAuthenticated: true,
              isLoading: false 
            })
          } catch (error) {
            set({ error: error.message, isLoading: false })
          }
        },
        logout: () => {
          set({ 
            user: null, 
            tokens: null, 
            isAuthenticated: false,
            error: null 
          })
        },
      }),
      {
        name: 'auth-storage',
        version: 2,
        // Only persist auth-related data
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
        }),
        // Encrypt sensitive tokens
        encrypt: {
          key: process.env.REACT_APP_AUTH_KEY!,
          fields: ['tokens.access', 'tokens.refresh'],
        },
        // Handle migration from v1 (built-in persist)
        migrate: (persistedState: any, version: number) => {
          if (version === undefined || version === 1) {
            // Old format stored data directly
            return {
              user: persistedState.user || null,
              tokens: persistedState.tokens || null,
              isAuthenticated: persistedState.isAuthenticated || false,
            }
          }
          return persistedState
        },
        // Add rehydration callback
        onRehydrateStorage: () => {
          console.log('Auth store rehydrating...')
          return (state, error) => {
            if (error) {
              console.error('Auth rehydration failed:', error)
            } else if (state?.isAuthenticated) {
              console.log('User authenticated from storage')
              // Could refresh token here if needed
            }
          }
        },
      }
    ),
    {
      name: 'AuthStore',
    }
  )
)
```

## Testing the Migration

1. **Backup existing data** before migration
2. **Test in development** with real data
3. **Implement gradual rollout** using feature flags
4. **Monitor for errors** during migration
5. **Have a rollback plan** ready

## Common Issues and Solutions

### Issue: Old data not loading
**Solution:** Make sure to keep the same storage key name and implement proper migration logic.

### Issue: Encryption key not available
**Solution:** Use a fallback or generate a key on first run:
```typescript
const getEncryptionKey = () => {
  let key = process.env.REACT_APP_ENCRYPTION_KEY
  if (!key && process.env.NODE_ENV === 'development') {
    key = 'dev-only-encryption-key'
  }
  return key!
}
```

### Issue: Storage quota exceeded
**Solution:** Enable compression or switch to IndexedDB:
```typescript
storage: new IndexedDBAdapter('myapp-db'),
compress: true,
```

### Issue: TypeScript errors
**Solution:** Our persistence middleware maintains full type safety. Make sure to import types:
```typescript
import type { PersistOptions } from '@/store/persistence'
```