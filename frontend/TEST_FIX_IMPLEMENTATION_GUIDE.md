# Frontend Test Fix Implementation Guide

## Quick Reference for Common Fixes

### 1. Theme Test Fixes

#### localStorage Key Issues
```typescript
// ❌ Wrong
expect(localStorage.getItem('themeMode')).toBe('dark')

// ✅ Correct
expect(localStorage.getItem('theme')).toBe('dark')
```

#### Keyboard Navigation Tests
```typescript
// ❌ Wrong - Old userEvent pattern
await userEvent.tab()
await userEvent.keyboard('{Enter}')

// ✅ Correct - New userEvent pattern
const user = userEvent.setup()
await user.tab()
await user.keyboard('{Enter}')
```

#### React Router v7 Warnings
```typescript
// ✅ Add to test setup
const router = createBrowserRouter(routes, {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
})

// ✅ Or suppress in setupTests.ts
const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('React Router Future Flag Warning')
    ) {
      return
    }
    originalWarn.apply(console, args)
  }
})
```

### 2. Form Test Fixes

#### Form Field Selection
```typescript
// ❌ Wrong - Using getByLabelText when label isn't properly associated
const input = screen.getByLabelText('Recipe Name')

// ✅ Correct - Multiple approaches
// Option 1: Use getByRole with name
const input = screen.getByRole('textbox', { name: /recipe name/i })

// Option 2: Use data-testid
const input = screen.getByTestId('recipe-name-input')

// Option 3: Get by placeholder
const input = screen.getByPlaceholderText('Enter recipe name')
```

#### Async Validation Tests
```typescript
// ❌ Wrong - Not waiting for validation
fireEvent.blur(input)
expect(screen.getByText('Invalid input')).toBeInTheDocument()

// ✅ Correct - Wait for validation
fireEvent.blur(input)
await waitFor(() => {
  expect(screen.getByText('Invalid input')).toBeInTheDocument()
})
```

#### Form Submission Tests
```typescript
// ✅ Correct pattern
const user = userEvent.setup()
const onSubmit = jest.fn()

render(<RecipeForm onSubmit={onSubmit} />)

// Fill form fields
await user.type(screen.getByRole('textbox', { name: /name/i }), 'Test Recipe')
await user.type(screen.getByRole('spinbutton', { name: /servings/i }), '4')

// Submit form
await user.click(screen.getByRole('button', { name: /submit/i }))

// Wait for submission
await waitFor(() => {
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Test Recipe',
      servings: 4
    })
  )
})
```

### 3. Component Test Fixes

#### Multiple Elements Issue
```typescript
// ❌ Wrong - When multiple elements exist
expect(screen.getByText('Active')).toBeInTheDocument()

// ✅ Correct - Be more specific
// Option 1: Use getAllBy and check specific one
const activeElements = screen.getAllByText('Active')
expect(activeElements[0]).toBeInTheDocument()

// Option 2: Use within to scope the query
const statusSection = screen.getByTestId('status-section')
expect(within(statusSection).getByText('Active')).toBeInTheDocument()

// Option 3: Use more specific query
expect(screen.getByRole('status', { name: 'Active' })).toBeInTheDocument()
```

#### Store Mock Issues
```typescript
// ✅ Correct store mock setup
import { useRecipeStore } from '@/store/slices/recipeStore'

jest.mock('@/store/slices/recipeStore')

const mockUseRecipeStore = useRecipeStore as jest.MockedFunction<typeof useRecipeStore>

beforeEach(() => {
  mockUseRecipeStore.mockReturnValue({
    recipes: [],
    loading: false,
    error: null,
    fetchRecipes: jest.fn(),
    addRecipe: jest.fn(),
    updateRecipe: jest.fn(),
    deleteRecipe: jest.fn()
  })
})
```

### 4. Async Test Patterns

#### Data Loading Tests
```typescript
// ✅ Correct async data loading test
it('loads and displays data', async () => {
  const mockFetch = jest.fn().mockResolvedValue(mockData)
  mockUseStore.mockReturnValue({
    data: null,
    loading: true,
    fetch: mockFetch
  })

  const { rerender } = render(<Component />)
  
  // Verify loading state
  expect(screen.getByTestId('loading')).toBeInTheDocument()
  
  // Simulate data loaded
  mockUseStore.mockReturnValue({
    data: mockData,
    loading: false,
    fetch: mockFetch
  })
  
  rerender(<Component />)
  
  // Verify data displayed
  await waitFor(() => {
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    expect(screen.getByText(mockData.title)).toBeInTheDocument()
  })
})
```

### 5. Error Handling Tests

#### localStorage Error Tests
```typescript
// ✅ Correct localStorage error handling test
it('handles localStorage errors gracefully', () => {
  const originalSetItem = Storage.prototype.setItem
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
  
  // Render component first
  render(<Component />)
  
  // Then mock localStorage to throw
  Storage.prototype.setItem = jest.fn(() => {
    throw new Error('QuotaExceededError')
  })
  
  // Trigger localStorage write
  fireEvent.click(screen.getByRole('button'))
  
  // Verify error was handled
  expect(consoleSpy).toHaveBeenCalled()
  
  // Cleanup
  Storage.prototype.setItem = originalSetItem
  consoleSpy.mockRestore()
})
```

### 6. Test Utilities

#### Custom Render with Providers
```typescript
// ✅ Create custom render function
import { render as rtlRender } from '@testing-library/react'
import { ThemeProvider } from '@/context/ThemeContext'
import { BrowserRouter } from 'react-router-dom'

function render(ui: React.ReactElement, options = {}) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </BrowserRouter>
    )
  }
  
  return rtlRender(ui, { wrapper: Wrapper, ...options })
}

// Use in tests
render(<Component />)
```

### 7. Common Debugging Tips

#### Debug DOM State
```typescript
// Print current DOM
screen.debug()

// Print specific element
screen.debug(screen.getByRole('button'))

// Log all available queries
screen.logTestingPlaygroundURL()
```

#### Wait for Specific Conditions
```typescript
// ✅ Wait with custom timeout
await waitFor(
  () => {
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  },
  { timeout: 3000 }
)
```

#### Test Act Warnings
```typescript
// ✅ Wrap state updates in act
import { act } from '@testing-library/react'

act(() => {
  // State updates here
  result.current.updateState('new value')
})
```

## Component-Specific Fixes

### RecipeForm Tests
1. Update all input selectors to use role-based queries
2. Add proper async handling for validation
3. Mock image upload with proper file objects
4. Ensure form state is properly initialized

### ThemeToggle Tests
1. Use correct localStorage keys ('theme' not 'themeMode')
2. Setup userEvent properly for all interactions
3. Handle theme context provider in tests
4. Mock matchMedia for system theme tests

### TripCalendarView Tests
1. Mock date utilities properly
2. Handle calendar navigation with proper selectors
3. Ensure store state updates are wrapped in act()
4. Mock API calls for trip data

## Running Tests

### Individual Test Files
```bash
npm test -- --testPathPattern="ComponentName" --no-coverage
```

### Watch Mode for Development
```bash
npm test -- --watch --testPathPattern="ComponentName"
```

### With Debugging
```bash
npm test -- --testPathPattern="ComponentName" --no-coverage --verbose
```

## Next Steps

1. Start with ThemeToggle remaining failures
2. Move to RecipeForm test fixes
3. Fix TripCalendarView tests
4. Continue with other components per priority

Remember to:
- Run tests after each fix to verify
- Commit working fixes frequently
- Update this guide with new patterns discovered
- Keep tests simple and focused