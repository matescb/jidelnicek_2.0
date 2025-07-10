import { useAuthStore } from './slices/authStore'
import { useRecipeStore } from './slices/recipeStore'
import { useTripStore } from './slices/tripStore'
import { useParticipantStore } from './slices/participantStore'
import { useUIStore } from './slices/uiStore'

// Re-export store hooks for convenience
export { useAuthStore, useRecipeStore, useTripStore, useParticipantStore, useUIStore }

// Selectors for common use cases
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useCurrentUser = () => useAuthStore((state) => state.user)
export const useAuthLoading = () => useAuthStore((state) => state.loading)

export const useCurrentRecipe = () => useRecipeStore((state) => state.currentRecipe)
export const useUserRecipes = () => useRecipeStore((state) => state.userRecipes)
export const useRecipeFilters = () => useRecipeStore((state) => state.filters)

export const useCurrentTrip = () => useTripStore((state) => state.currentTrip)
export const useShoppingList = () => useTripStore((state) => state.shoppingList)
export const useTripFilters = () => useTripStore((state) => state.filters)

export const useParticipantTemplates = () => useParticipantStore((state) => state.templates)
export const useTempParticipants = () => useParticipantStore((state) => state.tempParticipants)

export const useTheme = () => useUIStore((state) => state.theme)
export const useLanguage = () => useUIStore((state) => state.language)
export const useToasts = () => useUIStore((state) => state.toasts)
export const useModals = () => useUIStore((state) => state.modals)
export const usePreferences = () => useUIStore((state) => state.preferences)

// Combined selectors
export const useGlobalLoading = () => {
  const authLoading = useAuthStore((state) => state.loading)
  const recipeLoading = useRecipeStore((state) => state.loading)
  const tripLoading = useTripStore((state) => state.loading)
  const globalLoading = useUIStore((state) => state.globalLoading)
  
  return authLoading || recipeLoading || tripLoading || globalLoading
}

export const useAllErrors = () => {
  const authError = useAuthStore((state) => state.error)
  const recipeError = useRecipeStore((state) => state.error)
  const tripError = useTripStore((state) => state.error)
  const uiError = useUIStore((state) => state.error)
  
  return [
    authError && { source: 'auth', error: authError },
    recipeError && { source: 'recipe', error: recipeError },
    tripError && { source: 'trip', error: tripError },
    uiError && { source: 'ui', error: uiError }
  ].filter(Boolean)
}