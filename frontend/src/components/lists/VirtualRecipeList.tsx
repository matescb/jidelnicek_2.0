import React, { forwardRef, useCallback, useMemo } from 'react'
import { Recipe } from '@/store/slices/recipeStore'
import { VirtualList, VirtualGrid, ResponsiveVirtualGrid, VirtualListHandle } from '@/components/performance/virtual'
import { RecipeCard } from '@/components/recipes/RecipeCard'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { cn } from '@/lib/utils'
import { 
  Clock, 
  Users, 
  Star, 
  Heart, 
  HeartOff,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  MapPin
} from 'lucide-react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useTranslation } from 'react-i18next'

export interface VirtualRecipeListProps {
  recipes: Recipe[]
  viewMode?: 'grid' | 'list' | 'compact'
  height?: number | string
  onRecipeClick?: (recipe: Recipe) => void
  onToggleFavorite?: (recipeId: string, e?: React.MouseEvent) => void
  onEdit?: (recipe: Recipe, e?: React.MouseEvent) => void
  onDuplicate?: (recipe: Recipe, e?: React.MouseEvent) => void
  onDelete?: (recipe: Recipe, e?: React.MouseEvent) => void
  onAddToTrip?: (recipe: Recipe, e?: React.MouseEvent) => void
  favorites?: string[]
  selectedRecipes?: Set<string>
  onSelectRecipe?: (recipeId: string) => void
  showCheckbox?: boolean
  className?: string
  estimatedItemHeight?: number
  overscan?: number
}

