/**
 * Authentication validation schemas
 */
import { z } from 'zod';
import { 
  emailSchema, 
  passwordSchema, 
  languageSchema, 
  unitSystemSchema, 
  energyUnitSchema, 
  timezoneSchema,
  uuidSchema,
  dateSchema,
} from './common';

// User registration schema
export const userRegisterSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirm_password: passwordSchema,
    language: languageSchema.default('cs'),
    unit_system: unitSystemSchema.default('metric'),
    energy_unit: energyUnitSchema.default('kcal'),
    has_pku: z.boolean().default(false),
    timezone: timezoneSchema,
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine(
    (data) => {
      const emailParts = data.email.toLowerCase().split('@');
      const passwordLower = data.password.toLowerCase();
      return !emailParts.some((part) => passwordLower.includes(part));
    },
    {
      message: 'Password cannot contain parts of your email address',
      path: ['password'],
    }
  );

// User login schema
export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  captcha_challenge_id: z.string().optional(),
  captcha_response: z.string().optional(),
});

// User profile update schema
export const userUpdateSchema = z.object({
  language: languageSchema.optional(),
  unit_system: unitSystemSchema.optional(),
  energy_unit: energyUnitSchema.optional(),
  has_pku: z.boolean().optional(),
  timezone: timezoneSchema.optional(),
});

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

// Password reset confirmation schema
export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(32, 'Invalid reset token'),
    new_password: passwordSchema,
    confirm_password: passwordSchema,
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

// Email verification schema
export const emailVerificationSchema = z.object({
  token: z.string().min(32, 'Invalid verification token'),
});

// Password change schema (for authenticated users)
export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: passwordSchema,
    confirm_password: passwordSchema,
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
  });

// Token refresh schema
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// Logout schema
export const logoutSchema = z.object({
  refresh_token: z.string().optional(),
  all_sessions: z.boolean().default(false),
});

// Session management schemas
export const sessionResponseSchema = z.object({
  id: uuidSchema,
  device_name: z.string(),
  device_type: z.string(),
  browser: z.string(),
  os: z.string(),
  ip_address: z.string().nullable(),
  location: z.string().nullable(),
  created_at: dateSchema,
  last_accessed: dateSchema,
  expires_at: dateSchema,
  is_current: z.boolean().default(false),
});

export const sessionListResponseSchema = z.object({
  sessions: z.array(sessionResponseSchema),
  total: z.number().int().nonnegative(),
  max_allowed: z.number().int().positive(),
});

// User response schema (for API responses)
export const userResponseSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  email_verified: z.boolean(),
  language: languageSchema,
  unit_system: unitSystemSchema,
  energy_unit: energyUnitSchema,
  has_pku: z.boolean(),
  timezone: timezoneSchema,
  role: z.string(),
  is_active: z.boolean(),
  recipe_count: z.number().int().nonnegative(),
  trip_count: z.number().int().nonnegative(),
  created_at: dateSchema,
  updated_at: dateSchema,
  last_login: dateSchema.nullable().optional(),
});

// Token response schema
export const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive(),
  user: userResponseSchema,
});

// Type exports
export type UserRegister = z.infer<typeof userRegisterSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;
export type EmailVerification = z.infer<typeof emailVerificationSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type RefreshToken = z.infer<typeof refreshTokenSchema>;
export type Logout = z.infer<typeof logoutSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;