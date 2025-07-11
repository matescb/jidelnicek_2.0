# Error Handling API Reference

## Components

### ErrorBoundary

Base error boundary component for catching and handling React errors.

```tsx
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | - | Child components to wrap |
| `fallback` | `ReactNode` | - | Custom fallback UI |
| `onError` | `(error: Error, errorInfo: ErrorInfo) => void` | - | Error callback |
| `resetKeys` | `Array<string \| number>` | - | Dependencies that trigger reset |
| `resetOnPropsChange` | `boolean` | `false` | Reset on prop changes |
| `isolate` | `boolean` | `false` | Isolate from parent error context |
| `level` | `'page' \| 'section' \| 'component'` | `'component'` | Error boundary scope |
| `showDetails` | `boolean` | `NODE_ENV === 'development'` | Show error details |
| `enableRecovery` | `boolean` | `false` | Enable automatic recovery |
| `customErrorComponent` | `React.ComponentType<ErrorComponentProps>` | - | Custom error UI |

#### Example

```tsx
<ErrorBoundary
  level="section"
  onError={(error, errorInfo) => {
    console.error('Section error:', error);
  }}
  resetKeys={[userId]}
  enableRecovery
>
  <UserProfile userId={userId} />
</ErrorBoundary>
```

### RouteErrorBoundary

Specialized error boundary for route-level errors with navigation recovery.

```tsx
import { RouteErrorBoundary } from '@/components/errors/RouteErrorBoundary';
```

#### Props

Extends `ErrorBoundary` props with:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `redirectTo` | `string` | `'/'` | Redirect path on unrecoverable errors |
| `preserveQuery` | `boolean` | `true` | Preserve query params on redirect |
| `onNavigationError` | `(error: Error) => void` | - | Navigation error callback |

#### Example

```tsx
<RouteErrorBoundary
  redirectTo="/dashboard"
  onNavigationError={(error) => {
    trackNavigationError(error);
  }}
>
  <Outlet />
</RouteErrorBoundary>
```

### AsyncErrorBoundary

Error boundary for components with asynchronous operations.

```tsx
import { AsyncErrorBoundary } from '@/components/errors/AsyncErrorBoundary';
```

#### Props

Extends `ErrorBoundary` props with:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onRetry` | `() => Promise<void>` | - | Async retry function |
| `retryDelay` | `number` | `1000` | Delay before retry (ms) |
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `loadingFallback` | `ReactNode` | - | Loading state UI |
| `errorFallback` | `ReactNode` | - | Error state UI |

#### Example

```tsx
<AsyncErrorBoundary
  onRetry={async () => {
    await refetchData();
  }}
  maxRetries={5}
  loadingFallback={<Skeleton />}
  errorFallback={<ErrorMessage />}
>
  <AsyncDataComponent />
</AsyncErrorBoundary>
```

### FormErrorBoundary

Error boundary optimized for form handling with validation support.

```tsx
import { FormErrorBoundary } from '@/components/errors/FormErrorBoundary';
```

#### Props

Extends `ErrorBoundary` props with:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onValidationError` | `(errors: ValidationError[]) => void` | - | Validation error handler |
| `preserveFormState` | `boolean` | `true` | Preserve form data on error |
| `validationMode` | `'onChange' \| 'onBlur' \| 'onSubmit'` | `'onSubmit'` | Validation trigger |
| `scrollToError` | `boolean` | `true` | Auto-scroll to first error |

#### Example

```tsx
<FormErrorBoundary
  onValidationError={(errors) => {
    setFieldErrors(errors);
  }}
  preserveFormState
  scrollToError
>
  <RecipeForm />
</FormErrorBoundary>
```

### DataErrorBoundary

Error boundary for data fetching components with offline support.

```tsx
import { DataErrorBoundary } from '@/components/errors/DataErrorBoundary';
```

#### Props

Extends `ErrorBoundary` props with:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `cacheKey` | `string` | - | Cache key for offline data |
| `offlineSupport` | `boolean` | `true` | Enable offline mode |
| `staleTime` | `number` | `300000` | Cache stale time (ms) |
| `onRetry` | `() => Promise<void>` | - | Data refetch function |
| `emptyFallback` | `ReactNode` | - | Empty state UI |

#### Example

```tsx
<DataErrorBoundary
  cacheKey="recipes"
  offlineSupport
  staleTime={600000}
  onRetry={refetchRecipes}
  emptyFallback={<EmptyRecipes />}
