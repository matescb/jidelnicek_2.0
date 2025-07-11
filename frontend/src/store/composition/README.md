# Store Composition System

A powerful utility system for composing Zustand stores with TypeScript support, enabling modular state management with automatic namespacing, cross-slice communication, and advanced middleware.

## Features

- **Modular Store Composition**: Combine multiple store slices into a single store
- **Automatic Action Namespacing**: Prevents naming conflicts between slices
- **Cross-Slice Communication**: Enable slices to interact with each other
- **Computed Values**: Define derived state across slices
- **Factory Functions**: Pre-built patterns for common use cases (CRUD, async, forms, etc.)
- **Advanced Selectors**: Memoized selectors with reselect-like API
- **Middleware System**: Logger, DevTools, performance monitoring, and more
- **Full TypeScript Support**: Complete type inference and safety

## Installation

The store composition system is built on top of Zustand and requires it as a peer dependency:

```bash
npm install zustand
```

## Basic Usage

### 1. Create Store Slices

```typescript
import { createCrudSlice, createAsyncSlice, createFormSlice } from '@/store/composition';

// Define your types
interface User {
  id: string;
  name: string;
  email: string;
}

// Create slices using factory functions
const userSlice = createCrudSlice<User>({
  name: 'users',
  idField: 'id',
  sortField: 'name',
});

const currentUserSlice = createAsyncSlice<User | null>({
  name: 'currentUser',
  initialData: null,
  fetchFn: async () => {
    const response = await fetch('/api/auth/me');
    return response.json();
  },
});
```

### 2. Compose Store

```typescript
import { composeStore } from '@/store/composition';

export const useAppStore = composeStore({
  slices: {
    users: userSlice,
    currentUser: currentUserSlice,
  },
  
  // Add computed values
  computed: {
    isAuthenticated: (state) => state.currentUser.data !== null,
    userCount: (state) => state.users.count,
  },
  
  // Configure middleware
  middleware: [
    loggerMiddleware({ collapsed: true }),
    performanceMiddleware({ warnThreshold: 16 }),
  ],
  
  // DevTools configuration
  devtools: {
    name: 'My App Store',
    enabled: process.env.NODE_ENV === 'development',
  },
});
```

### 3. Use in Components

```typescript
function UserList() {
  const users = useAppStore(state => state.users);
  const isAuthenticated = useAppStore(state => state._computed?.isAuthenticated);
  
  return (
    <div>
      {users.items.map(user => (
        <div key={user.id}>
          {user.name} - {user.email}
        </div>
      ))}
    </div>
  );
}
```

## Slice Factory Functions

### CRUD Slice

Creates a slice with standard CRUD operations:

```typescript
const productsSlice = createCrudSlice<Product>({
  name: 'products',
  initialItems: [],
  idField: 'id',
  sortField: 'name',
  sortOrder: 'asc',
});

// Available operations:
// - add(item)
// - update(id, updates)
// - remove(id)
// - select(id)
// - setItems(items)
// - clear()
// Computed: selectedItem, count
```

### Async Slice

Creates a slice for managing async data:

```typescript
const profileSlice = createAsyncSlice<UserProfile>({
  name: 'profile',
  initialData: null,
  fetchFn: async () => fetchUserProfile(),
  updateFn: async (data) => updateUserProfile(data),
  errorHandler: (error) => console.error('Profile error:', error),
});

// Available operations:
// - fetch()
// - update(data)
// - reset()
// - setLoading(loading)
// - setError(error)
```

### List Slice

Creates a slice with pagination, filtering, and sorting:

```typescript
const itemsSlice = createListSlice<Item>({
  name: 'items',
  initialItems: [],
  pageSize: 20,
  sortable: true,
  filterable: true,
  searchable: true,
});

// Available operations:
// - setPage(page)
// - setPageSize(size)
// - setSort(field, order)
// - setFilter(key, value)
// - clearFilters()
// - setSearchQuery(query)
// - refresh()
```

### Form Slice

Creates a slice for form management with validation:

```typescript
const loginFormSlice = createFormSlice<LoginData>({
  name: 'loginForm',
  initialValues: { email: '', password: '' },
  validationSchema: loginSchema, // Zod, Yup, etc.
  onSubmit: async (values) => {
    await login(values);
  },
  resetOnSubmit: true,
});

// Available operations:
// - setFieldValue(field, value)
// - setFieldError(field, error)
// - setFieldTouched(field, touched)
// - setValues(values)
// - setErrors(errors)
// - submit()
// - reset()
// - validate()
```

### Modal Slice

Creates a slice for managing modals/dialogs:

