# Form Validation Framework

A comprehensive validation system for React forms that provides client-side validation, error handling, async validation, and real-time UX feedback.

## Features

- 🎯 **Centralized Validation Registry** - Manage all validators in one place
- 🔧 **Reusable Validation Rules** - Pre-built validators and custom rule creation
- 🌐 **i18n Error Messages** - Multi-language support with dynamic interpolation
- ⚡ **Async Validation** - With caching, debouncing, and request deduplication
- 🎨 **Enhanced Form Components** - Drop-in replacements with built-in validation
- 📊 **Real-time Feedback** - Live validation status and progress indicators
- 🔗 **Composable Validators** - Chain and combine validators easily
- 🎭 **Multiple Validation Modes** - onChange, onBlur, or onSubmit

## Quick Start

### Basic Usage

```tsx
import { EnhancedFormField, EmailField, PasswordField } from '@/components/forms';
import { required, email, minLength } from '@/utils/validation';

function LoginForm() {
  return (
    <form>
      <EmailField
        name="email"
        label="Email"
        rules={[{ validator: required }, { validator: email }]}
      />
      
      <PasswordField
        name="password"
        label="Password"
        rules={[{ validator: minLength(8) }]}
      />
    </form>
  );
}
```

### With React Hook Form

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ValidationProvider } from '@/contexts/ValidationContext';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function FormWithValidation() {
  const form = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <ValidationProvider>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <EnhancedFormField
            name="email"
            label="Email"
            type="email"
          />
          <EnhancedFormField
            name="password"
            label="Password"
            type="password"
          />
        </form>
      </FormProvider>
    </ValidationProvider>
  );
}
```

## Core Components

### EnhancedFormField

The main field component with built-in validation support:

```tsx
<EnhancedFormField
  name="username"
  label="Username"
  rules={[
    { validator: required },
    { validator: minLength(3) },
    { validator: checkUsernameAvailable, async: true }
  ]}
  validateOnChange={true}
  validateOnBlur={true}
  showValidIcon={true}
  showLoadingIcon={true}
  asyncDebounceMs={500}
/>
```

### Pre-configured Fields

Ready-to-use field components with common validation:

- `EmailField` - Email validation
- `PasswordField` - Password strength validation
- `PhoneField` - Phone number format validation
- `UrlField` - URL format validation
- `NumberField` - Numeric validation with min/max

### Validation Feedback Components

#### FieldStatusIndicator
Shows validation status with icons:

```tsx
<FieldStatusIndicator
  status="valid" // 'default' | 'validating' | 'valid' | 'error' | 'warning'
  message="Email is available"
  size="md"
  showTooltip
/>
```

#### LiveValidationFeedback
Real-time validation messages:

```tsx
<LiveValidationFeedback
  isValidating={false}
  isValid={true}
  error={undefined}
  warnings={[]}
  mode="inline" // 'inline' | 'float' | 'tooltip'
/>
```

#### ErrorSummary
Displays all form errors in one place:

```tsx
<ErrorSummary
  errors={formErrors}
  title="Please fix the following errors:"
  groupBySeverity
  showSeverityIcons
  collapsible
/>
```

#### ValidationProgressIndicator
Shows overall form completion:

```tsx
<ValidationProgressIndicator
  totalFields={10}
  validatedFields={7}
  validFields={5}
  showPercentage
  showDetails
/>
```

## Validation Rules

### Built-in Validators

```tsx
import { 
  required, 
  email, 
  phone, 
  url, 
  date,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  matches
} from '@/utils/validation';

// Basic usage
const emailValidator = email;
const phoneValidator = phone;

