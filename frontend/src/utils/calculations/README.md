# Calculation Utilities

This directory contains frontend calculation utilities that mirror the backend logic for:

## 1. Coefficient Calculations (`coefficient.ts`)

Calculates effective participant counts based on meal-specific coefficients and partial attendance.

```typescript
import { calculateTripSummary, calculateShoppingQuantities } from '@/utils/calculations';
import { Decimal } from 'decimal.js';

// Calculate trip summary with participant coefficients
const tripSummary = calculateTripSummary(trip);
console.log(`Total effective participant-days: ${tripSummary.totalEffectiveDays}`);

// Calculate shopping quantities based on effective counts
const baseQuantity = new Decimal(100); // 100g per person
const quantities = calculateShoppingQuantities(trip, baseQuantity);
console.log(`Need ${quantities['Breakfast']}g for breakfast meals`);
```

## 2. Shopping Calculations (`shopping.ts`)

Aggregates ingredients across recipes, normalizes units, and provides shopping suggestions.

```typescript
import { IngredientAggregator, roundShoppingQuantity, suggestPackageSizes } from '@/utils/calculations';

// Create aggregator and add recipe ingredients
const aggregator = new IngredientAggregator();
aggregator.addRecipeIngredients(
  'recipe1',
  'Pancakes',
  'Breakfast',
  1,
  [
    { ingredientId: 'i1', name: 'Flour', quantity: 500, unit: 'g', category: 'pantry' },
    { ingredientId: 'i2', name: 'Milk', quantity: 0.5, unit: 'L', category: 'dairy' }
  ]
);

// Get aggregated ingredients
const ingredients = aggregator.getAggregatedIngredients();

// Round quantities for shopping
for (const ingredient of ingredients) {
  const rounded = roundShoppingQuantity(ingredient.totalQuantity, ingredient.unit, ingredient.name);
  console.log(`Buy ${rounded.displayText} of ${ingredient.name}`);
  
  // Get package suggestions
  const packages = suggestPackageSizes(ingredient.name, ingredient.totalQuantity, ingredient.unit);
  if (packages.length > 0) {
    console.log(`  Suggestion: Buy ${packages[0].count}x ${packages[0].label}`);
  }
}
```

## 3. Nutrition Calculations (`nutrition.ts`)

Provides high-precision nutritional calculations with proper rounding and goal tracking.

```typescript
import { 
  calculateRecipeNutrition, 
  calculatePerServing, 
  checkNutritionGoals,
  calculateNutritionBalance 
} from '@/utils/calculations';

// Calculate recipe nutrition
const ingredients = [
  {
    ingredientId: 'i1',
    ingredientName: 'Chicken Breast',
    quantityG: 200,
    nutritionalValue: {
      calories: 165,
      proteins_g: 31,
      carbohydrates_g: 0,
      fats_g: 3.6
    }
  }
];

const totalNutrition = calculateRecipeNutrition(ingredients);
const perServing = calculatePerServing(totalNutrition, 4);

// Check against daily goals
const goals = {
  calories: { min: 1500, max: 2000 },
  proteins_g: { min: 50, max: 100 },
  carbohydrates_g: { min: 200, max: 300 },
  fats_g: { min: 50, max: 70 }
};

const goalStatus = checkNutritionGoals(perServing, goals);
const balanceScore = calculateNutritionBalance(perServing);

console.log(`Nutrition balance score: ${balanceScore}/100`);
```

## 4. Cost Calculations (`cost.ts`)

Estimates costs, tracks budgets, and provides per-participant breakdowns.

```typescript
import { 
  calculateIngredientCosts, 
  calculateCategoryBreakdown,
  calculateParticipantCosts,
  formatCurrency,
  PriceEstimationStrategy 
} from '@/utils/calculations';

// Calculate ingredient costs
const ingredients = [
  {
    ingredientId: 'i1',
    name: 'Chicken',
    quantity: new Decimal(1000),
    unit: 'g',
    category: 'meat'
  }
];

const costs = calculateIngredientCosts(ingredients, undefined, PriceEstimationStrategy.AVERAGE);

// Get category breakdown
const categoryBreakdown = calculateCategoryBreakdown(costs);
console.log(`Meat category: ${formatCurrency(categoryBreakdown[0].totalCost)}`);

// Calculate per-participant costs
const participants = [
  { id: 'p1', name: 'Adult 1', effectiveCoefficient: 1.0, attendanceDays: 5 },
  { id: 'p2', name: 'Child 1', effectiveCoefficient: 0.75, attendanceDays: 5 }
];

const totalCost = costs.reduce((sum, c) => sum.plus(c.totalCost), new Decimal(0));
const participantCosts = calculateParticipantCosts(totalCost, participants, 5, 3);

for (const participant of participantCosts) {
  console.log(`${participant.participantName}: ${formatCurrency(participant.totalCost)}`);
  console.log(`  Per day: ${formatCurrency(participant.costPerDay)}`);
  console.log(`  Per meal: ${formatCurrency(participant.costPerMeal)}`);
}
```

## Key Features

- **Type Safety**: Full TypeScript support with comprehensive types
- **Precision**: Uses Decimal.js for accurate financial and quantity calculations
- **Unit Conversion**: Automatic normalization between metric and imperial units
- **Extensibility**: Easy to add new calculation features
- **Performance**: In-memory caching where appropriate
- **Testing**: Comprehensive unit tests for all calculations

## Dependencies

- `decimal.js`: For high-precision decimal arithmetic
- TypeScript built-in types

## Testing

All utilities have comprehensive unit tests in the `__tests__` directory. Run tests with:

```bash
npm test src/utils/calculations/__tests__/
```