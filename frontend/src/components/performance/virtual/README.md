# Virtual Scrolling Components

High-performance virtual scrolling components for rendering large lists efficiently in React applications.

## Overview

Virtual scrolling (also known as windowing) is a technique for improving performance when rendering large lists by only rendering the items that are currently visible in the viewport, plus a small buffer (overscan).

## Components

### VirtualList

Basic virtual list component for rendering large lists with optional variable item heights.

```tsx
import { VirtualList } from '@/components/performance/virtual'

<VirtualList
  items={items}
  height={600}
  itemHeight={100} // or (index) => calculateHeight(index)
  renderItem={(item, index, style) => (
    <div style={style}>
      {item.name}
    </div>
  )}
  getItemKey={(item) => item.id}
  overscan={5}
/>
```

### VirtualGrid

Virtual grid component for efficient 2D layouts.

```tsx
import { VirtualGrid, ResponsiveVirtualGrid } from '@/components/performance/virtual'

// Fixed column count
<VirtualGrid
  items={items}
  height={600}
  columnCount={4}
  rowHeight={200}
  gap={16}
  renderItem={(item, index, style) => (
    <Card style={style}>
      {item.name}
    </Card>
  )}
/>

// Responsive columns
<ResponsiveVirtualGrid
  items={items}
  height={600}
  minColumnWidth={200}
  maxColumns={6}
  rowHeight={200}
  gap={16}
  renderItem={(item, index, style) => (
    <Card style={style}>
      {item.name}
    </Card>
  )}
/>
```

### VirtualTable

Virtual table with fixed headers and efficient row rendering.

```tsx
import { VirtualTable, VirtualTableColumn } from '@/components/performance/virtual'

const columns: VirtualTableColumn<DataType>[] = [
  {
    key: 'name',
    header: 'Name',
    accessor: (item) => item.name,
    sortable: true,
    width: 200
  },
  // ... more columns
]

<VirtualTable
  data={data}
  columns={columns}
  height={600}
  rowHeight={48}
  onRowClick={(item) => console.log(item)}
  onSort={(columnKey, direction) => handleSort(columnKey, direction)}
  stickyHeader
  striped
  hoverable
/>
```

### WindowScroller

Virtual list that uses window or custom element for scrolling.

```tsx
import { WindowScroller } from '@/components/performance/virtual'

<WindowScroller
  items={items}
  itemHeight={100}
  renderItem={(item, index, style) => (
    <div style={style}>
      {item.name}
    </div>
  )}
  scrollElement={window} // or custom element
/>
```

### InfiniteScroller

Virtual list with built-in infinite scrolling support.

```tsx
import { InfiniteScroller } from '@/components/performance/virtual'

<InfiniteScroller
  items={items}
  height={600}
  itemHeight={100}
  hasMore={hasMore}
  loadMore={async () => {
    const newItems = await fetchMoreItems()
    setItems([...items, ...newItems])
  }}
  renderItem={(item, index, style) => (
    <div style={style}>
      {item.name}
    </div>
  )}
  loader={<LoadingSpinner />}
/>
```

## Specialized Components

### VirtualRecipeList

Optimized virtual list for recipe cards with multiple view modes.

```tsx
import { VirtualRecipeList } from '@/components/lists'

<VirtualRecipeList
  recipes={recipes}
  viewMode="grid" // or "list" | "compact"
  height={600}
  favorites={favoriteIds}
  selectedRecipes={selectedIds}
  showCheckbox
  onRecipeClick={(recipe) => navigateToRecipe(recipe)}
  onToggleFavorite={(recipeId) => toggleFavorite(recipeId)}
  onSelectRecipe={(recipeId) => toggleSelection(recipeId)}
/>
```

### VirtualTripList

Virtual list for trip management with progress tracking.

```tsx
import { VirtualTripList } from '@/components/lists'

<VirtualTripList
  trips={trips}
  viewMode="list" // or "table"
  height={600}
  onTripClick={(trip) => navigateToTrip(trip)}
  onEdit={(trip) => editTrip(trip)}
  onArchive={(trip) => archiveTrip(trip)}
/>
```

### VirtualIngredientList

Virtual list for ingredient inventory with stock tracking.

```tsx
import { VirtualIngredientList } from '@/components/lists'

<VirtualIngredientList
  ingredients={ingredients}
  viewMode="list" // or "table" | "compact"
  height={600}
  selectedIngredients={selectedIds}
  showCheckbox
  onIngredientClick={(ingredient) => viewDetails(ingredient)}
  onStockUpdate={(ingredient, inStock) => updateStock(ingredient, inStock)}
/>
```

## Hooks

### useVirtualList

Core hook for creating virtual lists.

