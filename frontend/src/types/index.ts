// User and Authentication Types
export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  emailVerified: boolean
  role: 'user' | 'admin'
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

// Recipe Types
export interface Recipe {
  id: string
  name: string
  description: string
  instructions: string[]
  prepTime: number
  cookTime: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  imageUrl?: string
  authorId: string
  createdAt: string
  updatedAt: string
  ingredients: RecipeIngredient[]
  categories: Category[]
  tags: Tag[]
  nutrition?: NutritionalInfo
}

export interface RecipeIngredient {
  id: string
  ingredientId: string
  ingredient: Ingredient
  quantity: number
  unit: string
  notes?: string
}

export interface Ingredient {
  id: string
  name: string
  category: string
  defaultUnit: string
  nutrition: NutritionalData
}

export interface NutritionalData {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

export interface NutritionalInfo extends NutritionalData {
  perServing: boolean
}

export interface Category {
  id: string
  name: string
  slug: string
  parentId?: string
}

export interface Tag {
  id: string
  name: string
  slug: string
  usageCount: number
}

// Trip Types
export interface Trip {
  id: string
  name: string
  description?: string
  startDate: string
  endDate: string
  participantCount: number
  status: 'planning' | 'active' | 'completed' | 'cancelled'
  ownerId: string
  createdAt: string
  updatedAt: string
  participants: TripParticipant[]
  days: TripDay[]
}

export interface TripParticipant {
  id: string
  tripId: string
  name: string
  email?: string
  role: 'planner' | 'participant'
  status: 'pending' | 'accepted' | 'declined'
  arrivalDate?: string
  departureDate?: string
  mealCoefficient: number
  snackCoefficient: number
  mealCoefficients?: {
    breakfast: number
    lunch: number
    dinner: number
  }
}

export interface TripDay {
  id: string
  tripId: string
  date: string
  dayNumber: number
  meals: TripMeal[]
}

export interface TripMeal {
  id: string
  dayId: string
  mealSlot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId: string
  recipe: Recipe
  servingsOverride?: number
}

// Shopping List Types
export interface ShoppingList {
  id: string
  tripId: string
  items: ShoppingItem[]
  totalWeight: number
  totalVolume: number
  generatedAt: string
}

export interface ShoppingItem {
  ingredientId: string
  ingredient: Ingredient
  quantity: number
  unit: string
  category: string
  recipeSources: string[]
}

// UI State Types
export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Re-export invitation types
export * from './invitation'

// Re-export participant types
export * from './participants'