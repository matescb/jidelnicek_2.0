import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../setup/testProviders'
import { simulateAuthentication } from '../setup/testSetup'

// Import calculation components
import { CostCalculator } from '@/components/trips/CostCalculator'
import { NutritionCalculator } from '@/components/trips/NutritionCalculator'
import { ShoppingListGenerator } from '@/components/trips/ShoppingListGenerator'
import { ParticipantManager } from '@/components/trips/ParticipantManager'
import { MealPlanningBoard } from '@/components/trips/MealPlanningBoard'

// Import calculation utilities
import { 
  calculateServingCoefficients,
  calculateNutritionalNeeds,
  aggregateShoppingIngredients,
  calculateTotalCost,
  roundIngredientAmounts,
} from '@/utils/calculations'

describe('Critical Business Logic - Calculations Integration', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('Recipe Coefficient Calculations', () => {
    it('should calculate serving adjustments correctly for different participant types', async () => {
      simulateAuthentication()

      const mockTrip = {
        id: 'test-trip',
        participants: [
          { 
            id: 'adult-1', 
            ageGroup: 'adult', 
            activityLevel: 'moderate',
            coefficients: { serving: 1.0, cost: 1.0 }
          },
          { 
            id: 'adult-2', 
            ageGroup: 'adult', 
            activityLevel: 'high',
            coefficients: { serving: 1.2, cost: 1.1 }
          },
          { 
            id: 'child-1', 
            ageGroup: 'child', 
            activityLevel: 'moderate',
            coefficients: { serving: 0.7, cost: 0.8 }
          },
          { 
            id: 'senior-1', 
            ageGroup: 'senior', 
            activityLevel: 'low',
            coefficients: { serving: 0.8, cost: 0.9 }
          }
        ]
      }

      const mockRecipe = {
        id: 'recipe-1',
        name: 'Test Recipe',
        baseServings: 4,
        ingredients: [
          { id: 'ing-1', name: 'Pasta', amount: 400, unit: 'g' },
          { id: 'ing-2', name: 'Sauce', amount: 500, unit: 'ml' }
        ]
      }

      renderWithProviders(
        <div>
          <ParticipantManager tripId="test-trip" initialData={mockTrip} />
          <CostCalculator 
            tripId="test-trip" 
            recipe={mockRecipe}
            targetServings={4}
          />
        </div>
      )

      // Step 1: Verify participant coefficients are displayed
      const participantManager = screen.getByTestId('participant-manager')
      
      expect(within(participantManager).getByText(/adult-1.*1\.0x/i)).toBeInTheDocument()
      expect(within(participantManager).getByText(/adult-2.*1\.2x/i)).toBeInTheDocument()
      expect(within(participantManager).getByText(/child-1.*0\.7x/i)).toBeInTheDocument()
      expect(within(participantManager).getByText(/senior-1.*0\.8x/i)).toBeInTheDocument()

      // Step 2: Calculate effective servings
      // Expected: 1.0 + 1.2 + 0.7 + 0.8 = 3.7 effective servings
      const costCalculator = screen.getByTestId('cost-calculator')
      
      await waitFor(() => {
        expect(within(costCalculator).getByText(/effective servings.*3\.7/i)).toBeInTheDocument()
      })

      // Step 3: Verify ingredient scaling
      // Pasta: 400g * (3.7/4) = 370g
      // Sauce: 500ml * (3.7/4) = 462.5ml ≈ 463ml
      expect(within(costCalculator).getByText(/pasta.*370.*g/i)).toBeInTheDocument()
      expect(within(costCalculator).getByText(/sauce.*463.*ml/i)).toBeInTheDocument()

      // Step 4: Test dynamic coefficient changes
      const editParticipantButton = within(participantManager).getByRole('button', { 
        name: /edit adult-2/i 
      })
      await user.click(editParticipantButton)

      const activitySelect = screen.getByLabelText(/activity level/i)
      await user.selectOptions(activitySelect, 'extreme') // Should increase coefficient to 1.5

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Step 5: Verify recalculation
      // New effective servings: 1.0 + 1.5 + 0.7 + 0.8 = 4.0
      await waitFor(() => {
        expect(within(costCalculator).getByText(/effective servings.*4\.0/i)).toBeInTheDocument()
      })

      // Ingredients should now match base recipe exactly
      expect(within(costCalculator).getByText(/pasta.*400.*g/i)).toBeInTheDocument()
      expect(within(costCalculator).getByText(/sauce.*500.*ml/i)).toBeInTheDocument()
    })

    it('should handle complex dietary restrictions in coefficient calculations', async () => {
      simulateAuthentication()

      const mockTrip = {
        id: 'dietary-trip',
        participants: [
          { 
            id: 'vegan-1', 
            dietaryRestrictions: ['vegan'],
            coefficients: { serving: 1.0, nutrition: 1.1 } // Higher protein needs
          },
          { 
            id: 'gluten-free-1', 
            dietaryRestrictions: ['gluten-free'],
            coefficients: { serving: 1.0, cost: 1.3 } // More expensive alternatives
          },
          { 
            id: 'keto-1', 
            dietaryRestrictions: ['keto'],
            coefficients: { serving: 0.8, fat: 2.0 } // Higher fat ratio
          },
          { 
            id: 'regular-1', 
            dietaryRestrictions: [],
            coefficients: { serving: 1.0, cost: 1.0 }
          }
        ]
      }

      const mockMeal = {
        recipeId: 'pasta-recipe',
        recipe: {
          name: 'Regular Pasta',
          nutrition: { calories: 400, protein: 15, carbs: 70, fat: 8 },
          ingredients: [
            { name: 'Regular Pasta', amount: 400, unit: 'g', hasGluten: true },
            { name: 'Cheese', amount: 100, unit: 'g', isVegan: false }
          ]
        }
      }

      renderWithProviders(
        <div>
          <NutritionCalculator 
            tripId="dietary-trip" 
            meal={mockMeal}
            participants={mockTrip.participants}
          />
          <CostCalculator 
            tripId="dietary-trip"
            meal={mockMeal}
            participants={mockTrip.participants}
          />
        </div>
      )

      // Step 1: Verify dietary adaptations are suggested
      const nutritionCalculator = screen.getByTestId('nutrition-calculator')
      
      expect(within(nutritionCalculator).getByText(/dietary adaptations needed/i)).toBeInTheDocument()
      expect(within(nutritionCalculator).getByText(/vegan.*cheese substitute/i)).toBeInTheDocument()
      expect(within(nutritionCalculator).getByText(/gluten-free.*pasta alternative/i)).toBeInTheDocument()

      // Step 2: Verify cost adjustments for dietary restrictions
      const costCalculator = screen.getByTestId('cost-calculator')
      
      await waitFor(() => {
        // Gluten-free participant should have 1.3x cost multiplier
        expect(within(costCalculator).getByText(/gluten-free adjustments.*\+30%/i)).toBeInTheDocument()
        
        // Should show alternative ingredient costs
        expect(within(costCalculator).getByText(/gluten-free pasta.*\$\d+/i)).toBeInTheDocument()
        expect(within(costCalculator).getByText(/vegan cheese.*\$\d+/i)).toBeInTheDocument()
      })

      // Step 3: Test nutritional adjustments
      expect(within(nutritionCalculator).getByText(/vegan participant.*\+10%.*protein/i)).toBeInTheDocument()
      expect(within(nutritionCalculator).getByText(/keto participant.*200%.*fat/i)).toBeInTheDocument()

      // Step 4: Verify total calculations account for all restrictions
      const totalCost = within(costCalculator).getByTestId('total-cost')
      const baseCost = parseFloat(totalCost.textContent?.match(/\$(\d+\.?\d*)/)?.[1] || '0')
      
      // Should be higher than base cost due to dietary restrictions
      expect(baseCost).toBeGreaterThan(15) // Base would be ~$12, with restrictions ~$18

      // Step 5: Test portion size optimization for dietary needs
      const optimizeButton = within(nutritionCalculator).getByRole('button', { 
        name: /optimize portions/i 
      })
      await user.click(optimizeButton)

      await waitFor(() => {
        // Should suggest different portion sizes for different dietary needs
        expect(screen.getByText(/optimized portions/i)).toBeInTheDocument()
        expect(screen.getByText(/keto.*smaller carb portion/i)).toBeInTheDocument()
        expect(screen.getByText(/vegan.*larger protein portion/i)).toBeInTheDocument()
      })
    })
  })

  describe('Shopping List Aggregation Logic', () => {
    it('should correctly aggregate ingredients across multiple meals and handle unit conversions', async () => {
      simulateAuthentication()

      const mockMealPlan = {
        tripId: 'shopping-trip',
        meals: [
          {
            id: 'meal-1',
            name: 'Breakfast Pancakes',
            servings: 6,
            ingredients: [
              { name: 'Flour', amount: 500, unit: 'g' },
              { name: 'Milk', amount: 400, unit: 'ml' },
              { name: 'Eggs', amount: 3, unit: 'pieces' }
            ]
          },
          {
            id: 'meal-2',
            name: 'Lunch Pasta',
            servings: 6,
            ingredients: [
              { name: 'Flour', amount: 200, unit: 'g' }, // Should aggregate with breakfast
              { name: 'Milk', amount: 0.1, unit: 'l' }, // Should convert and aggregate (100ml)
              { name: 'Tomatoes', amount: 800, unit: 'g' }
            ]
          },
          {
            id: 'meal-3',
            name: 'Dinner Bread',
            servings: 6,
            ingredients: [
              { name: 'Flour', amount: 0.3, unit: 'kg' }, // Should convert and aggregate (300g)
              { name: 'Eggs', amount: 2, unit: 'pieces' },
              { name: 'Tomatoes', amount: 0.4, unit: 'kg' } // Should convert and aggregate (400g)
            ]
          }
        ]
      }

      renderWithProviders(
        <ShoppingListGenerator 
          tripId="shopping-trip" 
          mealPlan={mockMealPlan}
        />
      )

      const generateButton = screen.getByRole('button', { name: /generate shopping list/i })
      await user.click(generateButton)

      await waitFor(() => {
        const shoppingList = screen.getByTestId('generated-shopping-list')
        
        // Step 1: Verify flour aggregation (500g + 200g + 300g = 1000g = 1kg)
        expect(within(shoppingList).getByText(/flour.*1\.0.*kg/i)).toBeInTheDocument()
        
        // Step 2: Verify milk aggregation with unit conversion (400ml + 100ml = 500ml = 0.5L)
        expect(within(shoppingList).getByText(/milk.*0?\.?5.*l/i)).toBeInTheDocument()
        
        // Step 3: Verify eggs aggregation (3 + 2 = 5 pieces)
        expect(within(shoppingList).getByText(/eggs.*5.*pieces/i)).toBeInTheDocument()
        
        // Step 4: Verify tomatoes aggregation with unit conversion (800g + 400g = 1200g = 1.2kg)
        expect(within(shoppingList).getByText(/tomatoes.*1\.2.*kg/i)).toBeInTheDocument()
      })

      // Step 5: Test smart rounding options
      const roundingOptions = screen.getByTestId('rounding-options')
      
      const smartRoundingCheckbox = within(roundingOptions).getByLabelText(/smart rounding/i)
      await user.click(smartRoundingCheckbox)

      await waitFor(() => {
        const updatedList = screen.getByTestId('generated-shopping-list')
        
        // Should round to practical shopping units
        expect(within(updatedList).getByText(/milk.*1.*l/i)).toBeInTheDocument() // Rounded up from 0.5L
        expect(within(updatedList).getByText(/eggs.*6.*pieces/i)).toBeInTheDocument() // Rounded up to half dozen
      })

      // Step 6: Test bulk buying suggestions
      const bulkOptimizationCheckbox = within(roundingOptions).getByLabelText(/bulk optimization/i)
      await user.click(bulkOptimizationCheckbox)

      await waitFor(() => {
        expect(screen.getByText(/bulk buying opportunities/i)).toBeInTheDocument()
        expect(screen.getByText(/flour.*buy 2kg bag.*save \$\d+/i)).toBeInTheDocument()
      })
    })

    it('should handle complex ingredient substitutions and allergies', async () => {
      simulateAuthentication()

      const mockMealPlan = {
        tripId: 'allergy-trip',
        participants: [
          { id: 'p1', allergies: ['nuts', 'dairy'] },
          { id: 'p2', allergies: ['gluten'] },
          { id: 'p3', allergies: [] }
        ],
        meals: [
          {
            id: 'problematic-meal',
            name: 'Challenging Recipe',
            ingredients: [
              { 
                name: 'Wheat Flour', 
                amount: 500, 
                unit: 'g',
                allergens: ['gluten'],
                substitutes: [
                  { name: 'Almond Flour', amount: 400, unit: 'g', allergens: ['nuts'] },
                  { name: 'Rice Flour', amount: 500, unit: 'g', allergens: [] }
                ]
              },
              { 
                name: 'Milk', 
                amount: 300, 
                unit: 'ml',
                allergens: ['dairy'],
                substitutes: [
                  { name: 'Almond Milk', amount: 300, unit: 'ml', allergens: ['nuts'] },
                  { name: 'Oat Milk', amount: 300, unit: 'ml', allergens: [] }
                ]
              },
              {
                name: 'Walnuts',
                amount: 100,
                unit: 'g',
                allergens: ['nuts'],
                substitutes: [
                  { name: 'Sunflower Seeds', amount: 80, unit: 'g', allergens: [] }
                ]
              }
            ]
          }
        ]
      }

      renderWithProviders(
        <ShoppingListGenerator 
          tripId="allergy-trip" 
          mealPlan={mockMealPlan}
        />
      )

      const generateButton = screen.getByRole('button', { name: /generate shopping list/i })
      await user.click(generateButton)

      // Step 1: Should detect allergen conflicts
      await waitFor(() => {
        expect(screen.getByText(/allergen conflicts detected/i)).toBeInTheDocument()
        expect(screen.getByText(/3 participants affected/i)).toBeInTheDocument()
      })

      // Step 2: Should suggest safe substitutions
      const substitutionPanel = screen.getByTestId('allergen-substitutions')
      
      expect(within(substitutionPanel).getByText(/wheat flour.*rice flour/i)).toBeInTheDocument()
      expect(within(substitutionPanel).getByText(/milk.*oat milk/i)).toBeInTheDocument()
      expect(within(substitutionPanel).getByText(/walnuts.*sunflower seeds/i)).toBeInTheDocument()

      // Step 3: Apply substitutions
      const applySubstitutionsButton = screen.getByRole('button', { 
        name: /apply safe substitutions/i 
      })
      await user.click(applySubstitutionsButton)

      // Step 4: Verify substituted shopping list
      await waitFor(() => {
        const finalList = screen.getByTestId('generated-shopping-list')
        
        expect(within(finalList).getByText(/rice flour.*500.*g/i)).toBeInTheDocument()
        expect(within(finalList).getByText(/oat milk.*300.*ml/i)).toBeInTheDocument()
        expect(within(finalList).getByText(/sunflower seeds.*80.*g/i)).toBeInTheDocument()
        
        // Original allergen ingredients should not appear
        expect(within(finalList).queryByText(/wheat flour/i)).not.toBeInTheDocument()
        expect(within(finalList).queryByText(/^milk$/i)).not.toBeInTheDocument()
        expect(within(finalList).queryByText(/walnuts/i)).not.toBeInTheDocument()
      })

      // Step 5: Verify cost adjustment for substitutions
      const costSummary = screen.getByTestId('cost-summary')
      expect(within(costSummary).getByText(/substitution cost adjustment.*\+\$\d+/i)).toBeInTheDocument()

      // Step 6: Test alternative substitution scenarios
      const alternativeButton = screen.getByRole('button', { name: /view alternatives/i })
      await user.click(alternativeButton)

      expect(screen.getByText(/alternative substitution scenarios/i)).toBeInTheDocument()
      expect(screen.getByText(/scenario 1.*rice flour \+ oat milk/i)).toBeInTheDocument()
      expect(screen.getByText(/scenario 2.*different combinations/i)).toBeInTheDocument()
    })
  })

  describe('Cost Calculation Accuracy', () => {
    it('should calculate precise costs with regional pricing and seasonal adjustments', async () => {
      simulateAuthentication()

      const mockPricingData = {
        region: 'US-West',
        season: 'summer',
        ingredients: [
          { 
            name: 'Tomatoes', 
            basePrice: 3.50, 
            unit: 'kg',
            seasonalMultiplier: 0.7, // Summer discount
            regionalMultiplier: 1.1   // West coast premium
          },
          { 
            name: 'Avocados', 
            basePrice: 2.00, 
            unit: 'piece',
            seasonalMultiplier: 0.8,
            regionalMultiplier: 0.9   // West coast discount
          },
          { 
            name: 'Organic Flour', 
            basePrice: 4.00, 
            unit: 'kg',
            seasonalMultiplier: 1.0,  // No seasonal variation
            regionalMultiplier: 1.2,  // Organic premium in region
            bulkDiscounts: [
              { minQuantity: 2, discount: 0.1 },
              { minQuantity: 5, discount: 0.15 }
            ]
          }
        ]
      }

      const mockShoppingList = {
        items: [
          { name: 'Tomatoes', amount: 2.5, unit: 'kg' },
          { name: 'Avocados', amount: 8, unit: 'pieces' },
          { name: 'Organic Flour', amount: 3, unit: 'kg' }
        ]
      }

      renderWithProviders(
        <CostCalculator 
          shoppingList={mockShoppingList}
          pricingData={mockPricingData}
          includeSeasonalAdjustments={true}
          includeBulkDiscounts={true}
        />
      )

      await waitFor(() => {
        const costCalculator = screen.getByTestId('cost-calculator')
        
        // Step 1: Verify individual item calculations
        // Tomatoes: 3.50 * 0.7 * 1.1 * 2.5 = $6.74
        expect(within(costCalculator).getByText(/tomatoes.*\$6\.74/i)).toBeInTheDocument()
        
        // Avocados: 2.00 * 0.8 * 0.9 * 8 = $11.52
        expect(within(costCalculator).getByText(/avocados.*\$11\.52/i)).toBeInTheDocument()
        
        // Organic Flour: 4.00 * 1.0 * 1.2 * 3 * 0.9 (10% bulk discount) = $12.96
        expect(within(costCalculator).getByText(/organic flour.*\$12\.96/i)).toBeInTheDocument()
      })

      // Step 2: Verify breakdown displays
      const breakdown = screen.getByTestId('price-breakdown')
      
      expect(within(breakdown).getByText(/base prices.*\$32\.00/i)).toBeInTheDocument()
      expect(within(breakdown).getByText(/seasonal adjustments.*-\$4\.48/i)).toBeInTheDocument()
      expect(within(breakdown).getByText(/regional adjustments.*\+\$2\.70/i)).toBeInTheDocument()
      expect(within(breakdown).getByText(/bulk discounts.*-\$1\.44/i)).toBeInTheDocument()

      // Step 3: Verify total calculation
      expect(within(costCalculator).getByText(/total.*\$31\.22/i)).toBeInTheDocument()

      // Step 4: Test tax calculations
      const taxToggle = screen.getByLabelText(/include tax/i)
      await user.click(taxToggle)

      const taxRateInput = screen.getByLabelText(/tax rate/i)
      await user.clear(taxRateInput)
      await user.type(taxRateInput, '8.25')

      await waitFor(() => {
        // Total with tax: $31.22 * 1.0825 = $33.79
        expect(within(costCalculator).getByText(/total.*\$33\.79/i)).toBeInTheDocument()
        expect(within(costCalculator).getByText(/tax.*\$2\.57/i)).toBeInTheDocument()
      })

      // Step 5: Test currency conversion
      const currencySelect = screen.getByLabelText(/currency/i)
      await user.selectOptions(currencySelect, 'EUR')

      await waitFor(() => {
        // Assuming 1 USD = 0.85 EUR
        expect(within(costCalculator).getByText(/total.*€28\.72/i)).toBeInTheDocument()
      })

      // Step 6: Test cost per person calculation
      const participantInput = screen.getByLabelText(/number of participants/i)
      await user.clear(participantInput)
      await user.type(participantInput, '6')

      await waitFor(() => {
        expect(within(costCalculator).getByText(/per person.*€4\.79/i)).toBeInTheDocument()
      })
    })

    it('should handle complex budget scenarios and cost optimization', async () => {
      simulateAuthentication()

      const mockBudgetTrip = {
        totalBudget: 150,
        currency: 'USD',
        participants: 8,
        days: 3,
        mealsPerDay: 3
      }

      const mockCurrentCost = 180 // Over budget

      renderWithProviders(
        <div>
          <CostCalculator 
            tripBudget={mockBudgetTrip}
            currentCost={mockCurrentCost}
          />
        </div>
      )

      // Step 1: Verify budget analysis
      const budgetAnalysis = screen.getByTestId('budget-analysis')
      
      expect(within(budgetAnalysis).getByText(/over budget.*\$30/i)).toBeInTheDocument()
      expect(within(budgetAnalysis).getByText(/exceeds by 20%/i)).toBeInTheDocument()

      // Step 2: Should show cost optimization suggestions
      await waitFor(() => {
        expect(screen.getByText(/cost optimization suggestions/i)).toBeInTheDocument()
      })

      const optimizationPanel = screen.getByTestId('optimization-suggestions')
      
      expect(within(optimizationPanel).getByText(/replace expensive ingredients/i)).toBeInTheDocument()
      expect(within(optimizationPanel).getByText(/buy in bulk/i)).toBeInTheDocument()
      expect(within(optimizationPanel).getByText(/reduce portion sizes/i)).toBeInTheDocument()

      // Step 3: Test specific optimization strategies
      const bulkBuyingButton = within(optimizationPanel).getByRole('button', { 
        name: /apply bulk buying/i 
      })
      await user.click(bulkBuyingButton)

      await waitFor(() => {
        expect(screen.getByText(/bulk buying applied/i)).toBeInTheDocument()
        expect(screen.getByText(/new total.*\$165/i)).toBeInTheDocument() // Reduced but still over
      })

      // Step 4: Apply ingredient substitutions
      const substitutionButton = within(optimizationPanel).getByRole('button', { 
        name: /substitute expensive items/i 
      })
      await user.click(substitutionButton)

      const substitutionModal = screen.getByRole('dialog', { name: /ingredient substitutions/i })
      
      // Should show substitution options
      expect(within(substitutionModal).getByText(/organic beef.*ground turkey/i)).toBeInTheDocument()
      expect(within(substitutionModal).getByText(/pine nuts.*sunflower seeds/i)).toBeInTheDocument()
      
      const applySubstitutionsButton = within(substitutionModal).getByRole('button', { 
        name: /apply selected/i 
      })
      await user.click(applySubstitutionsButton)

      await waitFor(() => {
        expect(screen.getByText(/new total.*\$142/i)).toBeInTheDocument() // Now under budget
        expect(screen.getByText(/under budget.*\$8/i)).toBeInTheDocument()
      })

      // Step 5: Test per-meal budget allocation
      const mealAllocationButton = screen.getByRole('button', { name: /view meal allocation/i })
      await user.click(mealAllocationButton)

      const allocationBreakdown = screen.getByTestId('meal-allocation')
      
      // Budget per meal: $150 / (3 days * 3 meals) = $16.67 per meal
      expect(within(allocationBreakdown).getByText(/breakfast.*\$16\.67/i)).toBeInTheDocument()
      expect(within(allocationBreakdown).getByText(/lunch.*\$16\.67/i)).toBeInTheDocument()
      expect(within(allocationBreakdown).getByText(/dinner.*\$16\.67/i)).toBeInTheDocument()

      // Should show which meals are over/under budget
      expect(within(allocationBreakdown).getByText(/dinner day 1.*over budget/i)).toBeInTheDocument()
      expect(within(allocationBreakdown).getByText(/breakfast day 2.*under budget/i)).toBeInTheDocument()
    })
  })

  describe('Nutritional Calculations and Dietary Analysis', () => {
    it('should calculate comprehensive nutritional information across complex meal plans', async () => {
      simulateAuthentication()

      const mockNutritionData = {
        participants: [
          { 
            id: 'athlete', 
            profile: { weight: 75, height: 180, age: 25, activityLevel: 'high' },
            nutritionalNeeds: { calories: 3000, protein: 150, carbs: 400, fat: 100 }
          },
          { 
            id: 'child', 
            profile: { weight: 30, height: 120, age: 8, activityLevel: 'moderate' },
            nutritionalNeeds: { calories: 1800, protein: 60, carbs: 250, fat: 60 }
          },
          { 
            id: 'senior', 
            profile: { weight: 65, height: 165, age: 70, activityLevel: 'low' },
            nutritionalNeeds: { calories: 1600, protein: 80, carbs: 180, fat: 55 }
          }
        ],
        mealPlan: {
          day1: {
            breakfast: {
              recipe: 'oatmeal',
              nutrition: { calories: 350, protein: 12, carbs: 60, fat: 8 },
              servings: 3
            },
            lunch: {
              recipe: 'grilled chicken salad',
              nutrition: { calories: 420, protein: 35, carbs: 15, fat: 25 },
              servings: 3
            },
            dinner: {
              recipe: 'salmon with rice',
              nutrition: { calories: 650, protein: 40, carbs: 80, fat: 20 },
              servings: 3
            }
          }
        }
      }

      renderWithProviders(
        <NutritionCalculator 
          participants={mockNutritionData.participants}
          mealPlan={mockNutritionData.mealPlan}
        />
      )

      await waitFor(() => {
        const nutritionCalculator = screen.getByTestId('nutrition-calculator')
        
        // Step 1: Verify daily totals per person
        // Total per person: 350 + 420 + 650 = 1420 calories
        expect(within(nutritionCalculator).getByText(/daily total.*1420.*calories/i)).toBeInTheDocument()
        expect(within(nutritionCalculator).getByText(/protein.*87.*g/i)).toBeInTheDocument()
        expect(within(nutritionCalculator).getByText(/carbs.*155.*g/i)).toBeInTheDocument()
        expect(within(nutritionCalculator).getByText(/fat.*53.*g/i)).toBeInTheDocument()
      })

      // Step 2: Verify individual participant analysis
      const participantAnalysis = screen.getByTestId('participant-analysis')
      
      // Athlete needs 3000 calories, getting 1420 = 47% of needs
      expect(within(participantAnalysis).getByText(/athlete.*47%.*calorie needs/i)).toBeInTheDocument()
      expect(within(participantAnalysis).getByText(/needs additional 1580 calories/i)).toBeInTheDocument()
      
      // Child needs 1800 calories, getting 1420 = 79% of needs
      expect(within(participantAnalysis).getByText(/child.*79%.*calorie needs/i)).toBeInTheDocument()
      
      // Senior needs 1600 calories, getting 1420 = 89% of needs
      expect(within(participantAnalysis).getByText(/senior.*89%.*calorie needs/i)).toBeInTheDocument()

      // Step 3: Test macro ratio analysis
      const macroAnalysis = screen.getByTestId('macro-analysis')
      
      // Protein: 87g * 4 = 348 calories = 24.5% of total
      expect(within(macroAnalysis).getByText(/protein.*24\.5%/i)).toBeInTheDocument()
      
      // Carbs: 155g * 4 = 620 calories = 43.7% of total
      expect(within(macroAnalysis).getByText(/carbs.*43\.7%/i)).toBeInTheDocument()
      
      // Fat: 53g * 9 = 477 calories = 33.6% of total
      expect(within(macroAnalysis).getByText(/fat.*33\.6%/i)).toBeInTheDocument()

      // Step 4: Test dietary recommendations
      const recommendationsPanel = screen.getByTestId('dietary-recommendations')
      
      expect(within(recommendationsPanel).getByText(/add snacks for athlete/i)).toBeInTheDocument()
      expect(within(recommendationsPanel).getByText(/increase protein sources/i)).toBeInTheDocument()
      expect(within(recommendationsPanel).getByText(/balanced macro distribution/i)).toBeInTheDocument()

      // Step 5: Test meal timing optimization
      const timingButton = screen.getByRole('button', { name: /optimize meal timing/i })
      await user.click(timingButton)

      await waitFor(() => {
        expect(screen.getByText(/meal timing suggestions/i)).toBeInTheDocument()
        expect(screen.getByText(/athlete.*pre-workout snack/i)).toBeInTheDocument()
        expect(screen.getByText(/child.*smaller frequent meals/i)).toBeInTheDocument()
        expect(screen.getByText(/senior.*lighter dinner/i)).toBeInTheDocument()
      })

      // Step 6: Test micronutrient analysis
      const micronutrientTab = screen.getByRole('tab', { name: /micronutrients/i })
      await user.click(micronutrientTab)

      const micronutrientPanel = screen.getByTestId('micronutrient-analysis')
      
      expect(within(micronutrientPanel).getByText(/vitamin.*deficiencies/i)).toBeInTheDocument()
      expect(within(micronutrientPanel).getByText(/iron.*adequate/i)).toBeInTheDocument()
      expect(within(micronutrientPanel).getByText(/calcium.*low/i)).toBeInTheDocument()
      expect(within(micronutrientPanel).getByText(/vitamin d.*supplement recommended/i)).toBeInTheDocument()
    })
  })

  describe('Validation and Business Rules', () => {
    it('should enforce complex business rules and validation across the application', async () => {
      simulateAuthentication()

      const mockTrip = {
        id: 'validation-trip',
        startDate: '2024-08-15',
        endDate: '2024-08-17',
        maxParticipants: 10,
        budget: 500,
        organizerId: 'user-1'
      }

      renderWithProviders(
        <div>
          <MealPlanningBoard tripId="validation-trip" trip={mockTrip} />
          <ParticipantManager tripId="validation-trip" trip={mockTrip} />
        </div>
      )

      // Step 1: Test participant limit validation
      const participantManager = screen.getByTestId('participant-manager')
      
      // Add participants up to the limit
      for (let i = 1; i <= 10; i++) {
        const addButton = within(participantManager).getByRole('button', { name: /add participant/i })
        await user.click(addButton)
        
        await user.type(screen.getByLabelText(/email/i), `participant${i}@example.com`)
        
        const inviteButton = screen.getByRole('button', { name: /send invite/i })
        await user.click(inviteButton)
      }

      // Try to add 11th participant (should fail)
      const addButton = within(participantManager).getByRole('button', { name: /add participant/i })
      await user.click(addButton)

      await user.type(screen.getByLabelText(/email/i), 'participant11@example.com')
      
      const inviteButton = screen.getByRole('button', { name: /send invite/i })
      await user.click(inviteButton)

      await waitFor(() => {
        expect(screen.getByText(/maximum participants reached/i)).toBeInTheDocument()
        expect(screen.getByText(/limit is 10 participants/i)).toBeInTheDocument()
      })

      // Step 2: Test meal assignment validation
      const mealPlanningBoard = screen.getByTestId('meal-planning-board')
      
      // Try to assign meal to past date (should fail)
      const pastDateSlot = within(mealPlanningBoard).getByTestId('meal-slot-2024-08-14-dinner')
      await user.click(pastDateSlot)

      await waitFor(() => {
        expect(screen.getByText(/cannot assign meals to past dates/i)).toBeInTheDocument()
      })

      // Step 3: Test budget validation
      // Add expensive meals that exceed budget
      const dinnerSlot = within(mealPlanningBoard).getByTestId('meal-slot-2024-08-15-dinner')
      await user.click(dinnerSlot)

      const expensiveRecipeSelect = screen.getByLabelText(/select recipe/i)
      await user.selectOptions(expensiveRecipeSelect, 'wagyu-steak') // Very expensive option

      const assignButton = screen.getByRole('button', { name: /assign/i })
      await user.click(assignButton)

      await waitFor(() => {
        expect(screen.getByText(/budget exceeded/i)).toBeInTheDocument()
        expect(screen.getByText(/this meal would cost \$\d+/i)).toBeInTheDocument()
        expect(screen.getByText(/remaining budget.*\$\d+/i)).toBeInTheDocument()
      })

      // Should offer alternatives
      expect(screen.getByRole('button', { name: /suggest alternatives/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /increase budget/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /assign anyway/i })).toBeInTheDocument()

      // Step 4: Test dietary restriction validation
      const vegetarianParticipant = within(participantManager).getByTestId('participant-participant5@example.com')
      const editButton = within(vegetarianParticipant).getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const dietaryRestrictionsSelect = screen.getByLabelText(/dietary restrictions/i)
      await user.selectOptions(dietaryRestrictionsSelect, 'vegetarian')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Now try to assign non-vegetarian meal
      await user.click(dinnerSlot)
      await user.selectOptions(expensiveRecipeSelect, 'beef-steak')
      await user.click(assignButton)

      await waitFor(() => {
        expect(screen.getByText(/dietary restriction conflict/i)).toBeInTheDocument()
        expect(screen.getByText(/participant5@example\.com.*vegetarian/i)).toBeInTheDocument()
        expect(screen.getByText(/recipe contains.*beef/i)).toBeInTheDocument()
      })

      // Step 5: Test portion size validation
      const servingsInput = screen.getByLabelText(/servings/i)
      await user.clear(servingsInput)
      await user.type(servingsInput, '0') // Invalid serving size

      await waitFor(() => {
        expect(screen.getByText(/servings must be greater than 0/i)).toBeInTheDocument()
      })

      await user.clear(servingsInput)
      await user.type(servingsInput, '100') // Unreasonably large

      await waitFor(() => {
        expect(screen.getByText(/unusually large serving size/i)).toBeInTheDocument()
        expect(screen.getByText(/did you mean 10 servings/i)).toBeInTheDocument()
      })

      // Step 6: Test trip date validation
      const tripEditButton = screen.getByRole('button', { name: /edit trip/i })
      await user.click(tripEditButton)

      const endDateInput = screen.getByLabelText(/end date/i)
      await user.clear(endDateInput)
      await user.type(endDateInput, '2024-08-14') // Before start date

      const saveTripButton = screen.getByRole('button', { name: /save trip/i })
      await user.click(saveTripButton)

      await waitFor(() => {
        expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument()
      })

      // Step 7: Test permission validation
      // Simulate non-organizer trying to modify trip
      // This would typically be handled by auth context, but we can test the UI response
      const deleteParticipantButton = within(participantManager).getByRole('button', { 
        name: /remove participant1@example\.com/i 
      })
      
      // Mock permission denied scenario
      vi.mocked(fetch).mockRejectedValueOnce({
        status: 403,
        message: 'Insufficient permissions'
      })

      await user.click(deleteParticipantButton)

      await waitFor(() => {
        expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument()
        expect(screen.getByText(/only trip organizers can remove participants/i)).toBeInTheDocument()
      })
    })
  })
})