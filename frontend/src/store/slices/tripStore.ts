import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import axios from 'axios'
import type { BaseStore, PaginatedResponse, WithId, Timestamps } from '../types'
import type { Recipe } from '@/types/recipe'
import { participantsApi } from '@/services/participants'
import type { Participant as ApiParticipant, CreateParticipantRequest, UpdateParticipantRequest } from '@/services/participants'

// Trip related types
export interface Participant {
  id: string
  name: string
  email?: string
  arrivalDate?: string
  departureDate?: string
  mealCoefficients: {
    breakfast: number
    lunch: number
    dinner: number
  }
}

export interface MealSlot {
  id: string
  dayNumber: number
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  isActive: boolean
  customName?: string
  displayOrder: number
}

export interface Meal {
  id: string
  dayId: string
  mealSlot: string
  recipe: Recipe
  servingsOverride?: number
  notes?: string
}

export interface DayPlan {
  id: string
  dayNumber: number
  date: string
  meals: Meal[]
  participantCount: number
  notes?: string
}

export interface Trip extends WithId, Timestamps {
  name: string
  description?: string
  startDate: string
  endDate: string
  participantCount: number
  status: 'planning' | 'active' | 'completed'
  mealSlotConfiguration: MealSlot[]
  participants: Participant[]
  days: DayPlan[]
  shareLink?: string
  userId: string
  location?: string
  isArchived?: boolean
}

export interface TripFilters {
  search?: string
  status?: string[]
  startDateFrom?: string
  startDateTo?: string
  participantCountMin?: number
  participantCountMax?: number
}

export interface ShoppingListItem {
  ingredientId: string
  name: string
  quantity: number
  unit: string
  category?: string
  recipes: string[] // Recipe names that use this ingredient
}

export interface TripStore extends BaseStore {
  // State
  trips: Trip[]
  currentTrip: Trip | null
  totalTrips: number
  currentPage: number
  pageSize: number
  filters: TripFilters
  sortBy: 'name' | 'startDate' | 'createdAt' | 'participantCount'
  sortOrder: 'asc' | 'desc'
  
  // Shopping list state
  shoppingList: ShoppingListItem[]
  shoppingListLoading: boolean
  
  // Participant operation states
  participantLoading: boolean
  participantError: string | null

  // Actions
  fetchTrips: (page?: number) => Promise<void>
  fetchTrip: (id: string | number) => Promise<void>
  createTrip: (trip: Partial<Trip>) => Promise<Trip>
  updateTrip: (id: string | number, updates: Partial<Trip>) => Promise<void>
  deleteTrip: (id: string | number) => Promise<void>
  duplicateTrip: (id: string | number) => Promise<Trip>
  clearParticipantError: () => void
  
  // Participant actions
  addParticipant: (tripId: string | number, participant: Partial<Participant>) => Promise<void>
  updateParticipant: (tripId: string | number, participantId: string, updates: Partial<Participant>) => Promise<void>
  removeParticipant: (tripId: string | number, participantId: string) => Promise<void>
  fetchParticipantsForDay: (tripId: string | number, dayNumber: number) => Promise<any>
  
  // Meal actions
  assignMeal: (tripId: string | number, dayId: string, mealSlot: string, recipeId: string | number) => Promise<void>
  updateMeal: (tripId: string | number, dayId: string, mealId: string, updates: Partial<Meal>) => Promise<void>
  removeMeal: (tripId: string | number, dayId: string, mealId: string) => Promise<void>
  swapMeals: (tripId: string | number, meal1Id: string, meal2Id: string) => Promise<void>
  
  // Shopping list actions
  generateShoppingList: (tripId: string | number) => Promise<void>
  updateShoppingItem: (itemId: string, updates: Partial<ShoppingListItem>) => void
  addCustomItem: (item: Partial<ShoppingListItem>) => void
  removeShoppingItem: (itemId: string) => void
  
