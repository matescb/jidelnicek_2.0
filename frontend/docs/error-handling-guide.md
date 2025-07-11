# Error Handling Guide

## Overview

The Jidelnicek application implements a comprehensive error handling system that provides graceful error recovery, user-friendly error messages, and detailed logging for debugging. This guide covers the architecture, components, and best practices for handling errors throughout the application.

## Architecture

### Error Handling Layers

1. **Component-Level Error Boundaries**: Catch errors in individual components
2. **Section-Level Error Boundaries**: Isolate errors in page sections
3. **Page-Level Error Boundaries**: Handle entire page failures
4. **Global Error Handling**: Application-wide error management
5. **Network Error Handling**: Specific handling for network issues
6. **Offline Support**: Queue management and sync recovery

### Key Components

```
Error Handling System
├── Components
│   ├── ErrorBoundary (base)
│   ├── RouteErrorBoundary
│   ├── AsyncErrorBoundary
│   ├── FormErrorBoundary
│   ├── DataErrorBoundary
│   └── ImageErrorBoundary
├── Services
│   ├── errorLogger
│   ├── errorRecovery
│   └── networkMonitor
├── Hooks
│   └── useErrorRecovery
└── Utilities
    └── errorHelpers
```

## Using Error Boundaries

### Basic Error Boundary

Wrap components that might throw errors:

```tsx
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

function MyApp() {
  return (
    <ErrorBoundary level="page">
      <MyComponent />
    </ErrorBoundary>
  );
}
```

### Specialized Error Boundaries

#### Route Error Boundary

For route-level error handling:

```tsx
import { RouteErrorBoundary } from '@/components/errors/RouteErrorBoundary';

function AppRoutes() {
  return (
    <RouteErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipes" element={<Recipes />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
```

#### Async Error Boundary

For components with async operations:

```tsx
import { AsyncErrorBoundary } from '@/components/errors/AsyncErrorBoundary';

function DataComponent() {
  return (
    <AsyncErrorBoundary
      fallback={<LoadingSpinner />}
      onRetry={refetchData}
    >
      <AsyncDataLoader />
    </AsyncErrorBoundary>
  );
}
```

#### Form Error Boundary

For form-specific error handling:

```tsx
import { FormErrorBoundary } from '@/components/errors/FormErrorBoundary';

function RecipeForm() {
  return (
    <FormErrorBoundary
      onValidationError={handleValidationError}
      preserveFormState
    >
      <RecipeFormFields />
    </FormErrorBoundary>
  );
}
```

#### Data Error Boundary

For data fetching components:

```tsx
import { DataErrorBoundary } from '@/components/errors/DataErrorBoundary';

function RecipeList() {
  return (
    <DataErrorBoundary
      onRetry={refetch}
      offlineSupport
      cacheKey="recipes"
    >
      <RecipeListContent />
    </DataErrorBoundary>
  );
}
```

#### Image Error Boundary

For image loading:

```tsx
import { ImageErrorBoundary } from '@/components/errors/ImageErrorBoundary';

function RecipeImage({ src, alt }) {
  return (
    <ImageErrorBoundary
      fallbackSrc="/images/placeholder.png"
      onError={logImageError}
    >
      <img src={src} alt={alt} />
    </ImageErrorBoundary>
  );
}
```

### Error Boundary Props

| Prop | Type | Description |
|------|------|-------------|
| `level` | `'page' \| 'section' \| 'component'` | Error boundary scope |
| `fallback` | `ReactNode` | Custom fallback UI |
| `onError` | `(error, errorInfo) => void` | Error callback |
| `resetKeys` | `Array<string \| number>` | Dependencies that trigger reset |
| `resetOnPropsChange` | `boolean` | Reset on prop changes |
| `isolate` | `boolean` | Isolate from parent error context |
| `showDetails` | `boolean` | Show error details in development |
| `enableRecovery` | `boolean` | Enable automatic recovery |
| `customErrorComponent` | `Component` | Custom error UI component |

## Recovery Strategies

### Automatic Recovery

The system implements several automatic recovery strategies:

#### 1. Retry with Exponential Backoff

```tsx
import { useErrorRecovery } from '@/hooks/useErrorRecovery';

function DataFetcher() {
  const { retry } = useErrorRecovery({
    strategy: RetryStrategy.EXPONENTIAL,
    maxAttempts: 3,
    initialDelay: 1000
  });

  const fetchData = async () => {
    try {
      const data = await api.getData();
      return data;
    } catch (error) {
      return retry(() => api.getData());
    }
  };
}
```

#### 2. Circuit Breaker Pattern

```tsx
import { useErrorRecovery } from '@/hooks/useErrorRecovery';

function ApiClient() {
  const { retry } = useErrorRecovery({
    circuitBreakerKey: 'api-endpoint',
    maxAttempts: 5
  });

  const callApi = async () => {
    return retry(() => api.riskyOperation());
  };
}
```

