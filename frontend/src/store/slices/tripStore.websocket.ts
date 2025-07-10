import { websocketService } from '@/services/websocket'
import type {
  ShoppingListUpdateEvent,
  ParticipantCoefficientChangeEvent,
  ParticipantStatusChangeEvent,
  ParticipantAddedEvent,
  ParticipantRemovedEvent,
  MealAssignmentChangeEvent,
  MealPlanUpdateEvent,
  CostCalculationUpdateEvent,
  NutritionSummaryUpdateEvent,
  TripStatusChangeEvent,
} from '@/types/websocket'
import type { TripStore } from './tripStore'

/**
 * Enhances the trip store with WebSocket real-time updates
 * This should be called once when the store is initialized
 */
export function enhanceTripStoreWithWebSocket(store: TripStore): void {
  // Shopping List Updates
  websocketService.on('shopping-list:update', (event) => {
    const { payload } = event
    handleShoppingListUpdate(store, payload)
  })

  // Participant Events
  websocketService.on('participant:coefficient-change', (event) => {
    const { payload } = event
    handleParticipantCoefficientChange(store, payload)
  })

  websocketService.on('participant:status-change', (event) => {
    const { payload } = event
    handleParticipantStatusChange(store, payload)
  })

  websocketService.on('participant:added', (event) => {
    const { payload } = event
    handleParticipantAdded(store, payload)
  })

  websocketService.on('participant:removed', (event) => {
    const { payload } = event
    handleParticipantRemoved(store, payload)
  })

  // Meal Events
  websocketService.on('meal:assignment-change', (event) => {
    const { payload } = event
    handleMealAssignmentChange(store, payload)
  })

  websocketService.on('meal:plan-update', (event) => {
    const { payload } = event
    handleMealPlanUpdate(store, payload)
  })

  // Cost and Nutrition Events
  websocketService.on('cost:calculation-update', (event) => {
    const { payload } = event
    handleCostCalculationUpdate(store, payload)
  })

  websocketService.on('nutrition:summary-update', (event) => {
    const { payload } = event
    handleNutritionSummaryUpdate(store, payload)
  })

  // Trip Status Events
  websocketService.on('trip:status-change', (event) => {
    const { payload } = event
    handleTripStatusChange(store, payload)
  })
}

// Handler Functions

