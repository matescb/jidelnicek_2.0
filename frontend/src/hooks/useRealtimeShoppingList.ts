import { useEffect } from 'react'
import { useWebSocketEvent } from './useWebSocket'
import { useTripStore } from '@/store/slices/tripStore'
import type { ShoppingListUpdateEvent } from '@/types/websocket'

/**
 * Hook for real-time shopping list updates
 * Automatically syncs shopping list changes via WebSocket
 */
export function useRealtimeShoppingList(tripId: string | undefined) {
  const updateShoppingList = useTripStore((state) => state.setState)

  useWebSocketEvent(
    'shopping-list:update',
    (event) => {
      const { payload } = event
      
      // Only update if it's for the current trip
      if (payload.tripId === tripId) {
        updateShoppingList((state) => ({
          ...state,
          shoppingList: payload.items.map(item => ({
            ingredientId: item.ingredientId,
            name: item.ingredientName,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            recipes: item.recipeSources,
          })),
          shoppingListLoading: false,
        }))
      }
    },
    { tripId, enabled: !!tripId }
  )
}

/**
 * Hook for real-time meal plan updates
 */
export function useRealtimeMealPlan(tripId: string | undefined) {
  const { fetchTrip } = useTripStore()

  // Listen for meal assignment changes
  useWebSocketEvent(
    'meal:assignment-change',
    (event) => {
      const { payload } = event
      
      if (payload.tripId === tripId) {
        // Refetch the trip to get updated meal data
        // This ensures we have the complete recipe information
        fetchTrip(tripId)
      }
    },
    { tripId, enabled: !!tripId }
  )

  // Listen for meal plan updates
  useWebSocketEvent(
    'meal:plan-update',
    (event) => {
      const { payload } = event
      
      if (payload.tripId === tripId) {
        // Refetch the trip to get updated meal data
        fetchTrip(tripId)
      }
    },
    { tripId, enabled: !!tripId }
  )
}

/**
 * Hook for real-time participant updates
 */
export function useRealtimeParticipants(tripId: string | undefined) {
  const updateTrip = useTripStore((state) => state.setState)

  // Listen for participant coefficient changes
  useWebSocketEvent(
    'participant:coefficient-change',
    (event) => {
      const { payload } = event
      
      if (payload.tripId === tripId) {
        updateTrip((state) => {
          if (state.currentTrip?.id === tripId) {
            return {
              ...state,
              currentTrip: {
                ...state.currentTrip,
                participants: state.currentTrip.participants.map(p =>
                  p.id === payload.participantId
                    ? { ...p, mealCoefficients: payload.coefficients }
                    : p
                ),
              },
            }
          }
          return state
        })
      }
    },
    { tripId, enabled: !!tripId }
  )

  // Listen for participant additions
  useWebSocketEvent(
    'participant:added',
    (event) => {
      const { payload } = event
      
      if (payload.tripId === tripId) {
        updateTrip((state) => {
          if (state.currentTrip?.id === tripId) {
            return {
              ...state,
              currentTrip: {
                ...state.currentTrip,
                participants: [...state.currentTrip.participants, payload.participant],
                participantCount: state.currentTrip.participants.length + 1,
              },
            }
          }
          return state
        })
      }
    },
    { tripId, enabled: !!tripId }
  )

  // Listen for participant removals
  useWebSocketEvent(
    'participant:removed',
    (event) => {
      const { payload } = event
      
      if (payload.tripId === tripId) {
        updateTrip((state) => {
          if (state.currentTrip?.id === tripId) {
            return {
              ...state,
              currentTrip: {
                ...state.currentTrip,
                participants: state.currentTrip.participants.filter(
                  p => p.id !== payload.participantId
                ),
                participantCount: state.currentTrip.participants.length - 1,
              },
            }
          }
          return state
        })
      }
    },
    { tripId, enabled: !!tripId }
  )
}

/**
 * Hook for real-time cost and nutrition updates
 */
export function useRealtimeTripMetrics(tripId: string | undefined) {
  const updateTrip = useTripStore((state) => state.setState)

  // Listen for cost calculation updates
  useWebSocketEvent(
    'cost:calculation-update',
    (event) => {
      const { payload } = event
      
      if (payload.tripId === tripId) {
        updateTrip((state) => {
          if (state.currentTrip?.id === tripId) {
            return {
              ...state,
              currentTrip: {
                ...state.currentTrip,
                costData: {
                  totalCost: payload.totalCost,
                  costPerParticipant: payload.costPerParticipant,
                  breakdown: payload.breakdown,
                  participantBreakdown: payload.participantBreakdown,
                  currency: payload.currency,
                  calculatedAt: payload.calculatedAt,
                },
              } as any,
            }
          }
          return state
        })
      }
    },
    { tripId, enabled: !!tripId }
  )

  // Listen for nutrition summary updates
  useWebSocketEvent(
    'nutrition:summary-update',
    (event) => {
      const { payload } = event
      
      if (payload.tripId === tripId) {
        updateTrip((state) => {
          if (state.currentTrip?.id === tripId) {
            return {
              ...state,
              currentTrip: {
                ...state.currentTrip,
                nutritionData: {
                  dailyAverages: payload.dailyAverages,
                  perMealAverages: payload.perMealAverages,
                  warnings: payload.warnings,
                  calculatedAt: payload.calculatedAt,
                },
              } as any,
            }
          }
          return state
        })
      }
    },
    { tripId, enabled: !!tripId }
  )
}

/**
 * Convenience hook that combines all real-time trip updates
 */
export function useRealtimeTripUpdates(tripId: string | undefined) {
  useRealtimeShoppingList(tripId)
  useRealtimeMealPlan(tripId)
  useRealtimeParticipants(tripId)
  useRealtimeTripMetrics(tripId)
}