# Loading Components Library

A comprehensive collection of loading components built with React, Framer Motion, and Tailwind CSS.

## Components

### 1. Spinner

Base spinner component with multiple variants and customization options.

```tsx
import { Spinner } from '@/components/ui/loading'

// Basic usage
<Spinner />

// With variants
<Spinner variant="dots" size="lg" color="primary" />
<Spinner variant="bars" speed="fast" />
<Spinner variant="pulse" showLabel label="Loading data..." />
```

**Props:**
- `variant`: 'circle' | 'dots' | 'bars' | 'pulse'
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- `color`: 'primary' | 'secondary' | 'destructive' | 'success' | 'warning' | 'current'
- `speed`: 'slow' | 'normal' | 'fast'
- `label`: string (for accessibility)
- `showLabel`: boolean

### 2. LoadingOverlay

Full-screen loading overlay with backdrop.

```tsx
import { LoadingOverlay } from '@/components/ui/loading'

<LoadingOverlay
  isOpen={isLoading}
  message="Processing your request..."
  progress={75}
  onCancel={() => setIsLoading(false)}
  variant="blur"
/>
```

**Props:**
- `isOpen`: boolean
- `message`: string
- `progress`: number (0-100)
- `onCancel`: () => void
- `variant`: 'default' | 'blur' | 'dark'
- `spinnerVariant`: spinner variant type

### 3. LoadingButton

Button component with integrated loading states.

```tsx
import { LoadingButton } from '@/components/ui/loading'

<LoadingButton
  isLoading={isSubmitting}
  isSuccess={isSuccess}
  isError={isError}
  loadingText="Saving..."
  successText="Saved!"
  errorText="Failed"
  onClick={handleSubmit}
>
  Save Changes
</LoadingButton>
```

**Props:**
- All Button props
- `isLoading`: boolean
- `loadingText`: string
- `isSuccess`: boolean
- `successText`: string
- `isError`: boolean
- `errorText`: string
- `showIcon`: boolean
- `spinnerVariant`: spinner variant type

### 4. InfiniteLoader

Intersection Observer-based infinite scroll loader.

```tsx
import { InfiniteLoader } from '@/components/ui/loading'

<InfiniteLoader
  hasMore={hasMorePages}
  isLoading={isLoadingMore}
  onLoadMore={loadNextPage}
  endMessage="You've reached the end!"
/>
```

**Props:**
- `hasMore`: boolean
- `isLoading`: boolean
- `isError`: boolean
- `onLoadMore`: () => void
- `onRetry`: () => void
- `threshold`: number (intersection threshold)
- `rootMargin`: string
- `loadingMessage`: string
- `endMessage`: string
- `errorMessage`: string

### 5. LoadingDots

Animated dots for typing indicators and subtle loading states.

```tsx
import { LoadingDots, TypingIndicator } from '@/components/ui/loading'

// Basic dots
<LoadingDots size="md" color="secondary" />

// Chat typing indicator
<TypingIndicator userName="Alice" />

// Bubble variant
<LoadingDots variant="bubble" />
```

**Props:**
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- `variant`: 'default' | 'bubble'
- `color`: color variants
- `duration`: number (animation duration)
- `dotCount`: number

### 6. ProgressRing

Circular progress indicator with percentage display.

```tsx
import { ProgressRing } from '@/components/ui/loading'

// Determinate progress
<ProgressRing value={75} max={100} size="lg" />

// Indeterminate progress
<ProgressRing isIndeterminate />

// With checkmark on completion
<ProgressRing value={100} showCheckmark />
```

**Props:**
- `value`: number
- `max`: number
- `isIndeterminate`: boolean
- `showPercentage`: boolean
- `showCheckmark`: boolean
- `strokeWidth`: number
- `size`: size variants
- `color`: color variants
- `label`: string

### 7. LoadingStates

Collection of common loading patterns and state handlers.

```tsx
import { 
  ContentLoader, 
  ErrorState, 
  EmptyState,
  ErrorBoundary,
  AsyncComponent 
} from '@/components/ui/loading'

// Content loader wrapper
<ContentLoader
  isLoading={isLoading}
  isError={isError}
  isEmpty={data.length === 0}
  onRetry={refetch}
>
  <YourContent data={data} />
</ContentLoader>

// Error boundary
<ErrorBoundary
  fallback={<ErrorState message="Something went wrong" />}
  onError={(error, errorInfo) => console.error(error)}
>
  <YourComponent />
</ErrorBoundary>

// Async component wrapper
<AsyncComponent
  fallback={<SuspenseFallback message="Loading component..." />}
>
  <LazyLoadedComponent />
</AsyncComponent>
```

## Usage Examples

### Basic Loading State

```tsx
const [isLoading, setIsLoading] = useState(false)

const handleAction = async () => {
  setIsLoading(true)
  try {
    await someAsyncOperation()
  } finally {
    setIsLoading(false)
  }
}

return (
  <div>
    {isLoading ? <Spinner /> : <Content />}
  </div>
)
```

### Form Submission with Feedback

```tsx
const [submitState, setSubmitState] = useState('idle')

const handleSubmit = async (data) => {
  setSubmitState('loading')
  try {
    await submitForm(data)
    setSubmitState('success')
    setTimeout(() => setSubmitState('idle'), 2000)
  } catch (error) {
    setSubmitState('error')
    setTimeout(() => setSubmitState('idle'), 3000)
  }
}

return (
  <LoadingButton
    isLoading={submitState === 'loading'}
    isSuccess={submitState === 'success'}
    isError={submitState === 'error'}
    onClick={handleSubmit}
  >
    Submit
  </LoadingButton>
)
```

### Infinite Scroll Implementation

```tsx
const [items, setItems] = useState([])
const [page, setPage] = useState(1)
const [hasMore, setHasMore] = useState(true)
const [isLoading, setIsLoading] = useState(false)

const loadMore = async () => {
  setIsLoading(true)
  try {
    const newItems = await fetchItems(page)
    setItems(prev => [...prev, ...newItems])
    setPage(prev => prev + 1)
    setHasMore(newItems.length > 0)
  } catch (error) {
    console.error(error)
  } finally {
    setIsLoading(false)
  }
}

return (
  <div>
    {items.map(item => <ItemCard key={item.id} {...item} />)}
    <InfiniteLoader
      hasMore={hasMore}
      isLoading={isLoading}
      onLoadMore={loadMore}
    />
  </div>
)
```

## Animations

All components use Framer Motion for smooth animations:
- Fade in/out transitions
- Scale animations
- Staggered animations for multiple elements
- Customizable animation duration and easing

## Accessibility

- All spinners include proper ARIA labels
- Loading states are announced to screen readers
- Keyboard navigation support where applicable
- Color contrast compliant with WCAG guidelines

## Performance

- Optimized animations using CSS transforms
- Minimal re-renders through proper React patterns
- Intersection Observer for efficient infinite scrolling
- Automatic cleanup of animations and observers