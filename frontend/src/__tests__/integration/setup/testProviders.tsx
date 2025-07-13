import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { WebSocketProvider } from '@/context/WebSocketContext'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { DirectionalProvider } from '@/components/rtl'

// Configure i18n for testing
const testI18n = i18n.createInstance()
testI18n.init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      translation: {
        // Common translations
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.view': 'View',
        'common.search': 'Search',
        'common.filter': 'Filter',
        'common.clear': 'Clear',
        'common.submit': 'Submit',
        'common.close': 'Close',
        
        // Auth translations
        'auth.login': 'Login',
        'auth.logout': 'Logout',
        'auth.register': 'Register',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.firstName': 'First Name',
        'auth.lastName': 'Last Name',
        'auth.forgotPassword': 'Forgot Password',
        'auth.resetPassword': 'Reset Password',
        'auth.verifyEmail': 'Verify Email',
        'auth.loginSuccess': 'Login successful',
        'auth.loginError': 'Login failed',
        'auth.registerSuccess': 'Registration successful',
        'auth.registerError': 'Registration failed',
        
        // Recipe translations
        'recipes.title': 'Recipes',
        'recipes.name': 'Recipe Name',
        'recipes.description': 'Description',
        'recipes.prepTime': 'Prep Time',
        'recipes.cookTime': 'Cook Time',
        'recipes.servings': 'Servings',
        'recipes.difficulty': 'Difficulty',
        'recipes.cuisine': 'Cuisine',
        'recipes.category': 'Category',
        'recipes.ingredients': 'Ingredients',
        'recipes.instructions': 'Instructions',
        'recipes.nutrition': 'Nutrition',
        'recipes.tags': 'Tags',
        'recipes.createNew': 'Create New Recipe',
        'recipes.editRecipe': 'Edit Recipe',
        'recipes.deleteRecipe': 'Delete Recipe',
        'recipes.recipeCreated': 'Recipe created successfully',
        'recipes.recipeUpdated': 'Recipe updated successfully',
        'recipes.recipeDeleted': 'Recipe deleted successfully',
        
        // Trip translations
        'trips.title': 'Trips',
        'trips.name': 'Trip Name',
        'trips.description': 'Description',
        'trips.location': 'Location',
        'trips.startDate': 'Start Date',
        'trips.endDate': 'End Date',
        'trips.participants': 'Participants',
        'trips.status': 'Status',
        'trips.budget': 'Budget',
        'trips.createNew': 'Create New Trip',
        'trips.editTrip': 'Edit Trip',
        'trips.deleteTrip': 'Delete Trip',
        'trips.tripCreated': 'Trip created successfully',
        'trips.tripUpdated': 'Trip updated successfully',
        'trips.tripDeleted': 'Trip deleted successfully',
        'trips.addParticipant': 'Add Participant',
        'trips.removeParticipant': 'Remove Participant',
        'trips.inviteParticipant': 'Invite Participant',
        
        // Navigation translations
        'nav.home': 'Home',
        'nav.dashboard': 'Dashboard',
        'nav.recipes': 'Recipes',
        'nav.trips': 'Trips',
        'nav.ingredients': 'Ingredients',
        'nav.profile': 'Profile',
        'nav.settings': 'Settings',
        'nav.admin': 'Admin',
        
        // Form translations
        'form.required': 'This field is required',
        'form.invalidEmail': 'Please enter a valid email address',
        'form.passwordTooShort': 'Password must be at least 8 characters',
        'form.passwordMismatch': 'Passwords do not match',
        'form.saving': 'Saving...',
        'form.saved': 'Saved successfully',
        'form.saveFailed': 'Save failed',
        'form.unsavedChanges': 'You have unsaved changes',
        
        // Error translations
        'errors.generic': 'Something went wrong',
        'errors.networkError': 'Network error occurred',
        'errors.serverError': 'Server error occurred',
        'errors.notFound': 'Not found',
        'errors.unauthorized': 'Unauthorized access',
        'errors.forbidden': 'Access forbidden',
        'errors.sessionExpired': 'Your session has expired',
        
        // Shopping list translations
        'shopping.title': 'Shopping List',
        'shopping.generateList': 'Generate Shopping List',
        'shopping.addItem': 'Add Item',
        'shopping.removeItem': 'Remove Item',
        'shopping.checkItem': 'Check Item',
        'shopping.totalCost': 'Total Estimated Cost',
        'shopping.export': 'Export List',
        
        // Meal planning translations
        'meals.breakfast': 'Breakfast',
        'meals.lunch': 'Lunch',
        'meals.dinner': 'Dinner',
        'meals.snack': 'Snack',
        'meals.addMeal': 'Add Meal',
        'meals.removeMeal': 'Remove Meal',
        'meals.assignRecipe': 'Assign Recipe',
        'meals.mealPlan': 'Meal Plan',
      }
    }
  }
})

