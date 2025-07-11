# Zustand State Hydration System

A comprehensive hydration system for Zustand stores that supports both SSR (Server-Side Rendering) and client-side hydration scenarios, with features like dependency management, state transformation, and type-safe serialization.

## Features

- 🚀 **SSR Support**: Full server-side rendering support with automatic client rehydration
- 🔄 **Dependency Management**: Automatic handling of store dependencies and hydration order
- 🛡️ **Type Safety**: Full TypeScript support with type-safe serialization/deserialization
- 🎯 **Partial Hydration**: Support for hydrating only specific parts of the state
- 🔧 **State Transformation**: Transform state during hydration (e.g., restore Date objects)
- 📦 **Complex Type Support**: Serialize/deserialize Date, Map, Set, RegExp, and custom classes
- 🔗 **Circular Reference Handling**: Safe handling of circular references in state
- 🗜️ **Compression**: Optional state compression for smaller payloads
- ⚡ **Performance**: Optimized hydration with batching and parallel processing
- 🧪 **Testing Friendly**: Easy to test with reset functionality and mocking support

## Installation

The hydration system is already included in the store directory. No additional installation needed.

## Basic Usage

### 1. Create a Store with Hydration

```typescript
import { create } from 'zustand';
import { hydrationMiddleware } from '@/store/hydration';

interface UserStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  hydrationMiddleware({
    name: 'user-store', // Unique identifier
    merge: 'deep',      // Deep merge strategy
  })(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    })
  )
);
```

### 2. Server-Side Setup (SSR)

```typescript
// In your SSR handler
import { createServerSnapshot, HydrationScript } from '@/store/hydration';

const snapshot = createServerSnapshot();

const html = renderToString(
  <HydrationProvider serverSnapshot={snapshot}>
    <App />
  </HydrationProvider>
);

// Include hydration data in HTML
const fullHtml = `
  <!DOCTYPE html>
  <html>
    <body>
      <div id="root">${html}</div>
      <HydrationScript snapshot={snapshot} />
    </body>
  </html>
`;
```

### 3. Client-Side Setup

```typescript
import { HydrationProvider, HydrationBoundary } from '@/store/hydration';

function App() {
  return (
    <HydrationProvider autoHydrate>
      <HydrationBoundary 
        stores={['user-store', 'ui-store']}
        fallback={<LoadingSpinner />}
      >
        <MainApp />
      </HydrationBoundary>
    </HydrationProvider>
  );
}
```

## Advanced Features

### State Transformation

Transform state during hydration to restore complex types:

```typescript
hydrationMiddleware({
  name: 'events-store',
  transform: (state) => ({
    ...state,
    events: state.events?.map(event => ({
      ...event,
      date: new Date(event.date), // Restore Date objects
    })),
  }),
})
```

### State Validation

Validate state shape before applying:

```typescript
hydrationMiddleware({
  name: 'config-store',
  validate: (state): state is Partial<ConfigStore> => {
    return (
      typeof state === 'object' &&
      state !== null &&
      (!state.apiUrl || typeof state.apiUrl === 'string')
    );
  },
})
```

### Store Dependencies

Ensure stores are hydrated in the correct order:

```typescript
hydrationMiddleware({
  name: 'posts-store',
  dependencies: ['auth-store', 'config-store'], // Hydrate after these stores
})
```

### Custom Serialization

Handle custom classes and complex types:

```typescript
import { createClassSerializer } from '@/store/hydration';

class CustomModel {
  constructor(public id: string, public data: Map<string, any>) {}
}

const customSerializer = createClassSerializer<CustomModel>(
  'CustomModel',
  (model) => ({ id: model.id, data: Array.from(model.data) }),
  (data) => new CustomModel(data.id, new Map(data.data))
);

hydrationMiddleware({
  name: 'custom-store',
  serialization: {
    compress: true,
    serializers: new Map([customSerializer.serializer]),
    deserializers: new Map([customSerializer.deserializer]),
  },
})
```

### Partial Hydration

Hydrate only specific parts of the state:

```typescript
hydrationMiddleware({
  name: 'app-store',
  merge: (existing, hydrated) => ({
    ...existing,
    // Only hydrate user preferences
    preferences: hydrated.preferences,
    // Keep other state as is
  }),
})
```

