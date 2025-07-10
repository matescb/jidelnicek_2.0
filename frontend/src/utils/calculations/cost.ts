/**
 * Cost calculation utilities for shopping lists and budget tracking
 * 
 * This module provides utilities for estimating costs, tracking budgets,
 * and analyzing expenses across categories and participants.
 */

import { Decimal } from 'decimal.js';

// Types
export interface PriceData {
  ingredientId: string;
  pricePerUnit: number;
  unit: string;
  source?: string;
  lastUpdated?: Date;
}

export interface IngredientCost {
  ingredientId: string;
  ingredientName: string;
  quantity: Decimal;
  unit: string;
  unitPrice: Decimal;
  totalCost: Decimal;
  category?: string;
}

export interface CategoryCostBreakdown {
  category: string;
  totalCost: Decimal;
  itemCount: number;
  percentage: number;
  items: IngredientCost[];
}

export interface ParticipantCostBreakdown {
  participantId: string;
  participantName: string;
  effectiveCoefficient: number;
  totalCost: Decimal;
  costPerDay: Decimal;
  costPerMeal: Decimal;
}

export interface BudgetStatus {
  totalBudget: Decimal;
  estimatedCost: Decimal;
  remainingBudget: Decimal;
  percentageUsed: number;
  status: 'under' | 'on-target' | 'over';
}

export interface CostSummary {
  totalCost: Decimal;
  averageCostPerParticipant: Decimal;
  averageCostPerDay: Decimal;
  averageCostPerMeal: Decimal;
  categoryBreakdown: CategoryCostBreakdown[];
  participantBreakdown: ParticipantCostBreakdown[];
}

export interface BudgetTracking {
  budgetId: string;
  name: string;
  totalBudget: number;
  allocations: BudgetAllocation[];
  spent: number;
  remaining: number;
  status: BudgetStatus;
}

export interface BudgetAllocation {
  category: string;
  budgetAmount: number;
  estimatedAmount: number;
  actualAmount?: number;
  variance: number;
  variancePercentage: number;
}

// Price estimation strategies
export enum PriceEstimationStrategy {
  AVERAGE = 'average',
  MEDIAN = 'median',
  CONSERVATIVE = 'conservative', // Higher estimate
  OPTIMISTIC = 'optimistic', // Lower estimate
}

// Default price estimates per category (per kg or per liter)
const DEFAULT_CATEGORY_PRICES: Record<string, { min: number; max: number; unit: string }> = {
  produce: { min: 2, max: 5, unit: 'kg' },
  dairy: { min: 3, max: 8, unit: 'l' },
  meat: { min: 8, max: 25, unit: 'kg' },
  seafood: { min: 15, max: 40, unit: 'kg' },
  bakery: { min: 3, max: 6, unit: 'kg' },
  pantry: { min: 2, max: 8, unit: 'kg' },
  frozen: { min: 4, max: 10, unit: 'kg' },
  beverages: { min: 1, max: 4, unit: 'l' },
  condiments: { min: 5, max: 15, unit: 'l' },
  spices: { min: 20, max: 100, unit: 'kg' },
  other: { min: 3, max: 10, unit: 'kg' },
};

/**
 * Estimate price for an ingredient based on category
 */
export function estimateIngredientPrice(
  category: string | undefined,
  quantity: Decimal,
  unit: string,
  strategy: PriceEstimationStrategy = PriceEstimationStrategy.AVERAGE
): Decimal {
  const categoryPrices = DEFAULT_CATEGORY_PRICES[category || 'other'];
  
  // Convert quantity to standard unit (kg or l)
  let standardQuantity = quantity;
  
  if (unit === 'g') {
    standardQuantity = quantity.dividedBy(1000);
  } else if (unit === 'ml') {
    standardQuantity = quantity.dividedBy(1000);
  }
  
  // Calculate price based on strategy
  let pricePerUnit: number;
  
  switch (strategy) {
    case PriceEstimationStrategy.CONSERVATIVE:
      pricePerUnit = categoryPrices.max;
      break;
    case PriceEstimationStrategy.OPTIMISTIC:
      pricePerUnit = categoryPrices.min;
      break;
    case PriceEstimationStrategy.MEDIAN:
      pricePerUnit = (categoryPrices.min + categoryPrices.max) / 2;
      break;
    case PriceEstimationStrategy.AVERAGE:
    default:
      pricePerUnit = (categoryPrices.min + categoryPrices.max) / 2;
  }
  
  return standardQuantity.times(pricePerUnit);
}

