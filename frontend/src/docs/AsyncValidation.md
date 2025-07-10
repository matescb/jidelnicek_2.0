# Async Validation Documentation

## Overview

The async validation system provides comprehensive support for asynchronous field validation in forms, including API-based uniqueness checks, availability validation, and dynamic validation rules. The system features automatic debouncing, result caching, proper abort handling, and seamless integration with existing form components.

## Key Features

- **Debounced Validation**: Prevents excessive API calls during typing
- **Result Caching**: Caches validation results to avoid redundant API calls
- **Abort Management**: Properly cancels in-flight requests when component unmounts
- **Queue Management**: Controls concurrent validation requests
- **Retry Logic**: Automatically retries failed validations
- **Loading States**: Shows loading indicators during validation
- **Success Indicators**: Visual feedback for successful validations
- **Error Handling**: Graceful handling of network errors and timeouts

## Core Components

### 1. Async Validation Utilities (`utils/asyncValidation.ts`)

Provides the foundation for async validation:

```typescript
// Create a basic async validator
const validator: AsyncValidator<string> = async (value, signal) => {
  const isValid = await checkAvailability(value);
  return {
    isValid,
    error: isValid ? undefined : 'Value not available',
    timestamp: Date.now(),
  };
};

// Add caching
const cachedValidator = createCachedValidator(validator, {
  cacheTTL: 60000, // 1 minute
  maxCacheSize: 100,
});

// Add debouncing
const debouncedValidator = createDebouncedValidator(validator, 500);

// Add retry logic
const retryingValidator = createRetryingValidator(validator, {
  retryCount: 2,
  retryDelay: 1000,
});
```

### 2. Async Validation Schemas (`schemas/async.ts`)

Pre-built validators for common use cases:

```typescript
// Email uniqueness
const emailValidator = createEmailUniquenessValidator(checkEmailApi);

// Username availability
const usernameValidator = createUsernameAvailabilityValidator(checkUsernameApi);

// Recipe name uniqueness (per user)
const recipeValidator = createRecipeNameUniquenessValidator(
  checkRecipeApi,
  userId
);

// Dynamic validation
const dynamicValidator = createDynamicValidator(async (value) => {
  const result = await validateWithApi(value);
  return { valid: result.isValid, error: result.message };
});
```

### 3. Async Field Validator Hook (`hooks/useAsyncFieldValidator.ts`)

React hook for async field validation:

```typescript
const emailValidation = useAsyncFieldValidator({
  schema: emailSchema, // Optional sync validation
  asyncValidator: emailUniquenessValidator,
  options: {
    debounceMs: 500,
    cacheTTL: 60000,
  },
  dependencies: [userId], // Re-validate when dependencies change
});

// In your component
<input
  onChange={(e) => emailValidation.validate(e.target.value)}
  onBlur={(e) => emailValidation.validate(e.target.value, { debounce: false })}
/>
{emailValidation.isValidating && <Spinner />}
{emailValidation.error && <Error>{emailValidation.error}</Error>}
```

### 4. Integration with useZodForm

The `useZodForm` hook now supports async validators:

```typescript
const form = useZodForm({
  schema: formSchema,
  asyncValidators: {
    email: emailUniquenessValidator,
    username: usernameAvailabilityValidator,
  },
  asyncValidationOptions: {
    debounceMs: 500,
    cacheTTL: 60000,
  },
});

// Validate field asynchronously
await form.validateFieldAsync('email', value);

// Check if any async validation is running
if (form.isAsyncValidating) {
  // Show loading state
}
```

## Usage Examples

### Basic Async Validation

```tsx
function EmailField() {
  const validator = useAsyncFieldValidator({
    schema: emailSchema,
    asyncValidator: createEmailUniquenessValidator(checkEmailApi),
    options: { debounceMs: 500 },
  });

  return (
    <FormInput
      label="Email"
      onChange={(e) => validator.validate(e.target.value)}
      error={validator.error}
      loading={validator.isValidating}
      success={validator.isValid && validator.isValidated}
    />
  );
}
```

### Multiple Async Fields

```tsx
function RegistrationForm() {
  const form = useZodForm({
    schema: registrationSchema,
    asyncValidators: {
      email: emailValidator,
      username: usernameValidator,
    },
  });

  return (
    <form onSubmit={form.handleSubmitWithLoading(onSubmit)}>
      <FormInput
        {...form.register('email')}
        onChange={(e) => {
          form.register('email').onChange(e);
          form.validateFieldAsync('email', e.target.value);
        }}
        loading={form.asyncFieldValidators.get('email')?.isValidating}
      />
      {/* More fields... */}
    </form>
  );
}
```

### Conditional Async Validation

```tsx
const conditionalValidator = createConditionalAsyncValidator(
  (value) => value.length > 3, // Only validate if length > 3
  usernameAvailabilityValidator
);
```

### Composite Validators

```tsx
const compositeValidator = createCompositeAsyncValidator([
  formatValidator,      // Check format first
  uniquenessValidator,  // Then check uniqueness
  customRuleValidator,  // Finally apply custom rules
]);
```

## API Mock Services

The `api/validation.ts` file provides mock validation services:

```typescript
// Check email availability
await checkEmailAvailability('user@example.com'); // returns boolean

// Check username with rate limiting simulation
await validationAPI.checkUsername('john_doe', { rateLimited: true });

// Add mock data for testing
validationAPI.addMockEmail('taken@example.com');
validationAPI.addMockUsername('existing_user');
```

## Best Practices

1. **Always Debounce**: Use appropriate debounce delays (300-500ms) to avoid excessive API calls
2. **Cache Results**: Enable caching for validations that don't change frequently
3. **Handle Errors Gracefully**: Provide fallback behavior for network failures
4. **Show Loading States**: Always indicate when async validation is in progress
5. **Validate on Blur**: Perform immediate validation on blur for better UX
6. **Clear Cache on Dependencies**: Clear cache when relevant data changes

## Performance Considerations

- **Cache TTL**: Set appropriate cache expiration times based on data volatility
- **Max Cache Size**: Limit cache size to prevent memory issues
- **Concurrent Validations**: Control max concurrent requests to avoid overwhelming the API
- **Abort Signals**: Always handle abort signals to cancel unnecessary requests

## Error Handling

The system provides multiple levels of error handling:

1. **Network Errors**: Automatic retry with configurable attempts
2. **Validation Errors**: Clear error messages from validators
3. **Timeout Handling**: Configurable request timeouts
4. **Rate Limiting**: Graceful handling of rate limit errors

## Migration Guide

To add async validation to existing forms:

1. Create or import an async validator
2. Add it to your form's `asyncValidators` option
3. Call `validateFieldAsync` on field changes
4. Check `isAsyncValidating` for loading states
5. Handle async errors in form submission

## TypeScript Support

Full TypeScript support with proper typing:

```typescript
type EmailValidator = AsyncValidator<string>;
type ValidationResult = {
  isValid: boolean;
  error?: string;
  timestamp: number;
  cached?: boolean;
};
```

## Testing

When testing components with async validation:

1. Mock the validation APIs
2. Use `waitFor` for async assertions
3. Test error states and retry logic
4. Verify cache behavior
5. Test abort/cleanup on unmount