#### 3. Offline Queue Management

```tsx
import { useOfflineQueue } from '@/hooks/useErrorRecovery';

function OfflineCapableForm() {
  const { queueRequest, syncNow } = useOfflineQueue({
    autoSync: true,
    priority: 1
  });

  const submitForm = async (data) => {
    try {
      await api.submitData(data);
    } catch (error) {
      if (isNetworkError(error)) {
        queueRequest('/api/submit', 'POST', headers, data);
      }
    }
  };
}
```

### Manual Recovery

Users can manually trigger recovery through:

1. **Retry Buttons**: For retryable errors
2. **Refresh Page**: For unrecoverable component errors
3. **Go Home**: Navigate to a safe state
4. **Clear Cache**: For data consistency issues

## Network Error Handling

### Network Monitoring

```tsx
import { useNetworkStatus } from '@/hooks/useErrorRecovery';

function NetworkAwareComponent() {
  const { isOnline, quality, checkConnection } = useNetworkStatus({
    onOffline: () => saveToLocalStorage(),
    onOnline: () => syncWithServer(),
    showToast: true
  });

  if (!isOnline) {
    return <OfflineMode />;
  }

  if (quality === ConnectionQuality.SLOW) {
    return <ReducedQualityMode />;
  }

  return <FullFeatureMode />;
}
```

### Handling Different Network Conditions

#### Offline Mode

```tsx
function OfflineCapableList() {
  const { isOnline } = useNetworkStatus();
  const { data, isLoading } = useQuery('items', fetchItems, {
    enabled: isOnline,
    staleTime: Infinity // Use cached data when offline
  });

  return (
    <div>
      {!isOnline && <OfflineBanner />}
      <ItemList items={data || getCachedItems()} />
    </div>
  );
}
```

#### Slow Connection

```tsx
function AdaptiveImageGallery() {
  const { quality } = useNetworkStatus();

  const imageQuality = quality === ConnectionQuality.SLOW ? 'low' : 'high';

  return (
    <ImageGrid
      images={images}
      quality={imageQuality}
      lazyLoad={quality !== ConnectionQuality.FAST}
    />
  );
}
```

## Best Practices

### 1. Error Boundary Placement

```tsx
// ✅ Good: Multiple levels of error boundaries
<RouteErrorBoundary>
  <PageLayout>
    <ErrorBoundary level="section">
      <Sidebar />
    </ErrorBoundary>
    <ErrorBoundary level="section">
      <MainContent>
        <ErrorBoundary level="component">
          <RiskyComponent />
        </ErrorBoundary>
      </MainContent>
    </ErrorBoundary>
  </PageLayout>
</RouteErrorBoundary>

// ❌ Bad: Single error boundary for everything
<ErrorBoundary>
  <EntireApp />
</ErrorBoundary>
```

### 2. Error Classification

```tsx
// ✅ Good: Specific error handling
try {
  await api.call();
} catch (error) {
  const { type, isRetryable } = classifyError(error);
  
  switch (type) {
    case ErrorType.NETWORK_ERROR:
      handleNetworkError(error);
      break;
    case ErrorType.VALIDATION_ERROR:
      showValidationErrors(error);
      break;
    case ErrorType.TOKEN_EXPIRED:
      redirectToLogin();
      break;
    default:
      showGenericError(error);
  }
}

// ❌ Bad: Generic error handling
try {
  await api.call();
} catch (error) {
  alert('An error occurred');
}
```

### 3. User-Friendly Messages

```tsx
// ✅ Good: Context-aware messages
const { title, message, action } = getUserFriendlyMessage(error);
showError({
  title, // "Unable to Load Recipes"
  message, // "We're having trouble connecting to our servers."
  action, // "Try Again"
  suggestions: getRecoverySuggestions(error)
});

// ❌ Bad: Technical error messages
showError({
  message: error.stack // "TypeError: Cannot read property..."
});
```

### 4. Error Logging

```tsx
// ✅ Good: Comprehensive logging
errorLogger.logError(error, ErrorSeverity.HIGH, errorInfo, {
  userId: currentUser.id,
  action: 'recipe.create',
  metadata: {
    recipeData: sanitizeForLogging(formData)
  }
});

// ❌ Bad: Console.error only
console.error(error);
```

### 5. Recovery Actions

```tsx
// ✅ Good: Multiple recovery options
<ErrorBoundary
  enableRecovery
  customErrorComponent={({ error, retry, reset }) => (
    <ErrorCard>
      <h3>{getUserFriendlyMessage(error).title}</h3>
      <p>{getUserFriendlyMessage(error).message}</p>
      <div className="actions">
        {isRetryableError(error) && (
          <Button onClick={retry}>Try Again</Button>
        )}
        <Button onClick={reset} variant="secondary">
          Reset
        </Button>
        <Link to="/">Go Home</Link>
      </div>
      <RecoverySuggestions error={error} />
    </ErrorCard>
  )}
/>

// ❌ Bad: No recovery options
<ErrorBoundary fallback={<div>Error occurred</div>} />
```

