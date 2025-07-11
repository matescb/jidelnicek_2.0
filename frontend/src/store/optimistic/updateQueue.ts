import { 
  OptimisticUpdate, 
  UpdateQueueItem, 
  QueueOptions, 
  QueueStats,
  DedupStrategy 
} from './types';

export class UpdateQueue {
  private queue: UpdateQueueItem[] = [];
  private processing: Set<string> = new Set();
  private completed: Map<string, OptimisticUpdate> = new Map();
  private failed: Map<string, OptimisticUpdate> = new Map();
  private options: Required<QueueOptions>;
  private batchTimer: NodeJS.Timeout | null = null;
  private processingTimes: number[] = [];

  constructor(options: QueueOptions = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 3,
      processingStrategy: options.processingStrategy ?? 'fifo',
      batchingEnabled: options.batchingEnabled ?? true,
      batchSize: options.batchSize ?? 5,
      batchDelay: options.batchDelay ?? 50,
    };
  }

  async enqueue(item: UpdateQueueItem, dedupStrategy: DedupStrategy = 'replace'): Promise<void> {
    const existingIndex = this.queue.findIndex(
      (queueItem) => queueItem.update.action === item.update.action &&
        JSON.stringify(queueItem.update.payload) === JSON.stringify(item.update.payload)
    );

    if (existingIndex !== -1) {
      switch (dedupStrategy) {
        case 'ignore':
          return;
        case 'replace':
          this.queue[existingIndex] = item;
          return;
        case 'queue':
          // Continue to add to queue
          break;
      }
    }

    this.queue.push(item);
    this.sortQueue();

    if (this.options.batchingEnabled) {
      this.scheduleBatchProcessing();
    } else {
      await this.processNext();
    }
  }

  async processNext(): Promise<void> {
    if (this.processing.size >= this.options.maxConcurrent) {
      return;
    }

    const item = this.dequeue();
    if (!item) {
      return;
    }

    this.processing.add(item.update.id);
    const startTime = Date.now();

    try {
      await item.execute();
      this.completed.set(item.update.id, { ...item.update, status: 'success' });
      this.recordProcessingTime(Date.now() - startTime);
    } catch (error) {
      this.failed.set(item.update.id, { 
        ...item.update, 
        status: 'failed', 
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      // Handle retry logic
      if (item.update.retryCount < item.update.maxRetries) {
        const retryItem = {
          ...item,
          update: {
            ...item.update,
            retryCount: item.update.retryCount + 1,
          }
        };
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryItem.update.retryCount), 30000);
        setTimeout(() => this.enqueue(retryItem, 'ignore'), delay);
      }
    } finally {
      this.processing.delete(item.update.id);
      // Process next item
      await this.processNext();
    }
  }

  private dequeue(): UpdateQueueItem | undefined {
    if (this.queue.length === 0) {
      return undefined;
    }

    switch (this.options.processingStrategy) {
      case 'lifo':
        return this.queue.pop();
      case 'priority':
        // Already sorted by priority
        return this.queue.shift();
      case 'fifo':
      default:
        return this.queue.shift();
    }
  }

  private sortQueue(): void {
    if (this.options.processingStrategy === 'priority') {
      this.queue.sort((a, b) => b.update.priority - a.update.priority);
    }
  }

  private scheduleBatchProcessing(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(async () => {
      const batch = Math.min(this.options.batchSize, this.queue.length);
      const promises: Promise<void>[] = [];

      for (let i = 0; i < batch; i++) {
        if (this.processing.size < this.options.maxConcurrent) {
          promises.push(this.processNext());
        }
      }

      await Promise.all(promises);
      this.batchTimer = null;

      // Continue processing if there are more items
      if (this.queue.length > 0) {
        this.scheduleBatchProcessing();
      }
    }, this.options.batchDelay);
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only last 100 processing times
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
  }

  getStats(): QueueStats {
    const totalProcessed = this.completed.size + this.failed.size;
    const averageProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      totalProcessed,
      averageProcessingTime,
    };
  }

  getPending(): OptimisticUpdate[] {
    return this.queue.map(item => item.update);
  }

  getProcessing(): string[] {
    return Array.from(this.processing);
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.failed.clear();
    this.processingTimes = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  remove(updateId: string): boolean {
    const index = this.queue.findIndex(item => item.update.id === updateId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  prioritize(updateId: string, newPriority: number): boolean {
    const item = this.queue.find(item => item.update.id === updateId);
    if (item) {
      item.update.priority = newPriority;
      this.sortQueue();
      return true;
    }
    return false;
  }
}