import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Search, 
  Filter, 
  Download, 
  Printer,
  Package,
  Check,
  X,
  RefreshCw,
  Grid3X3,
  List,
  Archive,
  FileText
} from 'lucide-react'
import type { Trip, ShoppingListItem } from '@/store/slices/tripStore'
import { useTripStore } from '@/store/slices/tripStore'
import { useWebSocketEvent, useTripWebSocket } from '@/hooks/useWebSocket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/loading/Spinner'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { 
  calculateTotalWeight, 
  calculateTotalVolume, 
  formatQuantity,
  sortByShoppingRoute 
} from '@/utils/shoppingCalculations'

interface ShoppingListGeneratorProps {
  trip: Trip
}

type ViewMode = 'category' | 'aisle' | 'storage'
type SortBy = 'name' | 'quantity' | 'category'

interface CheckedItems {
  [key: string]: boolean
}

interface EnhancedShoppingItem extends ShoppingListItem {
  isChecked: boolean
  packageSize?: {
    size: number
    unit: string
    packages: number
  }
}

const categoryMapping: Record<string, string> = {
  'produce': 'Fruits & Vegetables',
  'dairy': 'Dairy & Eggs',
  'meat': 'Meat & Poultry',
  'seafood': 'Seafood',
  'bakery': 'Bakery',
  'grains': 'Grains & Pasta',
  'canned': 'Canned Goods',
  'frozen': 'Frozen Foods',
  'beverages': 'Beverages',
  'snacks': 'Snacks',
  'condiments': 'Condiments & Sauces',
  'spices': 'Spices & Seasonings',
  'other': 'Other'
}

const aisleMapping: Record<string, number> = {
  'produce': 1,
  'bakery': 2,
  'dairy': 3,
  'meat': 4,
  'seafood': 4,
  'frozen': 5,
  'grains': 6,
  'canned': 7,
  'condiments': 8,
  'spices': 8,
  'beverages': 9,
  'snacks': 10,
  'other': 11
}

const storageMapping: Record<string, string> = {
  'produce': 'refrigerator',
  'dairy': 'refrigerator',
  'meat': 'freezer',
  'seafood': 'freezer',
  'bakery': 'pantry',
  'grains': 'pantry',
  'canned': 'pantry',
  'frozen': 'freezer',
  'beverages': 'pantry',
  'snacks': 'pantry',
  'condiments': 'pantry',
  'spices': 'pantry',
  'other': 'pantry'
}

const packageSuggestions: Record<string, { size: number; unit: string }[]> = {
  'kg': [
    { size: 0.5, unit: 'kg' },
    { size: 1, unit: 'kg' },
    { size: 2, unit: 'kg' },
    { size: 5, unit: 'kg' }
  ],
  'g': [
    { size: 100, unit: 'g' },
    { size: 250, unit: 'g' },
    { size: 500, unit: 'g' },
    { size: 1000, unit: 'g' }
  ],
  'l': [
    { size: 0.5, unit: 'l' },
    { size: 1, unit: 'l' },
    { size: 2, unit: 'l' }
  ],
  'ml': [
    { size: 250, unit: 'ml' },
    { size: 500, unit: 'ml' },
    { size: 1000, unit: 'ml' }
  ],
  'piece': [
    { size: 1, unit: 'piece' },
    { size: 6, unit: 'pieces' },
    { size: 12, unit: 'pieces' }
  ]
}

