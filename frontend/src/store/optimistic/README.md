# Optimistic Updates System for Zustand

A comprehensive optimistic updates system that provides instant UI feedback while ensuring data consistency and automatic rollback on failures.

## Features

- **Optimistic State Updates**: Instant UI updates with automatic rollback on failure
- **Update Queue Management**: FIFO/LIFO/Priority-based processing with deduplication
- **Conflict Resolution**: Automatic detection and resolution of concurrent updates
- **Rollback System**: Snapshot-based state recovery with selective rollback
- **Retry Logic**: Exponential backoff with configurable retry limits
- **React Hooks**: Easy-to-use hooks for optimistic mutations
- **TypeScript Support**: Full type safety and IntelliSense

## Installation

The optimistic updates system is already integrated into your project. To use it with a new store:

```typescript
import { create } from 'zustand';
import { optimisticMiddleware } from '@/store/optimistic';
```

## Basic Usage

### 1. Create a Store with Optimistic Middleware

```typescript
import { create } from 'zustand';
import { optimisticMiddleware } from '@/store/optimistic';

interface TodoState {
  todos: Todo[];
  addTodo: (todo: Todo) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
}

const useTodoStore = create<TodoState>()(
  optimisticMiddleware({
    maxRetries: 3,
    conflictStrategy: 'lastWrite',
    enableSnapshots: true,
  })(
    (set) => ({
      todos: [],
      addTodo: (todo) => set((state) => ({ 
        todos: [...state.todos, todo] 
      })),
      updateTodo: (id, updates) => set((state) => ({
        todos: state.todos.map(todo =>
          todo.id === id ? { ...todo, ...updates } : todo
        ),
      })),
    })
  )
);
```

### 2. Use Optimistic Updates in Components

```typescript
import { useOptimisticMutation } from '@/store/optimistic';

function TodoItem({ todo }) {
  const updateTodo = useOptimisticMutation(
    useTodoStore,
    'updateTodo',
    async (updates: Partial<Todo>) => {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    }
  );

  const handleToggle = () => {
    updateTodo.mutate({ completed: !todo.completed });
  };

  return (
    <div>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={handleToggle}
        disabled={updateTodo.isLoading}
      />
      {updateTodo.error && <span>Failed to update</span>}
    </div>
  );
}
```

## Configuration Options

```typescript
optimisticMiddleware({
  // Maximum retry attempts for failed updates
  maxRetries: 3,
  
  // Initial retry delay in milliseconds
  retryDelay: 1000,
  
  // Batch size for processing updates
  batchSize: 5,
  
  // Conflict resolution strategy
  conflictStrategy: 'lastWrite', // 'lastWrite' | 'firstWrite' | 'merge' | 'manual'
  
  // Enable state snapshots for rollback
  enableSnapshots: true,
  
  // Maximum number of snapshots to keep
  maxSnapshots: 50,
  
  // Deduplication strategy for updates
  dedupStrategy: 'replace', // 'ignore' | 'replace' | 'queue'
})
```

## Available Hooks

### useOptimisticMutation

React Query-like API for optimistic mutations:

```typescript
const mutation = useOptimisticMutation(store, action, mutationFn, {
  optimisticData: (variables) => optimisticPayload,
  onSuccess: (data) => console.log('Success:', data),
  onError: (error) => console.error('Error:', error),
  rollbackOnError: true,
});

// Usage
await mutation.mutate(variables);
await mutation.mutateAsync(variables);
```

### useOptimisticUpdate

Lower-level hook for custom optimistic updates:

```typescript
const { execute, isLoading, error, data } = useOptimisticUpdate(
  store,
  'actionName',
  {
    onSuccess: (result) => console.log('Success'),
    onError: (error) => console.error('Error'),
  }
);

await execute(payload, asyncFn, { priority: 1 });
```

### usePendingUpdates

Monitor and manage pending updates:

```typescript
const {
  updates,
  stats,
  rollbackUpdate,
  rollbackAll,
  getFailedUpdates,
} = usePendingUpdates(store);

// Display pending count
<div>{stats.pending} updates pending</div>

// Rollback specific update
rollbackUpdate(updateId);

// Rollback all updates
rollbackAll();
```

### useOptimisticState

Access state with pending updates information:

```typescript
const {
  state,
  hasPendingUpdates,
  pendingUpdates,
  pendingActions,
} = useOptimisticState(store, (state) => state.todos);
```

### useBatchOptimisticUpdate

Execute multiple optimistic updates as a batch:

```typescript
const { executeBatch, isLoading, errors } = useBatchOptimisticUpdate(store);

await executeBatch([
  { action: 'update1', payload: data1, asyncFn: () => api.update1() },
  { action: 'update2', payload: data2, asyncFn: () => api.update2() },
]);
```

## Conflict Resolution

The system automatically detects and resolves conflicts:

### Version Conflicts

```typescript
// Add version to your state
interface VersionedItem {
  id: string;
  version: number;
  // ... other fields
}

// Include expectedVersion in updates
const response = await fetch(`/api/items/${id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    ...updates,
    expectedVersion: item.version,
  }),
});
```

### Conflict Strategies

- **lastWrite**: Last update wins (default)
- **firstWrite**: First update wins, subsequent updates are discarded
- **merge**: Attempt to merge changes (requires custom implementation)
- **manual**: Trigger UI for manual conflict resolution

## Rollback System

The rollback system maintains snapshots of state changes:

```typescript
// Rollback to specific update
store.rollback({ targetUpdateId: 'update_123' });

// Rollback to specific snapshot
store.rollback({ targetSnapshotId: 'snapshot_456' });

// Rollback with options
store.rollback({
  preservePending: true,  // Keep pending updates
  cascade: true,         // Remove all subsequent snapshots
});
```

## Error Handling

Automatic retry with exponential backoff:

```typescript
// Configure retry behavior
const mutation = useOptimisticMutation(store, action, mutationFn, {
  maxRetries: 5,
  retryDelay: 1000, // Initial delay, doubles each retry
});

// Handle errors
mutation.mutate(data, {
  onError: (error) => {
    if (error.message.includes('conflict')) {
      // Handle specific error types
    }
  },
});
```

## Best Practices

1. **Always include version fields** for entities that support concurrent editing
2. **Use appropriate conflict strategies** based on your use case
3. **Implement proper error boundaries** to catch and display rollback notifications
4. **Monitor pending updates** and provide UI feedback
5. **Test rollback scenarios** thoroughly
6. **Use batch updates** for related operations

## Performance Considerations

- Snapshots are created using structured clone (falls back to JSON)
- Update queue processes items in batches to reduce overhead
- Deduplication prevents redundant updates
- Old snapshots are automatically pruned

## Debugging

Enable debug mode to see optimistic update flow:

```typescript
// In development
if (process.env.NODE_ENV === 'development') {
  window.__OPTIMISTIC_DEBUG__ = true;
}
```

Monitor update queue stats:

```typescript
const queue = store.getState().optimisticQueue;
console.log(queue.getStats());
```