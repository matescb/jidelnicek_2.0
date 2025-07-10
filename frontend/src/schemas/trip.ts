/**
 * Trip validation schemas
 */
import { z } from 'zod';
import {
  uuidSchema,
  dateSchema,
  dateStringSchema,
  decimalSchema,
  positiveDecimalSchema,
  paginationSchema,
} from './common';
import { participantCreateSchema, participantUpdateSchema, participantResponseSchema } from './participant';
import { recipeUnitSchema } from './recipe';

// Trip status validation
export const tripStatusSchema = z.enum(['planned', 'active', 'completed', 'cancelled'], {
  errorMap: () => ({ message: 'Trip status must be: planned, active, completed, or cancelled' }),
});

// Recipe storage mode validation
export const recipeStorageModeSchema = z.enum(['snapshot', 'track_changes'], {
  errorMap: () => ({ message: 'Recipe storage mode must be: snapshot or track_changes' }),
});

// Trip base schema
export const tripBaseSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Trip name is required')
      .max(100, 'Trip name too long')
      .transform((val) => val.trim())
      .refine((val) => val.length > 0, 'Trip name cannot be empty'),
    description: z
      .string()
      .max(2000, 'Description too long')
      .transform((val) => val?.trim() || null)
      .optional(),
    status: tripStatusSchema.default('planned'),
    start_date: dateStringSchema,
    end_date: dateStringSchema,
    meal_slots: z
      .array(z.string().min(1).max(50))
      .min(1, 'At least one meal slot is required')
      .max(10, 'Maximum 10 meal slots allowed')
      .default(['Breakfast', 'Lunch', 'Dinner'])
      .refine(
        (slots) => {
          // Check for duplicates
          return new Set(slots).size === slots.length;
        },
        'Meal slot names must be unique'
      )
      .transform((slots) => slots.map((s) => s.trim())),
    recipe_storage_mode: recipeStorageModeSchema.default('snapshot'),
    notes: z.string().max(2000, 'Notes too long').optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      return end >= start;
    },
    {
      message: 'End date cannot be before start date',
      path: ['end_date'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return duration <= 365;
    },
    {
      message: 'Trip duration cannot exceed 365 days',
      path: ['end_date'],
    }
  );

// Trip creation schema
export const tripCreateSchema = tripBaseSchema.extend({
  participants: z
    .array(participantCreateSchema)
    .max(20, 'Maximum 20 participants allowed per trip')
    .default([])
    .refine(
      (participants) => {
        // Check for duplicate names
        const names = participants.filter((p) => p.name).map((p) => p.name);
        if (names.length !== new Set(names).size) {
          return false;
        }

        // Check for duplicate numbers
        const numbers = participants.filter((p) => p.number !== undefined).map((p) => p.number);
        if (numbers.length !== new Set(numbers).size) {
          return false;
        }

        return true;
      },
      'Participant names and numbers must be unique'
    ),
});

// Trip update schema
export const tripUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .transform((val) => val.trim())
      .refine((val) => val.length > 0, 'Trip name cannot be empty')
      .optional(),
    start_date: dateStringSchema.optional(),
    end_date: dateStringSchema.optional(),
    meal_slots: z
      .array(z.string().min(1).max(50))
      .min(1)
      .max(10)
      .refine((slots) => new Set(slots).size === slots.length, 'Meal slot names must be unique')
      .transform((slots) => slots.map((s) => s.trim()))
      .optional(),
    recipe_storage_mode: recipeStorageModeSchema.optional(),
    notes: z.string().max(2000).optional(),
    participants: z.array(participantUpdateSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        return end >= start;
      }
      return true;
    },
    {
      message: 'End date cannot be before start date',
      path: ['end_date'],
    }
  )
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return duration <= 365;
      }
      return true;
    },
    {
      message: 'Trip duration cannot exceed 365 days',
      path: ['end_date'],
    }
  );

