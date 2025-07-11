# React Performance Optimization Guide

This directory contains performance-optimized components and utilities for React applications.

## Components

### MemoizedList
A generic list component with virtualization support for large datasets.

```tsx
import { MemoizedList } from '@/components/performance'

<MemoizedList
  items={recipes}
  renderItem={(item, index) => <RecipeCard recipe={item} />}
  keyExtractor={(item) => item.id}
  virtualize={true}
  virtualizeThreshold={50}
/>
```

### VirtualList
High-performance virtual scrolling for extremely large lists.

```tsx
import { VirtualList } from '@/components/performance'

<VirtualList
  items={data}
  height={600}
  itemHeight={80}
  renderItem={(item, index, style) => (
    <div style={style}>{item.name}</div>
  )}
/>
```

### OptimizedImage
Lazy-loading image component with progressive enhancement.

```tsx
import { OptimizedImage } from '@/components/performance'

<OptimizedImage
  src="/path/to/image.jpg"
  alt="Description"
  placeholder="blur"
  priority={false}
  fadeIn={true}
/>
```

### DeferredComponent
Defer rendering of expensive components to improve initial load.

```tsx
import { DeferredComponent } from '@/components/performance'

<DeferredComponent threshold="idle" delay={100}>
  <ExpensiveChart data={chartData} />
</DeferredComponent>
```

## Optimization Utilities

### Performance Tracking
```tsx
import { performanceTracker, measureComponentRender } from '@/utils/performanceOptimization'

// Track component renders
const timer = measureComponentRender('MyComponent')
timer.start()
// ... render logic
timer.end()

// Get performance report
performanceTracker.logReport()
```

### Memoization Helpers
```tsx
import { deepMemoCompare, smartMemoCompare, withMemo } from '@/utils/performanceOptimization'

// Memoize with deep comparison
export const MyComponent = memo(Component, deepMemoCompare)

// Memoize with smart comparison
export const MyList = memo(ListComponent, smartMemoCompare)

// HOC for automatic memoization
export const OptimizedComponent = withMemo(Component, customCompareFunction)
```

## Optimization Hooks

### useMemoizedCallback
Enhanced useCallback with dependency tracking.

```tsx
const handleClick = useMemoizedCallback(
  (id: string) => {
    // handler logic
  },
  [dependency1, dependency2],
  'handleClick' // debug name
)
```

### useDeepCompareMemo
Memoization with deep equality checking for complex objects.

```tsx
const expensiveValue = useDeepCompareMemo(
  () => computeExpensiveValue(data),
  [data] // works with objects/arrays
)
```

### useWhyDidYouUpdate
Debug hook to track why a component re-rendered.

```tsx
useWhyDidYouUpdate('ComponentName', props)
// Logs changed props to console in development
```

### useDebounce & useThrottle
Rate-limiting hooks for performance.

```tsx
// Debounce
const [value, debouncedValue, isPending] = useDebounce(searchTerm, 300)

// Throttle
const throttledScrollPosition = useThrottle(scrollY, 100)
```

## Optimized Components in the Codebase

The following components have been optimized with React.memo:

### List Views
- **TripListView** - Memoized with shallow prop comparison
- **RecipeListView** - Uses smart comparison for complex props
- **RecipeCard** - Custom comparison for recipe data
- **ShoppingListView** - Memoized to prevent unnecessary re-renders

### Forms
- **RecipeForm** - Memoized to prevent re-renders during editing
- **TripCalendarView** - Deep comparison for trip data

### Data Display
- **DataTable** - Generic memoized table component
- **MealPlanningBoard** - Complex drag-and-drop board with memoization

## Best Practices

### When to Use React.memo

✅ **Use React.memo when:**
- Component receives complex props (objects, arrays)
- Component renders frequently with same props
- Component is a list item in large lists
- Component has expensive render logic

❌ **Don't use React.memo when:**
- Component rarely re-renders
- Component has mostly primitive props
- Component always receives new props
- Component is simple with cheap renders

### Optimization Patterns

1. **List Item Optimization**
```tsx
const ListItem = memo(({ item, onClick }) => (
  <div onClick={() => onClick(item.id)}>
    {item.name}
  </div>
), (prev, next) => prev.item.id === next.item.id)
```

2. **Form Field Optimization**
```tsx
const FormField = memo(({ value, error, onChange }) => (
  <input value={value} onChange={onChange} />
), compareOnly(['value', 'error']))
```

3. **Callback Memoization**
```tsx
const handleClick = useCallback((id) => {
  dispatch({ type: 'SELECT', id })
}, [dispatch])
```

4. **Virtual Scrolling for Large Lists**
```tsx
<VirtualList
  items={thousandsOfItems}
  height={600}
  itemHeight={50}
  renderItem={renderItem}
/>
```

## Performance Monitoring

### Development Tools
1. React DevTools Profiler
2. Chrome Performance Tab
3. Built-in performance tracking utilities

### Metrics to Watch
- Render time (should be < 16ms for 60fps)
- Component mount/unmount frequency
- Memory usage
- Bundle size impact

## Migration Guide

### Optimizing Existing Components

1. **Identify Performance Bottlenecks**
   - Use React DevTools Profiler
   - Look for components that render frequently
   - Check for expensive computations

2. **Apply Memoization**
   ```tsx
   // Before
   export function MyComponent(props) {
     return <div>{props.data}</div>
   }
   
   // After
   export const MyComponent = memo(function MyComponent(props) {
     return <div>{props.data}</div>
   }, customCompareFunction)
   ```

3. **Optimize Callbacks**
   ```tsx
   // Before
   <Button onClick={() => handleClick(id)} />
   
   // After
   const onClick = useCallback(() => handleClick(id), [id])
   <Button onClick={onClick} />
   ```

4. **Implement Virtual Scrolling**
   ```tsx
   // Before
   {items.map(item => <Item key={item.id} {...item} />)}
   
   // After
   <VirtualList
     items={items}
     renderItem={(item) => <Item {...item} />}
   />
   ```

## Common Pitfalls

1. **Over-memoization** - Not every component needs memoization
2. **Inline objects/functions** - These create new references every render
3. **Incorrect dependencies** - Missing or extra dependencies in hooks
4. **Complex comparison functions** - Sometimes the comparison is more expensive than re-rendering

## Resources

- [React Performance Documentation](https://react.dev/learn/render-and-commit)
- [Web Vitals](https://web.dev/vitals/)
- [React Profiler API](https://react.dev/reference/react/Profiler)