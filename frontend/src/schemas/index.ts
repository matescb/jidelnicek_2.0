/**
 * Central export point for all validation schemas
 * 
 * This module re-exports all schemas and types from the individual schema files
 * for convenient importing throughout the application.
 */

// Common schemas and utilities
export * from './common';

// Authentication schemas
export * from './auth';

// Recipe schemas
export * from './recipe';

// Participant schemas
export * from './participant';

// Trip schemas
export * from './trip';

// Convenience re-exports of commonly used schemas
export {
  // Common validations
  emailSchema,
  passwordSchema,
  uuidSchema,
  dateSchema,
  dateStringSchema,
  paginationSchema,
  decimalSchema,
  positiveDecimalSchema,
  percentageSchema,
  coefficientSchema,
  languageSchema,
  unitSystemSchema,
  energyUnitSchema,
  timezoneSchema,
  errorMessages,
} from './common';

export {
  // Auth schemas
  userRegisterSchema,
  userLoginSchema,
  userUpdateSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  emailVerificationSchema,
  passwordChangeSchema,
  tokenResponseSchema,
  userResponseSchema,
} from './auth';

export {
  // Recipe schemas
  recipeCreateSchema,
  recipeUpdateSchema,
  recipeSearchFiltersSchema,
  recipeResponseSchema,
  recipeListResponseSchema,
  categorySchema,
  tagSchema,
  recipeDifficultySchema,
  recipeUnitSchema,
  nutritionalInfoSchema,
} from './recipe';

export {
  // Participant schemas
  participantCreateSchema,
  participantUpdateSchema,
  participantResponseSchema,
  participantSummarySchema,
  mealCoefficientsSchema,
} from './participant';

export {
  // Trip schemas
  tripCreateSchema,
  tripUpdateSchema,
  tripSearchFiltersSchema,
  tripResponseSchema,
  tripListResponseSchema,
  tripStatusSchema,
  recipeStorageModeSchema,
  mealSlotCreateSchema,
  mealAssignmentCreateSchema,
  stoveCreateSchema,
} from './trip';