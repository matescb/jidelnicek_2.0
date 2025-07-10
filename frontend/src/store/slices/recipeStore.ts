import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { apiClient } from '@/api/client'
import type { BaseStore, PaginatedResponse } from '../types'
import type { Recipe, RecipeFilters as RecipeFiltersBase } from '@/types/recipe'

// Re-export Recipe type for convenience
export type { Recipe }

// Extend the base RecipeFilters to match store expectations
export interface RecipeFilters extends RecipeFiltersBase {
  // Additional store-specific filters
  prepTimeMax?: number
  cookTimeMax?: number
  caloriesMin?: number
  caloriesMax?: number
  sortBy?: 'name' | 'createdAt' | 'rating' | 'prepTime' | 'calories'
  sortOrder?: 'asc' | 'desc'
}

export interface RecipeStore extends BaseStore {
  // State
  recipes: Recipe[]
  currentRecipe: Recipe | null
  totalRecipes: number
  currentPage: number
  pageSize: number
  filters: RecipeFilters
  sortBy: 'name' | 'createdAt' | 'rating' | 'prepTime' | 'calories'
  sortOrder: 'asc' | 'desc'
  
  // Cache for user's recipes
  userRecipes: Recipe[]
  userRecipesLoaded: boolean
  favorites: string[]

  // Computed properties
  pagination: {
    currentPage: number
    pageSize: number
    totalPages: number
    totalItems: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }

  // Actions
  fetchRecipes: (page?: number) => Promise<void>
  fetchRecipe: (id: string | number) => Promise<void>
  fetchUserRecipes: () => Promise<void>
  createRecipe: (recipe: Partial<Recipe>) => Promise<Recipe>
  updateRecipe: (id: string | number, updates: Partial<Recipe>) => Promise<void>
  deleteRecipe: (id: string | number) => Promise<void>
  duplicateRecipe: (id: string | number) => Promise<Recipe>
  
  // Filter and sort actions
  setFilters: (filters: RecipeFilters) => void
  clearFilters: () => void
  setSorting: (sortBy: RecipeStore['sortBy'], sortOrder?: RecipeStore['sortOrder']) => void
  setPageSize: (size: number) => void
  
  // Utility actions
  searchRecipes: (filters: RecipeFilters & { page?: number; limit?: number }) => Promise<void>
  loadMore: () => Promise<void>
  toggleFavorite: (id: string | number) => Promise<void>
  rateRecipe: (id: string | number, rating: number) => Promise<void>
}

