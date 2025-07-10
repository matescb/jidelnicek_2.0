/**
 * Shopping calculation utilities for ingredient aggregation and quantity scaling
 * 
 * This module handles combining identical ingredients from multiple recipes,
 * normalizing units, and tracking recipe sources for each aggregated ingredient.
 */

import { Decimal } from 'decimal.js';

// Types
export interface RecipeSource {
  recipeId: string;
  recipeName: string;
  mealName: string;
  dayNumber: number;
  quantity: Decimal;
  unit: string;
}

export interface AggregatedIngredient {
  ingredientId: string;
  name: string;
  totalQuantity: Decimal;
  unit: string;
  sources: RecipeSource[];
  category?: string;
  storageType?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  quantity: number | string;
  unit: string;
  category?: string;
  storageType?: string;
}

export interface ShoppingListSummary {
  totalIngredients: number;
  totalCategories: number;
  totalRecipes: number;
  totalWeightG: number;
  totalVolumeML: number;
  categories: string[];
}

export type ShoppingCategory = 
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'bakery'
  | 'pantry'
  | 'frozen'
  | 'beverages'
  | 'condiments'
  | 'spices'
  | 'other';

export type StorageType = 
  | 'refrigerated'
  | 'frozen'
  | 'pantry'
  | 'fresh';

// Unit conversion factors
const WEIGHT_CONVERSIONS: Record<string, Decimal> = {
  'g': new Decimal(1),
  'gram': new Decimal(1),
  'kg': new Decimal(1000),
  'kilogram': new Decimal(1000),
  'mg': new Decimal(0.001),
  'milligram': new Decimal(0.001),
  'oz': new Decimal(28.3495),
  'ounce': new Decimal(28.3495),
  'lb': new Decimal(453.592),
  'pound': new Decimal(453.592),
};

const VOLUME_CONVERSIONS: Record<string, Decimal> = {
  'ml': new Decimal(1),
  'milliliter': new Decimal(1),
  'l': new Decimal(1000),
  'liter': new Decimal(1000),
  'dl': new Decimal(100),
  'deciliter': new Decimal(100),
  'cl': new Decimal(10),
  'centiliter': new Decimal(10),
  'cup': new Decimal(236.588),
  'tbsp': new Decimal(14.7868),
  'tablespoon': new Decimal(14.7868),
  'tsp': new Decimal(4.92892),
  'teaspoon': new Decimal(4.92892),
  'fl oz': new Decimal(29.5735),
  'fluid ounce': new Decimal(29.5735),
  'pt': new Decimal(473.176),
  'pint': new Decimal(473.176),
  'qt': new Decimal(946.353),
  'quart': new Decimal(946.353),
  'gal': new Decimal(3785.41),
  'gallon': new Decimal(3785.41),
};

// Common package sizes for suggestions
const PACKAGE_SIZES: Record<string, Array<{ size: number; unit: string; label: string }>> = {
  // Weight-based items
  flour: [
    { size: 1, unit: 'kg', label: '1 kg bag' },
    { size: 2, unit: 'kg', label: '2 kg bag' },
    { size: 5, unit: 'kg', label: '5 kg bag' },
  ],
  sugar: [
    { size: 500, unit: 'g', label: '500g bag' },
    { size: 1, unit: 'kg', label: '1 kg bag' },
    { size: 2, unit: 'kg', label: '2 kg bag' },
  ],
  rice: [
    { size: 500, unit: 'g', label: '500g bag' },
    { size: 1, unit: 'kg', label: '1 kg bag' },
    { size: 5, unit: 'kg', label: '5 kg bag' },
  ],
  // Volume-based items
  milk: [
    { size: 500, unit: 'ml', label: '500ml carton' },
    { size: 1, unit: 'l', label: '1L carton' },
    { size: 2, unit: 'l', label: '2L carton' },
  ],
  oil: [
    { size: 500, unit: 'ml', label: '500ml bottle' },
    { size: 1, unit: 'l', label: '1L bottle' },
    { size: 2, unit: 'l', label: '2L bottle' },
  ],
};