interface TestProvidersOptions {
  // Router options
  initialEntries?: string[]
  useMemoryRouter?: boolean
  
  // Auth options
  initialUser?: any
  initialTokens?: any
  
  // Query client options
  queryClientOptions?: any
  
  // Theme options
  initialTheme?: 'light' | 'dark' | 'system'
  
  // WebSocket options
  enableWebSocket?: boolean
  
  // i18n options
  language?: string
  
  // Custom providers
  customProviders?: Array<React.ComponentType<{ children: React.ReactNode }>>
}

interface TestRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  providerOptions?: TestProvidersOptions
}

// Create test providers wrapper
export const createTestProviders = (options: TestProvidersOptions = {}) => {
  const {
    initialEntries = ['/'],
    useMemoryRouter = true,
    initialUser = null,
    initialTokens = null,
    queryClientOptions = {},
    initialTheme = 'light',
    enableWebSocket = false,
    language = 'en',
    customProviders = [],
  } = options

  // Configure test query client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    ...queryClientOptions,
  })

  // Set language
  testI18n.changeLanguage(language)

  const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    let content = children

    // Apply custom providers in reverse order (outermost first)
    customProviders.reverse().forEach(Provider => {
      content = <Provider>{content}</Provider>
    })

    // Core providers
    const RouterComponent = useMemoryRouter ? MemoryRouter : BrowserRouter
    const routerProps = useMemoryRouter ? { initialEntries } : {}

    return (
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <DirectionalProvider>
            <ThemeProvider initialTheme={initialTheme}>
              <RouterComponent {...routerProps}>
                <AuthProvider 
                  initialUser={initialUser} 
                  initialTokens={initialTokens}
                >
                  {enableWebSocket ? (
                    <WebSocketProvider>
                      <ToastProvider>
                        {content}
                      </ToastProvider>
                    </WebSocketProvider>
                  ) : (
                    <ToastProvider>
                      {content}
                    </ToastProvider>
                  )}
                </AuthProvider>
              </RouterComponent>
            </ThemeProvider>
          </DirectionalProvider>
        </I18nextProvider>
      </QueryClientProvider>
    )
  }

  return TestProviders
}

// Enhanced render function with provider options
export const renderWithProviders = (
  ui: ReactElement,
  options: TestRenderOptions = {}
) => {
  const { providerOptions = {}, ...renderOptions } = options
  const TestProviders = createTestProviders(providerOptions)

  return {
    ...render(ui, { wrapper: TestProviders, ...renderOptions }),
    queryClient: TestProviders.queryClient,
  }
}

// Specialized provider setups for different test scenarios

