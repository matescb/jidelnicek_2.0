/**
 * Validation rules engine with predefined rules and custom validator factories
 */

import { z } from 'zod';
import { 
  ValidatorFunction, 
  AsyncValidatorFunction, 
  ValidationContext,
  ValidationResult,
  validationRegistry,
  createSchemaValidator,
  createAsyncValidator
} from './registry';

// Common validation patterns
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alpha: /^[a-zA-Z]+$/,
  numeric: /^[0-9]+$/,
  decimal: /^[0-9]+(\.[0-9]+)?$/,
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
  creditCard: /^[0-9]{13,19}$/,
  postalCode: {
    US: /^\d{5}(-\d{4})?$/,
    UK: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
    CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,
    DE: /^\d{5}$/,
    FR: /^\d{5}$/,
    IT: /^\d{5}$/,
    AU: /^\d{4}$/,
    NL: /^\d{4} ?[A-Z]{2}$/i,
    ES: /^\d{5}$/,
    SE: /^\d{3} ?\d{2}$/,
    CZ: /^\d{3} ?\d{2}$/,
  }
};

/**
 * Required field validator
 */
export const required: ValidatorFunction = (value) => {
  const isValid = value !== null && value !== undefined && value !== '' && 
    (Array.isArray(value) ? value.length > 0 : true);
  return {
    isValid,
    error: isValid ? undefined : 'This field is required',
  };
};

/**
 * Email validator
 */
export const email: ValidatorFunction = (value) => {
  if (!value) return { isValid: true };
  const isValid = typeof value === 'string' && PATTERNS.email.test(value);
  return {
    isValid,
    error: isValid ? undefined : 'Please enter a valid email address',
  };
};

/**
 * Phone number validator
 */
export const phone: ValidatorFunction = (value) => {
  if (!value) return { isValid: true };
  const isValid = typeof value === 'string' && PATTERNS.phone.test(value);
  return {
    isValid,
    error: isValid ? undefined : 'Please enter a valid phone number',
  };
};

/**
 * URL validator
 */
export const url: ValidatorFunction = (value) => {
  if (!value) return { isValid: true };
  const isValid = typeof value === 'string' && PATTERNS.url.test(value);
  return {
    isValid,
    error: isValid ? undefined : 'Please enter a valid URL',
  };
};

/**
 * Minimum length validator factory
 */
export function minLength(min: number): ValidatorFunction {
  return (value) => {
    if (!value) return { isValid: true };
    const length = typeof value === 'string' ? value.length : 
                  Array.isArray(value) ? value.length : 0;
    const isValid = length >= min;
    return {
      isValid,
      error: isValid ? undefined : `Must be at least ${min} characters`,
    };
  };
}

/**
 * Maximum length validator factory
 */
export function maxLength(max: number): ValidatorFunction {
  return (value) => {
    if (!value) return { isValid: true };
    const length = typeof value === 'string' ? value.length : 
                  Array.isArray(value) ? value.length : 0;
    const isValid = length <= max;
    return {
      isValid,
      error: isValid ? undefined : `Must be no more than ${max} characters`,
    };
  };
}

/**
 * Length range validator factory
 */
export function lengthBetween(min: number, max: number): ValidatorFunction {
  return (value) => {
    if (!value) return { isValid: true };
    const length = typeof value === 'string' ? value.length : 
                  Array.isArray(value) ? value.length : 0;
    const isValid = length >= min && length <= max;
    return {
      isValid,
      error: isValid ? undefined : `Must be between ${min} and ${max} characters`,
    };
  };
}

/**
 * Pattern validator factory
 */
export function pattern(regex: RegExp, message?: string): ValidatorFunction {
  return (value) => {
    if (!value) return { isValid: true };
    const isValid = typeof value === 'string' && regex.test(value);
    return {
      isValid,
      error: isValid ? undefined : (message || 'Invalid format'),
    };
  };
}

/**
 * Numeric range validator factory
 */
