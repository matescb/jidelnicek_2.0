/**
 * Recipe validation schemas
 */
import { z } from 'zod';
import {
  uuidSchema,
  dateSchema,
  decimalSchema,
  positiveDecimalSchema,
  paginationSchema,
} from './common';

// Recipe unit validation
export const recipeUnitSchema = z.enum(['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece'], {
  errorMap: () => ({ message: 'Invalid unit. Must be one of: g, kg, ml, l, cup, tbsp, tsp, piece' }),
});

// Recipe difficulty validation
export const recipeDifficultySchema = z.enum(['easy', 'medium', 'hard'], {
  errorMap: () => ({ message: 'Difficulty must be easy, medium, or hard' }),
});

// Recipe image schemas
export const recipeImageBaseSchema = z.object({
  image_url: z.string().url('Invalid image URL').max(500, 'Image URL too long'),
  thumbnail_url: z.string().url('Invalid thumbnail URL').max(500, 'Thumbnail URL too long').optional(),
  alt_text: z.string().max(200, 'Alt text too long').optional(),
  display_order: z.number().int().min(0).max(9).default(0),
  is_primary: z.boolean().default(false),
});

export const recipeImageCreateSchema = recipeImageBaseSchema;

export const recipeImageUpdateSchema = z.object({
  image_url: z.string().url().max(500).optional(),
  thumbnail_url: z.string().url().max(500).optional(),
  alt_text: z.string().max(200).optional(),
  display_order: z.number().int().min(0).max(9).optional(),
  is_primary: z.boolean().optional(),
});

export const recipeImageResponseSchema = recipeImageBaseSchema.extend({
  id: uuidSchema,
  recipe_id: uuidSchema,
  file_size_bytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mime_type: z.string().optional(),
  created_at: dateSchema,
  updated_at: dateSchema,
});

// Recipe ingredient schemas
export const recipeIngredientBaseSchema = z.object({
  ingredient_id: uuidSchema,
  quantity: positiveDecimalSchema,
  unit: recipeUnitSchema,
  preparation_notes: z.string().max(200, 'Preparation notes too long').optional(),
  is_optional: z.boolean().default(false),
  display_order: z.number().int().min(0).default(0),
});

export const recipeIngredientCreateSchema = recipeIngredientBaseSchema;

export const recipeIngredientUpdateSchema = z.object({
  ingredient_id: uuidSchema.optional(),
  quantity: positiveDecimalSchema.optional(),
  unit: recipeUnitSchema.optional(),
  preparation_notes: z.string().max(200).optional(),
  is_optional: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
});

export const recipeIngredientResponseSchema = recipeIngredientBaseSchema.extend({
  id: uuidSchema,
  recipe_id: uuidSchema,
  ingredient: z.record(z.any()).optional(), // Ingredient details when loaded
});

// Nutritional info schema
export const nutritionalInfoSchema = z.object({
  calories: decimalSchema.optional(),
  proteins_g: decimalSchema.optional(),
  carbohydrates_g: decimalSchema.optional(),
  fats_g: decimalSchema.optional(),
  fiber_g: decimalSchema.optional(),
  sugar_g: decimalSchema.optional(),
  sodium_mg: decimalSchema.optional(),
  phe_mg: decimalSchema.optional(), // For PKU users
});

// Recipe base schema
export const recipeBaseSchema = z.object({
  name: z
    .string()
    .min(1, 'Recipe name is required')
    .max(100, 'Recipe name too long')
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, 'Recipe name cannot be empty'),
  description: z.string().optional(),
  instructions: z.string().max(2000, 'Instructions too long').optional(),
  difficulty_level: recipeDifficultySchema.optional(),
  prep_time_minutes: z.number().int().min(0).optional(),
  cook_time_minutes: z.number().int().min(0).optional(),
  water_ml: z.number().int().min(0).default(0),
  servings: z.number().int().min(1).default(1),
  is_public: z.boolean().default(false),
});