## React Hooks

### useHydration

Access the hydration context:

```typescript
const { state, hydrate, isStoreHydrated } = useHydration();

if (!isStoreHydrated('user-store')) {
  // Store not yet hydrated
}
```

### useWaitForHydration

Wait for specific stores to be hydrated:

```typescript
const { isHydrated, isHydrating, error } = useWaitForHydration(
  ['user-store', 'config-store'],
  { timeout: 5000 }
);
```

### useStoreHydrationStatus

Get hydration status for a specific store:

```typescript
const { isHydrated, isPending, error } = useStoreHydrationStatus('user-store');
```

### useManualHydration

Manually trigger hydration:

```typescript
const { hydrate, isHydrating, error } = useManualHydration();

const handleRefresh = async () => {
  await hydrate(); // Re-hydrate all stores
};
```

## Next.js Integration

### App Directory (Next.js 13+)

```typescript
// app/providers.tsx
'use client';

import { HydrationProvider } from '@/store/hydration';

export function Providers({ 
  children,
  hydrationSnapshot 
}: { 
  children: React.ReactNode;
  hydrationSnapshot?: any;
}) {
  return (
    <HydrationProvider serverSnapshot={hydrationSnapshot}>
      {children}
    </HydrationProvider>
  );
}

// app/layout.tsx
import { createServerSnapshot } from '@/store/hydration';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const snapshot = createServerSnapshot();
  
  return (
    <html>
      <body>
        <Providers hydrationSnapshot={snapshot}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

### Pages Directory

See the integration example for Pages Router setup.

## Performance Optimization

### Batch Hydration

Hydrate multiple stores efficiently:

```typescript
import { batchHydrate } from '@/store/hydration';

await batchHydrate([
  { fn: () => hydrateUserStore(), label: 'User Store' },
  { fn: () => hydrateConfigStore(), label: 'Config Store' },
  { fn: () => hydrateUIStore(), label: 'UI Store' },
], {
  maxConcurrency: 2,
  onProgress: (completed, total) => {
    console.log(`Hydrated ${completed}/${total} stores`);
  },
});
```

### Measure Performance

```typescript
import { measureHydrationTime } from '@/store/hydration';

const result = measureHydrationTime(
  () => store.getState().hydrateFromAPI(),
  'API Hydration'
);
// Logs: [Hydration] API Hydration took 123.45ms
```

## Error Handling

### Global Error Handling

```typescript
<HydrationProvider
  onError={(error) => {
    console.error('Hydration failed:', error);
    // Send to error tracking service
  }}
>
  {children}
</HydrationProvider>
```

### Per-Store Error Handling

```typescript
hydrationMiddleware({
  name: 'critical-store',
  onError: (error) => {
    // Handle store-specific errors
    if (error.message.includes('Invalid state')) {
      // Reset to default state
      store.setState(getDefaultState());
    }
  },
})
```

## Testing

### Unit Tests

```typescript
import { resetHydration } from '@/store/hydration';

describe('Store Hydration', () => {
  beforeEach(() => {
    resetHydration(); // Clean state between tests
  });
  
  it('should hydrate store', async () => {
    // Test implementation
  });
});
```

### Integration Tests

See `integration.example.ts` for comprehensive testing examples.

## Best Practices

1. **Always use unique store names** to avoid conflicts
2. **Validate state shape** to catch hydration errors early
3. **Transform dates and complex objects** during hydration
4. **Use dependencies** for stores that rely on each other
5. **Don't hydrate sensitive data** like tokens on the client
6. **Use compression** for large state objects
7. **Handle errors gracefully** with fallback UI
8. **Test hydration scenarios** including error cases

## Troubleshooting

### Common Issues

1. **Store not hydrating**: Check store name matches and dependencies
2. **Type errors**: Ensure proper TypeScript types and validation
3. **Circular dependencies**: Review store dependency graph
4. **Performance issues**: Use batch hydration and compression
5. **SSR mismatches**: Ensure consistent state between server and client

### Debug Mode

Enable debug logging in development:

```typescript
if (process.env.NODE_ENV === 'development') {
  window.__HYDRATION_DEBUG__ = true;
}
```

## API Reference

See the exported types and functions in `index.ts` for the complete API documentation.