/**
 * Calculate costs for a list of ingredients
 */
export function calculateIngredientCosts(
  ingredients: Array<{
    ingredientId: string;
    name: string;
    quantity: Decimal;
    unit: string;
    category?: string;
  }>,
  prices?: Map<string, PriceData>,
  strategy: PriceEstimationStrategy = PriceEstimationStrategy.AVERAGE
): IngredientCost[] {
  const costs: IngredientCost[] = [];
  
  for (const ingredient of ingredients) {
    let unitPrice: Decimal;
    let totalCost: Decimal;
    
    // Check if we have specific price data
    const priceData = prices?.get(ingredient.ingredientId);
    
    if (priceData) {
      // Use actual price data
      unitPrice = new Decimal(priceData.pricePerUnit);
      
      // Convert if units don't match
      if (priceData.unit !== ingredient.unit) {
        // Simple conversion logic - extend as needed
        if ((priceData.unit === 'kg' && ingredient.unit === 'g') ||
            (priceData.unit === 'l' && ingredient.unit === 'ml')) {
          unitPrice = unitPrice.dividedBy(1000);
        } else if ((priceData.unit === 'g' && ingredient.unit === 'kg') ||
                   (priceData.unit === 'ml' && ingredient.unit === 'l')) {
          unitPrice = unitPrice.times(1000);
        }
      }
      
      totalCost = ingredient.quantity.times(unitPrice);
    } else {
      // Estimate price based on category
      totalCost = estimateIngredientPrice(
        ingredient.category,
        ingredient.quantity,
        ingredient.unit,
        strategy
      );
      unitPrice = totalCost.dividedBy(ingredient.quantity);
    }
    
    costs.push({
      ingredientId: ingredient.ingredientId,
      ingredientName: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      unitPrice,
      totalCost,
      category: ingredient.category
    });
  }
  
  return costs;
}

/**
 * Calculate cost breakdown by category
 */
export function calculateCategoryBreakdown(
  costs: IngredientCost[]
): CategoryCostBreakdown[] {
  const categoryMap = new Map<string, CategoryCostBreakdown>();
  let totalCost = new Decimal(0);
  
  // Group by category
  for (const cost of costs) {
    const category = cost.category || 'other';
    totalCost = totalCost.plus(cost.totalCost);
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        totalCost: new Decimal(0),
        itemCount: 0,
        percentage: 0,
        items: []
      });
    }
    
    const categoryData = categoryMap.get(category)!;
    categoryData.totalCost = categoryData.totalCost.plus(cost.totalCost);
    categoryData.itemCount++;
    categoryData.items.push(cost);
  }
  
  // Calculate percentages and convert to array
  const breakdown = Array.from(categoryMap.values());
  
  for (const category of breakdown) {
    category.percentage = totalCost.isZero() 
      ? 0 
      : category.totalCost.dividedBy(totalCost).times(100).toNumber();
  }
  
  // Sort by total cost descending
  breakdown.sort((a, b) => b.totalCost.minus(a.totalCost).toNumber());
  
  return breakdown;
}

/**
 * Calculate cost per participant based on coefficients
 */
export function calculateParticipantCosts(
  totalCost: Decimal,
  participants: Array<{
    id: string;
    name: string;
    effectiveCoefficient: number;
    attendanceDays: number;
  }>,
  totalDays: number,
  mealsPerDay: number = 3
): ParticipantCostBreakdown[] {
  // Calculate total effective participants
  const totalEffective = participants.reduce(
    (sum, p) => sum.plus(p.effectiveCoefficient),
    new Decimal(0)
  );
  
  if (totalEffective.isZero()) {
    return [];
  }
  
  // Calculate cost per effective participant
  const costPerEffectiveParticipant = totalCost.dividedBy(totalEffective);
  
  // Calculate breakdown for each participant
  return participants.map(participant => {
    const participantCost = costPerEffectiveParticipant.times(participant.effectiveCoefficient);
    const costPerDay = participant.attendanceDays > 0 
      ? participantCost.dividedBy(participant.attendanceDays)
      : new Decimal(0);
    const costPerMeal = participant.attendanceDays > 0
      ? costPerDay.dividedBy(mealsPerDay)
      : new Decimal(0);
    
    return {
      participantId: participant.id,
      participantName: participant.name,
      effectiveCoefficient: participant.effectiveCoefficient,
      totalCost: participantCost,
      costPerDay,
      costPerMeal
    };
  });
}

/**
 * Check budget status
 */
