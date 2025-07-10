/* eslint-disable @typescript-eslint/no-explicit-any */
import { Decimal } from 'decimal.js';
import {
  estimateIngredientPrice,
  calculateIngredientCosts,
  calculateCategoryBreakdown,
  calculateParticipantCosts,
  checkBudgetStatus,
  createBudgetAllocations,
  generateCostSummary,
  formatCurrency,
  calculatePriceTrend,
  PriceEstimationStrategy,
  IngredientCost,
  PriceData
} from '../cost';

describe('Cost Calculations', () => {
  describe('estimateIngredientPrice', () => {
    it('should estimate price based on category and strategy', () => {
      // Meat category: min: 8, max: 25 per kg
      const conservativePrice = estimateIngredientPrice(
        'meat',
        new Decimal(500), // 500g
        'g',
        PriceEstimationStrategy.CONSERVATIVE
      );
      expect(conservativePrice.toNumber()).toBe(12.5); // 0.5kg * 25

      const optimisticPrice = estimateIngredientPrice(
        'meat',
        new Decimal(500),
        'g',
        PriceEstimationStrategy.OPTIMISTIC
      );
      expect(optimisticPrice.toNumber()).toBe(4); // 0.5kg * 8

      const averagePrice = estimateIngredientPrice(
        'meat',
        new Decimal(500),
        'g',
        PriceEstimationStrategy.AVERAGE
      );
      expect(averagePrice.toNumber()).toBe(8.25); // 0.5kg * 16.5
    });

    it('should handle volume-based categories', () => {
      // Dairy: min: 3, max: 8 per liter
      const price = estimateIngredientPrice(
        'dairy',
        new Decimal(2000), // 2000ml = 2L
        'ml',
        PriceEstimationStrategy.AVERAGE
      );
      expect(price.toNumber()).toBe(11); // 2L * 5.5
    });

    it('should use other category for unknown categories', () => {
      const price = estimateIngredientPrice(
        undefined,
        new Decimal(1000),
        'g',
        PriceEstimationStrategy.AVERAGE
      );
      // Other category: min: 3, max: 10 per kg
      expect(price.toNumber()).toBe(6.5); // 1kg * 6.5
    });
  });

  describe('calculateIngredientCosts', () => {
    const ingredients = [
      {
        ingredientId: 'i1',
        name: 'Chicken',
        quantity: new Decimal(1000),
        unit: 'g',
        category: 'meat'
      },
      {
        ingredientId: 'i2',
        name: 'Milk',
        quantity: new Decimal(2000),
        unit: 'ml',
        category: 'dairy'
      },
      {
        ingredientId: 'i3',
        name: 'Flour',
        quantity: new Decimal(500),
        unit: 'g',
        category: 'pantry'
      }
    ];

    it('should calculate costs using estimates when no price data', () => {
      const costs = calculateIngredientCosts(ingredients);
      
      expect(costs).toHaveLength(3);
      
      const chickenCost = costs.find(c => c.ingredientName === 'Chicken');
      expect(chickenCost?.totalCost.toNumber()).toBeCloseTo(16.5, 1); // 1kg * avg meat price
      
      const milkCost = costs.find(c => c.ingredientName === 'Milk');
      expect(milkCost?.totalCost.toNumber()).toBeCloseTo(11, 1); // 2L * avg dairy price
    });

    it('should use actual price data when available', () => {
      const prices = new Map<string, PriceData>([
        ['i1', { ingredientId: 'i1', pricePerUnit: 12, unit: 'kg' }],
        ['i2', { ingredientId: 'i2', pricePerUnit: 4, unit: 'l' }]
      ]);
      
      const costs = calculateIngredientCosts(ingredients, prices);
      
      const chickenCost = costs.find(c => c.ingredientName === 'Chicken');
      expect(chickenCost?.totalCost.toNumber()).toBe(12); // 1kg * 12
      
      const milkCost = costs.find(c => c.ingredientName === 'Milk');
      expect(milkCost?.totalCost.toNumber()).toBe(8); // 2L * 4
    });

    it('should handle unit conversions in price data', () => {
      const prices = new Map<string, PriceData>([
        ['i1', { ingredientId: 'i1', pricePerUnit: 0.012, unit: 'g' }] // Price per gram
      ]);
      
      const costs = calculateIngredientCosts([ingredients[0]], prices);
      
      const chickenCost = costs[0];
      expect(chickenCost.totalCost.toNumber()).toBe(12); // 1000g * 0.012
    });
  });

  describe('calculateCategoryBreakdown', () => {
    const costs: IngredientCost[] = [
      {
        ingredientId: 'i1',
        ingredientName: 'Chicken',
        quantity: new Decimal(1000),
        unit: 'g',
        unitPrice: new Decimal(0.015),
        totalCost: new Decimal(15),
        category: 'meat'
      },
      {
        ingredientId: 'i2',
        ingredientName: 'Beef',
        quantity: new Decimal(500),
        unit: 'g',
        unitPrice: new Decimal(0.025),
        totalCost: new Decimal(12.5),
        category: 'meat'
      },
      {
        ingredientId: 'i3',
        ingredientName: 'Milk',
        quantity: new Decimal(2000),
        unit: 'ml',
        unitPrice: new Decimal(0.004),
        totalCost: new Decimal(8),
        category: 'dairy'
      },
      {
        ingredientId: 'i4',
        ingredientName: 'Mystery',
        quantity: new Decimal(100),
        unit: 'g',
        unitPrice: new Decimal(0.05),
        totalCost: new Decimal(5),
        category: undefined
      }
    ];

    it('should group costs by category', () => {
      const breakdown = calculateCategoryBreakdown(costs);
      
      expect(breakdown).toHaveLength(3);
      
      const meatCategory = breakdown.find(b => b.category === 'meat');
      expect(meatCategory?.totalCost.toNumber()).toBe(27.5);
      expect(meatCategory?.itemCount).toBe(2);
      expect(meatCategory?.percentage).toBeCloseTo(67.9, 1); // 27.5/40.5 * 100
      
      const dairyCategory = breakdown.find(b => b.category === 'dairy');
      expect(dairyCategory?.totalCost.toNumber()).toBe(8);
      expect(dairyCategory?.percentage).toBeCloseTo(19.8, 1);
      
      const otherCategory = breakdown.find(b => b.category === 'other');
      expect(otherCategory?.totalCost.toNumber()).toBe(5);
    });

    it('should sort by total cost descending', () => {
      const breakdown = calculateCategoryBreakdown(costs);
      
      expect(breakdown[0].category).toBe('meat'); // Highest cost
      expect(breakdown[1].category).toBe('dairy');
      expect(breakdown[2].category).toBe('other'); // Lowest cost
    });
  });

  describe('calculateParticipantCosts', () => {
    const participants = [
      {
        id: 'p1',
        name: 'Adult 1',
        effectiveCoefficient: 1.0,
        attendanceDays: 5
      },
      {
        id: 'p2',
        name: 'Child 1',
        effectiveCoefficient: 0.75,
        attendanceDays: 5
      },
      {
        id: 'p3',
        name: 'Adult 2',
        effectiveCoefficient: 1.0,
        attendanceDays: 3
      }
    ];

    it('should calculate costs per participant based on coefficients', () => {
      const totalCost = new Decimal(275); // Total trip cost
      const breakdown = calculateParticipantCosts(totalCost, participants, 5, 3);
      
      // Total effective: 1.0 + 0.75 + 1.0 = 2.75
      // Cost per effective participant: 275 / 2.75 = 100
      
      expect(breakdown).toHaveLength(3);
      
      const adult1 = breakdown.find(b => b.participantId === 'p1');
      expect(adult1?.totalCost.toNumber()).toBe(100); // 1.0 * 100
      expect(adult1?.costPerDay.toNumber()).toBe(20); // 100 / 5
      expect(adult1?.costPerMeal.toNumber()).toBeCloseTo(6.67, 2); // 20 / 3
      
      const child1 = breakdown.find(b => b.participantId === 'p2');
      expect(child1?.totalCost.toNumber()).toBe(75); // 0.75 * 100
      expect(child1?.costPerDay.toNumber()).toBe(15); // 75 / 5
      
      const adult2 = breakdown.find(b => b.participantId === 'p3');
      expect(adult2?.totalCost.toNumber()).toBe(100); // 1.0 * 100
      expect(adult2?.costPerDay.toNumber()).toBeCloseTo(33.33, 2); // 100 / 3
    });
  });

  describe('checkBudgetStatus', () => {
    it('should calculate budget status correctly', () => {
      const underBudget = checkBudgetStatus(1000, 800);
      expect(underBudget.status).toBe('under');
      expect(underBudget.percentageUsed).toBe(80);
      expect(underBudget.remainingBudget.toNumber()).toBe(200);
      
      const onTarget = checkBudgetStatus(1000, 950);
      expect(onTarget.status).toBe('on-target');
      expect(onTarget.percentageUsed).toBe(95);
      
      const overBudget = checkBudgetStatus(1000, 1200);
      expect(overBudget.status).toBe('over');
      expect(overBudget.percentageUsed).toBe(120);
      expect(overBudget.remainingBudget.toNumber()).toBe(-200);
    });

    it('should handle zero budget', () => {
      const status = checkBudgetStatus(0, 100);
      expect(status.percentageUsed).toBe(0);
    });
  });

  describe('createBudgetAllocations', () => {
    const categoryBreakdown = [
      {
        category: 'meat',
        totalCost: new Decimal(50),
        itemCount: 2,
        percentage: 50,
        items: []
      },
      {
        category: 'dairy',
        totalCost: new Decimal(30),
        itemCount: 3,
        percentage: 30,
        items: []
      },
      {
        category: 'produce',
        totalCost: new Decimal(20),
        itemCount: 5,
        percentage: 20,
        items: []
      }
    ];

    it('should create allocations based on percentages', () => {
      const allocations = createBudgetAllocations(1000, categoryBreakdown);
      
      expect(allocations).toHaveLength(3);
      
      const meatAllocation = allocations.find(a => a.category === 'meat');
      expect(meatAllocation?.budgetAmount).toBe(500); // 50% of 1000
      expect(meatAllocation?.estimatedAmount).toBe(50);
      expect(meatAllocation?.variance).toBe(-450);
      expect(meatAllocation?.variancePercentage).toBe(-90);
    });

    it('should use custom allocations when provided', () => {
      const customAllocations = {
        'meat': 600,
        'dairy': 250,
        'produce': 150
      };
      
      const allocations = createBudgetAllocations(1000, categoryBreakdown, customAllocations);
      
      const meatAllocation = allocations.find(a => a.category === 'meat');
      expect(meatAllocation?.budgetAmount).toBe(600);
      expect(meatAllocation?.variance).toBe(-550);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(new Decimal(123.456))).toBe('$123.46');
      expect(formatCurrency(1234.5, 'EUR', 'de-DE')).toBe('1.234,50 €');
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('calculatePriceTrend', () => {
    it('should calculate price trends', () => {
      const priceHistory = [
        { date: new Date('2024-01-01'), price: 10 },
        { date: new Date('2024-01-05'), price: 11 },
        { date: new Date('2024-01-10'), price: 12 },
        { date: new Date('2024-01-15'), price: 13 },
        { date: new Date('2024-01-20'), price: 14 }
      ];
      
      const trend = calculatePriceTrend(priceHistory);
      
      expect(trend.currentPrice).toBe(14);
      expect(trend.averagePrice).toBe(12);
      expect(trend.trend).toBe('increasing');
      expect(trend.percentageChange).toBe(40); // (14-10)/10 * 100
    });

    it('should detect stable prices', () => {
      const priceHistory = [
        { date: new Date('2024-01-01'), price: 10 },
        { date: new Date('2024-01-10'), price: 10.2 },
        { date: new Date('2024-01-20'), price: 10.1 }
      ];
      
      const trend = calculatePriceTrend(priceHistory);
      expect(trend.trend).toBe('stable');
    });

    it('should handle empty history', () => {
      const trend = calculatePriceTrend([]);
      
      expect(trend.currentPrice).toBe(0);
      expect(trend.averagePrice).toBe(0);
      expect(trend.trend).toBe('stable');
      expect(trend.percentageChange).toBe(0);
    });
  });

  describe('generateCostSummary', () => {
    it('should generate comprehensive cost summary', () => {
      const costs: IngredientCost[] = [
        {
          ingredientId: 'i1',
          ingredientName: 'Chicken',
          quantity: new Decimal(1000),
          unit: 'g',
          unitPrice: new Decimal(0.015),
          totalCost: new Decimal(15),
          category: 'meat'
        },
        {
          ingredientId: 'i2',
          ingredientName: 'Rice',
          quantity: new Decimal(500),
          unit: 'g',
          unitPrice: new Decimal(0.004),
          totalCost: new Decimal(2),
          category: 'pantry'
        }
      ];
      
      const participants = [
        {
          id: 'p1',
          name: 'Adult 1',
          effectiveCoefficient: 1.0,
          attendanceDays: 3
        },
        {
          id: 'p2',
          name: 'Child 1',
          effectiveCoefficient: 0.5,
          attendanceDays: 3
        }
      ];
      
      const summary = generateCostSummary(costs, participants, 3, 3);
      
      expect(summary.totalCost.toNumber()).toBe(17);
      expect(summary.averageCostPerParticipant.toNumber()).toBeCloseTo(11.33, 2); // 17 / 1.5
      expect(summary.averageCostPerDay.toNumber()).toBeCloseTo(5.67, 2); // 17 / 3
      expect(summary.averageCostPerMeal.toNumber()).toBeCloseTo(1.89, 2); // 17 / 9
      
      expect(summary.categoryBreakdown).toHaveLength(2);
      expect(summary.participantBreakdown).toHaveLength(2);
    });
  });
});