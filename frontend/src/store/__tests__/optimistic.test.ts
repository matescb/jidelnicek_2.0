import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { create } from 'zustand';
import { optimisticMiddleware } from '../optimistic/optimisticMiddleware';
import { RollbackManager } from '../optimistic/rollbackManager';
import { UpdateQueue } from '../optimistic/updateQueue';
import { useOptimisticUpdate, useOptimisticState } from '../optimistic/hooks';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { OptimisticConfig, OptimisticUpdate } from '../optimistic/types';

describe('Optimistic Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('UpdateQueue', () => {
    let queue: UpdateQueue<any>;

    beforeEach(() => {
      queue = new UpdateQueue();
    });

    it('should enqueue and dequeue updates', () => {
      const update1: OptimisticUpdate<any> = {
        id: '1',
        type: 'update',
        payload: { data: 'test1' },
        timestamp: Date.now(),
      };
      const update2: OptimisticUpdate<any> = {
        id: '2',
        type: 'update',
        payload: { data: 'test2' },
        timestamp: Date.now() + 1,
      };

      queue.enqueue(update1);
      queue.enqueue(update2);

      expect(queue.size()).toBe(2);
      expect(queue.dequeue()).toEqual(update1);
      expect(queue.dequeue()).toEqual(update2);
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should peek without removing', () => {
      const update: OptimisticUpdate<any> = {
        id: '1',
        type: 'update',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      queue.enqueue(update);
      
      expect(queue.peek()).toEqual(update);
      expect(queue.size()).toBe(1);
    });

    it('should find updates by id', () => {
      const updates = [
        { id: '1', type: 'update', payload: {}, timestamp: Date.now() },
        { id: '2', type: 'update', payload: {}, timestamp: Date.now() + 1 },
        { id: '3', type: 'update', payload: {}, timestamp: Date.now() + 2 },
      ] as OptimisticUpdate<any>[];

      updates.forEach(u => queue.enqueue(u));

      expect(queue.find('2')).toEqual(updates[1]);
      expect(queue.find('4')).toBeUndefined();
    });

    it('should remove updates by id', () => {
      const updates = [
        { id: '1', type: 'update', payload: {}, timestamp: Date.now() },
        { id: '2', type: 'update', payload: {}, timestamp: Date.now() + 1 },
        { id: '3', type: 'update', payload: {}, timestamp: Date.now() + 2 },
      ] as OptimisticUpdate<any>[];

      updates.forEach(u => queue.enqueue(u));

      expect(queue.remove('2')).toBe(true);
      expect(queue.size()).toBe(2);
      expect(queue.find('2')).toBeUndefined();
      expect(queue.remove('4')).toBe(false);
    });

    it('should clear all updates', () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue({
          id: `${i}`,
          type: 'update',
          payload: {},
          timestamp: Date.now() + i,
        });
      }

      expect(queue.size()).toBe(5);
      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should get all updates', () => {
      const updates = [
        { id: '1', type: 'update', payload: {}, timestamp: Date.now() },
        { id: '2', type: 'update', payload: {}, timestamp: Date.now() + 1 },
      ] as OptimisticUpdate<any>[];

      updates.forEach(u => queue.enqueue(u));

      const allUpdates = queue.getAll();
      expect(allUpdates).toHaveLength(2);
      expect(allUpdates).toEqual(updates);
    });
  });

  describe('RollbackManager', () => {
    let rollbackManager: RollbackManager<any>;

    beforeEach(() => {
      rollbackManager = new RollbackManager();
    });

    it('should save and restore snapshots', () => {
      const state1 = { count: 1, name: 'test' };
      const state2 = { count: 2, name: 'updated' };

      rollbackManager.saveSnapshot('update1', state1);
      rollbackManager.saveSnapshot('update2', state2);

      expect(rollbackManager.getSnapshot('update1')).toEqual(state1);
      expect(rollbackManager.getSnapshot('update2')).toEqual(state2);
    });

    it('should remove snapshots', () => {
      const state = { count: 1 };

      rollbackManager.saveSnapshot('update1', state);
      expect(rollbackManager.hasSnapshot('update1')).toBe(true);

      rollbackManager.removeSnapshot('update1');
      expect(rollbackManager.hasSnapshot('update1')).toBe(false);
      expect(rollbackManager.getSnapshot('update1')).toBeUndefined();
    });

    it('should rollback to specific update', () => {
      const states = [
        { count: 0 },
        { count: 1 },
        { count: 2 },
        { count: 3 },
      ];

      states.forEach((state, i) => {
        rollbackManager.saveSnapshot(`update${i}`, state);
      });

      const rolledBack = rollbackManager.rollbackTo('update1');
      expect(rolledBack).toEqual({ count: 1 });

      // Should remove all snapshots after the rollback point
      expect(rollbackManager.hasSnapshot('update2')).toBe(false);
      expect(rollbackManager.hasSnapshot('update3')).toBe(false);
      expect(rollbackManager.hasSnapshot('update1')).toBe(true);
      expect(rollbackManager.hasSnapshot('update0')).toBe(true);
    });

    it('should handle rollback to non-existent update', () => {
      rollbackManager.saveSnapshot('update1', { count: 1 });
      
      const result = rollbackManager.rollbackTo('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should clear all snapshots', () => {
      rollbackManager.saveSnapshot('update1', { count: 1 });
      rollbackManager.saveSnapshot('update2', { count: 2 });

      rollbackManager.clear();

      expect(rollbackManager.hasSnapshot('update1')).toBe(false);
      expect(rollbackManager.hasSnapshot('update2')).toBe(false);
    });

    it('should handle complex state structures', () => {
      const complexState = {
        users: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }],
        settings: { theme: 'dark', notifications: true },
        nested: { deep: { value: 42 } },
      };

      rollbackManager.saveSnapshot('complex', complexState);
      const retrieved = rollbackManager.getSnapshot('complex');

      expect(retrieved).toEqual(complexState);
      // Ensure deep clone
      expect(retrieved).not.toBe(complexState);
      expect(retrieved!.users).not.toBe(complexState.users);
    });
  });

  describe('Optimistic Middleware', () => {
    interface TestState {
      items: Array<{ id: string; name: string; status: string }>;
      loading: boolean;
      error: string | null;
      addItem: (item: { name: string }) => Promise<void>;
      updateItem: (id: string, updates: Partial<{ name: string; status: string }>) => Promise<void>;
      deleteItem: (id: string) => Promise<void>;
    }

    it('should apply optimistic updates immediately', async () => {
      const mockApi = {
        addItem: jest.fn().mockResolvedValue({ id: 'new-id', name: 'New Item', status: 'active' }),
        updateItem: jest.fn().mockResolvedValue(true),
        deleteItem: jest.fn().mockResolvedValue(true),
      };

      const config: OptimisticConfig<TestState> = {
        addItem: {
          optimisticUpdate: (state, item) => ({
            items: [...state.items, { id: 'temp-id', ...item, status: 'pending' }],
          }),
          rollbackUpdate: (state, error, item) => ({
            items: state.items.filter(i => i.id !== 'temp-id'),
            error: error.message,
          }),
        },
      };

      const useStore = create<TestState>()(
        optimisticMiddleware(
          config,
          (set, get) => ({
            items: [],
            loading: false,
            error: null,
            addItem: async (item) => {
              const newItem = await mockApi.addItem(item);
              set((state) => ({
                items: state.items.map(i => 
                  i.id === 'temp-id' ? newItem : i
                ),
              }));
            },
            updateItem: async (id, updates) => {
              await mockApi.updateItem(id, updates);
              set((state) => ({
                items: state.items.map(i =>
                  i.id === id ? { ...i, ...updates } : i
                ),
              }));
            },
            deleteItem: async (id) => {
              await mockApi.deleteItem(id);
              set((state) => ({
                items: state.items.filter(i => i.id !== id),
              }));
            },
          })
        )
      );

      const { addItem } = useStore.getState();

      // Check initial state
      expect(useStore.getState().items).toHaveLength(0);

      // Add item - should see optimistic update immediately
      const addPromise = addItem({ name: 'Test Item' });
      
      // Optimistic update should be applied
      expect(useStore.getState().items).toHaveLength(1);
      expect(useStore.getState().items[0]).toEqual({
        id: 'temp-id',
        name: 'Test Item',
        status: 'pending',
      });

      // Wait for API call to complete
      await addPromise;

      // Final state should have real data
      expect(useStore.getState().items).toHaveLength(1);
      expect(useStore.getState().items[0]).toEqual({
        id: 'new-id',
        name: 'New Item',
        status: 'active',
      });
    });

    it('should rollback on failure', async () => {
      const mockApi = {
        updateItem: jest.fn().mockRejectedValue(new Error('API Error')),
      };

      const config: OptimisticConfig<TestState> = {
        updateItem: {
          optimisticUpdate: (state, id, updates) => ({
            items: state.items.map(item =>
              item.id === id ? { ...item, ...updates } : item
            ),
          }),
          rollbackUpdate: (state, error) => ({
            error: error.message,
          }),
        },
      };

      const useStore = create<TestState>()(
        optimisticMiddleware(
          config,
          (set) => ({
            items: [{ id: '1', name: 'Original', status: 'active' }],
            loading: false,
            error: null,
            addItem: async () => {},
            updateItem: async (id, updates) => {
              await mockApi.updateItem(id, updates);
              set((state) => ({
                items: state.items.map(i =>
                  i.id === id ? { ...i, ...updates } : i
                ),
              }));
            },
            deleteItem: async () => {},
          })
        )
      );

      const { updateItem } = useStore.getState();

      // Attempt update
      const updatePromise = updateItem('1', { name: 'Updated' });

      // Optimistic update should be applied
      expect(useStore.getState().items[0].name).toBe('Updated');

      // Wait for failure
      await expect(updatePromise).rejects.toThrow('API Error');

      // Should rollback to original state
      expect(useStore.getState().items[0].name).toBe('Original');
      expect(useStore.getState().error).toBe('API Error');
    });

    it('should handle concurrent updates', async () => {
      let resolveUpdate1: () => void;
      let resolveUpdate2: () => void;

      const mockApi = {
        updateItem: jest.fn()
          .mockImplementationOnce(() => new Promise(resolve => { resolveUpdate1 = () => resolve(true); }))
          .mockImplementationOnce(() => new Promise(resolve => { resolveUpdate2 = () => resolve(true); })),
      };

      const config: OptimisticConfig<TestState> = {
        updateItem: {
          optimisticUpdate: (state, id, updates) => ({
            items: state.items.map(item =>
              item.id === id ? { ...item, ...updates } : item
            ),
          }),
        },
      };

      const useStore = create<TestState>()(
        optimisticMiddleware(
          config,
          (set) => ({
            items: [
              { id: '1', name: 'Item 1', status: 'active' },
              { id: '2', name: 'Item 2', status: 'active' },
            ],
            loading: false,
            error: null,
            addItem: async () => {},
            updateItem: async (id, updates) => {
              await mockApi.updateItem(id, updates);
              set((state) => ({
                items: state.items.map(i =>
                  i.id === id ? { ...i, ...updates } : i
                ),
              }));
            },
            deleteItem: async () => {},
          })
        )
      );

      const { updateItem } = useStore.getState();

      // Start two concurrent updates
      const update1 = updateItem('1', { name: 'Updated 1' });
      const update2 = updateItem('2', { name: 'Updated 2' });

      // Both optimistic updates should be applied
      expect(useStore.getState().items[0].name).toBe('Updated 1');
      expect(useStore.getState().items[1].name).toBe('Updated 2');

      // Resolve in reverse order
      resolveUpdate2!();
      await update2;
      
      resolveUpdate1!();
      await update1;

      // Both updates should be maintained
      expect(useStore.getState().items[0].name).toBe('Updated 1');
      expect(useStore.getState().items[1].name).toBe('Updated 2');
    });

    it('should handle queue overflow', async () => {
      const config: OptimisticConfig<TestState> = {
        maxQueueSize: 3,
        updateItem: {
          optimisticUpdate: (state, id, updates) => ({
            items: state.items.map(item =>
              item.id === id ? { ...item, ...updates } : item
            ),
          }),
        },
      };

      const useStore = create<TestState>()(
        optimisticMiddleware(
          config,
          (set) => ({
            items: Array.from({ length: 5 }, (_, i) => ({
              id: `${i}`,
              name: `Item ${i}`,
              status: 'active',
            })),
            loading: false,
            error: null,
            addItem: async () => {},
            updateItem: async (id, updates) => {
              // Simulate slow API
              await new Promise(resolve => setTimeout(resolve, 100));
              set((state) => ({
                items: state.items.map(i =>
                  i.id === id ? { ...i, ...updates } : i
                ),
              }));
            },
            deleteItem: async () => {},
          })
        )
      );

      const { updateItem } = useStore.getState();

      // Try to queue more than maxQueueSize
      const updates = Array.from({ length: 5 }, (_, i) =>
        updateItem(`${i}`, { name: `Updated ${i}` })
      );

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should handle overflow gracefully
      await Promise.allSettled(updates);
      
      // All updates should eventually succeed
      const finalItems = useStore.getState().items;
      finalItems.forEach((item, i) => {
        expect(item.name).toBe(`Updated ${i}`);
      });
    });

    it('should support custom merge strategies', async () => {
      const config: OptimisticConfig<TestState> = {
        updateItem: {
          optimisticUpdate: (state, id, updates) => ({
            items: state.items.map(item =>
              item.id === id ? { ...item, ...updates, status: 'updating' } : item
            ),
          }),
          mergeStrategy: (optimistic, resolved) => ({
            ...resolved,
            items: resolved.items.map((item: any) => {
              const optItem = optimistic.items.find((i: any) => i.id === item.id);
              return optItem?.status === 'updating'
                ? { ...item, status: 'updated' }
                : item;
            }),
          }),
        },
      };

      const useStore = create<TestState>()(
        optimisticMiddleware(
          config,
          (set) => ({
            items: [{ id: '1', name: 'Item', status: 'active' }],
            loading: false,
            error: null,
            addItem: async () => {},
            updateItem: async (id, updates) => {
              await new Promise(resolve => setTimeout(resolve, 10));
              set((state) => ({
                items: state.items.map(i =>
                  i.id === id ? { ...i, ...updates } : i
                ),
              }));
            },
            deleteItem: async () => {},
          })
        )
      );

      await useStore.getState().updateItem('1', { name: 'Updated' });

      // Custom merge should set status to 'updated'
      expect(useStore.getState().items[0]).toEqual({
        id: '1',
        name: 'Updated',
        status: 'updated',
      });
    });
  });

  describe('Optimistic Hooks', () => {
    interface TestState {
      count: number;
      text: string;
      increment: () => Promise<void>;
      updateText: (text: string) => Promise<void>;
    }

    it('should use optimistic update hook', async () => {
      const mockApi = {
        increment: jest.fn().mockResolvedValue(true),
      };

      const useStore = create<TestState>()((set) => ({
        count: 0,
        text: '',
        increment: async () => {
          await mockApi.increment();
          set((state) => ({ count: state.count + 1 }));
        },
        updateText: async (text) => {
          set({ text });
        },
      }));

      const { result } = renderHook(() => {
        const store = useStore();
        const optimistic = useOptimisticUpdate(
          store,
          'increment',
          {
            optimisticUpdate: (state) => ({ count: state.count + 1 }),
            rollbackUpdate: (state) => ({ count: state.count - 1 }),
          }
        );
        return { store, optimistic };
      });

      expect(result.current.store.count).toBe(0);

      await act(async () => {
        await result.current.optimistic();
      });

      expect(result.current.store.count).toBe(1);
      expect(mockApi.increment).toHaveBeenCalled();
    });

    it('should track optimistic state', async () => {
      const mockApi = {
        updateText: jest.fn()
          .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(true), 50))),
      };

      const useStore = create<TestState>()((set) => ({
        count: 0,
        text: 'initial',
        increment: async () => {},
        updateText: async (text) => {
          await mockApi.updateText(text);
          set({ text });
        },
      }));

      const { result } = renderHook(() => {
        const store = useStore();
        const [optimisticText, isUpdating] = useOptimisticState(
          store,
          (state) => state.text,
          'updateText'
        );
        return { store, optimisticText, isUpdating };
      });

      expect(result.current.optimisticText).toBe('initial');
      expect(result.current.isUpdating).toBe(false);

      act(() => {
        result.current.store.updateText('updating');
      });

      // Should show optimistic state during update
      await waitFor(() => {
        expect(result.current.isUpdating).toBe(true);
      });

      // Wait for update to complete
      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      expect(result.current.optimisticText).toBe('updating');
    });

    it('should handle rollback in hooks', async () => {
      const mockApi = {
        increment: jest.fn().mockRejectedValue(new Error('API Error')),
      };

      const useStore = create<TestState>()((set) => ({
        count: 10,
        text: '',
        increment: async () => {
          await mockApi.increment();
          set((state) => ({ count: state.count + 1 }));
        },
        updateText: async () => {},
      }));

      const { result } = renderHook(() => {
        const store = useStore();
        const optimistic = useOptimisticUpdate(
          store,
          'increment',
          {
            optimisticUpdate: (state) => ({ count: state.count + 1 }),
            rollbackUpdate: (state) => ({ count: state.count - 1 }),
          }
        );
        return { store, optimistic };
      });

      expect(result.current.store.count).toBe(10);

      await act(async () => {
        try {
          await result.current.optimistic();
        } catch (error) {
          // Expected error
        }
      });

      // Should rollback to original value
      expect(result.current.store.count).toBe(10);
    });
  });
});