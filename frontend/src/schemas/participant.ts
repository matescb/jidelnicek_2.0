/**
 * Participant validation schemas
 */
import { z } from 'zod';
import {
  uuidSchema,
  dateSchema,
  dateStringSchema,
  decimalSchema,
  coefficientSchema,
  emailSchema,
} from './common';

// Meal coefficients schema
export const mealCoefficientsSchema = z.object({
  breakfast: coefficientSchema.optional(),
  lunch: coefficientSchema.optional(),
  dinner: coefficientSchema.optional(),
  snack: coefficientSchema.optional(),
});

// Participant base schema
export const participantBaseSchema = z
  .object({
    name: z.string().max(100, 'Name too long').optional(),
    number: z.number().int().min(1, 'Number must be at least 1').optional(),
    email: emailSchema.optional(),
    coefficient: coefficientSchema.default('100.00'),
    meal_coefficients: mealCoefficientsSchema.optional(),
    arrival_date: dateStringSchema.optional(),
    departure_date: dateStringSchema.optional(),
  })
  .refine(
    (data) => {
      // Either name or number must be provided, but not both
      if (data.name && data.number !== undefined) {
        return false;
      }
      if (!data.name && data.number === undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'Provide either name or number, not both',
      path: [],
    }
  )
  .refine(
    (data) => {
      // Validate arrival and departure dates
      if (data.arrival_date && data.departure_date) {
        const arrival = new Date(data.arrival_date);
        const departure = new Date(data.departure_date);
        return arrival <= departure;
      }
      return true;
    },
    {
      message: 'Arrival date must be before departure date',
      path: ['arrival_date'],
    }
  );

// Participant creation schema
export const participantCreateSchema = participantBaseSchema;

// Participant update schema
export const participantUpdateSchema = z
  .object({
    name: z.string().max(100).optional(),
    number: z.number().int().min(1).optional(),
    email: emailSchema.optional(),
    coefficient: coefficientSchema.optional(),
    meal_coefficients: mealCoefficientsSchema.optional(),
    arrival_date: dateStringSchema.optional(),
    departure_date: dateStringSchema.optional(),
  })
  .refine(
    (data) => {
      // If updating to have both name and number, that's invalid
      if (data.name !== undefined && data.number !== undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'Cannot update to have both name and number',
      path: [],
    }
  );

// Participant response schema
export const participantResponseSchema = participantBaseSchema.extend({
  id: uuidSchema,
  trip_id: uuidSchema,
  created_at: dateSchema,
  updated_at: dateSchema,
});

// Participant summary schema
export const participantSummarySchema = z.object({
  id: uuidSchema,
  display_name: z.string(),
  coefficient: decimalSchema,
  is_partial: z.boolean().describe('True if participant has arrival/departure dates'),
  email: emailSchema.optional(),
});

// Day participants schema
export const dayParticipantsSchema = z.object({
  day_number: z.number().int().positive(),
  date: dateStringSchema,
  total_participants: z.number().int().nonnegative(),
  total_coefficient: decimalSchema,
  participants: z.array(participantResponseSchema),
});

// Participant attendance schema (for day planning)
export const participantAttendanceSchema = z.object({
  participant_id: uuidSchema,
  participant_name: z.string(),
  is_present: z.boolean(),
  coefficient: decimalSchema,
  effective_coefficient: decimalSchema,
  meal_coefficients: z.record(z.string(), decimalSchema).optional(),
});

// Bulk participant operations
export const participantBulkCreateSchema = z.object({
  participants: z
    .array(participantCreateSchema)
    .min(1, 'At least one participant required')
    .max(20, 'Maximum 20 participants allowed'),
});

export const participantBulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: uuidSchema,
      data: participantUpdateSchema,
    })
  ),
});

// Participant import schema (for templates)
export const participantTemplateSchema = z.object({
  name: z.string().max(100).optional(),
  number: z.number().int().min(1).optional(),
  coefficient: coefficientSchema.default('100.00'),
  meal_coefficients: mealCoefficientsSchema.optional(),
  is_partial: z.boolean().default(false),
  arrival_offset_days: z.number().int().min(0).optional(),
  departure_offset_days: z.number().int().min(0).optional(),
});

// Participant coefficient info (for UI display)
export const participantCoefficientInfoSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  coefficient: z.number(),
  effective_portion: z.number(),
});

// Meal participant summary
export const mealParticipantSummarySchema = z.object({
  day_id: uuidSchema,
  day_number: z.number().int().positive(),
  date: dateStringSchema,
  meal_slot: z.string(),
  participant_count: z.number().int().nonnegative(),
  effective_count: decimalSchema,
  participants: z.array(participantCoefficientInfoSchema),
});

// Daily participant summary
export const dailyParticipantSummarySchema = z.object({
  day_id: uuidSchema,
  day_number: z.number().int().positive(),
  date: dateStringSchema,
  total_participants: z.number().int().nonnegative(),
  meal_summaries: z.record(z.string(), mealParticipantSummarySchema),
  average_effective_count: decimalSchema,
});

// Trip coefficient summary
export const tripCoefficientSummarySchema = z.object({
  trip_id: uuidSchema,
  total_participants: z.number().int().nonnegative(),
  daily_summaries: z.array(dailyParticipantSummarySchema),
  meal_slot_totals: z.record(z.string(), decimalSchema),
  total_effective_days: decimalSchema,
});

// Type exports
export type MealCoefficients = z.infer<typeof mealCoefficientsSchema>;
export type ParticipantBase = z.infer<typeof participantBaseSchema>;
export type ParticipantCreate = z.infer<typeof participantCreateSchema>;
export type ParticipantUpdate = z.infer<typeof participantUpdateSchema>;
export type ParticipantResponse = z.infer<typeof participantResponseSchema>;
export type ParticipantSummary = z.infer<typeof participantSummarySchema>;
export type DayParticipants = z.infer<typeof dayParticipantsSchema>;
export type ParticipantAttendance = z.infer<typeof participantAttendanceSchema>;
export type ParticipantBulkCreate = z.infer<typeof participantBulkCreateSchema>;
export type ParticipantBulkUpdate = z.infer<typeof participantBulkUpdateSchema>;
export type ParticipantTemplate = z.infer<typeof participantTemplateSchema>;
export type ParticipantCoefficientInfo = z.infer<typeof participantCoefficientInfoSchema>;
export type MealParticipantSummary = z.infer<typeof mealParticipantSummarySchema>;
export type DailyParticipantSummary = z.infer<typeof dailyParticipantSummarySchema>;
export type TripCoefficientSummary = z.infer<typeof tripCoefficientSummarySchema>;