import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { RecipeList, RecipeFilters, RecipeFiltersState } from '@/components/recipes'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { Container } from '@/components/layout/Container'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useAuthStore } from '@/store/slices/authStore'
import { useDebounce } from '@/hooks/useDebounce'

const RecipeListPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const {
    recipes,
    loading,
    error,
    pagination,
    searchRecipes,
    loadMore
  } = useRecipeStore()
  
  const [filters, setFilters] = useState<RecipeFiltersState>({
    search: '',
    difficulty: [],
    categories: [],
    tags: [],
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })
  
  const debouncedSearch = useDebounce(filters.search, 300)
  
  // Load recipes on mount and when filters change
  useEffect(() => {
    searchRecipes({
      search: debouncedSearch,
      difficulty: filters.difficulty,
      categories: filters.categories,
      tags: filters.tags,
      minPrepTime: filters.minPrepTime,
      maxPrepTime: filters.maxPrepTime,
      minCalories: filters.minCalories,
      maxCalories: filters.maxCalories,
      isPublic: filters.isPublic,
      isFavorite: filters.isFavorite,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      page: 1,
      limit: 12
    })
  }, [
    debouncedSearch,
    filters.difficulty,
    filters.categories,
    filters.tags,
    filters.minPrepTime,
    filters.maxPrepTime,
    filters.minCalories,
    filters.maxCalories,
    filters.isPublic,
    filters.isFavorite,
    filters.sortBy,
    filters.sortOrder,
    searchRecipes
  ])
  
  const handleLoadMore = () => {
    if (pagination.hasNextPage && !loading) {
      loadMore()
    }
  }
  
  const handleCreateRecipe = () => {
    navigate('/recipes/new')
  }
  
  // Get unique categories and tags from loaded recipes with null safety
  const availableCategories = Array.from(
    new Set(recipes.flatMap(r => r.categories || []))
  ).filter(Boolean)
  const availableTags = Array.from(
    new Set(recipes.flatMap(r => r.tags || []))
  ).filter(Boolean)
  
  return (
    <Container>
      <div className="py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('navigation.recipes')}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t('recipes.subtitle')}
            </p>
          </div>
          
          {user && (
            <TouchableArea
              onClick={handleCreateRecipe}
              className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('recipes.createNew')}
            </TouchableArea>
          )}
        </div>
        
        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters - Desktop */}
          <div className="hidden lg:block">
            <RecipeFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableCategories={availableCategories}
              availableTags={availableTags}
            />
          </div>
          
          {/* Recipe List */}
          <div className="lg:col-span-3">
            {/* Filters - Mobile */}
            <div className="lg:hidden mb-6">
              <RecipeFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableCategories={availableCategories}
                availableTags={availableTags}
              />
            </div>
            
            {/* Results count */}
            {!loading && recipes.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('common.showing')} {recipes.length} {t('common.of')} {pagination.total} {t('recipes.recipes')}
              </p>
            )}
            
            {/* Recipe Grid */}
            <RecipeList
              recipes={recipes}
              loading={loading}
              error={error}
              emptyMessage={
                filters.search || filters.difficulty.length > 0 || filters.categories.length > 0 || filters.tags.length > 0
                  ? t('recipes.noRecipesFound')
                  : t('recipes.noRecipes')
              }
            />
            
            {/* Load More */}
            {pagination.hasNextPage && !loading && (
              <div className="mt-8 text-center">
                <TouchableArea
                  onClick={handleLoadMore}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  {t('common.loadMore')}
                </TouchableArea>
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  )
}

export default RecipeListPage