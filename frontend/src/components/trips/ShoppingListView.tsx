import React, { useState, useMemo } from 'react'
import { 
  ShoppingCart, 
  ChevronDown,
  ChevronRight,
  Package,
  Printer,
  Download,
  FileText,
  RefreshCw
} from 'lucide-react'
import type { Trip, ShoppingListItem } from '@/store/slices/tripStore'
import { useTripStore } from '@/store/slices/tripStore'
import { useWebSocketEvent, useTripWebSocket } from '@/hooks/useWebSocket'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { 
  calculateTotalWeight, 
  calculateTotalVolume, 
  formatQuantity
} from '@/utils/shoppingCalculations'

interface ShoppingListViewProps {
  trip: Trip
  className?: string
}

interface GroupedItems {
  [key: string]: ShoppingListItem[]
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

const categoryOrder = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'bakery',
  'grains',
  'canned',
  'frozen',
  'beverages',
  'snacks',
  'condiments',
  'spices',
  'other'
]

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({ trip, className }) => {
  const { 
    shoppingList, 
    shoppingListLoading, 
    generateShoppingList 
  } = useTripStore()
  
  const { toast } = useToast()
  const { onTripEvent } = useTripWebSocket(trip.id)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

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
      
      // Update store with new items
      useTripStore.setState({ shoppingList: updatedItems })
      
      toast({
        title: 'Shopping list updated',
        description: 'The shopping list has been refreshed with the latest changes',
        variant: 'success'
      })
    }
  }, { enabled: trip.id !== undefined })

  // Group items by category
  const groupedItems = useMemo<GroupedItems>(() => {
    const groups: GroupedItems = {}

    shoppingList.forEach(item => {
      const category = item.category || 'other'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(item)
    })

    // Sort categories by predefined order
    const sortedGroups: GroupedItems = {}
    categoryOrder.forEach(category => {
      if (groups[category]) {
        sortedGroups[category] = groups[category].sort((a, b) => 
          a.name.localeCompare(b.name)
        )
      }
    })

    return sortedGroups
  }, [shoppingList])

  // Calculate totals per category
  const categoryTotals = useMemo(() => {
    const totals: Record<string, { weight: number; volume: number; count: number }> = {}
    
    Object.entries(groupedItems).forEach(([category, items]) => {
      totals[category] = {
        weight: calculateTotalWeight(items),
        volume: calculateTotalVolume(items),
        count: items.length
      }
    })
    
    return totals
  }, [groupedItems])

  // Toggle category collapse
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Category', 'Item', 'Quantity', 'Unit', 'Used In']
    const rows: string[][] = []
    
    Object.entries(groupedItems).forEach(([category, items]) => {
      items.forEach(item => {
        rows.push([
          categoryMapping[category] || category,
          item.name,
          formatQuantity(item.quantity, item.unit),
          item.unit,
          item.recipes.join('; ')
        ])
      })
    })

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
  }

  // Export to PDF (print)
  const exportToPDF = () => {
    window.print()
  }

  if (shoppingListLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Spinner size="lg" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading shopping list...
        </span>
      </div>
    )
  }

  if (!shoppingList || shoppingList.length === 0) {
    return (
      <div className={cn("text-center p-8", className)}>
        <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          No shopping list generated yet
        </p>
        <Button
          onClick={() => generateShoppingList(trip.id)}
          variant="primary"
          size="sm"
        >
          Generate Shopping List
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6 shopping-list-view", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:mb-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Shopping List
          </h2>
          <Badge variant="secondary">
            {shoppingList.length} items
          </Badge>
        </div>

        <div className="flex gap-2 print:hidden">
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateShoppingList(trip.id)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
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
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <Card className="p-4 bg-gray-50 dark:bg-gray-800/50 print:bg-white print:border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Items</p>
            <p className="text-xl font-semibold">{shoppingList.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
            <p className="text-xl font-semibold">{Object.keys(groupedItems).length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Weight</p>
            <p className="text-xl font-semibold">
              {calculateTotalWeight(shoppingList).toFixed(1)} kg
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
            <p className="text-xl font-semibold">
              {calculateTotalVolume(shoppingList).toFixed(1)} L
            </p>
          </div>
        </div>
      </Card>

      {/* Category Groups */}
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([category, items]) => (
          <Card key={category} className="overflow-hidden print:break-inside-avoid">
            {/* Category Header */}
            <div 
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors print:bg-gray-50"
              onClick={() => toggleCategory(category)}
            >
              <div className="flex items-center gap-3">
                {collapsedCategories.has(category) ? (
                  <ChevronRight className="h-5 w-5 text-gray-500 print:hidden" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500 print:hidden" />
                )}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {categoryMapping[category] || category}
                </h3>
                <Badge variant="secondary">{items.length}</Badge>
              </div>

              <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                {categoryTotals[category]?.weight > 0 && (
                  <span>{categoryTotals[category].weight.toFixed(1)} kg</span>
                )}
                {categoryTotals[category]?.volume > 0 && (
                  <span>{categoryTotals[category].volume.toFixed(1)} L</span>
                )}
              </div>
            </div>

            {/* Category Items */}
            {!collapsedCategories.has(category) && (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => (
                  <div 
                    key={item.ingredientId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {item.recipes.join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {formatQuantity(item.quantity, item.unit)} {item.unit}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
            color: black;
          }
          
          .shopping-list-view {
            max-width: 100%;
          }
          
          .shopping-list-view h2,
          .shopping-list-view h3 {
            color: black;
          }
          
          .shopping-list-view .text-gray-600,
          .shopping-list-view .text-gray-500,
          .shopping-list-view .text-gray-400 {
            color: #666;
          }
          
          .shopping-list-view .text-gray-900,
          .shopping-list-view .text-gray-100 {
            color: black;
          }
          
          .dark .shopping-list-view * {
            background: white !important;
            color: black !important;
            border-color: #ccc !important;
          }
          
          @page {
            margin: 2cm;
          }
        }
      `}</style>
    </div>
  )
}