// Factory validators
const passwordValidator = minLength(8);
const ageValidator = between(18, 100);
const urlValidator = pattern(/^https:\/\//, 'Must be HTTPS');
```

### Async Validators

```tsx
import { createEmailAvailabilityValidator } from '@/utils/validation';

const checkEmail = createEmailAvailabilityValidator(
  async (email) => {
    const response = await api.checkEmailAvailability(email);
    return response.available;
  }
);

// With caching and debouncing
const enhancedValidator = asyncValidationManager.createEnhancedValidator(
  myAsyncValidator,
  {
    cacheTTL: 60000,      // Cache for 1 minute
    debounceMs: 500,      // Debounce 500ms
    retryCount: 2,        // Retry twice on failure
    timeout: 10000,       // 10 second timeout
  }
);
```

### Composing Validators

```tsx
import { compose, pipe, conditional, withMessage } from '@/utils/validation';

// Run all validators (collect all errors)
const emailValidation = compose(
  required,
  email,
  checkEmailAvailable
);

// Run validators in sequence (stop on first error)
const passwordValidation = pipe(
  required,
  minLength(8),
  hasUppercase,
  hasNumber
);

// Conditional validation
const phoneValidation = conditional(
  (value) => !!value, // Only validate if provided
  compose(minLength(10), phoneFormat)
);

// Custom error messages
const usernameValidation = withMessage(
  minLength(3),
  'Username must be at least 3 characters'
);
```

### Custom Validators

```tsx
import { ValidatorFunction, createValidationSchema } from '@/utils/validation';

// Simple custom validator
const noSpaces: ValidatorFunction = (value) => {
  const hasSpaces = /\s/.test(value);
  return {
    isValid: !hasSpaces,
    error: hasSpaces ? 'Spaces are not allowed' : undefined,
  };
};

// Complex validation schema
const userSchema = createValidationSchema()
  .add(required)
  .add(email)
  .addAsync(checkEmailAvailable)
  .addIf(
    (value) => value.includes('@company.com'),
    requiresEmployeeId
  )
  .build();
```

## Validation Context

The `ValidationProvider` manages form-wide validation state:

```tsx
import { ValidationProvider, useValidationContext } from '@/contexts/ValidationContext';

function MyForm() {
  return (
    <ValidationProvider
      validateOnChange={true}
      validateOnBlur={true}
      onValidate={async (field, value) => {
        // Custom validation logic
        return error ? 'Error message' : undefined;
      }}
    >
      <FormContent />
    </ValidationProvider>
  );
}

function FormContent() {
  const { 
    formState,
    setFieldValue,
    setFieldError,
    validateField,
    hasErrors
  } = useValidationContext();

  // Use validation context methods
}
```

## Error Messages

### i18n Support

```tsx
import { useErrorMessages } from '@/utils/validation';

function MyComponent() {
  const { getMessage, formatFieldError } = useErrorMessages();

  // Get translated error message
  const error = getMessage('required', { field: 'Email' });
  
  // Format field-specific error
  const fieldError = formatFieldError('email', 'invalid');
}
```

### Custom Error Templates

```tsx
import { errorMessageManager } from '@/utils/validation';

// Register custom templates
errorMessageManager.registerTemplate('customError', {
  key: 'validation.customError',
  defaultMessage: 'Custom error: {reason}',
  severity: 'error',
  interpolate: (params) => `Custom error: ${params.reason}`,
});

// Override existing messages
errorMessageManager.setCustomMessage('required', 'This field cannot be empty');
```

## Advanced Features

### Validation Modes

Control when validation occurs:

```tsx
<ValidationProvider
  validateOnChange={true}   // Validate as user types
  validateOnBlur={true}     // Validate when field loses focus
  validateOnSubmit={true}   // Validate on form submission
>
```

### Caching & Performance

```tsx
// Cache validation results
const cachedValidator = asyncValidationManager.createCachedValidator(
  expensiveValidator,
  { cacheTTL: 300000 } // 5 minutes
);

// Debounce validation
const debouncedValidator = asyncValidationManager.createDebouncedValidator(
  validator,
  500 // 500ms delay
);

// Memoize validation results
const memoizedValidator = memoize(validator, (value) => value.id);
```

### Form-Level Validation

```tsx
const formSchema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);
```

## Best Practices

1. **Use pre-built validators** when possible for consistency
2. **Compose validators** instead of creating complex single validators
3. **Cache async validations** to reduce API calls
4. **Debounce user input** for async validators
5. **Show appropriate feedback** based on validation state
6. **Group related fields** in form sections
7. **Provide clear error messages** with actionable guidance
8. **Use proper validation modes** based on UX requirements

## Integration Examples

### With Zod

```tsx
import { fromZodSchemas } from '@/utils/validation';

const zodValidator = fromZodSchemas(
  z.string().email(),
  z.string().min(5)
);
```

### With Custom Hooks

```tsx
import { useFieldValidation } from '@/hooks/useFieldValidation';

function CustomField() {
  const validation = useFieldValidation({
    schema: z.string().email(),
    asyncValidator: checkEmailAvailable,
    debounceMs: 500,
  });

  return (
    <input
      onChange={(e) => validation.validateDebounced(e.target.value)}
      onBlur={(e) => validation.validate(e.target.value)}
    />
  );
}
```

## Migration Guide

### From Basic Form Fields

```tsx
// Before
<input
  name="email"
  type="email"
  required
/>

// After
<EmailField
  name="email"
  label="Email"
  rules={[{ validator: required }]}
/>
```

### From Manual Validation

```tsx
// Before
const validateEmail = (email) => {
  if (!email) return 'Email is required';
  if (!email.includes('@')) return 'Invalid email';
  return null;
};

// After
const emailValidation = compose(
  required,
  email
);
```

## TypeScript Support

All components and utilities are fully typed:

```tsx
import type { 
  ValidatorFunction, 
  ValidationResult,
  ValidationRule,
  ErrorMessage 
} from '@/utils/validation';

const typedValidator: ValidatorFunction<string> = (value) => ({
  isValid: value.length > 0,
  error: value.length === 0 ? 'Required' : undefined,
});
```