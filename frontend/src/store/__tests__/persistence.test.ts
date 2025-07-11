import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { create } from 'zustand';
import { persistenceMiddleware } from '../persistence/persistenceMiddleware';
import { 
  LocalStorageAdapter, 
  SessionStorageAdapter, 
  IndexedDBAdapter,
  createStorageAdapter 
} from '../persistence/storageAdapters';
import { encrypt, decrypt } from '../persistence/encryption';
import { createMigration, runMigrations } from '../persistence/migrations';
import type { PersistenceConfig, StorageAdapter } from '../persistence/types';

// Mock storage implementations
const createMockStorage = (): Storage => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
};

// Mock IndexedDB
const mockIndexedDB = {
  databases: new Map<string, Map<string, any>>(),
  open: jest.fn((name: string) => {
    if (!mockIndexedDB.databases.has(name)) {
      mockIndexedDB.databases.set(name, new Map());
    }
    const db = mockIndexedDB.databases.get(name)!;
    
    return {
      put: jest.fn((key: string, value: any) => {
        db.set(key, value);
        return Promise.resolve();
      }),
      get: jest.fn((key: string) => Promise.resolve(db.get(key))),
      delete: jest.fn((key: string) => {
        db.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        db.clear();
        return Promise.resolve();
      }),
    };
  }),
};