>
  <RecipeList />
</DataErrorBoundary>
```

### ImageErrorBoundary

Error boundary for image loading with fallback support.

```tsx
import { ImageErrorBoundary } from '@/components/errors/ImageErrorBoundary';
```

#### Props

Extends `ErrorBoundary` props with:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fallbackSrc` | `string` | - | Fallback image URL |
| `onImageError` | `(src: string, error: Error) => void` | - | Image error callback |
| `retryAttempts` | `number` | `1` | Image load retry attempts |
| `placeholderComponent` | `ReactNode` | - | Loading placeholder |

#### Example

```tsx
<ImageErrorBoundary
  fallbackSrc="/images/placeholder.jpg"
  onImageError={(src, error) => {
    logImageError(src, error);
  }}
  retryAttempts={2}
>
  <img src={recipe.image} alt={recipe.title} />
</ImageErrorBoundary>
```

## Error UI Components

### ErrorState

Generic error state component.

```tsx
import { ErrorState } from '@/components/errors/states/ErrorState';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `Error` | - | Error object |
| `title` | `string` | Auto-generated | Error title |
| `message` | `string` | Auto-generated | Error message |
| `onRetry` | `() => void` | - | Retry callback |
| `onDismiss` | `() => void` | - | Dismiss callback |
| `showDetails` | `boolean` | `false` | Show error details |
| `suggestions` | `string[]` | Auto-generated | Recovery suggestions |

### NetworkError

Network-specific error component.

```tsx
import { NetworkError } from '@/components/errors/states/NetworkError';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `Error` | - | Network error |
| `isOffline` | `boolean` | Auto-detected | Offline state |
| `onRetry` | `() => void` | - | Retry callback |
| `onGoOffline` | `() => void` | - | Switch to offline mode |

### ValidationError

Form validation error component.

```tsx
import { ValidationError } from '@/components/errors/states/ValidationError';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `errors` | `ValidationError[]` | - | Validation errors |
| `fields` | `string[]` | - | Error field names |
| `onFix` | `(field: string) => void` | - | Fix field callback |
| `inline` | `boolean` | `false` | Inline display mode |

### LoadingError

Loading error with retry.

```tsx
import { LoadingError } from '@/components/errors/states/LoadingError';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `resource` | `string` | - | Resource name |
| `onRetry` | `() => void` | - | Retry callback |
| `retrying` | `boolean` | `false` | Retry in progress |

### EmptyState

Empty data state component.

```tsx
import { EmptyState } from '@/components/errors/states/EmptyState';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Empty state title |
| `message` | `string` | - | Empty state message |
| `icon` | `ReactNode` | - | Custom icon |
| `action` | `ReactNode` | - | Action button |

## Error Notifications

### ErrorToast

Toast notification for errors.

```tsx
import { ErrorToast } from '@/components/errors/notifications/ErrorToast';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `Error` | - | Error object |
| `duration` | `number` | `5000` | Display duration (ms) |
| `position` | `ToastPosition` | `'bottom-right'` | Toast position |
| `dismissible` | `boolean` | `true` | Can be dismissed |

### ErrorBanner

Banner notification for errors.

```tsx
import { ErrorBanner } from '@/components/errors/notifications/ErrorBanner';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `Error` | - | Error object |
| `fixed` | `boolean` | `false` | Fixed position |
| `dismissible` | `boolean` | `true` | Can be dismissed |
| `actions` | `ReactNode` | - | Action buttons |

### ErrorAlert

Alert dialog for errors.

```tsx
import { ErrorAlert } from '@/components/errors/notifications/ErrorAlert';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `Error` | - | Error object |
| `severity` | `'info' \| 'warning' \| 'error'` | `'error'` | Alert severity |
| `closable` | `boolean` | `true` | Can be closed |
| `onClose` | `() => void` | - | Close callback |