// Trip search filters
export const tripSearchFiltersSchema = z
  .object({
    query: z.string().optional(),
    start_date_from: dateStringSchema.optional(),
    start_date_to: dateStringSchema.optional(),
    end_date_from: dateStringSchema.optional(),
    end_date_to: dateStringSchema.optional(),
    min_duration_days: z.number().int().min(1).optional(),
    max_duration_days: z.number().int().min(1).optional(),
    min_participants: z.number().int().min(1).max(20).optional(),
    max_participants: z.number().int().min(1).max(20).optional(),
    is_archived: z.boolean().optional(),
    has_stove: z.boolean().optional(),
    recipe_storage_mode: recipeStorageModeSchema.optional(),
    created_after: dateSchema.optional(),
    created_before: dateSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.start_date_from && data.start_date_to) {
        return new Date(data.start_date_from) <= new Date(data.start_date_to);
      }
      return true;
    },
    {
      message: 'start_date_from cannot be after start_date_to',
      path: ['start_date_from'],
    }
  )
  .refine(
    (data) => {
      if (data.end_date_from && data.end_date_to) {
        return new Date(data.end_date_from) <= new Date(data.end_date_to);
      }
      return true;
    },
    {
      message: 'end_date_from cannot be after end_date_to',
      path: ['end_date_from'],
    }
  )
  .refine(
    (data) => {
      if (data.min_duration_days && data.max_duration_days) {
        return data.min_duration_days <= data.max_duration_days;
      }
      return true;
    },
    {
      message: 'min_duration_days cannot be greater than max_duration_days',
      path: ['min_duration_days'],
    }
  )
  .refine(
    (data) => {
      if (data.min_participants && data.max_participants) {
        return data.min_participants <= data.max_participants;
      }
      return true;
    },
    {
      message: 'min_participants cannot be greater than max_participants',
      path: ['min_participants'],
    }
  );

// Meal slot schemas
export const mealSlotBaseSchema = z.object({
  meal_type: z.string().min(1).max(50),
  meal_date: dateStringSchema,
  participant_count: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional(),
});

export const mealSlotCreateSchema = mealSlotBaseSchema;

export const mealSlotUpdateSchema = z.object({
  participant_count: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const mealSlotResponseSchema = mealSlotBaseSchema.extend({
  id: uuidSchema,
  trip_id: uuidSchema,
  day_id: uuidSchema,
  day_number: z.number().int().positive(),
  has_assignment: z.boolean(),
  created_at: dateSchema,
  updated_at: dateSchema,
});

// Meal assignment schemas
export const mealAssignmentBaseSchema = z.object({
  meal_slot_id: uuidSchema,
  recipe_id: uuidSchema,
  participant_overrides: z.array(uuidSchema).default([]),
  notes: z.string().max(500).optional(),
});

export const mealAssignmentCreateSchema = mealAssignmentBaseSchema;

export const mealAssignmentUpdateSchema = z.object({
  recipe_id: uuidSchema.optional(),
  participant_overrides: z.array(uuidSchema).optional(),
  notes: z.string().max(500).optional(),
});

export const mealAssignmentResponseSchema = mealAssignmentBaseSchema.extend({
  id: uuidSchema,
  trip_id: uuidSchema,
  effective_participant_count: decimalSchema,
  recipe_snapshot: z.record(z.any()).optional(),
  created_at: dateSchema,
  updated_at: dateSchema,
});

// Meal assignment bulk operations
export const mealAssignmentBulkCreateSchema = z.object({
  assignments: z.array(mealAssignmentCreateSchema).min(1).max(50),
});

export const mealAssignmentBulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: uuidSchema,
      data: mealAssignmentUpdateSchema,
    })
  ),
});

export const mealAssignmentSwapSchema = z.object({
  assignment_id_1: uuidSchema,
  assignment_id_2: uuidSchema,
});

// Trip day schemas
export const tripDaySummarySchema = z.object({
  id: uuidSchema,
  day_number: z.number().int().positive(),
  date: dateStringSchema,
  meals_planned: z.number().int().nonnegative(),
  total_calories: decimalSchema.optional(),
  total_weight_g: decimalSchema.optional(),
  has_all_meals: z.boolean(),
  notes: z.string().optional(),
});

// Trip response schemas
export const tripListItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  start_date: dateStringSchema,
  end_date: dateStringSchema,
  duration_days: z.number().int().positive(),
  participant_count: z.number().int().nonnegative(),
  meal_slot_count: z.number().int().nonnegative(),
  recipe_storage_mode: recipeStorageModeSchema,
  is_archived: z.boolean(),
  created_at: dateSchema,
  updated_at: dateSchema,
  has_stove: z.boolean().default(false),
  total_meals_planned: z.number().int().nonnegative().default(0),
  completion_percentage: z.number().min(0).max(100).default(0),
});

