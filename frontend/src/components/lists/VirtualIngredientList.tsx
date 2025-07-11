import React, { forwardRef, useCallback, useMemo } from 'react'
import { Ingredient } from '@/types'
import { VirtualList, VirtualTable, VirtualListHandle, VirtualTableColumn } from '@/components/performance/virtual'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { 
  Package,
  Edit,
  Trash2,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  Barcode,
  Wheat,
  Apple,
  Carrot
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { format } from 'date-fns'

// Extended ingredient type with additional fields for UI
interface ExtendedIngredient extends Ingredient {
  amount?: number
  unit?: string
  inStock?: boolean
  lastPurchased?: string
  averagePrice?: number
  priceHistory?: Array<{ date: string; price: number }>
  stockLevel?: 'low' | 'medium' | 'high'
  expiryDate?: string
  supplier?: string
  barcode?: string
  allergens?: string[]
}

export interface VirtualIngredientListProps {
  ingredients: ExtendedIngredient[]
  viewMode?: 'list' | 'table' | 'compact'
  height?: number | string
  onIngredientClick?: (ingredient: ExtendedIngredient) => void
  onEdit?: (ingredient: ExtendedIngredient) => void
  onDelete?: (ingredient: ExtendedIngredient) => void
  onStockUpdate?: (ingredient: ExtendedIngredient, inStock: boolean) => void
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  selectedIngredients?: Set<string>
  onSelectIngredient?: (ingredientId: string) => void
  showCheckbox?: boolean
  showActions?: boolean
  className?: string
  overscan?: number
}

export const VirtualIngredientList = forwardRef<VirtualListHandle, VirtualIngredientListProps>(({
  ingredients,
  viewMode = 'list',
  height = 600,
  onIngredientClick,
  onEdit,
  onDelete,
  onStockUpdate,
  onSort,
  sortBy,
  sortDirection = 'asc',
  selectedIngredients,
  onSelectIngredient,
  showCheckbox = false,
  showActions = true,
  className,
  overscan = 5
}, ref) => {
  const { t } = useTranslation()

  // Get stock level badge
  const getStockLevelBadge = useCallback((level?: 'low' | 'medium' | 'high') => {
    if (!level) return null

    const variants = {
      low: { variant: 'destructive' as const, icon: <TrendingDown className="w-3 h-3 mr-1" /> },
      medium: { variant: 'secondary' as const, icon: <AlertCircle className="w-3 h-3 mr-1" /> },
      high: { variant: 'default' as const, icon: <TrendingUp className="w-3 h-3 mr-1" /> }
    }

    const config = variants[level]

    return (
      <Badge variant={config.variant} className="flex items-center">
        {config.icon}
        {t(`ingredients.stockLevel.${level}`)}
      </Badge>
    )
  }, [t])

  // Format price
  const formatPrice = useCallback((price?: number) => {
    if (!price) return '-'
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK'
    }).format(price)
  }, [])

  // Actions dropdown
  const renderActions = useCallback((ingredient: ExtendedIngredient) => {
    if (!showActions || (!onEdit && !onDelete && !onStockUpdate)) return null

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TouchableArea className="p-2" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </TouchableArea>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(ingredient)}>
              <Edit className="mr-2 h-4 w-4" />
              {t('common.edit')}
            </DropdownMenuItem>
          )}
          {onStockUpdate && (
            <DropdownMenuItem onClick={() => onStockUpdate(ingredient, !ingredient.inStock)}>
              {ingredient.inStock ? (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('ingredients.markOutOfStock')}
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t('ingredients.markInStock')}
                </>
              )}
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(ingredient)}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }, [showActions, t, onEdit, onDelete, onStockUpdate])

  // Get category icon
  const getCategoryIcon = useCallback((category: string) => {
    const categoryLower = category.toLowerCase()
    if (categoryLower.includes('grain') || categoryLower.includes('cereal')) {
      return <Wheat className="w-4 h-4 text-amber-500" />
    }
    if (categoryLower.includes('fruit')) {
      return <Apple className="w-4 h-4 text-red-500" />
    }
    if (categoryLower.includes('vegetable')) {
      return <Carrot className="w-4 h-4 text-orange-500" />
    }
    return <Package className="w-4 h-4 text-gray-400" />
  }, [])

  // List item renderer
  const renderListItem = useCallback((ingredient: ExtendedIngredient, index: number) => {
    const isSelected = selectedIngredients?.has(ingredient.id)

    return (
      <div
        className={cn(
          "bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border",
          isSelected && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
          !isSelected && "border-gray-200 dark:border-gray-700"
        )}
        onClick={() => onIngredientClick?.(ingredient)}
      >
        <div className="flex items-start gap-3">
          {showCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelectIngredient?.(ingredient.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          )}
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {ingredient.name}
                </h4>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <span>{ingredient.amount} {ingredient.unit}</span>
                  {ingredient.category && (
                    <Badge variant="outline" className="text-xs">
                      {ingredient.category}
                    </Badge>
                  )}
                  {ingredient.allergens && ingredient.allergens.length > 0 && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                      <AlertCircle className="w-3 h-3" />
                      {ingredient.allergens.length} {t('ingredients.allergens')}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  {ingredient.inStock ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {ingredient.stockLevel && getStockLevelBadge(ingredient.stockLevel)}
                </div>
                {renderActions(ingredient)}
              </div>
            </div>
            
            {(ingredient.averagePrice || ingredient.lastPurchased || ingredient.expiryDate) && (
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                {ingredient.averagePrice && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {formatPrice(ingredient.averagePrice)}
                  </span>
                )}
                {ingredient.lastPurchased && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {t('ingredients.lastPurchased')}: {format(new Date(ingredient.lastPurchased), 'dd.MM.yyyy')}
                  </span>
                )}
                {ingredient.expiryDate && (
                  <span className={cn(
                    "flex items-center gap-1",
                    new Date(ingredient.expiryDate) < new Date() && "text-red-600 dark:text-red-400 font-medium"
                  )}>
                    <AlertCircle className="w-3 h-3" />
                    {t('ingredients.expires')}: {format(new Date(ingredient.expiryDate), 'dd.MM.yyyy')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }, [showCheckbox, selectedIngredients, onSelectIngredient, onIngredientClick, getStockLevelBadge, formatPrice, renderActions, t])

  // Compact item renderer
  const renderCompactItem = useCallback((ingredient: ExtendedIngredient, index: number) => {
    const isSelected = selectedIngredients?.has(ingredient.id)

    return (
      <div
        className={cn(
          "bg-white dark:bg-gray-800 rounded p-3 shadow-sm hover:shadow transition-all cursor-pointer border",
          isSelected && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
          !isSelected && "border-gray-200 dark:border-gray-700"
        )}
        onClick={() => onIngredientClick?.(ingredient)}
      >
        <div className="flex items-center gap-3">
          {showCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelectIngredient?.(ingredient.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          {getCategoryIcon(ingredient.category)}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {ingredient.name}
              </span>
              <span className="text-sm text-gray-500">
                {ingredient.amount} {ingredient.unit}
              </span>
              {ingredient.category && (
                <Badge variant="outline" className="text-xs">
                  {ingredient.category}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {ingredient.inStock ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            {showActions && renderActions(ingredient)}
          </div>
        </div>
      </div>
    )
  }, [showCheckbox, selectedIngredients, onSelectIngredient, onIngredientClick, showActions, renderActions])

  // Table columns
  const columns: VirtualTableColumn<ExtendedIngredient>[] = useMemo(() => [
    ...(showCheckbox ? [{
      key: 'select',
      header: (
        <Checkbox
          checked={selectedIngredients?.size === ingredients.length && ingredients.length > 0}
          indeterminate={selectedIngredients && selectedIngredients.size > 0 && selectedIngredients.size < ingredients.length}
          onCheckedChange={() => {
            // Select/deselect all logic would go here
          }}
        />
      ),
      accessor: (ingredient: ExtendedIngredient) => (
        <Checkbox
          checked={selectedIngredients?.has(ingredient.id)}
          onCheckedChange={() => onSelectIngredient?.(ingredient.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      width: 40
    }] : []),
    {
      key: 'name',
      header: t('ingredients.name'),
      accessor: (ingredient) => (
        <div className="flex items-center gap-2">
          {getCategoryIcon(ingredient.category)}
          <div>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {ingredient.name}
            </span>
            {ingredient.barcode && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Barcode className="w-3 h-3" />
                {ingredient.barcode}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      minWidth: 200
    },
    {
      key: 'defaultUnit',
      header: t('ingredients.unit'),
      accessor: (ingredient) => (
        <span className="text-sm">
          {ingredient.amount || '-'} {ingredient.unit || ingredient.defaultUnit}
        </span>
      ),
      sortable: true,
      width: 120
    },
    {
      key: 'category',
      header: t('ingredients.category'),
      accessor: (ingredient) => ingredient.category ? (
        <Badge variant="outline">{ingredient.category}</Badge>
      ) : '-',
      sortable: true,
      width: 120
    },
    {
      key: 'stock',
      header: t('ingredients.stock'),
      accessor: (ingredient) => (
        <div className="flex items-center gap-2">
          {ingredient.inStock ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          {ingredient.stockLevel && getStockLevelBadge(ingredient.stockLevel)}
        </div>
      ),
      sortable: true,
      width: 150
    },
    {
      key: 'price',
      header: t('ingredients.price'),
      accessor: (ingredient) => (
        <span className="text-sm font-medium">
          {formatPrice(ingredient.averagePrice)}
        </span>
      ),
      sortable: true,
      width: 100,
      align: 'right'
    },
    {
      key: 'expiry',
      header: t('ingredients.expiry'),
      accessor: (ingredient) => ingredient.expiryDate ? (
        <span className={cn(
          "text-sm",
          new Date(ingredient.expiryDate) < new Date() && "text-red-600 dark:text-red-400 font-medium"
        )}>
          {format(new Date(ingredient.expiryDate), 'dd.MM.yyyy')}
        </span>
      ) : '-',
      sortable: true,
      width: 120
    },
    ...(showActions ? [{
      key: 'actions',
      header: '',
      accessor: (ingredient: ExtendedIngredient) => renderActions(ingredient),
      width: 50,
      align: 'center' as const
    }] : [])
  ], [t, showCheckbox, selectedIngredients, ingredients.length, onSelectIngredient, getStockLevelBadge, formatPrice, showActions, renderActions, getCategoryIcon])

  if (viewMode === 'table') {
    return (
      <VirtualTable
        ref={ref as any}
        data={ingredients}
        columns={columns}
        height={height}
        rowHeight={60}
        overscan={overscan}
        getRowKey={(ingredient) => ingredient.id}
        onRowClick={onIngredientClick}
        onSort={onSort}
        sortBy={sortBy}
        sortDirection={sortDirection}
        hoverable
        striped
        className={className}
        emptyMessage={t('ingredients.noIngredients')}
      />
    )
  }

  const renderItem = viewMode === 'compact' ? renderCompactItem : renderListItem
  const itemHeight = viewMode === 'compact' ? 56 : 96

  return (
    <VirtualList
      ref={ref}
      items={ingredients}
      height={height}
      itemHeight={itemHeight}
      overscan={overscan}
      renderItem={(ingredient, index) => (
        <div className="px-4 py-2">
          {renderItem(ingredient, index)}
        </div>
      )}
      getItemKey={(ingredient) => ingredient.id}
      className={className}
      emptyMessage={t('ingredients.noIngredients')}
    />
  )
})

VirtualIngredientList.displayName = 'VirtualIngredientList'