import { create } from 'zustand';
import { persist } from '../persistenceMiddleware';
import { MemoryAdapter } from '../storageAdapters';
import { migrationHelpers } from '../migrations';
import { generateSecureKey } from '../encryption';

// Mock crypto API for testing
global.crypto = {
  subtle: {
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    digest: jest.fn(),
  },
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
} as any;

describe('Persistence Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Persistence', () => {
    it('should persist and restore state', async () => {
      const storage = new MemoryAdapter();
      
      interface TestStore {
        count: number;
        increment: () => void;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            count: 0,
            increment: () => set((state) => ({ count: state.count + 1 })),
          }),
          {
            name: 'test-store',
            storage,
          }
        )
      );

      // Initial state
      expect(useStore.getState().count).toBe(0);

      // Update state
      useStore.getState().increment();
      expect(useStore.getState().count).toBe(1);

      // Check if persisted
      const persisted = await storage.getItem('test-store');
      expect(persisted).toBeTruthy();
      const parsed = JSON.parse(persisted!);
      expect(parsed.state.count).toBe(1);
    });

    it('should handle partialize option', async () => {
      const storage = new MemoryAdapter();
      
      interface TestStore {
        persisted: string;
        notPersisted: string;
        setPersisted: (value: string) => void;
        setNotPersisted: (value: string) => void;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            persisted: 'saved',
            notPersisted: 'temporary',
            setPersisted: (persisted) => set({ persisted }),
            setNotPersisted: (notPersisted) => set({ notPersisted }),
          }),
          {
            name: 'partial-store',
            storage,
            partialize: (state) => ({ persisted: state.persisted }),
          }
        )
      );

      // Update both values
      useStore.getState().setPersisted('updated');
      useStore.getState().setNotPersisted('changed');

      // Check persisted data
      const persisted = await storage.getItem('partial-store');
      const parsed = JSON.parse(persisted!);
      expect(parsed.state.persisted).toBe('updated');
      expect(parsed.state.notPersisted).toBeUndefined();
    });
  });

  describe('Whitelist and Blacklist', () => {
    it('should respect whitelist', async () => {
      const storage = new MemoryAdapter();
      
      interface TestStore {
        included1: string;
        included2: string;
        excluded: string;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            included1: 'yes1',
            included2: 'yes2',
            excluded: 'no',
          }),
          {
            name: 'whitelist-store',
            storage,
            whitelist: ['included1', 'included2'],
          }
        )
      );

      const persisted = await storage.getItem('whitelist-store');
      const parsed = JSON.parse(persisted!);
      expect(parsed.state.included1).toBe('yes1');
      expect(parsed.state.included2).toBe('yes2');
      expect(parsed.state.excluded).toBeUndefined();
    });

    it('should respect blacklist', async () => {
      const storage = new MemoryAdapter();
      
      interface TestStore {
        included: string;
        excluded1: string;
        excluded2: string;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            included: 'yes',
            excluded1: 'no1',
            excluded2: 'no2',
          }),
          {
            name: 'blacklist-store',
            storage,
            blacklist: ['excluded1', 'excluded2'],
          }
        )
      );

      const persisted = await storage.getItem('blacklist-store');
      const parsed = JSON.parse(persisted!);
      expect(parsed.state.included).toBe('yes');
      expect(parsed.state.excluded1).toBeUndefined();
      expect(parsed.state.excluded2).toBeUndefined();
    });
  });

  describe('Compression', () => {
    it('should compress data when enabled', async () => {
      const storage = new MemoryAdapter();
      const largeData = 'x'.repeat(2000); // Create data over threshold
      
      interface TestStore {
        data: string;
        setData: (data: string) => void;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            data: largeData,
            setData: (data) => set({ data }),
          }),
          {
            name: 'compress-store',
            storage,
            compress: true,
          }
        )
      );

      const compressed = await storage.getItem('compress-store');
      const parsed = JSON.parse(compressed!);
      
      // Check if compression wrapper exists
      expect(parsed._compressed).toBe(true);
      expect(parsed.algorithm).toBe('lz-string');
      expect(parsed.originalSize).toBeGreaterThan(parsed.compressedSize);
    });

    it('should not compress small data', async () => {
      const storage = new MemoryAdapter();
      
      interface TestStore {
        data: string;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            data: 'small',
          }),
          {
            name: 'no-compress-store',
            storage,
            compress: true,
          }
        )
      );

      const stored = await storage.getItem('no-compress-store');
      const parsed = JSON.parse(stored!);
      
      // Should not have compression wrapper
      expect(parsed._compressed).toBeUndefined();
      expect(parsed.state.data).toBe('small');
    });
  });

  describe('Migrations', () => {
    it('should run migrations based on version', async () => {
      const storage = new MemoryAdapter();
      
      // Set up old version data
      await storage.setItem('migrate-store', JSON.stringify({
        state: { oldField: 'value' },
        version: 1,
      }));

      interface TestStore {
        newField: string;
        renamedField?: string;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            newField: 'default',
          }),
          {
            name: 'migrate-store',
            storage,
            version: 2,
            migrate: (persistedState: any, version: number) => {
              if (version === 1) {
                return {
                  newField: 'migrated',
                  renamedField: persistedState.oldField,
                };
              }
              return persistedState;
            },
          }
        )
      );

      // Allow time for async hydration
      await new Promise(resolve => setTimeout(resolve, 100));

      const state = useStore.getState();
      expect(state.newField).toBe('migrated');
      expect(state.renamedField).toBe('value');
    });

    it('should use migration helpers', () => {
      const state = { oldName: 'value', toRemove: 'gone' };
      
      const migrated = migrationHelpers.compose(
        migrationHelpers.renameField('oldName', 'newName'),
        migrationHelpers.removeField('toRemove'),
        migrationHelpers.addField('added', 'default')
      )(state);

      expect(migrated).toEqual({
        newName: 'value',
        added: 'default',
      });
      expect(migrated.oldName).toBeUndefined();
      expect(migrated.toRemove).toBeUndefined();
    });
  });

  describe('Storage Adapters', () => {
    it('should handle storage errors gracefully', async () => {
      const failingStorage = {
        getItem: jest.fn().mockRejectedValue(new Error('Storage failed')),
        setItem: jest.fn().mockRejectedValue(new Error('Storage failed')),
        removeItem: jest.fn().mockResolvedValue(undefined),
      };

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      interface TestStore {
        data: string;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            data: 'test',
          }),
          {
            name: 'error-store',
            storage: failingStorage,
          }
        )
      );

      // Allow time for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('Encryption', () => {
    it('should generate secure keys', () => {
      const key1 = generateSecureKey(32);
      const key2 = generateSecureKey(32);
      
      expect(key1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(key2).toHaveLength(64);
      expect(key1).not.toBe(key2); // Keys should be unique
    });
  });

  describe('Persist API', () => {
    it('should provide persist API methods', () => {
      const storage = new MemoryAdapter();
      
      interface TestStore {
        data: string;
      }

      const useStore = create<TestStore>()(
        persist(
          (set) => ({
            data: 'test',
          }),
          {
            name: 'api-store',
            storage,
          }
        )
      );

      const state = useStore.getState() as any;
      expect(state.persist).toBeDefined();
      expect(typeof state.persist.setOptions).toBe('function');
      expect(typeof state.persist.clearStorage).toBe('function');
      expect(typeof state.persist.rehydrate).toBe('function');
      expect(typeof state.persist.getOptions).toBe('function');
    });
  });
});