/**
 * Normalize unit and quantity to base units
 */
export function normalizeUnitAndQuantity(
  unit: string,
  quantity: Decimal
): { unit: string; quantity: Decimal } {
  const unitLower = unit.toLowerCase();
  
  // Check if it's a weight unit
  if (unitLower in WEIGHT_CONVERSIONS) {
    const conversionFactor = WEIGHT_CONVERSIONS[unitLower];
    return { unit: 'g', quantity: quantity.times(conversionFactor) };
  }
  
  // Check if it's a volume unit
  if (unitLower in VOLUME_CONVERSIONS) {
    const conversionFactor = VOLUME_CONVERSIONS[unitLower];
    return { unit: 'ml', quantity: quantity.times(conversionFactor) };
  }
  
  // For other units (piece, pinch, etc.), keep as is
  return { unit, quantity };
}

/**
 * Convert quantity from base unit to display unit
 */
export function convertToDisplayUnit(
  quantity: Decimal,
  baseUnit: string
): { quantity: Decimal; unit: string } {
  // For weight (grams)
  if (baseUnit === 'g') {
    if (quantity.gte(1000)) {
      return { quantity: quantity.dividedBy(1000), unit: 'kg' };
    }
    return { quantity, unit: 'g' };
  }
  
  // For volume (milliliters)
  if (baseUnit === 'ml') {
    if (quantity.gte(1000)) {
      return { quantity: quantity.dividedBy(1000), unit: 'L' };
    }
    return { quantity, unit: 'ml' };
  }
  
  return { quantity, unit: baseUnit };
}

/**
 * Ingredient aggregator class
 */
export class IngredientAggregator {
  private aggregatedIngredients: Map<string, AggregatedIngredient> = new Map();
  private nameToIdMap: Map<string, string> = new Map();
  
  /**
   * Add ingredients from a recipe to the aggregation
   */
  addRecipeIngredients(
    recipeId: string,
    recipeName: string,
    mealName: string,
    dayNumber: number,
    ingredients: RecipeIngredient[]
  ): void {
    for (const ingredient of ingredients) {
      this.addSingleIngredient(
        recipeId,
        recipeName,
        mealName,
        dayNumber,
        ingredient
      );
    }
  }
  
  private addSingleIngredient(
    recipeId: string,
    recipeName: string,
    mealName: string,
    dayNumber: number,
    ingredient: RecipeIngredient
  ): void {
    const quantity = new Decimal(ingredient.quantity);
    const { unit: normalizedUnit, quantity: normalizedQuantity } = 
      normalizeUnitAndQuantity(ingredient.unit, quantity);
    
    const source: RecipeSource = {
      recipeId,
      recipeName,
      mealName,
      dayNumber,
      quantity: normalizedQuantity,
      unit: normalizedUnit
    };
    
    const existingIngredient = this.aggregatedIngredients.get(ingredient.ingredientId);
    
    if (existingIngredient) {
      // Verify units match
      if (existingIngredient.unit !== normalizedUnit) {
        throw new Error(
          `Unit mismatch for ingredient '${ingredient.name}': ` +
          `expected ${existingIngredient.unit}, got ${normalizedUnit}`
        );
      }
      
      // Add quantity and source
      existingIngredient.totalQuantity = existingIngredient.totalQuantity.plus(normalizedQuantity);
      existingIngredient.sources.push(source);
    } else {
      // Create new aggregated ingredient
      const aggregatedIngredient: AggregatedIngredient = {
        ingredientId: ingredient.ingredientId,
        name: ingredient.name,
        totalQuantity: normalizedQuantity,
        unit: normalizedUnit,
        category: ingredient.category,
        storageType: ingredient.storageType,
        sources: [source]
      };
      
      this.aggregatedIngredients.set(ingredient.ingredientId, aggregatedIngredient);
      this.nameToIdMap.set(ingredient.name.toLowerCase(), ingredient.ingredientId);
    }
  }
  