```typescript
const modalsSlice = createModalSlice({
  name: 'modals',
  modals: {
    userEdit: {},
    confirmDelete: { data: null },
    settings: { defaultOpen: false },
  },
});

// Available operations:
// - open(modalId, data?)
// - close(modalId)
// - toggle(modalId)
// - closeAll()
// - isOpen(modalId)
// - getData(modalId)
```

## Selectors

### Basic Selectors

```typescript
import { createSelector } from '@/store/composition';

const selectActiveUsers = createSelector(
  (state: AppState) => state.users.items.filter(u => u.active)
);

const selectUserById = (id: string) => createSelector(
  (state: AppState) => state.users.items.find(u => u.id === id)
);
```

### Combined Selectors

```typescript
import { combineSelectors } from '@/store/composition';

const selectUserWithPosts = combineSelectors(
  (state) => state.currentUser.data,
  (state) => state.posts.items,
  (user, posts) => ({
    ...user,
    posts: posts.filter(p => p.authorId === user?.id),
  })
);
```

### Parametric Selectors

```typescript
import { createParametricSelector } from '@/store/composition';

const selectItemsByCategory = createParametricSelector(
  (categoryId: string) => (state) =>
    state.items.filter(item => item.categoryId === categoryId)
);

// Usage
const electronics = useAppStore(selectItemsByCategory('electronics'));
```

## Middleware

### Logger Middleware

```typescript
loggerMiddleware({
  collapsed: true,
  diff: true,
  timestamp: true,
  duration: true,
  predicate: (state, action) => !action.type.includes('mouse'),
});
```

### Performance Middleware

```typescript
performanceMiddleware({
  warnThreshold: 16, // Warn if update takes > 16ms
  enableProfiling: true,
  logSlowUpdates: true,
});
```

### Action Tracking Middleware

```typescript
actionTrackingMiddleware({
  maxActions: 100,
  persist: true,
  filter: (action) => action.type !== 'mousemove',
});
```

### Conditional Middleware

```typescript
conditionalMiddleware(
  () => process.env.NODE_ENV === 'development',
  loggerMiddleware()
);
```

## Advanced Patterns

### Cross-Slice Communication

```typescript
const useCartActions = () => {
  const store = useAppStore();
  
  return {
    addToCart: (productId: string) => {
      const product = store.products.items.find(p => p.id === productId);
      if (!product) return;
      
      store.cart.add({
        id: Date.now().toString(),
        productId,
        quantity: 1,
        price: product.price,
      });
      
      store.notifications.show('Added to cart!');
    },
  };
};
```

### Extending Slices

```typescript
import { extendSlice } from '@/store/composition';

const enhancedUserSlice = extendSlice(userSlice, {
  state: {
    searchQuery: '',
  },
  actions: {
    search: (state, query: string) => {
      state.searchQuery = query;
    },
  },
});
```

### Custom Middleware

```typescript
const myMiddleware: StoreMiddleware<MyState> = (config) => (set, get, api) => {
  const enhancedSet = (partial, replace) => {
    console.log('Before update:', get());
    set(partial, replace);
    console.log('After update:', get());
  };
  
  return config(enhancedSet, get, api);
};
```

## TypeScript Support

The composition system provides full TypeScript support with automatic type inference:

```typescript
// Infer store state type
type AppState = ReturnType<typeof useAppStore.getState>;

// Access slice types
type UsersSlice = AppState['users'];
type CurrentUser = AppState['currentUser']['data'];

// Typed selectors
const selectUser: (state: AppState) => User | undefined;
```

## Best Practices

1. **Organize by Feature**: Group related slices together
2. **Use Factory Functions**: Leverage pre-built patterns for common use cases
3. **Minimize Cross-Slice Dependencies**: Keep slices as independent as possible
4. **Memoize Selectors**: Use selectors for derived state to prevent unnecessary re-renders
5. **Configure Middleware Wisely**: Use conditional middleware to avoid performance overhead in production
6. **Type Your State**: Always define interfaces for your state shapes

## Performance Considerations

- Selectors are memoized by default to prevent unnecessary recalculations
- Use `equalityFn` parameter in selectors for custom comparison logic
- The performance middleware helps identify slow updates
- Batch updates when making multiple state changes
- Use the list slice's pagination features for large datasets

## Migration from Plain Zustand

If you have existing Zustand stores, you can gradually migrate:

```typescript
// Before
const useStore = create((set) => ({
  users: [],
  addUser: (user) => set((state) => ({ users: [...state.users, user] })),
}));

// After
const userSlice = createCrudSlice<User>({
  name: 'users',
});

const useStore = composeStore({
  slices: { users: userSlice },
});
```