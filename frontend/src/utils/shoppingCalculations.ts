import type { ShoppingListItem } from '@/store/slices/tripStore'

export interface ConversionRule {
  from: string
  to: string
  factor: number
}

// Unit conversion rules
export const conversionRules: ConversionRule[] = [
  // Weight conversions
  { from: 'kg', to: 'g', factor: 1000 },
  { from: 'g', to: 'kg', factor: 0.001 },
  { from: 'lb', to: 'kg', factor: 0.453592 },
  { from: 'kg', to: 'lb', factor: 2.20462 },
  { from: 'oz', to: 'g', factor: 28.3495 },
  { from: 'g', to: 'oz', factor: 0.035274 },
  
  // Volume conversions
  { from: 'l', to: 'ml', factor: 1000 },
  { from: 'ml', to: 'l', factor: 0.001 },
  { from: 'gal', to: 'l', factor: 3.78541 },
  { from: 'l', to: 'gal', factor: 0.264172 },
  { from: 'cup', to: 'ml', factor: 236.588 },
  { from: 'ml', to: 'cup', factor: 0.00422675 },
  { from: 'tbsp', to: 'ml', factor: 14.7868 },
  { from: 'ml', to: 'tbsp', factor: 0.067628 },
  { from: 'tsp', to: 'ml', factor: 4.92892 },
  { from: 'ml', to: 'tsp', factor: 0.202884 },
]

// Convert quantity from one unit to another
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  if (fromUnit === toUnit) return quantity
  
  // Find direct conversion
  const directRule = conversionRules.find(
    rule => rule.from === fromUnit && rule.to === toUnit
  )
  
  if (directRule) {
    return quantity * directRule.factor
  }
  
  // Try reverse conversion
  const reverseRule = conversionRules.find(
    rule => rule.from === toUnit && rule.to === fromUnit
  )
  
  if (reverseRule) {
    return quantity / reverseRule.factor
  }
  
  // Try two-step conversion (e.g., kg -> g -> oz)
  for (const rule1 of conversionRules) {
    if (rule1.from === fromUnit) {
      for (const rule2 of conversionRules) {
        if (rule2.from === rule1.to && rule2.to === toUnit) {
          return quantity * rule1.factor * rule2.factor
        }
      }
    }
  }
  
  return null
}

// Combine shopping list items with the same ingredient
export function combineShoppingItems(items: ShoppingListItem[]): ShoppingListItem[] {
  const combined = new Map<string, ShoppingListItem>()
  
  items.forEach(item => {
    const key = `${item.name}-${item.unit}`
    const existing = combined.get(key)
    
    if (existing) {
      existing.quantity += item.quantity
      existing.recipes = [...new Set([...existing.recipes, ...item.recipes])]
    } else {
      combined.set(key, { ...item })
    }
  })
  
  return Array.from(combined.values())
}

// Calculate total weight of items (in kg)
export function calculateTotalWeight(items: ShoppingListItem[]): number {
  return items.reduce((total, item) => {
    const weightInKg = convertUnit(item.quantity, item.unit, 'kg')
    return total + (weightInKg || 0)
  }, 0)
}

// Calculate total volume of items (in liters)
export function calculateTotalVolume(items: ShoppingListItem[]): number {
  return items.reduce((total, item) => {
    const volumeInL = convertUnit(item.quantity, item.unit, 'l')
    return total + (volumeInL || 0)
  }, 0)
}

// Group items by storage type
export function groupByStorage(items: ShoppingListItem[]): Record<string, ShoppingListItem[]> {
  const storageTypes = {
    frozen: ['frozen', 'meat', 'seafood'],
    refrigerated: ['dairy', 'produce', 'beverages'],
    pantry: ['grains', 'canned', 'spices', 'condiments', 'snacks', 'bakery'],
  }
  
  const grouped: Record<string, ShoppingListItem[]> = {
    frozen: [],
    refrigerated: [],
    pantry: [],
    other: [],
  }
  
  items.forEach(item => {
    const category = item.category?.toLowerCase() || 'other'
    let assigned = false
    
    for (const [storage, categories] of Object.entries(storageTypes)) {
      if (categories.includes(category)) {
        grouped[storage].push(item)
        assigned = true
        break
      }
    }
    
    if (!assigned) {
      grouped.other.push(item)
    }
  })
  
  return grouped
}

// Calculate serving size multiplier
export function calculateServingMultiplier(
  originalServings: number,
  targetServings: number
): number {
  return targetServings / originalServings
}

// Round quantity to reasonable precision
export function roundQuantity(quantity: number, unit: string): number {
  // For whole units (pieces, etc), round to nearest integer
  if (['piece', 'pieces', 'item', 'items'].includes(unit.toLowerCase())) {
    return Math.round(quantity)
  }
  
  // For small quantities, use more precision
  if (quantity < 1) {
    return Math.round(quantity * 100) / 100
  }
  
  // For medium quantities, round to 1 decimal
  if (quantity < 10) {
    return Math.round(quantity * 10) / 10
  }
  
  // For large quantities, round to nearest integer
  return Math.round(quantity)
}

// Format quantity for display
export function formatQuantity(quantity: number, unit: string): string {
  const rounded = roundQuantity(quantity, unit)
  
  // Remove unnecessary decimals
  if (rounded === Math.floor(rounded)) {
    return rounded.toString()
  }
  
  return rounded.toFixed(rounded < 1 ? 2 : 1)
}

// Calculate package counts
export function calculatePackages(
  quantity: number,
  packageSize: number,
  unit: string
): { packages: number; remainder: number } {
  const packages = Math.floor(quantity / packageSize)
  const remainder = quantity % packageSize
  
  return {
    packages,
    remainder: roundQuantity(remainder, unit),
  }
}

// Estimate shopping list cost (very rough estimate)
export function estimateCost(items: ShoppingListItem[], pricePerUnit?: Record<string, number>): number {
  if (!pricePerUnit) {
    // Default rough estimates per unit
    pricePerUnit = {
      kg: 5, // $5 per kg average
      g: 0.005,
      l: 2, // $2 per liter average
      ml: 0.002,
      piece: 1, // $1 per piece average
    }
  }
  
  return items.reduce((total, item) => {
    const unitPrice = pricePerUnit[item.unit] || 1
    return total + (item.quantity * unitPrice)
  }, 0)
}

// Sort items for efficient shopping route
export function sortByShoppingRoute(items: ShoppingListItem[]): ShoppingListItem[] {
  // Define shopping route order
  const routeOrder = [
    'produce',
    'bakery',
    'dairy',
    'meat',
    'seafood',
    'grains',
    'canned',
    'condiments',
    'spices',
    'snacks',
    'beverages',
    'frozen', // Frozen last to maintain cold chain
    'other',
  ]
  
  return items.sort((a, b) => {
    const aIndex = routeOrder.indexOf(a.category || 'other')
    const bIndex = routeOrder.indexOf(b.category || 'other')
    return aIndex - bIndex
  })
}