export const tripResponseSchema = tripBaseSchema.extend({
  id: uuidSchema,
  user_id: uuidSchema,
  is_archived: z.boolean(),
  created_at: dateSchema,
  updated_at: dateSchema,
  duration_days: z.number().int().positive(),
  participants: z.array(participantResponseSchema).default([]),
  days: z.array(tripDaySummarySchema).default([]),
  has_stove: z.boolean().default(false),
  stove_efficiency: decimalSchema.optional(),
  total_meals_planned: z.number().int().nonnegative().default(0),
  completion_percentage: z.number().min(0).max(100).default(0),
  total_calories: decimalSchema.optional(),
  total_weight_g: decimalSchema.optional(),
  total_water_ml: z.number().int().nonnegative().optional(),
  total_fuel_g: decimalSchema.optional(),
});

export const tripListResponseSchema = z.object({
  items: z.array(tripListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
});

// Trip action schemas
export const tripDuplicateRequestSchema = z.object({
  new_name: z.string().min(1).max(100).optional(),
  include_meals: z.boolean().default(true),
  include_participants: z.boolean().default(true),
  new_start_date: dateStringSchema.optional(),
});

export const tripTemplateRequestSchema = z.object({
  template_name: z.string().min(1).max(100),
  is_day_template: z.boolean().default(false),
});

export const tripCloneRequestSchema = z
  .object({
    new_name: z
      .string()
      .min(1)
      .max(100)
      .transform((val) => val.trim())
      .refine((val) => val.length > 0, 'Trip name cannot be empty'),
    start_date: dateStringSchema,
    clone_participants: z.boolean().default(true),
    clone_meal_slots: z.boolean().default(true),
    clone_meal_assignments: z.boolean().default(true),
    participant_overrides: z.array(participantCreateSchema).max(20).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return start >= today;
    },
    {
      message: 'Start date cannot be in the past',
      path: ['start_date'],
    }
  )
  .refine(
    (data) => {
      if (data.participant_overrides && data.participant_overrides.length > 0) {
        // Check for duplicate names
        const names = data.participant_overrides.filter((p) => p.name).map((p) => p.name);
        if (names.length !== new Set(names).size) {
          return false;
        }

        // Check for duplicate numbers
        const numbers = data.participant_overrides
          .filter((p) => p.number !== undefined)
          .map((p) => p.number);
        if (numbers.length !== new Set(numbers).size) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Participant names and numbers must be unique',
      path: ['participant_overrides'],
    }
  );

// Stove configuration schemas
export const stoveTypeSchema = z.enum(['gas', 'liquid', 'solid', 'electric'], {
  errorMap: () => ({ message: 'Stove type must be: gas, liquid, solid, or electric' }),
});

export const stoveCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: stoveTypeSchema,
  fuel_type: z.string().min(1).max(50),
  base_fuel_consumption: positiveDecimalSchema,
  altitude_factor: decimalSchema.default('1.0'),
  temperature_factor: decimalSchema.default('1.0'),
  wind_factor: decimalSchema.default('1.0'),
  efficiency_percentage: z
    .number()
    .min(10)
    .max(100)
    .default(70),
  notes: z.string().max(500).optional(),
});

export const stoveUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: stoveTypeSchema.optional(),
  fuel_type: z.string().min(1).max(50).optional(),
  base_fuel_consumption: positiveDecimalSchema.optional(),
  altitude_factor: decimalSchema.optional(),
  temperature_factor: decimalSchema.optional(),
  wind_factor: decimalSchema.optional(),
  efficiency_percentage: z.number().min(10).max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const stoveResponseSchema = stoveCreateSchema.extend({
  id: uuidSchema,
  trip_id: uuidSchema,
  created_at: dateSchema,
  updated_at: dateSchema,
});

// Day plan schemas
export const dayPlanUpdateRequestSchema = z.object({
  notes: z.string().max(1000).optional(),
  participant_overrides: z.record(
    uuidSchema,
    z.object({
      is_present: z.boolean(),
      meal_overrides: z.record(z.string(), z.boolean()).optional(),
    })
  ).optional(),
});

export const mealSlotAssignmentRequestSchema = z.object({
  recipe_id: uuidSchema,
  participant_overrides: z.array(uuidSchema).optional(),
  notes: z.string().max(500).optional(),
});

