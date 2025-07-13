# State Management Test Suite

This directory contains comprehensive tests for the Zustand-based state management system in the Jidelnicek frontend application.

## Test Coverage

### Store Slices Tests (`/slices/__tests__/`)

#### 1. `authStore.test.ts`
- **Coverage**: Authentication state management
- **Key Areas**:
  - Login/logout functionality
  - Token management and refresh
  - User profile operations
  - Email verification and password reset
  - Error handling and loading states
  - State persistence (tokens only)
  - API integration with axios interceptors

#### 2. `recipeStore.test.ts`
- **Coverage**: Recipe data management
- **Key Areas**:
  - CRUD operations for recipes
  - Pagination and filtering
  - Image upload handling (FormData)
  - User recipes vs. public recipes
  - Favorites and rating system
  - Search and sorting functionality
  - Optimistic updates
  - Error handling

#### 3. `tripStore.test.ts`
- **Coverage**: Trip planning and management
- **Key Areas**:
  - Trip CRUD operations
  - Participant management (add/update/remove)
  - Meal assignment and planning
  - Shopping list generation
  - Day-specific participant queries
  - Complex state interactions
  - API service integration (participantsApi)
  - Error handling across multiple operations

#### 4. `uiStore.test.ts`
- **Coverage**: UI state and user preferences
- **Key Areas**:
  - Theme management (light/dark/system)
  - Language selection
  - Sidebar and mobile menu states
  - Toast notification system
  - Modal management
  - Global loading states
  - User preferences persistence
  - LocalStorage integration

#### 5. `toastStore.test.ts` (Existing)
- **Coverage**: Toast notification system
- **Key Areas**: Already well-covered with comprehensive tests

### Integration Tests

#### 6. `storeIntegration.test.ts`
- **Coverage**: Cross-store interactions and hooks
- **Key Areas**:
  - Store hook integration (`useIsAuthenticated`, `useGlobalLoading`, etc.)
  - Cross-store state consistency
  - Error propagation across stores
  - Loading state aggregation
  - Persistence layer integration
  - Performance and memory management
  - Concurrent store updates
  - Development tools integration

#### 7. `apiMiddleware.integration.test.ts`
- **Coverage**: API middleware functionality
- **Key Areas**:
  - Request/response interceptors
  - Authentication header injection
  - Token refresh logic
  - Error handling and user feedback
  - Circuit breaker pattern
  - Retry logic
  - Batch API requests
  - Cancel token management

### Middleware and Advanced Features Tests

#### 8. Persistence Tests (`__tests__/persistence.test.ts` - Existing)
- **Coverage**: State persistence mechanisms
- **Key Areas**:
  - LocalStorage/SessionStorage adapters
  - IndexedDB adapter
  - Encryption/decryption
  - State migrations
  - Storage error handling

#### 9. Other Middleware Tests (Existing)
- `cache.test.ts` - Cache management
- `composition.test.ts` - Store composition
- `hydration.test.tsx` - State hydration
- `optimistic.test.ts` - Optimistic updates
- `sync.test.ts` - State synchronization

## Testing Patterns Used

### 1. **Comprehensive State Testing**
- Initial state verification
- State transitions
- Side effects (localStorage, API calls)
- Error boundaries

### 2. **Async Operations Testing**
- Loading states
- Success scenarios
- Error handling
- Timeout scenarios

### 3. **Integration Testing**
- Cross-store dependencies
- Hook composition
- Real-world usage patterns

### 4. **Edge Cases**
- Network failures
- Invalid data
- Concurrent operations
- Memory management

### 5. **Performance Testing**
- Rapid state updates
- Large data sets
- Subscription management
- Memory leak prevention

## Mock Strategy

### External Dependencies
- **axios**: Mocked for HTTP requests
- **localStorage/sessionStorage**: Custom mock implementations
- **@/api/client**: Mocked API client
- **@/services/participants**: Mocked service layer

### DOM APIs
- **document.documentElement**: For theme testing
- **window.matchMedia**: For system theme detection
- **File API**: For image upload testing

## Key Testing Utilities

### Custom Hooks Testing
- Uses `@testing-library/react-hooks` for hook testing
- Proper `act()` wrapping for state updates
- Subscription testing for store changes

### Mock Management
- Comprehensive beforeEach/afterEach cleanup
- Store state reset between tests
- Mock function call tracking

### Async Testing
- Proper Promise handling
- Timer management for auto-removal features
- Race condition testing

## Test Data Patterns

### Mock Data Structure
- Realistic data shapes matching API contracts
- Consistent IDs and relationships
- Edge case data (empty arrays, null values)

### State Scenarios
- Clean initial states
- Populated states for update/delete operations
- Error states for recovery testing
- Loading states for UX verification

## Coverage Goals

### Functional Coverage
- ✅ All store actions
- ✅ All state selectors
- ✅ Error handling paths
- ✅ Loading states
- ✅ Persistence mechanisms

### Integration Coverage
- ✅ Store-to-store interactions
- ✅ API middleware integration
- ✅ Hook composition
- ✅ Cross-cutting concerns

### Edge Case Coverage
- ✅ Network failures
- ✅ Invalid inputs
- ✅ Race conditions
- ✅ Memory management
- ✅ Browser API failures

## Running Tests

```bash
# Run all store tests
npm test src/store

# Run specific store tests
npm test src/store/slices/__tests__/authStore.test.ts

# Run with coverage
npm run test:coverage -- src/store

# Watch mode
npm run test:watch -- src/store
```

## Known Issues & Limitations

### Jest Configuration
- TypeScript import issues with some middleware tests
- Need proper babel/ts-jest configuration for ES modules
- Some tests may need environment variable mocking

### Test Environment
- DOM APIs need proper mocking
- File API testing requires additional setup
- Timer-based tests need careful jest.useFakeTimers() management

## Future Improvements

### Additional Test Cases
1. **Concurrent User Scenarios**: Multiple users modifying same data
2. **Offline/Online State**: Network connectivity changes
3. **Browser Storage Limits**: Storage quota exceeded scenarios
4. **Performance Benchmarks**: Large dataset handling

### Test Infrastructure
1. **Test Data Factories**: Automated test data generation
2. **Visual Regression**: Store state visualization
3. **E2E Integration**: Full user workflow testing
4. **Performance Monitoring**: Store operation timing

### Accessibility Testing
1. **Screen Reader**: Toast and modal announcements
2. **Keyboard Navigation**: Modal and UI state interactions
3. **High Contrast**: Theme system accessibility

This comprehensive test suite ensures the state management system is robust, performant, and reliable across all user scenarios and edge cases.