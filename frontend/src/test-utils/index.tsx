import React, { ReactElement } from 'react'
import { vi } from 'vitest'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/context/ThemeContext'

// Mock the actual i18n module instead of creating a new instance
vi.mock('@/i18n/index', () => ({
  default: {
    t: (key: string, fallback?: string) => {
      // Translation map for tests
      const translations: Record<string, string> = {
        'recipes.basicInfo': 'Basic Information',
        'recipes.name': 'Recipe Name',
        'recipes.description': 'Description',
        'recipes.ingredients': 'Ingredients',
        'recipes.instructions': 'Instructions',
        'recipes.prepTime': 'Prep Time',
        'recipes.cookTime': 'Cook Time',
        'recipes.servings': 'Servings',
        'recipes.difficulty': 'Difficulty',
        'recipes.isPublic': 'Make recipe public',
        'recipes.images': 'Images',
        'recipes.uploadImages': 'Upload Images',
        'recipes.existingImages': 'Existing Images',
        'recipes.addMoreImages': 'Add More Images',
        'recipes.imageRequirements': 'Max 10 images, 5MB each (JPEG, PNG, WebP)',
        'recipes.maxImagesError': 'Maximum 10 images allowed',
        'recipes.primaryImage': 'Primary',
        'recipes.addIngredient': 'Add Ingredient',
        'recipes.addInstruction': 'Add Instruction',
        'recipes.ingredientName': 'Ingredient name',
        'recipes.quantity': 'Quantity',
        'recipes.unit': 'Unit',
        'recipes.ingredient': 'ingredient',
        'recipes.difficultyLevels.easy': 'Easy',
        'recipes.difficultyLevels.medium': 'Medium',
        'recipes.difficultyLevels.hard': 'Hard',
        'recipes.units.g': 'grams',
        'recipes.units.kg': 'kilograms',
        'recipes.units.ml': 'milliliters',
        'recipes.units.l': 'liters',
        'recipes.units.cup': 'cup',
        'recipes.units.tbsp': 'tablespoon',
        'recipes.units.tsp': 'teaspoon',
        'recipes.units.piece': 'piece',
        'recipes.invalidImageType': 'Please upload only JPEG, PNG, or WebP images',
        'recipes.imageTooLarge': 'Images must be less than 5MB',
        'common.cancel': 'Cancel',
        'common.create': 'Create',
        'common.update': 'Update',
        'common.save': 'Save',
        'common.saving': 'Saving...',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.view': 'View',
        'common.remove': 'Remove',
        'common.step': 'Step',
        'common.minutes': 'minutes',
        'common.actions': 'Actions',
        'errors.generic': 'Something went wrong',
      }
      return translations[key] || fallback || key
    },
    language: 'en',
    changeLanguage: vi.fn(),
    use: vi.fn(() => ({ init: vi.fn() })),
    init: vi.fn(),
  },
  changeLanguage: vi.fn(),
  getCurrentLanguage: vi.fn(() => ({ code: 'en', name: 'English' })),
}))

// Mock react-i18next to use our translation function
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'recipes.basicInfo': 'Basic Information',
        'recipes.name': 'Recipe Name',
        'recipes.description': 'Description',
        'recipes.ingredients': 'Ingredients',
        'recipes.instructions': 'Instructions',
        'recipes.prepTime': 'Prep Time',
        'recipes.cookTime': 'Cook Time',
        'recipes.servings': 'Servings',
        'recipes.difficulty': 'Difficulty',
        'recipes.isPublic': 'Make recipe public',
        'recipes.images': 'Images',
        'recipes.uploadImages': 'Upload Images',
        'recipes.existingImages': 'Existing Images',
        'recipes.addMoreImages': 'Add More Images',
        'recipes.imageRequirements': 'Max 10 images, 5MB each (JPEG, PNG, WebP)',
        'recipes.maxImagesError': 'Maximum 10 images allowed',
        'recipes.primaryImage': 'Primary',
        'recipes.addIngredient': 'Add Ingredient',
        'recipes.addInstruction': 'Add Instruction',
        'recipes.ingredientName': 'Ingredient name',
        'recipes.quantity': 'Quantity',
        'recipes.unit': 'Unit',
        'recipes.ingredient': 'ingredient',
        'recipes.difficultyLevels.easy': 'Easy',
        'recipes.difficultyLevels.medium': 'Medium',
        'recipes.difficultyLevels.hard': 'Hard',
        'recipes.units.g': 'grams',
        'recipes.units.kg': 'kilograms',
        'recipes.units.ml': 'milliliters',
        'recipes.units.l': 'liters',
        'recipes.units.cup': 'cup',
        'recipes.units.tbsp': 'tablespoon',
        'recipes.units.tsp': 'teaspoon',
        'recipes.units.piece': 'piece',
        'recipes.invalidImageType': 'Please upload only JPEG, PNG, or WebP images',
        'recipes.imageTooLarge': 'Images must be less than 5MB',
        'common.cancel': 'Cancel',
        'common.create': 'Create',
        'common.update': 'Update',
        'common.save': 'Save',
        'common.saving': 'Saving...',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.view': 'View',
        'common.remove': 'Remove',
        'common.step': 'Step',
        'common.minutes': 'minutes',
        'common.actions': 'Actions',
        'errors.generic': 'Something went wrong',
      }
      return translations[key] || fallback || key
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}))

// Create a custom render function that includes all providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string
  queryClient?: QueryClient
}

// Create a test query client with defaults suitable for testing
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Mock stores
export const mockAuthStore = {
  user: null,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
  setUser: vi.fn(),
}

export const mockRecipeStore = {
  recipes: [],
  currentRecipe: null,
  totalRecipes: 0,
  currentPage: 1,
  pageSize: 20,
  filters: {},
  sortBy: 'createdAt' as const,
  sortOrder: 'desc' as const,
  userRecipes: [],
  userRecipesLoaded: false,
  favorites: [],
  loading: false,
  error: null,
  fetchRecipes: vi.fn(),
  fetchRecipe: vi.fn(),
  fetchUserRecipes: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  duplicateRecipe: vi.fn(),
  forkRecipe: vi.fn(),
  setFilters: vi.fn(),
  clearFilters: vi.fn(),
  setSortBy: vi.fn(),
  setSortOrder: vi.fn(),
  setCurrentPage: vi.fn(),
  toggleFavorite: vi.fn(),
  exportRecipe: vi.fn(),
  importRecipe: vi.fn(),
}

export function render(
  ui: ReactElement,
  {
    initialRoute = '/',
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  window.history.pushState({}, 'Test page', initialRoute)

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock data factories
export function createMockRecipe(overrides = {}) {
  return {
    id: 'recipe-1',
    name: 'Test Recipe',
    title: 'Test Recipe', // For backwards compatibility
    description: 'A test recipe',
    servings: 4,
    prepTime: 30,
    cookTime: 45,
    difficulty: 'medium',
    category: 'main-course',
    tags: ['test'],
    ingredients: [],
    instructions: [],
    nutrition: {},
    isPublic: false,
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Mock file functions for testing file uploads
export function createMockFile(name: string, size: number, type: string): File {
  const file = new File([''], name, { type })
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  })
  return file
}

export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (let i = 0; i < files.length; i++) {
        yield files[i]
      }
    },
  }
  
  // Add files as indexed properties
  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, {
      value: file,
      enumerable: true,
    })
  })
  
  return fileList as FileList
}

export function createMockUser(overrides = {}) {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// Re-export everything from testing library
export * from '@testing-library/react'