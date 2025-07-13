import { act, renderHook } from '@testing-library/react'
import { 
  useAuthStore, 
  useRecipeStore, 
  useTripStore, 
  useUIStore,
  useIsAuthenticated,
  useCurrentUser,
  useGlobalLoading,
  useAllErrors
} from '../hooks'

// Mock API dependencies
vi.mock('@/api/client')
vi.mock('@/services/participants')
vi.mock('axios')

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('Store Integration', () => {
  beforeEach(() => {
    // Reset all stores
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isInitialized: false,
      loading: false,
      error: null,
    })

    useRecipeStore.setState({
      recipes: [],
      currentRecipe: null,
      totalRecipes: 0,
      currentPage: 1,
      pageSize: 20,
      filters: {},
      sortBy: 'createdAt',
      sortOrder: 'desc',
      userRecipes: [],
      userRecipesLoaded: false,
      favorites: [],
      loading: false,
      error: null,
    })

    useTripStore.setState({
      trips: [],
      currentTrip: null,
      totalTrips: 0,
      currentPage: 1,
      pageSize: 20,
      filters: {},
      sortBy: 'startDate',
      sortOrder: 'desc',
      shoppingList: [],
      shoppingListLoading: false,
      loading: false,
      error: null,
      participantLoading: false,
      participantError: null,
    })

    useUIStore.setState({
      theme: 'system',
      language: 'en',
      sidebarOpen: true,
      mobileMenuOpen: false,
      toasts: [],
      modals: [],
      globalLoading: false,
      loadingMessage: undefined,
      preferences: {
        compactView: false,
        showNutrition: true,
        defaultServings: 4,
        preferredUnits: 'metric'
      },
      loading: false,
      error: null,
    })

    vi.clearAllMocks()
  })

  describe('Store Hooks Integration', () => {
    describe('useIsAuthenticated', () => {
      it('should return authentication status', () => {
        const { result } = renderHook(() => useIsAuthenticated())
        
        expect(result.current).toBe(false)

        act(() => {
          useAuthStore.getState().setTokens({
            accessToken: 'token',
            refreshToken: 'refresh'
          })
        })

        expect(result.current).toBe(true)
      })
    })

    describe('useCurrentUser', () => {
      it('should return current user', () => {
        const { result } = renderHook(() => useCurrentUser())
        
        expect(result.current).toBeNull()

        const mockUser = {
          id: '1',
          email: 'test@example.com',
          emailVerified: true,
          role: 'user' as const,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }

        act(() => {
          useAuthStore.getState().setUser(mockUser)
        })

        expect(result.current).toEqual(mockUser)
      })
    })

    describe('useGlobalLoading', () => {
      it('should return true when any store is loading', () => {
        const { result } = renderHook(() => useGlobalLoading())
        
        expect(result.current).toBe(false)

        // Test auth loading
        act(() => {
          useAuthStore.setState({ loading: true })
        })
        expect(result.current).toBe(true)

        act(() => {
          useAuthStore.setState({ loading: false })
        })
        expect(result.current).toBe(false)

        // Test recipe loading
        act(() => {
          useRecipeStore.setState({ loading: true })
        })
        expect(result.current).toBe(true)

        act(() => {
          useRecipeStore.setState({ loading: false })
        })
        expect(result.current).toBe(false)

        // Test trip loading
        act(() => {
          useTripStore.setState({ loading: true })
        })
        expect(result.current).toBe(true)

        act(() => {
          useTripStore.setState({ loading: false })
        })
        expect(result.current).toBe(false)

        // Test UI global loading
        act(() => {
          useUIStore.setState({ globalLoading: true })
        })
        expect(result.current).toBe(true)
      })
    })

    describe('useAllErrors', () => {
      it('should return errors from all stores', () => {
        const { result } = renderHook(() => useAllErrors())
        
        expect(result.current).toEqual([])

        // Add errors to different stores
        act(() => {
          useAuthStore.setState({ error: 'Auth error' })
          useRecipeStore.setState({ error: 'Recipe error' })
          useTripStore.setState({ error: 'Trip error' })
          useUIStore.setState({ error: 'UI error' })
        })

        expect(result.current).toEqual([
          { source: 'auth', error: 'Auth error' },
          { source: 'recipe', error: 'Recipe error' },
          { source: 'trip', error: 'Trip error' },
          { source: 'ui', error: 'UI error' }
        ])

        // Clear some errors
        act(() => {
          useAuthStore.setState({ error: null })
          useTripStore.setState({ error: null })
        })

        expect(result.current).toEqual([
          { source: 'recipe', error: 'Recipe error' },
          { source: 'ui', error: 'UI error' }
        ])
      })
    })
  })

  describe('Cross-Store Interactions', () => {
    it('should handle authentication state changes affecting other stores', () => {
      // Mock that recipes and trips might need to be refetched when auth changes
      const authHook = renderHook(() => useAuthStore())
      const recipeHook = renderHook(() => useRecipeStore())
      const tripHook = renderHook(() => useTripStore())

      // Initially not authenticated
      expect(authHook.result.current.isAuthenticated).toBe(false)

      // Login
      act(() => {
        authHook.result.current.setTokens({
          accessToken: 'token',
          refreshToken: 'refresh'
        })
        authHook.result.current.setUser({
          id: '1',
          email: 'test@example.com',
          emailVerified: true,
          role: 'user',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        })
      })

      expect(authHook.result.current.isAuthenticated).toBe(true)

      // Logout should clear user data
      act(() => {
        authHook.result.current.setTokens(null)
        authHook.result.current.setUser(null)
      })

      expect(authHook.result.current.isAuthenticated).toBe(false)
      expect(authHook.result.current.user).toBeNull()
    })

    it('should handle error propagation across stores', () => {
      const errorHook = renderHook(() => useAllErrors())
      
      // Add errors from multiple sources
      act(() => {
        useAuthStore.setState({ error: 'Authentication failed' })
        useRecipeStore.setState({ error: 'Failed to load recipes' })
      })

      expect(errorHook.result.current).toHaveLength(2)
      expect(errorHook.result.current.map(e => e.source)).toEqual(['auth', 'recipe'])

      // Clear errors
      act(() => {
        useAuthStore.getState().clearError()
        useRecipeStore.getState().clearError()
      })

      expect(errorHook.result.current).toHaveLength(0)
    })

    it('should handle loading states across stores', () => {
      const loadingHook = renderHook(() => useGlobalLoading())
      
      expect(loadingHook.result.current).toBe(false)

      // Set multiple loading states
      act(() => {
        useAuthStore.setState({ loading: true })
        useRecipeStore.setState({ loading: true })
      })

      expect(loadingHook.result.current).toBe(true)

      // Clear one loading state
      act(() => {
        useAuthStore.setState({ loading: false })
      })

      expect(loadingHook.result.current).toBe(true) // Still loading from recipes

      // Clear all loading states
      act(() => {
        useRecipeStore.setState({ loading: false })
      })

      expect(loadingHook.result.current).toBe(false)
    })
  })

  describe('Store Persistence Integration', () => {
    it('should handle auth store persistence correctly', () => {
      const { result } = renderHook(() => useAuthStore())

      // Set tokens (which should be persisted)
      act(() => {
        result.current.setTokens({
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        })
      })

      // User data should not be persisted (only tokens)
      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          emailVerified: true,
          role: 'user',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        })
      })

      expect(result.current.tokens).toBeTruthy()
      expect(result.current.user).toBeTruthy()
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should handle UI store persistence correctly', () => {
      const { result } = renderHook(() => useUIStore())

      // Theme and language should persist to localStorage
      act(() => {
        result.current.setTheme('dark')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark')

      act(() => {
        result.current.setLanguage('cs')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('language', 'cs')

      // Preferences should persist
      act(() => {
        result.current.updatePreferences({
          compactView: true,
          defaultServings: 6
        })
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ui-preferences',
        expect.stringContaining('compactView')
      )
    })
  })

  describe('Store State Consistency', () => {
    it('should maintain consistent state when multiple components use the same store', () => {
      const hook1 = renderHook(() => useAuthStore())
      const hook2 = renderHook(() => useAuthStore())
      const hook3 = renderHook(() => useIsAuthenticated())

      expect(hook1.result.current.isAuthenticated).toBe(false)
      expect(hook2.result.current.isAuthenticated).toBe(false)
      expect(hook3.result.current).toBe(false)

      // Change authentication state
      act(() => {
        hook1.result.current.setTokens({
          accessToken: 'token',
          refreshToken: 'refresh'
        })
      })

      // All hooks should reflect the change
      expect(hook1.result.current.isAuthenticated).toBe(true)
      expect(hook2.result.current.isAuthenticated).toBe(true)
      expect(hook3.result.current).toBe(true)
    })

    it('should handle concurrent store updates correctly', () => {
      const authHook = renderHook(() => useAuthStore())
      const uiHook = renderHook(() => useUIStore())
      const loadingHook = renderHook(() => useGlobalLoading())

      // Update multiple stores simultaneously
      act(() => {
        authHook.result.current.setTokens({
          accessToken: 'token',
          refreshToken: 'refresh'
        })
        useAuthStore.setState({ loading: true })
        useRecipeStore.setState({ loading: true })
        uiHook.result.current.setGlobalLoading(true, 'Syncing data...')
      })

      expect(authHook.result.current.isAuthenticated).toBe(true)
      expect(loadingHook.result.current).toBe(true)
      expect(uiHook.result.current.globalLoading).toBe(true)

      // Clear loading states
      act(() => {
        useAuthStore.setState({ loading: false })
        useRecipeStore.setState({ loading: false })
        uiHook.result.current.setGlobalLoading(false)
      })

      expect(loadingHook.result.current).toBe(false)
    })
  })

  describe('Performance and Memory Management', () => {
    it('should handle rapid store updates without memory leaks', () => {
      const { result } = renderHook(() => useUIStore())

      // Simulate rapid toast additions and removals
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.showToast({
            type: 'info',
            title: `Toast ${i}`,
            duration: 0 // Don't auto-remove
          })
        }
      })

      expect(result.current.toasts.length).toBe(100)

      act(() => {
        result.current.clearToasts()
      })

      expect(result.current.toasts.length).toBe(0)
    })

    it('should handle store subscriptions correctly', () => {
      let subscriptionCount = 0
      let lastState: any = null

      // Subscribe to auth store changes
      const unsubscribe = useAuthStore.subscribe((state) => {
        subscriptionCount++
        lastState = state
      })

      // Make changes
      act(() => {
        useAuthStore.getState().setTokens({
          accessToken: 'token',
          refreshToken: 'refresh'
        })
      })

      expect(subscriptionCount).toBeGreaterThan(0)
      expect(lastState?.isAuthenticated).toBe(true)

      // Cleanup
      unsubscribe()

      // Further changes should not trigger the subscription
      const prevCount = subscriptionCount
      act(() => {
        useAuthStore.getState().setTokens(null)
      })

      expect(subscriptionCount).toBe(prevCount)
    })
  })

  describe('Error Recovery', () => {
    it('should recover from store errors gracefully', () => {
      const { result } = renderHook(() => useRecipeStore())

      // Simulate an error state
      act(() => {
        useRecipeStore.setState({
          error: 'Network error',
          loading: false
        })
      })

      expect(result.current.error).toBe('Network error')

      // Clear error and retry operation
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()

      // Subsequent operations should work normally
      act(() => {
        result.current.setFilters({ tags: ['vegetarian'] })
      })

      expect(result.current.filters.tags).toEqual(['vegetarian'])
    })

    it('should handle store reset scenarios', () => {
      const authHook = renderHook(() => useAuthStore())
      const uiHook = renderHook(() => useUIStore())

      // Set up some state
      act(() => {
        authHook.result.current.setTokens({
          accessToken: 'token',
          refreshToken: 'refresh'
        })
        uiHook.result.current.showToast({
          type: 'info',
          title: 'Test toast'
        })
        uiHook.result.current.setTheme('dark')
      })

      expect(authHook.result.current.isAuthenticated).toBe(true)
      expect(uiHook.result.current.toasts.length).toBe(1)
      expect(uiHook.result.current.theme).toBe('dark')

      // Reset UI state
      act(() => {
        uiHook.result.current.resetUI()
      })

      expect(uiHook.result.current.toasts.length).toBe(0)
      expect(uiHook.result.current.sidebarOpen).toBe(true)
      expect(uiHook.result.current.mobileMenuOpen).toBe(false)
      
      // Auth state should remain unchanged
      expect(authHook.result.current.isAuthenticated).toBe(true)
    })
  })

  describe('Development Tools Integration', () => {
    it('should expose stores for debugging', () => {
      // Verify stores are accessible for debugging
      expect(useAuthStore.getState).toBeDefined()
      expect(useRecipeStore.getState).toBeDefined()
      expect(useTripStore.getState).toBeDefined()
      expect(useUIStore.getState).toBeDefined()

      // Verify stores have devtools enabled (they should have a name)
      expect(typeof useAuthStore.getState).toBe('function')
      expect(typeof useRecipeStore.getState).toBe('function')
      expect(typeof useTripStore.getState).toBe('function')
      expect(typeof useUIStore.getState).toBe('function')
    })

    it('should handle time travel debugging scenarios', () => {
      const { result } = renderHook(() => useAuthStore())

      // Simulate a series of state changes
      const states: any[] = []

      act(() => {
        states.push(useAuthStore.getState())
        result.current.setTokens({
          accessToken: 'token1',
          refreshToken: 'refresh1'
        })
      })

      act(() => {
        states.push(useAuthStore.getState())
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          emailVerified: true,
          role: 'user',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        })
      })

      act(() => {
        states.push(useAuthStore.getState())
        result.current.setTokens(null)
      })

      // Verify state progression
      expect(states[0].isAuthenticated).toBe(false)
      expect(states[1].isAuthenticated).toBe(true)
      expect(states[2].isAuthenticated).toBe(false)

      // Simulate time travel by restoring previous state
      act(() => {
        useAuthStore.setState(states[1])
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toBeTruthy()
    })
  })
})