export function between(min: number, max: number): ValidatorFunction {
  return (value) => {
    if (value === null || value === undefined || value === '') return { isValid: true };
    const num = Number(value);
    const isValid = !isNaN(num) && num >= min && num <= max;
    return {
      isValid,
      error: isValid ? undefined : `Must be between ${min} and ${max}`,
    };
  };
}

/**
 * Minimum value validator factory
 */
export function min(minValue: number): ValidatorFunction {
  return (value) => {
    if (value === null || value === undefined || value === '') return { isValid: true };
    const num = Number(value);
    const isValid = !isNaN(num) && num >= minValue;
    return {
      isValid,
      error: isValid ? undefined : `Must be at least ${minValue}`,
    };
  };
}

/**
 * Maximum value validator factory
 */
export function max(maxValue: number): ValidatorFunction {
  return (value) => {
    if (value === null || value === undefined || value === '') return { isValid: true };
    const num = Number(value);
    const isValid = !isNaN(num) && num <= maxValue;
    return {
      isValid,
      error: isValid ? undefined : `Must be no more than ${maxValue}`,
    };
  };
}

/**
 * Date validator
 */
export const date: ValidatorFunction = (value) => {
  if (!value) return { isValid: true };
  const isValid = !isNaN(new Date(value).getTime());
  return {
    isValid,
    error: isValid ? undefined : 'Please enter a valid date',
  };
};

/**
 * Date range validator factory
 */
export function dateBetween(startDate: Date | string, endDate: Date | string): ValidatorFunction {
  return (value) => {
    if (!value) return { isValid: true };
    const date = new Date(value);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const isValid = !isNaN(date.getTime()) && date >= start && date <= end;
    return {
      isValid,
      error: isValid ? undefined : `Date must be between ${start.toLocaleDateString()} and ${end.toLocaleDateString()}`,
    };
  };
}

/**
 * Future date validator
 */
export const futureDate: ValidatorFunction = (value) => {
  if (!value) return { isValid: true };
  const date = new Date(value);
  const isValid = !isNaN(date.getTime()) && date > new Date();
  return {
    isValid,
    error: isValid ? undefined : 'Date must be in the future',
  };
};

/**
 * Past date validator
 */
export const pastDate: ValidatorFunction = (value) => {
  if (!value) return { isValid: true };
  const date = new Date(value);
  const isValid = !isNaN(date.getTime()) && date < new Date();
  return {
    isValid,
    error: isValid ? undefined : 'Date must be in the past',
  };
};

/**
 * Matches field validator factory (for confirmation fields)
 */
export function matches(fieldName: string, message?: string): ValidatorFunction {
  return (value, context) => {
    const otherValue = context?.formData?.[fieldName];
    const isValid = value === otherValue;
    return {
      isValid,
      error: isValid ? undefined : (message || `Must match ${fieldName}`),
    };
  };
}

/**
 * Conditional validator factory
 */
export function when(
  condition: (value: any, context?: ValidationContext) => boolean,
  trueValidator: ValidatorFunction,
  falseValidator?: ValidatorFunction
): ValidatorFunction {
  return (value, context) => {
    if (condition(value, context)) {
      return trueValidator(value, context);
    }
    return falseValidator ? falseValidator(value, context) : { isValid: true };
  };
}

/**
 * Compose multiple validators (all must pass)
 */
export function all(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value, context) => {
    const results = validators.map(v => v(value, context));
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
 * Compose multiple validators (at least one must pass)
 */
export function any(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value, context) => {
    const results = validators.map(v => v(value, context));
    const hasValid = results.some(r => r.isValid);
    const errors = results.filter(r => !r.isValid).map(r => r.error).filter(Boolean);

    return {
      isValid: hasValid,
      error: hasValid ? undefined : errors.join(' OR '),
    };
  };
}

/**
 * Not validator (inverts the result)
 */