export const ShoppingListGenerator: React.FC<ShoppingListGeneratorProps> = ({ trip }) => {
  const { 
    shoppingList, 
    shoppingListLoading, 
    generateShoppingList, 
    updateShoppingItem,
    addCustomItem,
    removeShoppingItem
  } = useTripStore()
  
  const { toast } = useToast()
  const { onTripEvent } = useTripWebSocket(trip.id)
  
  const [viewMode, setViewMode] = useState<ViewMode>('category')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('category')
  const [checkedItems, setCheckedItems] = useState<CheckedItems>({})
  const [showCheckedOnly, setShowCheckedOnly] = useState(false)
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [customItem, setCustomItem] = useState({
    name: '',
    quantity: 1,
    unit: 'piece',
    category: 'other'
  })

  // Generate shopping list on mount
  useEffect(() => {
    if (trip.id && (!shoppingList || shoppingList.length === 0)) {
      generateShoppingList(trip.id)
    }
  }, [trip.id, generateShoppingList])

  // Subscribe to real-time shopping list updates
  useWebSocketEvent('shopping-list:update', (data) => {
    if (data.payload.tripId === trip.id) {
      // Update shopping list with WebSocket data
      const updatedItems = data.payload.items.map(item => ({
        ingredientId: item.ingredientId,
        name: item.ingredientName,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        recipes: item.recipeSources
      }))
      
      // Preserve checked state when updating
      const updatedWithCheckedState = updatedItems.map(item => ({
        ...item,
        isChecked: checkedItems[item.ingredientId] || false
      }))
      
      // Update store with new items
      useTripStore.setState({ shoppingList: updatedItems })
      
      toast({
        title: 'Shopping list updated',
        description: 'The shopping list has been updated with the latest changes',
        variant: 'success'
      })
    }
  }, { enabled: trip.id !== undefined })

  // Handle check/uncheck items
  const toggleItemCheck = useCallback((itemId: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }, [])

  // Calculate package suggestions
  const getPackageSuggestion = useCallback((quantity: number, unit: string) => {
    const suggestions = packageSuggestions[unit.toLowerCase()] || []
    if (suggestions.length === 0) return null

    // Find the best package size
    let bestSize = suggestions[0]
    let minPackages = Math.ceil(quantity / bestSize.size)

    for (const suggestion of suggestions) {
      const packages = Math.ceil(quantity / suggestion.size)
      if (packages < minPackages) {
        bestSize = suggestion
        minPackages = packages
      }
    }

    return {
      size: bestSize.size,
      unit: bestSize.unit,
      packages: minPackages
    }
  }, [])

  // Enhanced shopping items with additional data
  const enhancedItems = useMemo(() => {
    return shoppingList.map(item => ({
      ...item,
      isChecked: checkedItems[item.ingredientId] || false,
      packageSize: getPackageSuggestion(item.quantity, item.unit)
    }))
  }, [shoppingList, checkedItems, getPackageSuggestion])

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = enhancedItems

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.recipes.some(recipe => recipe.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory)
    }

    // Apply checked filter
    if (showCheckedOnly) {
      filtered = filtered.filter(item => item.isChecked)
    }

    // Sort items
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'quantity':
          return b.quantity - a.quantity
        case 'category':
        default:
          return (a.category || '').localeCompare(b.category || '')
      }
    })
  }, [enhancedItems, searchQuery, selectedCategory, showCheckedOnly, sortBy])

  // Group items by view mode
  const groupedItems = useMemo(() => {
    const groups: Record<string, EnhancedShoppingItem[]> = {}

    filteredAndSortedItems.forEach(item => {
      let groupKey: string
      
      switch (viewMode) {
        case 'aisle':
          const aisle = aisleMapping[item.category || 'other'] || 11
          groupKey = `Aisle ${aisle}`
          break
        case 'storage':
          groupKey = storageMapping[item.category || 'other'] || 'pantry'
          groupKey = groupKey.charAt(0).toUpperCase() + groupKey.slice(1)
          break
        case 'category':
        default:
          groupKey = categoryMapping[item.category || 'other'] || 'Other'
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(item)
    })

    return groups
  }, [filteredAndSortedItems, viewMode])

  // Handle quantity adjustment
  const adjustQuantity = useCallback((itemId: string, delta: number) => {
    const item = shoppingList.find(i => i.ingredientId === itemId)
    if (item) {
      // Adjust delta based on current quantity for better UX
      let adjustedDelta = delta
      if (item.unit === 'piece' || item.unit === 'pieces') {
        adjustedDelta = delta > 0 ? 1 : -1
      } else if (item.quantity > 10) {
        adjustedDelta = delta * 10
      } else if (item.quantity > 1) {
        adjustedDelta = delta
      }
      
      const newQuantity = Math.max(0.1, item.quantity + adjustedDelta)
      updateShoppingItem(itemId, { quantity: newQuantity })
    }
  }, [shoppingList, updateShoppingItem])

  // Handle custom item addition
  const handleAddCustomItem = useCallback(() => {
    if (customItem.name.trim()) {
      addCustomItem(customItem)
      setCustomItem({
        name: '',
        quantity: 1,
        unit: 'piece',
        category: 'other'
      })
      setIsAddingCustom(false)
      toast({
        title: 'Item added',
        description: `${customItem.name} has been added to the shopping list`,
        variant: 'success'
      })
    }
  }, [customItem, addCustomItem])

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['Item', 'Quantity', 'Unit', 'Category', 'Used In', 'Checked']
    const rows = filteredAndSortedItems.map(item => [
      item.name,
      formatQuantity(item.quantity, item.unit),
      item.unit,
      categoryMapping[item.category || 'other'] || 'Other',
      item.recipes.join('; '),
      item.isChecked ? 'Yes' : 'No'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip.name}-shopping-list.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Exported',
      description: 'Shopping list exported to CSV',
      variant: 'success'
    })
  }, [filteredAndSortedItems, trip.name])

  // Export to PDF
  const exportToPDF = useCallback(async () => {
    try {
      // Create a printable HTML content
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${trip.name} - Shopping List</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; margin-bottom: 10px; }
            h2 { color: #666; font-size: 18px; margin-top: 20px; margin-bottom: 10px; }
            .info { color: #888; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .checked { text-decoration: line-through; opacity: 0.6; }
            .package-info { color: #666; font-size: 12px; }
            .summary { margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>${trip.name} - Shopping List</h1>
          <div class="info">
            <p>Generated: ${new Date().toLocaleDateString()}</p>
            <p>Total Items: ${filteredAndSortedItems.length}</p>
          </div>
          
          ${Object.entries(groupedItems).map(([group, items]) => `
            <h2>${group} (${items.length} items)</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 40%">Item</th>
                  <th style="width: 20%">Quantity</th>
                  <th style="width: 20%">Package Size</th>
                  <th style="width: 20%">Used In</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr class="${item.isChecked ? 'checked' : ''}">
                    <td>${item.name}</td>
                    <td>${formatQuantity(item.quantity, item.unit)} ${item.unit}</td>
                    <td>
                      ${item.packageSize ? 
                        `<span class="package-info">${item.packageSize.packages} × ${item.packageSize.size} ${item.packageSize.unit}</span>` 
                        : '-'}
                    </td>
                    <td>${item.recipes.join(', ')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `).join('')}
          
          <div class="summary">
            <h2>Summary</h2>
            <p>Total Weight: ${calculateTotalWeight(filteredAndSortedItems).toFixed(2)} kg</p>
            <p>Total Volume: ${calculateTotalVolume(filteredAndSortedItems).toFixed(2)} L</p>
          </div>
        </body>
        </html>
      `

      // Open in new window for printing
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.focus()
        
        // Wait for content to load then trigger print dialog
        setTimeout(() => {
          printWindow.print()
        }, 250)
      }

      toast({
        title: 'PDF Export',
        description: 'Opening print dialog for PDF export',
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export shopping list to PDF',
        variant: 'error'
      })
    }
  }, [filteredAndSortedItems, groupedItems, trip.name])

  // Print shopping list
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = new Set(shoppingList.map(item => item.category || 'other'))
    return Array.from(uniqueCategories).sort()
  }, [shoppingList])

  if (shoppingListLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Generating shopping list...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Shopping List
          </h2>
          <Badge variant="secondary">
            {filteredAndSortedItems.length} items
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateShoppingList(trip.id)}
            disabled={shoppingListLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddingCustom(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportToCSV}
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportToPDF}
          >
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="print:hidden"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Filters and View Controls */}
      <Card className="p-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {categoryMapping[cat] || cat}
              </option>
            ))}
          </Select>

          {/* Sort By */}
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="category">Sort by Category</option>
            <option value="name">Sort by Name</option>
            <option value="quantity">Sort by Quantity</option>
          </Select>

          {/* View Mode */}
          <div className="flex gap-1 sm:gap-2 col-span-2 lg:col-span-1">
            <Button
              size="sm"
              variant={viewMode === 'category' ? 'primary' : 'outline'}
              onClick={() => setViewMode('category')}
              className="flex-1"
            >
              <Grid3X3 className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Category</span>
              <span className="sm:hidden">Cat</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'aisle' ? 'primary' : 'outline'}
              onClick={() => setViewMode('aisle')}
              className="flex-1"
            >
              <List className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Aisle</span>
              <span className="sm:hidden">Aisle</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'storage' ? 'primary' : 'outline'}
              onClick={() => setViewMode('storage')}
              className="flex-1"
            >
              <Archive className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Storage</span>
              <span className="sm:hidden">Store</span>
            </Button>
          </div>
        </div>

        {/* Show Checked Only */}
        <div className="mt-4 flex items-center">
          <Checkbox
            id="show-checked"
            checked={showCheckedOnly}
            onChange={(e) => setShowCheckedOnly(e.target.checked)}
          />
          <label
            htmlFor="show-checked"
            className="ml-2 text-sm text-gray-600 dark:text-gray-400"
          >
            Show checked items only
          </label>
        </div>
      </Card>

      {/* Shopping List Items */}
      <div className="space-y-6">
        {Object.entries(groupedItems).map(([group, items]) => (
          <Card key={group} className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {group}
              <Badge variant="secondary" className="ml-2">
                {items.length}
              </Badge>
            </h3>

            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.ingredientId}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border",
                    "border-gray-200 dark:border-gray-700",
                    "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                    item.isChecked && "opacity-60",
                    "gap-3"
                  )}
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1">
                    <Checkbox
                      checked={item.isChecked}
                      onChange={() => toggleItemCheck(item.ingredientId)}
                      className="print:hidden mt-1 sm:mt-0"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-gray-900 dark:text-gray-100 break-words",
                        item.isChecked && "line-through"
                      )}>
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
                        Used in: {item.recipes.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 ml-7 sm:ml-0">
                    {/* Package Size Suggestion */}
                    {item.packageSize && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
                        <Package className="h-4 w-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">
                          {item.packageSize.packages} × {item.packageSize.size} {item.packageSize.unit}
                        </span>
                      </div>
                    )}

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 sm:gap-2 print:hidden order-1 sm:order-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => adjustQuantity(item.ingredientId, -0.1)}
                        disabled={item.quantity <= 0.1}
                        className="h-8 w-8 sm:h-9 sm:w-9"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      
                      <div className="text-center min-w-[60px] sm:min-w-[80px]">
                        <span className="font-medium text-sm sm:text-base">
                          {formatQuantity(item.quantity, item.unit)} {item.unit}
                        </span>
                      </div>
                      
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => adjustQuantity(item.ingredientId, 0.1)}
                        className="h-8 w-8 sm:h-9 sm:w-9"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Remove Button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeShoppingItem(item.ingredientId)}
                      className="print:hidden order-3 h-8 w-8 sm:h-9 sm:w-9"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Add Custom Item Dialog */}
      {isAddingCustom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Custom Item</h3>
            
            <div className="space-y-4">
              <Input
                placeholder="Item name"
                value={customItem.name}
                onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                autoFocus
              />
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={customItem.quantity}
                  onChange={(e) => setCustomItem({ 
                    ...customItem, 
                    quantity: parseFloat(e.target.value) || 1 
                  })}
                  step="0.1"
                  min="0.1"
                />
                
                <Select
                  value={customItem.unit}
                  onChange={(e) => setCustomItem({ ...customItem, unit: e.target.value })}
                >
                  <option value="piece">Piece</option>
                  <option value="kg">Kilogram</option>
                  <option value="g">Gram</option>
                  <option value="l">Liter</option>
                  <option value="ml">Milliliter</option>
                </Select>
              </div>
              
              <Select
                value={customItem.category}
                onChange={(e) => setCustomItem({ ...customItem, category: e.target.value })}
              >
                {Object.entries(categoryMapping).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                variant="primary"
                onClick={handleAddCustomItem}
                disabled={!customItem.name.trim()}
                className="flex-1"
              >
                Add Item
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddingCustom(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Summary Statistics */}
      {filteredAndSortedItems.length > 0 && (
        <Card className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-lg font-semibold mb-3">Shopping List Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Items</p>
              <p className="text-xl font-semibold">{filteredAndSortedItems.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Checked Items</p>
              <p className="text-xl font-semibold">
                {filteredAndSortedItems.filter(item => item.isChecked).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Weight</p>
              <p className="text-xl font-semibold">
                {calculateTotalWeight(filteredAndSortedItems).toFixed(1)} kg
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
              <p className="text-xl font-semibold">
                {calculateTotalVolume(filteredAndSortedItems).toFixed(1)} L
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Shopping Progress</span>
              <span className="font-medium">
                {Math.round((filteredAndSortedItems.filter(item => item.isChecked).length / filteredAndSortedItems.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(filteredAndSortedItems.filter(item => item.isChecked).length / filteredAndSortedItems.length) * 100}%` 
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          .shopping-list-print,
          .shopping-list-print * {
            visibility: visible;
          }
          
          .shopping-list-print {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  )
}