# Performance Optimization Guide

This guide covers performance optimization strategies, monitoring setup, and troubleshooting for the Jidelnicek frontend application.

## Table of Contents

1. [Bundle Optimization](#bundle-optimization)
2. [Performance Monitoring](#performance-monitoring)
3. [Request Optimization](#request-optimization)
4. [Performance Scripts](#performance-scripts)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)
7. [CI/CD Integration](#cicd-integration)

## Bundle Optimization

### Vite Configuration

Our Vite configuration includes several optimization strategies:

```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import { VitePWA } from 'vite-plugin-pwa'
```

#### Key Features:

1. **Bundle Visualization**: Generates interactive treemap of bundle composition
2. **Compression**: Automatic gzip and brotli compression
3. **PWA Support**: Service worker for offline functionality and caching
4. **Smart Code Splitting**: Optimized chunk strategy for better caching

### Code Splitting Strategy

```typescript
manualChunks: (id) => {
  if (id.includes('node_modules')) {
    // Vendor chunks by category
    if (id.includes('react')) return 'react-vendor'
    if (id.includes('@radix-ui')) return 'ui-vendor'
    if (id.includes('zustand')) return 'state-vendor'
    // ... more vendor chunks
  }
  
  // Feature-based chunks for app code
  if (id.includes('src/components/auth')) return 'auth'
  if (id.includes('src/components/recipes')) return 'recipes'
  // ... more feature chunks
}
```

### Running Bundle Analysis

```bash
# Generate bundle visualization
npm run bundle:analyze

# Check bundle sizes against limits
npm run bundle:size

# View the visualization
open dist/stats.html
```

### Bundle Size Limits

| Type | Limit | Description |
|------|-------|-------------|
| Total JS | 500 KB | All JavaScript bundles |
| Main Bundle | 200 KB | Initial load JavaScript |
| Vendor Chunks | 300 KB | Third-party libraries |
| Lazy Chunks | 50 KB | Per lazy-loaded chunk |
| Total CSS | 100 KB | All stylesheets |
| Images | 500 KB | Per image file |

## Performance Monitoring

### Web Vitals Monitoring

The application automatically tracks Core Web Vitals:

```typescript
import { initializePerformanceMonitoring } from '@utils/performanceMonitoring'

// Initialize in your app entry point
initializePerformanceMonitoring({
  reportCallback: (metric) => {
    // Send to analytics
    console.log('Performance metric:', metric)
  },
  analyticsEndpoint: '/api/analytics/performance',
  bufferSize: 100
})
```

#### Tracked Metrics:

- **LCP** (Largest Contentful Paint): < 2.5s (good)
- **FID** (First Input Delay): < 100ms (good)
- **CLS** (Cumulative Layout Shift): < 0.1 (good)
- **FCP** (First Contentful Paint): < 1.8s (good)
- **TTFB** (Time to First Byte): < 800ms (good)
- **INP** (Interaction to Next Paint): < 200ms (good)

### Component Performance Tracking

```typescript
import { usePerformanceTracking } from '@utils/performanceMonitoring'

function MyComponent({ data }) {
  // Automatically track render performance
  usePerformanceTracking('MyComponent', { dataSize: data.length })
  
  return <div>{/* Component content */}</div>
}
```

### Custom Performance Marks

```typescript
import { getPerformanceMonitor } from '@utils/performanceMonitoring'

const monitor = getPerformanceMonitor()

// Mark start of operation
monitor.mark('data-fetch-start')

// Perform operation
const data = await fetchData()

// Measure duration
monitor.measure('data-fetch-duration', 'data-fetch-start')
```

### Route Change Tracking

```typescript
import { useRouteTracking } from '@utils/performanceMonitoring'
import { useLocation } from 'react-router-dom'

function App() {
  const location = useLocation()
  useRouteTracking(location.pathname)
  
  return <Routes>{/* Your routes */}</Routes>
}
```

## Request Optimization

### Request Deduplication

Prevents duplicate requests for the same resource:

```typescript
import { useOptimizedFetch } from '@utils/requestOptimization'

function MyComponent() {
  const fetchData = useOptimizedFetch('/api/data', {
    deduplicate: true,
    cacheTTL: 5 * 60 * 1000 // 5 minutes
  })
  
  // Multiple calls will return the same promise
  const data = await fetchData()
}
```

### Request Batching

Batch multiple requests to reduce network overhead:

```typescript
import { useBatchRequests } from '@utils/requestOptimization'

function MyComponent() {
  const batchRequest = useBatchRequests('/api/batch')
  
  // These requests will be batched together
  const [user, posts, comments] = await Promise.all([
    batchRequest({ url: '/api/user/1' }),
    batchRequest({ url: '/api/posts?userId=1' }),
    batchRequest({ url: '/api/comments?userId=1' })
  ])
}
```

### Response Caching

Built-in response caching with TTL:

```typescript
import { getRequestOptimization } from '@utils/requestOptimization'

const optimizer = getRequestOptimization()

// Cached for 5 minutes
const data = await optimizer.fetch('/api/data', {
  cacheTTL: 5 * 60 * 1000,
  skipCache: false
})

// Invalidate cache
optimizer.invalidateCache('/api/data')
```

### Prefetching

Proactive data loading for better perceived performance:

```typescript
import { usePrefetch, usePrefetchOnHover } from '@utils/requestOptimization'

function NavigationLink({ href, apiUrl }) {
  // Prefetch on component mount
  usePrefetch({ url: apiUrl, priority: 'low' })
  
  // Or prefetch on hover
  const hoverProps = usePrefetchOnHover(apiUrl)
  
  return <Link to={href} {...hoverProps}>Navigate</Link>
}
```

### Prefetching Strategies

```typescript
// Prefetch based on user patterns
optimizer.prefetchRoutes([
  '/api/recipes/*',
  '/api/trips/*'
])

// Element-based prefetching
<div data-prefetch="/api/data">
  Content that triggers prefetch when visible
</div>
```

## Performance Scripts

### Available Scripts

```bash
# Analyze bundle composition
npm run bundle:analyze

# Check bundle sizes against limits
npm run bundle:size

# Run performance checks
npm run perf:check

# Run Lighthouse audit
npm run perf:lighthouse
```

### Bundle Analysis

The `bundle:analyze` script generates an interactive visualization:

1. Run `npm run bundle:analyze`
2. Open `dist/stats.html` in your browser
3. Explore the treemap to identify large dependencies
4. Look for optimization opportunities

### Bundle Size Checking

The `bundle:size` script checks all bundles against configured limits:

```bash
$ npm run bundle:size

🔍 Analyzing bundle sizes...

📦 JavaScript Bundles:
────────────────────────────────────────────────
assets/js/index-abc123.js              150.23 KB (gzip: 48.56 KB) ✅
assets/js/react-vendor-def456.js       128.45 KB (gzip: 41.23 KB) ✅
assets/js/recipes-ghi789.js             45.67 KB (gzip: 15.34 KB) ✅
────────────────────────────────────────────────
Total JS: 324.35 KB (gzip: 105.13 KB) / 500.00 KB ✅
```

### Performance Check

The `perf:check` script runs a comprehensive performance analysis:

```bash
$ npm run perf:check

🎯 Frontend Performance Check

🏗️  Checking build performance...
✅ Build completed in: 12.34s (threshold: 30.00s)

🚀 Runtime Performance Analysis:
📊 Bundle visualization available at: dist/stats.html

📦 Bundle Analysis:
──────────────────────────────────────────────────
Total Size: 450.23 KB
Gzipped Size: 145.67 KB
JavaScript: 324.35 KB
CSS: 85.88 KB
Images: 40.00 KB

💡 Performance Recommendations:
✅ No major performance issues detected!
```

## Best Practices

### 1. Code Splitting

```typescript
// Lazy load routes
const RecipesPage = lazy(() => import('./pages/RecipesPage'))

// Lazy load heavy components
const RichTextEditor = lazy(() => import('./components/RichTextEditor'))

// Use Suspense for loading states
<Suspense fallback={<LoadingSpinner />}>
  <RecipesPage />
</Suspense>
```

### 2. Image Optimization

```typescript
// Use optimized image component
import { OptimizedImage } from '@components/performance'

<OptimizedImage
  src="/images/recipe.jpg"
  alt="Recipe"
  width={800}
  height={600}
  loading="lazy"
  formats={['webp', 'avif']}
/>
```

### 3. Memoization

```typescript
// Memoize expensive computations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data)
}, [data])

// Memoize components
const MemoizedList = memo(({ items }) => {
  return items.map(item => <ListItem key={item.id} {...item} />)
})
```

### 4. Virtualization

```typescript
// Use virtual scrolling for long lists
import { VirtualList } from '@components/performance'

<VirtualList
  items={recipes}
  itemHeight={80}
  renderItem={(recipe) => <RecipeCard {...recipe} />}
/>
```

### 5. Debouncing and Throttling

```typescript
// Debounce search input
const debouncedSearch = useMemo(
  () => debounce(searchRecipes, 300),
  []
)

// Throttle scroll events
const throttledScroll = useMemo(
  () => throttle(handleScroll, 100),
  []
)
```

## Troubleshooting

### Common Performance Issues

#### 1. Large Bundle Size

**Symptoms**: Slow initial load, large JavaScript files

**Solutions**:
- Analyze bundle with `npm run bundle:analyze`
- Identify large dependencies
- Consider alternatives or dynamic imports
- Enable tree shaking

#### 2. Slow Route Transitions

**Symptoms**: Lag when navigating between pages

**Solutions**:
- Implement route prefetching
- Use loading states
- Optimize component initialization
- Check for blocking operations

#### 3. Poor Runtime Performance

**Symptoms**: Janky scrolling, slow interactions

**Solutions**:
- Use React DevTools Profiler
- Identify unnecessary re-renders
- Implement memoization
- Use virtualization for long lists

#### 4. Memory Leaks

**Symptoms**: Increasing memory usage over time

**Solutions**:
- Clean up event listeners
- Cancel ongoing requests
- Clear timers and intervals
- Use weak references where appropriate

### Performance Debugging

```typescript
// Enable performance tracking in development
if (process.env.NODE_ENV === 'development') {
  const monitor = getPerformanceMonitor()
  
  // Log metrics every 30 seconds
  setInterval(() => {
    console.log('Performance Summary:', monitor.getSummary())
  }, 30000)
}
```

### Browser DevTools

1. **Performance Tab**: Record and analyze runtime performance
2. **Network Tab**: Monitor request timing and sizes
3. **Coverage Tab**: Find unused JavaScript and CSS
4. **Memory Tab**: Profile memory usage and find leaks

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Check

on:
  pull_request:
    branches: [ main ]

jobs:
  performance:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build project
      run: npm run build
    
    - name: Check bundle size
      run: npm run bundle:size
    
    - name: Run performance check
      run: npm run perf:check
    
    - name: Upload performance report
      uses: actions/upload-artifact@v3
      with:
        name: performance-report
        path: |
          dist/stats.html
          dist/bundle-size-report.json
          performance-report.json
    
    - name: Comment PR with results
      uses: actions/github-script@v6
      if: github.event_name == 'pull_request'
      with:
        script: |
          const fs = require('fs')
          const report = JSON.parse(fs.readFileSync('performance-report.json'))
          
          const comment = `## 📊 Performance Report
          
          **Build Time**: ${report.buildPerformance.buildTime}ms
          **Bundle Size**: Check artifacts for detailed report
          
          ${report.recommendations.length > 0 ? 
            '### ⚠️ Recommendations\n' + 
            report.recommendations.map(r => `- ${r.issue}: ${r.suggestion}`).join('\n')
            : '✅ No performance issues detected!'
          }`
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          })
```

### Lighthouse CI

```yaml
- name: Run Lighthouse CI
  uses: treosh/lighthouse-ci-action@v9
  with:
    urls: |
      http://localhost:3000
      http://localhost:3000/recipes
      http://localhost:3000/trips
    budgetPath: ./lighthouse-budget.json
    uploadArtifacts: true
    temporaryPublicStorage: true
```

### Performance Budgets

Create `lighthouse-budget.json`:

```json
[
  {
    "path": "/*",
    "timings": [
      {
        "metric": "interactive",
        "budget": 3000
      },
      {
        "metric": "first-contentful-paint",
        "budget": 1800
      }
    ],
    "resourceSizes": [
      {
        "resourceType": "script",
        "budget": 500
      },
      {
        "resourceType": "stylesheet",
        "budget": 100
      },
      {
        "resourceType": "total",
        "budget": 1000
      }
    ],
    "resourceCounts": [
      {
        "resourceType": "third-party",
        "budget": 10
      }
    ]
  }
]
```

## Monitoring in Production

### Real User Monitoring (RUM)

```typescript
// Initialize RUM in production
if (process.env.NODE_ENV === 'production') {
  initializePerformanceMonitoring({
    analyticsEndpoint: process.env.VITE_ANALYTICS_ENDPOINT,
    reportCallback: (metric) => {
      // Send to your analytics service
      analytics.track('performance_metric', metric)
    },
    bufferSize: 50
  })
}
```

### Custom Analytics Integration

```typescript
// Example: Google Analytics 4
import { trackApiCall } from '@utils/performanceMonitoring'

// Wrap API calls
const fetchRecipes = () => {
  return trackApiCall('/api/recipes', 'GET', async () => {
    const response = await fetch('/api/recipes')
    return response.json()
  })
}
```

### Performance Dashboards

Consider integrating with:
- Google Analytics
- Sentry Performance Monitoring
- DataDog RUM
- New Relic Browser
- Custom analytics solution

## Conclusion

Performance optimization is an ongoing process. Regular monitoring, analysis, and optimization ensure the best user experience. Use the tools and practices outlined in this guide to maintain high performance standards for the Jidelnicek application.