export function not(validator: ValidatorFunction, message?: string): ValidatorFunction {
  return (value, context) => {
    const result = validator(value, context);
    return {
      isValid: !result.isValid,
      error: result.isValid ? (message || 'Validation failed') : undefined,
    };
  };
}

/**
 * Optional validator (skips validation if value is empty)
 */
export function optional(validator: ValidatorFunction): ValidatorFunction {
  return (value, context) => {
    if (value === null || value === undefined || value === '') {
      return { isValid: true };
    }
    return validator(value, context);
  };
}

/**
 * Array validator factory
 */
export function arrayOf(itemValidator: ValidatorFunction): ValidatorFunction {
  return (value, context) => {
    if (!Array.isArray(value)) {
      return { isValid: false, error: 'Must be an array' };
    }

    const results = value.map((item, index) => {
      const result = itemValidator(item, { ...context, arrayIndex: index });
      return { index, ...result };
    });

    const errors = results.filter(r => !r.isValid);
    
    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? 
        `Item at index ${errors[0].index}: ${errors[0].error}` : undefined,
    };
  };
}

/**
 * Object shape validator factory
 */
export function shape(validators: Record<string, ValidatorFunction>): ValidatorFunction {
  return (value, context) => {
    if (typeof value !== 'object' || value === null) {
      return { isValid: false, error: 'Must be an object' };
    }

    const errors: string[] = [];

    for (const [field, validator] of Object.entries(validators)) {
      const fieldValue = (value as any)[field];
      const result = validator(fieldValue, { ...context, field });
      if (!result.isValid && result.error) {
        errors.push(`${field}: ${result.error}`);
      }
    }

    return {
      isValid: errors.length === 0,
      error: errors.join(', '),
    };
  };
}

/**
 * Custom validator factory with custom error message
 */
export function custom(
  validate: (value: any, context?: ValidationContext) => boolean,
  message: string
): ValidatorFunction {
  return (value, context) => {
    const isValid = validate(value, context);
    return {
      isValid,
      error: isValid ? undefined : message,
    };
  };
}

// Register common validators
export function registerCommonValidators(): void {
  // Basic validators
  validationRegistry.register('required', required, { 
    category: 'basic',
    description: 'Ensures field has a value',
    tags: ['common']
  });
  
  validationRegistry.register('email', email, { 
    category: 'format',
    description: 'Validates email format',
    tags: ['common', 'contact']
  });
  
  validationRegistry.register('phone', phone, { 
    category: 'format',
    description: 'Validates phone number format',
    tags: ['common', 'contact']
  });
  
  validationRegistry.register('url', url, { 
    category: 'format',
    description: 'Validates URL format',
    tags: ['common', 'web']
  });
  
  validationRegistry.register('date', date, { 
    category: 'format',
    description: 'Validates date format',
    tags: ['common', 'temporal']
  });
  
  validationRegistry.register('futureDate', futureDate, { 
    category: 'temporal',
    description: 'Ensures date is in the future',
    tags: ['temporal']
  });
  
  validationRegistry.register('pastDate', pastDate, { 
    category: 'temporal',
    description: 'Ensures date is in the past',
    tags: ['temporal']
  });

  // Pattern validators
  validationRegistry.register('alphanumeric', pattern(PATTERNS.alphanumeric, 'Must contain only letters and numbers'), {
    category: 'format',
    description: 'Alphanumeric characters only',
    tags: ['text']
  });
  
  validationRegistry.register('alpha', pattern(PATTERNS.alpha, 'Must contain only letters'), {
    category: 'format',
    description: 'Letters only',
    tags: ['text']
  });
  
  validationRegistry.register('numeric', pattern(PATTERNS.numeric, 'Must contain only numbers'), {
    category: 'format',
    description: 'Numbers only',
    tags: ['number']
  });
  
  validationRegistry.register('slug', pattern(PATTERNS.slug, 'Must be a valid slug (lowercase letters, numbers, and hyphens)'), {
    category: 'format',
    description: 'URL-friendly slug format',
    tags: ['web']
  });
}