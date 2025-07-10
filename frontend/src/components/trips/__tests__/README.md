# Trip Components Test Suite

This directory contains comprehensive test files for all trip-related UI components in the Jidelnicek application.

## Test Files

### Component Tests

1. **TripWizard.test.tsx**
   - Tests the multi-step trip creation/editing wizard
   - Covers navigation between steps, data persistence, validation
   - Tests both create and edit modes
   - Includes accessibility and keyboard navigation tests

2. **TripListPage.test.tsx**
   - Tests the trip listing page functionality
   - Covers filtering, sorting, pagination, and search
   - Tests trip actions (edit, delete, duplicate)
   - Includes responsive design and empty state tests

3. **TripCalendarView.test.tsx**
   - Tests the calendar view for trip meal planning
   - Covers month navigation, day selection, meal indicators
   - Tests different view modes (month, week, list)
   - Includes touch gestures and keyboard navigation

4. **MealPlanningBoard.test.tsx**
   - Tests the drag-and-drop meal planning interface
   - Covers recipe assignment, filtering, and search
   - Tests bulk operations and shopping list generation
   - Includes keyboard-based drag and drop tests

5. **ParticipantManager.test.tsx**
   - Tests participant management functionality
   - Covers CRUD operations, selection, and filtering
   - Tests import/export features and validation
   - Includes dietary restrictions and allergy handling

## Running Tests

### Prerequisites

First, install the testing dependencies:

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npm test TripWizard.test.tsx
```

### Update Snapshots

```bash
npm run test:ui
```

## Test Structure

Each test file follows a consistent structure:

1. **Setup**
   - Mock dependencies and store
   - Create test data
   - Setup providers (Router, Query, Theme, Auth)

2. **Test Suites**
   - Basic Functionality
   - User Interactions
   - State Management
   - Error Handling
   - Loading States
   - Accessibility
   - Responsive Design
   - Performance

3. **Helpers**
   - `renderWithProviders` - Wraps components with necessary providers
   - Mock data factories - Create consistent test data
   - Custom assertions - Domain-specific test helpers

## Mock Data

The tests use realistic mock data that matches the application's data structures:

- **Trips**: Multi-day trips with meal slots and participants
- **Recipes**: Complete recipe objects with nutrition info
- **Participants**: Users with dietary restrictions and allergies
- **Meal Slots**: Breakfast, lunch, and dinner configurations

## Coverage Goals

We aim for high test coverage:
- **Statements**: 70%+
- **Branches**: 70%+
- **Functions**: 70%+
- **Lines**: 70%+

## Best Practices

1. **Use Testing Library queries**
   - Prefer `getByRole`, `getByLabelText` over `getByTestId`
   - Use `screen` for better debugging

2. **Test user behavior**
   - Focus on how users interact with components
   - Test the full user flow, not implementation details

3. **Async handling**
   - Use `waitFor` for async operations
   - Always await user events

4. **Accessibility**
   - Test keyboard navigation
   - Verify ARIA labels and roles
   - Test screen reader announcements

5. **Mock appropriately**
   - Mock external dependencies (API, router)
   - Don't mock what you're testing
   - Keep mocks simple and focused

## Debugging Tests

### View the DOM

```javascript
screen.debug()
```

### Check specific elements

```javascript
screen.debug(screen.getByRole('button'))
```

### Use Testing Playground

```javascript
screen.logTestingPlaygroundURL()
```

### Check what's available

```javascript
const { container } = render(<Component />)
console.log(prettyDOM(container))
```

## Common Issues

### 1. Act Warnings
Wrap state updates in `waitFor`:
```javascript
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument()
})
```

### 2. Multiple Elements Found
Be more specific with queries:
```javascript
// Instead of
screen.getByText('Submit')

// Use
screen.getByRole('button', { name: /submit/i })
```

### 3. Element Not Found
Check if element is rendered conditionally:
```javascript
// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})
```

## Contributing

When adding new tests:

1. Follow the existing file structure
2. Include all test categories (functionality, accessibility, etc.)
3. Use consistent mock data
4. Add descriptive test names
5. Update this README if adding new patterns

## Integration with CI/CD

These tests are designed to run in CI/CD pipelines:

- Fast execution (mock external dependencies)
- Deterministic results (no random data)
- Clear failure messages
- Coverage reporting