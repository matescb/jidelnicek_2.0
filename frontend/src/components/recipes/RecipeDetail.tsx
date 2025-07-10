import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { 
  Clock, Users, Flame, Star, Heart, Edit, Trash2, Copy, 
  Share2, Printer, ChefHat, Calendar, ShoppingCart 
} from 'lucide-react'
import { Recipe } from '@/types/recipe'
import { useAuthStore } from '@/store/slices/authStore'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useI18nFormats } from '@/hooks/useI18nFormats'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { useToast } from '@/hooks/useToast'
import { ResponsiveWrapper } from '@/components/layout/ResponsiveWrapper'

interface RecipeDetailProps {
  recipe: Recipe
  onEdit?: () => void
  onDelete?: () => void
}

export function RecipeDetail({ recipe, onEdit, onDelete }: RecipeDetailProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { formatNumber, formatDate } = useI18nFormats()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const { toggleFavorite, favorites, duplicateRecipe, rateRecipe } = useRecipeStore()
  const [userRating, setUserRating] = useState(0)
  const [scaledServings, setScaledServings] = useState(recipe.servings)
  
  const isFavorite = favorites.includes(recipe.id)
  const isOwner = user?.id === recipe.userId
  const scaleFactor = scaledServings / recipe.servings
  
  const handleFavoriteClick = async () => {
    if (!user) {
      toast({
        title: t('auth.loginRequired'),
        description: t('auth.loginToFavorite'),
        variant: 'error'
      })
      return
    }
    await toggleFavorite(recipe.id)
  }
  
  const handleRating = async (rating: number) => {
    if (!user) {
      toast({
        title: t('auth.loginRequired'),
        description: t('auth.loginToRate'),
        variant: 'error'
      })
      return
    }
    
    setUserRating(rating)
    await rateRecipe(recipe.id, rating)
    toast({
      title: t('common.success'),
      description: t('recipes.ratingSubmitted'),
      variant: 'success'
    })
  }
  
  const handleDuplicate = async () => {
    try {
      const newRecipe = await duplicateRecipe(recipe.id)
      toast({
        title: t('common.success'),
        description: t('recipes.duplicated'),
        variant: 'success'
      })
      navigate(`/recipes/${newRecipe.id}/edit`)
    } catch (error) {
      toast({
        title: t('errors.generic'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error'
      })
    }
  }
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.name,
          text: recipe.description,
          url: window.location.href
        })
      } catch (error) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href)
      toast({
        title: t('common.success'),
        description: t('recipes.linkCopied'),
        variant: 'success'
      })
    }
  }
  
  const handlePrint = () => {
    window.print()
  }
  
  const handleAddToTrip = () => {
    // TODO: Implement add to trip functionality
    navigate('/dashboard/trips/new', { state: { recipeId: recipe.id } })
  }
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 dark:text-green-400'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'hard':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }
  
  return (
    <ResponsiveWrapper>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {/* Image Gallery */}
          {recipe.images && recipe.images.length > 0 && (
            <div className="relative h-64 md:h-96">
              <img
                src={recipe.images[0].url}
                alt={recipe.name}
                className="w-full h-full object-cover"
              />
              {recipe.images.length > 1 && (
                <div className="absolute bottom-4 left-4 flex gap-2">
                  {recipe.images.slice(1, 4).map((image, index) => (
                    <img
                      key={image.id}
                      src={image.url}
                      alt={`${recipe.name} ${index + 2}`}
                      className="w-16 h-16 object-cover rounded-lg border-2 border-white shadow-md cursor-pointer hover:scale-105 transition-transform"
                    />
                  ))}
                  {recipe.images.length > 4 && (
                    <div className="w-16 h-16 bg-black/50 rounded-lg border-2 border-white shadow-md flex items-center justify-center text-white font-semibold">
                      +{recipe.images.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="p-6">
            {/* Title and Actions */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {recipe.name}
                </h1>
                {recipe.description && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {recipe.description}
                  </p>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <TouchableArea
                  onClick={handleFavoriteClick}
                  className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  aria-label={isFavorite ? t('recipes.unfavorite') : t('recipes.favorite')}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      isFavorite
                        ? 'fill-red-500 text-red-500'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  />
                </TouchableArea>
                
                <TouchableArea
                  onClick={handleShare}
                  className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  aria-label={t('recipes.share')}
                >
                  <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </TouchableArea>
                
                <TouchableArea
                  onClick={handlePrint}
                  className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 print:hidden"
                  aria-label={t('recipes.print')}
                >
                  <Printer className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </TouchableArea>
                
                {user && (
                  <>
                    <TouchableArea
                      onClick={handleDuplicate}
                      className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                      aria-label={t('recipes.duplicate')}
                    >
                      <Copy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </TouchableArea>
                    
                    <TouchableArea
                      onClick={handleAddToTrip}
                      className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                      aria-label={t('recipes.addToTrip')}
                    >
                      <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </TouchableArea>
                  </>
                )}
                
                {isOwner && (
                  <>
                    <TouchableArea
                      onClick={onEdit}
                      className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30"
                      aria-label={t('common.edit')}
                    >
                      <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </TouchableArea>
                    
                    <TouchableArea
                      onClick={onDelete}
                      className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </TouchableArea>
                  </>
                )}
              </div>
            </div>
            
            {/* Metadata */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm">
              {recipe.prepTime && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    {t('recipes.prepTime')}: {recipe.prepTime} {t('common.minutes')}
                  </span>
                </div>
              )}
              
              {recipe.cookTime && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Flame className="w-4 h-4" />
                  <span>
                    {t('recipes.cookTime')}: {recipe.cookTime} {t('common.minutes')}
                  </span>
                </div>
              )}
              
              {recipe.difficulty && (
                <div className={`flex items-center gap-2 ${getDifficultyColor(recipe.difficulty)}`}>
                  <ChefHat className="w-4 h-4" />
                  <span>{t(`recipes.difficultyLevels.${recipe.difficulty}`)}</span>
                </div>
              )}
            </div>
            
            {/* Rating */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableArea
                    key={star}
                    onClick={() => handleRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-6 h-6 cursor-pointer ${
                        star <= (userRating || Math.round(recipe.ratingAverage))
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400'
                      }`}
                    />
                  </TouchableArea>
                ))}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatNumber(recipe.ratingAverage, 'number')} ({recipe.ratingCount} {t('recipes.ratings')})
              </span>
            </div>
            
            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Servings Scaler */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('recipes.servings')}
            </h2>
            <div className="flex items-center gap-4">
              <TouchableArea
                onClick={() => setScaledServings(Math.max(1, scaledServings - 1))}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                -
              </TouchableArea>
              <span className="text-xl font-semibold text-gray-900 dark:text-gray-100 w-12 text-center">
                {scaledServings}
              </span>
              <TouchableArea
                onClick={() => setScaledServings(Math.min(100, scaledServings + 1))}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                +
              </TouchableArea>
            </div>
          </div>
          {scaleFactor !== 1 && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('recipes.scaledFrom', { original: recipe.servings })}
            </p>
          )}
        </div>
        
        {/* Ingredients */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('recipes.ingredients')}
            </h2>
            <TouchableArea
              onClick={() => navigate(`/shopping-list?recipeId=${recipe.id}&servings=${scaledServings}`)}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ShoppingCart className="w-4 h-4" />
              {t('recipes.addToShoppingList')}
            </TouchableArea>
          </div>
          
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index} className="flex items-start">
                <span className="text-gray-600 dark:text-gray-400 mr-2">•</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatNumber(ingredient.quantity * scaleFactor, 'number')} {ingredient.unit} {ingredient.name}
                  {ingredient.notes && (
                    <span className="text-gray-600 dark:text-gray-400 text-sm ml-2">
                      ({ingredient.notes})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Instructions */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('recipes.instructions')}
          </h2>
          
          <ol className="space-y-4">
            {recipe.instructions.map((instruction, index) => (
              <li key={index} className="flex">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-semibold text-sm mr-3">
                  {index + 1}
                </span>
                <p className="text-gray-900 dark:text-gray-100 pt-1">
                  {instruction.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
        
        {/* Nutrition */}
        {recipe.nutrition && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('nutrition.title')} ({t('nutrition.perServing')})
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Math.round(recipe.nutrition.calories)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('nutrition.calories')}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(recipe.nutrition.protein, 'number')}g
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('nutrition.protein')}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(recipe.nutrition.carbs, 'number')}g
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('nutrition.carbs')}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(recipe.nutrition.fat, 'number')}g
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('nutrition.fat')}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(recipe.nutrition.fiber, 'number')}g
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('nutrition.fiber')}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(recipe.nutrition.sodium, 'number')}mg
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('nutrition.sodium')}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            {t('recipes.createdBy')} {recipe.author?.name || t('common.anonymous')}
          </p>
          <p>
            {formatDate(recipe.createdAt, 'date')}
          </p>
        </div>
      </div>
    </ResponsiveWrapper>
  )
}