// Recipe creation schema
export const recipeCreateSchema = recipeBaseSchema.extend({
  ingredients: z
    .array(recipeIngredientCreateSchema)
    .max(50, 'Maximum 50 ingredients allowed per recipe')
    .default([]),
  images: z
    .array(recipeImageCreateSchema)
    .max(10, 'Maximum 10 images allowed per recipe')
    .default([])
    .refine(
      (images) => {
        const primaryCount = images.filter((img) => img.is_primary).length;
        return primaryCount <= 1;
      },
      'Only one primary image allowed per recipe'
    ),
});

// Recipe update schema
export const recipeUpdateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, 'Recipe name cannot be empty')
    .optional(),
  description: z.string().optional(),
  instructions: z.string().max(2000).optional(),
  difficulty_level: recipeDifficultySchema.optional(),
  prep_time_minutes: z.number().int().min(0).optional(),
  cook_time_minutes: z.number().int().min(0).optional(),
  water_ml: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  is_public: z.boolean().optional(),
  ingredients: z
    .array(recipeIngredientUpdateSchema)
    .max(50, 'Maximum 50 ingredients allowed')
    .optional(),
  images: z
    .array(recipeImageUpdateSchema)
    .max(10, 'Maximum 10 images allowed')
    .refine(
      (images) => {
        if (!images) return true;
        const primaryCount = images.filter((img) => img.is_primary).length;
        return primaryCount <= 1;
      },
      'Only one primary image allowed per recipe'
    )
    .optional(),
});

// Recipe search filters
export const recipeSearchFiltersSchema = z.object({
  query: z.string().optional(),
  difficulty_level: recipeDifficultySchema.optional(),
  max_prep_time: z.number().int().min(0).optional(),
  max_cook_time: z.number().int().min(0).optional(),
  max_total_time: z.number().int().min(0).optional(),
  min_servings: z.number().int().min(1).optional(),
  max_servings: z.number().int().min(1).optional(),
  is_public: z.boolean().optional(),
  is_published: z.boolean().optional(),
  category_ids: z.array(uuidSchema).optional(),
  tag_names: z.array(z.string()).optional(),
  author_id: uuidSchema.optional(),
  has_images: z.boolean().optional(),
  min_rating: decimalSchema
    .refine((val) => {
      const num = parseFloat(val);
      return num >= 0 && num <= 5;
    }, 'Rating must be between 0 and 5')
    .optional(),
  created_after: dateSchema.optional(),
  created_before: dateSchema.optional(),
})
  .refine(
    (data) => {
      if (data.min_servings && data.max_servings) {
        return data.min_servings <= data.max_servings;
      }
      return true;
    },
    {
      message: 'min_servings cannot be greater than max_servings',
      path: ['min_servings'],
    }
  )
  .refine(
    (data) => {
      if (data.created_after && data.created_before) {
        return data.created_after <= data.created_before;
      }
      return true;
    },
    {
      message: 'created_after cannot be after created_before',
      path: ['created_after'],
    }
  );

// Recipe action schemas
export const recipeDuplicateRequestSchema = z.object({
  new_name: z.string().min(1).max(100).optional(),
  make_private: z.boolean().default(true),
});

export const recipePublishRequestSchema = z.object({
  make_public: z.boolean().default(true),
});

export const recipeForkRequestSchema = z.object({
  new_name: z.string().min(1).max(100).optional(),
});

// Category and tag schemas
export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  recipe_count: z.number().int().nonnegative().default(0),
});

export const tagSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(30),
  slug: z.string().min(1).max(30),
  category: z.enum(['dietary', 'meal_type', 'cuisine', 'season', 'cooking_method', 'other']),
  recipe_count: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  display_order: z.number().int().min(0).default(0),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1).max(30),
  category: z.enum(['dietary', 'meal_type', 'cuisine', 'season', 'cooking_method', 'other']),
});

// Recipe response schemas
export const recipeListItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().optional(),
  difficulty_level: recipeDifficultySchema.optional(),
  prep_time_minutes: z.number().int().optional(),
  cook_time_minutes: z.number().int().optional(),
  total_time_minutes: z.number().int().optional(),
  servings: z.number().int(),
  rating_average: decimalSchema.optional(),
  rating_count: z.number().int().nonnegative(),
  view_count: z.number().int().nonnegative(),
  is_public: z.boolean(),
  is_published: z.boolean(),
  fork_count: z.number().int().nonnegative(),
  is_forked: z.boolean(),
  created_at: dateSchema,
  updated_at: dateSchema,
  primary_image: recipeImageResponseSchema.optional(),
  ingredient_count: z.number().int().nonnegative().default(0),
  author: z.record(z.any()).optional(),
});