```tsx
import { useVirtualList } from '@/hooks/useVirtualization'

const {
  virtualItems,
  totalSize,
  scrollToIndex,
  scrollToOffset,
  measureElement
} = useVirtualList({
  items,
  estimateSize: (index) => 100,
  overscan: 5,
  getScrollElement: () => scrollRef.current
})
```

### useVirtualGrid

Hook for creating virtual grids.

```tsx
import { useVirtualGrid } from '@/hooks/useVirtualization'

const {
  virtualItems,
  totalSize,
  scrollToIndex
} = useVirtualGrid({
  items,
  columnCount: 4,
  itemHeight: 200,
  rowGap: 16,
  columnGap: 16,
  overscan: 2,
  getScrollElement: () => scrollRef.current
})
```

### useDynamicSizeList

Hook for lists with dynamically measured item sizes.

```tsx
import { useDynamicSizeList } from '@/hooks/useVirtualization'

const {
  virtualItems,
  measureElement,
  itemSizes
} = useDynamicSizeList({
  items,
  defaultItemSize: 100,
  getScrollElement: () => scrollRef.current
})
```

### useScrollRestoration

Hook for saving and restoring scroll position.

```tsx
import { useScrollRestoration } from '@/hooks/useVirtualization'

const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration(
  'list-key',
  virtualizer
)

// Save before navigation
onBeforeNavigate(() => saveScrollPosition())

// Restore on mount
useEffect(() => {
  restoreScrollPosition()
}, [])
```

## Performance Utilities

### Size Estimation

```tsx
import { SizeEstimator } from '@/utils/virtualScrolling'

const estimator = new SizeEstimator({
  minSize: 50,
  maxSize: 500,
  averageSize: 100
})

// Record actual measurements
estimator.recordMeasurement('item-1', 120)

// Get estimate for unmeasured items
const estimatedSize = estimator.estimateSize('item-2')
```

### Overscan Calculation

```tsx
import { calculateOverscan } from '@/utils/virtualScrolling'

const overscan = calculateOverscan({
  viewportSize: 800,
  itemSize: 100,
  scrollVelocity: 1500, // pixels/second
  isTouch: true
})
```

### Performance Monitoring

```tsx
import { VirtualScrollPerformanceMonitor } from '@/utils/virtualScrolling'

const monitor = new VirtualScrollPerformanceMonitor()
monitor.start(scrollElement)

// Check performance
if (monitor.isPerformanceDegraded()) {
  // Reduce overscan or simplify item rendering
}

// Get metrics
const { averageFps, minFps } = monitor.getMetrics()
```

## Best Practices

1. **Provide Accurate Size Estimates**: For variable height items, provide good estimates to reduce layout shifts.

2. **Use Proper Keys**: Always provide a stable `getItemKey` function for better performance.

3. **Optimize Item Renderers**: Memoize item components to prevent unnecessary re-renders.
   ```tsx
   const ItemRenderer = React.memo(({ item }) => (
     <div>{item.name}</div>
   ))
   ```

4. **Adjust Overscan**: Balance between smooth scrolling and performance:
   - Desktop: 3-5 items
   - Mobile: 5-10 items
   - Fast scrolling: Increase dynamically

5. **Handle Loading States**: Show placeholders while data loads.

6. **Keyboard Navigation**: Implement keyboard support for accessibility.

7. **Touch Support**: Ensure smooth scrolling on mobile devices.

## Migration Guide

### From Regular List to Virtual List

Before:
```tsx
<div className="list">
  {items.map(item => (
    <ItemComponent key={item.id} item={item} />
  ))}
</div>
```

After:
```tsx
<VirtualList
  items={items}
  height={600}
  itemHeight={100}
  renderItem={(item) => <ItemComponent item={item} />}
  getItemKey={(item) => item.id}
/>
```

### From DataTable to VirtualTable

Before:
```tsx
<DataTable
  columns={columns}
  data={data}
  onRowClick={handleRowClick}
/>
```

After:
```tsx
<VirtualTable
  columns={columns}
  data={data}
  height={600}
  rowHeight={48}
  onRowClick={handleRowClick}
/>
```

## Troubleshooting

### Items not rendering
- Check that `height` is set (not "auto" or percentage without container)
- Verify `getScrollElement` returns valid element
- Ensure items array is not empty

### Scroll jumping
- Provide consistent item heights or better estimates
- Use `measureElement` for dynamic sizes
- Check for state updates causing re-renders

### Poor performance
- Reduce overscan
- Simplify item renderers
- Use React.memo for item components
- Check for unnecessary re-renders with React DevTools

### Layout shifts
- Provide accurate size estimates
- Use placeholder content while loading
- Implement proper image lazy loading