  // Filter and sort actions
  setFilters: (filters: TripFilters) => void
  clearFilters: () => void
  setSorting: (sortBy: TripStore['sortBy'], sortOrder?: TripStore['sortOrder']) => void
  setPageSize: (size: number) => void
  
  // Utility actions
  shareTrip: (id: string | number) => Promise<string>
  calculateNutrition: (tripId: string | number, dayId?: string) => Promise<any>
}

export const useTripStore = create<TripStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
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

      // Actions
      clearError: () => set((state) => {
        state.error = null
      }),
      
      clearParticipantError: () => set((state) => {
        state.participantError = null
      }),

      fetchTrips: async (page = 1) => {
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

          const response = await axios.get<PaginatedResponse<Trip>>('/api/v1/trips', { params })
          
          // Ensure each trip has participants array initialized
          const trips = response.data.items.map(trip => ({
            ...trip,
            participants: trip.participants || []
          }))
          
          set((state) => {
            state.trips = trips
            state.totalTrips = response.data.total
            state.currentPage = response.data.page
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to fetch trips'
          })
        }
      },

      fetchTrip: async (id) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await axios.get<Trip>(`/api/v1/trips/${id}`)
          const trip = response.data
          
          // If trip doesn't have participants loaded, fetch them
          if (!trip.participants || trip.participants.length === 0) {
            const participantsResult = await participantsApi.listParticipants(Number(id))
            if (participantsResult.data) {
              // Convert API participants to store format
              trip.participants = participantsResult.data.map(p => ({
                id: String(p.id),
                name: p.name,
                email: p.email,
                mealCoefficients: {
                  breakfast: 1,
                  lunch: 1,
                  dinner: 1
                }
              }))
            }
          }
          
          set((state) => {
            state.currentTrip = trip
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to fetch trip'
          })
        }
      },

      createTrip: async (tripData) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await axios.post<Trip>('/api/v1/trips', tripData)
          const newTrip = response.data
          
          set((state) => {
            state.trips = [newTrip, ...state.trips]
            state.totalTrips += 1
            state.loading = false
          })

          return newTrip
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to create trip'
          })
          throw error
        }
      },

      updateTrip: async (id, updates) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await axios.put<Trip>(`/api/v1/trips/${id}`, updates)
          const updatedTrip = response.data
          
          set((state) => {
            const index = state.trips.findIndex((t: Trip) => t.id === id)
            if (index !== -1) {
              state.trips[index] = updatedTrip
            }
            
            if (state.currentTrip?.id === id) {
              state.currentTrip = updatedTrip
            }
            
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to update trip'
          })
          throw error
        }
      },

      deleteTrip: async (id) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          await axios.delete(`/api/v1/trips/${id}`)
          
          set((state) => {
            state.trips = state.trips.filter((t: Trip) => t.id !== id)
            
            if (state.currentTrip?.id === id) {
              state.currentTrip = null
            }
            
            state.totalTrips = Math.max(0, state.totalTrips - 1)
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to delete trip'
          })
          throw error
        }
      },

      duplicateTrip: async (id) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await axios.post<Trip>(`/api/v1/trips/${id}/duplicate`)
          const duplicatedTrip = response.data
          
          set((state) => {
            state.trips = [duplicatedTrip, ...state.trips]
            state.totalTrips += 1
            state.loading = false
          })

          return duplicatedTrip
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to duplicate trip'
          })
          throw error
        }
      },

      // Participant actions
      addParticipant: async (tripId, participant) => {
        set((state) => {
          state.participantLoading = true
          state.participantError = null
        })
        
        try {
          // Convert store participant format to API format
          const createRequest: CreateParticipantRequest = {
            name: participant.name || '',
            email: participant.email
          }
          
          const result = await participantsApi.addParticipant(Number(tripId), createRequest)
          
          if (result.error) {
            set((state) => {
              state.participantError = result.error
              state.participantLoading = false
            })
            throw new Error(result.error)
          }
          
          // Optimistic update if we have a current trip
          if (get().currentTrip?.id === tripId && result.data) {
            set((state) => {
              if (state.currentTrip) {
                const newParticipant: Participant = {
                  id: String(result.data!.id),
                  name: result.data!.name,
                  email: result.data!.email,
                  arrivalDate: participant.arrivalDate,
                  departureDate: participant.departureDate,
                  mealCoefficients: participant.mealCoefficients || {
                    breakfast: 1,
                    lunch: 1,
                    dinner: 1
                  }
                }
                state.currentTrip.participants.push(newParticipant)
                state.currentTrip.participantCount = state.currentTrip.participants.length
              }
              state.participantLoading = false
            })
          } else {
            // Refetch trip to get updated data
            set((state) => {
              state.participantLoading = false
            })
            await get().fetchTrip(tripId)
          }
        } catch (error: any) {
          set((state) => {
            state.participantError = error.message || 'Failed to add participant'
            state.participantLoading = false
          })
          throw error
        }
      },

      updateParticipant: async (tripId, participantId, updates) => {
        set((state) => {
          state.participantLoading = true
          state.participantError = null
        })
        
        try {
          // Convert store participant format to API format
          const updateRequest: UpdateParticipantRequest = {
            name: updates.name,
            email: updates.email
          }
          
          const result = await participantsApi.updateParticipant(
            Number(tripId), 
            Number(participantId), 
            updateRequest
          )
          
          if (result.error) {
            set((state) => {
              state.participantError = result.error
              state.participantLoading = false
            })
            throw new Error(result.error)
          }
          
          // Optimistic update if we have a current trip
          if (get().currentTrip?.id === tripId) {
            set((state) => {
              if (state.currentTrip) {
                const index = state.currentTrip.participants.findIndex(
                  p => p.id === participantId
                )
                if (index !== -1) {
                  state.currentTrip.participants[index] = {
                    ...state.currentTrip.participants[index],
                    ...updates
                  }
                }
              }
              state.participantLoading = false
            })
          } else {
            // Refetch trip to get updated data
            set((state) => {
              state.participantLoading = false
            })
            await get().fetchTrip(tripId)
          }
        } catch (error: any) {
          set((state) => {
            state.participantError = error.message || 'Failed to update participant'
            state.participantLoading = false
          })
          throw error
        }
      },

      removeParticipant: async (tripId, participantId) => {
        set((state) => {
          state.participantLoading = true
          state.participantError = null
        })
        
        try {
          const result = await participantsApi.removeParticipant(
            Number(tripId),
            Number(participantId)
          )
          
          if (result.error) {
            set((state) => {
              state.participantError = result.error
              state.participantLoading = false
            })
            throw new Error(result.error)
          }
          
          // Optimistic update if we have a current trip
          if (get().currentTrip?.id === tripId) {
            set((state) => {
              if (state.currentTrip) {
                state.currentTrip.participants = state.currentTrip.participants.filter(
                  p => p.id !== participantId
                )
                state.currentTrip.participantCount = state.currentTrip.participants.length
              }
              state.participantLoading = false
            })
          } else {
            // Refetch trip to get updated data
            set((state) => {
              state.participantLoading = false
            })
            await get().fetchTrip(tripId)
          }
        } catch (error: any) {
          set((state) => {
            state.participantError = error.message || 'Failed to remove participant'
            state.participantLoading = false
          })
          throw error
        }
      },
      
      fetchParticipantsForDay: async (tripId, dayNumber) => {
        set((state) => {
          state.participantLoading = true
          state.participantError = null
        })
        
        try {
          const result = await participantsApi.getParticipantsForDay(
            Number(tripId),
            dayNumber
          )
          
          if (result.error) {
            set((state) => {
              state.participantError = result.error
              state.participantLoading = false
            })
            throw new Error(result.error)
          }
          
          // The participants for a specific day would be handled by the component
          // that calls this method, as we don't store day-specific participant data
          // in the trip store state
          set((state) => {
            state.participantLoading = false
          })
          
          return result.data
        } catch (error: any) {
          set((state) => {
            state.participantError = error.message || 'Failed to fetch participants for day'
            state.participantLoading = false
          })
          throw error
        }
      },

      // Meal actions
      assignMeal: async (tripId, dayId, mealSlot, recipeId) => {
        try {
          await axios.post(`/api/v1/trips/${tripId}/days/${dayId}/meals`, {
            mealSlot,
            recipeId
          })
          // Refetch trip to get updated data
          await get().fetchTrip(tripId)
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to assign meal'
          })
          throw error
        }
      },

      updateMeal: async (tripId, dayId, mealId, updates) => {
        try {
          await axios.put(`/api/v1/trips/${tripId}/days/${dayId}/meals/${mealId}`, updates)
          // Refetch trip to get updated data
          await get().fetchTrip(tripId)
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to update meal'
          })
          throw error
        }
      },

      removeMeal: async (tripId, dayId, mealId) => {
        try {
          await axios.delete(`/api/v1/trips/${tripId}/days/${dayId}/meals/${mealId}`)
          // Refetch trip to get updated data
          await get().fetchTrip(tripId)
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to remove meal'
          })
          throw error
        }
      },

      swapMeals: async (tripId, meal1Id, meal2Id) => {
        try {
          await axios.post(`/api/v1/trips/${tripId}/meals/swap`, {
            meal1Id,
            meal2Id
          })
          // Refetch trip to get updated data
          await get().fetchTrip(tripId)
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to swap meals'
          })
          throw error
        }
      },

      // Shopping list actions
      generateShoppingList: async (tripId) => {
        set((state) => {
          state.shoppingListLoading = true
          state.error = null
        })

        try {
          const response = await axios.get<ShoppingListItem[]>(`/api/v1/trips/${tripId}/shopping-list`)
          
          set((state) => {
            state.shoppingList = response.data
            state.shoppingListLoading = false
          })
        } catch (error: any) {
          set((state) => {
            state.shoppingListLoading = false
            state.error = error.response?.data?.message || 'Failed to generate shopping list'
          })
        }
      },

      updateShoppingItem: (itemId, updates) => {
        set((state) => {
          const index = state.shoppingList.findIndex((item: ShoppingListItem) => item.ingredientId === itemId)
          if (index !== -1) {
            state.shoppingList[index] = { ...state.shoppingList[index], ...updates }
          }
        })
      },

      addCustomItem: (item) => {
        set((state) => {
          const newItem: ShoppingListItem = {
            ingredientId: `custom-${Date.now()}`,
            name: item.name || 'Custom Item',
            quantity: item.quantity || 1,
            unit: item.unit || 'piece',
            category: item.category,
            recipes: []
          }
          state.shoppingList.push(newItem)
        })
      },

      removeShoppingItem: (itemId) => {
        set((state) => {
          state.shoppingList = state.shoppingList.filter((item: ShoppingListItem) => item.ingredientId !== itemId)
        })
      },

      // Filter and sort actions
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

      // Utility actions
      shareTrip: async (id) => {
        try {
          const response = await axios.post<{ shareLink: string }>(`/api/v1/trips/${id}/share`)
          const { shareLink } = response.data
          
          // Update trip with share link
          set((state) => {
            const index = state.trips.findIndex((t: Trip) => t.id === id)
            if (index !== -1) {
              state.trips[index].shareLink = shareLink
            }
            
            if (state.currentTrip?.id === id) {
              state.currentTrip.shareLink = shareLink
            }
          })

          return shareLink
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to generate share link'
          })
          throw error
        }
      },

      calculateNutrition: async (tripId, dayId) => {
        try {
          const url = dayId 
            ? `/api/v1/trips/${tripId}/days/${dayId}/nutrition`
            : `/api/v1/trips/${tripId}/nutrition`
          
          const response = await axios.get(url)
          return response.data
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.message || 'Failed to calculate nutrition'
          })
          throw error
        }
      }
    })),
    {
      name: 'TripStore'
    }
  )
)