describe('Persistence', () => {
  let mockLocalStorage: Storage;
  let mockSessionStorage: Storage;

  beforeEach(() => {
    mockLocalStorage = createMockStorage();
    mockSessionStorage = createMockStorage();
    
    // Override global storage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Storage Adapters', () => {
    describe('LocalStorageAdapter', () => {
      it('should store and retrieve data', async () => {
        const adapter = new LocalStorageAdapter();
        const key = 'test-key';
        const data = { value: 'test-data' };

        await adapter.setItem(key, data);
        const retrieved = await adapter.getItem(key);

        expect(retrieved).toEqual(data);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify(data));
      });

      it('should handle missing items', async () => {
        const adapter = new LocalStorageAdapter();
        const result = await adapter.getItem('non-existent');
        
        expect(result).toBeNull();
      });

      it('should remove items', async () => {
        const adapter = new LocalStorageAdapter();
        const key = 'test-key';

        await adapter.setItem(key, { value: 'data' });
        await adapter.removeItem(key);

        const result = await adapter.getItem(key);
        expect(result).toBeNull();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);
      });

      it('should clear all items', async () => {
        const adapter = new LocalStorageAdapter();

        await adapter.setItem('key1', { value: 'data1' });
        await adapter.setItem('key2', { value: 'data2' });
        await adapter.clear();

        expect(mockLocalStorage.clear).toHaveBeenCalled();
      });

      it('should handle storage errors', async () => {
        const adapter = new LocalStorageAdapter();
        mockLocalStorage.setItem = jest.fn(() => {
          throw new Error('Storage full');
        });

        await expect(adapter.setItem('key', { value: 'data' })).rejects.toThrow('Storage full');
      });
    });

    describe('SessionStorageAdapter', () => {
      it('should use session storage', async () => {
        const adapter = new SessionStorageAdapter();
        const key = 'session-key';
        const data = { temporary: true };

        await adapter.setItem(key, data);
        
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify(data));
        expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      });
    });

    describe('IndexedDBAdapter', () => {
      beforeEach(() => {
        (global as any).indexedDB = mockIndexedDB;
      });

      it('should store and retrieve data', async () => {
        const adapter = new IndexedDBAdapter('test-db');
        const key = 'idb-key';
        const data = { complex: { nested: 'data' } };

        await adapter.setItem(key, data);
        const retrieved = await adapter.getItem(key);

        expect(retrieved).toEqual(data);
      });

      it('should handle large data', async () => {
        const adapter = new IndexedDBAdapter('test-db');
        const largeData = {
          array: new Array(1000).fill({ nested: 'object' }),
          buffer: new ArrayBuffer(1024 * 1024), // 1MB
        };

        await adapter.setItem('large', largeData);
        const retrieved = await adapter.getItem('large');

        expect(retrieved).toEqual(largeData);
      });
    });

    describe('createStorageAdapter', () => {
      it('should create correct adapter type', () => {
        const localStorage = createStorageAdapter('localStorage');
        expect(localStorage).toBeInstanceOf(LocalStorageAdapter);

        const sessionStorage = createStorageAdapter('sessionStorage');
        expect(sessionStorage).toBeInstanceOf(SessionStorageAdapter);

        const indexedDB = createStorageAdapter('indexedDB', { dbName: 'test' });
        expect(indexedDB).toBeInstanceOf(IndexedDBAdapter);
      });

      it('should handle invalid adapter type', () => {
        expect(() => createStorageAdapter('invalid' as any)).toThrow();
      });
    });
  });

  describe('Encryption', () => {
    const secretKey = 'test-secret-key-32-characters!!!';

    it('should encrypt and decrypt data', async () => {
      const data = { sensitive: 'information', nested: { value: 123 } };
      
      const encrypted = await encrypt(data, secretKey);
      expect(encrypted).not.toEqual(JSON.stringify(data));
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern

      const decrypted = await decrypt(encrypted, secretKey);
      expect(decrypted).toEqual(data);
    });

    it('should handle different data types', async () => {
      const testCases = [
        { type: 'string', data: 'hello world' },
        { type: 'number', data: 42 },
        { type: 'boolean', data: true },
        { type: 'array', data: [1, 2, 3] },
        { type: 'null', data: null },
      ];

      for (const { type, data } of testCases) {
        const encrypted = await encrypt(data, secretKey);
        const decrypted = await decrypt(encrypted, secretKey);
        expect(decrypted).toEqual(data);
      }
    });

    it('should fail with incorrect key', async () => {
      const data = { secret: 'data' };
      const encrypted = await encrypt(data, secretKey);
      
      await expect(decrypt(encrypted, 'wrong-key')).rejects.toThrow();
    });

    it('should handle empty data', async () => {
      const encrypted = await encrypt({}, secretKey);
      const decrypted = await decrypt(encrypted, secretKey);
      expect(decrypted).toEqual({});
    });
  });

  describe('State Migration', () => {
    it('should run migrations in order', async () => {
      const migrations = [
        createMigration(1, (state: any) => ({
          ...state,
          version: 1,
          migrated1: true,
        })),
        createMigration(2, (state: any) => ({
          ...state,
          version: 2,
          migrated2: true,
        })),
      ];

      const initialState = { data: 'initial' };
      const migrated = await runMigrations(initialState, migrations);

      expect(migrated).toEqual({
        data: 'initial',
        version: 2,
        migrated1: true,
        migrated2: true,
      });
    });

    it('should skip already applied migrations', async () => {
      const migration1 = jest.fn((state: any) => ({ ...state, migrated1: true }));
      const migration2 = jest.fn((state: any) => ({ ...state, migrated2: true }));

      const migrations = [
        createMigration(1, migration1),
        createMigration(2, migration2),
      ];

      const stateWithVersion = { data: 'test', _version: 1 };
      await runMigrations(stateWithVersion, migrations);

      expect(migration1).not.toHaveBeenCalled();
      expect(migration2).toHaveBeenCalled();
    });

    it('should handle migration errors', async () => {
      const migrations = [
        createMigration(1, () => {
          throw new Error('Migration failed');
        }),
      ];

      await expect(runMigrations({}, migrations)).rejects.toThrow('Migration failed');
    });

    it('should support async migrations', async () => {
      const migrations = [
        createMigration(1, async (state: any) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { ...state, asyncMigrated: true };
        }),
      ];

      const result = await runMigrations({}, migrations);
      expect(result.asyncMigrated).toBe(true);
    });
  });

  describe('Persistence Middleware', () => {
    interface TestState {
      count: number;
      user: { name: string; email: string } | null;
      settings: { theme: string; notifications: boolean };
      increment: () => void;
      setUser: (user: TestState['user']) => void;
      updateSettings: (settings: Partial<TestState['settings']>) => void;
    }

    it('should persist and restore state', async () => {
      const config: PersistenceConfig<TestState> = {
        name: 'test-store',
        storage: new LocalStorageAdapter(),
      };

      const useStore = create<TestState>()(
        persistenceMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            settings: { theme: 'light', notifications: true },
            increment: () => set((state) => ({ count: state.count + 1 })),
            setUser: (user) => set({ user }),
            updateSettings: (update) => set((state) => ({
              settings: { ...state.settings, ...update },
            })),
          })
        )
      );

      // Make changes
      useStore.getState().increment();
      useStore.getState().setUser({ name: 'Test User', email: 'test@example.com' });

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create new store instance
      const useStore2 = create<TestState>()(
        persistenceMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            settings: { theme: 'light', notifications: true },
            increment: () => set((state) => ({ count: state.count + 1 })),
            setUser: (user) => set({ user }),
            updateSettings: (update) => set((state) => ({
              settings: { ...state.settings, ...update },
            })),
          })
        )
      );

      // Wait for rehydration
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(useStore2.getState().count).toBe(1);
      expect(useStore2.getState().user).toEqual({
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('should handle selective persistence', async () => {
      const config: PersistenceConfig<TestState> = {
        name: 'selective-store',
        storage: new LocalStorageAdapter(),
        partialize: (state) => ({
          user: state.user,
          settings: state.settings,
          // Exclude count and functions
        }),
      };

      const useStore = create<TestState>()(
        persistenceMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            settings: { theme: 'light', notifications: true },
            increment: () => set((state) => ({ count: state.count + 1 })),
            setUser: (user) => set({ user }),
            updateSettings: (update) => set((state) => ({
              settings: { ...state.settings, ...update },
            })),
          })
        )
      );

      useStore.getState().increment();
      useStore.getState().increment();
      useStore.getState().setUser({ name: 'User', email: 'user@test.com' });

      await new Promise(resolve => setTimeout(resolve, 10));

      const stored = await config.storage.getItem('selective-store');
      expect(stored).not.toHaveProperty('count');
      expect(stored).toHaveProperty('user');
      expect(stored).toHaveProperty('settings');
    });

    it('should encrypt sensitive data', async () => {
      const secretKey = 'encryption-key-32-characters!!!!';
      const config: PersistenceConfig<TestState> = {
        name: 'encrypted-store',
        storage: new LocalStorageAdapter(),
        encrypt: true,
        encryptionKey: secretKey,
      };

      const useStore = create<TestState>()(
        persistenceMiddleware(
          config,
          (set) => ({
            count: 0,
            user: { name: 'Sensitive User', email: 'sensitive@test.com' },
            settings: { theme: 'dark', notifications: false },
            increment: () => {},
            setUser: () => {},
            updateSettings: () => {},
          })
        )
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      // Check raw storage - should be encrypted
      const rawData = mockLocalStorage.getItem!('encrypted-store');
      expect(rawData).toBeTruthy();
      expect(rawData).not.toContain('Sensitive User');
      expect(rawData).not.toContain('sensitive@test.com');
    });

    it('should handle storage errors gracefully', async () => {
      const brokenAdapter: StorageAdapter = {
        getItem: jest.fn().mockRejectedValue(new Error('Storage error')),
        setItem: jest.fn().mockRejectedValue(new Error('Storage error')),
        removeItem: jest.fn().mockRejectedValue(new Error('Storage error')),
        clear: jest.fn().mockRejectedValue(new Error('Storage error')),
      };

      const config: PersistenceConfig<TestState> = {
        name: 'error-store',
        storage: brokenAdapter,
        onError: jest.fn(),
      };

      const useStore = create<TestState>()(
        persistenceMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            settings: { theme: 'light', notifications: true },
            increment: () => set((state) => ({ count: state.count + 1 })),
            setUser: (user) => set({ user }),
            updateSettings: () => {},
          })
        )
      );

      // Store should still be functional despite storage errors
      useStore.getState().increment();
      expect(useStore.getState().count).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(config.onError).toHaveBeenCalled();
    });

    it('should support custom serialization', async () => {
      const config: PersistenceConfig<TestState> = {
        name: 'custom-serial-store',
        storage: new LocalStorageAdapter(),
        serialize: (state) => {
          // Custom serialization (e.g., compress, transform)
          return JSON.stringify({ ...state, serialized: true });
        },
        deserialize: (str) => {
          const parsed = JSON.parse(str);
          delete parsed.serialized;
          return parsed;
        },
      };

      const useStore = create<TestState>()(
        persistenceMiddleware(
          config,
          (set) => ({
            count: 42,
            user: null,
            settings: { theme: 'light', notifications: true },
            increment: () => {},
            setUser: () => {},
            updateSettings: () => {},
          })
        )
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      const stored = mockLocalStorage.getItem!('custom-serial-store');
      expect(stored).toContain('serialized');
    });

    it('should handle version mismatches', async () => {
      // Store v1 data
      await mockLocalStorage.setItem!(
        'versioned-store',
        JSON.stringify({ count: 5, _version: 1 })
      );

      const config: PersistenceConfig<TestState> = {
        name: 'versioned-store',
        storage: new LocalStorageAdapter(),
        version: 2,
        migrations: [
          createMigration(2, (state: any) => ({
            ...state,
            count: state.count * 2, // Migrate by doubling count
            migrated: true,
          })),
        ],
      };

      const useStore = create<TestState>()(
        persistenceMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            settings: { theme: 'light', notifications: true },
            increment: () => {},
            setUser: () => {},
            updateSettings: () => {},
          })
        )
      );

      // Wait for rehydration and migration
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(useStore.getState().count).toBe(10); // 5 * 2
      expect((useStore.getState() as any).migrated).toBe(true);
    });
  });
});