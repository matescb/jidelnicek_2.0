import React from 'react'
import { Link } from 'react-router-dom'
import { Clock, Users, Flame, Star, Heart, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Recipe } from '@/types/recipe'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useAuthStore } from '@/store/slices/authStore'
import { useI18nFormats } from '@/hooks/useI18nFormats'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { Checkbox } from '@/components/ui/checkbox'

interface RecipeCardProps {
  recipe: Recipe
  onToggleFavorite?: (recipeId: string) => void
  onClick?: () => void
  selected?: boolean
  onSelect?: () => void
  showCheckbox?: boolean
  actions?: React.ReactNode
}

export function RecipeCard({ 
  recipe, 
  onToggleFavorite,
  onClick,
  selected = false,
  onSelect,
  showCheckbox = false,
  actions
}: RecipeCardProps) {
  const { t } = useTranslation()
  const { formatNumber } = useI18nFormats()
  const user = useAuthStore((state) => state.user)
  const toggleFavorite = useRecipeStore((state) => state.toggleFavorite)
  const favorites = useRecipeStore((state) => state.favorites)
  
  const isFavorite = favorites.includes(recipe.id)
  const isOwner = user?.id === recipe.userId
  
  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (onToggleFavorite) {
      onToggleFavorite(recipe.id)
    } else {
      await toggleFavorite(recipe.id)
    }
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
  
  const CardWrapper = onClick ? 'div' : Link;
  const cardProps = onClick 
    ? { onClick, className: "block group cursor-pointer" }
    : { to: `/recipes/${recipe.id}`, className: "block group" };
    
  return (
    <CardWrapper {...cardProps as any}>
      <TouchableArea className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden relative ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        {/* Selection Checkbox */}
        {showCheckbox && (
          <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 shadow-md"
            />
          </div>
        )}
        
        {/* Image Section */}
        <div className="aspect-w-16 aspect-h-9 relative">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <Flame className="w-12 h-12 text-gray-400 dark:text-gray-600" />
            </div>
          )}
          
          {/* Favorite Button */}
          {user && (
            <button
              onClick={handleFavoriteClick}
              className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-800 rounded-full shadow-md hover:shadow-lg transition-shadow"
              aria-label={isFavorite ? t('recipes.unfavorite') : t('recipes.favorite')}
            >
              <Heart
                className={`w-5 h-5 ${
                  isFavorite
                    ? 'fill-red-500 text-red-500'
                    : 'text-gray-400 hover:text-red-500'
                }`}
              />
            </button>
          )}
          
          {/* Owner Badge */}
          {isOwner && (
            <div className={`absolute top-2 ${showCheckbox ? 'left-12' : 'left-2'} px-2 py-1 bg-blue-600 text-white text-xs rounded-md`}>
              {t('recipes.myRecipe')}
            </div>
          )}
          
          {/* Actions Menu */}
          {actions && (
            <div className="absolute bottom-2 right-2">
              {actions}
            </div>
          )}
        </div>
        
        {/* Content Section */}
        <div className="p-4">
          {/* Title and Description */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
            {recipe.name}
          </h3>
          
          {recipe.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {recipe.description}
            </p>
          )}
          
          {/* Metadata */}
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
            {/* Prep Time */}
            {recipe.prepTime && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{recipe.prepTime} {t('common.minutes')}</span>
              </div>
            )}
            
            {/* Servings */}
            {recipe.servings && (
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{recipe.servings} {t('recipes.servings')}</span>
              </div>
            )}
            
            {/* Difficulty */}
            {recipe.difficulty && (
              <div className={`flex items-center gap-1 ${getDifficultyColor(recipe.difficulty)}`}>
                <Flame className="w-4 h-4" />
                <span>{t(`recipes.difficultyLevels.${recipe.difficulty}`)}</span>
              </div>
            )}
          </div>
          
          {/* Rating */}
          {recipe.ratingAverage > 0 && (
            <div className="mt-3 flex items-center gap-1">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.round(recipe.ratingAverage)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatNumber(recipe.ratingAverage, 'number')} ({recipe.ratingCount})
              </span>
            </div>
          )}
          
          {/* Categories/Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
                >
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                  +{recipe.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </TouchableArea>
    </CardWrapper>
  )
}