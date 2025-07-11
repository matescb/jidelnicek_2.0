# Route Transitions and Loading States

This module provides comprehensive route transition animations and loading states for the application.

## Basic Usage

### 1. Wrap your router with RouteTransition

```tsx
import { RouteTransition } from '@/routes/transitions';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <RouteTransition mode="fade" showProgress>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/trips" element={<Trips />} />
      </Routes>
    </RouteTransition>
  );
}
```

### 2. Page-level transitions

```tsx
import { PageTransition } from '@/routes/transitions';

function RecipesPage() {
  return (
    <PageTransition>
      <div className="container mx-auto p-6">
        <h1>Recipes</h1>
        {/* Page content */}
      </div>
    </PageTransition>
  );
}
```

### 3. Loading states

```tsx
import { useLoadingState, ComponentLoader, ListSkeleton } from '@/routes/transitions';

function RecipesList() {
  const [isLoading, setIsLoading] = useState(true);
  const showLoading = useLoadingState(isLoading, { delay: 200, minimum: 500 });

  if (showLoading) {
    return <ListSkeleton items={5} showImage />;
  }

  return <RecipeItems />;
}
```

### 4. Progress bar control

```tsx
import { useProgressBar } from '@/routes/transitions';

function DataFetcher() {
  const { start, setProgress, complete } = useProgressBar();

  const fetchData = async () => {
    start();
    
    try {
      setProgress(30);
      await fetchStep1();
      
      setProgress(60);
      await fetchStep2();
      
      setProgress(90);
      await fetchStep3();
      
      complete();
    } catch (error) {
      complete();
    }
  };
}
```

### 5. Error boundaries

```tsx
import { RouteErrorBoundary } from '@/routes/transitions';

function RiskyComponent() {
  return (
    <RouteErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Component error:', error);
      }}
    >
      <YourComponent />
    </RouteErrorBoundary>
  );
}
```

### 6. Progressive loading

```tsx
import { useProgressiveLoading, ProgressiveSkeleton } from '@/routes/transitions';

function Dashboard() {
  const { header, content, sidebar } = useProgressiveLoading(1000);

  if (!content) {
    return (
      <ProgressiveSkeleton
        showHeader={header}
        showContent={content}
        showSidebar={sidebar}
      />
    );
  }

  return <DashboardContent />;
}
```

### 7. Custom transitions

```tsx
import { createCustomTransition } from '@/routes/transitions';

const customTransition = createCustomTransition(
  { opacity: 0, x: -50 },
  { opacity: 1, x: 0 },
  { duration: 0.5, ease: 'easeOut' }
);

<motion.div variants={customTransition}>
  Content
</motion.div>
```

## Available Transition Modes

- `fade` - Simple fade in/out
- `slide` - Slide from right to left
- `scale` - Scale up/down with fade
- `none` - No transition animation

## Hooks Reference

- `useProgressBar()` - Control global progress bar
- `useRouteTransition()` - Track route transitions
- `useLoadingState()` - Delayed loading states
- `useProgressiveLoading()` - Sequential loading
- `useAnimatedListLoading()` - Staggered list animations
- `useRoutePrefetch()` - Prefetch route components

## Loading Components

- `PageSkeleton` - Full page skeleton
- `ComponentLoader` - Spinning loader
- `ProgressiveSkeleton` - Progressive page load
- `ListSkeleton` - List placeholder
- `CardSkeleton` - Card placeholder
- `TableSkeleton` - Table placeholder
- `FormSkeleton` - Form placeholder

## Progress Indicators

- `ProgressBar` - Top navigation progress
- `ManualProgressBar` - Controlled progress
- `IndeterminateProgressBar` - Unknown duration
- `CircularProgress` - Circular indicator
- `StepProgress` - Multi-step progress