export const useRecipeStore = create<RecipeStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
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

      // Computed properties
      get pagination() {
        const { currentPage, pageSize, totalRecipes } = get()
        const totalPages = Math.ceil(totalRecipes / pageSize)
        return {
          currentPage,
          pageSize,
          totalPages,
          totalItems: totalRecipes,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1
        }
      },

      // Actions
      clearError: () => set((state) => {
        state.error = null
      }),

      fetchRecipes: async (page = 1) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const { filters, pageSize, sortBy, sortOrder } = get()
          const params = {
            page,
            pageSize,
            sortBy,
            sortOrder,
            ...filters
          }

          const response = await apiClient.get<PaginatedResponse<Recipe>>('/recipes', { params })
          
          set((state) => {
            // For page 1, replace recipes. For other pages, append (infinite scroll)
            if (page === 1) {
              state.recipes = response.data.items
            } else {
              state.recipes = [...state.recipes, ...response.data.items]
            }
            state.totalRecipes = response.data.total
            state.currentPage = response.data.page
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to fetch recipes'
          })
        }
      },

      fetchRecipe: async (id) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await apiClient.get<Recipe>(`/recipes/${id}`)
          
          set((state) => {
            state.currentRecipe = response.data
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to fetch recipe'
          })
        }
      },

      fetchUserRecipes: async () => {
        if (get().userRecipesLoaded) return

        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await apiClient.get<Recipe[]>('/recipes/my-recipes')
          
          set((state) => {
            state.userRecipes = response.data
            state.userRecipesLoaded = true
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to fetch your recipes'
          })
        }
      },

      createRecipe: async (recipeData) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          // Check if we have images to upload
          const hasImages = 'images' in recipeData && (recipeData as any).images?.length > 0
          let response

          if (hasImages) {
            // Create FormData for multipart upload
            const formData = new FormData()
            
            // Add recipe data as JSON (excluding images)
            const { images, ...recipeDataWithoutImages } = recipeData as any
            formData.append('recipe', JSON.stringify(recipeDataWithoutImages))
            
            // Add each image file
            images.forEach((file: File, index: number) => {
              formData.append(`images`, file)
            })

            // Send with multipart/form-data (Content-Type will be set automatically)
            response = await apiClient.post<Recipe>('/recipes', formData)
          } else {
            // Send as regular JSON
            response = await apiClient.post<Recipe>('/recipes', recipeData)
          }

          const newRecipe = response.data
          
          set((state) => {
            state.userRecipes = [newRecipe, ...state.userRecipes]
            state.loading = false
          })

          return newRecipe
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to create recipe'
          })
          throw error
        }
      },

      updateRecipe: async (id, updates) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          // Check if we have images to upload
          const hasImages = 'images' in updates && (updates as any).images?.length > 0
          const hasRemovedImages = 'removedImageIds' in updates && (updates as any).removedImageIds?.length > 0
          let response

          if (hasImages || hasRemovedImages) {
            // Create FormData for multipart upload
            const formData = new FormData()
            
            // Add recipe data as JSON (excluding images)
            const { images, removedImageIds, ...recipeDataWithoutImages } = updates as any
            formData.append('recipe', JSON.stringify(recipeDataWithoutImages))
            
            // Add removed image IDs if any
            if (removedImageIds && removedImageIds.length > 0) {
              formData.append('removedImageIds', JSON.stringify(removedImageIds))
            }
            
            // Add each new image file
            if (images && images.length > 0) {
              images.forEach((file: File) => {
                formData.append(`images`, file)
              })
            }

            // Send with multipart/form-data (Content-Type will be set automatically)
            response = await apiClient.put<Recipe>(`/recipes/${id}`, formData)
          } else {
            // Send as regular JSON
            response = await apiClient.put<Recipe>(`/recipes/${id}`, updates)
          }

          const updatedRecipe = response.data
          
          set((state) => {
            // Update in recipes list
            const index = state.recipes.findIndex((r: Recipe) => r.id === id)
            if (index !== -1) {
              state.recipes[index] = updatedRecipe
            }
            
            // Update in user recipes
            const userIndex = state.userRecipes.findIndex((r: Recipe) => r.id === id)
            if (userIndex !== -1) {
              state.userRecipes[userIndex] = updatedRecipe
            }
            
            // Update current recipe if it's the one being edited
            if (state.currentRecipe?.id === id) {
              state.currentRecipe = updatedRecipe
            }
            
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to update recipe'
          })
          throw error
        }
      },

      deleteRecipe: async (id) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          await apiClient.delete(`/recipes/${id}`)
          
          set((state) => {
            // Remove from recipes list
            state.recipes = state.recipes.filter((r: Recipe) => r.id !== id)
            
            // Remove from user recipes
            state.userRecipes = state.userRecipes.filter((r: Recipe) => r.id !== id)
            
            // Clear current recipe if it's the one being deleted
            if (state.currentRecipe?.id === id) {
              state.currentRecipe = null
            }
            
            state.totalRecipes = Math.max(0, state.totalRecipes - 1)
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to delete recipe'
          })
          throw error
        }
      },

      duplicateRecipe: async (id) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await apiClient.post<Recipe>(`/recipes/${id}/duplicate`)
          const duplicatedRecipe = response.data
          
          set((state) => {
            state.userRecipes = [duplicatedRecipe, ...state.userRecipes]
            state.loading = false
          })

          return duplicatedRecipe
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to duplicate recipe'
          })
          throw error
        }
      },

      setFilters: (filters) => {
        set((state) => {
          state.filters = { ...state.filters, ...filters }
          state.currentPage = 1 // Reset to first page when filters change
        })
      },

      clearFilters: () => {
        set((state) => {
          state.filters = {}
          state.currentPage = 1
        })
      },

      setSorting: (sortBy, sortOrder) => {
        set((state) => {
          state.sortBy = sortBy
          if (sortOrder) {
            state.sortOrder = sortOrder
          } else {
            // Toggle order if same sort field
            if (state.sortBy === sortBy) {
              state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
            } else {
              state.sortOrder = 'desc'
            }
          }
          state.currentPage = 1
        })
      },

      setPageSize: (size) => {
        set((state) => {
          state.pageSize = size
          state.currentPage = 1
        })
      },

      searchRecipes: async (filters) => {
        const { page = 1, limit, ...filterParams } = filters
        if (limit) {
          get().setPageSize(limit)
        }
        get().setFilters(filterParams)
        if (filterParams.sortBy) {
          get().setSorting(filterParams.sortBy as RecipeStore['sortBy'], filterParams.sortOrder as RecipeStore['sortOrder'])
        }
        await get().fetchRecipes(page)
      },

      loadMore: async () => {
        const { currentPage, pagination } = get()
        if (pagination.hasNextPage) {
          await get().fetchRecipes(currentPage + 1)
        }
      },

      toggleFavorite: async (id) => {
        try {
          await apiClient.post(`/recipes/${id}/favorite`)
          
          // Toggle in local favorites array for immediate UI update
          set((state) => {
            const stringId = String(id)
            const index = state.favorites.indexOf(stringId)
            if (index > -1) {
              state.favorites.splice(index, 1)
            } else {
              state.favorites.push(stringId)
            }
          })
          
          // Refetch to get updated data
          if (get().currentRecipe?.id === id) {
            await get().fetchRecipe(id)
          }
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to toggle favorite'
          })
        }
      },

      rateRecipe: async (id, rating) => {
        try {
          await apiClient.post(`/recipes/${id}/rate`, { rating })
          // Refetch to get updated rating
          if (get().currentRecipe?.id === id) {
            await get().fetchRecipe(id)
          }
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to rate recipe'
          })
        }
      }
    })),
    {
      name: 'RecipeStore'
    }
  )
)