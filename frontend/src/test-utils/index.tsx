import React, { ReactElement } from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n/config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'

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
        staleTime: 0,
        cacheTime: 0,
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
  setSorting: jest.fn(),
  setPageSize: jest.fn(),
  searchRecipes: jest.fn(),
  loadMore: jest.fn(),
  toggleFavorite: jest.fn(),
  rateRecipe: jest.fn(),
  clearError: jest.fn(),
  pagination: {
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
}

// Mock toast
export const mockToast = jest.fn()

// Custom render function
export function customRender(
  ui: ReactElement,
  {
    initialRoute = '/',
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Update the browser history if needed
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute)
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <I18nextProvider i18n={i18n}>
            <ThemeProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </ThemeProvider>
          </I18nextProvider>
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { customRender as render }

// Test data factories
export const createMockRecipe = (overrides?: Partial<any>) => ({
  id: '1',
  name: 'Test Recipe',
  description: 'A delicious test recipe',
  instructions: [
    { step: 1, text: 'First instruction' },
    { step: 2, text: 'Second instruction' },
  ],
  ingredients: [
    { name: 'Flour', quantity: 200, unit: 'g', notes: '' },
    { name: 'Sugar', quantity: 100, unit: 'g', notes: '' },
  ],
  prepTime: 15,
  cookTime: 30,
  totalTime: 45,
  servings: 4,
  difficulty: 'medium',
  categories: ['dessert'],
  tags: ['easy', 'quick'],
  isPublic: true,
  images: [],
  author: {
    id: '1',
    name: 'Test User',
    avatar: '/avatar.jpg',
  },
  authorId: '1',
  userId: '1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ratingAverage: 4.5,
  ratingCount: 10,
  viewCount: 100,
  nutrition: {
    calories: 250,
    protein: 5,
    carbs: 45,
    fat: 8,
    fiber: 2,
    sodium: 150,
  },
  ...overrides,
})

export const createMockUser = (overrides?: Partial<any>) => ({
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  avatar: '/avatar.jpg',
  role: 'user',
  ...overrides,
})

// Mock API responses
export const mockApiResponse = (data: any, status = 200) => {
  return Promise.resolve({
    status,
    data,
    headers: {},
    config: {},
    statusText: 'OK',
  })
}

export const mockApiError = (message: string, status = 400) => {
  return Promise.reject({
    response: {
      status,
      data: { message },
    },
  })
}

// Wait for async updates
export const waitForLoadingToFinish = () => 
  new Promise(resolve => setTimeout(resolve, 0))

// File upload helpers
export const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(['test'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

export const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (let i = 0; i < files.length; i++) {
        yield files[i]
      }
    },
  }
  
  files.forEach((file, index) => {
    fileList[index] = file
  })
  
  return fileList as unknown as FileList
}