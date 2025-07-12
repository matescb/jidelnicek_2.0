import { create } from 'zustand';
import { optimisticMiddleware, OptimisticActions } from './index';

// Example: Recipe store with optimistic updates
interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  rating: number;
  favorited: boolean;
  version: number;
}

interface RecipeState {
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
}

interface RecipeActions {
  setRecipes: (recipes: Recipe[]) => void;
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  toggleFavorite: (id: string) => void;
  rateRecipe: (id: string, rating: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type RecipeStore = RecipeState & RecipeActions & OptimisticActions<RecipeState & RecipeActions>;

// Create store with optimistic middleware
export const useRecipeStore = create<RecipeStore>()(
  optimisticMiddleware<RecipeState & RecipeActions>({
    maxRetries: 3,
    conflictStrategy: 'lastWrite',
    enableSnapshots: true,
    maxSnapshots: 30,
    dedupStrategy: 'replace',
  })(
    (set) => ({
      // State
      recipes: [],
      loading: false,
      error: null,

      // Actions
      setRecipes: (recipes) => set({ recipes }),
      
      addRecipe: (recipe) => set((state) => ({
        recipes: [...state.recipes, recipe],
      })),
      
      updateRecipe: (id, updates) => set((state) => ({
        recipes: state.recipes.map((recipe) =>
          recipe.id === id 
            ? { ...recipe, ...updates, version: recipe.version + 1 } 
            : recipe
        ),
      })),
      
      deleteRecipe: (id) => set((state) => ({
        recipes: state.recipes.filter((recipe) => recipe.id !== id),
      })),
      
      toggleFavorite: (id) => set((state) => ({
        recipes: state.recipes.map((recipe) =>
          recipe.id === id 
            ? { ...recipe, favorited: !recipe.favorited } 
            : recipe
        ),
      })),
      
      rateRecipe: (id, rating) => set((state) => ({
        recipes: state.recipes.map((recipe) =>
          recipe.id === id ? { ...recipe, rating } : recipe
        ),
      })),
      
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
    })
  )
);

// Example: Using optimistic updates in components
import { useOptimisticMutation, usePendingUpdates } from './hooks';

export function useRecipeMutations() {
  const store = useRecipeStore;
  
  // Create recipe mutation
  const createRecipe = useOptimisticMutation(
    store,
    'createRecipe',
    async (recipe: Omit<Recipe, 'id' | 'version'>) => {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipe),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create recipe');
      }
      
      return response.json();
    },
    {
      optimisticData: (recipe) => ({
        ...recipe,
        id: `temp_${Date.now()}`,
        version: 1,
      }),
      onSuccess: (data) => {
        // Update with real ID from server
        useRecipeStore.getState().updateRecipe(data.tempId, { id: data.id });
      },
    }
  );

  // Update recipe mutation
  const updateRecipe = useOptimisticMutation(
    store,
    'updateRecipe',
    async ({ id, updates }: { id: string; updates: Partial<Recipe> }) => {
      const recipe = useRecipeStore.getState().recipes.find(r => r.id === id);
      if (!recipe) throw new Error('Recipe not found');

      const response = await fetch(`/api/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          expectedVersion: recipe.version,
        }),
      });
      
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Version conflict - recipe was updated by another user');
        }
        throw new Error('Failed to update recipe');
      }
      
      return response.json();
    },
    {
      rollbackOnError: true,
    }
  );

  // Toggle favorite mutation
  const toggleFavorite = useOptimisticMutation(
    store,
    'toggleFavorite',
    async (id: string) => {
      const response = await fetch(`/api/recipes/${id}/favorite`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle favorite');
      }
      
      return response.json();
    },
    {
      optimisticData: (id) => ({ id }),
    }
  );

  return {
    createRecipe,
    updateRecipe,
    toggleFavorite,
  };
}

// Example: Monitoring pending updates
export function RecipePendingUpdates() {
  const { updates, stats, rollbackAll, getFailedUpdates } = usePendingUpdates(useRecipeStore);
  
  if (stats.pending === 0 && stats.failed === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4">
      {stats.pending > 0 && (
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent" />
          <span>{stats.pending} updates pending...</span>
        </div>
      )}
      
      {stats.failed > 0 && (
        <div className="mt-2">
          <p className="text-red-600">{stats.failed} updates failed</p>
          <button
            onClick={rollbackAll}
            className="mt-1 text-sm text-blue-600 hover:underline"
          >
            Rollback all changes
          </button>
        </div>
      )}
    </div>
  );
}

// Example: Component using optimistic updates
export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { toggleFavorite, updateRecipe } = useRecipeMutations();
  const updateRecipeAction = useRecipeStore((state) => state.updateRecipe);
  
  const handleFavorite = async () => {
    // Optimistically update UI
    updateRecipeAction(recipe.id, { favorited: !recipe.favorited });
    
    // Perform async operation with automatic rollback on failure
    await toggleFavorite.mutate(recipe.id);
  };

  const handleRatingChange = async (rating: number) => {
    await updateRecipe.mutate({
      id: recipe.id,
      updates: { rating },
    });
  };

  return (
    <div className="recipe-card">
      <h3>{recipe.title}</h3>
      <p>{recipe.description}</p>
      
      <button
        onClick={handleFavorite}
        disabled={toggleFavorite.isLoading}
        className={recipe.favorited ? 'text-red-500' : 'text-gray-500'}
      >
        {recipe.favorited ? '❤️' : '🤍'}
      </button>
      
      <div className="rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRatingChange(star)}
            disabled={updateRecipe.isLoading}
            className={star <= recipe.rating ? 'text-yellow-500' : 'text-gray-300'}
          >
            ⭐
          </button>
        ))}
      </div>
      
      {(toggleFavorite.error || updateRecipe.error) && (
        <p className="text-red-500 text-sm mt-2">
          Failed to update. Changes will be rolled back.
        </p>
      )}
    </div>
  );
}