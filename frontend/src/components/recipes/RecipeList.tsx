import React from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Recipe } from '@/types/recipe'
import { RecipeCard } from './RecipeCard'
import { Grid } from '@/components/layout/Grid'
import { useBreakpoint } from '@/hooks/useBreakpoint'

interface RecipeListProps {
  recipes: Recipe[]
  loading?: boolean
  error?: Error | null
  emptyMessage?: string
  onToggleFavorite?: (recipeId: string) => void
}

export function RecipeList({
  recipes,
  loading = false,
  error = null,
  emptyMessage,
  onToggleFavorite
}: RecipeListProps) {
  const { t } = useTranslation()
  const breakpoint = useBreakpoint()
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-red-600 dark:text-red-400 font-medium">
          {t('errors.generic')}
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {error.message}
        </p>
      </div>
    )
  }
  
  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-gray-600 dark:text-gray-400">
          {emptyMessage || t('recipes.noRecipes')}
        </p>
      </div>
    )
  }
  
  // Determine columns based on breakpoint
  const getColumns = () => {
    switch (breakpoint) {
      case 'xs':
        return 1
      case 'sm':
        return 2
      case 'md':
        return 3
      case 'lg':
      case 'xl':
      case '2xl':
        return 4
      default:
        return 3
    }
  }
  
  return (
    <Grid columns={getColumns()} gap={6}>
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </Grid>
  )
}