import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Grid2X2, 
  List, 
  Table2, 
  MoreVertical,
  Eye,
  Edit,
  Copy,
  Trash2,
  Download,
  Plus,
  Star,
  Clock,
  Users,
  ChevronDown,
  Filter,
  Search,
  Heart,
  HeartOff,
  MapPin
} from 'lucide-react'
import { DataTable, Column } from '@/components/ui/DataTable'
import { RecipeCard } from './RecipeCard'
import { RecipeFiltersAdvanced } from './RecipeFiltersAdvanced'
import { useRecipeStore, Recipe, RecipeFilters } from '@/store/slices/recipeStore'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useDebounce } from '@/hooks/useDebounce'
import { Button } from '@/components/ui/button'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { Pagination } from '@/components/ui/Pagination'
import { SortSelector } from '@/components/ui/SortSelector'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/useToast'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { AnimatedList } from '@/components/ui/animated/AnimatedList'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'

type ViewMode = 'grid' | 'list' | 'table'

interface RecipeListViewProps {
  initialFilters?: RecipeFilters
  onRecipeSelect?: (recipe: Recipe) => void
  showFilters?: boolean
  allowBatchOperations?: boolean
  customActions?: (recipe: Recipe) => React.ReactNode
}

export function RecipeListView({
  initialFilters = {},
  onRecipeSelect,
  showFilters = true,
  allowBatchOperations = true,
  customActions
}: RecipeListViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const breakpoint = useBreakpoint()
  const { toast } = useToast()
  
  // Store
  const {
    recipes,
    loading,
    error,
    pagination,
    filters,
    sortBy,
    sortOrder,
    favorites,
    fetchRecipes,
    setFilters,
    setSorting,
    toggleFavorite,
    deleteRecipe,
    duplicateRecipe,
    clearError
  } = useRecipeStore()
  
  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set())
  const [showMobileSort, setShowMobileSort] = useState(false)
  
  // Set initial filters
  useEffect(() => {
    if (Object.keys(initialFilters).length > 0) {
      setFilters(initialFilters)
    }
  }, [])
  
  // Fetch recipes when filters change
  const debouncedFilters = useDebounce(filters, 300)
  useEffect(() => {
    fetchRecipes(1)
  }, [debouncedFilters, sortBy, sortOrder])
  
  // Handle error
  useEffect(() => {
    if (error) {
      toast({
        title: t('errors.generic'),
        description: error,
        variant: 'destructive'
      })
      clearError()
    }
  }, [error])
  
  // Handlers
  const handleRecipeClick = (recipe: Recipe) => {
    if (onRecipeSelect) {
      onRecipeSelect(recipe)
    } else {
      navigate(`/recipes/${recipe.id}`)
    }
  }
  
  const handleToggleFavorite = async (recipeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await toggleFavorite(recipeId)
      toast({
        title: favorites.includes(recipeId) 
          ? t('recipes.removedFromFavorites')
          : t('recipes.addedToFavorites')
      })
    } catch (error) {
      // Error is handled by the store
    }
  }
  
  const handleEdit = (recipe: Recipe, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigate(`/recipes/${recipe.id}/edit`)
  }
  
  const handleDuplicate = async (recipe: Recipe, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const duplicated = await duplicateRecipe(recipe.id)
      toast({
        title: t('recipes.duplicated'),
        description: t('recipes.duplicatedDescription', { name: duplicated.name })
      })
      navigate(`/recipes/${duplicated.id}/edit`)
    } catch (error) {
      // Error is handled by the store
    }
  }
  
  const handleDelete = async (recipe: Recipe, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (confirm(t('recipes.deleteConfirm', { name: recipe.name }))) {
      try {
        await deleteRecipe(recipe.id)
        toast({
          title: t('recipes.deleted'),
          description: t('recipes.deletedDescription', { name: recipe.name })
        })
      } catch (error) {
        // Error is handled by the store
      }
    }
  }
  
  const handleAddToTrip = (recipe: Recipe, e?: React.MouseEvent) => {
    e?.stopPropagation()
    // Navigate to trip planning with selected recipe
    navigate('/trips/new', { state: { selectedRecipeId: recipe.id } })
  }
  
  const handleSelectRecipe = (recipeId: string) => {
    const newSelected = new Set(selectedRecipes)
    if (newSelected.has(recipeId)) {
      newSelected.delete(recipeId)
    } else {
      newSelected.add(recipeId)
    }
    setSelectedRecipes(newSelected)
  }
  
  const handleSelectAll = () => {
    if (selectedRecipes.size === recipes.length) {
      setSelectedRecipes(new Set())
    } else {
      setSelectedRecipes(new Set(recipes.map(r => r.id)))
    }
  }
  
  const handleBatchExport = () => {
    const selected = recipes.filter(r => selectedRecipes.has(r.id))
    const data = JSON.stringify(selected, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recipes-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({
      title: t('recipes.exported'),
      description: t('recipes.exportedDescription', { count: selected.length })
    })
  }
  
  const handleBatchDelete = async () => {
    if (confirm(t('recipes.batchDeleteConfirm', { count: selectedRecipes.size }))) {
      try {
        await Promise.all(
          Array.from(selectedRecipes).map(id => deleteRecipe(id))
        )
        setSelectedRecipes(new Set())
        toast({
          title: t('recipes.batchDeleted'),
          description: t('recipes.batchDeletedDescription', { count: selectedRecipes.size })
        })
      } catch (error) {
        // Error is handled by the store
      }
    }
  }
  
  // Table columns
  const columns: Column<Recipe>[] = useMemo(() => [
    {
      key: 'select',
      header: (
        <Checkbox
          checked={selectedRecipes.size === recipes.length && recipes.length > 0}
          indeterminate={selectedRecipes.size > 0 && selectedRecipes.size < recipes.length}
          onCheckedChange={handleSelectAll}
        />
      ),
      accessor: (recipe) => (
        <Checkbox
          checked={selectedRecipes.has(recipe.id)}
          onCheckedChange={() => handleSelectRecipe(recipe.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      width: 40
    },
    {
      key: 'name',
      header: t('recipes.name'),
      accessor: (recipe) => (
        <div className="flex items-center gap-3">
          {recipe.imageUrl && (
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          )}
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {recipe.name}
            </p>
            {recipe.categories?.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {recipe.categories.join(', ')}
              </p>
            )}
          </div>
        </div>
      ),
      sortable: true
    },
    {
      key: 'prepTime',
      header: t('recipes.prepTime'),
      accessor: (recipe) => (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          {recipe.prepTime} {t('common.minutes')}
        </div>
      ),
      sortable: true,
      mobileHidden: true
    },
    {
      key: 'servings',
      header: t('recipes.servings'),
      accessor: (recipe) => (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <Users className="w-4 h-4" />
          {recipe.servings}
        </div>
      ),
      mobileHidden: true
    },
    {
      key: 'rating',
      header: t('recipes.rating'),
      accessor: (recipe) => (
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="text-sm font-medium">{recipe.ratingAverage.toFixed(1)}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({recipe.ratingCount})
          </span>
        </div>
      ),
      sortable: true
    },
    {
      key: 'favorite',
      header: '',
      accessor: (recipe) => (
        <TouchableArea
          onClick={(e) => handleToggleFavorite(recipe.id, e)}
          className="p-1"
        >
          {favorites.includes(recipe.id) ? (
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
          ) : (
            <HeartOff className="w-5 h-5 text-gray-400" />
          )}
        </TouchableArea>
      ),
      width: 50
    },
    {
      key: 'actions',
      header: '',
      accessor: (recipe) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TouchableArea className="p-2" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="w-4 h-4" />
            </TouchableArea>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleRecipeClick(recipe)}>
              <Eye className="w-4 h-4 mr-2" />
              {t('common.view')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleEdit(recipe, e as any)}>
              <Edit className="w-4 h-4 mr-2" />
              {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleDuplicate(recipe, e as any)}>
              <Copy className="w-4 h-4 mr-2" />
              {t('common.duplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleAddToTrip(recipe, e as any)}>
              <MapPin className="w-4 h-4 mr-2" />
              {t('recipes.addToTrip')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => handleDelete(recipe, e as any)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      width: 50
    }
  ], [recipes, selectedRecipes, favorites, t])
  
  // Get available filters data
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    recipes.forEach(recipe => {
      recipe.categories?.forEach(cat => categories.add(cat))
    })
    return Array.from(categories).sort()
  }, [recipes])
  
  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    recipes.forEach(recipe => {
      recipe.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [recipes])
  
  // Mobile recipe item renderer
  const mobileRecipeItem = useCallback((recipe: Recipe) => (
    <div className="flex items-center gap-3">
      <Checkbox
        checked={selectedRecipes.has(recipe.id)}
        onCheckedChange={() => handleSelectRecipe(recipe.id)}
        onClick={(e) => e.stopPropagation()}
      />
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.name}
          className="w-16 h-16 rounded-lg object-cover"
        />
      )}
      <div className="flex-1">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">
          {recipe.name}
        </h4>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {recipe.prepTime}m
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {recipe.servings}
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            {recipe.ratingAverage.toFixed(1)}
          </span>
        </div>
      </div>
      <TouchableArea
        onClick={(e) => handleToggleFavorite(recipe.id, e)}
        className="p-2"
      >
        {favorites.includes(recipe.id) ? (
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
        ) : (
          <HeartOff className="w-5 h-5 text-gray-400" />
        )}
      </TouchableArea>
    </div>
  ), [selectedRecipes, favorites])
  
  // Determine columns for grid view
  const getGridColumns = () => {
    switch (breakpoint) {
      case 'xs': return 1
      case 'sm': return 2
      case 'md': return 3
      case 'lg':
      case 'xl':
      case '2xl':
      default: return 4
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('recipes.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('recipes.showing', { count: recipes.length, total: pagination.totalItems })}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Selector */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <TouchableArea
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
            >
              <Grid2X2 className="w-4 h-4" />
            </TouchableArea>
            <TouchableArea
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
            >
              <List className="w-4 h-4" />
            </TouchableArea>
            <TouchableArea
              onClick={() => setViewMode('table')}
              className={`p-2 rounded ${viewMode === 'table' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
            >
              <Table2 className="w-4 h-4" />
            </TouchableArea>
          </div>
          
          {/* Sort Selector */}
          <SortSelector
            value={sortBy}
            order={sortOrder}
            onChange={(newSortBy, newOrder) => setSorting(newSortBy as any, newOrder)}
            options={[
              { value: 'name', label: t('recipes.name') },
              { value: 'rating', label: t('recipes.rating') },
              { value: 'prepTime', label: t('recipes.prepTime') },
              { value: 'createdAt', label: t('common.dateCreated') },
              { value: 'calories', label: t('recipes.calories') }
            ]}
          />
          
          {/* Add Recipe Button */}
          <Button onClick={() => navigate('/recipes/new')}>
            <Plus className="w-4 h-4 mr-2" />
            {t('recipes.addRecipe')}
          </Button>
        </div>
      </div>
      
      {/* Batch Operations Bar */}
      {allowBatchOperations && selectedRecipes.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {t('common.selected', { count: selectedRecipes.size })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBatchExport}
              >
                <Download className="w-4 h-4 mr-2" />
                {t('common.export')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBatchDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters */}
        {showFilters && (
          <div className="lg:w-80">
            <RecipeFiltersAdvanced
              filters={filters}
              onFiltersChange={setFilters}
              availableCategories={availableCategories}
              availableTags={availableTags}
              availableDietaryRestrictions={['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free']}
            />
          </div>
        )}
        
        {/* Recipe List */}
        <div className="flex-1">
          {loading && recipes.length === 0 ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <LoadingSpinner size="lg" />
            </div>
          ) : recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <p className="text-gray-600 dark:text-gray-400">
                {filters.search || Object.keys(filters).length > 0
                  ? t('recipes.noRecipesFound')
                  : t('recipes.noRecipes')}
              </p>
              {Object.keys(filters).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setFilters({})}
                >
                  {t('common.clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <>
              {viewMode === 'grid' && (
                <div className={`grid gap-6 grid-cols-${getGridColumns()}`}>
                  {recipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      onToggleFavorite={handleToggleFavorite}
                      onClick={() => handleRecipeClick(recipe)}
                      selected={selectedRecipes.has(recipe.id)}
                      onSelect={() => handleSelectRecipe(recipe.id)}
                      showCheckbox={allowBatchOperations}
                      actions={
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <TouchableArea className="p-2" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="w-4 h-4" />
                            </TouchableArea>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleEdit(recipe, e as any)}>
                              <Edit className="w-4 h-4 mr-2" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleDuplicate(recipe, e as any)}>
                              <Copy className="w-4 h-4 mr-2" />
                              {t('common.duplicate')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleAddToTrip(recipe, e as any)}>
                              <MapPin className="w-4 h-4 mr-2" />
                              {t('recipes.addToTrip')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => handleDelete(recipe, e as any)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                    />
                  ))}
                </div>
              )}
              
              {viewMode === 'list' && (
                <AnimatedList className="space-y-2">
                  {recipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleRecipeClick(recipe)}
                    >
                      {mobileRecipeItem(recipe)}
                    </div>
                  ))}
                </AnimatedList>
              )}
              
              {viewMode === 'table' && (
                <DataTable
                  columns={columns}
                  data={recipes}
                  keyExtractor={(recipe) => recipe.id}
                  onRowClick={handleRecipeClick}
                  mobileRenderItem={mobileRecipeItem}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm"
                />
              )}
              
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={(page) => fetchRecipes(page)}
                    showInfo
                    totalItems={pagination.totalItems}
                    itemsPerPage={pagination.pageSize}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}