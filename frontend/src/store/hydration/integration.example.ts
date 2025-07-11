/**
 * Hydration Integration Example
 * 
 * Shows how to integrate the hydration system with existing Zustand stores
 */

import { create } from 'zustand';
import { hydrationMiddleware, createClassSerializer } from './index';
import type { AuthStore } from '../slices/authStore';
import type { UIStore } from '../slices/uiStore';
import type { RecipeStore } from '../slices/recipeStore';

/**
 * Example 1: Simple store with hydration
 */
interface CounterStore {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useCounterStore = create<CounterStore>()(
  hydrationMiddleware({
    name: 'counter-store',
    merge: 'shallow',
  })(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    })
  )
);

/**
 * Example 2: Auth store with validation and transformation
 */
export const createHydratedAuthStore = () => {
  return create<AuthStore>()(
    hydrationMiddleware({
      name: 'auth-store',
      merge: 'deep',
      
      // Validate the hydrated state shape
      validate: (state): state is Partial<AuthStore> => {
        if (!state || typeof state !== 'object') return false;
        
        // Check critical fields
        if ('user' in state && state.user !== null) {
          return (
            typeof state.user === 'object' &&
            'id' in state.user &&
            'email' in state.user
          );
        }
        
        return true;
      },
      
      // Transform dates and sensitive data
      transform: (state) => {
        const transformed = { ...state };
        
        // Don't hydrate tokens on client for security
        if (typeof window !== 'undefined') {
          delete (transformed as any).token;
          delete (transformed as any).refreshToken;
        }
        
        // Restore date objects
        if (transformed.user && typeof transformed.user.createdAt === 'string') {
          transformed.user = {
            ...transformed.user,
            createdAt: new Date(transformed.user.createdAt),
            updatedAt: new Date(transformed.user.updatedAt || transformed.user.createdAt),
          };
        }
        
        return transformed;
      },
      
      // Callback after successful hydration
      onHydrated: (state) => {
        console.log('[Auth] Hydrated with user:', state.user?.email);
      },
      
      // Error handling
      onError: (error) => {
        console.error('[Auth] Hydration failed:', error);
      },
    })(
      (set, get) => ({
        // ... your auth store implementation
        user: null,
        isAuthenticated: false,
        token: null,
        refreshToken: null,
        
        login: async (credentials) => {
          // Implementation
        },
        
        logout: () => {
          set({
            user: null,
            isAuthenticated: false,
            token: null,
            refreshToken: null,
          });
        },
        
        refreshSession: async () => {
          // Implementation
        },
      } as AuthStore)
    )
  );
};

/**
 * Example 3: UI store with dependencies
 */
export const createHydratedUIStore = () => {
  return create<UIStore>()(
    hydrationMiddleware({
      name: 'ui-store',
      merge: 'shallow',
      
      // This store depends on auth store being hydrated first
      dependencies: ['auth-store'],
      
      // Skip certain UI state from hydration
      transform: (state) => {
        const { 
          // Don't hydrate temporary UI states
          isLoading,
          notifications,
          ...persistentState 
        } = state as any;
        
        return persistentState;
      },
    })(
      (set, get) => ({
        // ... your UI store implementation
        theme: 'light',
        sidebarOpen: true,
        isLoading: false,
        notifications: [],
        
        setTheme: (theme) => set({ theme }),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setLoading: (isLoading) => set({ isLoading }),
        addNotification: (notification) => set((state) => ({
          notifications: [...state.notifications, notification],
        })),
      } as UIStore)
    )
  );
};

/**
 * Example 4: Complex store with custom serialization
 */
class Recipe {
  constructor(
    public id: string,
    public name: string,
    public ingredients: Map<string, number>,
    public createdAt: Date
  ) {}
  
  getTotalIngredients(): number {
    return Array.from(this.ingredients.values()).reduce((a, b) => a + b, 0);
  }
}

// Create custom serializer for Recipe class
const recipeSerializer = createClassSerializer<Recipe>(
  'Recipe',
  (recipe) => ({
    id: recipe.id,
    name: recipe.name,
    ingredients: Array.from(recipe.ingredients.entries()),
    createdAt: recipe.createdAt.toISOString(),
  }),
  (data) => {
    const recipe = new Recipe(
      data.id,
      data.name,
      new Map(data.ingredients),
      new Date(data.createdAt)
    );
    return recipe;
  }
);