## Common Patterns

### Loading States with Error Handling

```tsx
function DataLoader() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    fetchData()
      .then(data => setState({ data, loading: false, error: null }))
      .catch(error => setState({ data: null, loading: false, error }));
  }, []);

  if (state.loading) return <LoadingSpinner />;
  if (state.error) return <ErrorState error={state.error} onRetry={retry} />;
  if (!state.data) return <EmptyState />;
  
  return <DataDisplay data={state.data} />;
}
```

### Form Submission with Error Recovery

```tsx
function RecipeForm() {
  const { retry } = useRetry();
  const { queueRequest } = useOfflineQueue();
  const { isOnline } = useNetworkStatus();

  const handleSubmit = async (values) => {
    try {
      if (!isOnline) {
        queueRequest('/api/recipes', 'POST', headers, values);
        showToast('Recipe will be saved when you're back online');
        return;
      }

      await retry(() => api.createRecipe(values));
      showToast('Recipe created successfully');
      navigate('/recipes');
    } catch (error) {
      if (isValidationError(error)) {
        setFieldErrors(error.fields);
      } else {
        showError(getUserFriendlyMessage(error));
      }
    }
  };

  return (
    <FormErrorBoundary>
      <form onSubmit={handleSubmit}>
        {/* form fields */}
      </form>
    </FormErrorBoundary>
  );
}
```

### Async Component Error Handling

```tsx
function AsyncRecipeList() {
  return (
    <AsyncErrorBoundary
      fallback={<RecipeListSkeleton />}
      errorFallback={<ErrorState />}
    >
      <Suspense fallback={<RecipeListSkeleton />}>
        <RecipeListAsync />
      </Suspense>
    </AsyncErrorBoundary>
  );
}
```

## Error Types Reference

| Error Type | Description | Recovery Strategy |
|------------|-------------|-------------------|
| `NETWORK_ERROR` | Network connectivity issues | Retry with backoff, queue offline |
| `TIMEOUT_ERROR` | Request timeout | Retry with longer timeout |
| `SERVER_ERROR` | 5xx server errors | Retry with exponential backoff |
| `CLIENT_ERROR` | 4xx client errors | Show validation, no retry |
| `VALIDATION_ERROR` | Input validation failures | Show field errors |
| `AUTH_ERROR` | Authentication failures | Redirect to login |
| `TOKEN_EXPIRED` | JWT expiration | Refresh token or re-login |
| `INSUFFICIENT_PERMISSIONS` | Authorization failures | Show permission message |
| `RATE_LIMIT` | Too many requests | Retry with delay |
| `OFFLINE_ERROR` | No network connection | Queue for sync |
| `UNKNOWN_ERROR` | Unclassified errors | Show generic message |

## Testing Error Scenarios

### Component Testing

```tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

test('displays error UI when child throws', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

### Integration Testing

```tsx
test('retries failed network requests', async () => {
  const mockApi = jest.fn()
    .mockRejectedValueOnce(new NetworkError())
    .mockResolvedValueOnce({ data: 'success' });

  const { result } = renderHook(() => useRetry());

  const data = await result.current.retry(mockApi);

  expect(mockApi).toHaveBeenCalledTimes(2);
  expect(data).toEqual({ data: 'success' });
});
```

## Monitoring and Analytics

### Error Tracking

The error logger automatically tracks:
- Error frequency and patterns
- Recovery success rates
- User impact metrics
- Performance degradation

### Custom Error Events

```tsx
errorLogger.logError(error, ErrorSeverity.HIGH, errorInfo, {
  userId: user.id,
  action: 'recipe.create',
  metadata: {
    formData: sanitizeData(formData),
    validationErrors: error.validationErrors
  }
});
```

## Migration Guide

For existing components without error handling:

1. Identify error-prone operations
2. Wrap in appropriate error boundaries
3. Add retry logic for network calls
4. Implement offline support where needed
5. Add user-friendly error messages
6. Test error scenarios

Example migration:

```tsx
// Before
function RecipeList() {
  const [recipes, setRecipes] = useState([]);
  
  useEffect(() => {
    fetch('/api/recipes')
      .then(res => res.json())
      .then(setRecipes);
  }, []);
  
  return <div>{recipes.map(r => <Recipe key={r.id} {...r} />)}</div>;
}

// After
function RecipeList() {
  const { retry } = useRetry();
  const { isOnline } = useNetworkStatus();
  
  const { data: recipes, error, isLoading } = useQuery(
    'recipes',
    () => retry(() => api.getRecipes()),
    { enabled: isOnline }
  );
  
  if (isLoading) return <RecipeListSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!recipes?.length) return <EmptyState />;
  
  return (
    <DataErrorBoundary>
      <div>{recipes.map(r => <Recipe key={r.id} {...r} />)}</div>
    </DataErrorBoundary>
  );
}
```