import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { create } from 'zustand';
import { StoreComposer } from '../composition/storeComposer';
import { createSliceFactory } from '../composition/sliceFactory';
import { createSelector, createSelectorWithCache, createComputedSelector } from '../composition/selectors';
import { composeMiddleware, createMiddlewareEnhancer } from '../composition/middleware';
import type { Slice, SliceConfig, StoreApi } from '../composition/types';

describe('Store Composition', () => {
  describe('StoreComposer', () => {
    it('should compose multiple slices into a single store', () => {
      const userSlice: Slice<'user'> = {
        name: 'user',
        getInitialState: () => ({
          id: null,
          name: '',
          email: '',
        }),
        actions: (set, get) => ({
          setUser: (user: any) => set((state) => ({
            user: { ...state.user, ...user },
          })),
          clearUser: () => set((state) => ({
            user: { id: null, name: '', email: '' },
          })),
        }),
      };

      const settingsSlice: Slice<'settings'> = {
        name: 'settings',
        getInitialState: () => ({
          theme: 'light',
          notifications: true,
        }),
        actions: (set, get) => ({
          setTheme: (theme: string) => set((state) => ({
            settings: { ...state.settings, theme },
          })),
          toggleNotifications: () => set((state) => ({
            settings: {
              ...state.settings,
              notifications: !state.settings.notifications,
            },
          })),
        }),
      };

      const composer = new StoreComposer();
      const useStore = composer
        .addSlice(userSlice)
        .addSlice(settingsSlice)
        .create();

      const store = useStore.getState();

      // Check initial state
      expect(store.user).toEqual({ id: null, name: '', email: '' });
      expect(store.settings).toEqual({ theme: 'light', notifications: true });

      // Check actions
      expect(typeof store.setUser).toBe('function');
      expect(typeof store.setTheme).toBe('function');

      // Test actions
      store.setUser({ id: '123', name: 'Test User' });
      expect(useStore.getState().user.name).toBe('Test User');

      store.setTheme('dark');
      expect(useStore.getState().settings.theme).toBe('dark');
    });

    it('should handle slice dependencies', () => {
      const authSlice: Slice<'auth'> = {
        name: 'auth',
        getInitialState: () => ({
          isAuthenticated: false,
          token: null,
        }),
        actions: (set) => ({
          login: (token: string) => set((state) => ({
            auth: { isAuthenticated: true, token },
          })),
          logout: () => set((state) => ({
            auth: { isAuthenticated: false, token: null },
          })),
        }),
      };

      const profileSlice: Slice<'profile'> = {
        name: 'profile',
        dependencies: ['auth'],
        getInitialState: () => ({
          data: null,
          loading: false,
        }),
        actions: (set, get) => ({
          fetchProfile: async () => {
            const state = get();
            if (!state.auth.isAuthenticated) {
              throw new Error('Not authenticated');
            }

            set((state) => ({
              profile: { ...state.profile, loading: true },
            }));

            // Simulate API call
            const data = { id: '123', name: 'User' };
            
            set((state) => ({
              profile: { data, loading: false },
            }));
          },
        }),
      };

      const composer = new StoreComposer();
      const useStore = composer
        .addSlice(authSlice)
        .addSlice(profileSlice)
        .create();

      const store = useStore.getState();

      // Should throw when not authenticated
      expect(store.fetchProfile()).rejects.toThrow('Not authenticated');

      // Login and try again
      store.login('test-token');
      expect(store.fetchProfile()).resolves.not.toThrow();
    });

    it('should apply middleware to composed store', () => {
      const logMiddleware = jest.fn((config: any) => (set: any, get: any, api: any) => 
        config(
          (args: any) => {
            console.log('State update:', args);
            set(args);
          },
          get,
          api
        )
      );

      const slice: Slice<'counter'> = {
        name: 'counter',
        getInitialState: () => ({ value: 0 }),
        actions: (set) => ({
          increment: () => set((state) => ({
            counter: { value: state.counter.value + 1 },
          })),
        }),
      };

      const composer = new StoreComposer();
      const useStore = composer
        .addSlice(slice)
        .addMiddleware(logMiddleware)
        .create();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      useStore.getState().increment();

      expect(consoleSpy).toHaveBeenCalledWith(
        'State update:',
        expect.objectContaining({
          counter: { value: 1 },
        })
      );

      consoleSpy.mockRestore();
    });

    it('should validate slice configuration', () => {
      const invalidSlice = {
        // Missing name
        getInitialState: () => ({}),
        actions: () => ({}),
      } as any;

      const composer = new StoreComposer();

      expect(() => composer.addSlice(invalidSlice)).toThrow();
    });

    it('should handle circular dependencies', () => {
      const sliceA: Slice<'a'> = {
        name: 'a',
        dependencies: ['b'],
        getInitialState: () => ({ value: 1 }),
        actions: () => ({}),
      };

      const sliceB: Slice<'b'> = {
        name: 'b',
        dependencies: ['a'], // Circular dependency
        getInitialState: () => ({ value: 2 }),
        actions: () => ({}),
      };

      const composer = new StoreComposer();

      expect(() => 
        composer
          .addSlice(sliceA)
          .addSlice(sliceB)
          .create()
      ).toThrow('Circular dependency');
    });

    it('should merge slice configurations', () => {
      const baseConfig: SliceConfig<'base'> = {
        persist: true,
        devtools: true,
      };

      const slice: Slice<'test'> = {
        name: 'test',
        config: baseConfig,
        getInitialState: () => ({ value: 0 }),
        actions: () => ({}),
      };

      const composer = new StoreComposer();
      const store = composer
        .addSlice(slice)
        .setConfig({ devtools: false }) // Override
        .create();

      // Config should be merged
      const config = (composer as any).config;
      expect(config.devtools).toBe(false);
      expect(config.persist).toBe(true);
    });
  });

  describe('SliceFactory', () => {
    it('should create slices with factory pattern', () => {
      interface CounterState {
        value: number;
        lastUpdate: number;
      }

      interface CounterActions {
        increment: () => void;
        decrement: () => void;
        reset: () => void;
      }

      const counterFactory = createSliceFactory<CounterState, CounterActions>({
        getInitialState: () => ({
          value: 0,
          lastUpdate: Date.now(),
        }),
        actions: (set) => ({
          increment: () => set((state) => ({
            value: state.value + 1,
            lastUpdate: Date.now(),
          })),
          decrement: () => set((state) => ({
            value: state.value - 1,
            lastUpdate: Date.now(),
          })),
          reset: () => set({
            value: 0,
            lastUpdate: Date.now(),
          }),
        }),
      });

      const counter1 = counterFactory('counter1');
      const counter2 = counterFactory('counter2', {
        getInitialState: () => ({
          value: 10, // Override initial value
          lastUpdate: Date.now(),
        }),
      });

      const composer = new StoreComposer();
      const useStore = composer
        .addSlice(counter1)
        .addSlice(counter2)
        .create();

      const state = useStore.getState();
      
      expect(state.counter1.value).toBe(0);
      expect(state.counter2.value).toBe(10);

      state.increment(); // counter1.increment
      expect(useStore.getState().counter1.value).toBe(1);
      expect(useStore.getState().counter2.value).toBe(10);
    });

    it('should support generic slice factories', () => {
      interface EntityState<T> {
        items: T[];
        loading: boolean;
        error: string | null;
      }

      interface EntityActions<T> {
        add: (item: T) => void;
        remove: (id: string) => void;
        setLoading: (loading: boolean) => void;
        setError: (error: string | null) => void;
      }

      function createEntitySlice<T extends { id: string }>(
        name: string
      ): Slice<typeof name> {
        return {
          name,
          getInitialState: (): EntityState<T> => ({
            items: [],
            loading: false,
            error: null,
          }),
          actions: (set) => ({
            add: (item: T) => set((state) => ({
              [name]: {
                ...state[name],
                items: [...state[name].items, item],
              },
            })),
            remove: (id: string) => set((state) => ({
              [name]: {
                ...state[name],
                items: state[name].items.filter((item: T) => item.id !== id),
              },
            })),
            setLoading: (loading: boolean) => set((state) => ({
              [name]: { ...state[name], loading },
            })),
            setError: (error: string | null) => set((state) => ({
              [name]: { ...state[name], error },
            })),
          }),
        };
      }

      interface User {
        id: string;
        name: string;
      }

      interface Post {
        id: string;
        title: string;
      }

      const usersSlice = createEntitySlice<User>('users');
      const postsSlice = createEntitySlice<Post>('posts');

      const composer = new StoreComposer();
      const useStore = composer
        .addSlice(usersSlice)
        .addSlice(postsSlice)
        .create();

      const store = useStore.getState();

      store.add({ id: '1', name: 'User 1' });
      store.add({ id: '1', title: 'Post 1' });

      expect(useStore.getState().users.items).toHaveLength(1);
      expect(useStore.getState().posts.items).toHaveLength(1);
    });
  });

  describe('Selectors', () => {
    interface TestState {
      users: Array<{ id: string; name: string; age: number }>;
      filter: { minAge: number; maxAge: number };
      sortBy: 'name' | 'age';
    }

    let useStore: StoreApi<TestState>;

    beforeEach(() => {
      useStore = create<TestState>()((set) => ({
        users: [
          { id: '1', name: 'Alice', age: 25 },
          { id: '2', name: 'Bob', age: 30 },
          { id: '3', name: 'Charlie', age: 35 },
        ],
        filter: { minAge: 0, maxAge: 100 },
        sortBy: 'name',
      }));
    });

    it('should create basic selectors', () => {
      const selectUsers = (state: TestState) => state.users;
      const selectFilter = (state: TestState) => state.filter;

      const selector = createSelector(
        [selectUsers, selectFilter],
        (users, filter) => 
          users.filter(u => u.age >= filter.minAge && u.age <= filter.maxAge)
      );

      const result = selector(useStore.getState());
      expect(result).toHaveLength(3);

      useStore.setState({ filter: { minAge: 30, maxAge: 35 } });
      const filtered = selector(useStore.getState());
      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('Bob');
    });

    it('should cache selector results', () => {
      const computeFn = jest.fn((users: any[], filter: any) =>
        users.filter(u => u.age >= filter.minAge && u.age <= filter.maxAge)
      );

      const selector = createSelectorWithCache(
        [(state: TestState) => state.users, (state: TestState) => state.filter],
        computeFn
      );

      const state = useStore.getState();
      
      // First call
      const result1 = selector(state);
      expect(computeFn).toHaveBeenCalledTimes(1);

      // Second call with same inputs - should use cache
      const result2 = selector(state);
      expect(computeFn).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);

      // Change state
      useStore.setState({ filter: { minAge: 30, maxAge: 40 } });
      
      // Third call with different inputs
      selector(useStore.getState());
      expect(computeFn).toHaveBeenCalledTimes(2);
    });

    it('should create computed selectors with dependencies', () => {
      const selectFilteredUsers = createComputedSelector({
        users: (state: TestState) => state.users,
        filter: (state: TestState) => state.filter,
      }, ({ users, filter }) => 
        users.filter(u => u.age >= filter.minAge && u.age <= filter.maxAge)
      );

      const selectSortedFilteredUsers = createComputedSelector({
        filtered: selectFilteredUsers,
        sortBy: (state: TestState) => state.sortBy,
      }, ({ filtered, sortBy }) => {
        const sorted = [...filtered];
        sorted.sort((a, b) => {
          if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
          }
          return a.age - b.age;
        });
        return sorted;
      });

      const result = selectSortedFilteredUsers(useStore.getState());
      expect(result[0].name).toBe('Alice'); // Sorted by name

      useStore.setState({ sortBy: 'age' });
      const resorted = selectSortedFilteredUsers(useStore.getState());
      expect(resorted[0].name).toBe('Alice'); // Still Alice (age 25)
    });

    it('should handle selector composition', () => {
      const selectUserCount = createSelector(
        [(state: TestState) => state.users],
        (users) => users.length
      );

      const selectAverageAge = createSelector(
        [(state: TestState) => state.users],
        (users) => users.reduce((sum, u) => sum + u.age, 0) / users.length
      );

      const selectStats = createSelector(
        [selectUserCount, selectAverageAge],
        (count, avgAge) => ({ count, averageAge: avgAge })
      );

      const stats = selectStats(useStore.getState());
      expect(stats).toEqual({
        count: 3,
        averageAge: 30,
      });
    });

    it('should support parameterized selectors', () => {
      const makeSelectUserById = () => 
        createSelector(
          [(state: TestState) => state.users, (_: TestState, id: string) => id],
          (users, id) => users.find(u => u.id === id)
        );

      const selectUserById = makeSelectUserById();

      const user1 = selectUserById(useStore.getState(), '1');
      expect(user1?.name).toBe('Alice');

      const user2 = selectUserById(useStore.getState(), '2');
      expect(user2?.name).toBe('Bob');
    });
  });

  describe('Middleware Composition', () => {
    it('should compose multiple middleware', () => {
      const middleware1 = jest.fn((config: any) => (set: any, get: any, api: any) => {
        const enhancedSet = (args: any) => {
          console.log('Middleware 1:', args);
          set(args);
        };
        return config(enhancedSet, get, api);
      });

      const middleware2 = jest.fn((config: any) => (set: any, get: any, api: any) => {
        const enhancedSet = (args: any) => {
          console.log('Middleware 2:', args);
          set(args);
        };
        return config(enhancedSet, get, api);
      });

      const composedMiddleware = composeMiddleware(middleware1, middleware2);

      const useStore = create<{ count: number; increment: () => void }>()(
        composedMiddleware((set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }))
      );

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      useStore.getState().increment();

      // Both middleware should be called
      expect(consoleSpy).toHaveBeenCalledWith('Middleware 1:', expect.any(Object));
      expect(consoleSpy).toHaveBeenCalledWith('Middleware 2:', expect.any(Object));

      consoleSpy.mockRestore();
    });

    it('should create middleware enhancers', () => {
      const loggingEnhancer = createMiddlewareEnhancer({
        name: 'logger',
        before: (state, args) => {
          console.log('Before update:', { state, args });
        },
        after: (state, args) => {
          console.log('After update:', { state, args });
        },
      });

      const performanceEnhancer = createMiddlewareEnhancer({
        name: 'performance',
        before: () => {
          console.time('update');
        },
        after: () => {
          console.timeEnd('update');
        },
      });

      const enhancedMiddleware = composeMiddleware(
        loggingEnhancer,
        performanceEnhancer
      );

      const useStore = create<{ value: number; setValue: (v: number) => void }>()(
        enhancedMiddleware((set) => ({
          value: 0,
          setValue: (value) => set({ value }),
        }))
      );

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const timeSpy = jest.spyOn(console, 'time').mockImplementation(() => {});
      const timeEndSpy = jest.spyOn(console, 'timeEnd').mockImplementation(() => {});

      useStore.getState().setValue(42);

      expect(consoleSpy).toHaveBeenCalledWith('Before update:', expect.any(Object));
      expect(consoleSpy).toHaveBeenCalledWith('After update:', expect.any(Object));
      expect(timeSpy).toHaveBeenCalledWith('update');
      expect(timeEndSpy).toHaveBeenCalledWith('update');

      consoleSpy.mockRestore();
      timeSpy.mockRestore();
      timeEndSpy.mockRestore();
    });

    it('should handle middleware errors', () => {
      const errorMiddleware = (config: any) => (set: any, get: any, api: any) => {
        const enhancedSet = (args: any) => {
          if (args.error) {
            throw new Error('Middleware error');
          }
          set(args);
        };
        return config(enhancedSet, get, api);
      };

      const useStore = create<{ value: number; setError: () => void }>()(
        errorMiddleware((set) => ({
          value: 0,
          setError: () => set({ error: true } as any),
        }))
      );

      expect(() => useStore.getState().setError()).toThrow('Middleware error');
    });

    it('should support conditional middleware', () => {
      const isDev = process.env.NODE_ENV === 'development';

      const devOnlyMiddleware = createMiddlewareEnhancer({
        name: 'dev-tools',
        enabled: isDev,
        before: (state) => {
          console.log('Dev mode - State before:', state);
        },
      });

      const useStore = create<{ count: number }>()(
        devOnlyMiddleware(() => ({ count: 0 }))
      );

      // Middleware behavior depends on environment
      expect(useStore.getState().count).toBe(0);
    });
  });

  describe('Advanced Composition Patterns', () => {
    it('should support modular store architecture', () => {
      // Feature modules
      const authModule = {
        slice: {
          name: 'auth' as const,
          getInitialState: () => ({ user: null, token: null }),
          actions: (set: any) => ({
            login: (user: any, token: string) => set(() => ({ auth: { user, token } })),
          }),
        },
        selectors: {
          selectIsAuthenticated: (state: any) => !!state.auth.token,
          selectCurrentUser: (state: any) => state.auth.user,
        },
      };

      const todosModule = {
        slice: {
          name: 'todos' as const,
          getInitialState: () => ({ items: [], filter: 'all' }),
          actions: (set: any) => ({
            addTodo: (text: string) => set((state: any) => ({
              todos: {
                ...state.todos,
                items: [...state.todos.items, { id: Date.now(), text, done: false }],
              },
            })),
          }),
        },
        selectors: {
          selectActiveTodos: (state: any) => 
            state.todos.items.filter((t: any) => !t.done),
        },
      };

      // Compose modules
      const composer = new StoreComposer();
      const useStore = composer
        .addSlice(authModule.slice)
        .addSlice(todosModule.slice)
        .create();

      // Use combined store
      const store = useStore.getState();
      store.login({ id: '1', name: 'User' }, 'token123');
      store.addTodo('Test todo');

      // Use selectors
      const isAuth = authModule.selectors.selectIsAuthenticated(useStore.getState());
      const activeTodos = todosModule.selectors.selectActiveTodos(useStore.getState());

      expect(isAuth).toBe(true);
      expect(activeTodos).toHaveLength(1);
    });

    it('should support plugin system', () => {
      interface Plugin {
        name: string;
        install: (composer: StoreComposer) => void;
      }

      const persistPlugin: Plugin = {
        name: 'persist',
        install: (composer) => {
          composer.addMiddleware((config) => (set, get, api) => {
            // Add persistence logic
            const persistentSet = (args: any) => {
              set(args);
              // Save to localStorage
              localStorage.setItem('store', JSON.stringify(get()));
            };
            return config(persistentSet, get, api);
          });
        },
      };

      const devtoolsPlugin: Plugin = {
        name: 'devtools',
        install: (composer) => {
          composer.setConfig({ devtools: true });
        },
      };

      // Create store with plugins
      const composer = new StoreComposer();
      
      [persistPlugin, devtoolsPlugin].forEach(plugin => {
        plugin.install(composer);
      });

      const slice: Slice<'app'> = {
        name: 'app',
        getInitialState: () => ({ initialized: false }),
        actions: (set) => ({
          initialize: () => set(() => ({ app: { initialized: true } })),
        }),
      };

      const useStore = composer.addSlice(slice).create();

      // Plugins should be applied
      const mockStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
      });

      useStore.getState().initialize();

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'store',
        expect.stringContaining('initialized')
      );
    });
  });
});