/**
 * Coefficient calculation utilities for trip participants
 * 
 * This module provides utilities for calculating effective participant counts
 * based on meal-specific coefficients, supporting scenarios like:
 * - Participants with different coefficients per meal type
 * - Partial trip attendance (arriving/leaving on specific days)
 * - Aggregated calculations for shopping lists and meal planning
 */

import { Decimal } from 'decimal.js';

// Types
export interface ParticipantCoefficient {
  participantId: string;
  participantName: string;
  mealSlot: string;
  coefficient: Decimal;
}

export interface MealParticipantSummary {
  dayId: string;
  dayNumber: number;
  date: Date;
  mealSlot: string;
  participantCount: number;
  effectiveCount: Decimal;
  participants: Array<{
    id: string;
    name: string;
    coefficient: number;
    effectivePortion: number;
  }>;
}

export interface DailyParticipantSummary {
  dayId: string;
  dayNumber: number;
  date: Date;
  totalParticipants: number;
  mealSummaries: Record<string, MealParticipantSummary>;
  averageEffectiveCount: Decimal;
}

export interface TripCoefficientSummary {
  tripId: string;
  totalParticipants: number;
  dailySummaries: DailyParticipantSummary[];
  mealSlotTotals: Record<string, Decimal>;
  totalEffectiveDays: Decimal;
}

export interface AttendanceRange {
  startDate: Date;
  endDate: Date;
}

export interface TripParticipant {
  id: string;
  displayName: string;
  coefficient: number;
  mealCoefficients?: Record<string, number>;
  attendanceRange?: AttendanceRange;
}

export interface TripDay {
  id: string;
  dayNumber: number;
  date: Date;
  meals: Array<{
    id: string;
    mealSlot: string;
    recipeId?: string;
  }>;
}

export interface Trip {
  id: string;
  participants: TripParticipant[];
  days: TripDay[];
  mealSlots: string[];
}

/**
 * Calculate effective participant coefficient
 * @param coefficient Raw coefficient value (e.g., 100 = 100%)
 * @returns Effective coefficient as decimal (e.g., 1.0 = 100%)
 */
export function getEffectiveCoefficient(coefficient: number): number {
  return coefficient / 100;
}

/**
 * Get participant coefficients for a trip
 */
export function getParticipantCoefficients(
  trip: Trip,
  participantId?: string,
  mealSlot?: string
): ParticipantCoefficient[] {
  const coefficients: ParticipantCoefficient[] = [];
  
  for (const participant of trip.participants) {
    if (participantId && participant.id !== participantId) {
      continue;
    }
    
    const mealSlots = trip.mealSlots || ['Breakfast', 'Lunch', 'Dinner'];
    
    for (const slot of mealSlots) {
      if (mealSlot && slot !== mealSlot) {
        continue;
      }
      
      // Get meal-specific coefficient or fall back to base coefficient
      const coefficient = participant.mealCoefficients?.[slot] ?? participant.coefficient;
      
      coefficients.push({
        participantId: participant.id,
        participantName: participant.displayName,
        mealSlot: slot,
        coefficient: new Decimal(coefficient)
      });
    }
  }
  
  return coefficients;
}

/**
 * Check if participant is attending on a specific date
 */
function isParticipantAttending(
  participant: TripParticipant,
  date: Date
): boolean {
  if (!participant.attendanceRange) {
    return true; // No range specified means attending whole trip
  }
  
  const { startDate, endDate } = participant.attendanceRange;
  return date >= startDate && date <= endDate;
}

/**
 * Calculate effective participant count for a specific meal
 */
export function calculateMealParticipants(
  trip: Trip,
  dayId: string,
  mealSlot: string
): MealParticipantSummary {
  const day = trip.days.find(d => d.id === dayId);
  
  if (!day) {
    return {
      dayId,
      dayNumber: 0,
      date: new Date(),
      mealSlot,
      participantCount: 0,
      effectiveCount: new Decimal(0),
      participants: []
    };
  }
  
  const participantsData: Array<{
    id: string;
    name: string;
    coefficient: number;
    effectivePortion: number;
  }> = [];
  
  let effectiveCount = new Decimal(0);
  let participantCount = 0;
  
  for (const participant of trip.participants) {
    // Check attendance
    if (!isParticipantAttending(participant, day.date)) {
      continue;
    }
    
    // Get coefficient for this meal
    const coefficient = participant.mealCoefficients?.[mealSlot] ?? participant.coefficient;
    const effectivePortion = coefficient / 100;
    
    participantsData.push({
      id: participant.id,
      name: participant.displayName,
      coefficient,
      effectivePortion
    });
    
    effectiveCount = effectiveCount.plus(effectivePortion);
    participantCount++;
  }
  
  return {
    dayId: day.id,
    dayNumber: day.dayNumber,
    date: day.date,
    mealSlot,
    participantCount,
    effectiveCount,
    participants: participantsData
  };
}

/**
 * Calculate participant summary for a specific day
 */