interface RecipeStoreWithHydration extends RecipeStore {
  recipes: Map<string, Recipe>;
}

export const createHydratedRecipeStore = () => {
  return create<RecipeStoreWithHydration>()(
    hydrationMiddleware({
      name: 'recipe-store',
      merge: 'deep',
      
      // Configure custom serialization
      serialization: {
        compress: true,
        serializers: new Map([recipeSerializer.serializer]),
        deserializers: new Map([recipeSerializer.deserializer]),
      },
      
      // Validate recipe data
      validate: (state) => {
        if (!state || typeof state !== 'object') return false;
        
        if ('recipes' in state && state.recipes instanceof Map) {
          // Validate each recipe
          for (const [id, recipe] of state.recipes) {
            if (!(recipe instanceof Recipe)) return false;
            if (recipe.id !== id) return false;
          }
        }
        
        return true;
      },
      
      // Handle hydration queue
      dependencies: ['auth-store'],
    })(
      (set, get) => ({
        recipes: new Map(),
        selectedRecipeId: null,
        
        addRecipe: (recipe: Recipe) => {
          set((state) => {
            const newRecipes = new Map(state.recipes);
            newRecipes.set(recipe.id, recipe);
            return { recipes: newRecipes };
          });
        },
        
        removeRecipe: (id: string) => {
          set((state) => {
            const newRecipes = new Map(state.recipes);
            newRecipes.delete(id);
            return { recipes: newRecipes };
          });
        },
        
        selectRecipe: (id: string | null) => {
          set({ selectedRecipeId: id });
        },
      } as RecipeStoreWithHydration)
    )
  );
};

/**
 * Example 5: SSR integration with Next.js
 */
export const ssrExample = `
// pages/_app.tsx
import { AppProps } from 'next/app';
import { HydrationProvider } from '@/store/hydration';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <HydrationProvider 
      serverSnapshot={pageProps.hydrationSnapshot}
      autoHydrate
    >
      <Component {...pageProps} />
    </HydrationProvider>
  );
}

// pages/index.tsx
import { GetServerSideProps } from 'next';
import { createServerSnapshot } from '@/store/hydration';

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Initialize stores on server
  const authStore = createHydratedAuthStore();
  const uiStore = createHydratedUIStore();
  
  // Populate stores with data
  await authStore.getState().refreshSession();
  
  // Create snapshot
  const hydrationSnapshot = createServerSnapshot(['auth-store', 'ui-store']);
  
  return {
    props: {
      hydrationSnapshot,
    },
  };
};
`;

/**
 * Example 6: Client-side hydration with loading states
 */
export const ClientHydrationExample = () => {
  return `
import { HydrationBoundary, useStoreHydrationStatus } from '@/store/hydration';

function App() {
  return (
    <HydrationBoundary
      stores={['auth-store', 'ui-store', 'recipe-store']}
      fallback={<FullPageLoader />}
      errorFallback={HydrationError}
      timeout={10000}
    >
      <MainApp />
    </HydrationBoundary>
  );
}

function HydrationError({ error }: { error: Error }) {
  return (
    <div className="error-container">
      <h2>Failed to load application state</h2>
      <p>{error.message}</p>
      <button onClick={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  );
}

function StoreStatus({ storeName }: { storeName: string }) {
  const { isHydrated, isPending, error } = useStoreHydrationStatus(storeName);
  
  return (
    <div>
      <h3>{storeName}</h3>
      {isHydrated && <span>✅ Hydrated</span>}
      {isPending && <span>⏳ Pending</span>}
      {error && <span>❌ Error: {error.message}</span>}
    </div>
  );
}
`;
};

/**
 * Example 7: Testing hydration
 */
export const testingExample = `
import { renderHook } from '@testing-library/react-hooks';
import { HydrationProvider, resetHydration } from '@/store/hydration';
import { useCounterStore } from './examples';

describe('Store Hydration', () => {
  beforeEach(() => {
    resetHydration();
  });
  
  it('should hydrate store from snapshot', async () => {
    const snapshot = {
      timestamp: Date.now(),
      stores: {
        'counter-store': { count: 42 },
      },
    };
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HydrationProvider serverSnapshot={snapshot}>
        {children}
      </HydrationProvider>
    );
    
    const { result, waitFor } = renderHook(() => useCounterStore(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.count).toBe(42);
    });
  });
});
`;