function handleShoppingListUpdate(
  store: TripStore,
  payload: ShoppingListUpdateEvent
): void {
  const state = store.getState()
  
  // Only update if it's for the current trip
  if (state.currentTrip?.id === payload.tripId) {
    store.setState((state) => ({
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
}

function handleParticipantCoefficientChange(
  store: TripStore,
  payload: ParticipantCoefficientChangeEvent
): void {
  const state = store.getState()
  
  // Update in current trip if loaded
  if (state.currentTrip?.id === payload.tripId) {
    store.setState((state) => ({
      ...state,
      currentTrip: {
        ...state.currentTrip!,
        participants: state.currentTrip!.participants.map(p =>
          p.id === payload.participantId
            ? { ...p, mealCoefficients: payload.coefficients }
            : p
        ),
      },
    }))
  }
  
  // Update in trips list if present
  store.setState((state) => ({
    ...state,
    trips: state.trips.map(trip =>
      trip.id === payload.tripId
        ? {
            ...trip,
            participants: trip.participants.map(p =>
              p.id === payload.participantId
                ? { ...p, mealCoefficients: payload.coefficients }
                : p
            ),
          }
        : trip
    ),
  }))
}

function handleParticipantStatusChange(
  store: TripStore,
  payload: ParticipantStatusChangeEvent
): void {
  // This would be handled if participants had status in the current model
  // For now, we might need to refetch the trip data
  const state = store.getState()
  if (state.currentTrip?.id === payload.tripId) {
    store.fetchTrip(payload.tripId)
  }
}

function handleParticipantAdded(
  store: TripStore,
  payload: ParticipantAddedEvent
): void {
  const state = store.getState()
  
  // Add to current trip if loaded
  if (state.currentTrip?.id === payload.tripId) {
    store.setState((state) => ({
      ...state,
      currentTrip: {
        ...state.currentTrip!,
        participants: [...state.currentTrip!.participants, payload.participant],
        participantCount: state.currentTrip!.participants.length + 1,
      },
    }))
  }
  
  // Update in trips list if present
  store.setState((state) => ({
    ...state,
    trips: state.trips.map(trip =>
      trip.id === payload.tripId
        ? {
            ...trip,
            participants: [...trip.participants, payload.participant],
            participantCount: trip.participants.length + 1,
          }
        : trip
    ),
  }))
}

function handleParticipantRemoved(
  store: TripStore,
  payload: ParticipantRemovedEvent
): void {
  const state = store.getState()
  
  // Remove from current trip if loaded
  if (state.currentTrip?.id === payload.tripId) {
    store.setState((state) => ({
      ...state,
      currentTrip: {
        ...state.currentTrip!,
        participants: state.currentTrip!.participants.filter(
          p => p.id !== payload.participantId
        ),
        participantCount: state.currentTrip!.participants.length - 1,
      },
    }))
  }
  
  // Update in trips list if present
  store.setState((state) => ({
    ...state,
    trips: state.trips.map(trip =>
      trip.id === payload.tripId
        ? {
            ...trip,
            participants: trip.participants.filter(
              p => p.id !== payload.participantId
            ),
            participantCount: trip.participants.length - 1,
          }
        : trip
    ),
  }))
}

function handleMealAssignmentChange(
  store: TripStore,
  payload: MealAssignmentChangeEvent
): void {
  const state = store.getState()
  
  // For meal updates, we might need to refetch the trip to get the full recipe data
  if (state.currentTrip?.id === payload.tripId) {
    store.fetchTrip(payload.tripId)
  }
}

function handleMealPlanUpdate(
  store: TripStore,
  payload: MealPlanUpdateEvent
): void {
  const state = store.getState()
  
  // Update the specific day in the current trip
  if (state.currentTrip?.id === payload.tripId) {
    store.setState((state) => ({
      ...state,
      currentTrip: {
        ...state.currentTrip!,
        days: state.currentTrip!.days.map(day =>
          day.id === payload.dayId
            ? {
                ...day,
                meals: payload.meals.map(meal => ({
                  ...meal,
                  // We might need to fetch recipe data
                  recipe: state.currentTrip!.days
                    .find(d => d.id === payload.dayId)
                    ?.meals.find(m => m.id === meal.id)?.recipe || ({} as any),
                })),
              }
            : day
        ),
      },
    }))
    
    // Refetch to get complete recipe data
    store.fetchTrip(payload.tripId)
  }
}

function handleCostCalculationUpdate(
  store: TripStore,
  payload: CostCalculationUpdateEvent
): void {
  const state = store.getState()
  
  // Add cost data to current trip
  if (state.currentTrip?.id === payload.tripId) {
    store.setState((state) => ({
      ...state,
      currentTrip: {
        ...state.currentTrip!,
        // Add cost data as extended properties
        costData: {
          totalCost: payload.totalCost,
          costPerParticipant: payload.costPerParticipant,
          breakdown: payload.breakdown,
          participantBreakdown: payload.participantBreakdown,
          currency: payload.currency,
          calculatedAt: payload.calculatedAt,
        },
      } as any,
    }))
  }
}

function handleNutritionSummaryUpdate(
  store: TripStore,
  payload: NutritionSummaryUpdateEvent
): void {
  const state = store.getState()
  
  // Add nutrition data to current trip
  if (state.currentTrip?.id === payload.tripId) {
    store.setState((state) => ({
      ...state,
      currentTrip: {
        ...state.currentTrip!,
        // Add nutrition data as extended properties
        nutritionData: {
          dailyAverages: payload.dailyAverages,
          perMealAverages: payload.perMealAverages,
          warnings: payload.warnings,
          calculatedAt: payload.calculatedAt,
        },
      } as any,
    }))
  }
}

function handleTripStatusChange(
  store: TripStore,
  payload: TripStatusChangeEvent
): void {
  const state = store.getState()
  
  // Update status in current trip
  if (state.currentTrip?.id === payload.tripId) {
    store.setState((state) => ({
      ...state,
      currentTrip: {
        ...state.currentTrip!,
        status: payload.newStatus,
      },
    }))
  }
  
  // Update in trips list
  store.setState((state) => ({
    ...state,
    trips: state.trips.map(trip =>
      trip.id === payload.tripId
        ? { ...trip, status: payload.newStatus }
        : trip
    ),
  }))
}

/**
 * Helper to subscribe to trip-specific events
 */
export function subscribeTripEvents(tripId: string): void {
  websocketService.joinTrip(tripId)
}

/**
 * Helper to unsubscribe from trip-specific events
 */
export function unsubscribeTripEvents(tripId: string): void {
  websocketService.leaveTrip(tripId)
}