import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { CacheManager } from '../cache/cacheManager';
import { cacheMiddleware } from '../cache/cacheMiddleware';
import { create } from 'zustand';
import type { CacheEntry, CacheConfig } from '../cache/types';

describe('Cache Management', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    jest.useFakeTimers();
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('CacheManager', () => {
    describe('Basic Operations', () => {
      it('should set and get cache entries', () => {
        const key = 'test-key';
        const data = { value: 'test-data' };

        cacheManager.set(key, data, { ttl: 5000 });
        const cached = cacheManager.get(key);

        expect(cached).toEqual(data);
      });

      it('should return null for non-existent keys', () => {
        const result = cacheManager.get('non-existent');
        expect(result).toBeNull();
      });

      it('should invalidate specific cache entries', () => {
        const key = 'test-key';
        cacheManager.set(key, { value: 'data' }, { ttl: 5000 });

        cacheManager.invalidate(key);
        const cached = cacheManager.get(key);

        expect(cached).toBeNull();
      });

      it('should clear all cache entries', () => {
        cacheManager.set('key1', { value: 'data1' }, { ttl: 5000 });
        cacheManager.set('key2', { value: 'data2' }, { ttl: 5000 });

        cacheManager.clear();

        expect(cacheManager.get('key1')).toBeNull();
        expect(cacheManager.get('key2')).toBeNull();
      });
    });

    describe('TTL Expiration', () => {
      it('should expire entries after TTL', () => {
        const key = 'expiring-key';
        const data = { value: 'expiring-data' };

        cacheManager.set(key, data, { ttl: 1000 });
        expect(cacheManager.get(key)).toEqual(data);

        // Advance time past TTL
        jest.advanceTimersByTime(1001);
        expect(cacheManager.get(key)).toBeNull();
      });

      it('should handle entries without TTL', () => {
        const key = 'permanent-key';
        const data = { value: 'permanent-data' };

        cacheManager.set(key, data);
        
        // Advance time significantly
        jest.advanceTimersByTime(1000000);
        expect(cacheManager.get(key)).toEqual(data);
      });

      it('should update expiration time on set', () => {
        const key = 'update-key';
        
        cacheManager.set(key, { value: 'initial' }, { ttl: 1000 });
        jest.advanceTimersByTime(800);
        
        // Update with new TTL
        cacheManager.set(key, { value: 'updated' }, { ttl: 2000 });
        jest.advanceTimersByTime(1500);
        
        // Should still exist after original TTL would have expired
        expect(cacheManager.get(key)).toEqual({ value: 'updated' });
      });
    });

    describe('Eviction Policies', () => {
      it('should evict entries when max size is reached (LRU)', () => {
        const manager = new CacheManager({ maxSize: 3, evictionPolicy: 'lru' });

        manager.set('key1', { value: 'data1' });
        manager.set('key2', { value: 'data2' });
        manager.set('key3', { value: 'data3' });
        
        // Access key1 to make it recently used
        manager.get('key1');
        
        // Add new entry, should evict key2 (least recently used)
        manager.set('key4', { value: 'data4' });

        expect(manager.get('key1')).toEqual({ value: 'data1' });
        expect(manager.get('key2')).toBeNull();
        expect(manager.get('key3')).toEqual({ value: 'data3' });
        expect(manager.get('key4')).toEqual({ value: 'data4' });
      });

      it('should evict entries when max size is reached (FIFO)', () => {
        const manager = new CacheManager({ maxSize: 3, evictionPolicy: 'fifo' });

        manager.set('key1', { value: 'data1' });
        manager.set('key2', { value: 'data2' });
        manager.set('key3', { value: 'data3' });
        
        // Add new entry, should evict key1 (first in)
        manager.set('key4', { value: 'data4' });

        expect(manager.get('key1')).toBeNull();
        expect(manager.get('key2')).toEqual({ value: 'data2' });
        expect(manager.get('key3')).toEqual({ value: 'data3' });
        expect(manager.get('key4')).toEqual({ value: 'data4' });
      });
    });

    describe('Pattern-based Invalidation', () => {
      it('should invalidate entries matching pattern', () => {
        cacheManager.set('user:1', { name: 'User 1' });
        cacheManager.set('user:2', { name: 'User 2' });
        cacheManager.set('recipe:1', { title: 'Recipe 1' });

        cacheManager.invalidatePattern(/^user:/);

        expect(cacheManager.get('user:1')).toBeNull();
        expect(cacheManager.get('user:2')).toBeNull();
        expect(cacheManager.get('recipe:1')).toEqual({ title: 'Recipe 1' });
      });

      it('should handle pattern with no matches', () => {
        cacheManager.set('key1', { value: 'data1' });
        cacheManager.set('key2', { value: 'data2' });

        expect(() => {
          cacheManager.invalidatePattern(/^nonexistent:/);
        }).not.toThrow();

        expect(cacheManager.get('key1')).toEqual({ value: 'data1' });
        expect(cacheManager.get('key2')).toEqual({ value: 'data2' });
      });
    });

    describe('Cache Statistics', () => {
      it('should track cache hits and misses', () => {
        cacheManager.set('key1', { value: 'data1' });

        // Hits
        cacheManager.get('key1');
        cacheManager.get('key1');

        // Misses
        cacheManager.get('nonexistent1');
        cacheManager.get('nonexistent2');
        cacheManager.get('nonexistent3');

        const stats = cacheManager.getStats();
        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(3);
        expect(stats.hitRate).toBeCloseTo(0.4, 2);
      });

      it('should track evictions', () => {
        const manager = new CacheManager({ maxSize: 2, evictionPolicy: 'lru' });

        manager.set('key1', { value: 'data1' });
        manager.set('key2', { value: 'data2' });
        manager.set('key3', { value: 'data3' }); // Evicts key1
        manager.set('key4', { value: 'data4' }); // Evicts key2

        const stats = manager.getStats();
        expect(stats.evictions).toBe(2);
      });
    });
  });

  describe('Cache Middleware', () => {
    interface TestState {
      users: Record<string, { id: string; name: string }>;
      recipes: Record<string, { id: string; title: string }>;
      fetchUser: (id: string) => Promise<void>;
      fetchRecipe: (id: string) => Promise<void>;
    }

    it('should cache API responses', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ id: '1', name: 'Test User' });

      const useStore = create<TestState>()(
        cacheMiddleware(
          {
            'fetchUser': {
              ttl: 5000,
              getCacheKey: (id: string) => `user:${id}`,
            },
          },
          (set) => ({
            users: {},
            recipes: {},
            fetchUser: async (id: string) => {
              const user = await mockFetch(id);
              set((state) => ({
                users: { ...state.users, [id]: user },
              }));
            },
            fetchRecipe: async (id: string) => {
              // Not cached
            },
          })
        )
      );

      const store = useStore.getState();

      // First call should hit the API
      await store.fetchUser('1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await store.fetchUser('1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Different ID should hit API
      await store.fetchUser('2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache on mutations', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ id: '1', name: 'Test User' });

      const useStore = create<TestState & { updateUser: (id: string, name: string) => void }>()(
        cacheMiddleware(
          {
            'fetchUser': {
              ttl: 5000,
              getCacheKey: (id: string) => `user:${id}`,
            },
            'updateUser': {
              invalidates: ['user:*'],
            },
          },
          (set) => ({
            users: {},
            recipes: {},
            fetchUser: async (id: string) => {
              const user = await mockFetch(id);
              set((state) => ({
                users: { ...state.users, [id]: user },
              }));
            },
            fetchRecipe: async () => {},
            updateUser: (id: string, name: string) => {
              set((state) => ({
                users: {
                  ...state.users,
                  [id]: { ...state.users[id], name },
                },
              }));
            },
          })
        )
      );

      const store = useStore.getState();

      // Fetch and cache user
      await store.fetchUser('1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Update user - should invalidate cache
      store.updateUser('1', 'Updated Name');

      // Next fetch should hit API again
      await store.fetchUser('1');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle cache errors gracefully', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ id: '1', name: 'Test User' });
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Create a broken cache manager
      const brokenCacheManager = {
        get: () => { throw new Error('Cache error'); },
        set: () => { throw new Error('Cache error'); },
        invalidate: () => {},
        invalidatePattern: () => {},
        clear: () => {},
        getStats: () => ({ hits: 0, misses: 0, evictions: 0, hitRate: 0 }),
      };

      const useStore = create<TestState>()(
        cacheMiddleware(
          {
            'fetchUser': {
              ttl: 5000,
              getCacheKey: (id: string) => `user:${id}`,
            },
          },
          (set) => ({
            users: {},
            recipes: {},
            fetchUser: async (id: string) => {
              const user = await mockFetch(id);
              set((state) => ({
                users: { ...state.users, [id]: user },
              }));
            },
            fetchRecipe: async () => {},
          }),
          brokenCacheManager as any
        )
      );

      const store = useStore.getState();

      // Should still work despite cache errors
      await store.fetchUser('1');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should support conditional caching', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ id: '1', name: 'Test User' });

      const useStore = create<TestState & { skipCache?: boolean }>()(
        cacheMiddleware(
          {
            'fetchUser': {
              ttl: 5000,
              getCacheKey: (id: string) => `user:${id}`,
              shouldCache: (state) => !state.skipCache,
            },
          },
          (set, get) => ({
            users: {},
            recipes: {},
            skipCache: false,
            fetchUser: async (id: string) => {
              const user = await mockFetch(id);
              set((state) => ({
                users: { ...state.users, [id]: user },
              }));
            },
            fetchRecipe: async () => {},
          })
        )
      );

      // First call with caching enabled
      await useStore.getState().fetchUser('1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await useStore.getState().fetchUser('1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Disable caching
      useStore.setState({ skipCache: true });

      // Third call should bypass cache
      await useStore.getState().fetchUser('1');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});