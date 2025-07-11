import React from 'react'
import { VirtualRecipeList } from '@/components/lists'
import { Recipe } from '@/store/slices/recipeStore'

/**
 * Example: Replace existing RecipeListView with VirtualRecipeList
 * 
 * Before:
 * ```tsx
 * <div className="grid gap-6 grid-cols-4">
 *   {recipes.map(recipe => (
 *     <RecipeCard key={recipe.id} recipe={recipe} />
 *   ))}
 * </div>
 * ```
 * 
 * After:
 */
export function RecipeListVirtualExample({ recipes }: { recipes: Recipe[] }) {
  return (
    <VirtualRecipeList
      recipes={recipes}
      viewMode="grid"
      height="calc(100vh - 200px)" // Adjust based on your layout
      onRecipeClick={(recipe) => console.log('Clicked:', recipe)}
      overscan={3} // Render 3 extra items outside viewport
    />
  )
}

/**
 * Example: Integrating with search/filter
 */
export function FilteredVirtualListExample({ 
  recipes,
  searchTerm 
}: { 
  recipes: Recipe[]
  searchTerm: string 
}) {
  // Filter recipes based on search
  const filteredRecipes = React.useMemo(() => {
    if (!searchTerm) return recipes
    
    const term = searchTerm.toLowerCase()
    return recipes.filter(recipe => 
      recipe.name.toLowerCase().includes(term) ||
      recipe.description?.toLowerCase().includes(term)
    )
  }, [recipes, searchTerm])

  return (
    <VirtualRecipeList
      recipes={filteredRecipes}
      viewMode="list"
      height={600}
      emptyMessage={
        searchTerm 
          ? `No recipes found for "${searchTerm}"`
          : "No recipes available"
      }
    />
  )
}

/**
 * Example: Dynamic view mode switching
 */
export function DynamicViewModeExample({ recipes }: { recipes: Recipe[] }) {
  const [viewMode, setViewMode] = React.useState<'grid' | 'list' | 'compact'>('grid')
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('grid')}
          className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Grid
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          List
        </button>
        <button
          onClick={() => setViewMode('compact')}
          className={`px-3 py-1 rounded ${viewMode === 'compact' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Compact
        </button>
      </div>
      
      <VirtualRecipeList
        recipes={recipes}
        viewMode={viewMode}
        height={600}
      />
    </div>
  )
}

/**
 * Example: With selection and batch operations
 */
export function SelectableVirtualListExample({ recipes }: { recipes: Recipe[] }) {
  const [selectedRecipes, setSelectedRecipes] = React.useState<Set<string>>(new Set())
  
  const handleSelectRecipe = (recipeId: string) => {
    setSelectedRecipes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId)
      } else {
        newSet.add(recipeId)
      }
      return newSet
    })
  }
  
  const handleBatchDelete = () => {
    console.log('Deleting recipes:', Array.from(selectedRecipes))
    // Implement batch delete logic
    setSelectedRecipes(new Set())
  }
  
  return (
    <div className="space-y-4">
      {selectedRecipes.size > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
          <span>{selectedRecipes.size} recipes selected</span>
          <button
            onClick={handleBatchDelete}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete Selected
          </button>
        </div>
      )}
      
      <VirtualRecipeList
        recipes={recipes}
        viewMode="list"
        height={600}
        selectedRecipes={selectedRecipes}
        onSelectRecipe={handleSelectRecipe}
        showCheckbox
      />
    </div>
  )
}

/**
 * Example: Custom scroll restoration
 */
export function ScrollRestorationExample({ recipes }: { recipes: Recipe[] }) {
  const listRef = React.useRef<any>(null)
  
  // Save scroll position before navigation
  const saveScrollPosition = () => {
    if (listRef.current) {
      const scrollOffset = listRef.current.getScrollOffset()
      sessionStorage.setItem('recipe-list-scroll', String(scrollOffset))
    }
  }
  
  // Restore scroll position on mount
  React.useEffect(() => {
    const savedPosition = sessionStorage.getItem('recipe-list-scroll')
    if (savedPosition && listRef.current) {
      listRef.current.scrollToOffset(Number(savedPosition))
    }
  }, [])
  
  return (
    <VirtualRecipeList
      ref={listRef}
      recipes={recipes}
      viewMode="list"
      height={600}
      onRecipeClick={(recipe) => {
        saveScrollPosition()
        // Navigate to recipe detail
      }}
    />
  )
}