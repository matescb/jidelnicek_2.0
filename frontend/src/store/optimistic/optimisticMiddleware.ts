import { StateCreator, StoreApi } from 'zustand';
import { produce } from 'immer';
import { 
  OptimisticOptions, 
  OptimisticUpdate, 
  OptimisticState,
  OptimisticActions,
  ConflictResolution,
  UpdateQueueItem,
  ConflictStrategy
} from './types';
import { UpdateQueue } from './updateQueue';
import { RollbackManager } from './rollbackManager';

const DEFAULT_OPTIONS: Required<OptimisticOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: 5,
  conflictStrategy: 'lastWrite',
  enableSnapshots: true,
  maxSnapshots: 50,
  dedupStrategy: 'replace',
};

export const optimisticMiddleware = <T extends object>(
  options: OptimisticOptions = {}
): ((
  config: StateCreator<T, [], [], T>,
) => StateCreator<T & OptimisticActions<T>, [], [], T & OptimisticActions<T>>) => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  return (config) => (set, get, api) => {
    const updateQueue = new UpdateQueue({
      maxConcurrent: 3,
      processingStrategy: 'priority',
      batchingEnabled: true,
      batchSize: mergedOptions.batchSize,
    });

    const rollbackManager = new RollbackManager<T>(mergedOptions.maxSnapshots);
    const optimisticState: OptimisticState = {
      updates: new Map(),
      queue: [],
      processing: false,
      conflicts: [],
    };

    const generateUpdateId = (): string => {
      return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const detectConflict = (
      update: OptimisticUpdate,
      currentState: T
    ): ConflictResolution | null => {
      // Check for version conflicts
      if ('version' in currentState && 'expectedVersion' in update.payload) {
        const currentVersion = (currentState as any).version;
        const expectedVersion = (update.payload as any).expectedVersion;
        
        if (currentVersion !== expectedVersion) {
          return {
            updateId: update.id,
            conflictType: 'version',
            resolution: mergedOptions.conflictStrategy === 'manual' ? 'manual' : 'retry',
          };
        }
      }

      // Check for concurrent updates on the same resource
      const processingUpdates = Array.from(optimisticState.updates.values())
        .filter(u => u.status === 'pending' && u.id !== update.id);
      
      for (const processingUpdate of processingUpdates) {
        if (processingUpdate.action === update.action) {
          return {
            updateId: update.id,
            conflictType: 'concurrent',
            resolution: mergedOptions.conflictStrategy === 'lastWrite' ? 'discard' : 'retry',
          };
        }
      }

      return null;
    };

    const resolveConflict = async (
      conflict: ConflictResolution,
      update: OptimisticUpdate,
      asyncFn: () => Promise<any>
    ): Promise<any> => {
      switch (conflict.resolution) {
        case 'retry':
          // Retry with exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, mergedOptions.retryDelay * Math.pow(2, update.retryCount))
          );
          return asyncFn();
          
        case 'merge':
          // Merge strategies would be implemented here
          // This is application-specific
          return asyncFn();
          
        case 'discard':
          throw new Error('Update discarded due to conflict');
          
        case 'manual':
          // Would trigger UI for manual resolution
          throw new Error('Manual conflict resolution required');
          
        default:
          return asyncFn();
      }
    };

    const applyOptimisticUpdate = (
      state: T,
      update: OptimisticUpdate
    ): T => {
      // This is where you'd implement the actual state transformation
      // based on the action and payload. For now, we'll use a generic approach
      return produce(state, draft => {
        // Example: if action is 'updateField', apply the payload directly
        if (update.action.startsWith('update')) {
          Object.assign(draft, update.payload);
        }
        // Add more specific handlers based on your action types
      });
    };

    const optimisticActions: OptimisticActions<T> = {
      optimisticUpdate: async (action, payload, asyncFn, updateOptions = {}) => {
        const updateId = generateUpdateId();
        const update: OptimisticUpdate = {
          id: updateId,
          timestamp: Date.now(),
          action,
          payload,
          status: 'pending',
          retryCount: 0,
          maxRetries: updateOptions.maxRetries ?? mergedOptions.maxRetries,
          priority: updateOptions.priority ?? 0,
          ...updateOptions,
        };

        // Check for conflicts
        const conflict = detectConflict(update, get() as T);
        if (conflict) {
          optimisticState.conflicts.push(conflict);
          
          if (conflict.resolution === 'discard') {
            throw new Error('Update discarded due to conflict');
          }
        }

        // Create snapshot before update
        if (mergedOptions.enableSnapshots) {
          const currentState = get() as T;
          update.rollbackData = rollbackManager.createSnapshot(
            currentState,
            updateId,
            `Before ${action}`
          );
        }

        // Apply optimistic update
        optimisticState.updates.set(updateId, update);
        optimisticState.queue.push(updateId);
        
        set(produce((state: T & OptimisticActions<T>) => {
          const baseState = { ...state };
          delete (baseState as any).optimisticUpdate;
          delete (baseState as any).rollback;
          delete (baseState as any).getPendingUpdates;
          delete (baseState as any).clearOptimisticState;
          
          return {
            ...applyOptimisticUpdate(baseState as T, update),
            ...optimisticActions,
          } as T & OptimisticActions<T>;
        }));

        // Create queue item
        const queueItem: UpdateQueueItem = {
          update,
          execute: async () => {
            try {
              let result;
              
              if (conflict) {
                result = await resolveConflict(conflict, update, asyncFn);
              } else {
                result = await asyncFn();
              }

              // Update was successful
              optimisticState.updates.set(updateId, { ...update, status: 'success' });
              
              // Apply the real result if it differs from optimistic
              if (result && typeof result === 'object') {
                set(produce((state: T & OptimisticActions<T>) => {
                  Object.assign(state, result);
                }));
              }
            } catch (error) {
              // Rollback on failure
              optimisticState.updates.set(updateId, { 
                ...update, 
                status: 'failed',
                error: error instanceof Error ? error : new Error(String(error))
              });
              
              if (update.rollbackData && mergedOptions.enableSnapshots) {
                const rollbackResult = rollbackManager.rollback(get() as T, {
                  targetSnapshotId: update.rollbackData,
                  preservePending: true,
                });
                
                set(produce(() => ({
                  ...rollbackResult.state,
                  ...optimisticActions,
                } as T & OptimisticActions<T>)));
              }
              
              throw error;
            }
          },
          rollback: () => {
            if (update.rollbackData && mergedOptions.enableSnapshots) {
              const rollbackResult = rollbackManager.rollback(get() as T, {
                targetSnapshotId: update.rollbackData,
              });
              
              set(produce(() => ({
                ...rollbackResult.state,
                ...optimisticActions,
              } as T & OptimisticActions<T>)));
            }
          },
        };

        // Enqueue for processing
        await updateQueue.enqueue(queueItem, mergedOptions.dedupStrategy);
      },

      rollback: (rollbackOptions = {}) => {
        if (!mergedOptions.enableSnapshots) {
          console.warn('Snapshots are disabled. Cannot rollback.');
          return;
        }

        const rollbackResult = rollbackManager.rollback(get() as T, rollbackOptions);
        
        // Update the tracking state
        rollbackResult.rolledBackUpdates.forEach(updateId => {
          const update = optimisticState.updates.get(updateId);
          if (update) {
            optimisticState.updates.set(updateId, { ...update, status: 'rollback' });
          }
        });

        set(produce(() => ({
          ...rollbackResult.state,
          ...optimisticActions,
        } as T & OptimisticActions<T>)));
      },

      getPendingUpdates: () => {
        return Array.from(optimisticState.updates.values())
          .filter(update => update.status === 'pending');
      },

      clearOptimisticState: () => {
        optimisticState.updates.clear();
        optimisticState.queue = [];
        optimisticState.conflicts = [];
        updateQueue.clear();
        rollbackManager.clear();
      },
    };

    // Initialize the store with optimistic actions
    const initialState = config(
      set as any,
      get as any,
      api as StoreApi<T>
    );

    return {
      ...initialState,
      ...optimisticActions,
    };
  };
};