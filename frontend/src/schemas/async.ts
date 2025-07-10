/**
 * Async validation schemas and validators
 * 
 * Provides async validators for API-based validation such as
 * uniqueness checks and availability validation.
 */

import { z } from 'zod';
import { emailSchema, nameSchema, recipeNameSchema, tripNameSchema } from '../utils/validation';
import type { AsyncValidator, ValidationResult } from '../utils/asyncValidation';

/**
 * Username validation schema
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

/**
 * Create async email uniqueness validator
 */
export const createEmailUniquenessValidator = (
  checkEmail: (email: string) => Promise<boolean>
): AsyncValidator<string> => {
  return async (email: string, signal?: AbortSignal): Promise<ValidationResult> => {
    try {
      // First validate email format
      const result = emailSchema.safeParse(email);
      if (!result.success) {
        return {
          isValid: false,
          error: result.error.errors[0]?.message || 'Invalid email',
          timestamp: Date.now(),
        };
      }

      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Validation aborted');
      }

      // Check uniqueness
      const isUnique = await checkEmail(email);
      
      return {
        isValid: isUnique,
        error: isUnique ? undefined : 'Email is already in use',
        timestamp: Date.now(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Validation aborted') {
        throw error;
      }
      
      return {
        isValid: false,
        error: 'Unable to verify email availability',
        timestamp: Date.now(),
      };
    }
  };
};

/**
 * Create async username availability validator
 */
export const createUsernameAvailabilityValidator = (
  checkUsername: (username: string) => Promise<boolean>
): AsyncValidator<string> => {
  return async (username: string, signal?: AbortSignal): Promise<ValidationResult> => {
    try {
      // First validate username format
      const result = usernameSchema.safeParse(username);
      if (!result.success) {
        return {
          isValid: false,
          error: result.error.errors[0]?.message || 'Invalid username',
          timestamp: Date.now(),
        };
      }

      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Validation aborted');
      }

      // Check availability
      const isAvailable = await checkUsername(username);
      
      return {
        isValid: isAvailable,
        error: isAvailable ? undefined : 'Username is already taken',
        timestamp: Date.now(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Validation aborted') {
        throw error;
      }
      
      return {
        isValid: false,
        error: 'Unable to verify username availability',
        timestamp: Date.now(),
      };
    }
  };
};

/**
 * Create async recipe name uniqueness validator
 */
export const createRecipeNameUniquenessValidator = (
  checkRecipeName: (name: string, userId: string) => Promise<boolean>,
  userId: string
): AsyncValidator<string> => {
  return async (name: string, signal?: AbortSignal): Promise<ValidationResult> => {
    try {
      // First validate recipe name format
      const result = recipeNameSchema.safeParse(name);
      if (!result.success) {
        return {
          isValid: false,
          error: result.error.errors[0]?.message || 'Invalid recipe name',
          timestamp: Date.now(),
        };
      }

      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Validation aborted');
      }

      // Check uniqueness for user
      const isUnique = await checkRecipeName(name, userId);
      
      return {
        isValid: isUnique,
        error: isUnique ? undefined : 'You already have a recipe with this name',
        timestamp: Date.now(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Validation aborted') {
        throw error;
      }
      
      return {
        isValid: false,
        error: 'Unable to verify recipe name',
        timestamp: Date.now(),
      };
    }
  };
};

/**
 * Create async trip name validator
 */
export const createTripNameValidator = (
  checkTripName: (name: string, userId: string) => Promise<boolean>,
  userId: string
): AsyncValidator<string> => {
  return async (name: string, signal?: AbortSignal): Promise<ValidationResult> => {
    try {
      // First validate trip name format
      const result = tripNameSchema.safeParse(name);
      if (!result.success) {
        return {
          isValid: false,
          error: result.error.errors[0]?.message || 'Invalid trip name',
          timestamp: Date.now(),
        };
      }

      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Validation aborted');
      }

      // Check uniqueness for user
      const isUnique = await checkTripName(name, userId);
      
      return {
        isValid: isUnique,
        error: isUnique ? undefined : 'You already have a trip with this name',
        timestamp: Date.now(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Validation aborted') {
        throw error;
      }
      
      return {
        isValid: false,
        error: 'Unable to verify trip name',
        timestamp: Date.now(),
      };
    }
  };
};

/**
 * Create dynamic validator based on API response
 */
export const createDynamicValidator = <T>(
  validateFn: (value: T, context?: any) => Promise<{ valid: boolean; error?: string }>
): AsyncValidator<T> => {
  return async (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
    try {
      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Validation aborted');
      }

      // Validate with API
      const result = await validateFn(value);
      
      return {
        isValid: result.valid,
        error: result.error,
        timestamp: Date.now(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Validation aborted') {
        throw error;
      }
      
      return {
        isValid: false,
        error: 'Validation failed',
        timestamp: Date.now(),
      };
    }
  };
};

/**
 * Create composite async validator
 */
export const createCompositeAsyncValidator = <T>(
  validators: AsyncValidator<T>[]
): AsyncValidator<T> => {
  return async (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
    for (const validator of validators) {
      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Validation aborted');
      }

      const result = await validator(value, signal);
      
      // Return first error
      if (!result.isValid) {
        return result;
      }
    }

    return {
      isValid: true,
      timestamp: Date.now(),
    };
  };
};

/**
 * Create conditional async validator
 */
export const createConditionalAsyncValidator = <T>(
  condition: (value: T) => boolean,
  validator: AsyncValidator<T>
): AsyncValidator<T> => {
  return async (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
    if (!condition(value)) {
      return {
        isValid: true,
        timestamp: Date.now(),
      };
    }

    return validator(value, signal);
  };
};

/**
 * Create async validator with custom error messages
 */
export const createAsyncValidatorWithMessages = <T>(
  validator: AsyncValidator<T>,
  errorMessages: Record<string, string>
): AsyncValidator<T> => {
  return async (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
    const result = await validator(value, signal);
    
    if (!result.isValid && result.error) {
      // Replace with custom message if available
      const customMessage = errorMessages[result.error];
      if (customMessage) {
        return {
          ...result,
          error: customMessage,
        };
      }
    }

    return result;
  };
};

/**
 * Extended validation schemas with async support
 */
export const extendedSchemas = {
  /**
   * Email with async uniqueness check
   */
  emailWithUniqueness: (checkEmail: (email: string) => Promise<boolean>) => 
    emailSchema.refine(
      async (email) => checkEmail(email),
      { message: 'Email is already in use' }
    ),

  /**
   * Username with async availability check
   */
  usernameWithAvailability: (checkUsername: (username: string) => Promise<boolean>) =>
    usernameSchema.refine(
      async (username) => checkUsername(username),
      { message: 'Username is already taken' }
    ),

  /**
   * Recipe name with async uniqueness check
   */
  recipeNameWithUniqueness: (checkRecipeName: (name: string) => Promise<boolean>) =>
    recipeNameSchema.refine(
      async (name) => checkRecipeName(name),
      { message: 'Recipe name already exists' }
    ),

  /**
   * Trip name with async uniqueness check
   */
  tripNameWithUniqueness: (checkTripName: (name: string) => Promise<boolean>) =>
    tripNameSchema.refine(
      async (name) => checkTripName(name),
      { message: 'Trip name already exists' }
    ),
};