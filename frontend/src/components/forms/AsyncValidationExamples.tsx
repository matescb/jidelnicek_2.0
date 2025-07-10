/**
 * Async validation examples
 * 
 * Demonstrates various async validation patterns including
 * loading states, error handling, caching, and different use cases.
 */

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { useZodForm } from '../../hooks/useZodForm';
import { useAsyncFieldValidator } from '../../hooks/useAsyncFieldValidator';
import { useFieldValidation } from '../../hooks/useFieldValidation';
import {
  createEmailUniquenessValidator,
  createUsernameAvailabilityValidator,
  createRecipeNameUniquenessValidator,
  createTripNameValidator,
  createDynamicValidator,
  usernameSchema,
} from '../../schemas/async';
import {
  checkEmailAvailability,
  checkUsernameAvailability,
  checkRecipeNameUniqueness,
  checkTripNameUniqueness,
  validationAPI,
} from '../../api/validation';
import { emailSchema, recipeNameSchema, tripNameSchema } from '../../utils/validation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { FormField, FormLabel, FormError, FormDescription } from '../ui/Form';

/**
 * Basic async validation example
 */
export function BasicAsyncValidationExample() {
  const emailValidator = useAsyncFieldValidator({
    schema: emailSchema,
    asyncValidator: createEmailUniquenessValidator(checkEmailAvailability),
    options: {
      debounceMs: 500,
      cacheTTL: 60000, // Cache for 1 minute
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Basic Async Validation</h3>
      
      <FormField>
        <FormLabel>Email Address</FormLabel>
        <div className="relative">
          <Input
            type="email"
            placeholder="Enter email"
            onChange={(e) => emailValidator.validate(e.target.value)}
            onBlur={(e) => emailValidator.validate(e.target.value, { debounce: false })}
            className={emailValidator.error ? 'border-red-500' : ''}
          />
          {emailValidator.isValidating && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>
        {emailValidator.error && (
          <FormError>{emailValidator.error}</FormError>
        )}
        {emailValidator.isValid && emailValidator.isValidated && (
          <p className="text-sm text-green-600">Email is available!</p>
        )}
        {emailValidator.wasCached && (
          <p className="text-xs text-gray-500">Result from cache</p>
        )}
      </FormField>
    </div>
  );
}

/**
 * Multiple async fields example
 */
export function MultipleAsyncFieldsExample() {
  const [userId] = useState('user1');

  const emailValidator = useAsyncFieldValidator({
    schema: emailSchema,
    asyncValidator: createEmailUniquenessValidator(checkEmailAvailability),
    options: { debounceMs: 500 },
  });

  const usernameValidator = useAsyncFieldValidator({
    schema: usernameSchema,
    asyncValidator: createUsernameAvailabilityValidator(checkUsernameAvailability),
    options: { debounceMs: 300 },
  });

  const recipeValidator = useAsyncFieldValidator({
    schema: recipeNameSchema,
    asyncValidator: createRecipeNameUniquenessValidator(checkRecipeNameUniqueness, userId),
    options: { debounceMs: 400 },
    dependencies: [userId], // Re-validate when userId changes
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted');
  };

  const isFormValid = 
    emailValidator.isValid && 
    usernameValidator.isValid && 
    recipeValidator.isValid;

  const anyValidating = 
    emailValidator.isValidating || 
    usernameValidator.isValidating || 
    recipeValidator.isValidating;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">Multiple Async Fields</h3>
      
      <FormField>
        <FormLabel>Email</FormLabel>
        <div className="relative">
          <Input
            type="email"
            onChange={(e) => emailValidator.validate(e.target.value)}
            className={emailValidator.error ? 'border-red-500' : ''}
          />
          {emailValidator.isValidating && (
            <LoadingSpinner size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" />
          )}
        </div>
        {emailValidator.error && <FormError>{emailValidator.error}</FormError>}
      </FormField>

      <FormField>
        <FormLabel>Username</FormLabel>
        <div className="relative">
          <Input
            type="text"
            onChange={(e) => usernameValidator.validate(e.target.value)}
            className={usernameValidator.error ? 'border-red-500' : ''}
          />
          {usernameValidator.isValidating && (
            <LoadingSpinner size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" />
          )}
        </div>
        {usernameValidator.error && <FormError>{usernameValidator.error}</FormError>}
        <FormDescription>Letters, numbers, underscores, and hyphens only</FormDescription>
      </FormField>

      <FormField>
        <FormLabel>Recipe Name</FormLabel>
        <div className="relative">
          <Input
            type="text"
            onChange={(e) => recipeValidator.validate(e.target.value)}
            className={recipeValidator.error ? 'border-red-500' : ''}
          />
          {recipeValidator.isValidating && (
            <LoadingSpinner size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" />
          )}
        </div>
        {recipeValidator.error && <FormError>{recipeValidator.error}</FormError>}
      </FormField>

      <Button 
        type="submit" 
        disabled={!isFormValid || anyValidating}
        className="w-full"
      >
        {anyValidating ? 'Validating...' : 'Submit'}
      </Button>
    </form>
  );
}

/**
 * Form with integrated async validation
 */
interface RegistrationFormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

const registrationSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function IntegratedAsyncFormExample() {
  const form = useZodForm({
    schema: registrationSchema,
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    },
    asyncValidators: {
      email: createEmailUniquenessValidator(checkEmailAvailability),
      username: createUsernameAvailabilityValidator(checkUsernameAvailability),
    },
    asyncValidationOptions: {
      debounceMs: 500,
      cacheTTL: 60000,
    },
  });

  const onSubmit = async (data: RegistrationFormData) => {
    console.log('Registration data:', data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <form onSubmit={form.handleSubmitWithLoading(onSubmit)} className="space-y-4">
      <h3 className="text-lg font-semibold">Integrated Async Validation</h3>
      
      <FormField>
        <FormLabel>Email</FormLabel>
        <Controller
          name="email"
          control={form.control}
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="email"
                onChange={(e) => {
                  field.onChange(e);
                  form.validateFieldAsync('email', e.target.value);
                }}
                className={form.formState.errors.email ? 'border-red-500' : ''}
              />
              {form.isAsyncValidating && (
                <LoadingSpinner size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" />
              )}
            </div>
          )}
        />
        {form.formState.errors.email && (
          <FormError>{form.formState.errors.email.message}</FormError>
        )}
      </FormField>

      <FormField>
        <FormLabel>Username</FormLabel>
        <Controller
          name="username"
          control={form.control}
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  form.validateFieldAsync('username', e.target.value);
                }}
                className={form.formState.errors.username ? 'border-red-500' : ''}
              />
            </div>
          )}
        />
        {form.formState.errors.username && (
          <FormError>{form.formState.errors.username.message}</FormError>
        )}
      </FormField>

      <FormField>
        <FormLabel>Password</FormLabel>
        <Input
          {...form.register('password')}
          type="password"
          className={form.formState.errors.password ? 'border-red-500' : ''}
        />
        {form.formState.errors.password && (
          <FormError>{form.formState.errors.password.message}</FormError>
        )}
      </FormField>

      <FormField>
        <FormLabel>Confirm Password</FormLabel>
        <Input
          {...form.register('confirmPassword')}
          type="password"
          className={form.formState.errors.confirmPassword ? 'border-red-500' : ''}
        />
        {form.formState.errors.confirmPassword && (
          <FormError>{form.formState.errors.confirmPassword.message}</FormError>
        )}
      </FormField>

      <Button
        type="submit"
        disabled={form.isSubmitting || form.isAsyncValidating}
        className="w-full"
      >
        {form.isSubmitting ? 'Registering...' : 'Register'}
      </Button>
    </form>
  );
}

