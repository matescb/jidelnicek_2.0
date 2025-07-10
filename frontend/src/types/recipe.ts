export interface Recipe {
  id: string
  name: string
  description?: string
  instructions: RecipeInstruction[]
  ingredients: RecipeIngredient[]
  prepTime?: number
  cookTime?: number
  totalTime?: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  categories?: string[]
  tags?: string[]
  isPublic: boolean
  userId: string
  author?: {
    id: string
    name: string
    avatar?: string
  }
  images?: RecipeImage[]
  imageUrl?: string // Primary image URL
  nutrition?: RecipeNutrition
  ratingAverage: number
  ratingCount: number
  favoriteCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

export interface RecipeInstruction {
  step: number
  text: string
}

export interface RecipeIngredient {
  id?: string
  name: string
  quantity: number
  unit: string
  notes?: string
}

export interface RecipeImage {
  id: string
  url: string
  thumbnailUrl?: string
  alt?: string
  isPrimary: boolean
}

export interface RecipeNutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  sugar?: number
  saturatedFat?: number
  cholesterol?: number
}

export interface RecipeFilters {
  search?: string
  difficulty?: string[]
  categories?: string[]
  tags?: string[]
  minPrepTime?: number
  maxPrepTime?: number
  minCalories?: number
  maxCalories?: number
  isPublic?: boolean
  isFavorite?: boolean
  userId?: string
}

export interface RecipeCreateInput {
  name: string
  description?: string
  instructions: Omit<RecipeInstruction, 'id'>[]
  ingredients: Omit<RecipeIngredient, 'id'>[]
  prepTime?: number
  cookTime?: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  categories?: string[]
  tags?: string[]
  isPublic: boolean
}

export interface RecipeUpdateInput extends Partial<RecipeCreateInput> {
  id: string
}