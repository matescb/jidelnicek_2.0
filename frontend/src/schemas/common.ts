/**
 * Common validation schemas shared across the application
 */
import { z } from 'zod';

// Common field validations
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must not exceed 255 characters')
  .transform((val) => val.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one number'
  )
  .refine(
    (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
    'Password must contain at least one special character'
  )
  .refine(
    (password) => !/(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password),
    'Password cannot contain sequential patterns (e.g., abc, 123)'
  )
  .refine(
    (password) => !/(.)\\1{2,}/.test(password),
    'Password cannot contain more than 2 repeated characters in a row'
  );

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const dateSchema = z
  .string()
  .or(z.date())
  .transform((val) => (typeof val === 'string' ? new Date(val) : val))
  .refine((date) => !isNaN(date.getTime()), 'Invalid date');

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('asc').optional(),
});

export const decimalSchema = z
  .string()
  .or(z.number())
  .transform((val) => {
    if (typeof val === 'number') return val.toString();
    return val;
  })
  .refine((val) => !isNaN(parseFloat(val)), 'Must be a valid decimal number');

export const positiveDecimalSchema = decimalSchema.refine(
  (val) => parseFloat(val) > 0,
  'Must be a positive number'
);

export const percentageSchema = decimalSchema.refine(
  (val) => {
    const num = parseFloat(val);
    return num >= 0 && num <= 100;
  },
  'Must be between 0 and 100'
);

export const coefficientSchema = decimalSchema.refine(
  (val) => {
    const num = parseFloat(val);
    return num >= 10 && num <= 300;
  },
  'Coefficient must be between 10 and 300'
);

// Language and locale schemas
export const languageSchema = z.enum(['en', 'cs'], {
  errorMap: () => ({ message: 'Language must be either English (en) or Czech (cs)' }),
});

export const unitSystemSchema = z.enum(['metric', 'imperial'], {
  errorMap: () => ({ message: 'Unit system must be either metric or imperial' }),
});

export const energyUnitSchema = z.enum(['kcal', 'kJ'], {
  errorMap: () => ({ message: 'Energy unit must be either kcal or kJ' }),
});

export const timezoneSchema = z
  .string()
  .max(50, 'Timezone must not exceed 50 characters')
  .default('Europe/Prague');

// Common error messages
export const errorMessages = {
  required: 'This field is required',
  invalidEmail: 'Please enter a valid email address',
  passwordMismatch: 'Passwords do not match',
  passwordTooWeak: 'Password does not meet security requirements',
  invalidDate: 'Please enter a valid date',
  invalidNumber: 'Please enter a valid number',
  invalidUUID: 'Invalid identifier format',
  fieldTooLong: (max: number) => `This field must not exceed ${max} characters`,
  fieldTooShort: (min: number) => `This field must be at least ${min} characters`,
  numberTooSmall: (min: number) => `Value must be at least ${min}`,
  numberTooBig: (max: number) => `Value must not exceed ${max}`,
};

// Type exports
export type Email = z.infer<typeof emailSchema>;
export type Password = z.infer<typeof passwordSchema>;
export type UUID = z.infer<typeof uuidSchema>;
export type DateType = z.infer<typeof dateSchema>;
export type DateString = z.infer<typeof dateStringSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Decimal = z.infer<typeof decimalSchema>;
export type Language = z.infer<typeof languageSchema>;
export type UnitSystem = z.infer<typeof unitSystemSchema>;
export type EnergyUnit = z.infer<typeof energyUnitSchema>;
export type Timezone = z.infer<typeof timezoneSchema>;