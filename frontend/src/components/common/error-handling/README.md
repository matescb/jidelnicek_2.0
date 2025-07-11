# Error Handling System

A comprehensive error handling system for React applications with automatic recovery, logging, and i18n support.

## Features

- **Multi-level Error Boundaries**: Page, section, and component-level error isolation
- **Automatic Error Recovery**: Configurable retry mechanisms with exponential backoff
- **Error Classification**: Automatic categorization of errors (network, auth, validation, etc.)
- **Error Logging Service**: Centralized logging with rate limiting and external service integration
- **Global Error Context**: Application-wide error state management
- **i18n Support**: Localized error messages for better user experience
- **Developer Tools**: Enhanced error details in development mode
- **TypeScript Support**: Full type safety throughout the system

## Quick Start

### 1. Wrap your app with ErrorProvider

```tsx
import { ErrorProvider } from '@/components/common/error-handling';

function App() {
  return (
    <ErrorProvider 
      maxErrors={50}
      autoRecovery={true}
      onError={(error) => console.log('Global error:', error)}
    >
      <YourApp />
    </ErrorProvider>
  );
}
```

### 2. Add Error Boundaries

```tsx
import { ErrorBoundary } from '@/components/common/error-handling';

// Page-level boundary
<ErrorBoundary level="page" enableRecovery showDetails>
  <YourPage />
</ErrorBoundary>

// Component-level boundary with custom fallback
<ErrorBoundary 
  level="component"
  fallback={<div>Component failed to load</div>}
  isolate
>
  <YourComponent />
</ErrorBoundary>
```

### 3. Use Error Hooks

```tsx
import { useErrorCapture, useErrorContext } from '@/components/common/error-handling';

function MyComponent() {
  const captureError = useErrorCapture();
  const { errors, dismissError } = useErrorContext();
  
  const handleAction = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      captureError(error, ErrorSeverity.HIGH, {
        component: 'MyComponent',
        action: 'riskyOperation'
      });
    }
  };
  
  return (
    <div>
      {/* Your component UI */}
    </div>
  );
}
```

## API Reference

### ErrorBoundary Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level` | `'page' \| 'section' \| 'component'` | `'component'` | Error boundary level for severity |
| `fallback` | `ReactNode` | - | Custom fallback UI |
| `onError` | `(error: Error, errorInfo: ErrorInfo) => void` | - | Error callback |
| `resetKeys` | `Array<string \| number>` | - | Keys that trigger reset when changed |
| `resetOnPropsChange` | `boolean` | `false` | Reset on prop changes |
| `isolate` | `boolean` | `false` | Prevent error propagation to context |
| `showDetails` | `boolean` | `dev only` | Show error details |
| `enableRecovery` | `boolean` | `false` | Enable automatic recovery |
| `customErrorComponent` | `ComponentType` | - | Custom error component |

### ErrorProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxErrors` | `number` | `10` | Maximum errors to keep in history |
| `autoRecovery` | `boolean` | `true` | Enable automatic recovery attempts |
| `onError` | `(error: AppError) => void` | - | Global error callback |

### Error Logging

```tsx
import { errorLogger, ErrorSeverity } from '@/components/common/error-handling';

// Configure external services
errorLogger.configure({
  sentry: {
    dsn: 'your-sentry-dsn',
    environment: 'production'
  },
  customEndpoint: {
    url: '/api/errors',
    headers: { 'X-API-Key': 'your-key' }
  }
});

// Set rate limiting
errorLogger.setRateLimit({
  maxErrors: 10,
  windowMs: 60000 // 1 minute
});

// Log errors manually
const errorId = errorLogger.logError(
  error,
  ErrorSeverity.HIGH,
  errorInfo,
  { userId: 'user123', action: 'checkout' }
);
```

### Error Classification

```tsx
import { classifyError, getUserFriendlyMessage } from '@/components/common/error-handling';

const { type, category, severity } = classifyError(error);
const { title, message, action } = getUserFriendlyMessage(error, t);
```

## Error Types

The system automatically classifies errors into these types:

- **Network Errors**: Connection failures, timeouts, offline
- **Auth Errors**: Unauthorized, token expired, invalid credentials
- **Validation Errors**: Form validation, missing fields, invalid format
- **API Errors**: Server errors, not found, rate limiting
- **Permission Errors**: Insufficient permissions, resource locked
- **UI Errors**: Render errors, component failures

## Recovery Strategies

### Automatic Recovery

Errors are automatically retried based on their type:
- Network errors: Up to 3 retries with exponential backoff
- API 502/503 errors: Up to 3 retries
- Auth token expiry: 1 retry after refresh
- Other errors: No automatic retry

### Manual Recovery

```tsx
import { useErrorRecovery } from '@/components/common/error-handling';

function RecoverableComponent({ errorId }) {
  const { error, recover, addCallback, canRecover } = useErrorRecovery(errorId);
  
  // Add recovery logic
  addCallback(async () => {
    await refreshToken();
    await retryOperation();
  });
  
  return (
    <div>
      {error && canRecover && (
        <button onClick={recover}>Try Recovery</button>
      )}
    </div>
  );
}
```

## i18n Integration

Error messages are automatically localized. Add translations to your locale files:

```json
{
  "errors": {
    "network_error": {
      "title": "Network Error",
      "message": "Unable to connect to the server.",
      "action": "Try refreshing the page"
    }
  }
}
```

## Best Practices

1. **Use appropriate error boundary levels**:
   - Page level for critical errors
   - Section level for feature isolation
   - Component level for non-critical UI

2. **Always provide context when capturing errors**:
   ```tsx
   captureError(error, severity, {
     component: 'CheckoutForm',
     action: 'submitPayment',
     metadata: { orderId, amount }
   });
   ```

3. **Configure rate limiting** to prevent error spam:
   ```tsx
   errorLogger.setRateLimit({ maxErrors: 5, windowMs: 60000 });
   ```

4. **Use isolation for independent features**:
   ```tsx
   <ErrorBoundary isolate>
     <ThirdPartyWidget />
   </ErrorBoundary>
   ```

5. **Implement custom recovery strategies** for domain-specific errors:
   ```tsx
   if (error.message.includes('session')) {
     await refreshSession();
   }
   ```

## Testing

```tsx
import { ErrorBoundary } from '@/components/common/error-handling';
import { render, screen } from '@testing-library/react';

test('displays fallback on error', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };
  
  render(
    <ErrorBoundary fallback={<div>Error occurred</div>}>
      <ThrowError />
    </ErrorBoundary>
  );
  
  expect(screen.getByText('Error occurred')).toBeInTheDocument();
});
```

## Migration Guide

To migrate from basic error boundaries:

1. Replace `componentDidCatch` with `ErrorBoundary` component
2. Add `ErrorProvider` at app root
3. Update error handling to use `useErrorCapture`
4. Configure error logging service
5. Add error translations to locale files

## Examples

See `/src/components/common/ErrorBoundaryExample.tsx` for a comprehensive example demonstrating all features.