  /**
   * Get all aggregated ingredients sorted by category and name
   */
  getAggregatedIngredients(): AggregatedIngredient[] {
    const ingredients = Array.from(this.aggregatedIngredients.values());
    
    // Sort by category first, then by name
    ingredients.sort((a, b) => {
      const categoryA = a.category || 'zzz';
      const categoryB = b.category || 'zzz';
      
      if (categoryA !== categoryB) {
        return categoryA.localeCompare(categoryB);
      }
      
      return a.name.localeCompare(b.name);
    });
    
    return ingredients;
  }
  
  /**
   * Get ingredient by name (case-insensitive)
   */
  getIngredientByName(name: string): AggregatedIngredient | undefined {
    const ingredientId = this.nameToIdMap.get(name.toLowerCase());
    return ingredientId ? this.aggregatedIngredients.get(ingredientId) : undefined;
  }
  
  /**
   * Get all ingredients in a specific category
   */
  getIngredientsByCategory(category: string): AggregatedIngredient[] {
    return this.getAggregatedIngredients().filter(
      ing => ing.category?.toLowerCase() === category.toLowerCase()
    );
  }
  
  /**
   * Get summary statistics
   */
  getSummaryStats(): ShoppingListSummary {
    const ingredients = this.getAggregatedIngredients();
    const categories = new Set<string>();
    const recipes = new Set<string>();
    
    let totalWeightG = new Decimal(0);
    let totalVolumeML = new Decimal(0);
    
    for (const ingredient of ingredients) {
      if (ingredient.category) {
        categories.add(ingredient.category);
      }
      
      for (const source of ingredient.sources) {
        recipes.add(source.recipeId);
      }
      
      if (ingredient.unit === 'g') {
        totalWeightG = totalWeightG.plus(ingredient.totalQuantity);
      } else if (ingredient.unit === 'ml') {
        totalVolumeML = totalVolumeML.plus(ingredient.totalQuantity);
      }
    }
    
    return {
      totalIngredients: ingredients.length,
      totalCategories: categories.size,
      totalRecipes: recipes.size,
      totalWeightG: totalWeightG.toNumber(),
      totalVolumeML: totalVolumeML.toNumber(),
      categories: Array.from(categories).sort()
    };
  }
  
  /**
   * Clear all aggregated data
   */
  clear(): void {
    this.aggregatedIngredients.clear();
    this.nameToIdMap.clear();
  }
}

/**
 * Suggest package sizes for an ingredient
 */
export function suggestPackageSizes(
  ingredientName: string,
  totalQuantity: Decimal,
  unit: string
): Array<{ size: number; unit: string; label: string; count: number }> {
  const nameLower = ingredientName.toLowerCase();
  const suggestions = [];
  
  // Find matching package sizes
  for (const [key, sizes] of Object.entries(PACKAGE_SIZES)) {
    if (nameLower.includes(key)) {
      for (const packageSize of sizes) {
        // Convert package size to same unit as total quantity
        const packageUnit = packageSize.unit.toLowerCase();
        let packageQuantity = new Decimal(packageSize.size);
        
        // Normalize both to same unit for comparison
        if (unit === 'g' && (packageUnit === 'kg' || packageUnit === 'kilogram')) {
          packageQuantity = packageQuantity.times(1000);
        } else if (unit === 'ml' && (packageUnit === 'l' || packageUnit === 'liter')) {
          packageQuantity = packageQuantity.times(1000);
        }
        
        // Calculate how many packages needed
        const count = totalQuantity.dividedBy(packageQuantity).ceil().toNumber();
        
        suggestions.push({
          ...packageSize,
          count
        });
      }
      break;
    }
  }
  
  // Sort by count (prefer fewer packages)
  suggestions.sort((a, b) => a.count - b.count);
  
  return suggestions;
}

