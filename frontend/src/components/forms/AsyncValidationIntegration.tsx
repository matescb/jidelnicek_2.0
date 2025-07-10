/**
 * Async validation integration with existing form components
 * 
 * Shows how to use async validation with the existing form infrastructure
 */

import React from 'react';
import { z } from 'zod';
import { useZodForm } from '../../hooks/useZodForm';
import { useAsyncFieldValidator } from '../../hooks/useAsyncFieldValidator';
import { FormInput } from './FormInput';
import { FormSelect } from './FormSelect';
import { FormTextarea } from './FormTextarea';
import { Button } from '../ui/button';
import {
  createEmailUniquenessValidator,
  createRecipeNameUniquenessValidator,
  usernameSchema,
} from '../../schemas/async';
import {
  checkEmailAvailability,
  checkRecipeNameUniqueness,
  checkUsernameAvailability,
} from '../../api/validation';
import { emailSchema, recipeNameSchema } from '../../utils/validation';

// Recipe form schema
const recipeFormSchema = z.object({
  name: recipeNameSchema,
  category: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'dessert']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  ingredients: z.string().min(10, 'Please add at least one ingredient'),
  instructions: z.string().min(20, 'Instructions must be at least 20 characters'),
  prepTime: z.number().min(1, 'Prep time must be at least 1 minute'),
  cookTime: z.number().min(0, 'Cook time cannot be negative'),
  servings: z.number().min(1, 'Must serve at least 1 person'),
});

type RecipeFormData = z.infer<typeof recipeFormSchema>;

/**
 * Recipe form with async name validation
 */
export function AsyncRecipeForm() {
  const userId = 'user1'; // In real app, get from auth context

  // Create async validator for recipe name
  const recipeNameValidator = useAsyncFieldValidator({
    schema: recipeNameSchema,
    asyncValidator: createRecipeNameUniquenessValidator(checkRecipeNameUniqueness, userId),
    options: {
      debounceMs: 500,
      cacheTTL: 30000, // Cache for 30 seconds
    },
  });

  const form = useZodForm({
    schema: recipeFormSchema,
    defaultValues: {
      name: '',
      category: 'dinner',
      description: '',
      ingredients: '',
      instructions: '',
      prepTime: 30,
      cookTime: 30,
      servings: 4,
    },
  });

  const onSubmit = async (data: RecipeFormData) => {
    // Validate recipe name uniqueness before submit
    const nameError = await recipeNameValidator.validate(data.name, { debounce: false });
    if (nameError) {
      form.setError('name', { message: nameError });
      return;
    }

    console.log('Recipe submitted:', data);
    // In real app, send to API
  };

  return (
    <form onSubmit={form.handleSubmitWithLoading(onSubmit)} className="space-y-6">
      <h2 className="text-xl font-semibold">Create New Recipe</h2>

      <FormInput
        label="Recipe Name"
        {...form.register('name')}
        error={form.formState.errors.name?.message || recipeNameValidator.error}
        onChange={(e) => {
          form.register('name').onChange(e);
          recipeNameValidator.validate(e.target.value);
        }}
        onBlur={(e) => {
          form.register('name').onBlur(e);
          recipeNameValidator.validate(e.target.value, { debounce: false });
        }}
        loading={recipeNameValidator.isValidating}
        success={recipeNameValidator.isValid && recipeNameValidator.isValidated}
        helperText={
          recipeNameValidator.wasCached 
            ? 'Checked from cache' 
            : recipeNameValidator.isValid && recipeNameValidator.isValidated
            ? 'Recipe name is available!'
            : undefined
        }
      />

      <FormSelect
        label="Category"
        {...form.register('category')}
        error={form.formState.errors.category?.message}
        options={[
          { value: 'breakfast', label: 'Breakfast' },
          { value: 'lunch', label: 'Lunch' },
          { value: 'dinner', label: 'Dinner' },
          { value: 'snack', label: 'Snack' },
          { value: 'dessert', label: 'Dessert' },
        ]}
      />

      <FormTextarea
        label="Description"
        {...form.register('description')}
        error={form.formState.errors.description?.message}
        rows={3}
        placeholder="Brief description of your recipe..."
      />

      <FormTextarea
        label="Ingredients"
        {...form.register('ingredients')}
        error={form.formState.errors.ingredients?.message}
        rows={5}
        placeholder="List each ingredient on a new line..."
      />

      <FormTextarea
        label="Instructions"
        {...form.register('instructions')}
        error={form.formState.errors.instructions?.message}
        rows={6}
        placeholder="Step-by-step cooking instructions..."
      />

      <div className="grid grid-cols-3 gap-4">
        <FormInput
          label="Prep Time (min)"
          type="number"
          {...form.register('prepTime', { valueAsNumber: true })}
          error={form.formState.errors.prepTime?.message}
        />

        <FormInput
          label="Cook Time (min)"
          type="number"
          {...form.register('cookTime', { valueAsNumber: true })}
          error={form.formState.errors.cookTime?.message}
        />

        <FormInput
          label="Servings"
          type="number"
          {...form.register('servings', { valueAsNumber: true })}
          error={form.formState.errors.servings?.message}
        />
      </div>

      <Button
        type="submit"
        disabled={form.isSubmitting || recipeNameValidator.isValidating}
        className="w-full"
      >
        {form.isSubmitting ? 'Creating Recipe...' : 'Create Recipe'}
      </Button>
    </form>
  );
}

