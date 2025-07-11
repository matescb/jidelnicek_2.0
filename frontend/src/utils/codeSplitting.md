# Code Splitting Guide

This guide provides best practices for code splitting in the Jidelnicek application to optimize bundle size and improve performance.

## Table of Contents

1. [Overview](#overview)
2. [When to Split](#when-to-split)
3. [How to Split](#how-to-split)
4. [Best Practices](#best-practices)
5. [Bundle Analysis](#bundle-analysis)
6. [Performance Monitoring](#performance-monitoring)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)

## Overview

Code splitting is a technique to break your application bundle into smaller chunks that can be loaded on demand. This improves initial load time and overall performance by only loading the code that users need.

### Benefits

- **Faster Initial Load**: Smaller initial bundle size means faster page loads
- **Better Caching**: Unchanged chunks can be cached by the browser
- **Reduced Memory Usage**: Only load code when needed
- **Improved Performance**: Less JavaScript to parse and execute upfront

## When to Split

### Routes (Always Split)

Every route should be code-split by default:

```typescript
// ✅ Good - Route is code-split
const RecipeDetailPage = lazyRoute(
  () => import('@pages/recipes/RecipeDetailPage'),
  'RecipeDetailPage'
)

// ❌ Bad - Direct import
import RecipeDetailPage from '@pages/recipes/RecipeDetailPage'
```

### Heavy Components

Split components that are:
- Large (>50KB)
- Have heavy dependencies (charts, editors, etc.)
- Not immediately visible (modals, tabs, accordions)
- Used conditionally

```typescript
// Heavy editor component
const RichTextEditor = lazyLoad(
  () => import('@components/editors/RichTextEditor'),
  'RichTextEditor'
)

// Chart library
const ChartComponent = lazyLoad(
  () => import('@components/charts/ChartComponent'),
  'ChartComponent'
)
```

### Third-Party Libraries

Split large third-party libraries that aren't needed immediately:

```typescript
// PDF viewer - only load when needed
const PDFViewer = lazyLoad(
  () => import('@components/viewers/PDFViewer'),
  'PDFViewer'
)

// Date picker with locale data
const DatePicker = lazyLoad(
  () => import('@components/forms/DatePicker'),
  'DatePicker'
)
```

### Features Behind Flags

Split features that are conditionally loaded:

```typescript
// Admin-only features
if (user.role === 'admin') {
  const AdminDashboard = lazyLoad(
    () => import('@pages/admin/AdminDashboard'),
    'AdminDashboard'
  )
}

// Premium features
if (user.subscription === 'premium') {
  const PremiumFeatures = lazyLoad(
    () => import('@components/premium/PremiumFeatures'),
    'PremiumFeatures'
  )
}
```

## How to Split

### Basic Route Splitting

```typescript
import { lazyRoute } from '@utils/lazyLoad'

// Define the lazy loaded component
const RecipeListPage = lazyRoute(
  () => import('@pages/recipes/RecipeListPage'),
  'RecipeListPage',
  {
    maxRetries: 3,
    retryDelay: 1000,
    preload: true // Preload when network is idle
  }
)

// Use in router with Suspense
<Route 
  path="/recipes" 
  element={
    <SuspenseWrapper>
      <RecipeListPage />
    </SuspenseWrapper>
  }
/>
```

### Component Splitting

```typescript
import { lazyLoad } from '@utils/lazyLoad'
import { Suspense } from 'react'

const HeavyComponent = lazyLoad(
  () => import('./HeavyComponent'),
  'HeavyComponent'
)

function MyComponent() {
  const [showHeavy, setShowHeavy] = useState(false)
  
  return (
    <div>
      <button onClick={() => setShowHeavy(true)}>
        Load Heavy Component
      </button>
      
      {showHeavy && (
        <Suspense fallback={<LoadingSpinner />}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  )
}
```

### Preloading Strategies

```typescript
import { preloadOnInteraction } from '@utils/lazyLoad'

function Navigation() {
  const linkRef = useRef<HTMLAnchorElement>(null)
  
  useEffect(() => {
    if (linkRef.current) {
      // Preload on hover
      const cleanup = preloadOnInteraction(
        RecipeListPage,
        linkRef.current,
        ['mouseenter', 'focus']
      )
      
      return cleanup
    }
  }, [])
  
  return (
    <Link ref={linkRef} to="/recipes">
      Recipes
    </Link>
  )
}
```

## Best Practices

### 1. Always Use Suspense Boundaries

```typescript
// ✅ Good - Has loading fallback
<Suspense fallback={<LoadingSpinner />}>
  <LazyComponent />
</Suspense>

// ❌ Bad - No fallback
<LazyComponent />
```

### 2. Group Related Components

```typescript
// ✅ Good - Related components in same chunk
const RecipeComponents = lazyLoad(
  () => import('@components/recipes'),
  'RecipeComponents'
)

// Then export individual components
export const { RecipeCard, RecipeList, RecipeForm } = RecipeComponents
```

### 3. Handle Loading States Gracefully

```typescript
const LoadingFallback = () => (
  <div className="animate-pulse">
    <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
)

<Suspense fallback={<LoadingFallback />}>
  <LazyComponent />
</Suspense>
```

### 4. Handle Errors

```typescript
<ErrorBoundary
  fallback={<ErrorFallback />}
  onError={(error) => console.error('Chunk load error:', error)}
>
  <Suspense fallback={<Loading />}>
    <LazyComponent />
  </Suspense>
</ErrorBoundary>
```

### 5. Use Network-Aware Loading

```typescript
const config = getNetworkAwareConfig()

const Component = lazyLoad(
  () => import('./Component'),
  'Component',
  config // Adjusts retry strategy based on connection
)
```

## Bundle Analysis

### Using Vite Bundle Visualizer

```bash
# Install the plugin
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer'

export default {
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ]
}
```

### Analyze Bundle Size

```bash
# Build with stats
npm run build -- --analyze

# Check bundle sizes
npm run build
# Look at dist/assets for chunk sizes
```

### Monitor Chunk Sizes

Set up size limits in `vite.config.ts`:

```typescript
export default {
  build: {
    chunkSizeWarningLimit: 500, // 500kb warning
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        }
      }
    }
  }
}
```

## Performance Monitoring

### Track Loading Performance

```typescript
// In your lazy load config
const Component = lazyLoad(
  () => import('./Component'),
  'Component',
  {
    onLoadStart: (name) => {
      performance.mark(`${name}-load-start`)
    },
    onLoadSuccess: (name) => {
      performance.mark(`${name}-load-end`)
      performance.measure(
        `${name}-load-time`,
        `${name}-load-start`,
        `${name}-load-end`
      )
    }
  }
)
```

### Monitor Cache Hit Rate

```typescript
import { getCacheStats } from '@utils/lazyLoad'

// Log cache statistics
setInterval(() => {
  const stats = getCacheStats()
  console.log('Component cache stats:', stats)
}, 60000) // Every minute
```

## Common Patterns

### Modal Splitting

```typescript
const EditModal = lazyLoad(
  () => import('@components/modals/EditModal'),
  'EditModal'
)

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Edit
      </button>
      
      {isOpen && (
        <Suspense fallback={<ModalSkeleton />}>
          <EditModal 
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
          />
        </Suspense>
      )}
    </>
  )
}
```

### Tab Splitting

```typescript
const tabs = {
  overview: lazyLoad(() => import('./OverviewTab'), 'OverviewTab'),
  details: lazyLoad(() => import('./DetailsTab'), 'DetailsTab'),
  settings: lazyLoad(() => import('./SettingsTab'), 'SettingsTab'),
}

function TabPanel({ activeTab }) {
  const TabComponent = tabs[activeTab]
  
  return (
    <Suspense fallback={<TabSkeleton />}>
      <TabComponent />
    </Suspense>
  )
}
```

### Feature Splitting

```typescript
// Split features by user role
const getAdminFeatures = () => lazyLoad(
  () => import('@features/admin'),
  'AdminFeatures'
)

const getUserFeatures = () => lazyLoad(
  () => import('@features/user'),
  'UserFeatures'
)

// Load based on role
const Features = user.isAdmin 
  ? getAdminFeatures() 
  : getUserFeatures()
```

## Troubleshooting

### Common Issues

#### 1. Chunk Load Errors

```typescript
// Handle chunk failures
window.addEventListener('unhandledrejection', event => {
  if (event.reason?.name === 'ChunkLoadError') {
    // Reload the page to get fresh chunks
    window.location.reload()
  }
})
```

#### 2. Flash of Loading State

```typescript
// Use startTransition for smoother loading
import { startTransition } from 'react'

function navigate() {
  startTransition(() => {
    // Navigation that triggers lazy loading
  })
}
```

#### 3. Too Many Small Chunks

```typescript
// Group small related modules
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Group recipe-related modules
          if (id.includes('recipes')) {
            return 'recipes'
          }
          // Group trip-related modules
          if (id.includes('trips')) {
            return 'trips'
          }
        }
      }
    }
  }
}
```

### Debugging

```typescript
// Enable debug logging
const Component = lazyLoad(
  () => import('./Component'),
  'Component',
  {
    onLoadStart: (name) => console.log(`Loading ${name}...`),
    onLoadSuccess: (name) => console.log(`Loaded ${name}`),
    onLoadError: (name, error, retry) => {
      console.error(`Failed to load ${name}:`, error)
      console.log(`Retry attempt: ${retry}`)
    }
  }
)

// Check what's in cache
console.log('Cache stats:', getCacheStats())

// Clear cache for testing
clearComponentCache()
```

### Performance Tips

1. **Preload Critical Routes**: Use `preloadOn: 'immediate'` for frequently accessed routes
2. **Use Intersection Observer**: Preload components when they're about to enter viewport
3. **Network-Aware Loading**: Adjust strategy based on user's connection
4. **Cache Aggressively**: Components stay in memory once loaded
5. **Monitor Bundle Size**: Keep initial bundle under 200KB

## Conclusion

Effective code splitting is crucial for application performance. By following these guidelines, you can ensure fast initial loads while maintaining a smooth user experience. Remember to:

- Split at route boundaries
- Split heavy components and libraries
- Handle loading and error states
- Monitor bundle sizes
- Test on slow connections

For more information, see:
- [Vite Code Splitting Guide](https://vitejs.dev/guide/features.html#code-splitting)
- [React Lazy Documentation](https://react.dev/reference/react/lazy)
- [Web.dev Code Splitting](https://web.dev/articles/code-splitting)