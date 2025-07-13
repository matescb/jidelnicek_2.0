import React, { useState, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray, Controller, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, GripVertical, X } from 'lucide-react'
import { Recipe, RecipeIngredient } from '@/types/recipe'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useToast } from '@/hooks/useToast'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { FileField } from '@/components/forms/FileField'
import { OptimizationPresets, withMemo } from '@/components/performance'
import { useMemoizedCallback } from '@/hooks/useOptimization'

// Form validation schema
const recipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(100),
  description: z.string().max(500).optional(),
  instructions: z.array(z.object({
    step: z.number(),
    text: z.string().min(1, 'Instruction is required').max(500)
  })).min(1, 'At least one instruction is required').refine(
    (instructions) => instructions.some(instruction => instruction.text.trim().length > 0),
    'At least one instruction is required'
  ),
  ingredients: z.array(z.object({
    name: z.string().min(1, 'Ingredient name is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unit: z.string().min(1, 'Unit is required'),
    notes: z.string().optional()
  })).min(1, 'At least one ingredient is required').refine(
    (ingredients) => ingredients.some(ingredient => ingredient.name.trim().length > 0),
    'At least one ingredient is required'
  ),
  prepTime: z.number().min(0).optional(),
  cookTime: z.number().min(0).optional(),
  servings: z.number().min(1).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean(),
  images: z.array(z.instanceof(File)).optional()
})

type RecipeFormData = z.infer<typeof recipeSchema>

interface RecipeFormProps {
  recipe?: Recipe
  onSubmit: (data: RecipeFormData) => Promise<void>
  onCancel: () => void
}