// Shopping list schemas
export const shoppingItemSchema = z.object({
  ingredient_name: z.string(),
  total_quantity: decimalSchema,
  unit: recipeUnitSchema,
  category: z.string().optional(),
  recipes: z.array(z.string()),
  is_custom: z.boolean().default(false),
});

export const dayShoppingListSchema = z.object({
  day_number: z.number().int().positive(),
  date: dateStringSchema,
  items: z.array(shoppingItemSchema),
  total_weight_g: decimalSchema.optional(),
  total_volume_ml: decimalSchema.optional(),
});

export const tripShoppingListSchema = z.object({
  trip_id: uuidSchema,
  generated_at: dateSchema,
  total_items: z.number().int().nonnegative(),
  total_weight_g: decimalSchema,
  total_volume_ml: decimalSchema,
  items_by_category: z.record(z.string(), z.array(shoppingItemSchema)),
  daily_lists: z.array(dayShoppingListSchema).optional(),
});

// Trip statistics schema
export const tripStatsResponseSchema = z.object({
  total_trips: z.number().int().nonnegative(),
  active_trips: z.number().int().nonnegative(),
  archived_trips: z.number().int().nonnegative(),
  total_trip_days: z.number().int().nonnegative(),
  average_trip_duration: z.number().optional(),
  average_participants: z.number().optional(),
  most_common_meal_slots: z.array(z.record(z.any())),
  trips_with_stoves: z.number().int().nonnegative(),
  snapshot_mode_trips: z.number().int().nonnegative(),
  track_changes_mode_trips: z.number().int().nonnegative(),
});

// Type exports
export type TripStatus = z.infer<typeof tripStatusSchema>;
export type RecipeStorageMode = z.infer<typeof recipeStorageModeSchema>;
export type TripBase = z.infer<typeof tripBaseSchema>;
export type TripCreate = z.infer<typeof tripCreateSchema>;
export type TripUpdate = z.infer<typeof tripUpdateSchema>;
export type TripSearchFilters = z.infer<typeof tripSearchFiltersSchema>;
export type MealSlotBase = z.infer<typeof mealSlotBaseSchema>;
export type MealSlotCreate = z.infer<typeof mealSlotCreateSchema>;
export type MealSlotUpdate = z.infer<typeof mealSlotUpdateSchema>;
export type MealSlotResponse = z.infer<typeof mealSlotResponseSchema>;
export type MealAssignmentBase = z.infer<typeof mealAssignmentBaseSchema>;
export type MealAssignmentCreate = z.infer<typeof mealAssignmentCreateSchema>;
export type MealAssignmentUpdate = z.infer<typeof mealAssignmentUpdateSchema>;
export type MealAssignmentResponse = z.infer<typeof mealAssignmentResponseSchema>;
export type MealAssignmentBulkCreate = z.infer<typeof mealAssignmentBulkCreateSchema>;
export type MealAssignmentBulkUpdate = z.infer<typeof mealAssignmentBulkUpdateSchema>;
export type MealAssignmentSwap = z.infer<typeof mealAssignmentSwapSchema>;
export type TripDaySummary = z.infer<typeof tripDaySummarySchema>;
export type TripListItem = z.infer<typeof tripListItemSchema>;
export type TripResponse = z.infer<typeof tripResponseSchema>;
export type TripListResponse = z.infer<typeof tripListResponseSchema>;
export type TripDuplicateRequest = z.infer<typeof tripDuplicateRequestSchema>;
export type TripTemplateRequest = z.infer<typeof tripTemplateRequestSchema>;
export type TripCloneRequest = z.infer<typeof tripCloneRequestSchema>;
export type StoveType = z.infer<typeof stoveTypeSchema>;
export type StoveCreate = z.infer<typeof stoveCreateSchema>;
export type StoveUpdate = z.infer<typeof stoveUpdateSchema>;
export type StoveResponse = z.infer<typeof stoveResponseSchema>;
export type DayPlanUpdateRequest = z.infer<typeof dayPlanUpdateRequestSchema>;
export type MealSlotAssignmentRequest = z.infer<typeof mealSlotAssignmentRequestSchema>;
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
export type DayShoppingList = z.infer<typeof dayShoppingListSchema>;
export type TripShoppingList = z.infer<typeof tripShoppingListSchema>;
export type TripStatsResponse = z.infer<typeof tripStatsResponseSchema>;