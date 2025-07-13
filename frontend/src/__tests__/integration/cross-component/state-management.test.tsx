import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../setup/testProviders'
import { simulateAuthentication, createMockWebSocket } from '../setup/testSetup'

// Import components for testing
import App from '@/App'
import { RecipeForm } from '@/components/recipes/RecipeForm'
import { TripPlanningBoard } from '@/components/trips/MealPlanningBoard'
import { ShoppingListView } from '@/components/trips/ShoppingListView'
import { ParticipantManager } from '@/components/trips/ParticipantManager'

// Import stores for testing
import { useAuthStore } from '@/store/slices/authStore'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useTripStore } from '@/store/slices/tripStore'
import { useToastStore } from '@/store/slices/toastStore'

describe('Cross-Component State Management Integration', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    // Reset all store states
    useAuthStore.getState().logout()
    useRecipeStore.getState().clearRecipes()
    useTripStore.getState().clearTrips()
    useToastStore.getState().clearToasts()
  })

  describe('Recipe Creation to Trip Integration Flow', () => {
    it('should sync recipe creation across all consuming components', async () => {
      simulateAuthentication()
      
      const { queryClient } = renderWithProviders(
        <div>
          <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
          <TripPlanningBoard tripId="test-trip" />
        </div>,
        {
          providerOptions: {
            useMemoryRouter: true,
          }
        }
      )

      // Step 1: Create a new recipe
      await user.type(screen.getByLabelText(/recipe name/i), 'Integration Test Recipe')
      await user.type(screen.getByLabelText(/description/i), 'A recipe for testing integration')
      await user.type(screen.getByLabelText(/prep time/i), '20')
      await user.type(screen.getByLabelText(/servings/i), '4')

      // Add ingredient
      const addIngredientButton = screen.getByRole('button', { name: /add ingredient/i })
      await user.click(addIngredientButton)
      
      await user.type(screen.getByLabelText(/ingredient name/i), 'Test Ingredient')
      await user.type(screen.getByLabelText(/amount/i), '200')
      await user.selectOptions(screen.getByLabelText(/unit/i), 'g')

      // Save recipe
      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveButton)

      // Wait for recipe to be saved to store
      await waitFor(() => {
        const recipes = useRecipeStore.getState().recipes
        expect(recipes).toHaveLength(1)
        expect(recipes[0].name).toBe('Integration Test Recipe')
      })

      // Step 2: Verify recipe appears in trip planning component
      const tripPlanningBoard = screen.getByTestId('trip-planning-board')
      const addRecipeButton = within(tripPlanningBoard).getByRole('button', { name: /add recipe/i })
      await user.click(addRecipeButton)

      // Recipe should be available in the selection dropdown
      await waitFor(() => {
        expect(screen.getByText('Integration Test Recipe')).toBeInTheDocument()
      })

      // Step 3: Add recipe to meal plan
      const recipeOption = screen.getByText('Integration Test Recipe')
      await user.click(recipeOption)

      const assignToMealButton = screen.getByRole('button', { name: /assign to meal/i })
      await user.click(assignToMealButton)

      // Verify recipe is added to trip store
      await waitFor(() => {
        const trips = useTripStore.getState().trips
        const currentTrip = trips.find(t => t.id === 'test-trip')
        expect(currentTrip?.meals).toContainEqual(
          expect.objectContaining({
            recipeId: expect.any(String),
            recipeName: 'Integration Test Recipe'
          })
        )
      })

      // Step 4: Verify cross-store data consistency
      const recipeStore = useRecipeStore.getState()
      const tripStore = useTripStore.getState()
      
      expect(recipeStore.recipes).toHaveLength(1)
      expect(tripStore.trips[0].meals).toHaveLength(1)
      
      // Verify the recipe data is consistent across stores
      const recipe = recipeStore.recipes[0]
      const meal = tripStore.trips[0].meals[0]
      expect(meal.recipeId).toBe(recipe.id)
      expect(meal.servings).toBe(recipe.servings)
    })

    it('should handle recipe updates and propagate changes', async () => {
      simulateAuthentication()
      
      // Pre-populate with a recipe
      const initialRecipe = {
        id: 'recipe-1',
        name: 'Original Recipe',
        description: 'Original description',
        servings: 4,
        ingredients: [{ id: 'ing-1', name: 'Original Ingredient', amount: 100, unit: 'g' }]
      }
      
      useRecipeStore.setState({
        recipes: [initialRecipe],
        selectedRecipe: initialRecipe
      })

      renderWithProviders(
        <div>
          <RecipeForm 
            recipeId="recipe-1" 
            onSuccess={() => {}} 
            onCancel={() => {}} 
          />
          <TripPlanningBoard tripId="test-trip" />
          <ShoppingListView tripId="test-trip" />
        </div>
      )

      // Step 1: Update recipe
      const nameInput = screen.getByDisplayValue('Original Recipe')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Recipe')

      const servingsInput = screen.getByDisplayValue('4')
      await user.clear(servingsInput)
      await user.type(servingsInput, '6')

      // Update ingredient
      const ingredientNameInput = screen.getByDisplayValue('Original Ingredient')
      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Updated Ingredient')

      const amountInput = screen.getByDisplayValue('100')
      await user.clear(amountInput)
      await user.type(amountInput, '150')

      // Save changes
      const updateButton = screen.getByRole('button', { name: /update recipe/i })
      await user.click(updateButton)

      // Step 2: Verify updates propagate to all consuming components
      await waitFor(() => {
        const updatedRecipe = useRecipeStore.getState().recipes[0]
        expect(updatedRecipe.name).toBe('Updated Recipe')
        expect(updatedRecipe.servings).toBe(6)
        expect(updatedRecipe.ingredients[0].name).toBe('Updated Ingredient')
        expect(updatedRecipe.ingredients[0].amount).toBe(150)
      })

      // Step 3: Verify meal planning reflects changes
      const mealPlanningBoard = screen.getByTestId('trip-planning-board')
      
      await waitFor(() => {
        expect(within(mealPlanningBoard).getByText('Updated Recipe')).toBeInTheDocument()
      })

      // Step 4: Verify shopping list reflects ingredient changes
      const shoppingList = screen.getByTestId('shopping-list')
      
      await waitFor(() => {
        expect(within(shoppingList).getByText('Updated Ingredient')).toBeInTheDocument()
        expect(within(shoppingList).getByText('150 g')).toBeInTheDocument()
      })
    })
  })

  describe('Trip Collaboration State Synchronization', () => {
    it('should handle real-time participant updates across components', async () => {
      simulateAuthentication()
      const mockWS = createMockWebSocket()

      renderWithProviders(
        <div>
          <ParticipantManager tripId="test-trip" />
          <TripPlanningBoard tripId="test-trip" />
        </div>,
        {
          providerOptions: {
            enableWebSocket: true,
          }
        }
      )

      // Step 1: Add participant locally
      const addParticipantButton = screen.getByRole('button', { name: /add participant/i })
      await user.click(addParticipantButton)

      await user.type(screen.getByLabelText(/email/i), 'newparticipant@example.com')
      await user.selectOptions(screen.getByLabelText(/role/i), 'participant')

      const inviteButton = screen.getByRole('button', { name: /send invite/i })
      await user.click(inviteButton)

      // Step 2: Verify local state update
      await waitFor(() => {
        const tripState = useTripStore.getState()
        const currentTrip = tripState.trips.find(t => t.id === 'test-trip')
        expect(currentTrip?.participants).toContainEqual(
          expect.objectContaining({
            email: 'newparticipant@example.com',
            role: 'participant',
            status: 'pending'
          })
        )
      })

      // Step 3: Simulate WebSocket message from another user
      const wsMessage = {
        type: 'PARTICIPANT_ADDED',
        tripId: 'test-trip',
        participant: {
          id: 'participant-2',
          email: 'remote@example.com',
          role: 'participant',
          status: 'accepted',
          addedBy: 'another-user'
        }
      }

      act(() => {
        mockWS.onmessage?.({ data: JSON.stringify(wsMessage) } as MessageEvent)
      })

      // Step 4: Verify remote update is reflected in UI
      await waitFor(() => {
        expect(screen.getByText('remote@example.com')).toBeInTheDocument()
        expect(screen.getByText(/added by another-user/i)).toBeInTheDocument()
      })

      // Step 5: Verify participant count updates in trip planning
      const tripPlanningBoard = screen.getByTestId('trip-planning-board')
      await waitFor(() => {
        expect(within(tripPlanningBoard).getByText(/3 participants/i)).toBeInTheDocument()
      })

      // Step 6: Test conflict resolution
      const conflictMessage = {
        type: 'PARTICIPANT_CONFLICT',
        tripId: 'test-trip',
        conflict: {
          type: 'role_change',
          participantId: 'participant-1',
          localRole: 'participant',
          remoteRole: 'organizer',
          lastModified: Date.now()
        }
      }

      act(() => {
        mockWS.onmessage?.({ data: JSON.stringify(conflictMessage) } as MessageEvent)
      })

      // Conflict resolution dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/conflict detected/i)).toBeInTheDocument()
        expect(screen.getByText(/role change conflict/i)).toBeInTheDocument()
      })

      // Resolve conflict
      const useRemoteButton = screen.getByRole('button', { name: /use remote version/i })
      await user.click(useRemoteButton)

      // Verify conflict resolution
      await waitFor(() => {
        const tripState = useTripStore.getState()
        const participant = tripState.trips[0].participants.find(p => p.id === 'participant-1')
        expect(participant?.role).toBe('organizer')
      })
    })

    it('should maintain state consistency during optimistic updates', async () => {
      simulateAuthentication()
      
      renderWithProviders(
        <div>
          <TripPlanningBoard tripId="test-trip" />
          <ShoppingListView tripId="test-trip" />
        </div>
      )

      // Step 1: Make optimistic update (add meal)
      const addMealButton = screen.getByRole('button', { name: /add meal/i })
      await user.click(addMealButton)

      const recipeSelect = screen.getByLabelText(/select recipe/i)
      await user.selectOptions(recipeSelect, 'pasta-carbonara')

      const assignButton = screen.getByRole('button', { name: /assign/i })
      await user.click(assignButton)

      // Step 2: Verify optimistic update in both components
      const mealPlanningBoard = screen.getByTestId('trip-planning-board')
      const shoppingList = screen.getByTestId('shopping-list')

      // Meal should appear immediately (optimistic)
      expect(within(mealPlanningBoard).getByText('Pasta Carbonara')).toBeInTheDocument()
      
      // Shopping list should update immediately (optimistic)
      await waitFor(() => {
        expect(within(shoppingList).getByText('Spaghetti')).toBeInTheDocument()
        expect(within(shoppingList).getByText('Eggs')).toBeInTheDocument()
      })

      // Step 3: Simulate server confirmation
      await waitFor(() => {
        const tripState = useTripStore.getState()
        expect(tripState.optimisticUpdates).toHaveLength(1)
      }, { timeout: 1000 })

      // Mock successful server response
      act(() => {
        useTripStore.getState().confirmOptimisticUpdate('test-update-id', {
          id: 'meal-confirmed',
          recipeId: 'pasta-carbonara',
          recipeName: 'Pasta Carbonara',
          servings: 4
        })
      })

      // Step 4: Verify optimistic update is confirmed
      await waitFor(() => {
        const tripState = useTripStore.getState()
        expect(tripState.optimisticUpdates).toHaveLength(0)
        expect(tripState.trips[0].meals).toContainEqual(
          expect.objectContaining({
            id: 'meal-confirmed',
            recipeName: 'Pasta Carbonara'
          })
        )
      })

      // Step 5: Test rollback scenario
      const addAnotherMealButton = screen.getByRole('button', { name: /add meal/i })
      await user.click(addAnotherMealButton)

      await user.selectOptions(screen.getByLabelText(/select recipe/i), 'chicken-curry')
      await user.click(screen.getByRole('button', { name: /assign/i }))

      // Simulate server error
      act(() => {
        useTripStore.getState().rollbackOptimisticUpdate('test-update-id-2', 
          new Error('Server error'))
      })

      // Step 6: Verify rollback
      await waitFor(() => {
        expect(screen.queryByText('Chicken Curry')).not.toBeInTheDocument()
      })

      // Error should be displayed
      expect(screen.getByText(/failed to add meal/i)).toBeInTheDocument()

      // Original confirmed meal should still be there
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument()
    })
  })

  describe('Toast and Notification State Management', () => {
    it('should coordinate toast notifications across all components', async () => {
      simulateAuthentication()

      renderWithProviders(
        <div>
          <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
          <TripPlanningBoard tripId="test-trip" />
          <ParticipantManager tripId="test-trip" />
        </div>
      )

      // Step 1: Trigger success toast from recipe form
      await user.type(screen.getByLabelText(/recipe name/i), 'Toast Test Recipe')
      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      // Verify toast appears
      await waitFor(() => {
        expect(screen.getByText(/recipe created successfully/i)).toBeInTheDocument()
      })

      // Verify toast state
      const toastState = useToastStore.getState()
      expect(toastState.toasts).toHaveLength(1)
      expect(toastState.toasts[0].type).toBe('success')

      // Step 2: Trigger error toast from participant manager
      const invalidEmailInput = screen.getByLabelText(/participant email/i)
      await user.type(invalidEmailInput, 'invalid-email')
      await user.click(screen.getByRole('button', { name: /add participant/i }))

      // Verify error toast
      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
      })

      // Step 3: Test toast queue management
      // Trigger multiple toasts rapidly
      for (let i = 0; i < 5; i++) {
        act(() => {
          useToastStore.getState().addToast({
            id: `toast-${i}`,
            type: 'info',
            message: `Info message ${i}`,
            duration: 3000
          })
        })
      }

      // Verify only max number of toasts are displayed
      await waitFor(() => {
        const visibleToasts = screen.getAllByRole('alert')
        expect(visibleToasts.length).toBeLessThanOrEqual(3) // Max 3 toasts
      })

      // Step 4: Test toast auto-dismiss
      await waitFor(() => {
        const toastState = useToastStore.getState()
        expect(toastState.toasts.length).toBeLessThan(5)
      }, { timeout: 4000 })

      // Step 5: Test manual toast dismissal
      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      await user.click(dismissButton)

      await waitFor(() => {
        const toastState = useToastStore.getState()
        expect(toastState.toasts.length).toBe(0)
      })
    })

    it('should handle toast persistence and restoration', async () => {
      simulateAuthentication()

      // Add persistent toast
      act(() => {
        useToastStore.getState().addToast({
          id: 'persistent-toast',
          type: 'warning',
          message: 'This is a persistent warning',
          persistent: true
        })
      })

      renderWithProviders(<div>Test Component</div>)

      // Verify persistent toast survives re-render
      expect(screen.getByText(/persistent warning/i)).toBeInTheDocument()

      // Simulate page refresh by clearing and restoring state
      const persistentToasts = useToastStore.getState().toasts.filter(t => t.persistent)
      useToastStore.getState().clearToasts()

      // Restore persistent toasts (simulating app initialization)
      persistentToasts.forEach(toast => {
        useToastStore.getState().addToast(toast)
      })

      // Verify restoration
      expect(screen.getByText(/persistent warning/i)).toBeInTheDocument()
    })
  })

  describe('Cross-Store Data Validation and Consistency', () => {
    it('should maintain referential integrity across stores', async () => {
      simulateAuthentication()

      // Setup initial data
      const recipe = {
        id: 'recipe-consistency-test',
        name: 'Consistency Test Recipe',
        ingredients: [
          { id: 'ing-1', name: 'Test Ingredient', amount: 100, unit: 'g' }
        ]
      }

      const trip = {
        id: 'trip-consistency-test',
        name: 'Consistency Test Trip',
        meals: [
          {
            id: 'meal-1',
            recipeId: 'recipe-consistency-test',
            recipeName: 'Consistency Test Recipe',
            servings: 4
          }
        ]
      }

      // Populate stores
      useRecipeStore.setState({ recipes: [recipe] })
      useTripStore.setState({ trips: [trip] })

      renderWithProviders(<div>Test Component</div>)

      // Step 1: Delete recipe and verify cascade
      act(() => {
        useRecipeStore.getState().deleteRecipe('recipe-consistency-test')
      })

      // Verify recipe is removed
      const recipeState = useRecipeStore.getState()
      expect(recipeState.recipes).toHaveLength(0)

      // Verify referential integrity - meal should be marked as invalid
      const tripState = useTripStore.getState()
      const meal = tripState.trips[0].meals[0]
      expect(meal.isInvalid).toBe(true)
      expect(meal.invalidReason).toBe('Recipe deleted')

      // Step 2: Test orphaned data cleanup
      act(() => {
        useTripStore.getState().cleanupOrphanedData()
      })

      // Verify orphaned meal is removed
      const updatedTripState = useTripStore.getState()
      expect(updatedTripState.trips[0].meals).toHaveLength(0)

      // Step 3: Test data validation on store operations
      // Try to add invalid meal reference
      const invalidMeal = {
        id: 'invalid-meal',
        recipeId: 'non-existent-recipe',
        recipeName: 'Non-existent Recipe',
        servings: 4
      }

      const validationResult = useTripStore.getState().validateMeal(invalidMeal)
      expect(validationResult.isValid).toBe(false)
      expect(validationResult.errors).toContain('Recipe not found')

      // Step 4: Test cross-store sync validation
      const syncResult = useTripStore.getState().syncWithRecipeStore()
      expect(syncResult.syncedMeals).toBe(0)
      expect(syncResult.invalidMeals).toBe(0)
      expect(syncResult.errors).toHaveLength(0)
    })

    it('should handle concurrent store updates correctly', async () => {
      simulateAuthentication()

      const TestComponent = () => {
        const recipes = useRecipeStore(state => state.recipes)
        const trips = useTripStore(state => state.trips)

        return (
          <div>
            <div data-testid="recipe-count">{recipes.length}</div>
            <div data-testid="trip-count">{trips.length}</div>
          </div>
        )
      }

      renderWithProviders(<TestComponent />)

      // Step 1: Simulate concurrent updates
      const concurrentUpdates = Array.from({ length: 10 }, (_, i) => {
        return Promise.all([
          new Promise(resolve => {
            setTimeout(() => {
              useRecipeStore.getState().addRecipe({
                id: `concurrent-recipe-${i}`,
                name: `Concurrent Recipe ${i}`,
                ingredients: []
              })
              resolve(undefined)
            }, Math.random() * 100)
          }),
          new Promise(resolve => {
            setTimeout(() => {
              useTripStore.getState().addTrip({
                id: `concurrent-trip-${i}`,
                name: `Concurrent Trip ${i}`,
                meals: []
              })
              resolve(undefined)
            }, Math.random() * 100)
          })
        ])
      })

      await Promise.all(concurrentUpdates)

      // Step 2: Verify all updates were applied
      await waitFor(() => {
        expect(screen.getByTestId('recipe-count')).toHaveTextContent('10')
        expect(screen.getByTestId('trip-count')).toHaveTextContent('10')
      })

      // Step 3: Verify store state consistency
      const recipeState = useRecipeStore.getState()
      const tripState = useTripStore.getState()

      expect(recipeState.recipes).toHaveLength(10)
      expect(tripState.trips).toHaveLength(10)

      // Verify no duplicate IDs
      const recipeIds = recipeState.recipes.map(r => r.id)
      const tripIds = tripState.trips.map(t => t.id)

      expect(new Set(recipeIds).size).toBe(10)
      expect(new Set(tripIds).size).toBe(10)
    })
  })

  describe('Error State Propagation', () => {
    it('should handle and propagate errors across components', async () => {
      simulateAuthentication()

      renderWithProviders(
        <div>
          <RecipeForm onSuccess={() => {}} onCancel={() => {}} />
          <TripPlanningBoard tripId="test-trip" />
        </div>
      )

      // Step 1: Trigger validation error in recipe form
      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/recipe name is required/i)).toBeInTheDocument()
      })

      // Step 2: Trigger network error
      // Mock failed API call
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await user.type(screen.getByLabelText(/recipe name/i), 'Network Error Test')
      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      // Verify network error handling
      await waitFor(() => {
        expect(screen.getByText(/failed to save recipe/i)).toBeInTheDocument()
      })

      // Verify error state in store
      const recipeState = useRecipeStore.getState()
      expect(recipeState.error).toBeTruthy()
      expect(recipeState.loading).toBe(false)

      // Step 3: Test error recovery
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      // Verify error is cleared
      await waitFor(() => {
        const updatedRecipeState = useRecipeStore.getState()
        expect(updatedRecipeState.error).toBe(null)
      })

      // Step 4: Test error boundary integration
      // Trigger component error
      act(() => {
        throw new Error('Component error')
      })

      // Error boundary should catch and display error
      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      })
    })
  })
})