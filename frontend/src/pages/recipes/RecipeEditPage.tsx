import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { RecipeForm } from '@/components/recipes/RecipeForm'
import { Container } from '@/components/layout/Container'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useToast } from '@/hooks/useToast'
import type { Recipe } from '@/types/recipe'

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
  removedImageIds?: string[]
}

const RecipeEditPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const { fetchRecipe, updateRecipe, currentRecipe, loading } = useRecipeStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch recipe data on mount
  useEffect(() => {
    if (id) {
      fetchRecipe(id)
    }
  }, [id, fetchRecipe])

  const handleSubmit = async (data: RecipeFormData) => {
    if (!id || !currentRecipe) return

    setIsSubmitting(true)
    try {
      // Prepare update data
      const updateData = {
        ...data,
        // Ensure categories and tags are arrays
        categories: data.categories || [],
        tags: data.tags || [],
        // Add updated timestamp
        updatedAt: new Date().toISOString(),
      }

      // Update the recipe (the store will handle FormData if images are present)
      await updateRecipe(id, updateData)

      // Show success toast
      toast({
        title: t('recipes.updateSuccess', 'Recipe updated successfully'),
        description: t('recipes.updateSuccessDescription', 'Your recipe has been updated and saved.'),
        variant: 'success',
        duration: 3000,
      })

      // Navigate to the recipe detail page
      navigate(`/recipes/${id}`)
    } catch (error) {
      // Error handling is done in the store and RecipeForm
      console.error('Failed to update recipe:', error)
      
      // Show error toast
      toast({
        title: t('recipes.updateError', 'Failed to update recipe'),
        description: error instanceof Error ? error.message : t('errors.generic', 'An error occurred while updating the recipe'),
        variant: 'error',
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate(`/dashboard/recipes/${id}`)
  }

  // Show loading state while fetching recipe
  if (loading && !currentRecipe) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400" />
        </div>
      </Container>
    )
  }

  // Show error if recipe not found
  if (!loading && !currentRecipe) {
    return (
      <Container>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('recipes.notFound', 'Recipe not found')}
          </h2>
          <TouchableArea
            onClick={() => navigate('/dashboard/recipes')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            {t('recipes.backToRecipes', 'Back to recipes')}
          </TouchableArea>
        </div>
      </Container>
    )
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
            onClick={() => navigate(`/recipes/${id}`)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('common.back', 'Go back')}
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </TouchableArea>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {t('recipes.editRecipe', 'Edit Recipe')}
          </h1>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 ml-0 sm:ml-11">
          {t('recipes.editRecipeDescription', 'Update the recipe details below. Changes will be saved immediately.')}
        </p>
      </div>

      {/* Recipe Form */}
      <div className="max-w-4xl">
        {currentRecipe && (
          <RecipeForm
            recipe={currentRecipe}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}
      </div>

      {/* Loading Overlay */}
      {(loading || isSubmitting) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-sm w-full">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 flex-shrink-0" />
              <p className="text-gray-700 dark:text-gray-300">
                {t('recipes.updating', 'Updating recipe...')}
              </p>
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

export default RecipeEditPage