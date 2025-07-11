import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  VirtualList, 
  VirtualGrid, 
  VirtualTable, 
  WindowScroller,
  InfiniteScroller 
} from '@/components/performance/virtual'
import { 
  VirtualRecipeList, 
  VirtualTripList, 
  VirtualIngredientList 
} from '@/components/lists'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Recipe } from '@/store/slices/recipeStore'
import { Trip } from '@/store/slices/tripStore'
import { Ingredient } from '@/types'
import { format } from 'date-fns'
import { useToast } from '@/hooks/useToast'

// Generate mock data
const generateMockRecipes = (count: number): Recipe[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `recipe-${i}`,
    name: `Recipe ${i + 1}`,
    description: `Description for recipe ${i + 1}`,
    prepTime: Math.floor(Math.random() * 60) + 15,
    cookTime: Math.floor(Math.random() * 120) + 30,
    servings: Math.floor(Math.random() * 8) + 2,
    difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] as any,
    imageUrl: `https://picsum.photos/seed/${i}/300/200`,
    instructions: [],
    ingredients: [],
    categories: ['Italian', 'Mexican', 'Asian', 'American'].slice(0, Math.floor(Math.random() * 3) + 1),
    tags: [],
    ratingAverage: Math.random() * 2 + 3,
    ratingCount: Math.floor(Math.random() * 100),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authorId: 'user-1'
  }))
}

const generateMockTrips = (count: number): Trip[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `trip-${i}`,
    name: `Trip to ${['Paris', 'Tokyo', 'New York', 'London', 'Sydney'][i % 5]} ${i + 1}`,
    location: ['Paris, France', 'Tokyo, Japan', 'New York, USA', 'London, UK', 'Sydney, Australia'][i % 5],
    startDate: format(new Date(Date.now() + i * 86400000), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + (i + 7) * 86400000), 'yyyy-MM-dd'),
    participants: [],
    participantCount: Math.floor(Math.random() * 10) + 2,
    days: [],
    status: ['planning', 'active', 'completed'][Math.floor(Math.random() * 3)] as any,
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }))
}

const generateMockIngredients = (count: number): Array<Ingredient & { 
  amount?: number
  unit?: string
  inStock?: boolean
  stockLevel?: 'low' | 'medium' | 'high'
}> => {
  const categories = ['Grains', 'Fruits', 'Vegetables', 'Dairy', 'Meat', 'Spices']
  const units = ['kg', 'g', 'l', 'ml', 'pcs']
  
  return Array.from({ length: count }, (_, i) => ({
    id: `ingredient-${i}`,
    name: `Ingredient ${i + 1}`,
    category: categories[i % categories.length],
    defaultUnit: units[i % units.length],
    amount: Math.floor(Math.random() * 1000) + 100,
    unit: units[i % units.length],
    inStock: Math.random() > 0.3,
    stockLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
    nutrition: {
      calories: Math.floor(Math.random() * 300) + 50,
      protein: Math.floor(Math.random() * 30),
      carbs: Math.floor(Math.random() * 50),
      fat: Math.floor(Math.random() * 20),
      fiber: Math.floor(Math.random() * 10),
      sodium: Math.floor(Math.random() * 500)
    }
  }))
}

