import { z } from 'zod'

// Password validation schema
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

// Email validation schema
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email too long')

// Common validation patterns
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name too long')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters')

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')

// Recipe validation schemas
export const recipeNameSchema = z
  .string()
  .min(1, 'Recipe name is required')
  .max(100, 'Recipe name too long')

export const recipeDescriptionSchema = z
  .string()
  .max(500, 'Description too long')

export const recipeInstructionsSchema = z
  .string()
  .min(10, 'Instructions are required')
  .max(2000, 'Instructions too long')

// Trip validation schemas
export const tripNameSchema = z
  .string()
  .min(1, 'Trip name is required')
  .max(100, 'Trip name too long')

export const dateRangeSchema = z.object({
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
}).refine((data) => {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  return end >= start
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
})

// Utility functions
export const isValidEmail = (email: string): boolean => {
  try {
    emailSchema.parse(email)
    return true
  } catch {
    return false
  }
}

export const isValidPassword = (password: string): boolean => {
  try {
    passwordSchema.parse(password)
    return true
  } catch {
    return false
  }
}

export const getPasswordStrength = (password: string): number => {
  if (!password) return 0
  
  let score = 0
  
  // Length check
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  
  // Character variety checks
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  
  // Complexity bonus
  if (password.length >= 20 && score >= 4) score++
  
  // Common patterns (penalty)
  if (/^(password|12345|qwerty|admin)/i.test(password)) score = Math.max(score - 2, 1)
  
  return Math.min(score, 5)
}