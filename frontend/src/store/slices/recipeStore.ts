import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import axios from 'axios'
import type { BaseStore, PaginatedResponse, WithId, Timestamps } from '../types'

// Recipe related types
export interface Ingredient {
  id: string
  name: string
  quantity: number
  unit: string
  category?: string
  notes?: string
}

export interface NutritionalInfo {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

export interface Recipe extends WithId, Timestamps {
  name: string
  description: string
  instructions: string[]
  ingredients: Ingredient[]
  prepTime: number
  cookTime: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  categories: string[]
  tags: string[]
  images: string[]
  nutritionalInfo?: NutritionalInfo
  isPublic: boolean
  authorId: string
  authorName?: string
  rating?: number
  ratingCount?: number
}

export interface RecipeFilters {
  search?: string
  categories?: string[]
  tags?: string[]
  difficulty?: string[]
  prepTimeMax?: number
  cookTimeMax?: number
  caloriesMin?: number
  caloriesMax?: number
  isPublic?: boolean
  authorId?: string
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
  searchRecipes: (query: string) => Promise<void>
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
      loading: false,
      error: null,

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

          const response = await axios.get<PaginatedResponse<Recipe>>('/api/v1/recipes', { params })
          
          set((state) => {
            state.recipes = response.data.items
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
          const response = await axios.get<Recipe>(`/api/v1/recipes/${id}`)
          
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
          const response = await axios.get<Recipe[]>('/api/v1/recipes/my-recipes')
          
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
          const response = await axios.post<Recipe>('/api/v1/recipes', recipeData)
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
          const response = await axios.put<Recipe>(`/api/v1/recipes/${id}`, updates)
          const updatedRecipe = response.data
          
          set((state) => {
            // Update in recipes list
            const index = state.recipes.findIndex(r => r.id === id)
            if (index !== -1) {
              state.recipes[index] = updatedRecipe
            }
            
            // Update in user recipes
            const userIndex = state.userRecipes.findIndex(r => r.id === id)
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
          await axios.delete(`/api/v1/recipes/${id}`)
          
          set((state) => {
            // Remove from recipes list
            state.recipes = state.recipes.filter(r => r.id !== id)
            
            // Remove from user recipes
            state.userRecipes = state.userRecipes.filter(r => r.id !== id)
            
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
          const response = await axios.post<Recipe>(`/api/v1/recipes/${id}/duplicate`)
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

      searchRecipes: async (query) => {
        get().setFilters({ search: query })
        await get().fetchRecipes(1)
      },

      toggleFavorite: async (id) => {
        try {
          await axios.post(`/api/v1/recipes/${id}/favorite`)
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
          await axios.post(`/api/v1/recipes/${id}/rate`, { rating })
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