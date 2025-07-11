// Main exports for the optimistic updates system
export { optimisticMiddleware } from './optimisticMiddleware';
export { UpdateQueue } from './updateQueue';
export { RollbackManager } from './rollbackManager';

// Export all hooks
export {
  useOptimisticUpdate,
  useOptimisticState,
  usePendingUpdates,
  useOptimisticMutation,
  useBatchOptimisticUpdate,
} from './hooks';

// Export all types
export type {
  OptimisticUpdate,
  OptimisticState,
  OptimisticOptions,
  OptimisticActions,
  OptimisticMiddleware,
  ConflictResolution,
  ConflictStrategy,
  DedupStrategy,
  Snapshot,
  RollbackOptions,
  UpdateQueueItem,
  QueueOptions,
  QueueStats,
} from './types';

// Example usage with a Zustand store:
/*
import { create } from 'zustand';
import { optimisticMiddleware } from '@/store/optimistic';

interface TodoState {
  todos: Todo[];
  addTodo: (todo: Todo) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
}

export const useTodoStore = create<TodoState>()(
  optimisticMiddleware({
    maxRetries: 3,
    conflictStrategy: 'lastWrite',
    enableSnapshots: true,
  })(
    (set) => ({
      todos: [],
      
      addTodo: (todo) => set((state) => ({
        todos: [...state.todos, todo],
      })),
      
      updateTodo: (id, updates) => set((state) => ({
        todos: state.todos.map((todo) =>
          todo.id === id ? { ...todo, ...updates } : todo
        ),
      })),
      
      deleteTodo: (id) => set((state) => ({
        todos: state.todos.filter((todo) => todo.id !== id),
      })),
    })
  )
);

// Using in a component:
function TodoItem({ todo }) {
  const store = useTodoStore();
  const { execute, isLoading } = useOptimisticUpdate(
    store,
    'updateTodo',
    {
      onError: (error) => {
        toast.error('Failed to update todo');
      },
    }
  );

  const handleToggle = async () => {
    await execute(
      { id: todo.id, completed: !todo.completed },
      async () => {
        const response = await fetch(`/api/todos/${todo.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ completed: !todo.completed }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update todo');
        }
        
        return response.json();
      }
    );
  };

  return (
    <div>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={handleToggle}
        disabled={isLoading}
      />
      <span>{todo.title}</span>
    </div>
  );
}
*/