export const recipeResponseSchema = recipeBaseSchema.extend({
  id: uuidSchema,
  user_id: uuidSchema,
  rating_average: decimalSchema.optional(),
  rating_count: z.number().int().nonnegative(),
  view_count: z.number().int().nonnegative(),
  is_published: z.boolean(),
  published_at: dateSchema.optional(),
  fork_count: z.number().int().nonnegative(),
  original_recipe_id: uuidSchema.optional(),
  is_forked: z.boolean(),
  is_archived: z.boolean(),
  created_at: dateSchema,
  updated_at: dateSchema,
  total_time_minutes: z.number().int().optional(),
  can_be_unpublished: z.boolean(),
  ingredients: z.array(recipeIngredientResponseSchema).default([]),
  images: z.array(recipeImageResponseSchema).default([]),
  author: z.record(z.any()).optional(),
  original_recipe: z.record(z.any()).optional(),
});

export const recipeListResponseSchema = z.object({
  items: z.array(recipeListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
});

// Recipe scaling schemas
export const scalingRequestSchema = z.object({
  recipe_id: uuidSchema,
  target_servings: z.number().int().min(1).max(100),
  scale_water: z.boolean().default(true),
});

export const scaledIngredientSchema = z.object({
  ingredient_id: uuidSchema,
  original_quantity: decimalSchema,
  scaled_quantity: decimalSchema,
  unit: recipeUnitSchema,
  scale_factor: decimalSchema,
  preparation_notes: z.string().optional(),
});

export const scalingResponseSchema = z.object({
  original_servings: z.number().int(),
  target_servings: z.number().int(),
  scale_factor: decimalSchema,
  scaled_ingredients: z.array(scaledIngredientSchema),
  scaled_water_ml: z.number().int().optional(),
  warnings: z.array(z.string()).default([]),
});

// Type exports
export type RecipeUnit = z.infer<typeof recipeUnitSchema>;
export type RecipeDifficulty = z.infer<typeof recipeDifficultySchema>;
export type RecipeImageCreate = z.infer<typeof recipeImageCreateSchema>;
export type RecipeImageUpdate = z.infer<typeof recipeImageUpdateSchema>;
export type RecipeImageResponse = z.infer<typeof recipeImageResponseSchema>;
export type RecipeIngredientCreate = z.infer<typeof recipeIngredientCreateSchema>;
export type RecipeIngredientUpdate = z.infer<typeof recipeIngredientUpdateSchema>;
export type RecipeIngredientResponse = z.infer<typeof recipeIngredientResponseSchema>;
export type NutritionalInfo = z.infer<typeof nutritionalInfoSchema>;
export type RecipeCreate = z.infer<typeof recipeCreateSchema>;
export type RecipeUpdate = z.infer<typeof recipeUpdateSchema>;
export type RecipeSearchFilters = z.infer<typeof recipeSearchFiltersSchema>;
export type RecipeDuplicateRequest = z.infer<typeof recipeDuplicateRequestSchema>;
export type RecipePublishRequest = z.infer<typeof recipePublishRequestSchema>;
export type RecipeForkRequest = z.infer<typeof recipeForkRequestSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Tag = z.infer<typeof tagSchema>;
export type CategoryCreate = z.infer<typeof categoryCreateSchema>;
export type TagCreate = z.infer<typeof tagCreateSchema>;
export type RecipeListItem = z.infer<typeof recipeListItemSchema>;
export type RecipeResponse = z.infer<typeof recipeResponseSchema>;
export type RecipeListResponse = z.infer<typeof recipeListResponseSchema>;
export type ScalingRequest = z.infer<typeof scalingRequestSchema>;
export type ScaledIngredient = z.infer<typeof scaledIngredientSchema>;
export type ScalingResponse = z.infer<typeof scalingResponseSchema>;