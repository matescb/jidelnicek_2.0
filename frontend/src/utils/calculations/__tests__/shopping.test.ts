/* eslint-disable @typescript-eslint/no-explicit-any */
import { Decimal } from 'decimal.js';
import {
  normalizeUnitAndQuantity,
  convertToDisplayUnit,
  IngredientAggregator,
  suggestPackageSizes,
  roundShoppingQuantity,
  groupIngredientsByCategory,
  groupIngredientsByStorage,
  calculateTotalWeightAndVolume,
  RecipeIngredient
} from '../shopping';

describe('Shopping Calculations', () => {
  describe('normalizeUnitAndQuantity', () => {
    it('should convert weight units to grams', () => {
      expect(normalizeUnitAndQuantity('kg', new Decimal(1))).toEqual({
        unit: 'g',
        quantity: new Decimal(1000)
      });
      
      expect(normalizeUnitAndQuantity('oz', new Decimal(1))).toEqual({
        unit: 'g',
        quantity: new Decimal(28.3495)
      });
      
      expect(normalizeUnitAndQuantity('lb', new Decimal(2))).toEqual({
        unit: 'g',
        quantity: new Decimal(907.184)
      });
    });

    it('should convert volume units to milliliters', () => {
      expect(normalizeUnitAndQuantity('l', new Decimal(1))).toEqual({
        unit: 'ml',
        quantity: new Decimal(1000)
      });
      
      expect(normalizeUnitAndQuantity('cup', new Decimal(2))).toEqual({
        unit: 'ml',
        quantity: new Decimal(473.176)
      });
      
      expect(normalizeUnitAndQuantity('tbsp', new Decimal(3))).toEqual({
        unit: 'ml',
        quantity: new Decimal(44.3604)
      });
    });

    it('should keep non-standard units as is', () => {
      expect(normalizeUnitAndQuantity('piece', new Decimal(5))).toEqual({
        unit: 'piece',
        quantity: new Decimal(5)
      });
      
      expect(normalizeUnitAndQuantity('pinch', new Decimal(2))).toEqual({
        unit: 'pinch',
        quantity: new Decimal(2)
      });
    });
  });

  describe('convertToDisplayUnit', () => {
    it('should convert grams to kg when appropriate', () => {
      expect(convertToDisplayUnit(new Decimal(1500), 'g')).toEqual({
        quantity: new Decimal(1.5),
        unit: 'kg'
      });
      
      expect(convertToDisplayUnit(new Decimal(500), 'g')).toEqual({
        quantity: new Decimal(500),
        unit: 'g'
      });
    });

    it('should convert milliliters to liters when appropriate', () => {
      expect(convertToDisplayUnit(new Decimal(2500), 'ml')).toEqual({
        quantity: new Decimal(2.5),
        unit: 'L'
      });
      
      expect(convertToDisplayUnit(new Decimal(750), 'ml')).toEqual({
        quantity: new Decimal(750),
        unit: 'ml'
      });
    });
  });

  describe('IngredientAggregator', () => {
    let aggregator: IngredientAggregator;

    beforeEach(() => {
      aggregator = new IngredientAggregator();
    });

    it('should aggregate ingredients from multiple recipes', () => {
      const recipe1Ingredients: RecipeIngredient[] = [
        {
          ingredientId: 'i1',
          name: 'Flour',
          quantity: 500,
          unit: 'g',
          category: 'pantry'
        },
        {
          ingredientId: 'i2',
          name: 'Milk',
          quantity: 250,
          unit: 'ml',
          category: 'dairy'
        }
      ];

      const recipe2Ingredients: RecipeIngredient[] = [
        {
          ingredientId: 'i1',
          name: 'Flour',
          quantity: 0.3,
          unit: 'kg',
          category: 'pantry'
        },
        {
          ingredientId: 'i3',
          name: 'Eggs',
          quantity: 6,
          unit: 'piece',
          category: 'dairy'
        }
      ];

      aggregator.addRecipeIngredients('r1', 'Recipe 1', 'Breakfast', 1, recipe1Ingredients);
      aggregator.addRecipeIngredients('r2', 'Recipe 2', 'Lunch', 1, recipe2Ingredients);

      const aggregated = aggregator.getAggregatedIngredients();
      
      expect(aggregated).toHaveLength(3);
      
      // Check flour aggregation (500g + 300g)
      const flour = aggregated.find(i => i.name === 'Flour');
      expect(flour?.totalQuantity.toNumber()).toBe(800);
      expect(flour?.unit).toBe('g');
      expect(flour?.sources).toHaveLength(2);
    });

    it('should handle unit conversions during aggregation', () => {
      const ingredients1: RecipeIngredient[] = [
        {
          ingredientId: 'i1',
          name: 'Oil',
          quantity: 500,
          unit: 'ml'
        }
      ];

      const ingredients2: RecipeIngredient[] = [
        {
          ingredientId: 'i1',
          name: 'Oil',
          quantity: 0.5,
          unit: 'L'
        }
      ];

      aggregator.addRecipeIngredients('r1', 'Recipe 1', 'Lunch', 1, ingredients1);
      aggregator.addRecipeIngredients('r2', 'Recipe 2', 'Dinner', 1, ingredients2);

      const aggregated = aggregator.getAggregatedIngredients();
      const oil = aggregated.find(i => i.name === 'Oil');
      
      expect(oil?.totalQuantity.toNumber()).toBe(1000); // 500ml + 500ml
      expect(oil?.unit).toBe('ml');
    });

    it('should throw error on unit mismatch', () => {
      const ingredients1: RecipeIngredient[] = [
        {
          ingredientId: 'i1',
          name: 'Sugar',
          quantity: 100,
          unit: 'g'
        }
      ];

      const ingredients2: RecipeIngredient[] = [
        {
          ingredientId: 'i1',
          name: 'Sugar',
          quantity: 100,
          unit: 'ml' // Different unit type
        }
      ];

      aggregator.addRecipeIngredients('r1', 'Recipe 1', 'Breakfast', 1, ingredients1);
      
      expect(() => {
        aggregator.addRecipeIngredients('r2', 'Recipe 2', 'Lunch', 1, ingredients2);
      }).toThrow('Unit mismatch');
    });

    it('should get ingredients by category', () => {
      const ingredients: RecipeIngredient[] = [
        {
          ingredientId: 'i1',
          name: 'Milk',
          quantity: 1,
          unit: 'L',
          category: 'dairy'
        },
        {
          ingredientId: 'i2',
          name: 'Cheese',
          quantity: 200,
          unit: 'g',
          category: 'dairy'
        },
        {
          ingredientId: 'i3',
          name: 'Bread',
          quantity: 1,
          unit: 'piece',
          category: 'bakery'
        }
      ];

      aggregator.addRecipeIngredients('r1', 'Recipe 1', 'Breakfast', 1, ingredients);
      
      const dairyIngredients = aggregator.getIngredientsByCategory('dairy');
      expect(dairyIngredients).toHaveLength(2);
      expect(dairyIngredients.every(i => i.category === 'dairy')).toBe(true);
    });

    it('should calculate summary statistics', () => {
      const ingredients: RecipeIngredient[] = [
        {
          ingredientId: 'i1',
          name: 'Flour',
          quantity: 1,
          unit: 'kg',
          category: 'pantry'
        },
        {
          ingredientId: 'i2',
          name: 'Milk',
          quantity: 2,
          unit: 'L',
          category: 'dairy'
        },
        {
          ingredientId: 'i3',
          name: 'Sugar',
          quantity: 500,
          unit: 'g',
          category: 'pantry'
        }
      ];

      aggregator.addRecipeIngredients('r1', 'Recipe 1', 'Breakfast', 1, ingredients);
      
      const stats = aggregator.getSummaryStats();
      
      expect(stats.totalIngredients).toBe(3);
      expect(stats.totalCategories).toBe(2);
      expect(stats.totalRecipes).toBe(1);
      expect(stats.totalWeightG).toBe(1500); // 1000g + 500g
      expect(stats.totalVolumeML).toBe(2000); // 2000ml
    });
  });

  describe('suggestPackageSizes', () => {
    it('should suggest appropriate package sizes', () => {
      const suggestions = suggestPackageSizes('flour', new Decimal(3500), 'g');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].count).toBeLessThanOrEqual(suggestions[1]?.count || Infinity);
      
      // Should suggest 1x5kg or 2x2kg or 4x1kg bags
      const fiveKgOption = suggestions.find(s => s.size === 5 && s.unit === 'kg');
      expect(fiveKgOption?.count).toBe(1);
    });

    it('should handle volume-based items', () => {
      const suggestions = suggestPackageSizes('milk', new Decimal(3500), 'ml');
      
      const twoLiterOption = suggestions.find(s => s.size === 2 && s.unit === 'l');
      expect(twoLiterOption?.count).toBe(2); // Need 2x2L for 3.5L
    });
  });

  describe('roundShoppingQuantity', () => {
    it('should round weight quantities appropriately', () => {
      expect(roundShoppingQuantity(new Decimal(123), 'g')).toEqual({
        quantity: new Decimal(150),
        unit: 'g',
        displayText: '150 g'
      });
      
      expect(roundShoppingQuantity(new Decimal(1234), 'g')).toEqual({
        quantity: new Decimal(1.3),
        unit: 'kg',
        displayText: '1.3 kg'
      });
    });

    it('should round volume quantities appropriately', () => {
      expect(roundShoppingQuantity(new Decimal(78), 'ml')).toEqual({
        quantity: new Decimal(80),
        unit: 'ml',
        displayText: '80 ml'
      });
      
      expect(roundShoppingQuantity(new Decimal(1456), 'ml')).toEqual({
        quantity: new Decimal(1.5),
        unit: 'L',
        displayText: '1.5 L'
      });
    });

    it('should round pieces to whole numbers', () => {
      expect(roundShoppingQuantity(new Decimal(3.2), 'piece')).toEqual({
        quantity: new Decimal(4),
        unit: 'piece',
        displayText: '4 piece'
      });
    });
  });

  describe('groupIngredientsByCategory', () => {
    it('should group ingredients correctly', () => {
      const ingredients = [
        {
          ingredientId: 'i1',
          name: 'Milk',
          totalQuantity: new Decimal(1000),
          unit: 'ml',
          sources: [],
          category: 'dairy'
        },
        {
          ingredientId: 'i2',
          name: 'Cheese',
          totalQuantity: new Decimal(200),
          unit: 'g',
          sources: [],
          category: 'dairy'
        },
        {
          ingredientId: 'i3',
          name: 'Bread',
          totalQuantity: new Decimal(1),
          unit: 'piece',
          sources: [],
          category: 'bakery'
        },
        {
          ingredientId: 'i4',
          name: 'Unknown',
          totalQuantity: new Decimal(100),
          unit: 'g',
          sources: []
        }
      ];

      const grouped = groupIngredientsByCategory(ingredients);
      
      expect(Object.keys(grouped)).toHaveLength(3);
      expect(grouped['dairy']).toHaveLength(2);
      expect(grouped['bakery']).toHaveLength(1);
      expect(grouped['other']).toHaveLength(1);
    });
  });

  describe('calculateTotalWeightAndVolume', () => {
    it('should calculate totals correctly', () => {
      const ingredients = [
        {
          ingredientId: 'i1',
          name: 'Flour',
          totalQuantity: new Decimal(2500),
          unit: 'g',
          sources: []
        },
        {
          ingredientId: 'i2',
          name: 'Milk',
          totalQuantity: new Decimal(3000),
          unit: 'ml',
          sources: []
        },
        {
          ingredientId: 'i3',
          name: 'Sugar',
          totalQuantity: new Decimal(500),
          unit: 'g',
          sources: []
        },
        {
          ingredientId: 'i4',
          name: 'Eggs',
          totalQuantity: new Decimal(12),
          unit: 'piece',
          sources: []
        }
      ];

      const totals = calculateTotalWeightAndVolume(ingredients);
      
      expect(totals.totalWeightKg).toBe(3); // 2.5kg + 0.5kg
      expect(totals.totalVolumeL).toBe(3); // 3L
    });
  });
});