/**
 * User profile form with multiple async validations
 */
const profileFormSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export function AsyncProfileForm() {
  const form = useZodForm({
    schema: profileFormSchema,
    defaultValues: {
      email: '',
      username: '',
      bio: '',
      website: '',
    },
    asyncValidators: {
      email: createEmailUniquenessValidator(checkEmailAvailability),
      username: async (username: string) => {
        // First check format
        const formatResult = usernameSchema.safeParse(username);
        if (!formatResult.success) {
          return {
            isValid: false,
            error: formatResult.error.errors[0]?.message || 'Invalid username',
            timestamp: Date.now(),
          };
        }

        // Then check availability
        const isAvailable = await checkUsernameAvailability(username);
        return {
          isValid: isAvailable,
          error: isAvailable ? undefined : 'Username is already taken',
          timestamp: Date.now(),
        };
      },
    },
    asyncValidationOptions: {
      debounceMs: 500,
      cacheTTL: 60000,
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    console.log('Profile updated:', data);
    // In real app, send to API
  };

  return (
    <form onSubmit={form.handleSubmitWithLoading(onSubmit)} className="space-y-6">
      <h2 className="text-xl font-semibold">Update Profile</h2>

      <FormInput
        label="Email"
        type="email"
        {...form.register('email')}
        error={form.formState.errors.email?.message}
        onChange={(e) => {
          form.register('email').onChange(e);
          form.validateFieldAsync('email', e.target.value);
        }}
        loading={form.asyncFieldValidators.get('email')?.isValidating}
        helperText="This will be your login email"
      />

      <FormInput
        label="Username"
        {...form.register('username')}
        error={form.formState.errors.username?.message}
        onChange={(e) => {
          form.register('username').onChange(e);
          form.validateFieldAsync('username', e.target.value);
        }}
        loading={form.asyncFieldValidators.get('username')?.isValidating}
        helperText="Your unique username for the platform"
      />

      <FormTextarea
        label="Bio"
        {...form.register('bio')}
        error={form.formState.errors.bio?.message}
        rows={4}
        placeholder="Tell us about yourself..."
      />

      <FormInput
        label="Website"
        type="url"
        {...form.register('website')}
        error={form.formState.errors.website?.message}
        placeholder="https://example.com"
      />

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={form.isSubmitting || form.isAsyncValidating || form.hasErrors}
        >
          {form.isSubmitting ? 'Updating...' : 'Update Profile'}
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => form.resetForm()}
        >
          Reset
        </Button>
      </div>

      {form.isAsyncValidating && (
        <p className="text-sm text-gray-600">Validating fields...</p>
      )}
    </form>
  );
}

/**
 * Main integration examples
 */
export function AsyncValidationIntegration() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-12">
      <div>
        <h1 className="text-2xl font-bold mb-6">Async Validation Integration</h1>
        <p className="text-gray-600">
          Examples showing how to integrate async validation with existing form components.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <AsyncRecipeForm />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <AsyncProfileForm />
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Integration Features:</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>✓ Seamless integration with FormInput, FormSelect, and FormTextarea</li>
          <li>✓ Loading states shown in input fields</li>
          <li>✓ Debounced validation on change, immediate on blur</li>
          <li>✓ Cache indicators and success messages</li>
          <li>✓ Form submission blocked until async validation passes</li>
          <li>✓ Works with useZodForm hook and asyncValidators option</li>
        </ul>
      </div>
    </div>
  );
}