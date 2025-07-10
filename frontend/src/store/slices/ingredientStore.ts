import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { apiClient } from '@/api/client'
import type { BaseStore, PaginatedResponse } from '../types'
import type { Ingredient, NutritionalData } from '@/types'

// Extended ingredient type with additional store fields
export interface IngredientWithDetails extends Ingredient {
  usageCount?: number
  price?: number
  priceUnit?: string
  allergens?: string[]
  dietaryTags?: string[]
  lastUsed?: string
  createdAt?: string
  updatedAt?: string
}

export interface IngredientFilters {
  search?: string
  category?: string[]
  allergens?: string[]
  dietaryTags?: string[]
  minUsageCount?: number
  maxUsageCount?: number
  hasPrice?: boolean
  sortBy?: 'name' | 'category' | 'usageCount' | 'lastUsed' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface IngredientStore extends BaseStore {
  // State
  ingredients: IngredientWithDetails[]
  currentIngredient: IngredientWithDetails | null
  totalIngredients: number
  currentPage: number
  pageSize: number
  filters: IngredientFilters
  sortBy: 'name' | 'category' | 'usageCount' | 'lastUsed' | 'createdAt'
  sortOrder: 'asc' | 'desc'
  
  // Categories cache
  categories: string[]
  categoriesLoaded: boolean
  
  // Allergens and dietary tags cache
  allergens: string[]
  dietaryTags: string[]
  
  // Duplicate detection
  potentialDuplicates: Map<string, string[]>

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
  fetchIngredients: (page?: number) => Promise<void>
  fetchIngredient: (id: string) => Promise<void>
  fetchCategories: () => Promise<void>
  fetchAllergens: () => Promise<void>
  fetchDietaryTags: () => Promise<void>
  createIngredient: (ingredient: Partial<IngredientWithDetails>) => Promise<IngredientWithDetails>
  updateIngredient: (id: string, updates: Partial<IngredientWithDetails>) => Promise<void>
  deleteIngredient: (id: string) => Promise<void>
  mergeIngredients: (sourceId: string, targetId: string) => Promise<void>
  
  // Filter and sort actions
  setFilters: (filters: IngredientFilters) => void
  clearFilters: () => void
  setSorting: (sortBy: IngredientStore['sortBy'], sortOrder?: IngredientStore['sortOrder']) => void
  setPageSize: (size: number) => void
  
  // Import/Export actions
  importIngredients: (file: File) => Promise<{ imported: number; errors: string[] }>
  exportIngredients: (format: 'csv' | 'json', filtered?: boolean) => Promise<void>
  
  // Utility actions
  searchIngredients: (query: string) => Promise<void>
  findDuplicates: () => Promise<void>
  updateNutrition: (id: string, nutrition: NutritionalData) => Promise<void>
  updatePrice: (id: string, price: number, priceUnit: string) => Promise<void>
}

export const useIngredientStore = create<IngredientStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ingredients: [],
      currentIngredient: null,
      totalIngredients: 0,
      currentPage: 1,
      pageSize: 50,
      filters: {},
      sortBy: 'name',
      sortOrder: 'asc',
      categories: [],
      categoriesLoaded: false,
      allergens: [],
      dietaryTags: [],
      potentialDuplicates: new Map(),
      loading: false,
      error: null,

      // Computed properties
      get pagination() {
        const { currentPage, pageSize, totalIngredients } = get()
        const totalPages = Math.ceil(totalIngredients / pageSize)
        return {
          currentPage,
          pageSize,
          totalPages,
          totalItems: totalIngredients,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1
        }
      },

      // Actions
      clearError: () => set((state) => {
        state.error = null
      }),

