# Enhanced API Middleware

The API middleware provides a robust layer for handling HTTP requests with advanced features like automatic retries, circuit breaking, and comprehensive error handling.

## Features

### 1. Automatic Retry Logic
- Configurable retry attempts with exponential backoff
- Smart retry conditions (network errors, 5xx errors)
- Per-request retry configuration
- Default: GET requests retry automatically, mutations don't

```typescript
// Default retry for GET requests
const data = await apiGet('/api/users')

// Custom retry configuration
const data = await apiGet('/api/users', {
  retry: {
    retries: 5,
    retryDelay: (count) => count * 1000,
    retryCondition: (error) => error.response?.status === 503
  }
})

// Disable retry
const data = await apiPost('/api/users', userData, { retry: false })
```

### 2. Circuit Breaker Pattern
- Prevents retry storms when services are down
- Automatically opens after 5 consecutive failures
- Closes after 1 minute timeout
- Per-URL tracking

### 3. Request Features
- Automatic auth token injection
- Request ID tracking
- Configurable timeouts
- Skip auth for public endpoints

```typescript
// Skip auth for public endpoint
const data = await apiGet('/api/public/health', { skipAuth: true })

// Custom timeout
const data = await apiGet('/api/slow-endpoint', { timeout: 60000 })

// Skip error handling
const data = await apiGet('/api/users', { skipErrorHandling: true })
```

### 4. Batch Requests
Process multiple API calls with concurrency control:

```typescript
const results = await apiBatch([
  () => apiGet('/api/users/1'),
  () => apiGet('/api/users/2'),
  () => apiGet('/api/users/3'),
], {
  maxConcurrent: 2,
  stopOnError: false
})
```

### 5. Request Cancellation
Cancel in-flight requests:

```typescript
const { token, cancel } = createCancelToken()

// Start request
apiGet('/api/large-data', { cancelToken: token })
  .then(data => console.log(data))
  .catch(error => {
    if (axios.isCancel(error)) {
      console.log('Request cancelled')
    }
  })

// Cancel it
cancel('User navigated away')
```

### 6. Type-Safe API Client
Create type-safe API clients:

```typescript
interface ApiEndpoints {
  '/users': User[]
  '/users/:id': User
  '/posts': Post[]
}

const api = createApiClient<ApiEndpoints>('https://api.example.com')

// Type-safe requests
const users = await api.get('/users') // Return type: User[]
const user = await api.post('/users/:id', userData) // Return type: User
```

## Error Handling

The middleware automatically handles common error scenarios:

1. **401 Unauthorized**: Attempts token refresh, then retries
2. **429 Rate Limiting**: Shows warning toast
3. **422 Validation Errors**: Displays validation messages
4. **500+ Server Errors**: Shows error toast with retry
5. **Network Errors**: Shows connection error message

## Configuration

### Global Configuration

```typescript
// In your app initialization
axios.defaults.timeout = 30000
axios.defaults.baseURL = process.env.VITE_API_URL
```

### Per-Request Configuration

```typescript
interface EnhancedAxiosRequestConfig {
  retry?: boolean | RetryConfig
  skipAuth?: boolean
  skipErrorHandling?: boolean
  timeout?: number
}
```

## Best Practices

1. **Use the helper functions** instead of raw axios:
   ```typescript
   // Good
   const data = await apiGet('/users')
   
   // Avoid
   const { data } = await axios.get('/users')
   ```

2. **Configure retry appropriately**:
   - GET requests: Enable retry (default)
   - POST/PUT/DELETE: Disable retry (default) unless idempotent
   - Critical operations: Custom retry with specific conditions

3. **Handle cancellation** for components that unmount:
   ```typescript
   useEffect(() => {
     const { token, cancel } = createCancelToken()
     
     apiGet('/data', { cancelToken: token })
       .then(setData)
       .catch(error => {
         if (!axios.isCancel(error)) {
           setError(error)
         }
       })
     
     return () => cancel()
   }, [])
   ```

4. **Use batch requests** for parallel operations:
   ```typescript
   // Instead of
   await Promise.all([api1(), api2(), api3()])
   
   // Use
   await apiBatch([api1, api2, api3], { maxConcurrent: 2 })
   ```

5. **Monitor circuit breaker** in production:
   ```typescript
   // Check if circuit is open
   if (circuitBreaker.isOpen('/api/critical-endpoint')) {
     // Use fallback or show maintenance message
   }
   ```