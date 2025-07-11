/**
 * Centralized validation registry for managing form validators
 * 
 * This registry provides a global system for registering, retrieving,
 * and managing validators across the application.
 */

import { ZodSchema, z } from 'zod';

export type ValidatorFunction<T = any> = (value: T, context?: ValidationContext) => ValidationResult;
export type AsyncValidatorFunction<T = any> = (value: T, context?: ValidationContext) => Promise<ValidationResult>;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface ValidationContext {
  formData?: Record<string, any>;
  field?: string;
  locale?: string;
  [key: string]: any;
}

export interface RegisteredValidator {
  name: string;
  validator: ValidatorFunction | AsyncValidatorFunction;
  isAsync: boolean;
  schema?: ZodSchema;
  description?: string;
  category?: string;
  tags?: string[];
}

class ValidationRegistry {
  private validators = new Map<string, RegisteredValidator>();
  private categories = new Map<string, Set<string>>();
  private tags = new Map<string, Set<string>>();

  /**
   * Register a validator
   */
  register(
    name: string,
    validator: ValidatorFunction | AsyncValidatorFunction,
    options: {
      isAsync?: boolean;
      schema?: ZodSchema;
      description?: string;
      category?: string;
      tags?: string[];
    } = {}
  ): void {
    const registeredValidator: RegisteredValidator = {
      name,
      validator,
      isAsync: options.isAsync || false,
      schema: options.schema,
      description: options.description,
      category: options.category,
      tags: options.tags || [],
    };

    this.validators.set(name, registeredValidator);

    // Update category index
    if (options.category) {
      if (!this.categories.has(options.category)) {
        this.categories.set(options.category, new Set());
      }
      this.categories.get(options.category)!.add(name);
    }

    // Update tag index
    options.tags?.forEach(tag => {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(name);
    });
  }

  /**
   * Register a Zod schema as a validator
   */
  registerSchema(name: string, schema: ZodSchema, options?: Omit<Parameters<typeof this.register>[2], 'schema'>): void {
    const validator: ValidatorFunction = (value) => {
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
        return {
          isValid: false,
          error: 'Validation error',
        };
      }
    };

    this.register(name, validator, { ...options, schema });
  }

  /**
   * Get a validator by name
   */
  get(name: string): RegisteredValidator | undefined {
    return this.validators.get(name);
  }

  /**
   * Get all validators in a category
   */
  getByCategory(category: string): RegisteredValidator[] {
    const names = this.categories.get(category);
    if (!names) return [];
    return Array.from(names).map(name => this.validators.get(name)!).filter(Boolean);
  }

  /**
   * Get all validators with a specific tag
   */
  getByTag(tag: string): RegisteredValidator[] {
    const names = this.tags.get(tag);
    if (!names) return [];
    return Array.from(names).map(name => this.validators.get(name)!).filter(Boolean);
  }

  /**
   * Check if a validator exists
   */
  has(name: string): boolean {
    return this.validators.has(name);
  }

  /**
   * Remove a validator
   */
  unregister(name: string): boolean {
    const validator = this.validators.get(name);
    if (!validator) return false;

    // Remove from category index
    if (validator.category) {
      this.categories.get(validator.category)?.delete(name);
    }

    // Remove from tag index
    validator.tags?.forEach(tag => {
      this.tags.get(tag)?.delete(name);
    });

    return this.validators.delete(name);
  }

  /**
   * Get all registered validators
   */
  getAll(): RegisteredValidator[] {
    return Array.from(this.validators.values());
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get all tags
   */
  getTags(): string[] {
    return Array.from(this.tags.keys());
  }

  /**
   * Clear all validators
   */
  clear(): void {
    this.validators.clear();
    this.categories.clear();
    this.tags.clear();
  }

  /**
   * Create a validator from multiple validators (AND logic)
   */
  compose(...validatorNames: string[]): ValidatorFunction {
    return (value, context) => {
      const results = validatorNames.map(name => {
        const validator = this.get(name);
        if (!validator || validator.isAsync) {
          return { isValid: false, error: `Validator ${name} not found or is async` };
        }
        return (validator.validator as ValidatorFunction)(value, context);
      });

      const errors = results.filter(r => !r.isValid).map(r => r.error).filter(Boolean);
      const warnings = results.flatMap(r => r.warnings || []);

      return {
        isValid: errors.length === 0,
        error: errors.join(', '),
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    };
  }

  /**
   * Create a validator that passes if any validator passes (OR logic)
   */
  any(...validatorNames: string[]): ValidatorFunction {
    return (value, context) => {
      const results = validatorNames.map(name => {
        const validator = this.get(name);
        if (!validator || validator.isAsync) {
          return { isValid: false, error: `Validator ${name} not found or is async` };
        }
        return (validator.validator as ValidatorFunction)(value, context);
      });

      const hasValid = results.some(r => r.isValid);
      const errors = results.filter(r => !r.isValid).map(r => r.error).filter(Boolean);

      return {
        isValid: hasValid,
        error: hasValid ? undefined : errors.join(' OR '),
      };
    };
  }
}

// Create and export singleton instance
export const validationRegistry = new ValidationRegistry();

// Helper function to create a validator from a Zod schema
export function createSchemaValidator<T>(schema: ZodSchema<T>): ValidatorFunction<T> {
  return (value) => {
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
      return {
        isValid: false,
        error: 'Validation error',
      };
    }
  };
}

// Helper function to create an async validator
export function createAsyncValidator<T>(
  validate: (value: T, context?: ValidationContext) => Promise<boolean | string>
): AsyncValidatorFunction<T> {
  return async (value, context) => {
    try {
      const result = await validate(value, context);
      if (typeof result === 'boolean') {
        return { isValid: result, error: result ? undefined : 'Validation failed' };
      }
      return { isValid: false, error: result };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation error',
      };
    }
  };
}