/**
 * Examples of using validation schemas with React Hook Form and Zod
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  userRegisterSchema,
  recipeCreateSchema,
  tripCreateSchema,
  emailSchema,
  type UserRegister,
  type RecipeCreate,
  type TripCreate,
} from './index';

// Example 1: Registration form with validation
export function useRegistrationForm() {
  const form = useForm<UserRegister>({
    resolver: zodResolver(userRegisterSchema),
    defaultValues: {
      language: 'cs',
      unit_system: 'metric',
      energy_unit: 'kcal',
      has_pku: false,
      timezone: 'Europe/Prague',
    },
  });

  return form;
}

// Example 2: Recipe creation form
export function useRecipeForm() {
  const form = useForm<RecipeCreate>({
    resolver: zodResolver(recipeCreateSchema),
    defaultValues: {
      servings: 4,
      is_public: false,
      ingredients: [],
      images: [],
      water_ml: 0,
    },
  });

  return form;
}

// Example 3: Trip creation form
export function useTripForm() {
  const form = useForm<TripCreate>({
    resolver: zodResolver(tripCreateSchema),
    defaultValues: {
      status: 'planned',
      meal_slots: ['Breakfast', 'Lunch', 'Dinner'],
      recipe_storage_mode: 'snapshot',
      participants: [],
    },
  });

  return form;
}

// Example 4: Manual validation
export function validateRecipeData(data: unknown) {
  try {
    const validatedData = recipeCreateSchema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

// Example 5: Partial validation for form fields
export function validateEmail(email: string) {
  const result = emailSchema.safeParse(email);
  return {
    isValid: result.success,
    error: result.success ? null : result.error.errors[0]?.message,
  };
}

// Example 6: Custom error handling
export function getFieldError(errors: any, fieldName: string): string | undefined {
  const error = errors[fieldName];
  if (!error) return undefined;
  
  // Handle nested errors
  if (error.message) return error.message;
  if (error.type === 'required') return 'This field is required';
  if (error.type === 'min') return `Value is too small`;
  if (error.type === 'max') return `Value is too large`;
  
  return 'Invalid value';
}

// Example 7: Form with nested data
export function useRecipeFormWithIngredients() {
  const form = useForm<RecipeCreate>({
    resolver: zodResolver(recipeCreateSchema),
    defaultValues: {
      name: '',
      servings: 4,
      ingredients: [
        {
          ingredient_id: '',
          quantity: '100',
          unit: 'g',
          is_optional: false,
          display_order: 0,
        },
      ],
    },
  });

  // Add ingredient
  const addIngredient = () => {
    const currentIngredients = form.getValues('ingredients');
    form.setValue('ingredients', [
      ...currentIngredients,
      {
        ingredient_id: '',
        quantity: '0',
        unit: 'g',
        is_optional: false,
        display_order: currentIngredients.length,
      },
    ]);
  };

  // Remove ingredient
  const removeIngredient = (index: number) => {
    const currentIngredients = form.getValues('ingredients');
    form.setValue(
      'ingredients',
      currentIngredients.filter((_, i) => i !== index)
    );
  };

  return {
    ...form,
    addIngredient,
    removeIngredient,
  };
}

// Example 8: Async validation with API
export async function validateUniqueEmail(email: string, apiClient: any) {
  // First validate format
  const formatResult = emailSchema.safeParse(email);
  if (!formatResult.success) {
    return { isValid: false, error: 'Invalid email format' };
  }

  // Then check uniqueness via API
  try {
    const response = await apiClient.post('/api/auth/check-email', { email });
    if (response.data.exists) {
      return { isValid: false, error: 'Email already registered' };
    }
    return { isValid: true, error: null };
  } catch (error) {
    return { isValid: false, error: 'Unable to validate email' };
  }
}

// Example 9: Transform and validate data before submission
export function prepareRecipeForSubmission(formData: RecipeCreate) {
  // Remove empty optional fields
  const cleanedData = {
    ...formData,
    description: formData.description || undefined,
    instructions: formData.instructions || undefined,
    difficulty_level: formData.difficulty_level || undefined,
    prep_time_minutes: formData.prep_time_minutes || undefined,
    cook_time_minutes: formData.cook_time_minutes || undefined,
  };

  // Filter out empty ingredients
  cleanedData.ingredients = cleanedData.ingredients.filter(
    (ing) => ing.ingredient_id && parseFloat(ing.quantity) > 0
  );

  // Re-validate cleaned data
  return recipeCreateSchema.parse(cleanedData);
}

// Example 10: Type-safe form field paths
export function getRecipeFieldPath<K extends keyof RecipeCreate>(
  field: K,
  index?: number
): string {
  if (field === 'ingredients' && typeof index === 'number') {
    return `ingredients.${index}`;
  }
  if (field === 'images' && typeof index === 'number') {
    return `images.${index}`;
  }
  return field;
}