      fetchIngredients: async (page = 1) => {
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

          const response = await apiClient.get<PaginatedResponse<IngredientWithDetails>>('/ingredients', { params })
          
          set((state) => {
            state.ingredients = response.data.items
            state.totalIngredients = response.data.total
            state.currentPage = response.data.page
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to fetch ingredients'
          })
        }
      },

      fetchIngredient: async (id) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await apiClient.get<IngredientWithDetails>(`/ingredients/${id}`)
          
          set((state) => {
            state.currentIngredient = response.data
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to fetch ingredient'
          })
        }
      },

      fetchCategories: async () => {
        if (get().categoriesLoaded) return

        try {
          const response = await apiClient.get<string[]>('/ingredients/categories')
          
          set((state) => {
            state.categories = response.data
            state.categoriesLoaded = true
          })
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to fetch categories'
          })
        }
      },

      fetchAllergens: async () => {
        try {
          const response = await apiClient.get<string[]>('/ingredients/allergens')
          
          set((state) => {
            state.allergens = response.data
          })
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to fetch allergens'
          })
        }
      },

      fetchDietaryTags: async () => {
        try {
          const response = await apiClient.get<string[]>('/ingredients/dietary-tags')
          
          set((state) => {
            state.dietaryTags = response.data
          })
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to fetch dietary tags'
          })
        }
      },

      createIngredient: async (ingredientData) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await apiClient.post<IngredientWithDetails>('/ingredients', ingredientData)
          const newIngredient = response.data
          
          set((state) => {
            state.ingredients = [newIngredient, ...state.ingredients]
            state.totalIngredients += 1
            state.loading = false
          })

          return newIngredient
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to create ingredient'
          })
          throw error
        }
      },

      updateIngredient: async (id, updates) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await apiClient.put<IngredientWithDetails>(`/ingredients/${id}`, updates)
          const updatedIngredient = response.data
          
          set((state) => {
            const index = state.ingredients.findIndex(i => i.id === id)
            if (index !== -1) {
              state.ingredients[index] = updatedIngredient
            }
            
            if (state.currentIngredient?.id === id) {
              state.currentIngredient = updatedIngredient
            }
            
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to update ingredient'
          })
          throw error
        }
      },

      deleteIngredient: async (id) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          await apiClient.delete(`/ingredients/${id}`)
          
          set((state) => {
            state.ingredients = state.ingredients.filter(i => i.id !== id)
            
            if (state.currentIngredient?.id === id) {
              state.currentIngredient = null
            }
            
            state.totalIngredients = Math.max(0, state.totalIngredients - 1)
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to delete ingredient'
          })
          throw error
        }
      },

      mergeIngredients: async (sourceId, targetId) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          await apiClient.post(`/ingredients/${targetId}/merge`, { sourceId })
          
          set((state) => {
            // Remove source ingredient
            state.ingredients = state.ingredients.filter(i => i.id !== sourceId)
            state.totalIngredients = Math.max(0, state.totalIngredients - 1)
            
            // Remove from duplicates map
            state.potentialDuplicates.delete(sourceId)
            
            state.loading = false
          })
          
          // Refresh target ingredient to get updated usage count
          await get().fetchIngredient(targetId)
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to merge ingredients'
          })
          throw error
        }
      },

      setFilters: (filters) => {
        set((state) => {
          state.filters = { ...state.filters, ...filters }
          state.currentPage = 1
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
              state.sortOrder = sortBy === 'name' ? 'asc' : 'desc'
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

      importIngredients: async (file) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const formData = new FormData()
          formData.append('file', file)

          const response = await apiClient.post<{ imported: number; errors: string[] }>(
            '/ingredients/import',
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            }
          )
          
          set((state) => {
            state.loading = false
          })
          
          // Refresh ingredients list
          await get().fetchIngredients()
          
          return response.data
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to import ingredients'
          })
          throw error
        }
      },

      exportIngredients: async (format, filtered = false) => {
        try {
          const params = filtered ? { ...get().filters, format } : { format }
          
          const response = await apiClient.get('/ingredients/export', {
            params,
            responseType: 'blob'
          })
          
          // Create download link
          const blob = new Blob([response.data], {
            type: format === 'csv' ? 'text/csv' : 'application/json'
          })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `ingredients-${new Date().toISOString().split('T')[0]}.${format}`
          a.click()
          URL.revokeObjectURL(url)
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to export ingredients'
          })
          throw error
        }
      },

      searchIngredients: async (query) => {
        get().setFilters({ search: query })
        await get().fetchIngredients()
      },

      findDuplicates: async () => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await apiClient.get<Record<string, string[]>>('/ingredients/duplicates')
          
          set((state) => {
            state.potentialDuplicates = new Map(Object.entries(response.data))
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to find duplicates'
          })
        }
      },

      updateNutrition: async (id, nutrition) => {
        await get().updateIngredient(id, { nutrition })
      },

      updatePrice: async (id, price, priceUnit) => {
        await get().updateIngredient(id, { price, priceUnit })
      }
    })),
    {
      name: 'IngredientStore'
    }
  )
)