export default function VirtualScrollingDemo() {
  const { t } = useTranslation()
  const { toast } = useToast()
  
  // State
  const [itemCount, setItemCount] = useState(1000)
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'table'>('list')
  const [showCheckbox, setShowCheckbox] = useState(false)
  const [overscan, setOverscan] = useState(5)
  const [hasMore, setHasMore] = useState(true)
  const [favorites, setFavorites] = useState<string[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  
  // Generate mock data
  const recipes = useMemo(() => generateMockRecipes(itemCount), [itemCount])
  const trips = useMemo(() => generateMockTrips(itemCount), [itemCount])
  const ingredients = useMemo(() => generateMockIngredients(itemCount), [itemCount])
  
  // Handlers
  const handleToggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) 
        ? prev.filter(f => f !== id)
        : [...prev, id]
    )
    toast({
      title: favorites.includes(id) ? 'Removed from favorites' : 'Added to favorites'
    })
  }
  
  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }
  
  const handleLoadMore = async () => {
    // Simulate loading more items
    await new Promise(resolve => setTimeout(resolve, 1000))
    setItemCount(prev => prev + 100)
    
    if (itemCount >= 5000) {
      setHasMore(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Virtual Scrolling Demo</h1>
        <p className="text-gray-600 dark:text-gray-400">
          High-performance virtual scrolling components for rendering large lists efficiently.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Controls</CardTitle>
          <CardDescription>Adjust settings to test performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Item Count: {itemCount}</Label>
              <Slider
                value={[itemCount]}
                onValueChange={([value]) => setItemCount(value)}
                min={100}
                max={10000}
                step={100}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Overscan: {overscan}</Label>
              <Slider
                value={[overscan]}
                onValueChange={([value]) => setOverscan(value)}
                min={1}
                max={20}
                step={1}
              />
            </div>
            
            <div className="space-y-2">
              <Label>View Mode</Label>
              <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={showCheckbox}
                onCheckedChange={setShowCheckbox}
                id="show-checkbox"
              />
              <Label htmlFor="show-checkbox">Show Checkboxes</Label>
            </div>
            
            {selectedItems.size > 0 && (
              <Badge variant="secondary">
                {selectedItems.size} items selected
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Component Demos */}
      <Tabs defaultValue="recipes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="basic">Basic List</TabsTrigger>
          <TabsTrigger value="window">Window Scroll</TabsTrigger>
          <TabsTrigger value="infinite">Infinite Scroll</TabsTrigger>
        </TabsList>

        <TabsContent value="recipes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Virtual Recipe List</CardTitle>
              <CardDescription>
                Specialized virtual list for recipe cards with grid/list views
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VirtualRecipeList
                recipes={recipes}
                viewMode={viewMode as 'grid' | 'list'}
                height={600}
                overscan={overscan}
                favorites={favorites}
                selectedRecipes={selectedItems}
                showCheckbox={showCheckbox}
                onRecipeClick={(recipe) => toast({ title: `Clicked: ${recipe.name}` })}
                onToggleFavorite={handleToggleFavorite}
                onSelectRecipe={handleSelectItem}
                onEdit={(recipe) => toast({ title: `Edit: ${recipe.name}` })}
                onDelete={(recipe) => toast({ title: `Delete: ${recipe.name}` })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Virtual Trip List</CardTitle>
              <CardDescription>
                Virtual list for trip management with progress tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VirtualTripList
                trips={trips}
                viewMode={viewMode === 'grid' ? 'list' : viewMode as 'list' | 'table'}
                height={600}
                overscan={overscan}
                onTripClick={(trip) => toast({ title: `Clicked: ${trip.name}` })}
                onEdit={(trip) => toast({ title: `Edit: ${trip.name}` })}
                onDuplicate={(trip) => toast({ title: `Duplicate: ${trip.name}` })}
                onArchive={(trip) => toast({ title: `Archive: ${trip.name}` })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Virtual Ingredient List</CardTitle>
              <CardDescription>
                Virtual list for ingredient inventory with stock tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VirtualIngredientList
                ingredients={ingredients}
                viewMode={viewMode as any}
                height={600}
                overscan={overscan}
                selectedIngredients={selectedItems}
                showCheckbox={showCheckbox}
                onIngredientClick={(ingredient) => toast({ title: `Clicked: ${ingredient.name}` })}
                onSelectIngredient={handleSelectItem}
                onEdit={(ingredient) => toast({ title: `Edit: ${ingredient.name}` })}
                onDelete={(ingredient) => toast({ title: `Delete: ${ingredient.name}` })}
                onStockUpdate={(ingredient, inStock) => 
                  toast({ title: `Stock updated: ${ingredient.name} - ${inStock ? 'In Stock' : 'Out of Stock'}` })
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Virtual List</CardTitle>
              <CardDescription>
                Simple virtual list with dynamic item heights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VirtualList
                items={Array.from({ length: itemCount }, (_, i) => ({
                  id: i,
                  height: Math.floor(Math.random() * 100) + 50
                }))}
                height={600}
                itemHeight={(index) => {
                  // Variable heights
                  return 50 + (index % 3) * 30
                }}
                overscan={overscan}
                renderItem={(item, index) => (
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Height: {50 + (index % 3) * 30}px
                    </p>
                  </div>
                )}
                getItemKey={(item) => item.id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="window" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Window Scroller</CardTitle>
              <CardDescription>
                Virtual list that uses window scrolling (full page scroll)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Scroll down to see more items rendered using window scroll
              </p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <WindowScroller
                  items={recipes.slice(0, 100)}
                  itemHeight={100}
                  overscan={overscan}
                  renderItem={(recipe, index) => (
                    <Card className="mb-2">
                      <CardContent className="p-4">
                        <h4 className="font-medium">{recipe.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {recipe.description}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  getItemKey={(recipe) => recipe.id}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infinite" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Infinite Scroller</CardTitle>
              <CardDescription>
                Virtual list with infinite scrolling support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InfiniteScroller
                items={recipes.slice(0, itemCount)}
                height={600}
                itemHeight={100}
                overscan={overscan}
                hasMore={hasMore}
                loadMore={handleLoadMore}
                renderItem={(recipe, index) => (
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium">{recipe.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {recipe.description}
                    </p>
                  </div>
                )}
                getItemKey={(recipe) => recipe.id}
                loader={
                  <div className="p-4 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading more items...</p>
                  </div>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Tips</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <ul>
            <li>Use <code>getItemKey</code> for stable keys when items can be reordered</li>
            <li>Adjust <code>overscan</code> based on scroll velocity and device performance</li>
            <li>For variable height items, provide accurate estimates to reduce layout shifts</li>
            <li>Use <code>WindowScroller</code> for full-page lists to reduce nested scrolling</li>
            <li>Consider <code>InfiniteScroller</code> for paginated data sources</li>
            <li>Memoize item renderers to prevent unnecessary re-renders</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}