/**
 * Advanced async validation with error handling
 */
export function AdvancedAsyncValidationExample() {
  const [retryCount, setRetryCount] = useState(0);
  const [showCache, setShowCache] = useState(false);

  // Create a validator that sometimes fails
  const unreliableValidator = useAsyncFieldValidator({
    asyncValidator: async (value: string) => {
      // Simulate unreliable network
      if (Math.random() < 0.3) {
        throw new Error('Network error');
      }
      
      const isAvailable = await checkUsernameAvailability(value);
      return {
        isValid: isAvailable,
        error: isAvailable ? undefined : 'Username taken',
        timestamp: Date.now(),
      };
    },
    options: {
      retryCount: 2,
      retryDelay: 500,
      cacheTTL: 30000,
    },
  });

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    unreliableValidator.reset();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Advanced Error Handling</h3>
      
      <FormField>
        <FormLabel>Username (Unreliable Network)</FormLabel>
        <div className="relative">
          <Input
            type="text"
            placeholder="Try 'john_doe' (taken)"
            onChange={(e) => unreliableValidator.validate(e.target.value)}
            className={unreliableValidator.error ? 'border-red-500' : ''}
          />
          {unreliableValidator.isValidating && (
            <LoadingSpinner size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" />
          )}
        </div>
        
        {unreliableValidator.error && (
          <div className="space-y-2">
            <FormError>{unreliableValidator.error}</FormError>
            {unreliableValidator.error.includes('Network') && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRetry}
              >
                Retry ({retryCount})
              </Button>
            )}
          </div>
        )}
        
        {unreliableValidator.isValid && unreliableValidator.isValidated && (
          <p className="text-sm text-green-600">Username available!</p>
        )}
        
        <div className="mt-2 space-y-1 text-xs text-gray-600">
          <p>Status: {unreliableValidator.isValidating ? 'Validating...' : 'Idle'}</p>
          <p>Cached: {unreliableValidator.wasCached ? 'Yes' : 'No'}</p>
          {unreliableValidator.validatedAt && (
            <p>Last validated: {new Date(unreliableValidator.validatedAt).toLocaleTimeString()}</p>
          )}
        </div>
      </FormField>

      <Button
        size="sm"
        variant="outline"
        onClick={() => unreliableValidator.clearError()}
      >
        Clear Cache
      </Button>
    </div>
  );
}