### ErrorModal

Modal dialog for errors.

```tsx
import { ErrorModal } from '@/components/errors/notifications/ErrorModal';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | - | Modal open state |
| `error` | `Error` | - | Error object |
| `onClose` | `() => void` | - | Close callback |
| `onRetry` | `() => void` | - | Retry callback |
| `showDetails` | `boolean` | `false` | Show error details |

## Hooks

### useErrorRecovery

Main hook for error recovery functionality.

```tsx
import { useErrorRecovery } from '@/hooks/useErrorRecovery';
```

#### Returns

```tsx
{
  // Retry functionality
  retry: <T>(operation: () => Promise<T>) => Promise<T>;
  isRetrying: boolean;
  attempt: number;
  lastError: Error | null;
  reset: () => void;
}
```

#### Options

```tsx
interface UseRetryOptions {
  maxAttempts?: number;
  strategy?: RetryStrategy;
  initialDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
  backoffMultiplier?: number;
  onSuccess?: (result: any) => void;
  onError?: (error: Error, attempts: number) => void;
  showToast?: boolean;
  circuitBreakerKey?: string;
}
```

#### Example

```tsx
const { retry, isRetrying, lastError } = useErrorRecovery({
  maxAttempts: 3,
  strategy: RetryStrategy.EXPONENTIAL,
  onError: (error, attempts) => {
    console.error(`Failed after ${attempts} attempts:`, error);
  }
});

const fetchData = async () => {
  try {
    const data = await retry(() => api.getData());
    return data;
  } catch (error) {
    // All retries failed
    handleError(error);
  }
};
```

### useOfflineQueue

Hook for managing offline request queue.

```tsx
import { useOfflineQueue } from '@/hooks/useErrorRecovery';
```

#### Returns

```tsx
{
  queueRequest: (url: string, method: string, headers: Record<string, string>, body?: any) => string;
  syncNow: () => Promise<void>;
  clearQueue: () => void;
  resolveConflict: (conflictId: string, resolution: 'local' | 'server' | 'merge', mergedData?: any) => Promise<void>;
  queueSize: number;
  syncStatus: SyncStatus;
  isSyncing: boolean;
  conflicts: Conflict[];
}
```

#### Example

```tsx
const { queueRequest, syncNow, queueSize } = useOfflineQueue({
  autoSync: true,
  showToast: true
});

const submitForm = async (data) => {
  if (!navigator.onLine) {
    queueRequest('/api/submit', 'POST', headers, data);
    return;
  }
  
  await api.submit(data);
};
```

### useNetworkStatus

Hook for monitoring network status.

```tsx
import { useNetworkStatus } from '@/hooks/useErrorRecovery';
```

#### Returns

```tsx
{
  status: NetworkStatus;
  quality: ConnectionQuality;
  isOnline: boolean;
  networkInfo: NetworkInfo;
  checkConnection: () => Promise<NetworkInfo>;
}
```

#### Example

```tsx
const { isOnline, quality } = useNetworkStatus({
  onOnline: () => syncData(),
  onOffline: () => saveLocally(),
  showToast: true
});

if (!isOnline) {
  return <OfflineUI />;
}
```

### useRecoveryStrategy

Hook for managing error recovery strategies.

```tsx
import { useRecoveryStrategy } from '@/hooks/useErrorRecovery';
```

#### Returns

```tsx
{
  recover: <T>(operation: () => Promise<T>, error?: Error) => Promise<T | null>;
  resetRecovery: () => void;
  getRecoveryStats: () => RecoveryStats;
  isRecovering: boolean;
  suggestions: string[];
  recoveryAttempts: number;
}
```

## Services

### errorLogger

Service for logging and tracking errors.

```tsx
import { errorLogger, ErrorSeverity } from '@/services/errorLogger';
```

#### Methods

##### logError

```tsx
logError(
  error: Error,
  severity?: ErrorSeverity,
  errorInfo?: ErrorInfo,
  context?: Partial<ErrorContext>
): string
```

##### logRecovery

```tsx
logRecovery(errorId: string, method: string): void
```

##### getErrorHistory

```tsx
getErrorHistory(): ErrorLogEntry[]
```

##### shouldRetry

```tsx
shouldRetry(errorId: string): boolean
```

##### configure

```tsx
configure(config: ErrorServiceConfig): void
```

#### Example

```tsx
const errorId = errorLogger.logError(
  error,
  ErrorSeverity.HIGH,
  errorInfo,
  {
    userId: user.id,
    action: 'recipe.create',
    metadata: { recipeId: recipe.id }
  }
);