/**
 * Round shopping quantities to practical amounts
 */
export function roundShoppingQuantity(
  quantity: Decimal,
  unit: string,
  ingredientName?: string
): { quantity: Decimal; unit: string; displayText: string } {
  const { quantity: displayQuantity, unit: displayUnit } = 
    convertToDisplayUnit(quantity, unit);
  
  let roundedQuantity: Decimal;
  
  // Round based on unit and size
  if (displayUnit === 'kg') {
    // Round to nearest 0.1 kg
    roundedQuantity = displayQuantity.toDecimalPlaces(1, Decimal.ROUND_UP);
  } else if (displayUnit === 'g') {
    // Round to nearest 50g for quantities > 100g, otherwise to nearest 10g
    if (displayQuantity.gt(100)) {
      roundedQuantity = displayQuantity.dividedBy(50).ceil().times(50);
    } else {
      roundedQuantity = displayQuantity.dividedBy(10).ceil().times(10);
    }
  } else if (displayUnit === 'L') {
    // Round to nearest 0.1 L
    roundedQuantity = displayQuantity.toDecimalPlaces(1, Decimal.ROUND_UP);
  } else if (displayUnit === 'ml') {
    // Round to nearest 50ml for quantities > 100ml, otherwise to nearest 10ml
    if (displayQuantity.gt(100)) {
      roundedQuantity = displayQuantity.dividedBy(50).ceil().times(50);
    } else {
      roundedQuantity = displayQuantity.dividedBy(10).ceil().times(10);
    }
  } else if (unit === 'piece' || unit === 'pcs') {
    // Round up to whole pieces
    roundedQuantity = displayQuantity.ceil();
  } else {
    // For other units, round to 1 decimal place
    roundedQuantity = displayQuantity.toDecimalPlaces(1, Decimal.ROUND_UP);
  }
  
  // Format display text
  const displayText = `${roundedQuantity.toFixed()} ${displayUnit}`;
  
  return {
    quantity: roundedQuantity,
    unit: displayUnit,
    displayText
  };
}

/**
 * Group ingredients by category
 */
export function groupIngredientsByCategory(
  ingredients: AggregatedIngredient[]
): Record<string, AggregatedIngredient[]> {
  const grouped: Record<string, AggregatedIngredient[]> = {};
  
  for (const ingredient of ingredients) {
    const category = ingredient.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(ingredient);
  }
  
  return grouped;
}

/**
 * Group ingredients by storage type
 */
export function groupIngredientsByStorage(
  ingredients: AggregatedIngredient[]
): Record<string, AggregatedIngredient[]> {
  const grouped: Record<string, AggregatedIngredient[]> = {};
  
  for (const ingredient of ingredients) {
    const storage = ingredient.storageType || 'pantry';
    if (!grouped[storage]) {
      grouped[storage] = [];
    }
    grouped[storage].push(ingredient);
  }
  
  return grouped;
}

/**
 * Calculate total weight and volume for a list of ingredients
 */
export function calculateTotalWeightAndVolume(
  ingredients: AggregatedIngredient[]
): { totalWeightKg: number; totalVolumeL: number } {
  let totalWeightG = new Decimal(0);
  let totalVolumeML = new Decimal(0);
  
  for (const ingredient of ingredients) {
    if (ingredient.unit === 'g') {
      totalWeightG = totalWeightG.plus(ingredient.totalQuantity);
    } else if (ingredient.unit === 'ml') {
      totalVolumeML = totalVolumeML.plus(ingredient.totalQuantity);
    }
  }
  
  return {
    totalWeightKg: totalWeightG.dividedBy(1000).toNumber(),
    totalVolumeL: totalVolumeML.dividedBy(1000).toNumber()
  };
}