// Authentication test setup
export const createAuthTestProviders = (options: {
  authenticated?: boolean
  user?: any
  tokens?: any
  role?: string
} = {}) => {
  const { authenticated = false, user, tokens, role = 'user' } = options
  
  const defaultUser = authenticated ? {
    id: 'test-user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } : null

  const defaultTokens = authenticated ? {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  } : null

  return createTestProviders({
    initialUser: user || defaultUser,
    initialTokens: tokens || defaultTokens,
  })
}

// Mobile test setup
export const createMobileTestProviders = (options: TestProvidersOptions = {}) => {
  // Simulate mobile viewport
  Object.defineProperties(window, {
    innerWidth: { value: 375, writable: true },
    innerHeight: { value: 667, writable: true },
  })
  window.dispatchEvent(new Event('resize'))

  return createTestProviders(options)
}

// Offline test setup
export const createOfflineTestProviders = (options: TestProvidersOptions = {}) => {
  // Mock navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    value: false,
    writable: true,
  })

  const queryClientOptions = {
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity, // Never refetch when offline
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: false,
        networkMode: 'offlineFirst',
      },
    },
  }

  return createTestProviders({
    ...options,
    queryClientOptions,
  })
}

// Performance test setup with monitoring
export const createPerformanceTestProviders = (options: TestProvidersOptions = {}) => {
  const performanceQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
      },
      mutations: {
        retry: 1,
      },
    },
  })

  // Performance monitoring
  const originalRender = React.createElement
  React.createElement = function(...args) {
    const start = performance.now()
    const result = originalRender.apply(this, args)
    const end = performance.now()
    
    if (end - start > 16) { // Log slow renders (>16ms)
      console.warn(`Slow render detected: ${end - start}ms`, args[0])
    }
    
    return result
  }

  return createTestProviders({
    ...options,
    queryClientOptions: { defaultOptions: performanceQueryClient.getDefaultOptions() },
  })
}

// Error boundary test setup
export const createErrorTestProviders = (options: TestProvidersOptions & {
  onError?: (error: Error, errorInfo: any) => void
} = {}) => {
  const { onError, ...providerOptions } = options

  class TestErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean }
  > {
    constructor(props: any) {
      super(props)
      this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true }
    }

    componentDidCatch(error: Error, errorInfo: any) {
      onError?.(error, errorInfo)
    }

    render() {
      if (this.state.hasError) {
        return <div data-testid="error-boundary">Something went wrong</div>
      }

      return this.props.children
    }
  }

  const customProviders = [TestErrorBoundary, ...(providerOptions.customProviders || [])]

  return createTestProviders({
    ...providerOptions,
    customProviders,
  })
}

// Theme test setup
export const createThemeTestProviders = (theme: 'light' | 'dark' | 'system' = 'light') => {
  return createTestProviders({
    initialTheme: theme,
  })
}

// Admin test setup
export const createAdminTestProviders = (options: TestProvidersOptions = {}) => {
  return createAuthTestProviders({
    authenticated: true,
    role: 'admin',
    ...options,
  })
}

// Internationalization test setup
export const createI18nTestProviders = (language: string = 'en') => {
  return createTestProviders({
    language,
  })
}

// WebSocket test setup
export const createWebSocketTestProviders = (options: TestProvidersOptions = {}) => {
  return createTestProviders({
    ...options,
    enableWebSocket: true,
  })
}

// Export render utilities
export { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'
export { testI18n }

// Custom render presets
export const renderWithAuth = (ui: ReactElement, options: { authenticated?: boolean; role?: string } = {}) => {
  return renderWithProviders(ui, {
    providerOptions: {
      ...createAuthTestProviders(options),
    },
  })
}

export const renderWithMobile = (ui: ReactElement, options: TestProvidersOptions = {}) => {
  return renderWithProviders(ui, {
    providerOptions: createMobileTestProviders(options),
  })
}

export const renderWithOffline = (ui: ReactElement, options: TestProvidersOptions = {}) => {
  return renderWithProviders(ui, {
    providerOptions: createOfflineTestProviders(options),
  })
}

export const renderWithPerformance = (ui: ReactElement, options: TestProvidersOptions = {}) => {
  return renderWithProviders(ui, {
    providerOptions: createPerformanceTestProviders(options),
  })
}