export const VirtualRecipeList = forwardRef<VirtualListHandle, VirtualRecipeListProps>(({
  recipes,
  viewMode = 'list',
  height = 600,
  onRecipeClick,
  onToggleFavorite,
  onEdit,
  onDuplicate,
  onDelete,
  onAddToTrip,
  favorites = [],
  selectedRecipes,
  onSelectRecipe,
  showCheckbox = false,
  className,
  estimatedItemHeight = 120,
  overscan = 3
}, ref) => {
  const { t } = useTranslation()
  const breakpoint = useBreakpoint()

  // Render actions dropdown
  const renderActions = useCallback((recipe: Recipe, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TouchableArea className="p-2" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="w-4 h-4" />
          </TouchableArea>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit && (
            <DropdownMenuItem onClick={(e) => onEdit(recipe, e as any)}>
              <Edit className="w-4 h-4 mr-2" />
              {t('common.edit')}
            </DropdownMenuItem>
          )}
          {onDuplicate && (
            <DropdownMenuItem onClick={(e) => onDuplicate(recipe, e as any)}>
              <Copy className="w-4 h-4 mr-2" />
              {t('common.duplicate')}
            </DropdownMenuItem>
          )}
          {onAddToTrip && (
            <DropdownMenuItem onClick={(e) => onAddToTrip(recipe, e as any)}>
              <MapPin className="w-4 h-4 mr-2" />
              {t('recipes.addToTrip')}
            </DropdownMenuItem>
          )}
          {(onEdit || onDuplicate || onAddToTrip) && onDelete && <DropdownMenuSeparator />}
          {onDelete && (
            <DropdownMenuItem 
              onClick={(e) => onDelete(recipe, e as any)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('common.delete')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }, [t, onEdit, onDuplicate, onDelete, onAddToTrip])

  // List item renderer
  const renderListItem = useCallback((recipe: Recipe, index: number) => {
    const isSelected = selectedRecipes?.has(recipe.id)
    const isFavorite = favorites.includes(recipe.id)

    return (
      <div
        className={cn(
          "bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border",
          isSelected && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
          !isSelected && "border-gray-200 dark:border-gray-700"
        )}
        onClick={() => onRecipeClick?.(recipe)}
      >
        <div className="flex items-start gap-4">
          {showCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelectRecipe?.(recipe.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          )}
          
          {recipe.imageUrl && (
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
            />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {recipe.name}
                </h3>
                {recipe.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {recipe.categories.slice(0, 3).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                    {recipe.categories.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{recipe.categories.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {onToggleFavorite && (
                  <TouchableArea
                    onClick={(e) => onToggleFavorite(recipe.id, e)}
                    className="p-2"
                  >
                    {isFavorite ? (
                      <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                    ) : (
                      <HeartOff className="w-5 h-5 text-gray-400" />
                    )}
                  </TouchableArea>
                )}
                {(onEdit || onDuplicate || onDelete || onAddToTrip) && renderActions(recipe)}
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {recipe.prepTime} min
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {recipe.servings}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                {recipe.ratingAverage.toFixed(1)} ({recipe.ratingCount})
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }, [showCheckbox, selectedRecipes, onSelectRecipe, favorites, onRecipeClick, onToggleFavorite, onEdit, onDuplicate, onDelete, onAddToTrip, renderActions])

  // Compact item renderer
  const renderCompactItem = useCallback((recipe: Recipe, index: number) => {
    const isSelected = selectedRecipes?.has(recipe.id)
    const isFavorite = favorites.includes(recipe.id)

    return (
      <div
        className={cn(
          "bg-white dark:bg-gray-800 rounded p-3 shadow-sm hover:shadow transition-all cursor-pointer border",
          isSelected && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
          !isSelected && "border-gray-200 dark:border-gray-700"
        )}
        onClick={() => onRecipeClick?.(recipe)}
      >
        <div className="flex items-center gap-3">
          {showCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelectRecipe?.(recipe.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {recipe.name}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{recipe.prepTime}m</span>
              <span>{recipe.servings} servings</span>
              <span className="flex items-center gap-0.5">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                {recipe.ratingAverage.toFixed(1)}
              </span>
            </div>
          </div>
          
          {onToggleFavorite && (
            <TouchableArea
              onClick={(e) => onToggleFavorite(recipe.id, e)}
              className="p-1.5"
            >
              {isFavorite ? (
                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              ) : (
                <HeartOff className="w-4 h-4 text-gray-400" />
              )}
            </TouchableArea>
          )}
        </div>
      </div>
    )
  }, [showCheckbox, selectedRecipes, onSelectRecipe, favorites, onRecipeClick, onToggleFavorite])

  // Grid item renderer
  const renderGridItem = useCallback((recipe: Recipe, index: number) => {
    return (
      <RecipeCard
        recipe={recipe}
        onToggleFavorite={onToggleFavorite}
        onClick={() => onRecipeClick?.(recipe)}
        selected={selectedRecipes?.has(recipe.id)}
        onSelect={() => onSelectRecipe?.(recipe.id)}
        showCheckbox={showCheckbox}
        actions={
          (onEdit || onDuplicate || onDelete || onAddToTrip) ? renderActions(recipe) : undefined
        }
      />
    )
  }, [selectedRecipes, showCheckbox, onRecipeClick, onToggleFavorite, onSelectRecipe, onEdit, onDuplicate, onDelete, onAddToTrip, renderActions])

  // Estimate item heights based on view mode
  const getItemHeight = useMemo(() => {
    switch (viewMode) {
      case 'compact':
        return 64
      case 'list':
        return 108
      case 'grid':
        return 280
      default:
        return estimatedItemHeight
    }
  }, [viewMode, estimatedItemHeight])

  if (viewMode === 'grid') {
    return (
      <ResponsiveVirtualGrid
        ref={ref}
        items={recipes}
        height={height}
        rowHeight={280}
        minColumnWidth={250}
        maxColumns={4}
        gap={16}
        containerPadding={0}
        overscan={overscan}
        renderItem={renderGridItem}
        getItemKey={(recipe) => recipe.id}
        className={className}
        emptyMessage={t('recipes.noRecipes')}
      />
    )
  }

  const renderItem = viewMode === 'compact' ? renderCompactItem : renderListItem

  return (
    <VirtualList
      ref={ref}
      items={recipes}
      height={height}
      itemHeight={getItemHeight}
      overscan={overscan}
      renderItem={(recipe, index) => (
        <div className="px-4 py-2">
          {renderItem(recipe, index)}
        </div>
      )}
      getItemKey={(recipe) => recipe.id}
      className={className}
      emptyMessage={t('recipes.noRecipes')}
    />
  )
})

VirtualRecipeList.displayName = 'VirtualRecipeList'