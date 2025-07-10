import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, GripVertical, Upload, X } from 'lucide-react'
import { Recipe, RecipeIngredient } from '@/types/recipe'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useToast } from '@/hooks/useToast'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

// Form validation schema
const recipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(100),
  description: z.string().max(500).optional(),
  instructions: z.array(z.object({
    step: z.number(),
    text: z.string().min(1, 'Instruction is required').max(500)
  })).min(1, 'At least one instruction is required'),
  ingredients: z.array(z.object({
    name: z.string().min(1, 'Ingredient name is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unit: z.string().min(1, 'Unit is required'),
    notes: z.string().optional()
  })).min(1, 'At least one ingredient is required'),
  prepTime: z.number().min(0).optional(),
  cookTime: z.number().min(0).optional(),
  servings: z.number().min(1).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean()
})

type RecipeFormData = z.infer<typeof recipeSchema>

interface RecipeFormProps {
  recipe?: Recipe
  onSubmit: (data: RecipeFormData) => Promise<void>
  onCancel: () => void
}

export function RecipeForm({ recipe, onSubmit, onCancel }: RecipeFormProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [images, setImages] = useState<File[]>([])
  const [imagePreview, setImagePreview] = useState<string[]>(
    recipe?.images?.map(img => img.url) || []
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: recipe?.name || '',
      description: recipe?.description || '',
      instructions: recipe?.instructions || [{ step: 1, text: '' }],
      ingredients: recipe?.ingredients || [{ name: '', quantity: 1, unit: 'g', notes: '' }],
      prepTime: recipe?.prepTime || 0,
      cookTime: recipe?.cookTime || 0,
      servings: recipe?.servings || 4,
      difficulty: recipe?.difficulty || 'medium',
      categories: recipe?.categories || [],
      tags: recipe?.tags || [],
      isPublic: recipe?.isPublic || false
    }
  })
  
  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction, move: moveInstruction } = useFieldArray({
    control,
    name: 'instructions'
  })
  
  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } = useFieldArray({
    control,
    name: 'ingredients'
  })
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const isValid = file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024
      if (!isValid) {
        toast({
          title: t('errors.validation'),
          description: t('recipes.imageRequirements'),
          variant: 'error'
        })
      }
      return isValid
    })
    
    if (images.length + validFiles.length > 10) {
      toast({
        title: t('errors.validation'),
        description: t('recipes.maxImages'),
        variant: 'error'
      })
      return
    }
    
    setImages([...images, ...validFiles])
    
    // Create preview URLs
    const newPreviews = validFiles.map(file => URL.createObjectURL(file))
    setImagePreview([...imagePreview, ...newPreviews])
  }
  
  const removeImage = (index: number) => {
    const newImages = [...images]
    const newPreviews = [...imagePreview]
    
    // Revoke the object URL to free memory
    if (newPreviews[index].startsWith('blob:')) {
      URL.revokeObjectURL(newPreviews[index])
    }
    
    newImages.splice(index, 1)
    newPreviews.splice(index, 1)
    
    setImages(newImages)
    setImagePreview(newPreviews)
  }
  
  const handleDragEnd = (result: any) => {
    if (!result.destination) return
    
    moveInstruction(result.source.index, result.destination.index)
  }
  
  const onFormSubmit = async (data: RecipeFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      // TODO: Handle image upload
    } catch (error) {
      toast({
        title: t('errors.generic'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('recipes.name')} *
            </label>
            <input
              {...register('name')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.name.message}
              </p>
            )}
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('recipes.description')}
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.description.message}
              </p>
            )}
          </div>
          
          {/* Time and Servings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('recipes.prepTime')} ({t('common.minutes')})
              </label>
              <input
                type="number"
                {...register('prepTime', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('recipes.cookTime')} ({t('common.minutes')})
              </label>
              <input
                type="number"
                {...register('cookTime', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('recipes.servings')} *
              </label>
              <input
                type="number"
                {...register('servings', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.servings && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.servings.message}
                </p>
              )}
            </div>
          </div>
          
          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('recipes.difficulty')} *
            </label>
            <select
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
              type="checkbox"
              {...register('isPublic')}
              className="mr-2 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
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
                <input
                  {...register(`ingredients.${index}.name`)}
                  placeholder={t('recipes.ingredientName')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="w-24">
                <input
                  type="number"
                  step="0.1"
                  {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })}
                  placeholder={t('recipes.quantity')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="w-24">
                <select
                  {...register(`ingredients.${index}.unit`)}
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
                onClick={() => removeIngredient(index)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
              </TouchableArea>
            </div>
          ))}
        </div>
        
        {errors.ingredients && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {errors.ingredients.message}
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
                          <textarea
                            {...register(`instructions.${index}.text`)}
                            placeholder={`${t('common.step')} ${index + 1}`}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <TouchableArea
                          onClick={() => removeInstruction(index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
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
            {errors.instructions.message}
          </p>
        )}
      </div>
      
      {/* Images */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('recipes.images')}
        </h3>
        
        <div className="space-y-4">
          {/* Image Upload */}
          <div>
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {t('recipes.uploadImages')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('recipes.imageRequirements')}
                </p>
              </div>
              <input
                id="image-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>
          
          {/* Image Previews */}
          {imagePreview.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {imagePreview.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Recipe image ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <TouchableArea
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </TouchableArea>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <TouchableArea
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