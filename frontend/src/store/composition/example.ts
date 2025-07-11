/**
 * Store Composition Examples
 * Demonstrates how to use the store composition system
 */

import {
  composeStore,
  createCrudSlice,
  createAsyncSlice,
  createFormSlice,
  createModalSlice,
  createSelector,
  combineSelectors,
  loggerMiddleware,
  performanceMiddleware,
  conditionalMiddleware,
  type ComposedStore,
} from './index';

// Example types
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  authorId: string;
}

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Create slices
const userSlice = createCrudSlice<User>({
  name: 'users',
  idField: 'id',
  sortField: 'name',
});

const currentUserSlice = createAsyncSlice<User | null>({
  name: 'currentUser',
  initialData: null,
  fetchFn: async () => {
    // Simulate API call
    const response = await fetch('/api/auth/me');
    return response.json();
  },
  updateFn: async (user) => {
    const response = await fetch('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(user),
    });
    return response.json();
  },
});

const recipesSlice = createCrudSlice<Recipe>({
  name: 'recipes',
  idField: 'id',
  sortField: 'title',
});

const loginFormSlice = createFormSlice<LoginForm>({
  name: 'loginForm',
  initialValues: {
    email: '',
    password: '',
    rememberMe: false,
  },
  onSubmit: async (values) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (!response.ok) throw new Error('Login failed');
  },
});

const modalsSlice = createModalSlice({
  name: 'modals',
  modals: {
    userEdit: {},
    recipeCreate: {},
    confirmDelete: { data: null },
  },
});

// Compose the store
export const useAppStore = composeStore({
  slices: {
    users: userSlice,
    currentUser: currentUserSlice,
    recipes: recipesSlice,
    loginForm: loginFormSlice,
    modals: modalsSlice,
  },
  
  // Add computed values
  computed: {
    isAuthenticated: (state) => state.currentUser.data !== null,
    currentUserRecipes: (state) => {
      const userId = state.currentUser.data?.id;
      if (!userId) return [];
      return state.recipes.items.filter(recipe => recipe.authorId === userId);
    },
    totalRecipes: (state) => state.recipes.count,
  },
  
  // Configure middleware
  middleware: [
    conditionalMiddleware(
      () => process.env.NODE_ENV === 'development',
      loggerMiddleware({ collapsed: true })
    ),
    performanceMiddleware({ warnThreshold: 10 }),
  ],
  
  // DevTools configuration
  devtools: {
    name: 'Recipe App Store',
    enabled: process.env.NODE_ENV === 'development',
  },
});

// Create selectors
export const selectCurrentUser = createSelector(
  (state: ReturnType<typeof useAppStore.getState>) => state.currentUser.data
);

export const selectUserById = (userId: string) =>
  createSelector(
    (state: ReturnType<typeof useAppStore.getState>) =>
      state.users.items.find(user => user.id === userId)
  );

export const selectRecipesByAuthor = (authorId: string) =>
  createSelector(
    (state: ReturnType<typeof useAppStore.getState>) =>
      state.recipes.items.filter(recipe => recipe.authorId === authorId)
  );

export const selectUserWithRecipes = combineSelectors(
  selectCurrentUser,
  (state: ReturnType<typeof useAppStore.getState>) => state.recipes.items,
  (user, recipes) => {
    if (!user) return null;
    return {
      ...user,
      recipes: recipes.filter(r => r.authorId === user.id),
      recipeCount: recipes.filter(r => r.authorId === user.id).length,
    };
  }
);

// Usage examples
export function ExampleUsage() {
  const store = useAppStore();
  
  // Access slice states
  const users = store.users;
  const currentUser = store.currentUser;
  const recipes = store.recipes;
  const loginForm = store.loginForm;
  const modals = store.modals;
  
  // Use CRUD operations
  users.add({ id: '1', name: 'John', email: 'john@example.com', role: 'user' });
  users.update('1', { name: 'John Doe' });
  users.select('1');
  console.log(users.selectedItem); // User object
  
  // Use async operations
  currentUser.fetch();
  currentUser.update({ ...currentUser.data!, name: 'Updated Name' });
  
  // Use form operations
  loginForm.setFieldValue('email', 'user@example.com');
  loginForm.setFieldValue('password', 'password123');
  loginForm.submit();
  
  // Use modal operations
  modals.open('userEdit', { userId: '1' });
  console.log(modals.isOpen('userEdit')); // true
  console.log(modals.getData('userEdit')); // { userId: '1' }
  modals.close('userEdit');
  
  // Access computed values
  console.log(store._computed?.isAuthenticated);
  console.log(store._computed?.currentUserRecipes);
  console.log(store._computed?.totalRecipes);
}

// Advanced example: Cross-slice communication
export const useRecipeActions = () => {
  const store = useAppStore();
  
  return {
    createRecipe: async (recipe: Omit<Recipe, 'id' | 'authorId'>) => {
      const currentUser = store.currentUser.data;
      if (!currentUser) throw new Error('Must be logged in');
      
      const newRecipe: Recipe = {
        ...recipe,
        id: Date.now().toString(),
        authorId: currentUser.id,
      };
      
      store.recipes.add(newRecipe);
      store.modals.close('recipeCreate');
    },
    
    deleteRecipe: async (recipeId: string) => {
      const recipe = store.recipes.items.find(r => r.id === recipeId);
      if (!recipe) return;
      
      const currentUser = store.currentUser.data;
      if (currentUser?.id !== recipe.authorId && currentUser?.role !== 'admin') {
        throw new Error('Not authorized');
      }
      
      store.recipes.remove(recipeId);
      store.modals.close('confirmDelete');
    },
  };
};

// React hook example
export function useUserRecipes(userId: string) {
  const recipes = useAppStore(selectRecipesByAuthor(userId));
  const loading = useAppStore(state => state.recipes.loading);
  
  return { recipes, loading };
}

// Type inference example
type AppStore = ReturnType<typeof useAppStore.getState>;
type UsersSlice = AppStore['users'];
type CurrentUserSlice = AppStore['currentUser'];