export function calculateDailyParticipants(
  trip: Trip,
  dayId: string
): DailyParticipantSummary {
  const day = trip.days.find(d => d.id === dayId);
  
  if (!day) {
    return {
      dayId,
      dayNumber: 0,
      date: new Date(),
      totalParticipants: 0,
      mealSummaries: {},
      averageEffectiveCount: new Decimal(0)
    };
  }
  
  const mealSummaries: Record<string, MealParticipantSummary> = {};
  const mealSlots = trip.mealSlots || ['Breakfast', 'Lunch', 'Dinner'];
  
  for (const mealSlot of mealSlots) {
    mealSummaries[mealSlot] = calculateMealParticipants(trip, dayId, mealSlot);
  }
  
  // Get unique participants for the day
  const uniqueParticipants = new Set<string>();
  Object.values(mealSummaries).forEach(summary => {
    summary.participants.forEach(p => uniqueParticipants.add(p.id));
  });
  
  // Calculate average effective count
  let totalEffective = new Decimal(0);
  const mealCount = Object.keys(mealSummaries).length;
  
  if (mealCount > 0) {
    Object.values(mealSummaries).forEach(summary => {
      totalEffective = totalEffective.plus(summary.effectiveCount);
    });
  }
  
  const averageEffectiveCount = mealCount > 0 
    ? totalEffective.dividedBy(mealCount) 
    : new Decimal(0);
  
  return {
    dayId: day.id,
    dayNumber: day.dayNumber,
    date: day.date,
    totalParticipants: uniqueParticipants.size,
    mealSummaries,
    averageEffectiveCount
  };
}

/**
 * Calculate overall coefficient summary for a trip
 */
export function calculateTripSummary(trip: Trip): TripCoefficientSummary {
  const dailySummaries: DailyParticipantSummary[] = [];
  const mealSlotTotals: Record<string, Decimal> = {};
  
  // Initialize meal slot totals
  const mealSlots = trip.mealSlots || ['Breakfast', 'Lunch', 'Dinner'];
  mealSlots.forEach(slot => {
    mealSlotTotals[slot] = new Decimal(0);
  });
  
  // Process each day
  const sortedDays = [...trip.days].sort((a, b) => a.dayNumber - b.dayNumber);
  
  for (const day of sortedDays) {
    const dailySummary = calculateDailyParticipants(trip, day.id);
    dailySummaries.push(dailySummary);
    
    // Accumulate meal slot totals
    Object.entries(dailySummary.mealSummaries).forEach(([mealSlot, mealSummary]) => {
      mealSlotTotals[mealSlot] = mealSlotTotals[mealSlot].plus(mealSummary.effectiveCount);
    });
  }
  
  // Calculate total effective participant-days
  const totalEffectiveDays = dailySummaries.reduce(
    (total, summary) => total.plus(summary.averageEffectiveCount),
    new Decimal(0)
  );
  
  return {
    tripId: trip.id,
    totalParticipants: trip.participants.length,
    dailySummaries,
    mealSlotTotals,
    totalEffectiveDays
  };
}

/**
 * Calculate shopping quantities based on effective participant counts
 */
export function calculateShoppingQuantities(
  trip: Trip,
  baseQuantity: Decimal,
  mealSlots?: string[]
): Record<string, Decimal> {
  const summary = calculateTripSummary(trip);
  const quantities: Record<string, Decimal> = {};
  
  const slotsToCalculate = mealSlots || Object.keys(summary.mealSlotTotals);
  
  for (const mealSlot of slotsToCalculate) {
    const totalEffective = summary.mealSlotTotals[mealSlot];
    if (totalEffective) {
      quantities[mealSlot] = baseQuantity.times(totalEffective);
    }
  }
  
  return quantities;
}

/**
 * Calculate effective participants for a date range
 */
export function calculateEffectiveParticipantsForRange(
  trip: Trip,
  startDate: Date,
  endDate: Date
): number {
  let totalEffective = new Decimal(0);
  let dayCount = 0;
  
  for (const day of trip.days) {
    if (day.date >= startDate && day.date <= endDate) {
      const dailySummary = calculateDailyParticipants(trip, day.id);
      totalEffective = totalEffective.plus(dailySummary.averageEffectiveCount);
      dayCount++;
    }
  }
  
  return dayCount > 0 ? totalEffective.toNumber() : 0;
}

/**
 * Get participant attendance summary
 */
export function getParticipantAttendanceSummary(trip: Trip): Array<{
  participantId: string;
  participantName: string;
  totalDays: number;
  attendingDays: number;
  attendancePercentage: number;
  effectiveContribution: number;
}> {
  const summaries = [];
  
  for (const participant of trip.participants) {
    let attendingDays = 0;
    let effectiveContribution = new Decimal(0);
    
    for (const day of trip.days) {
      if (isParticipantAttending(participant, day.date)) {
        attendingDays++;
        
        // Calculate average coefficient for the day
        const mealSlots = trip.mealSlots || ['Breakfast', 'Lunch', 'Dinner'];
        let dayTotal = new Decimal(0);
        
        for (const mealSlot of mealSlots) {
          const coefficient = participant.mealCoefficients?.[mealSlot] ?? participant.coefficient;
          dayTotal = dayTotal.plus(coefficient);
        }
        
        const dayAverage = dayTotal.dividedBy(mealSlots.length).dividedBy(100);
        effectiveContribution = effectiveContribution.plus(dayAverage);
      }
    }
    
    const totalDays = trip.days.length;
    const attendancePercentage = totalDays > 0 ? (attendingDays / totalDays) * 100 : 0;
    
    summaries.push({
      participantId: participant.id,
      participantName: participant.displayName,
      totalDays,
      attendingDays,
      attendancePercentage,
      effectiveContribution: effectiveContribution.toNumber()
    });
  }
  
  return summaries;
}