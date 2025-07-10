import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { RecipeForm } from '@/components/recipes/RecipeForm'
import { Container } from '@/components/layout/Container'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useToast } from '@/hooks/useToast'
import type { Recipe } from '@/types/recipe'
import type { z } from 'zod'

// Import the recipe schema type from RecipeForm
type RecipeFormData = {
  name: string
  description?: string
  instructions: Array<{ step: number; text: string }>
  ingredients: Array<{ name: string; quantity: number; unit: string; notes?: string }>
  prepTime?: number
  cookTime?: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  categories?: string[]
  tags?: string[]
  isPublic: boolean
  images?: File[]
}

const RecipeCreatePage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { createRecipe, loading } = useRecipeStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: RecipeFormData) => {
    setIsSubmitting(true)
    try {
      // Prepare recipe data
      const recipeData = {
        ...data,
        // Ensure categories and tags are arrays
        categories: data.categories || [],
        tags: data.tags || [],
        // Add timestamps (these might be handled by the backend)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Create the recipe (the store will handle FormData if images are present)
      const newRecipe = await createRecipe(recipeData)

      // Show success toast
      toast({
        title: t('recipes.createSuccess', 'Recipe created successfully'),
        description: t('recipes.createSuccessDescription', 'Your recipe has been created and saved.'),
        variant: 'success',
        duration: 3000,
      })

      // Navigate to the new recipe detail page
      navigate(`/recipes/${newRecipe.id}`)
    } catch (error) {
      // Error handling is done in the store and RecipeForm
      console.error('Failed to create recipe:', error)
      
      // Show error toast
      toast({
        title: t('recipes.createError', 'Failed to create recipe'),
        description: error instanceof Error ? error.message : t('errors.generic', 'An error occurred while creating the recipe'),
        variant: 'error',
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/recipes')
  }

  return (
    <Container>
      {/* Breadcrumbs */}
      <div className="mb-6">
        <Breadcrumbs />
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 sm:gap-4 mb-4">
          <TouchableArea
            onClick={() => navigate('/recipes')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('common.back', 'Go back')}
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </TouchableArea>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {t('recipes.createRecipe', 'Create New Recipe')}
          </h1>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 ml-0 sm:ml-11">
          {t('recipes.createRecipeDescription', 'Fill in the details below to create a new recipe. You can save it as a draft or publish it for others to see.')}
        </p>
      </div>

      {/* Recipe Form */}
      <div className="max-w-4xl">
        <RecipeForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>

      {/* Loading Overlay */}
      {(loading || isSubmitting) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-sm w-full">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 flex-shrink-0" />
              <p className="text-gray-700 dark:text-gray-300">
                {t('recipes.creating', 'Creating recipe...')}
              </p>
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

export default RecipeCreatePage