/**
 * Dynamic validation rules example
 */
export function DynamicValidationExample() {
  const [validationType, setValidationType] = useState<'length' | 'pattern'>('length');
  const [minLength, setMinLength] = useState(3);

  const dynamicValidator = useAsyncFieldValidator({
    asyncValidator: createDynamicValidator(async (value: string) => {
      if (validationType === 'length') {
        return {
          valid: value.length >= minLength,
          error: `Must be at least ${minLength} characters`,
        };
      } else {
        const hasUppercase = /[A-Z]/.test(value);
        return {
          valid: hasUppercase,
          error: 'Must contain at least one uppercase letter',
        };
      }
    }),
    dependencies: [validationType, minLength], // Re-validate when rules change
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Dynamic Validation Rules</h3>
      
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            value="length"
            checked={validationType === 'length'}
            onChange={(e) => setValidationType('length')}
          />
          Length validation
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            value="pattern"
            checked={validationType === 'pattern'}
            onChange={(e) => setValidationType('pattern')}
          />
          Pattern validation
        </label>
      </div>

      {validationType === 'length' && (
        <div className="flex items-center gap-2">
          <label>Min length:</label>
          <input
            type="number"
            value={minLength}
            onChange={(e) => setMinLength(Number(e.target.value))}
            className="w-20 px-2 py-1 border rounded"
            min="1"
            max="20"
          />
        </div>
      )}

      <FormField>
        <FormLabel>Dynamic Field</FormLabel>
        <div className="relative">
          <Input
            type="text"
            placeholder="Enter value"
            onChange={(e) => dynamicValidator.validate(e.target.value)}
            className={dynamicValidator.error ? 'border-red-500' : ''}
          />
          {dynamicValidator.isValidating && (
            <LoadingSpinner size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" />
          )}
        </div>
        {dynamicValidator.error && (
          <FormError>{dynamicValidator.error}</FormError>
        )}
        {dynamicValidator.isValid && dynamicValidator.isValidated && (
          <p className="text-sm text-green-600">Valid!</p>
        )}
      </FormField>
    </div>
  );
}

/**
 * Main examples component
 */
export function AsyncValidationExamples() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Async Validation Examples</h1>
      
      <div className="grid gap-8 md:grid-cols-2">
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <BasicAsyncValidationExample />
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <MultipleAsyncFieldsExample />
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-sm border md:col-span-2">
          <IntegratedAsyncFormExample />
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <AdvancedAsyncValidationExample />
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <DynamicValidationExample />
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900">Demo Tips:</h3>
        <ul className="mt-2 space-y-1 text-sm text-blue-800">
          <li>• Try existing emails: john@example.com, jane@example.com</li>
          <li>• Try existing usernames: john_doe, admin, testuser</li>
          <li>• Watch for loading spinners during validation</li>
          <li>• Notice cache indicators when re-entering same values</li>
          <li>• The unreliable validator simulates network errors ~30% of the time</li>
        </ul>
      </div>
    </div>
  );
}