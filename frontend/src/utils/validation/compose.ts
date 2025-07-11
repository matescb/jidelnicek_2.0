/**
 * Validation composition utilities for creating higher-order validators
 * and reusable validation schemas
 */

import { z, ZodSchema } from 'zod';
import { 
  ValidatorFunction, 
  AsyncValidatorFunction, 
  ValidationResult,
  ValidationContext 
} from './registry';

/**
 * Pipe validators - runs validators in sequence, stops on first error
 */
export function pipe(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value, context) => {
    for (const validator of validators) {
      const result = validator(value, context);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  };
}

/**
 * Async pipe validators
 */
export function pipeAsync(...validators: Array<ValidatorFunction | AsyncValidatorFunction>): AsyncValidatorFunction {
  return async (value, context) => {
    for (const validator of validators) {
      const result = await validator(value, context);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  };
}

/**
 * Compose validators - runs all validators and combines results
 */
export function compose(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value, context) => {
    const results = validators.map(v => v(value, context));
    const errors = results
      .filter(r => !r.isValid)
      .map(r => r.error)
      .filter(Boolean) as string[];
    const warnings = results
      .flatMap(r => r.warnings || []);
    
    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  };
}

/**
 * Async compose validators
 */
export function composeAsync(...validators: Array<ValidatorFunction | AsyncValidatorFunction>): AsyncValidatorFunction {
  return async (value, context) => {
    const results = await Promise.all(
      validators.map(v => v(value, context))
    );
    
    const errors = results
      .filter(r => !r.isValid)
      .map(r => r.error)
      .filter(Boolean) as string[];
    const warnings = results
      .flatMap(r => r.warnings || []);
    
    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  };
}

/**
 * Conditional validator
 */
export function conditional<T = any>(
  condition: (value: T, context?: ValidationContext) => boolean,
  trueValidator: ValidatorFunction<T>,
  falseValidator?: ValidatorFunction<T>
): ValidatorFunction<T> {
  return (value, context) => {
    if (condition(value, context)) {
      return trueValidator(value, context);
    }
    return falseValidator ? falseValidator(value, context) : { isValid: true };
  };
}

/**
 * Async conditional validator
 */
export function conditionalAsync<T = any>(
  condition: (value: T, context?: ValidationContext) => boolean | Promise<boolean>,
  trueValidator: ValidatorFunction<T> | AsyncValidatorFunction<T>,
  falseValidator?: ValidatorFunction<T> | AsyncValidatorFunction<T>
): AsyncValidatorFunction<T> {
  return async (value, context) => {
    const shouldValidate = await condition(value, context);
    
    if (shouldValidate) {
      return await trueValidator(value, context);
    }
    return falseValidator ? await falseValidator(value, context) : { isValid: true };
  };
}

/**
 * Transform value before validation
 */
export function withTransform<T, U>(
  transform: (value: T) => U,
  validator: ValidatorFunction<U>
): ValidatorFunction<T> {
  return (value, context) => {
    const transformed = transform(value);
    return validator(transformed, context);
  };
}

/**
 * Validator with custom error message
 */
export function withMessage(
  validator: ValidatorFunction,
  message: string | ((value: any, context?: ValidationContext) => string)
): ValidatorFunction {
  return (value, context) => {
    const result = validator(value, context);
    if (!result.isValid) {
      const errorMessage = typeof message === 'function' ? message(value, context) : message;
      return { ...result, error: errorMessage };
    }
    return result;
  };
}

/**
 * Validator with warning
 */
export function withWarning(
  validator: ValidatorFunction,
  warning: string | ((value: any, context?: ValidationContext) => string)
): ValidatorFunction {
  return (value, context) => {
    const result = validator(value, context);
    const warningMessage = typeof warning === 'function' ? warning(value, context) : warning;
    
    return {
      ...result,
      warnings: [...(result.warnings || []), warningMessage],
    };
  };
}

/**
 * Lazy validator - defers validator creation until validation time
 */
export function lazy<T = any>(
  getValidator: (value: T, context?: ValidationContext) => ValidatorFunction<T>
): ValidatorFunction<T> {
  return (value, context) => {
    const validator = getValidator(value, context);
    return validator(value, context);
  };
}

