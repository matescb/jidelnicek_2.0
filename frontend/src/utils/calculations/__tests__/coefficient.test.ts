/* eslint-disable @typescript-eslint/no-explicit-any */
import { Decimal } from 'decimal.js';
import {
  getEffectiveCoefficient,
  getParticipantCoefficients,
  calculateMealParticipants,
  calculateDailyParticipants,
  calculateTripSummary,
  calculateShoppingQuantities,
  calculateEffectiveParticipantsForRange,
  getParticipantAttendanceSummary,
  Trip,
  TripParticipant,
  TripDay
} from '../coefficient';

describe('Coefficient Calculations', () => {
  const mockParticipants: TripParticipant[] = [
    {
      id: 'p1',
      displayName: 'Adult 1',
      coefficient: 100,
      mealCoefficients: {
        'Breakfast': 80,
        'Lunch': 100,
        'Dinner': 100
      }
    },
    {
      id: 'p2',
      displayName: 'Child 1',
      coefficient: 75,
      attendanceRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-03')
      }
    },
    {
      id: 'p3',
      displayName: 'Adult 2',
      coefficient: 100
    }
  ];

  const mockDays: TripDay[] = [
    {
      id: 'd1',
      dayNumber: 1,
      date: new Date('2024-01-01'),
      meals: [
        { id: 'm1', mealSlot: 'Breakfast', recipeId: 'r1' },
        { id: 'm2', mealSlot: 'Lunch', recipeId: 'r2' },
        { id: 'm3', mealSlot: 'Dinner', recipeId: 'r3' }
      ]
    },
    {
      id: 'd2',
      dayNumber: 2,
      date: new Date('2024-01-02'),
      meals: [
        { id: 'm4', mealSlot: 'Breakfast', recipeId: 'r4' },
        { id: 'm5', mealSlot: 'Lunch', recipeId: 'r5' },
        { id: 'm6', mealSlot: 'Dinner', recipeId: 'r6' }
      ]
    },
    {
      id: 'd3',
      dayNumber: 3,
      date: new Date('2024-01-03'),
      meals: [
        { id: 'm7', mealSlot: 'Breakfast', recipeId: 'r7' },
        { id: 'm8', mealSlot: 'Lunch', recipeId: 'r8' },
        { id: 'm9', mealSlot: 'Dinner', recipeId: 'r9' }
      ]
    },
    {
      id: 'd4',
      dayNumber: 4,
      date: new Date('2024-01-04'),
      meals: [
        { id: 'm10', mealSlot: 'Breakfast', recipeId: 'r10' },
        { id: 'm11', mealSlot: 'Lunch', recipeId: 'r11' },
        { id: 'm12', mealSlot: 'Dinner', recipeId: 'r12' }
      ]
    }
  ];

  const mockTrip: Trip = {
    id: 't1',
    participants: mockParticipants,
    days: mockDays,
    mealSlots: ['Breakfast', 'Lunch', 'Dinner']
  };

  describe('getEffectiveCoefficient', () => {
    it('should convert percentage to decimal', () => {
      expect(getEffectiveCoefficient(100)).toBe(1);
      expect(getEffectiveCoefficient(75)).toBe(0.75);
      expect(getEffectiveCoefficient(50)).toBe(0.5);
      expect(getEffectiveCoefficient(125)).toBe(1.25);
    });
  });

  describe('getParticipantCoefficients', () => {
    it('should get all coefficients for all participants', () => {
      const coefficients = getParticipantCoefficients(mockTrip);
      
      // 3 participants × 3 meal slots = 9 coefficients
      expect(coefficients).toHaveLength(9);
      
      // Check Adult 1's breakfast coefficient
      const adult1Breakfast = coefficients.find(
        c => c.participantId === 'p1' && c.mealSlot === 'Breakfast'
      );
      expect(adult1Breakfast?.coefficient.toNumber()).toBe(80);
    });

    it('should filter by participant', () => {
      const coefficients = getParticipantCoefficients(mockTrip, 'p1');
      
      expect(coefficients).toHaveLength(3);
      expect(coefficients.every(c => c.participantId === 'p1')).toBe(true);
    });

    it('should filter by meal slot', () => {
      const coefficients = getParticipantCoefficients(mockTrip, undefined, 'Breakfast');
      
      expect(coefficients).toHaveLength(3);
      expect(coefficients.every(c => c.mealSlot === 'Breakfast')).toBe(true);
    });
  });

  describe('calculateMealParticipants', () => {
    it('should calculate effective count for a meal', () => {
      const summary = calculateMealParticipants(mockTrip, 'd1', 'Breakfast');
      
      expect(summary.participantCount).toBe(3); // All 3 participants on day 1
      expect(summary.effectiveCount.toNumber()).toBe(2.55); // 0.8 + 0.75 + 1.0
      expect(summary.participants).toHaveLength(3);
    });

    it('should exclude participants not attending', () => {
      const summary = calculateMealParticipants(mockTrip, 'd4', 'Breakfast');
      
      expect(summary.participantCount).toBe(2); // Child 1 not attending on day 4
      expect(summary.effectiveCount.toNumber()).toBe(1.8); // 0.8 + 1.0
    });

    it('should use meal-specific coefficients when available', () => {
      const summary = calculateMealParticipants(mockTrip, 'd1', 'Breakfast');
      
      const adult1 = summary.participants.find(p => p.id === 'p1');
      expect(adult1?.coefficient).toBe(80); // Meal-specific coefficient
      expect(adult1?.effectivePortion).toBe(0.8);
    });

    it('should fall back to base coefficient when meal-specific not available', () => {
      const summary = calculateMealParticipants(mockTrip, 'd1', 'Breakfast');
      
      const child1 = summary.participants.find(p => p.id === 'p2');
      expect(child1?.coefficient).toBe(75); // Base coefficient
      expect(child1?.effectivePortion).toBe(0.75);
    });
  });

  describe('calculateDailyParticipants', () => {
    it('should calculate summary for all meals in a day', () => {
      const summary = calculateDailyParticipants(mockTrip, 'd1');
      
      expect(summary.totalParticipants).toBe(3);
      expect(Object.keys(summary.mealSummaries)).toHaveLength(3);
      
      // Check average effective count
      // Breakfast: 2.55, Lunch: 2.75, Dinner: 2.75
      const expectedAverage = new Decimal(2.55 + 2.75 + 2.75).dividedBy(3);
      expect(summary.averageEffectiveCount.toNumber()).toBeCloseTo(expectedAverage.toNumber(), 2);
    });

    it('should handle days with partial attendance', () => {
      const summary = calculateDailyParticipants(mockTrip, 'd4');
      
      expect(summary.totalParticipants).toBe(2); // Only 2 participants on day 4
    });
  });

  describe('calculateTripSummary', () => {
    it('should calculate overall trip statistics', () => {
      const summary = calculateTripSummary(mockTrip);
      
      expect(summary.totalParticipants).toBe(3);
      expect(summary.dailySummaries).toHaveLength(4);
      
      // Check meal slot totals
      expect(summary.mealSlotTotals['Breakfast'].toNumber()).toBeCloseTo(9.45, 1); // Sum of all breakfast effective counts
      expect(summary.mealSlotTotals['Lunch'].toNumber()).toBeCloseTo(10.25, 1);
      expect(summary.mealSlotTotals['Dinner'].toNumber()).toBeCloseTo(10.25, 1);
    });

    it('should calculate total effective days correctly', () => {
      const summary = calculateTripSummary(mockTrip);
      
      // Sum of average effective counts for all days
      expect(summary.totalEffectiveDays.toNumber()).toBeGreaterThan(8);
      expect(summary.totalEffectiveDays.toNumber()).toBeLessThan(12);
    });
  });

  describe('calculateShoppingQuantities', () => {
    it('should scale quantities by effective participant counts', () => {
      const baseQuantity = new Decimal(100); // 100g per person
      const quantities = calculateShoppingQuantities(mockTrip, baseQuantity);
      
      expect(quantities['Breakfast'].toNumber()).toBeCloseTo(945, 0); // 9.45 × 100
      expect(quantities['Lunch'].toNumber()).toBeCloseTo(1025, 0); // 10.25 × 100
      expect(quantities['Dinner'].toNumber()).toBeCloseTo(1025, 0); // 10.25 × 100
    });

    it('should filter by meal slots when specified', () => {
      const baseQuantity = new Decimal(100);
      const quantities = calculateShoppingQuantities(mockTrip, baseQuantity, ['Breakfast']);
      
      expect(Object.keys(quantities)).toHaveLength(1);
      expect(quantities['Breakfast']).toBeDefined();
    });
  });

  describe('calculateEffectiveParticipantsForRange', () => {
    it('should calculate for specific date range', () => {
      const effective = calculateEffectiveParticipantsForRange(
        mockTrip,
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );
      
      // Average of day 1 and day 2
      expect(effective).toBeGreaterThan(5);
      expect(effective).toBeLessThan(6);
    });

    it('should return 0 for empty range', () => {
      const effective = calculateEffectiveParticipantsForRange(
        mockTrip,
        new Date('2024-01-10'),
        new Date('2024-01-11')
      );
      
      expect(effective).toBe(0);
    });
  });

  describe('getParticipantAttendanceSummary', () => {
    it('should calculate attendance statistics for each participant', () => {
      const summaries = getParticipantAttendanceSummary(mockTrip);
      
      expect(summaries).toHaveLength(3);
      
      // Check Adult 1 (attending all days)
      const adult1 = summaries.find(s => s.participantId === 'p1');
      expect(adult1?.attendingDays).toBe(4);
      expect(adult1?.attendancePercentage).toBe(100);
      
      // Check Child 1 (attending only 3 days)
      const child1 = summaries.find(s => s.participantId === 'p2');
      expect(child1?.attendingDays).toBe(3);
      expect(child1?.attendancePercentage).toBe(75);
    });

    it('should calculate effective contribution correctly', () => {
      const summaries = getParticipantAttendanceSummary(mockTrip);
      
      // Adult 1 with custom meal coefficients
      const adult1 = summaries.find(s => s.participantId === 'p1');
      // Average coefficient: (80 + 100 + 100) / 3 = 93.33%
      // 4 days × 0.9333 = 3.73
      expect(adult1?.effectiveContribution).toBeCloseTo(3.73, 1);
      
      // Child 1 with 75% coefficient for 3 days
      const child1 = summaries.find(s => s.participantId === 'p2');
      // 3 days × 0.75 = 2.25
      expect(child1?.effectiveContribution).toBe(2.25);
    });
  });
});