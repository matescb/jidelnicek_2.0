# State Management with Zustand

This directory contains the Zustand state management implementation for the Jídelníček application.

## Architecture

### Store Structure

```
store/
├── slices/           # Individual store slices
│   ├── authStore.ts      # Authentication state
│   ├── recipeStore.ts    # Recipe management
│   ├── tripStore.ts      # Trip planning
│   ├── participantStore.ts # Participant templates
│   └── uiStore.ts        # UI state (theme, toasts, modals)
├── middleware/       # Store middleware
│   └── apiMiddleware.ts  # Axios configuration and interceptors
├── hooks.ts         # Custom hooks and selectors
├── types.ts         # Shared types
└── index.ts         # Main exports
```

## Usage Examples

### Basic Store Usage

```typescript
import { useAuthStore } from '@store'

function LoginComponent() {
  const { login, loading, error } = useAuthStore()
  
  const handleSubmit = async (data) => {
    try {
      await login(data)
      // Success handled by store
    } catch (error) {
      // Error handled by store
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert>{error}</Alert>}
      {/* form fields */}
      <button disabled={loading}>Login</button>
    </form>
  )
}
```

### Using Selectors

```typescript
import { useIsAuthenticated, useCurrentUser } from '@store/hooks'

function Header() {
  const isAuthenticated = useIsAuthenticated()
  const user = useCurrentUser()
  
  return (
    <header>
      {isAuthenticated ? (
        <span>Welcome, {user?.firstName}!</span>
      ) : (
        <Link to="/login">Login</Link>
      )}
    </header>
  )
}
```

### Recipe Management

```typescript
import { useRecipeStore } from '@store'

function RecipeList() {
  const { 
    recipes, 
    loading, 
    fetchRecipes,
    setFilters,
    setSorting 
  } = useRecipeStore()
  
  useEffect(() => {
    fetchRecipes()
  }, [])
  
  const handleSearch = (query: string) => {
    setFilters({ search: query })
    fetchRecipes(1)
  }
  
  const handleSort = (field: string) => {
    setSorting(field)
    fetchRecipes(1)
  }
  
  return (
    <div>
      <SearchBar onSearch={handleSearch} />
      <SortOptions onSort={handleSort} />
      {loading ? (
        <Spinner />
      ) : (
        <RecipeGrid recipes={recipes} />
      )}
    </div>
  )
}
```

### Trip Planning

```typescript
import { useTripStore } from '@store'

function TripPlanner() {
  const {
    currentTrip,
    addParticipant,
    assignMeal,
    generateShoppingList
  } = useTripStore()
  
  const handleAddParticipant = async (participant) => {
    await addParticipant(currentTrip.id, participant)
  }
  
  const handleMealAssignment = async (dayId, mealSlot, recipeId) => {
    await assignMeal(currentTrip.id, dayId, mealSlot, recipeId)
  }
  
  const handleGenerateList = async () => {
    await generateShoppingList(currentTrip.id)
  }
  
  return (
    <div>
      <ParticipantManager onAdd={handleAddParticipant} />
      <MealCalendar onAssign={handleMealAssignment} />
      <button onClick={handleGenerateList}>Generate Shopping List</button>
    </div>
  )
}
```

### UI State Management

```typescript
import { useUIStore } from '@store'

function AppLayout() {
  const { 
    theme, 
    sidebarOpen, 
    toggleSidebar,
    showToast 
  } = useUIStore()
  
  const handleAction = async () => {
    try {
      // Do something
      showToast({
        type: 'success',
        title: 'Success!',
        message: 'Action completed successfully'
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message
      })
    }
  }
  
  return (
    <div className={theme}>
      <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />
      {/* rest of layout */}
    </div>
  )
}
```

### Global Loading State

```typescript
import { useGlobalLoading } from '@store/hooks'

function App() {
  const isLoading = useGlobalLoading()
  
  return (
    <>
      {isLoading && <GlobalSpinner />}
      <Routes />
    </>
  )
}
```

## Store Features

### Persistence

- Auth tokens are persisted to localStorage
- UI preferences are persisted to localStorage
- Participant templates are persisted to localStorage

### DevTools

All stores are integrated with Redux DevTools for debugging:
- Install Redux DevTools Extension
- Open DevTools to inspect state changes
- Time travel debugging available

### TypeScript Support

Full TypeScript support with:
- Typed store actions
- Typed selectors
- Autocomplete for all store methods
- Type-safe middleware

### Error Handling

- Automatic error toast notifications
- Error state in each store slice
- Retry logic for failed requests
- Token refresh on 401 errors

### Performance

- Immer for immutable updates
- Selective re-renders with zustand
- Memoized selectors
- Request deduplication

## Best Practices

1. **Use selectors for derived state**
   ```typescript
   // Good
   const isAuthenticated = useIsAuthenticated()
   
   // Avoid
   const isAuthenticated = useAuthStore(state => !!state.user)
   ```

2. **Handle errors in stores**
   ```typescript
   // Errors are automatically shown as toasts
   await login(credentials) // No try/catch needed in components
   ```

3. **Use loading states**
   ```typescript
   const { data, loading, error } = useRecipeStore()
   
   if (loading) return <Spinner />
   if (error) return <Error message={error} />
   return <Content data={data} />
   ```

4. **Clear temporary state**
   ```typescript
   useEffect(() => {
     return () => {
       // Clean up on unmount
       clearTempParticipants()
     }
   }, [])
   ```