export function checkBudgetStatus(
  totalBudget: number,
  estimatedCost: number
): BudgetStatus {
  const budget = new Decimal(totalBudget);
  const cost = new Decimal(estimatedCost);
  const remaining = budget.minus(cost);
  const percentageUsed = budget.isZero() ? 0 : cost.dividedBy(budget).times(100).toNumber();
  
  let status: 'under' | 'on-target' | 'over';
  
  if (percentageUsed > 100) {
    status = 'over';
  } else if (percentageUsed > 90) {
    status = 'on-target';
  } else {
    status = 'under';
  }
  
  return {
    totalBudget: budget,
    estimatedCost: cost,
    remainingBudget: remaining,
    percentageUsed,
    status
  };
}

/**
 * Create budget allocations by category
 */
export function createBudgetAllocations(
  totalBudget: number,
  categoryBreakdown: CategoryCostBreakdown[],
  customAllocations?: Record<string, number>
): BudgetAllocation[] {
  const allocations: BudgetAllocation[] = [];
  const budget = new Decimal(totalBudget);
  
  for (const category of categoryBreakdown) {
    // Use custom allocation if provided, otherwise use percentage-based
    const budgetAmount = customAllocations?.[category.category] 
      ?? budget.times(category.percentage).dividedBy(100).toNumber();
    
    const estimatedAmount = category.totalCost.toNumber();
    const variance = estimatedAmount - budgetAmount;
    const variancePercentage = budgetAmount === 0 
      ? 0 
      : (variance / budgetAmount) * 100;
    
    allocations.push({
      category: category.category,
      budgetAmount,
      estimatedAmount,
      variance,
      variancePercentage
    });
  }
  
  return allocations;
}

/**
 * Generate cost summary
 */
export function generateCostSummary(
  costs: IngredientCost[],
  participants: Array<{
    id: string;
    name: string;
    effectiveCoefficient: number;
    attendanceDays: number;
  }>,
  totalDays: number,
  mealsPerDay: number = 3
): CostSummary {
  const totalCost = costs.reduce(
    (sum, cost) => sum.plus(cost.totalCost),
    new Decimal(0)
  );
  
  const categoryBreakdown = calculateCategoryBreakdown(costs);
  const participantBreakdown = calculateParticipantCosts(
    totalCost,
    participants,
    totalDays,
    mealsPerDay
  );
  
  const totalEffectiveParticipants = participants.reduce(
    (sum, p) => sum + p.effectiveCoefficient,
    0
  );
  
  const averageCostPerParticipant = totalEffectiveParticipants > 0
    ? totalCost.dividedBy(totalEffectiveParticipants)
    : new Decimal(0);
  
  const averageCostPerDay = totalDays > 0
    ? totalCost.dividedBy(totalDays)
    : new Decimal(0);
  
  const totalMeals = totalDays * mealsPerDay;
  const averageCostPerMeal = totalMeals > 0
    ? totalCost.dividedBy(totalMeals)
    : new Decimal(0);
  
  return {
    totalCost,
    averageCostPerParticipant,
    averageCostPerDay,
    averageCostPerMeal,
    categoryBreakdown,
    participantBreakdown
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: Decimal | number,
  currencyCode: string = 'USD',
  locale: string = 'en-US'
): string {
  const value = amount instanceof Decimal ? amount.toNumber() : amount;
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Calculate price trends over time
 */
export function calculatePriceTrend(
  priceHistory: Array<{ date: Date; price: number }>
): {
  currentPrice: number;
  averagePrice: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  percentageChange: number;
} {
  if (priceHistory.length === 0) {
    return {
      currentPrice: 0,
      averagePrice: 0,
      trend: 'stable',
      percentageChange: 0
    };
  }
  
  // Sort by date
  const sorted = [...priceHistory].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  const currentPrice = sorted[sorted.length - 1].price;
  const averagePrice = sorted.reduce((sum, p) => sum + p.price, 0) / sorted.length;
  
  // Calculate trend based on recent prices
  const recentCount = Math.min(5, sorted.length);
  const recentPrices = sorted.slice(-recentCount);
  const oldPrice = recentPrices[0].price;
  
  const percentageChange = oldPrice === 0 ? 0 : ((currentPrice - oldPrice) / oldPrice) * 100;
  
  let trend: 'increasing' | 'stable' | 'decreasing';
  if (percentageChange > 5) {
    trend = 'increasing';
  } else if (percentageChange < -5) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }
  
  return {
    currentPrice,
    averagePrice,
    trend,
    percentageChange
  };
}