const RecipeFormComponent = ({ recipe, onSubmit, onCancel }: RecipeFormProps) => {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingImages, setExistingImages] = useState(recipe?.images || [])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  
  const methods = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: recipe?.name || '',
      description: recipe?.description || '',
      instructions: recipe?.instructions || [{ step: 1, text: '' }],
      ingredients: recipe?.ingredients || [{ name: '', quantity: 200, unit: 'g', notes: '' }],
      prepTime: recipe?.prepTime || 15,
      cookTime: recipe?.cookTime || 30,
      servings: recipe?.servings || 4,
      difficulty: recipe?.difficulty || 'medium',
      categories: recipe?.categories || [],
      tags: recipe?.tags || [],
      isPublic: recipe?.isPublic || false,
      images: []
    }
  })
  
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = methods
  
  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction, move: moveInstruction } = useFieldArray({
    control,
    name: 'instructions'
  })
  
  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } = useFieldArray({
    control,
    name: 'ingredients'
  })
  
  const removeExistingImage = useMemoizedCallback((imageId: string) => {
    setExistingImages(existingImages.filter(img => img.id !== imageId))
    setRemovedImageIds([...removedImageIds, imageId])
  }, [existingImages, removedImageIds], 'removeExistingImage')
  
  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return
    
    moveInstruction(result.source.index, result.destination.index)
  }, [moveInstruction])
  
  const onFormSubmit = useMemoizedCallback(async (data: RecipeFormData) => {
    setIsSubmitting(true)
    try {
      // Include removed image IDs if we're editing and have removed images
      const submitData = {
        ...data,
        ...(recipe && removedImageIds.length > 0 ? { removedImageIds } : {})
      }
      await onSubmit(submitData as RecipeFormData)
    } catch (error) {
      toast({
        title: t('errors.generic'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [recipe, removedImageIds, onSubmit, toast, t], 'onFormSubmit')
  
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('recipes.basicInfo')}
        </h3>
        
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="recipe-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('recipes.name')} *
            </label>
            <input
              id="recipe-name"
              {...register('name')}
              aria-describedby={errors.name ? 'recipe-name-error' : undefined}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.name && (
              <p id="recipe-name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.name.message}
              </p>
            )}
          </div>
          
          {/* Description */}
          <div>
            <label htmlFor="recipe-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('recipes.description')}
            </label>
            <textarea
              id="recipe-description"
              {...register('description')}
              rows={3}
              aria-describedby={errors.description ? 'recipe-description-error' : undefined}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.description && (
              <p id="recipe-description-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.description.message}
              </p>
            )}
          </div>
          
          {/* Time and Servings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="recipe-prep-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('recipes.prepTime')} ({t('common.minutes')})
              </label>
              <input
                id="recipe-prep-time"
                type="number"
                min="0"
                tabIndex={0}
                {...register('prepTime', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label htmlFor="recipe-cook-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('recipes.cookTime')} ({t('common.minutes')})
              </label>
              <input
                id="recipe-cook-time"
                type="number"
                min="0"
                tabIndex={0}
                {...register('cookTime', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label htmlFor="recipe-servings" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('recipes.servings')} *
              </label>
              <input
                id="recipe-servings"
                type="number"
                min="1"
                max="100"
                tabIndex={0}
                {...register('servings', { valueAsNumber: true })}
                aria-describedby={errors.servings ? 'recipe-servings-error' : undefined}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.servings && (
                <p id="recipe-servings-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.servings.message}
                </p>
              )}
            </div>
          </div>
          
          {/* Difficulty */}
          <div>
            <label htmlFor="recipe-difficulty" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('recipes.difficulty')} *
            </label>
            <select
              id="recipe-difficulty"
              {...register('difficulty')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="easy">{t('recipes.difficultyLevels.easy')}</option>
              <option value="medium">{t('recipes.difficultyLevels.medium')}</option>
              <option value="hard">{t('recipes.difficultyLevels.hard')}</option>
            </select>
          </div>
          
          {/* Public Toggle */}
          <div className="flex items-center">
            <input
              id="recipe-is-public"
              type="checkbox"
              {...register('isPublic')}
              className="mr-2 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="recipe-is-public" className="text-sm text-gray-700 dark:text-gray-300">
              {t('recipes.isPublic')}
            </label>
          </div>
        </div>
      </div>
      
      {/* Ingredients */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('recipes.ingredients')} *
          </h3>
          <TouchableArea
            type="button"
            onClick={() => appendIngredient({ name: '', quantity: 1, unit: 'g', notes: '' })}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            {t('recipes.addIngredient')}
          </TouchableArea>
        </div>
        
        <div className="space-y-3">
          {ingredientFields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <div className="flex-1">
                <label htmlFor={`ingredient-name-${index}`} className="sr-only">
                  {t('recipes.ingredientName')} {index + 1}
                </label>
                <input
                  id={`ingredient-name-${index}`}
                  {...register(`ingredients.${index}.name`)}
                  placeholder={t('recipes.ingredientName')}
                  aria-label={`${t('recipes.ingredientName')} ${index + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="w-24">
                <label htmlFor={`ingredient-quantity-${index}`} className="sr-only">
                  {t('recipes.quantity')} {index + 1}
                </label>
                <input
                  id={`ingredient-quantity-${index}`}
                  type="number"
                  step="0.1"
                  min="0"
                  tabIndex={0}
                  {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })}
                  placeholder={t('recipes.quantity')}
                  aria-label={`${t('recipes.quantity')} ${index + 1}`}
                  aria-describedby={errors.ingredients?.[index]?.quantity ? `ingredient-quantity-error-${index}` : undefined}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.ingredients?.[index]?.quantity && (
                  <p id={`ingredient-quantity-error-${index}`} className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.ingredients[index]?.quantity?.message}
                  </p>
                )}
              </div>
              <div className="w-24">
                <label htmlFor={`ingredient-unit-${index}`} className="sr-only">
                  {t('recipes.unit')} {index + 1}
                </label>
                <select
                  id={`ingredient-unit-${index}`}
                  {...register(`ingredients.${index}.unit`)}
                  aria-label={`${t('recipes.unit')} ${index + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="g">{t('recipes.units.g')}</option>
                  <option value="kg">{t('recipes.units.kg')}</option>
                  <option value="ml">{t('recipes.units.ml')}</option>
                  <option value="l">{t('recipes.units.l')}</option>
                  <option value="cup">{t('recipes.units.cup')}</option>
                  <option value="tbsp">{t('recipes.units.tbsp')}</option>
                  <option value="tsp">{t('recipes.units.tsp')}</option>
                  <option value="piece">{t('recipes.units.piece')}</option>
                </select>
              </div>
              <TouchableArea
                type="button"
                onClick={() => removeIngredient(index)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                aria-label={`${t('common.remove')} ${t('recipes.ingredient')} ${index + 1}`}
              >
                <Trash2 className="w-5 h-5" />
              </TouchableArea>
            </div>
          ))}
        </div>
        
        {errors.ingredients && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {errors.ingredients.message || errors.ingredients.root?.message}
          </p>
        )}
      </div>
      
      {/* Instructions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('recipes.instructions')} *
          </h3>
          <TouchableArea
            type="button"
            onClick={() => appendInstruction({ step: instructionFields.length + 1, text: '' })}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            {t('recipes.addInstruction')}
          </TouchableArea>
        </div>
        
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="instructions">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-3"
              >
                {instructionFields.map((field, index) => (
                  <Draggable key={field.id} draggableId={field.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex gap-2 ${
                          snapshot.isDragging ? 'opacity-50' : ''
                        }`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="flex items-center px-2 cursor-move"
                        >
                          <GripVertical className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <label htmlFor={`instruction-${index}`} className="sr-only">
                            {t('common.step')} {index + 1}
                          </label>
                          <textarea
                            id={`instruction-${index}`}
                            {...register(`instructions.${index}.text`)}
                            placeholder={`${t('common.step')} ${index + 1}`}
                            rows={2}
                            aria-label={`${t('common.step')} ${index + 1}`}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <TouchableArea
                          type="button"
                          onClick={() => removeInstruction(index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          aria-label={`${t('common.remove')} ${t('common.step')} ${index + 1}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </TouchableArea>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        
        {errors.instructions && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {errors.instructions.message || errors.instructions.root?.message}
          </p>
        )}
      </div>
      
      {/* Images */}
      <FormProvider {...methods}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('recipes.images')}
          </h3>
          
          <div className="space-y-4">
            {/* Show existing images if in edit mode */}
            {existingImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('recipes.existingImages')}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {existingImages.map((image) => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.url}
                        alt={image.alt || 'Recipe image'}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <TouchableArea
                        type="button"
                        onClick={() => removeExistingImage(image.id)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`${t('common.remove')} ${image.alt || 'image'}`}
                      >
                        <X className="w-4 h-4" />
                      </TouchableArea>
                      {image.isPrimary && (
                        <span className="absolute bottom-1 left-1 px-2 py-1 text-xs bg-blue-600 text-white rounded">
                          {t('recipes.primaryImage')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* New image upload */}
            <FileField
              name="images"
              label={existingImages.length > 0 ? t('recipes.addMoreImages') : t('recipes.uploadImages')}
              helperText={t('recipes.imageRequirements')}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple={true}
              maxSize={5 * 1024 * 1024} // 5MB
              maxFiles={10 - existingImages.length}
              showPreview={true}
              dragAndDrop={true}
              rules={{
                validate: {
                  maxFiles: (files: File[]) => {
                    if (!files) return true;
                    const totalImages = existingImages.length + files.length;
                    return totalImages <= 10 || t('recipes.maxImagesError');
                  },
                  fileType: (files: File[]) => {
                    if (!files) return true;
                    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));
                    return invalidFiles.length === 0 || t('recipes.invalidImageType', 'Please upload only JPEG, PNG, or WebP images');
                  },
                  fileSize: (files: File[]) => {
                    if (!files) return true;
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    const oversizedFiles = files.filter(file => file.size > maxSize);
                    return oversizedFiles.length === 0 || t('recipes.imageTooLarge', 'Images must be less than 5MB');
                  }
                }
              }}
            />
          </div>
        </div>
      </FormProvider>
      
      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <TouchableArea
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {t('common.cancel')}
        </TouchableArea>
        <TouchableArea
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('common.saving') : (recipe ? t('common.update') : t('common.create'))}
        </TouchableArea>
      </div>
    </form>
  )
}

// Export memoized component - only re-render when recipe changes
export const RecipeForm = memo(RecipeFormComponent, (prevProps, nextProps) => {
  return (
    prevProps.recipe?.id === nextProps.recipe?.id &&
    prevProps.onSubmit === nextProps.onSubmit &&
    prevProps.onCancel === nextProps.onCancel
  )
})