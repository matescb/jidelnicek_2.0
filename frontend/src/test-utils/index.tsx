import React, { ReactElement } from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/context/ThemeContext'

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
  login: jest.fn(),
  logout: jest.fn(),
  setUser: jest.fn(),
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
  fetchRecipes: jest.fn(),
  fetchRecipe: jest.fn(),
  fetchUserRecipes: jest.fn(),
  createRecipe: jest.fn(),
  updateRecipe: jest.fn(),
  deleteRecipe: jest.fn(),
  duplicateRecipe: jest.fn(),
  forkRecipe: jest.fn(),
  setFilters: jest.fn(),
  clearFilters: jest.fn(),
  setSortBy: jest.fn(),
  setSortOrder: jest.fn(),
  setCurrentPage: jest.fn(),
  toggleFavorite: jest.fn(),
  exportRecipe: jest.fn(),
  importRecipe: jest.fn(),
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
    title: 'Test Recipe',
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
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