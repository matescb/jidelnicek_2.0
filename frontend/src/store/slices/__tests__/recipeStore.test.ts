import { act, renderHook } from '@testing-library/react'
import { useRecipeStore } from '../recipeStore'
import { apiClient } from '@/api/client'
import type { Recipe, RecipeFilters } from '../recipeStore'
import type { PaginatedResponse } from '../../types'

// Mock API client
vi.mock('@/api/client')
const mockedApiClient = apiClient as vi.Mocked<typeof apiClient>

describe('recipeStore', () => {
  const mockRecipe: Recipe = {
    id: '1',
    name: 'Test Recipe',
    description: 'A test recipe',
    servings: 4,
    prepTime: 15,
    cookTime: 30,
    difficulty: 'easy',
    tags: ['vegetarian'],
    ingredients: [
      {
        id: '1',
        name: 'Test Ingredient',
        quantity: 100,
        unit: 'g',
        category: 'protein'
      }
    ],
    instructions: ['Step 1', 'Step 2'],
    nutrition: {
      calories: 250,
      protein: 15,
      carbs: 20,
      fat: 10,
      fiber: 5
    },
    images: [],
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    userId: 'user1'
  }

  const mockPaginatedResponse: PaginatedResponse<Recipe> = {
    items: [mockRecipe],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1
  }

  beforeEach(() => {
    // Reset store state
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
    
    // Reset mocks
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useRecipeStore())
      
      expect(result.current.recipes).toEqual([])
      expect(result.current.currentRecipe).toBeNull()
      expect(result.current.totalRecipes).toBe(0)
      expect(result.current.currentPage).toBe(1)
      expect(result.current.pageSize).toBe(20)
      expect(result.current.filters).toEqual({})
      expect(result.current.sortBy).toBe('createdAt')
      expect(result.current.sortOrder).toBe('desc')
      expect(result.current.userRecipes).toEqual([])
      expect(result.current.userRecipesLoaded).toBe(false)
      expect(result.current.favorites).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('pagination computed property', () => {
    it('should calculate pagination correctly', () => {
      const { result } = renderHook(() => useRecipeStore())
      
      act(() => {
        useRecipeStore.setState({
          totalRecipes: 45,
          currentPage: 2,
          pageSize: 20
        })
      })
      
      expect(result.current.pagination).toEqual({
        currentPage: 2,
        pageSize: 20,
        totalPages: 3,
        totalItems: 45,
        hasNextPage: true,
        hasPreviousPage: true
      })
    })

    it('should handle edge cases in pagination', () => {
      const { result } = renderHook(() => useRecipeStore())
      
      // Test first page
      act(() => {
        useRecipeStore.setState({
          totalRecipes: 10,
          currentPage: 1,
          pageSize: 20
        })
      })
      
      expect(result.current.pagination.hasPreviousPage).toBe(false)
      expect(result.current.pagination.hasNextPage).toBe(false)
      expect(result.current.pagination.totalPages).toBe(1)
    })
  })

  describe('fetchRecipes', () => {
    it('should fetch recipes successfully', async () => {
      mockedApiClient.get.mockResolvedValueOnce(mockPaginatedResponse)

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.fetchRecipes()
      })

      expect(result.current.recipes).toEqual([mockRecipe])
      expect(result.current.totalRecipes).toBe(1)
      expect(result.current.currentPage).toBe(1)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should append recipes for pagination beyond page 1', async () => {
      const additionalRecipe = { ...mockRecipe, id: '2', name: 'Recipe 2' }
      const page2Response = {
        ...mockPaginatedResponse,
        items: [additionalRecipe],
        page: 2
      }

      // First set some initial recipes
      act(() => {
        useRecipeStore.setState({
          recipes: [mockRecipe],
          currentPage: 1
        })
      })

      mockedApiClient.get.mockResolvedValueOnce(page2Response)

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.fetchRecipes(2)
      })

      expect(result.current.recipes).toEqual([mockRecipe, additionalRecipe])
      expect(result.current.currentPage).toBe(2)
    })

    it('should handle fetch recipes error', async () => {
      const errorMessage = 'Failed to fetch recipes'
      mockedApiClient.get.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.fetchRecipes()
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.recipes).toEqual([])
    })

    it('should include filters and sorting in request', async () => {
      mockedApiClient.get.mockResolvedValueOnce(mockPaginatedResponse)

      const { result } = renderHook(() => useRecipeStore())

      // Set filters and sorting
      act(() => {
        result.current.setFilters({ tags: ['vegetarian'], prepTimeMax: 30 })
        result.current.setSorting('name', 'asc')
      })

      await act(async () => {
        await result.current.fetchRecipes()
      })

      expect(mockedApiClient.get).toHaveBeenCalledWith('/recipes', {
        params: {
          page: 1,
          pageSize: 20,
          sortBy: 'name',
          sortOrder: 'asc',
          tags: ['vegetarian'],
          prepTimeMax: 30
        }
      })
    })
  })

  describe('fetchRecipe', () => {
    it('should fetch single recipe successfully', async () => {
      mockedApiClient.get.mockResolvedValueOnce(mockRecipe)

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.fetchRecipe('1')
      })

      expect(result.current.currentRecipe).toEqual(mockRecipe)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle fetch recipe error', async () => {
      const errorMessage = 'Recipe not found'
      mockedApiClient.get.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.fetchRecipe('999')
      })

      expect(result.current.currentRecipe).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('fetchUserRecipes', () => {
    it('should fetch user recipes successfully', async () => {
      mockedApiClient.get.mockResolvedValueOnce([mockRecipe])

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.fetchUserRecipes()
      })

      expect(result.current.userRecipes).toEqual([mockRecipe])
      expect(result.current.userRecipesLoaded).toBe(true)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should not fetch if already loaded', async () => {
      // Set already loaded state
      act(() => {
        useRecipeStore.setState({ userRecipesLoaded: true })
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.fetchUserRecipes()
      })

      expect(mockedApiClient.get).not.toHaveBeenCalled()
    })

    it('should handle fetch user recipes error', async () => {
      const errorMessage = 'Failed to fetch your recipes'
      mockedApiClient.get.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.fetchUserRecipes()
      })

      expect(result.current.error).toBe(errorMessage)
      expect(result.current.userRecipesLoaded).toBe(false)
    })
  })

  describe('createRecipe', () => {
    it('should create recipe with JSON data', async () => {
      const newRecipeData = {
        name: 'New Recipe',
        description: 'A new recipe',
        servings: 4
      }
      
      mockedApiClient.post.mockResolvedValueOnce(mockRecipe)

      const { result } = renderHook(() => useRecipeStore())

      let createdRecipe: Recipe
      await act(async () => {
        createdRecipe = await result.current.createRecipe(newRecipeData)
      })

      expect(createdRecipe!).toEqual(mockRecipe)
      expect(result.current.userRecipes).toEqual([mockRecipe])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should create recipe with FormData (images)', async () => {
      const newRecipeData = {
        name: 'New Recipe',
        description: 'A new recipe',
        servings: 4,
        images: [new File([''], 'image.jpg', { type: 'image/jpeg' })]
      }
      
      mockedApiClient.post.mockResolvedValueOnce(mockRecipe)

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.createRecipe(newRecipeData)
      })

      // Verify FormData was sent
      const callArgs = mockedApiClient.post.mock.calls[0]
      expect(callArgs[0]).toBe('/recipes')
      expect(callArgs[1]).toBeInstanceOf(FormData)
    })

    it('should handle create recipe error', async () => {
      const errorMessage = 'Failed to create recipe'
      mockedApiClient.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        try {
          await result.current.createRecipe({ name: 'Test' })
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('updateRecipe', () => {
    beforeEach(() => {
      // Set initial state with existing recipes
      act(() => {
        useRecipeStore.setState({
          recipes: [mockRecipe],
          userRecipes: [mockRecipe],
          currentRecipe: mockRecipe
        })
      })
    })

    it('should update recipe successfully', async () => {
      const updatedRecipe = { ...mockRecipe, name: 'Updated Recipe' }
      const updates = { name: 'Updated Recipe' }
      
      mockedApiClient.put.mockResolvedValueOnce(updatedRecipe)

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.updateRecipe('1', updates)
      })

      expect(result.current.recipes[0]).toEqual(updatedRecipe)
      expect(result.current.userRecipes[0]).toEqual(updatedRecipe)
      expect(result.current.currentRecipe).toEqual(updatedRecipe)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should update recipe with images', async () => {
      const updates = {
        name: 'Updated Recipe',
        images: [new File([''], 'new-image.jpg', { type: 'image/jpeg' })],
        removedImageIds: ['old-image-1']
      }
      
      mockedApiClient.put.mockResolvedValueOnce(mockRecipe)

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.updateRecipe('1', updates)
      })

      // Verify FormData was sent
      const callArgs = mockedApiClient.put.mock.calls[0]
      expect(callArgs[0]).toBe('/recipes/1')
      expect(callArgs[1]).toBeInstanceOf(FormData)
    })

    it('should handle update recipe error', async () => {
      const errorMessage = 'Failed to update recipe'
      mockedApiClient.put.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        try {
          await result.current.updateRecipe('1', { name: 'Updated' })
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('deleteRecipe', () => {
    beforeEach(() => {
      // Set initial state with existing recipes
      act(() => {
        useRecipeStore.setState({
          recipes: [mockRecipe],
          userRecipes: [mockRecipe],
          currentRecipe: mockRecipe,
          totalRecipes: 1
        })
      })
    })

    it('should delete recipe successfully', async () => {
      mockedApiClient.delete.mockResolvedValueOnce({})

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.deleteRecipe('1')
      })

      expect(result.current.recipes).toEqual([])
      expect(result.current.userRecipes).toEqual([])
      expect(result.current.currentRecipe).toBeNull()
      expect(result.current.totalRecipes).toBe(0)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle delete recipe error', async () => {
      const errorMessage = 'Failed to delete recipe'
      mockedApiClient.delete.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        try {
          await result.current.deleteRecipe('1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
      expect(result.current.recipes).toEqual([mockRecipe]) // Should remain unchanged
    })
  })

  describe('duplicateRecipe', () => {
    it('should duplicate recipe successfully', async () => {
      const duplicatedRecipe = { ...mockRecipe, id: '2', name: 'Test Recipe (Copy)' }
      mockedApiClient.post.mockResolvedValueOnce(duplicatedRecipe)

      const { result } = renderHook(() => useRecipeStore())

      let result_recipe: Recipe
      await act(async () => {
        result_recipe = await result.current.duplicateRecipe('1')
      })

      expect(result_recipe!).toEqual(duplicatedRecipe)
      expect(result.current.userRecipes).toEqual([duplicatedRecipe])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle duplicate recipe error', async () => {
      const errorMessage = 'Failed to duplicate recipe'
      mockedApiClient.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        try {
          await result.current.duplicateRecipe('1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('filtering and sorting', () => {
    it('should set filters correctly', () => {
      const { result } = renderHook(() => useRecipeStore())

      const filters: RecipeFilters = {
        tags: ['vegetarian'],
        prepTimeMax: 30,
        difficulty: 'easy'
      }

      act(() => {
        result.current.setFilters(filters)
      })

      expect(result.current.filters).toEqual(filters)
      expect(result.current.currentPage).toBe(1) // Should reset to page 1
    })

    it('should merge filters when setting', () => {
      const { result } = renderHook(() => useRecipeStore())

      // Set initial filters
      act(() => {
        result.current.setFilters({ tags: ['vegetarian'] })
      })

      // Add more filters
      act(() => {
        result.current.setFilters({ prepTimeMax: 30 })
      })

      expect(result.current.filters).toEqual({
        tags: ['vegetarian'],
        prepTimeMax: 30
      })
    })

    it('should clear filters', () => {
      const { result } = renderHook(() => useRecipeStore())

      // Set initial filters
      act(() => {
        result.current.setFilters({ tags: ['vegetarian'], prepTimeMax: 30 })
        useRecipeStore.setState({ currentPage: 3 })
      })

      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.filters).toEqual({})
      expect(result.current.currentPage).toBe(1)
    })

    it('should set sorting correctly', () => {
      const { result } = renderHook(() => useRecipeStore())

      act(() => {
        result.current.setSorting('name', 'asc')
      })

      expect(result.current.sortBy).toBe('name')
      expect(result.current.sortOrder).toBe('asc')
      expect(result.current.currentPage).toBe(1)
    })

    it('should toggle sort order when setting same field', () => {
      const { result } = renderHook(() => useRecipeStore())

      // Set initial sorting
      act(() => {
        result.current.setSorting('name', 'asc')
      })

      // Set same field without specifying order
      act(() => {
        result.current.setSorting('name')
      })

      expect(result.current.sortBy).toBe('name')
      expect(result.current.sortOrder).toBe('desc') // Should toggle to desc
    })

    it('should set page size correctly', () => {
      const { result } = renderHook(() => useRecipeStore())

      act(() => {
        useRecipeStore.setState({ currentPage: 3 })
        result.current.setPageSize(10)
      })

      expect(result.current.pageSize).toBe(10)
      expect(result.current.currentPage).toBe(1) // Should reset to page 1
    })
  })

  describe('searchRecipes', () => {
    it('should search recipes with filters', async () => {
      mockedApiClient.get.mockResolvedValueOnce(mockPaginatedResponse)

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.searchRecipes({
          tags: ['vegetarian'],
          page: 1,
          limit: 10,
          sortBy: 'name',
          sortOrder: 'asc'
        })
      })

      expect(result.current.filters).toEqual({ tags: ['vegetarian'] })
      expect(result.current.pageSize).toBe(10)
      expect(result.current.sortBy).toBe('name')
      expect(result.current.sortOrder).toBe('asc')
      expect(mockedApiClient.get).toHaveBeenCalledWith('/recipes', {
        params: {
          page: 1,
          pageSize: 10,
          sortBy: 'name',
          sortOrder: 'asc',
          tags: ['vegetarian']
        }
      })
    })
  })

  describe('loadMore', () => {
    it('should load more recipes when has next page', async () => {
      const additionalRecipe = { ...mockRecipe, id: '2' }
      const page2Response = {
        ...mockPaginatedResponse,
        items: [additionalRecipe],
        page: 2
      }

      // Set initial state
      act(() => {
        useRecipeStore.setState({
          recipes: [mockRecipe],
          totalRecipes: 40,
          currentPage: 1,
          pageSize: 20
        })
      })

      mockedApiClient.get.mockResolvedValueOnce(page2Response)

      const { result } = renderHook(() => useRecipeStore())

      expect(result.current.pagination.hasNextPage).toBe(true)

      await act(async () => {
        await result.current.loadMore()
      })

      expect(result.current.recipes).toEqual([mockRecipe, additionalRecipe])
    })

    it('should not load more when no next page', async () => {
      // Set state where there's no next page
      act(() => {
        useRecipeStore.setState({
          recipes: [mockRecipe],
          totalRecipes: 1,
          currentPage: 1,
          pageSize: 20
        })
      })

      const { result } = renderHook(() => useRecipeStore())

      expect(result.current.pagination.hasNextPage).toBe(false)

      await act(async () => {
        await result.current.loadMore()
      })

      expect(mockedApiClient.get).not.toHaveBeenCalled()
    })
  })

  describe('toggleFavorite', () => {
    it('should toggle favorite successfully', async () => {
      mockedApiClient.post.mockResolvedValueOnce({})
      mockedApiClient.get.mockResolvedValueOnce(mockRecipe) // for refetch

      const { result } = renderHook(() => useRecipeStore())

      act(() => {
        useRecipeStore.setState({ currentRecipe: mockRecipe })
      })

      await act(async () => {
        await result.current.toggleFavorite('1')
      })

      expect(result.current.favorites).toEqual(['1'])
      expect(result.current.error).toBeNull()
    })

    it('should handle toggle favorite error', async () => {
      const errorMessage = 'Failed to toggle favorite'
      mockedApiClient.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.toggleFavorite('1')
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('rateRecipe', () => {
    it('should rate recipe successfully', async () => {
      mockedApiClient.post.mockResolvedValueOnce({})
      mockedApiClient.get.mockResolvedValueOnce(mockRecipe) // for refetch

      const { result } = renderHook(() => useRecipeStore())

      act(() => {
        useRecipeStore.setState({ currentRecipe: mockRecipe })
      })

      await act(async () => {
        await result.current.rateRecipe('1', 5)
      })

      expect(result.current.error).toBeNull()
      expect(mockedApiClient.post).toHaveBeenCalledWith('/recipes/1/rate', { rating: 5 })
    })

    it('should handle rate recipe error', async () => {
      const errorMessage = 'Failed to rate recipe'
      mockedApiClient.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useRecipeStore())

      await act(async () => {
        await result.current.rateRecipe('1', 5)
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('error handling', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useRecipeStore())

      act(() => {
        useRecipeStore.setState({ error: 'Test error' })
      })

      expect(result.current.error).toBe('Test error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})