/**
 * Form Validation Framework
 * 
 * A comprehensive validation system for React forms with support for:
 * - Centralized validation registry
 * - Reusable validation rules
 * - Async validation with caching
 * - i18n error messages
 * - Validation composition
 * - Real-time UX feedback
 */

// Core registry exports
export {
  validationRegistry,
  createSchemaValidator,
  createAsyncValidator,
  type ValidatorFunction,
  type AsyncValidatorFunction,
  type ValidationResult,
  type ValidationContext,
  type RegisteredValidator,
} from './registry';

// Validation rules exports
export {
  // Basic validators
  required,
  email,
  phone,
  url,
  date,
  futureDate,
  pastDate,
  
  // Factory validators
  minLength,
  maxLength,
  lengthBetween,
  pattern,
  between,
  min,
  max,
  dateBetween,
  matches,
  when,
  all,
  any,
  not,
  optional,
  arrayOf,
  shape,
  custom,
  
  // Registration
  registerCommonValidators,
} from './rules';

// Error message exports
export {
  errorMessageManager,
  useErrorMessages,
  createFieldErrorMessage,
  groupErrorsBySeverity,
  type ErrorMessage,
  type ErrorSeverity,
  type ErrorMessageTemplate,
} from './errorMessages';

// Async validation exports
export {
  asyncValidationManager,
  createEmailAvailabilityValidator,
  createUsernameAvailabilityValidator,
  createRemoteValidator,
  type AsyncValidationOptions,
  type CachedValidationResult,
} from './asyncValidation';

// Composition exports
export {
  pipe,
  pipeAsync,
  compose,
  composeAsync,
  conditional,
  conditionalAsync,
  withTransform,
  withMessage,
  withWarning,
  lazy,
  memoize,
  debounce,
  fromZodSchemas,
  createValidationSchema,
  CommonSchemas,
  ValidationSchemaBuilder,
} from './compose';

// Initialize common validators on import
import { registerCommonValidators } from './rules';
registerCommonValidators();

/**
 * Quick start examples:
 * 
 * 1. Basic field validation:
 * ```tsx
 * import { required, email, minLength } from '@/utils/validation';
 * 
 * const emailValidator = compose(required, email);
 * const passwordValidator = compose(required, minLength(8));
 * ```
 * 
 * 2. Async validation with caching:
 * ```tsx
 * import { createEmailAvailabilityValidator } from '@/utils/validation';
 * 
 * const checkEmail = createEmailAvailabilityValidator(
 *   async (email) => {
 *     const response = await api.checkEmail(email);
 *     return response.available;
 *   }
 * );
 * ```
 * 
 * 3. Custom validation schema:
 * ```tsx
 * import { createValidationSchema } from '@/utils/validation';
 * 
 * const userSchema = createValidationSchema()
 *   .add(required)
 *   .add(email)
 *   .addAsync(checkEmailAvailability)
 *   .build();
 * ```
 * 
 * 4. With React Hook Form:
 * ```tsx
 * import { EnhancedFormField } from '@/components/forms';
 * import { email, required } from '@/utils/validation';
 * 
 * <EnhancedFormField
 *   name="email"
 *   label="Email"
 *   rules={[
 *     { validator: required },
 *     { validator: email },
 *     { validator: checkEmail, async: true }
 *   ]}
 * />
 * ```
 */