/**
 * Memoized validator - caches validation results
 */
export function memoize<T = any>(
  validator: ValidatorFunction<T>,
  keyFn?: (value: T, context?: ValidationContext) => string
): ValidatorFunction<T> {
  const cache = new Map<string, ValidationResult>();
  
  return (value, context) => {
    const key = keyFn ? keyFn(value, context) : JSON.stringify({ value, context });
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = validator(value, context);
    cache.set(key, result);
    return result;
  };
}

/**
 * Debounced validator
 */
export function debounce<T = any>(
  validator: ValidatorFunction<T>,
  delay: number
): AsyncValidatorFunction<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (value, context) => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        const result = validator(value, context);
        resolve(result);
      }, delay);
    });
  };
}

/**
 * Create a validator from multiple Zod schemas
 */
export function fromZodSchemas(...schemas: ZodSchema[]): ValidatorFunction {
  return (value) => {
    const errors: string[] = [];
    
    for (const schema of schemas) {
      try {
        schema.parse(value);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(...error.errors.map(e => e.message));
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : undefined,
    };
  };
}

/**
 * Create a schema builder for complex validation scenarios
 */
export class ValidationSchemaBuilder<T = any> {
  private validators: Array<ValidatorFunction<T> | AsyncValidatorFunction<T>> = [];
  private isAsync = false;

  add(validator: ValidatorFunction<T>): this {
    this.validators.push(validator);
    return this;
  }

  addAsync(validator: AsyncValidatorFunction<T>): this {
    this.validators.push(validator);
    this.isAsync = true;
    return this;
  }

  addIf(
    condition: (value: T, context?: ValidationContext) => boolean,
    validator: ValidatorFunction<T> | AsyncValidatorFunction<T>
  ): this {
    const conditionalValidator = conditional(condition, validator as ValidatorFunction<T>);
    this.validators.push(conditionalValidator);
    return this;
  }

  addZodSchema(schema: ZodSchema<T>): this {
    const validator: ValidatorFunction<T> = (value) => {
      try {
        schema.parse(value);
        return { isValid: true };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            isValid: false,
            error: error.errors[0]?.message || 'Validation failed',
          };
        }
        return { isValid: false, error: 'Validation error' };
      }
    };
    
    this.validators.push(validator);
    return this;
  }

  transform<U>(transformFn: (value: T) => U): ValidationSchemaBuilder<U> {
    const newBuilder = new ValidationSchemaBuilder<U>();
    newBuilder.isAsync = this.isAsync;
    
    // Transform all existing validators
    newBuilder.validators = this.validators.map(validator => {
      return (value: U, context?: ValidationContext) => {
        // This is a type assertion hack, but it's safe because we're transforming the value
        const originalValue = value as any as T;
        return (validator as any)(originalValue, context);
      };
    });
    
    return newBuilder;
  }

  build(): ValidatorFunction<T> | AsyncValidatorFunction<T> {
    if (this.isAsync) {
      return composeAsync(...this.validators);
    }
    return compose(...(this.validators as ValidatorFunction<T>[]));
  }
}

/**
 * Helper to create a validation schema
 */
export function createValidationSchema<T = any>(): ValidationSchemaBuilder<T> {
  return new ValidationSchemaBuilder<T>();
}

/**
 * Common validation patterns as reusable schemas
 */
export const CommonSchemas = {
  // Contact information
  contactInfo: createValidationSchema()
    .addZodSchema(z.object({
      email: z.string().email(),
      phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
    }))
    .build(),
  
  // Address
  address: createValidationSchema()
    .addZodSchema(z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(2).max(2),
      zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
      country: z.string().min(2).max(2),
    }))
    .build(),
  
  // Date range
  dateRange: createValidationSchema()
    .add((value: { start: Date; end: Date }) => {
      const isValid = value.end >= value.start;
      return {
        isValid,
        error: isValid ? undefined : 'End date must be after start date',
      };
    })
    .build(),
  
  // Password confirmation
  passwordConfirmation: createValidationSchema()
    .add((value: { password: string; confirmPassword: string }) => {
      const isValid = value.password === value.confirmPassword;
      return {
        isValid,
        error: isValid ? undefined : 'Passwords do not match',
      };
    })
    .build(),
};