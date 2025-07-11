import React, { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  RouteErrorBoundary,
  AsyncErrorBoundary,
  FormErrorBoundary,
  DataErrorBoundary,
  ImageErrorBoundary,
  ErrorBoundaryImage,
  lazyWithErrorBoundary,
  withRouteErrorBoundary,
  withFormErrorBoundary,
  withDataErrorBoundary,
  useFormErrorHandler,
  useDataErrorHandler
} from './index';

// Example 1: Route-level error boundary usage
export const AppRoutes = () => {
  return (
    <Routes>
      <Route 
        path="/recipes/*" 
        element={
          <RouteErrorBoundary
            routeName="Recipes"
            suggestedRoutes={[
              { path: '/recipes/search', label: 'Search Recipes' },
              { path: '/recipes/create', label: 'Create Recipe' },
              { path: '/meal-plans', label: 'Meal Plans' }
            ]}
          >
            <RecipesModule />
          </RouteErrorBoundary>
        }
      />
    </Routes>
  );
};

// Example 2: Async component with lazy loading
const LazyDashboard = lazyWithErrorBoundary(
  () => import('@/pages/Dashboard'),
  {
    maxRetries: 3,
    retryDelay: 1000,
    onLoadError: (error) => {
      console.error('Failed to load dashboard:', error);
    }
  }
);

// Or using wrapper component
const AsyncDashboard = () => {
  const Dashboard = lazy(() => import('@/pages/Dashboard'));
  
  return (
    <AsyncErrorBoundary
      loadingFallback={<DashboardSkeleton />}
      maxRetries={5}
    >
      <Dashboard />
    </AsyncErrorBoundary>
  );
};

// Example 3: Form with error handling
const RecipeForm = () => {
  const { handleError, formData, validationErrors } = useFormErrorHandler('recipe-form');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await api.createRecipe(formData);
      // Handle success
    } catch (error) {
      handleError(error as Error);
    }
  };

  return (
    <FormErrorBoundary
      formId="recipe-form"
      preserveFormData={true}
      showValidationInline={true}
      onFormError={(error, data) => {
        // Optionally save to local storage
        localStorage.setItem('recipe-draft', JSON.stringify(data));
      }}
    >
      <form id="recipe-form" onSubmit={handleSubmit}>
        {/* Form fields */}
      </form>
    </FormErrorBoundary>
  );
};

// Example 4: Data fetching with caching
const RecipeList = () => {
  const { saveToCacheData, loadFromCache } = useDataErrorHandler('recipes-list');
  const [recipes, setRecipes] = useState([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const data = await api.getRecipes();
        setRecipes(data);
        saveToCacheData(data); // Save to cache
      } catch (error) {
        const cached = loadFromCache();
        if (cached) {
          setRecipes(cached);
        }
        throw error; // Re-throw for error boundary
      }
    };

    fetchRecipes();
  }, []);

  return (
    <DataErrorBoundary
      cacheKey="recipes-list"
      autoRetry={true}
      retryInterval={5000}
      maxRetries={3}
      onRetry={async () => {
        const data = await api.getRecipes();
        setRecipes(data);
        saveToCacheData(data);
      }}
    >
      <div>
        {recipes.map(recipe => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </DataErrorBoundary>
  );
};

// Example 5: Image gallery with error handling
const RecipeGallery = ({ images }: { images: string[] }) => {
  return (
    <ImageErrorBoundary
      fallbackSrc="/images/recipe-placeholder.jpg"
      maxRetries={2}
    >
      <div className="grid grid-cols-3 gap-4">
        {images.map((src, index) => (
          <ErrorBoundaryImage
            key={src}
            src={src}
            alt={`Recipe image ${index + 1}`}
            className="w-full h-48 object-cover rounded-lg"
            fallbackSrc="/images/recipe-placeholder.jpg"
            maxRetries={3}
            retryDelay={1000}
          />
        ))}
      </div>
    </ImageErrorBoundary>
  );
};

// Example 6: Using HOCs
const EnhancedRecipePage = withRouteErrorBoundary(
  withDataErrorBoundary(RecipePage, {
    cacheKey: 'current-recipe',
    autoRetry: true
  }),
  {
    routeName: 'Recipe Details',
    suggestedRoutes: [
      { path: '/recipes', label: 'All Recipes' },
      { path: '/recipes/search', label: 'Search Recipes' }
    ]
  }
);

// Example 7: Nested error boundaries
const ComplexPage = () => {
  return (
    <RouteErrorBoundary routeName="Complex Feature">
      <div className="container">
        <AsyncErrorBoundary>
          <LazyHeader />
        </AsyncErrorBoundary>

        <div className="content">
          <DataErrorBoundary cacheKey="main-content">
            <MainContent />
          </DataErrorBoundary>

          <aside>
            <FormErrorBoundary formId="sidebar-form">
              <SidebarForm />
            </FormErrorBoundary>
          </aside>
        </div>

        <ImageErrorBoundary>
          <ImageGallery />
        </ImageErrorBoundary>
      </div>
    </RouteErrorBoundary>
  );
};

// Example 8: Custom error recovery
const RecipeEditor = () => {
  const [recipe, setRecipe] = useState(null);

  return (
    <DataErrorBoundary
      fallbackData={recipe} // Use current state as fallback
      onRetry={async () => {
        // Custom retry logic
        try {
          const data = await api.getRecipe(recipeId);
          setRecipe(data);
        } catch (error) {
          // Try alternative API
          const data = await api.getRecipeFromCache(recipeId);
          setRecipe(data);
        }
      }}
    >
      <RecipeEditorContent recipe={recipe} />
    </DataErrorBoundary>
  );
};

// Placeholder components for examples
const RecipesModule = () => <div>Recipes Module</div>;
const DashboardSkeleton = () => <div>Loading...</div>;
const RecipeCard = ({ recipe }: any) => <div>{recipe.name}</div>;
const RecipePage = () => <div>Recipe Page</div>;
const LazyHeader = () => <header>Header</header>;
const MainContent = () => <main>Main Content</main>;
const SidebarForm = () => <form>Sidebar Form</form>;
const ImageGallery = () => <div>Image Gallery</div>;
const RecipeEditorContent = ({ recipe }: any) => <div>Recipe Editor</div>;

// Mock API for examples
const api = {
  createRecipe: async (data: any) => Promise.resolve({ id: 1, ...data }),
  getRecipes: async () => Promise.resolve([{ id: 1, name: 'Recipe 1' }]),
  getRecipe: async (id: string) => Promise.resolve({ id, name: 'Recipe' }),
  getRecipeFromCache: async (id: string) => Promise.resolve({ id, name: 'Cached Recipe' })
};