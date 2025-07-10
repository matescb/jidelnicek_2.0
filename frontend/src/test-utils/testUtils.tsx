import React, { ReactElement } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

// Initialize i18n for tests
i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        common: {
          view: 'View',
          edit: 'Edit',
          delete: 'Delete',
          duplicate: 'Duplicate',
          archive: 'Archive',
          unarchive: 'Unarchive',
          actions: 'Actions',
          loading: 'Loading...',
          error: 'Error',
          noData: 'No data available',
          search: 'Search',
          filter: 'Filter',
          export: 'Export',
          import: 'Import',
          selected: '{{count}} selected',
          clearFilters: 'Clear filters',
          previous: 'Previous',
          next: 'Next',
          pageInfo: 'Page {{current}} of {{total}}',
          viewDetails: 'View details',
          list: 'List',
          calendar: 'Calendar',
          minutes: 'minutes',
          unknown: 'Unknown'
        },
        recipes: {
          title: 'Recipes',
          name: 'Recipe Name',
          prepTime: 'Prep Time',
          servings: 'Servings',
          rating: 'Rating',
          calories: 'Calories',
          addRecipe: 'Add Recipe',
          noRecipes: 'No recipes found',
          noRecipesFound: 'No recipes match your filters',
          showing: 'Showing {{count}} of {{total}} recipes',
          duplicated: 'Recipe duplicated',
          duplicatedDescription: 'Recipe "{{name}}" has been duplicated',
          deleted: 'Recipe deleted',
          deletedDescription: 'Recipe "{{name}}" has been deleted',
          deleteConfirm: 'Are you sure you want to delete "{{name}}"?',
          batchDeleteConfirm: 'Are you sure you want to delete {{count}} recipes?',
          exported: 'Recipes exported',
          exportedDescription: '{{count}} recipes exported successfully',
          batchDeleted: 'Recipes deleted',
          batchDeletedDescription: '{{count}} recipes deleted successfully',
          addToTrip: 'Add to Trip',
          addedToFavorites: 'Added to favorites',
          removedFromFavorites: 'Removed from favorites'
        },
        trips: {
          title: 'Trips',
          subtitle: 'Manage your trips ({{count}} total)',
          create: 'Create Trip',
          empty: 'No trips found',
          participants: 'participants',
          status: {
            planning: 'Planning',
            active: 'Active',
            completed: 'Completed'
          },
          fields: {
            name: 'Trip Name',
            dates: 'Dates',
            participants: 'Participants',
            status: 'Status',
            mealProgress: 'Meal Progress',
            budget: 'Budget',
            owner: 'Owner'
          }
        },
        errors: {
          generic: 'Something went wrong'
        }
      }
    }
  }
});

interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  return (
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </BrowserRouter>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => rtlRender(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock data generators
export const createMockRecipe = (overrides = {}) => ({
  id: 'recipe-1',
  name: 'Test Recipe',
  prepTime: 30,
  servings: 4,
  ratingAverage: 4.5,
  ratingCount: 10,
  imageUrl: 'https://example.com/image.jpg',
  categories: ['Main Course'],
  tags: ['Easy', 'Quick'],
  calories: 350,
  createdAt: new Date().toISOString(),
  ...overrides
});

export const createMockTrip = (overrides = {}) => ({
  id: 'trip-1',
  name: 'Test Trip',
  location: 'Test Location',
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  status: 'planning' as const,
  participantCount: 5,
  participants: [],
  days: [],
  mealSlotConfiguration: [
    { id: '1', name: 'Breakfast', order: 1, isActive: true },
    { id: '2', name: 'Lunch', order: 2, isActive: true },
    { id: '3', name: 'Dinner', order: 3, isActive: true }
  ],
  userId: 'user-1',
  isArchived: false,
  ...overrides
});

export const createMockIngredient = (overrides = {}) => ({
  id: 'ingredient-1',
  name: 'Test Ingredient',
  category: 'Vegetables',
  defaultUnit: 'kg',
  nutrition: {
    calories: 100,
    protein: 5,
    carbs: 20,
    fat: 2
  },
  usageCount: 10,
  price: 2.50,
  priceUnit: 'per kg',
  allergens: ['Gluten'],
  dietaryTags: ['Vegetarian'],
  ...overrides
});

export const createMockUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'user' as const,
  status: 'active' as const,
  emailVerified: true,
  lastLogin: new Date().toISOString(),
  tripsCreated: 5,
  recipesAdded: 10,
  invitationToken: null,
  ...overrides
});

// Common test utilities
export const waitForLoadingToFinish = () => 
  new Promise(resolve => setTimeout(resolve, 0));

export const mockConsoleError = () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });
  return console.error as jest.Mock;
};