import { Snapshot, RollbackOptions, OptimisticUpdate } from './types';
import { produce } from 'immer';

export class RollbackManager<T = any> {
  private snapshots: Map<string, Snapshot<T>> = new Map();
  private snapshotOrder: string[] = [];
  private maxSnapshots: number;
  private statePatches: Map<string, any[]> = new Map();

  constructor(maxSnapshots: number = 50) {
    this.maxSnapshots = maxSnapshots;
  }

  createSnapshot(
    state: T,
    updateId: string,
    description?: string
  ): string {
    const snapshotId = this.generateSnapshotId();
    const snapshot: Snapshot<T> = {
      id: snapshotId,
      timestamp: Date.now(),
      state: this.cloneState(state),
      updateId,
      description,
    };

    this.snapshots.set(snapshotId, snapshot);
    this.snapshotOrder.push(snapshotId);

    // Maintain max snapshots limit
    if (this.snapshotOrder.length > this.maxSnapshots) {
      const oldestId = this.snapshotOrder.shift();
      if (oldestId) {
        this.snapshots.delete(oldestId);
        this.statePatches.delete(oldestId);
      }
    }

    return snapshotId;
  }

  rollback(
    currentState: T,
    options: RollbackOptions = {}
  ): { state: T; rolledBackUpdates: string[] } {
    let targetSnapshot: Snapshot<T> | undefined;
    let rolledBackUpdates: string[] = [];

    if (options.targetSnapshotId) {
      targetSnapshot = this.snapshots.get(options.targetSnapshotId);
    } else if (options.targetUpdateId) {
      // Find the snapshot created before this update
      for (let i = this.snapshotOrder.length - 1; i >= 0; i--) {
        const snapshot = this.snapshots.get(this.snapshotOrder[i]);
        if (snapshot && snapshot.updateId === options.targetUpdateId) {
          if (i > 0) {
            targetSnapshot = this.snapshots.get(this.snapshotOrder[i - 1]);
          }
          break;
        }
      }
    } else {
      // Rollback to the most recent snapshot
      const lastSnapshotId = this.snapshotOrder[this.snapshotOrder.length - 2];
      targetSnapshot = lastSnapshotId ? this.snapshots.get(lastSnapshotId) : undefined;
    }

    if (!targetSnapshot) {
      throw new Error('No valid snapshot found for rollback');
    }

    // Collect rolled back update IDs
    const targetIndex = this.snapshotOrder.indexOf(targetSnapshot.id);
    for (let i = targetIndex + 1; i < this.snapshotOrder.length; i++) {
      const snapshot = this.snapshots.get(this.snapshotOrder[i]);
      if (snapshot) {
        rolledBackUpdates.push(snapshot.updateId);
      }
    }

    // Apply rollback
    let newState = this.cloneState(targetSnapshot.state);

    if (options.preservePending) {
      // Apply pending updates on top of rolled back state
      newState = this.mergePendingUpdates(newState, currentState);
    }

    if (options.cascade) {
      // Remove all snapshots after the target
      const toRemove = this.snapshotOrder.slice(targetIndex + 1);
      toRemove.forEach(id => {
        this.snapshots.delete(id);
        this.statePatches.delete(id);
      });
      this.snapshotOrder = this.snapshotOrder.slice(0, targetIndex + 1);
    }

    return { state: newState, rolledBackUpdates };
  }

  createPatch(
    oldState: T,
    newState: T,
    updateId: string
  ): void {
    const patches = this.generatePatches(oldState, newState);
    this.statePatches.set(updateId, patches);
  }

  applyPatch(
    state: T,
    updateId: string
  ): T | null {
    const patches = this.statePatches.get(updateId);
    if (!patches) {
      return null;
    }

    try {
      return this.applyPatches(state, patches);
    } catch (error) {
      console.error('Failed to apply patch:', error);
      return null;
    }
  }

  getSnapshot(snapshotId: string): Snapshot<T> | undefined {
    return this.snapshots.get(snapshotId);
  }

  getSnapshotByUpdateId(updateId: string): Snapshot<T> | undefined {
    for (const snapshot of this.snapshots.values()) {
      if (snapshot.updateId === updateId) {
        return snapshot;
      }
    }
    return undefined;
  }

  getSnapshotHistory(): Snapshot<T>[] {
    return this.snapshotOrder
      .map(id => this.snapshots.get(id))
      .filter((snapshot): snapshot is Snapshot<T> => snapshot !== undefined);
  }

  clear(): void {
    this.snapshots.clear();
    this.snapshotOrder = [];
    this.statePatches.clear();
  }

  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cloneState(state: T): T {
    // Deep clone using structured clone if available, otherwise JSON
    if (typeof structuredClone !== 'undefined') {
      try {
        return structuredClone(state);
      } catch {
        // Fallback to JSON for non-cloneable objects
      }
    }
    return JSON.parse(JSON.stringify(state));
  }

  private generatePatches(oldState: T, newState: T): any[] {
    // Simple diff implementation - in production, use a proper diff library
    const patches: any[] = [];
    
    const diff = (obj1: any, obj2: any, path: string[] = []): void => {
      if (obj1 === obj2) return;
      
      if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || !obj1 || !obj2) {
        patches.push({ op: 'replace', path: [...path], value: obj2 });
        return;
      }

      const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
      
      for (const key of keys) {
        if (!(key in obj2)) {
          patches.push({ op: 'remove', path: [...path, key] });
        } else if (!(key in obj1)) {
          patches.push({ op: 'add', path: [...path, key], value: obj2[key] });
        } else {
          diff(obj1[key], obj2[key], [...path, key]);
        }
      }
    };

    diff(oldState, newState);
    return patches;
  }

  private applyPatches(state: T, patches: any[]): T {
    return produce(state, draft => {
      for (const patch of patches) {
        const target = this.getTarget(draft, patch.path.slice(0, -1));
        const key = patch.path[patch.path.length - 1];

        switch (patch.op) {
          case 'add':
          case 'replace':
            if (target && key !== undefined) {
              (target as any)[key] = patch.value;
            }
            break;
          case 'remove':
            if (target && key !== undefined) {
              delete (target as any)[key];
            }
            break;
        }
      }
    });
  }

  private getTarget(obj: any, path: string[]): any {
    let current = obj;
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        return null;
      }
      current = current[key];
    }
    return current;
  }

  private mergePendingUpdates(baseState: T, currentState: T): T {
    // This is a simplified merge - in production, use a more sophisticated strategy
    return produce(baseState, draft => {
      // Copy over specific fields that represent pending updates
      // This would need to be customized based on your state structure
      if ('pendingUpdates' in (currentState as any)) {
        (draft as any).pendingUpdates = (currentState as any).pendingUpdates;
      }
    });
  }
}