if (errorLogger.shouldRetry(errorId)) {
  await retryOperation();
  errorLogger.logRecovery(errorId, 'retry');
}
```

### errorRecovery

Service for error recovery operations.

```tsx
import { errorRecovery, RetryStrategy } from '@/services/errorRecovery';
```

#### Methods

##### recover

```tsx
recover(
  error: Error,
  operation: () => Promise<any>,
  config?: Partial<RetryConfig>
): Promise<any>
```

##### executeWithRetry

```tsx
executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T>
```

##### executeWithCircuitBreaker

```tsx
executeWithCircuitBreaker<T>(
  key: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T>
```

##### getRecoverySuggestions

```tsx
getRecoverySuggestions(error: Error): string[]
```

##### registerRecovery

```tsx
registerRecovery(
  errorType: ErrorType,
  callback: RecoveryCallback,
  config?: Partial<RetryConfig>
): void
```

### networkMonitor

Service for monitoring network status.

```tsx
import { networkMonitor, NetworkStatus } from '@/services/networkMonitor';
```

#### Methods

##### startMonitoring

```tsx
startMonitoring(): void
```

##### stopMonitoring

```tsx
stopMonitoring(): void
```

##### getStatus

```tsx
getStatus(): NetworkStatus
```

##### isOnline

```tsx
isOnline(): boolean
```

##### getConnectionQuality

```tsx
getConnectionQuality(): ConnectionQuality
```

##### queueOfflineRequest

```tsx
queueOfflineRequest(request: OfflineRequest): string
```

## Utility Functions

### Error Classification

```tsx
import { classifyError, isRetryableError } from '@/utils/errorHelpers';

const { type, isRetryable } = classifyError(error);
if (isRetryableError(error)) {
  await retry();
}
```

### Error Messages

```tsx
import { getUserFriendlyMessage, formatErrorForDevelopment } from '@/utils/errorHelpers';

const { title, message, action } = getUserFriendlyMessage(error);
const debugInfo = formatErrorForDevelopment(error);
```

## Types

### ErrorType

```tsx
enum ErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  SERVER_ERROR = 'server_error',
  CLIENT_ERROR = 'client_error',
  VALIDATION_ERROR = 'validation_error',
  AUTH_ERROR = 'auth_error',
  TOKEN_EXPIRED = 'token_expired',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  RATE_LIMIT = 'rate_limit',
  OFFLINE_ERROR = 'offline_error',
  UNKNOWN_ERROR = 'unknown_error'
}
```

### ErrorSeverity

```tsx
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### RetryStrategy

```tsx
enum RetryStrategy {
  IMMEDIATE = 'immediate',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  FIBONACCI = 'fibonacci'
}
```

### NetworkStatus

```tsx
enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SLOW = 'slow',
  UNKNOWN = 'unknown'
}
```

### ConnectionQuality

```tsx
enum ConnectionQuality {
  FAST = 'fast',
  GOOD = 'good',
  SLOW = 'slow',
  OFFLINE = 'offline'
}
```

## Configuration

### Error Logger Configuration

```tsx
errorLogger.configure({
  sentry: {
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.NODE_ENV
  },
  customEndpoint: {
    url: '/api/errors',
    headers: {
      'X-API-Key': process.env.VITE_ERROR_API_KEY
    }
  }
});
```

### Rate Limiting

```tsx
errorLogger.setRateLimit({
  maxErrors: 10,
  windowMs: 60000 // 1 minute
});
```

### Circuit Breaker Defaults

```tsx
const circuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  volumeThreshold: 10
};
```