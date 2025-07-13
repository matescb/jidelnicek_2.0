import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { create } from 'zustand';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { hydrationMiddleware } from '../hydration/hydrationMiddleware';
import { HydrationProvider, useHydration } from '../hydration/hydrationContext';
import { StateSerializer } from '../hydration/stateSerializer';
import { extractDependencies, resolveDependencyOrder, validateDependencies } from '../hydration/utils';
import type { HydrationConfig, SerializedState, HydrationDependency } from '../hydration/types';

describe('Hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('StateSerializer', () => {
    let serializer: StateSerializer;

    beforeEach(() => {
      serializer = new StateSerializer();
    });

    it('should serialize and deserialize basic state', () => {
      const state = {
        count: 42,
        text: 'Hello World',
        enabled: true,
        data: null,
        items: [1, 2, 3],
        metadata: { author: 'Test', version: '1.0' },
      };

      const serialized = serializer.serialize(state);
      expect(typeof serialized).toBe('string');

      const deserialized = serializer.deserialize(serialized);
      expect(deserialized).toEqual(state);
    });

    it('should handle special types', () => {
      const state = {
        date: new Date('2024-01-01'),
        regex: /test.*pattern/gi,
        set: new Set([1, 2, 3]),
        map: new Map([['key1', 'value1'], ['key2', 'value2']]),
        undefined: undefined,
        symbol: Symbol.for('test'),
      };

      const serialized = serializer.serialize(state);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.date).toBeInstanceOf(Date);
      expect(deserialized.date.toISOString()).toBe(state.date.toISOString());
      
      expect(deserialized.regex).toBeInstanceOf(RegExp);
      expect(deserialized.regex.source).toBe(state.regex.source);
      expect(deserialized.regex.flags).toBe(state.regex.flags);
      
      expect(deserialized.set).toBeInstanceOf(Set);
      expect(Array.from(deserialized.set)).toEqual([1, 2, 3]);
      
      expect(deserialized.map).toBeInstanceOf(Map);
      expect(Array.from(deserialized.map)).toEqual([['key1', 'value1'], ['key2', 'value2']]);
      
      expect(deserialized.undefined).toBeUndefined();
      expect(typeof deserialized.symbol).toBe('symbol');
      expect(deserialized.symbol.toString()).toBe('Symbol(test)');
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'root' };
      obj.self = obj;
      obj.child = { parent: obj };

      const state = { circular: obj };

      const serialized = serializer.serialize(state);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.circular.self).toBe(deserialized.circular);
      expect(deserialized.circular.child.parent).toBe(deserialized.circular);
    });

    it('should support custom serializers', () => {
      class CustomClass {
        constructor(public value: string) {}
      }

      serializer.registerType('CustomClass', {
        test: (value) => value instanceof CustomClass,
        serialize: (value: CustomClass) => ({ value: value.value }),
        deserialize: (data: { value: string }) => new CustomClass(data.value),
      });

      const state = {
        custom: new CustomClass('test-value'),
      };

      const serialized = serializer.serialize(state);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.custom).toBeInstanceOf(CustomClass);
      expect(deserialized.custom.value).toBe('test-value');
    });

    it('should exclude functions by default', () => {
      const state = {
        count: 1,
        increment: () => {},
        async fetchData() {},
        arrow: () => 'arrow',
      };

      const serialized = serializer.serialize(state);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized).toEqual({ count: 1 });
      expect(deserialized).not.toHaveProperty('increment');
      expect(deserialized).not.toHaveProperty('fetchData');
      expect(deserialized).not.toHaveProperty('arrow');
    });

    it('should handle compression', () => {
      const largeState = {
        data: Array(1000).fill({ 
          id: 'test-id',
          name: 'Repeated Name',
          description: 'This is a long description that will be repeated many times',
        }),
      };

      const uncompressed = serializer.serialize(largeState);
      const compressed = serializer.serialize(largeState, { compress: true });

      expect(compressed.length).toBeLessThan(uncompressed.length);

      const decompressed = serializer.deserialize(compressed, { compress: true });
      expect(decompressed).toEqual(largeState);
    });

    it('should validate state structure', () => {
      const schema = {
        count: 'number',
        text: 'string',
        items: 'array',
        optional: 'string?',
      };

      const validState = {
        count: 42,
        text: 'hello',
        items: [1, 2, 3],
      };

      const invalidState = {
        count: 'not a number',
        text: 123,
        items: 'not an array',
      };

      expect(() => serializer.serialize(validState, { schema })).not.toThrow();
      expect(() => serializer.serialize(invalidState, { schema })).toThrow();
    });
  });

  describe('Hydration Middleware', () => {
    interface TestState {
      count: number;
      user: { id: string; name: string } | null;
      items: string[];
      increment: () => void;
      setUser: (user: TestState['user']) => void;
      addItem: (item: string) => void;
      reset: () => void;
    }

    it('should hydrate state from serialized data', () => {
      const serializedState: SerializedState = {
        version: 1,
        data: {
          count: 10,
          user: { id: '123', name: 'Test User' },
          items: ['item1', 'item2'],
        },
        timestamp: Date.now(),
      };

      const config: HydrationConfig<TestState> = {
        name: 'test-store',
        version: 1,
      };

      const useStore = create<TestState>()(
        hydrationMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            items: [],
            increment: () => set((state) => ({ count: state.count + 1 })),
            setUser: (user) => set({ user }),
            addItem: (item) => set((state) => ({ items: [...state.items, item] })),
            reset: () => set({ count: 0, user: null, items: [] }),
          })
        )
      );

      // Hydrate the store
      (useStore as any).hydrate(serializedState);

      const state = useStore.getState();
      expect(state.count).toBe(10);
      expect(state.user).toEqual({ id: '123', name: 'Test User' });
      expect(state.items).toEqual(['item1', 'item2']);
    });

    it('should handle partial hydration', () => {
      const serializedState: SerializedState = {
        version: 1,
        data: {
          count: 5,
          // user and items are not included
        },
        timestamp: Date.now(),
      };

      const config: HydrationConfig<TestState> = {
        name: 'test-store',
        version: 1,
        partialize: (state) => ({
          count: state.count,
          user: state.user,
          // Exclude items
        }),
      };

      const useStore = create<TestState>()(
        hydrationMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            items: ['default-item'],
            increment: () => set((state) => ({ count: state.count + 1 })),
            setUser: (user) => set({ user }),
            addItem: (item) => set((state) => ({ items: [...state.items, item] })),
            reset: () => set({ count: 0, user: null, items: [] }),
          })
        )
      );

      (useStore as any).hydrate(serializedState);

      const state = useStore.getState();
      expect(state.count).toBe(5);
      expect(state.user).toBeNull(); // Default value
      expect(state.items).toEqual(['default-item']); // Not hydrated, keeps default
    });

    it('should handle version migrations during hydration', () => {
      const oldSerializedState: SerializedState = {
        version: 1,
        data: {
          counter: 42, // Old field name
          username: 'OldUser', // Old field structure
        },
        timestamp: Date.now(),
      };

      const config: HydrationConfig<TestState> = {
        name: 'test-store',
        version: 2,
        migrations: {
          1: (state: any) => ({
            count: state.counter, // Rename field
            user: state.username ? { id: 'legacy', name: state.username } : null, // Transform structure
            items: [],
          }),
        },
      };

      const useStore = create<TestState>()(
        hydrationMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            items: [],
            increment: () => {},
            setUser: () => {},
            addItem: () => {},
            reset: () => {},
          })
        )
      );

      (useStore as any).hydrate(oldSerializedState);

      const state = useStore.getState();
      expect(state.count).toBe(42);
      expect(state.user).toEqual({ id: 'legacy', name: 'OldUser' });
    });

    it('should validate hydrated state', () => {
      const invalidSerializedState: SerializedState = {
        version: 1,
        data: {
          count: 'not-a-number', // Invalid type
          user: { id: 123, name: true }, // Invalid types
          items: 'not-an-array', // Invalid type
        },
        timestamp: Date.now(),
      };

      const config: HydrationConfig<TestState> = {
        name: 'test-store',
        version: 1,
        validate: (state) => {
          if (typeof state.count !== 'number') {
            throw new Error('Count must be a number');
          }
          if (!Array.isArray(state.items)) {
            throw new Error('Items must be an array');
          }
          return true;
        },
      };

      const useStore = create<TestState>()(
        hydrationMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            items: [],
            increment: () => {},
            setUser: () => {},
            addItem: () => {},
            reset: () => {},
          })
        )
      );

      expect(() => (useStore as any).hydrate(invalidSerializedState)).toThrow();
      
      // State should remain at defaults after failed hydration
      expect(useStore.getState().count).toBe(0);
    });

    it('should handle hydration errors gracefully', () => {
      const corruptedState: SerializedState = {
        version: 1,
        data: 'corrupted-data' as any,
        timestamp: Date.now(),
      };

      const onError = vi.fn();

      const config: HydrationConfig<TestState> = {
        name: 'test-store',
        version: 1,
        onHydrationError: onError,
      };

      const useStore = create<TestState>()(
        hydrationMiddleware(
          config,
          (set) => ({
            count: 0,
            user: null,
            items: [],
            increment: () => {},
            setUser: () => {},
            addItem: () => {},
            reset: () => {},
          })
        )
      );

      (useStore as any).hydrate(corruptedState);

      expect(onError).toHaveBeenCalled();
      expect(useStore.getState().count).toBe(0); // Default value maintained
    });
  });

  describe('Hydration Context', () => {
    interface StoreState {
      count: number;
      increment: () => void;
    }

    it('should provide hydration state through context', () => {
      const TestComponent = () => {
        const { isHydrated, hydrationError } = useHydration();
        
        return (
          <div>
            <div data-testid="hydrated">{isHydrated ? 'Yes' : 'No'}</div>
            <div data-testid="error">{hydrationError?.message || 'None'}</div>
          </div>
        );
      };

      render(
        <HydrationProvider>
          <TestComponent />
        </HydrationProvider>
      );

      expect(screen.getByTestId('hydrated').textContent).toBe('No');
      expect(screen.getByTestId('error').textContent).toBe('None');
    });

    it('should track hydration progress', async () => {
      const TestComponent = () => {
        const { hydrate, isHydrated } = useHydration();
        
        React.useEffect(() => {
          hydrate({
            version: 1,
            data: { test: 'data' },
            timestamp: Date.now(),
          });
        }, [hydrate]);
        
        return <div data-testid="status">{isHydrated ? 'Hydrated' : 'Loading'}</div>;
      };

      const { rerender } = render(
        <HydrationProvider>
          <TestComponent />
        </HydrationProvider>
      );

      expect(screen.getByTestId('status').textContent).toBe('Loading');

      // Wait for hydration
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      rerender(
        <HydrationProvider>
          <TestComponent />
        </HydrationProvider>
      );

      expect(screen.getByTestId('status').textContent).toBe('Hydrated');
    });

    it('should handle hydration errors in context', async () => {
      const TestComponent = () => {
        const { hydrate, hydrationError } = useHydration();
        
        React.useEffect(() => {
          hydrate({
            version: 1,
            data: null as any, // Invalid data
            timestamp: Date.now(),
          });
        }, [hydrate]);
        
        return (
          <div data-testid="error">
            {hydrationError ? hydrationError.message : 'No error'}
          </div>
        );
      };

      render(
        <HydrationProvider>
          <TestComponent />
        </HydrationProvider>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(screen.getByTestId('error').textContent).not.toBe('No error');
    });
  });

  describe('Dependency Management', () => {
    it('should extract dependencies from state', () => {
      const state = {
        user: { id: '123', name: 'Test' },
        posts: [
          { id: '1', authorId: '123', title: 'Post 1' },
          { id: '2', authorId: '123', title: 'Post 2' },
        ],
        comments: [
          { id: 'c1', postId: '1', text: 'Comment' },
        ],
      };

      const dependencies = extractDependencies(state, {
        posts: ['user.id', 'authorId'],
        comments: ['posts[].id', 'postId'],
      });

      expect(dependencies).toEqual({
        posts: { 'user.id': 'authorId' },
        comments: { 'posts[].id': 'postId' },
      });
    });

    it('should resolve dependency order', () => {
      const dependencies: HydrationDependency[] = [
        { store: 'comments', dependsOn: ['posts', 'users'] },
        { store: 'posts', dependsOn: ['users'] },
        { store: 'users', dependsOn: [] },
        { store: 'tags', dependsOn: ['posts'] },
      ];

      const order = resolveDependencyOrder(dependencies);

      expect(order).toEqual(['users', 'posts', 'tags', 'comments']);
    });

    it('should detect circular dependencies', () => {
      const dependencies: HydrationDependency[] = [
        { store: 'a', dependsOn: ['b'] },
        { store: 'b', dependsOn: ['c'] },
        { store: 'c', dependsOn: ['a'] }, // Circular
      ];

      expect(() => resolveDependencyOrder(dependencies)).toThrow('Circular dependency');
    });

    it('should validate dependencies exist', () => {
      const state = {
        users: { '123': { name: 'Test' } },
        posts: [{ id: '1', authorId: '456' }], // Non-existent user
      };

      const validation = validateDependencies(state, {
        posts: { users: (post: any) => state.users[post.authorId] },
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing dependency: users for posts item 0');
    });
  });

  describe('SSR Hydration', () => {
    it('should serialize state for SSR', () => {
      const state = {
        count: 42,
        user: { id: '123', name: 'SSR User' },
        items: ['ssr-item-1', 'ssr-item-2'],
      };

      const serializer = new StateSerializer();
      const serialized = serializer.serialize(state, { ssr: true });

      // Should be safe for embedding in HTML
      expect(serialized).not.toContain('</script>');
      expect(serialized).not.toContain('<script');
    });

    it('should hydrate from SSR data', () => {
      // Simulate SSR environment
      const ssrData = {
        version: 1,
        data: {
          count: 100,
          serverRendered: true,
        },
        timestamp: Date.now(),
      };

      (global as any).__HYDRATION_DATA__ = {
        'ssr-store': ssrData,
      };

      const config: HydrationConfig<any> = {
        name: 'ssr-store',
        version: 1,
        ssr: true,
      };

      const useStore = create()(
        hydrationMiddleware(
          config,
          (set) => ({
            count: 0,
            serverRendered: false,
            increment: () => set((state: any) => ({ count: state.count + 1 })),
          })
        )
      );

      // Should automatically hydrate from global data
      expect(useStore.getState().count).toBe(100);
      expect(useStore.getState().serverRendered).toBe(true);

      delete (global as any).__HYDRATION_DATA__;
    });

    it('should handle hydration mismatch warnings', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const clientState = {
        count: 0,
        text: 'client',
      };

      const serverState = {
        count: 0,
        text: 'server', // Mismatch
      };

      const config: HydrationConfig<any> = {
        name: 'mismatch-store',
        version: 1,
        checkHydrationMismatch: true,
      };

      const useStore = create()(
        hydrationMiddleware(
          config,
          () => clientState
        )
      );

      (useStore as any).hydrate({
        version: 1,
        data: serverState,
        timestamp: Date.now(),
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hydration mismatch')
      );

      warnSpy.mockRestore();
    });
  });

  describe('Selective Hydration', () => {
    it('should support field-level hydration control', () => {
      const serializedState: SerializedState = {
        version: 1,
        data: {
          persistent: 'keep-this',
          temporary: 'ignore-this',
          nested: {
            keep: true,
            skip: false,
          },
        },
        timestamp: Date.now(),
      };

      const config: HydrationConfig<any> = {
        name: 'selective-store',
        version: 1,
        include: ['persistent', 'nested.keep'],
        exclude: ['temporary', 'nested.skip'],
      };

      const useStore = create()(
        hydrationMiddleware(
          config,
          () => ({
            persistent: 'default',
            temporary: 'default',
            nested: {
              keep: false,
              skip: true,
            },
          })
        )
      );

      (useStore as any).hydrate(serializedState);

      const state = useStore.getState();
      expect(state.persistent).toBe('keep-this');
      expect(state.temporary).toBe('default'); // Excluded
      expect(state.nested.keep).toBe(true);
      expect(state.nested.skip).toBe(true); // Excluded, keeps default
    });

    it('should support dynamic hydration rules', () => {
      const serializedState: SerializedState = {
        version: 1,
        data: {
          mode: 'production',
          debugInfo: { logs: ['log1', 'log2'] },
          settings: { theme: 'dark' },
        },
        timestamp: Date.now(),
      };

      const config: HydrationConfig<any> = {
        name: 'dynamic-store',
        version: 1,
        shouldHydrate: (field, value, state) => {
          // Don't hydrate debug info in production
          if (field === 'debugInfo' && state.mode === 'production') {
            return false;
          }
          return true;
        },
      };

      const useStore = create()(
        hydrationMiddleware(
          config,
          () => ({
            mode: 'development',
            debugInfo: null,
            settings: { theme: 'light' },
          })
        )
      );

      (useStore as any).hydrate(serializedState);

      const state = useStore.getState();
      expect(state.mode).toBe('production');
      expect(state.debugInfo).toBeNull(); // Not hydrated
      expect(state.settings.theme).toBe('dark');
    });
  });
});