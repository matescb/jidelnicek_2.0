/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  calculateRecipeNutrition,
  calculatePerServing,
  roundNutritionValues,
  validateNutritionalData,
  calculateDailyNutrition,
  calculateNutritionPerParticipant,
  checkNutritionGoals,
  calculateNutritionBalance,
  getNutritionSummary,
  RecipeIngredientNutrition,
  NutritionalValue,
  DailyNutritionGoals
} from '../nutrition';

describe('Nutrition Calculations', () => {
  const mockIngredients: RecipeIngredientNutrition[] = [
    {
      ingredientId: 'i1',
      ingredientName: 'Chicken Breast',
      quantityG: 200,
      nutritionalValue: {
        calories: 165,
        proteins_g: 31,
        carbohydrates_g: 0,
        fats_g: 3.6,
        fiber_g: 0,
        sodium_mg: 74
      }
    },
    {
      ingredientId: 'i2',
      ingredientName: 'Brown Rice',
      quantityG: 150,
      nutritionalValue: {
        calories: 111,
        proteins_g: 2.6,
        carbohydrates_g: 23,
        fats_g: 0.9,
        fiber_g: 1.8,
        sodium_mg: 5
      }
    },
    {
      ingredientId: 'i3',
      ingredientName: 'Broccoli',
      quantityG: 100,
      nutritionalValue: {
        calories: 34,
        proteins_g: 2.8,
        carbohydrates_g: 6.6,
        fats_g: 0.4,
        fiber_g: 2.6,
        vitamin_c_mg: 89.2
      }
    }
  ];

  describe('calculateRecipeNutrition', () => {
    it('should calculate total nutrition correctly', () => {
      const total = calculateRecipeNutrition(mockIngredients);
      
      // Chicken: 165 * 2 = 330 cal
      // Rice: 111 * 1.5 = 166.5 cal  
      // Broccoli: 34 * 1 = 34 cal
      // Total: 530.5 cal
      expect(total.calories).toBeCloseTo(530.5, 1);
      
      // Proteins: 31*2 + 2.6*1.5 + 2.8*1 = 68.7g
      expect(total.proteins_g).toBeCloseTo(68.7, 1);
      
      // Carbs: 0*2 + 23*1.5 + 6.6*1 = 41.1g
      expect(total.carbohydrates_g).toBeCloseTo(41.1, 1);
      
      // Fats: 3.6*2 + 0.9*1.5 + 0.4*1 = 8.95g
      expect(total.fats_g).toBeCloseTo(8.95, 1);
    });

    it('should handle optional nutrients', () => {
      const total = calculateRecipeNutrition(mockIngredients);
      
      // Fiber from rice and broccoli
      expect(total.fiber_g).toBeCloseTo(5.3, 1);
      
      // Vitamin C only from broccoli
      expect(total.vitamin_c_mg).toBeCloseTo(89.2, 1);
      
      // No vitamin A in any ingredient
      expect(total.vitamin_a_ug).toBeNull();
    });

    it('should throw error for invalid servings', () => {
      expect(() => calculateRecipeNutrition(mockIngredients, 0)).toThrow('Servings must be greater than 0');
      expect(() => calculateRecipeNutrition(mockIngredients, -1)).toThrow('Servings must be greater than 0');
    });
  });

  describe('calculatePerServing', () => {
    it('should divide total nutrition by servings', () => {
      const total = {
        calories: 600,
        proteins_g: 60,
        carbohydrates_g: 45,
        fats_g: 12,
        fiber_g: 6,
        vitamin_c_mg: null
      };
      
      const perServing = calculatePerServing(total, 4);
      
      expect(perServing.calories).toBe(150);
      expect(perServing.proteins_g).toBe(15);
      expect(perServing.carbohydrates_g).toBe(11.25);
      expect(perServing.fats_g).toBe(3);
      expect(perServing.fiber_g).toBe(1.5);
      expect(perServing.vitamin_c_mg).toBeNull();
    });
  });

  describe('roundNutritionValues', () => {
    it('should round values according to precision rules', () => {
      const nutrition = {
        calories: 123.456,
        proteins_g: 12.345,
        carbohydrates_g: 23.456,
        fats_g: 5.678,
        trans_fats_g: 0.123,
        fiber_g: 2.345,
        sodium_mg: 234.567,
        vitamin_b1_mg: 1.234
      };
      
      const rounded = roundNutritionValues(nutrition);
      
      expect(rounded.calories).toBe(123); // 0 decimals
      expect(rounded.proteins_g).toBe(12.3); // 1 decimal
      expect(rounded.carbohydrates_g).toBe(23.5); // 1 decimal
      expect(rounded.fats_g).toBe(5.7); // 1 decimal
      expect(rounded.trans_fats_g).toBe(0.12); // 2 decimals
      expect(rounded.fiber_g).toBe(2.3); // 1 decimal
      expect(rounded.sodium_mg).toBe(235); // 0 decimals
      expect(rounded.vitamin_b1_mg).toBe(1.23); // 2 decimals
    });
  });

  describe('validateNutritionalData', () => {
    it('should identify missing nutritional data', () => {
      const ingredientsWithIssues: RecipeIngredientNutrition[] = [
        {
          ingredientId: 'i1',
          ingredientName: 'Mystery Ingredient',
          quantityG: 100,
          nutritionalValue: null as any // Missing entirely
        },
        {
          ingredientId: 'i2',
          ingredientName: 'Partial Data',
          quantityG: 100,
          nutritionalValue: {
            calories: 100,
            proteins_g: 10,
            // Missing required carbohydrates_g and fats_g
          } as NutritionalValue
        },
        ...mockIngredients
      ];
      
      const validation = validateNutritionalData(ingredientsWithIssues);
      
      expect(validation.missingIngredients).toContain('Mystery Ingredient');
      expect(validation.incompleteIngredients).toHaveLength(1);
      expect(validation.incompleteIngredients[0]).toContain('Partial Data');
      expect(validation.incompleteIngredients[0]).toContain('carbohydrates_g');
      expect(validation.incompleteIngredients[0]).toContain('fats_g');
    });
  });

  describe('calculateDailyNutrition', () => {
    it('should sum nutrition from multiple meals', () => {
      const meals = [
        {
          nutrition: {
            calories: 400,
            proteins_g: 30,
            carbohydrates_g: 40,
            fats_g: 10,
            fiber_g: 5
          },
          servings: 2
        },
        {
          nutrition: {
            calories: 300,
            proteins_g: 20,
            carbohydrates_g: 35,
            fats_g: 8,
            fiber_g: null
          },
          servings: 1
        }
      ];
      
      const daily = calculateDailyNutrition(meals);
      
      expect(daily.calories).toBe(1100); // 400*2 + 300*1
      expect(daily.proteins_g).toBe(80); // 30*2 + 20*1
      expect(daily.carbohydrates_g).toBe(115); // 40*2 + 35*1
      expect(daily.fats_g).toBe(28); // 10*2 + 8*1
      expect(daily.fiber_g).toBe(10); // 5*2 (null ignored)
    });
  });

  describe('checkNutritionGoals', () => {
    const currentNutrition = {
      calories: 1800,
      proteins_g: 60,
      carbohydrates_g: 250,
      fats_g: 65,
      fiber_g: 20,
      sodium_mg: 2500,
      sugars_g: 80
    };

    const goals: DailyNutritionGoals = {
      calories: { min: 1500, max: 2000 },
      proteins_g: { min: 50, max: 100 },
      carbohydrates_g: { min: 200, max: 300 },
      fats_g: { min: 50, max: 70 },
      fiber_g: { min: 25, max: 35 },
      sodium_mg: { max: 2300 },
      sugars_g: { max: 50 }
    };

    it('should check nutrition against goals', () => {
      const statuses = checkNutritionGoals(currentNutrition, goals);
      
      // Calories: 1800 is within 1500-2000
      const calorieStatus = statuses.find(s => s.nutrient === 'calories');
      expect(calorieStatus?.status).toBe('within');
      expect(calorieStatus?.percentage).toBeCloseTo(60, 0); // (1800-1500)/(2000-1500) * 100
      
      // Fiber: 20 is below minimum 25
      const fiberStatus = statuses.find(s => s.nutrient === 'fiber_g');
      expect(fiberStatus?.status).toBe('below');
      expect(fiberStatus?.percentage).toBeCloseTo(80, 0); // 20/25 * 100
      
      // Sodium: 2500 is above maximum 2300
      const sodiumStatus = statuses.find(s => s.nutrient === 'sodium_mg');
      expect(sodiumStatus?.status).toBe('above');
      expect(sodiumStatus?.percentage).toBeCloseTo(108.7, 0); // 2500/2300 * 100
      
      // Sugars: 80 is above maximum 50
      const sugarStatus = statuses.find(s => s.nutrient === 'sugars_g');
      expect(sugarStatus?.status).toBe('above');
    });
  });

  describe('calculateNutritionBalance', () => {
    it('should calculate balance score for well-balanced meal', () => {
      const nutrition = {
        calories: 500,
        proteins_g: 25, // 20% of calories
        carbohydrates_g: 56.25, // 45% of calories
        fats_g: 16.7 // 30% of calories
      };
      
      const score = calculateNutritionBalance(nutrition);
      expect(score).toBeGreaterThan(90); // Well balanced
    });

    it('should give lower score for imbalanced meal', () => {
      const nutrition = {
        calories: 500,
        proteins_g: 5, // 4% of calories (too low)
        carbohydrates_g: 100, // 80% of calories (too high)
        fats_g: 5.5 // 10% of calories (too low)
      };
      
      const score = calculateNutritionBalance(nutrition);
      expect(score).toBeLessThan(50); // Poorly balanced
    });

    it('should return 0 for zero calories', () => {
      const nutrition = {
        calories: 0,
        proteins_g: 0,
        carbohydrates_g: 0,
        fats_g: 0
      };
      
      expect(calculateNutritionBalance(nutrition)).toBe(0);
    });
  });

  describe('getNutritionSummary', () => {
    it('should extract and organize nutrition data', () => {
      const nutrition = {
        calories: 500,
        proteins_g: 25,
        carbohydrates_g: 60,
        fats_g: 15,
        fiber_g: 5,
        sodium_mg: 300,
        sugars_g: 10,
        vitamin_c_mg: 45,
        vitamin_d_ug: 2.5,
        cholesterol_mg: 50
      };
      
      const summary = getNutritionSummary(nutrition);
      
      expect(summary.macros).toEqual({
        calories: 500,
        proteins: 25,
        carbs: 60,
        fats: 15
      });
      
      expect(summary.micros).toEqual({
        fiber: 5,
        sodium: 300,
        sugars: 10
      });
      
      expect(summary.vitamins).toHaveProperty('vitamin_c_mg', 45);
      expect(summary.vitamins).toHaveProperty('vitamin_d_ug', 2.5);
      expect(summary.vitamins).not.toHaveProperty('cholesterol_mg');
      
      expect(summary.balanceScore).toBeGreaterThan(80);
    });
  });
});