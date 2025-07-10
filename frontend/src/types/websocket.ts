// WebSocket Event Types

// Base event structure
export interface WebSocketEvent<T = unknown> {
  type: string
  payload: T
  timestamp: string
  correlationId?: string
}

// Shopping List Events
export interface ShoppingListUpdateEvent {
  tripId: string
  items: ShoppingListItem[]
  totalWeight: number
  totalVolume: number
  generatedAt: string
}

export interface ShoppingListItem {
  ingredientId: string
  ingredientName: string
  quantity: number
  unit: string
  category: string
  recipeSources: string[]
}

// Participant Events
export interface ParticipantCoefficientChangeEvent {
  tripId: string
  participantId: string
  coefficients: {
    breakfast: number
    lunch: number
    dinner: number
  }
  effectiveDate?: string
}

export interface ParticipantStatusChangeEvent {
  tripId: string
  participantId: string
  status: 'pending' | 'accepted' | 'declined'
  updatedBy: string
}

export interface ParticipantAddedEvent {
  tripId: string
  participant: {
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
}

export interface ParticipantRemovedEvent {
  tripId: string
  participantId: string
  removedBy: string
}

// Meal Assignment Events
export interface MealAssignmentChangeEvent {
  tripId: string
  dayId: string
  mealSlot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId: string | null
  servingsOverride?: number
  assignedBy: string
}

export interface MealPlanUpdateEvent {
  tripId: string
  dayId: string
  dayNumber: number
  date: string
  meals: Array<{
    id: string
    mealSlot: string
    recipeId: string
    servingsOverride?: number
  }>
}

// Cost Calculation Events
export interface CostCalculationUpdateEvent {
  tripId: string
  totalCost: number
  costPerParticipant: number
  breakdown: {
    ingredients: number
    overhead: number
    tax: number
  }
  participantBreakdown: Array<{
    participantId: string
    participantName: string
    cost: number
    mealCount: number
  }>
  currency: string
  calculatedAt: string
}

// Nutrition Summary Events
export interface NutritionSummaryUpdateEvent {
  tripId: string
  dailyAverages: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sodium: number
  }
  perMealAverages: {
    breakfast: NutritionData
    lunch: NutritionData
    dinner: NutritionData
    snack?: NutritionData
  }
  warnings: string[]
  calculatedAt: string
}

export interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

// Trip Status Events
export interface TripStatusChangeEvent {
  tripId: string
  oldStatus: 'planning' | 'active' | 'completed' | 'cancelled'
  newStatus: 'planning' | 'active' | 'completed' | 'cancelled'
  changedBy: string
}

// Real-time Collaboration Events
export interface UserPresenceEvent {
  tripId: string
  userId: string
  userName: string
  action: 'joined' | 'left' | 'active' | 'idle'
  currentView?: string
}

export interface UserEditingEvent {
  tripId: string
  userId: string
  userName: string
  editingResource: {
    type: 'meal' | 'participant' | 'settings'
    id: string
  } | null
}

// WebSocket Connection Events
export interface ConnectionEvent {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  error?: string
  reconnectAttempt?: number
  nextRetryIn?: number
}

// Event Type Map
export type WebSocketEventMap = {
  'shopping-list:update': WebSocketEvent<ShoppingListUpdateEvent>
  'participant:coefficient-change': WebSocketEvent<ParticipantCoefficientChangeEvent>
  'participant:status-change': WebSocketEvent<ParticipantStatusChangeEvent>
  'participant:added': WebSocketEvent<ParticipantAddedEvent>
  'participant:removed': WebSocketEvent<ParticipantRemovedEvent>
  'meal:assignment-change': WebSocketEvent<MealAssignmentChangeEvent>
  'meal:plan-update': WebSocketEvent<MealPlanUpdateEvent>
  'cost:calculation-update': WebSocketEvent<CostCalculationUpdateEvent>
  'nutrition:summary-update': WebSocketEvent<NutritionSummaryUpdateEvent>
  'trip:status-change': WebSocketEvent<TripStatusChangeEvent>
  'user:presence': WebSocketEvent<UserPresenceEvent>
  'user:editing': WebSocketEvent<UserEditingEvent>
  'connection:status': ConnectionEvent
}

// Event Names
export type WebSocketEventName = keyof WebSocketEventMap

// Subscription Options
export interface SubscriptionOptions {
  tripId?: string
  userId?: string
  autoReconnect?: boolean
  reconnectDelay?: number
  maxReconnectAttempts?: number
}

// WebSocket Client Configuration
export interface WebSocketConfig {
  url: string
  path?: string
  transports?: string[]
  autoConnect?: boolean
  reconnection?: boolean
  reconnectionAttempts?: number
  reconnectionDelay?: number
  reconnectionDelayMax?: number
  timeout?: number
  auth?: {
    token: string
  }
}