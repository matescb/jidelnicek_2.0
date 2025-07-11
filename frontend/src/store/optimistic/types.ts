import { StateCreator } from 'zustand';

export interface OptimisticUpdate<T = any> {
  id: string;
  timestamp: number;
  action: string;
  payload: T;
  status: 'pending' | 'success' | 'failed' | 'rollback';
  retryCount: number;
  maxRetries: number;
  priority: number;
  rollbackData?: any;
  error?: Error;
}

export interface OptimisticState {
  updates: Map<string, OptimisticUpdate>;
  queue: string[];
  processing: boolean;
  conflicts: ConflictResolution[];
}

export interface ConflictResolution {
  updateId: string;
  conflictType: 'version' | 'data' | 'concurrent';
  resolution: 'retry' | 'merge' | 'discard' | 'manual';
  resolvedAt?: number;
}

export interface OptimisticOptions {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  conflictStrategy?: ConflictStrategy;
  enableSnapshots?: boolean;
  maxSnapshots?: number;
  dedupStrategy?: DedupStrategy;
}

export type ConflictStrategy = 'lastWrite' | 'firstWrite' | 'merge' | 'manual';
export type DedupStrategy = 'ignore' | 'replace' | 'queue';

export interface Snapshot<T = any> {
  id: string;
  timestamp: number;
  state: T;
  updateId: string;
  description?: string;
}

export interface RollbackOptions {
  targetUpdateId?: string;
  targetSnapshotId?: string;
  preservePending?: boolean;
  cascade?: boolean;
}

export type OptimisticMiddleware = <T extends object>(
  config: StateCreator<T>,
  options?: OptimisticOptions
) => StateCreator<T & OptimisticActions<T>>;

export interface OptimisticActions<T> {
  optimisticUpdate: <P = any>(
    action: string,
    payload: P,
    asyncFn: () => Promise<any>,
    options?: Partial<OptimisticUpdate>
  ) => Promise<void>;
  rollback: (options?: RollbackOptions) => void;
  getPendingUpdates: () => OptimisticUpdate[];
  clearOptimisticState: () => void;
}

export interface UpdateQueueItem {
  update: OptimisticUpdate;
  execute: () => Promise<void>;
  rollback: () => void;
}

export interface QueueOptions {
  maxConcurrent?: number;
  processingStrategy?: 'fifo' | 'lifo' | 'priority';
  batchingEnabled?: boolean;
  batchSize?: number;
  batchDelay?: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
}