import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../setup/testProviders'
import { simulateAuthentication, createMockWebSocket } from '../setup/testSetup'

// Import components for testing data flow
import { RecipeSearch } from '@/components/recipes/RecipeSearch'
import { RecipeCard } from '@/components/recipes/RecipeCard'
import { TripWizard } from '@/components/trips/TripWizard'
import { MealPlanningBoard } from '@/components/trips/MealPlanningBoard'
import { ShoppingListGenerator } from '@/components/trips/ShoppingListGenerator'
import { ParticipantManager } from '@/components/trips/ParticipantManager'
import { CostCalculator } from '@/components/trips/CostCalculator'
import { NutritionCalculator } from '@/components/trips/NutritionCalculator'

describe('Cross-Component Data Flow Integration', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('Recipe Discovery to Meal Planning Flow', () => {
    it('should flow recipe data from search to meal planning seamlessly', async () => {
      simulateAuthentication()

      const mockRecipes = [
        {
          id: 'recipe-1',
          name: 'Spaghetti Carbonara',
          description: 'Classic Italian pasta',
          prepTime: 20,
          servings: 4,
          difficulty: 'medium',
          cuisine: 'Italian',
          ingredients: [
            { id: 'ing-1', name: 'Spaghetti', amount: 400, unit: 'g' },
            { id: 'ing-2', name: 'Eggs', amount: 4, unit: 'pieces' },
            { id: 'ing-3', name: 'Bacon', amount: 200, unit: 'g' },
          ],
          nutrition: { calories: 520, protein: 24, carbs: 58, fat: 18 },
          tags: ['quick', 'italian'],
          rating: 4.5,
        },
        {
          id: 'recipe-2',
          name: 'Vegetable Stir Fry',
          description: 'Healthy mixed vegetables',
          prepTime: 15,
          servings: 3,
          difficulty: 'easy',
          cuisine: 'Asian',
          ingredients: [
            { id: 'ing-4', name: 'Bell Peppers', amount: 2, unit: 'pieces' },
            { id: 'ing-5', name: 'Broccoli', amount: 300, unit: 'g' },
            { id: 'ing-6', name: 'Soy Sauce', amount: 50, unit: 'ml' },
          ],
          nutrition: { calories: 180, protein: 8, carbs: 24, fat: 6 },
          tags: ['healthy', 'vegetarian'],
          rating: 4.2,
        }
      ]

      renderWithProviders(
        <div>
          <RecipeSearch onRecipeSelect={() => {}} />
          <div data-testid="recipe-results">
            {mockRecipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
          <MealPlanningBoard tripId="test-trip" />
        </div>
      )

      // Step 1: Search for recipes
      const searchInput = screen.getByPlaceholderText(/search recipes/i)
      await user.type(searchInput, 'pasta')

      // Step 2: Filter results
      const cuisineFilter = screen.getByLabelText(/cuisine/i)
      await user.selectOptions(cuisineFilter, 'Italian')

      const difficultyFilter = screen.getByLabelText(/difficulty/i)
      await user.selectOptions(difficultyFilter, 'medium')

      // Step 3: Verify filtered results
      await waitFor(() => {
        expect(screen.getByText('Spaghetti Carbonara')).toBeInTheDocument()
        expect(screen.queryByText('Vegetable Stir Fry')).not.toBeInTheDocument()
      })

      // Step 4: Select recipe and add to meal plan
      const carbonaraCard = screen.getByTestId('recipe-card-recipe-1')
      const addToMealPlanButton = within(carbonaraCard).getByRole('button', { 
        name: /add to meal plan/i 
      })
      await user.click(addToMealPlanButton)

      // Step 5: Choose meal slot
      const mealSlotModal = screen.getByRole('dialog', { name: /choose meal slot/i })
      expect(mealSlotModal).toBeInTheDocument()

      const dinnerSlot = within(mealSlotModal).getByRole('button', { 
        name: /dinner.*july 15/i 
      })
      await user.click(dinnerSlot)

      // Step 6: Configure servings for participants
      const servingsInput = screen.getByLabelText(/servings/i)
      expect(servingsInput).toHaveValue('4') // Default from recipe

      // Adjust for trip participant count (6 people)
      await user.clear(servingsInput)
      await user.type(servingsInput, '6')

      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)

      // Step 7: Verify recipe data flows to meal planning board
      const mealPlanningBoard = screen.getByTestId('meal-planning-board')
      
      await waitFor(() => {
        const dinnerCell = within(mealPlanningBoard).getByTestId('meal-slot-dinner-2024-07-15')
        expect(within(dinnerCell).getByText('Spaghetti Carbonara')).toBeInTheDocument()
        expect(within(dinnerCell).getByText('6 servings')).toBeInTheDocument()
        expect(within(dinnerCell).getByText('520 cal/serving')).toBeInTheDocument()
      })

      // Step 8: Verify scaled ingredient calculations
      const mealDetails = within(mealPlanningBoard).getByTestId('meal-details-dinner-2024-07-15')
      await user.click(mealDetails)

      const ingredientsList = screen.getByTestId('scaled-ingredients')
      expect(within(ingredientsList).getByText('Spaghetti: 600 g')).toBeInTheDocument() // 400g * 1.5
      expect(within(ingredientsList).getByText('Eggs: 6 pieces')).toBeInTheDocument() // 4 * 1.5
      expect(within(ingredientsList).getByText('Bacon: 300 g')).toBeInTheDocument() // 200g * 1.5

      // Step 9: Verify nutrition calculations
      const nutritionSummary = screen.getByTestId('nutrition-summary')
      expect(within(nutritionSummary).getByText('Total Calories: 3,120')).toBeInTheDocument() // 520 * 6
      expect(within(nutritionSummary).getByText('Protein: 144g')).toBeInTheDocument() // 24 * 6
    })

    it('should handle recipe modifications and propagate changes downstream', async () => {
      simulateAuthentication()

      const initialRecipe = {
        id: 'modifiable-recipe',
        name: 'Original Recipe',
        servings: 4,
        ingredients: [
          { id: 'ing-1', name: 'Ingredient 1', amount: 100, unit: 'g' }
        ],
        nutrition: { calories: 200, protein: 10, carbs: 20, fat: 5 }
      }

      renderWithProviders(
        <div>
          <RecipeCard recipe={initialRecipe} />
          <MealPlanningBoard tripId="test-trip" />
          <ShoppingListGenerator tripId="test-trip" />
          <CostCalculator tripId="test-trip" />
          <NutritionCalculator tripId="test-trip" />
        </div>
      )

      // Step 1: Add recipe to meal plan
      const addButton = screen.getByRole('button', { name: /add to meal plan/i })
      await user.click(addButton)

      const dinnerSlot = screen.getByRole('button', { name: /dinner/i })
      await user.click(dinnerSlot)

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      // Step 2: Verify initial state in all components
      expect(screen.getByText('Original Recipe')).toBeInTheDocument()
      
      const shoppingList = screen.getByTestId('shopping-list')
      expect(within(shoppingList).getByText('Ingredient 1: 100 g')).toBeInTheDocument()

      const costCalculator = screen.getByTestId('cost-calculator')
      expect(within(costCalculator).getByText(/estimated cost.*\$\d+/i)).toBeInTheDocument()

      const nutritionCalculator = screen.getByTestId('nutrition-calculator')
      expect(within(nutritionCalculator).getByText('200 calories')).toBeInTheDocument()

      // Step 3: Modify recipe through meal planning board
      const editMealButton = screen.getByRole('button', { name: /edit meal/i })
      await user.click(editMealButton)

      // Change servings
      const servingsInput = screen.getByLabelText(/servings/i)
      await user.clear(servingsInput)
      await user.type(servingsInput, '8')

      // Modify ingredients
      const modifyIngredientsButton = screen.getByRole('button', { name: /modify ingredients/i })
      await user.click(modifyIngredientsButton)

      const ingredientAmountInput = screen.getByLabelText(/ingredient 1 amount/i)
      await user.clear(ingredientAmountInput)
      await user.type(ingredientAmountInput, '150')

      const saveChangesButton = screen.getByRole('button', { name: /save changes/i })
      await user.click(saveChangesButton)

      // Step 4: Verify changes propagate to all downstream components
      await waitFor(() => {
        // Meal planning board should show updated servings
        expect(screen.getByText('8 servings')).toBeInTheDocument()

        // Shopping list should reflect scaled ingredients (150g * 2 for 8 servings vs 4)
        const updatedShoppingList = screen.getByTestId('shopping-list')
        expect(within(updatedShoppingList).getByText('Ingredient 1: 300 g')).toBeInTheDocument()

        // Nutrition calculator should show scaled values
        const updatedNutritionCalculator = screen.getByTestId('nutrition-calculator')
        expect(within(updatedNutritionCalculator).getByText('1600 calories')).toBeInTheDocument() // 200 * 8

        // Cost calculator should update
        const updatedCostCalculator = screen.getByTestId('cost-calculator')
        const costElements = within(updatedCostCalculator).getAllByText(/\$\d+/)
        expect(costElements.length).toBeGreaterThan(0)
      })

      // Step 5: Test cascade delete
      const removeMealButton = screen.getByRole('button', { name: /remove meal/i })
      await user.click(removeMealButton)

      const confirmRemovalButton = screen.getByRole('button', { name: /confirm removal/i })
      await user.click(confirmRemovalButton)

      // Step 6: Verify removal cascades to all components
      await waitFor(() => {
        // Meal should be removed from planning board
        expect(screen.queryByText('Original Recipe')).not.toBeInTheDocument()

        // Shopping list should be updated
        const finalShoppingList = screen.getByTestId('shopping-list')
        expect(within(finalShoppingList).queryByText('Ingredient 1')).not.toBeInTheDocument()

        // Nutrition and cost calculators should reset
        const finalNutritionCalculator = screen.getByTestId('nutrition-calculator')
        expect(within(finalNutritionCalculator).getByText('0 calories')).toBeInTheDocument()
      })
    })
  })

  describe('Participant Management to Calculation Flow', () => {
    it('should flow participant data to all calculation components', async () => {
      simulateAuthentication()

      renderWithProviders(
        <div>
          <ParticipantManager tripId="test-trip" />
          <MealPlanningBoard tripId="test-trip" />
          <CostCalculator tripId="test-trip" />
          <NutritionCalculator tripId="test-trip" />
        </div>
      )

      // Step 1: Add participants with different characteristics
      const addParticipantButton = screen.getByRole('button', { name: /add participant/i })
      
      // Add adult participant
      await user.click(addParticipantButton)
      await user.type(screen.getByLabelText(/email/i), 'adult@example.com')
      await user.selectOptions(screen.getByLabelText(/age group/i), 'adult')
      await user.selectOptions(screen.getByLabelText(/activity level/i), 'moderate')
      await user.click(screen.getByRole('button', { name: /add/i }))

      // Add child participant
      await user.click(addParticipantButton)
      await user.type(screen.getByLabelText(/email/i), 'child@example.com')
      await user.selectOptions(screen.getByLabelText(/age group/i), 'child')
      await user.selectOptions(screen.getByLabelText(/activity level/i), 'high')
      await user.click(screen.getByRole('button', { name: /add/i }))

      // Add participant with dietary restrictions
      await user.click(addParticipantButton)
      await user.type(screen.getByLabelText(/email/i), 'vegetarian@example.com')
      await user.selectOptions(screen.getByLabelText(/age group/i), 'adult')
      const dietaryRestrictions = screen.getByLabelText(/dietary restrictions/i)
      await user.selectOptions(dietaryRestrictions, ['vegetarian', 'gluten-free'])
      await user.click(screen.getByRole('button', { name: /add/i }))

      // Step 2: Verify participant data flows to meal planning
      const mealPlanningBoard = screen.getByTestId('meal-planning-board')
      
      await waitFor(() => {
        expect(within(mealPlanningBoard).getByText('4 participants')).toBeInTheDocument()
        expect(within(mealPlanningBoard).getByText(/1 child, 3 adults/i)).toBeInTheDocument()
        expect(within(mealPlanningBoard).getByText(/dietary restrictions: vegetarian, gluten-free/i)).toBeInTheDocument()
      })

      // Step 3: Add meal and verify coefficient calculations
      const addMealButton = within(mealPlanningBoard).getByRole('button', { name: /add meal/i })
      await user.click(addMealButton)

      const recipeSelect = screen.getByLabelText(/select recipe/i)
      await user.selectOptions(recipeSelect, 'pasta-recipe')

      const assignButton = screen.getByRole('button', { name: /assign/i })
      await user.click(assignButton)

      // Step 4: Verify cost calculations account for participant mix
      const costCalculator = screen.getByTestId('cost-calculator')
      
      await waitFor(() => {
        // Child portions should be calculated at reduced rate
        expect(within(costCalculator).getByText(/child portions: 0\.75x/i)).toBeInTheDocument()
        
        // Total servings should reflect participant mix (3 adults + 0.75 child = 3.75 servings)
        expect(within(costCalculator).getByText(/effective servings: 3\.75/i)).toBeInTheDocument()
        
        // Cost breakdown
        expect(within(costCalculator).getByText(/adult portions.*\$\d+/i)).toBeInTheDocument()
        expect(within(costCalculator).getByText(/child portions.*\$\d+/i)).toBeInTheDocument()
      })

      // Step 5: Verify nutrition calculations account for different needs
      const nutritionCalculator = screen.getByTestId('nutrition-calculator')
      
      await waitFor(() => {
        // Should show per-person breakdown
        expect(within(nutritionCalculator).getByText(/adult.*calories per day/i)).toBeInTheDocument()
        expect(within(nutritionCalculator).getByText(/child.*calories per day/i)).toBeInTheDocument()
        
        // Should account for activity levels
        expect(within(nutritionCalculator).getByText(/adjusted for activity levels/i)).toBeInTheDocument()
        
        // Should show dietary restriction compliance
        expect(within(nutritionCalculator).getByText(/✓ vegetarian friendly/i)).toBeInTheDocument()
        expect(within(nutritionCalculator).getByText(/✗ contains gluten/i)).toBeInTheDocument()
      })

      // Step 6: Test participant removal and recalculation
      const participantManager = screen.getByTestId('participant-manager')
      const removeChildButton = within(participantManager).getByRole('button', { 
        name: /remove child@example\.com/i 
      })
      await user.click(removeChildButton)

      const confirmRemovalButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmRemovalButton)

      // Step 7: Verify calculations update after participant removal
      await waitFor(() => {
        // Participant count should update
        expect(within(mealPlanningBoard).getByText('3 participants')).toBeInTheDocument()
        
        // Cost calculations should recalculate
        expect(within(costCalculator).getByText(/effective servings: 3\.0/i)).toBeInTheDocument()
        expect(within(costCalculator).queryByText(/child portions/i)).not.toBeInTheDocument()
        
        // Nutrition calculations should update
        expect(within(nutritionCalculator).queryByText(/child.*calories/i)).not.toBeInTheDocument()
      })
    })

    it('should handle real-time participant updates and coefficient recalculation', async () => {
      simulateAuthentication()
      const mockWS = createMockWebSocket()

      renderWithProviders(
        <div>
          <ParticipantManager tripId="test-trip" />
          <CostCalculator tripId="test-trip" />
          <NutritionCalculator tripId="test-trip" />
        </div>,
        {
          providerOptions: {
            enableWebSocket: true,
          }
        }
      )

      // Step 1: Initial state
      const costCalculator = screen.getByTestId('cost-calculator')
      const nutritionCalculator = screen.getByTestId('nutrition-calculator')

      // Step 2: Simulate real-time participant addition via WebSocket
      const wsMessage = {
        type: 'PARTICIPANT_ADDED',
        tripId: 'test-trip',
        participant: {
          id: 'remote-participant',
          email: 'remote@example.com',
          ageGroup: 'adult',
          activityLevel: 'high',
          dietaryRestrictions: ['vegan'],
          coefficients: {
            cost: 1.0,
            nutrition: 1.2, // High activity level
          }
        }
      }

      act(() => {
        mockWS.onmessage?.({ data: JSON.stringify(wsMessage) } as MessageEvent)
      })

      // Step 3: Verify real-time updates in calculation components
      await waitFor(() => {
        expect(screen.getByText('remote@example.com')).toBeInTheDocument()
        
        // Cost calculator should update
        expect(within(costCalculator).getByText(/4 participants/i)).toBeInTheDocument()
        
        // Nutrition calculator should account for high activity level
        expect(within(nutritionCalculator).getByText(/high activity.*\+20%/i)).toBeInTheDocument()
        
        // Dietary restrictions should be noted
        expect(within(nutritionCalculator).getByText(/vegan requirements/i)).toBeInTheDocument()
      })

      // Step 4: Simulate coefficient update via WebSocket
      const coefficientUpdateMessage = {
        type: 'PARTICIPANT_COEFFICIENT_UPDATED',
        tripId: 'test-trip',
        participantId: 'remote-participant',
        coefficients: {
          cost: 0.8, // Discount applied
          nutrition: 1.3, // Increased nutritional needs
        }
      }

      act(() => {
        mockWS.onmessage?.({ data: JSON.stringify(coefficientUpdateMessage) } as MessageEvent)
      })

      // Step 5: Verify coefficient updates propagate
      await waitFor(() => {
        expect(within(costCalculator).getByText(/remote@example\.com.*0\.8x/i)).toBeInTheDocument()
        expect(within(nutritionCalculator).getByText(/remote@example\.com.*1\.3x/i)).toBeInTheDocument()
      })

      // Step 6: Test batch coefficient recalculation
      const recalculateButton = screen.getByRole('button', { name: /recalculate all/i })
      await user.click(recalculateButton)

      await waitFor(() => {
        expect(screen.getByText(/coefficients updated/i)).toBeInTheDocument()
        expect(within(costCalculator).getByText(/total recalculated/i)).toBeInTheDocument()
      })
    })
  })

  describe('Shopping List Generation Flow', () => {
    it('should aggregate data from multiple sources to generate comprehensive shopping list', async () => {
      simulateAuthentication()

      const mockMealPlan = {
        tripId: 'test-trip',
        days: [
          {
            date: '2024-07-15',
            meals: {
              breakfast: { recipeId: 'pancakes', servings: 6 },
              lunch: { recipeId: 'salad', servings: 6 },
              dinner: { recipeId: 'pasta', servings: 6 }
            }
          },
          {
            date: '2024-07-16',
            meals: {
              breakfast: { recipeId: 'eggs', servings: 6 },
              lunch: { recipeId: 'sandwich', servings: 6 },
              dinner: { recipeId: 'chicken', servings: 6 }
            }
          }
        ]
      }

      renderWithProviders(
        <div>
          <MealPlanningBoard tripId="test-trip" initialData={mockMealPlan} />
          <ShoppingListGenerator tripId="test-trip" />
          <CostCalculator tripId="test-trip" />
        </div>
      )

      // Step 1: Generate shopping list from meal plan
      const generateButton = screen.getByRole('button', { name: /generate shopping list/i })
      await user.click(generateButton)

      // Step 2: Verify aggregation options
      const aggregationModal = screen.getByRole('dialog', { name: /shopping list options/i })
      expect(aggregationModal).toBeInTheDocument()

      // Configure aggregation preferences
      const combineIdenticalCheckbox = screen.getByLabelText(/combine identical ingredients/i)
      expect(combineIdenticalCheckbox).toBeChecked()

      const roundUpCheckbox = screen.getByLabelText(/round up quantities/i)
      await user.click(roundUpCheckbox)

      const includeExtrasCheckbox = screen.getByLabelText(/include 10% extra/i)
      await user.click(includeExtrasCheckbox)

      const generateFinalButton = screen.getByRole('button', { name: /generate final list/i })
      await user.click(generateFinalButton)

      // Step 3: Verify comprehensive shopping list generation
      const shoppingList = screen.getByTestId('generated-shopping-list')
      
      await waitFor(() => {
        // Should show aggregated ingredients from all meals
        expect(within(shoppingList).getByText(/eggs.*8 pieces/i)).toBeInTheDocument() // From multiple recipes
        expect(within(shoppingList).getByText(/flour.*1\.1 kg/i)).toBeInTheDocument() // Rounded up with 10% extra
        
        // Should categorize ingredients
        expect(within(shoppingList).getByText(/dairy & eggs/i)).toBeInTheDocument()
        expect(within(shoppingList).getByText(/vegetables/i)).toBeInTheDocument()
        expect(within(shoppingList).getByText(/grains & pasta/i)).toBeInTheDocument()
        
        // Should show estimated costs
        expect(within(shoppingList).getByText(/estimated total.*\$\d+/i)).toBeInTheDocument()
      })

      // Step 4: Add custom items
      const addCustomItemButton = screen.getByRole('button', { name: /add custom item/i })
      await user.click(addCustomItemButton)

      await user.type(screen.getByLabelText(/item name/i), 'Paper Plates')
      await user.type(screen.getByLabelText(/quantity/i), '20')
      await user.selectOptions(screen.getByLabelText(/category/i), 'Disposables')

      const addItemButton = screen.getByRole('button', { name: /add item/i })
      await user.click(addItemButton)

      // Step 5: Verify custom item integration
      await waitFor(() => {
        expect(within(shoppingList).getByText('Paper Plates')).toBeInTheDocument()
        expect(within(shoppingList).getByText('20 pieces')).toBeInTheDocument()
        expect(within(shoppingList).getByText(/disposables/i)).toBeInTheDocument()
      })

      // Step 6: Test shopping list optimization
      const optimizeButton = screen.getByRole('button', { name: /optimize list/i })
      await user.click(optimizeButton)

      await waitFor(() => {
        // Should suggest store-specific organization
        expect(screen.getByText(/optimized for grocery store layout/i)).toBeInTheDocument()
        
        // Should suggest bulk buying opportunities
        expect(screen.getByText(/bulk buying suggestions/i)).toBeInTheDocument()
        
        // Should highlight deals
        expect(screen.getByText(/potential savings.*\$\d+/i)).toBeInTheDocument()
      })

      // Step 7: Export and share options
      const exportButton = screen.getByRole('button', { name: /export list/i })
      await user.click(exportButton)

      const exportOptions = screen.getByRole('dialog', { name: /export options/i })
      
      const pdfOption = within(exportOptions).getByLabelText(/pdf format/i)
      await user.click(pdfOption)

      const includeImagesCheckbox = within(exportOptions).getByLabelText(/include product images/i)
      await user.click(includeImagesCheckbox)

      const exportFinalButton = within(exportOptions).getByRole('button', { name: /export/i })
      await user.click(exportFinalButton)

      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument()
      })

      // Step 8: Verify cost integration
      const costCalculator = screen.getByTestId('cost-calculator')
      
      await waitFor(() => {
        expect(within(costCalculator).getByText(/shopping list total/i)).toBeInTheDocument()
        expect(within(costCalculator).getByText(/per person cost/i)).toBeInTheDocument()
        expect(within(costCalculator).getByText(/budget remaining/i)).toBeInTheDocument()
      })
    })

    it('should handle dynamic shopping list updates from meal plan changes', async () => {
      simulateAuthentication()

      renderWithProviders(
        <div>
          <MealPlanningBoard tripId="test-trip" />
          <ShoppingListGenerator tripId="test-trip" />
        </div>
      )

      // Step 1: Generate initial shopping list
      const mealPlanningBoard = screen.getByTestId('meal-planning-board')
      const addMealButton = within(mealPlanningBoard).getByRole('button', { name: /add meal/i })
      await user.click(addMealButton)

      await user.selectOptions(screen.getByLabelText(/recipe/i), 'pasta-recipe')
      await user.click(screen.getByRole('button', { name: /assign/i }))

      const generateListButton = screen.getByRole('button', { name: /generate list/i })
      await user.click(generateListButton)

      // Step 2: Verify initial shopping list
      const shoppingList = screen.getByTestId('shopping-list')
      
      await waitFor(() => {
        expect(within(shoppingList).getByText('Pasta: 400 g')).toBeInTheDocument()
        expect(within(shoppingList).getByText('Tomato Sauce: 500 ml')).toBeInTheDocument()
      })

      // Step 3: Modify meal (change servings)
      const editMealButton = within(mealPlanningBoard).getByRole('button', { name: /edit meal/i })
      await user.click(editMealButton)

      const servingsInput = screen.getByLabelText(/servings/i)
      await user.clear(servingsInput)
      await user.type(servingsInput, '8')

      const saveChangesButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveChangesButton)

      // Step 4: Verify shopping list auto-updates
      await waitFor(() => {
        expect(within(shoppingList).getByText('Pasta: 800 g')).toBeInTheDocument() // Doubled
        expect(within(shoppingList).getByText('Tomato Sauce: 1 L')).toBeInTheDocument() // Doubled and unit converted
      })

      // Step 5: Add another meal with overlapping ingredients
      await user.click(addMealButton)
      await user.selectOptions(screen.getByLabelText(/recipe/i), 'marinara-pasta')
      await user.click(screen.getByRole('button', { name: /assign/i }))

      // Step 6: Verify ingredient aggregation
      await waitFor(() => {
        expect(within(shoppingList).getByText('Pasta: 1.2 kg')).toBeInTheDocument() // Combined amounts
        expect(within(shoppingList).getByText('Tomato Sauce: 1.5 L')).toBeInTheDocument() // Combined amounts
      })

      // Step 7: Remove meal and verify updates
      const removeMealButton = within(mealPlanningBoard).getByRole('button', { 
        name: /remove marinara-pasta/i 
      })
      await user.click(removeMealButton)

      await waitFor(() => {
        expect(within(shoppingList).getByText('Pasta: 800 g')).toBeInTheDocument() // Back to single meal
        expect(within(shoppingList).getByText('Tomato Sauce: 1 L')).toBeInTheDocument() // Back to single meal
      })

      // Step 8: Test real-time collaborative updates
      const mockWS = createMockWebSocket()
      
      const collaborativeUpdate = {
        type: 'MEAL_UPDATED',
        tripId: 'test-trip',
        meal: {
          id: 'collaborative-meal',
          recipeId: 'salad-recipe',
          recipeName: 'Garden Salad',
          servings: 6,
          ingredients: [
            { name: 'Lettuce', amount: 300, unit: 'g' },
            { name: 'Tomatoes', amount: 4, unit: 'pieces' }
          ]
        },
        updatedBy: 'collaborator@example.com'
      }

      act(() => {
        mockWS.onmessage?.({ data: JSON.stringify(collaborativeUpdate) } as MessageEvent)
      })

      // Step 9: Verify collaborative updates appear in shopping list
      await waitFor(() => {
        expect(within(shoppingList).getByText('Lettuce: 300 g')).toBeInTheDocument()
        expect(within(shoppingList).getByText('Tomatoes: 4 pieces')).toBeInTheDocument()
        expect(screen.getByText(/updated by collaborator@example\.com/i)).toBeInTheDocument()
      })
    })
  })
})