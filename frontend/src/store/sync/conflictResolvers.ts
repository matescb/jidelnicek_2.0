/**
 * Conflict resolution strategies for state synchronization
 */

import type { ConflictResolver, ConflictMeta } from './types'
import { isEqual, merge, cloneDeep } from 'lodash-es'

/**
 * Last Write Wins - Uses timestamp to resolve conflicts
 */
export const lastWriteWinsResolver: ConflictResolver = {
  resolve: (local: any, remote: any, meta?: ConflictMeta) => {
    if (!meta) return remote
    
    const localTime = meta.localTimestamp || 0
    const remoteTime = meta.remoteTimestamp || 0
    
    return remoteTime > localTime ? remote : local
  }
}

/**
 * Version-based resolver - Uses version numbers to resolve conflicts
 */
export const versionResolver: ConflictResolver = {
  resolve: (local: any, remote: any, meta?: ConflictMeta) => {
    if (!meta) return remote
    
    const localVersion = meta.localVersion || 0
    const remoteVersion = meta.remoteVersion || 0
    
    if (remoteVersion > localVersion) {
      return remote
    } else if (localVersion > remoteVersion) {
      return local
    } else {
      // Same version, fall back to timestamp
      return lastWriteWinsResolver.resolve(local, remote, meta)
    }
  }
}

/**
 * Array merge resolver - Merges arrays intelligently
 */
export const arrayMergeResolver: ConflictResolver<any[]> = {
  resolve: (local: any[], remote: any[], meta?: ConflictMeta) => {
    // If one is not an array, prefer the array
    if (!Array.isArray(local)) return remote
    if (!Array.isArray(remote)) return local
    
    // For arrays of objects with IDs, merge by ID
    if (local.length > 0 && remote.length > 0 && 
        typeof local[0] === 'object' && 'id' in local[0] &&
        typeof remote[0] === 'object' && 'id' in remote[0]) {
      
      const merged = new Map<string | number, any>()
      
      // Add all local items
      local.forEach(item => {
        merged.set(item.id, item)
      })
      
      // Merge remote items
      remote.forEach(item => {
        const existing = merged.get(item.id)
        if (existing) {
          // Item exists in both, use timestamp to decide
          const localTime = existing.updatedAt || existing.createdAt || meta?.localTimestamp || 0
          const remoteTime = item.updatedAt || item.createdAt || meta?.remoteTimestamp || 0
          
          merged.set(item.id, remoteTime > localTime ? item : existing)
        } else {
          merged.set(item.id, item)
        }
      })
      
      return Array.from(merged.values())
    }
    
    // For simple arrays, union them
    return Array.from(new Set([...local, ...remote]))
  },
  
  shouldResolve: (path: string[]) => {
    // Only resolve if the path ends with an array property
    return true
  }
}

/**
 * Object merge resolver - Deep merges objects
 */
export const objectMergeResolver: ConflictResolver<Record<string, any>> = {
  resolve: (local: Record<string, any>, remote: Record<string, any>, meta?: ConflictMeta) => {
    // If one is not an object, use last write wins
    if (typeof local !== 'object' || local === null) return remote
    if (typeof remote !== 'object' || remote === null) return local
    
    // Deep merge with conflict resolution for each property
    const merged = cloneDeep(local)
    
    Object.keys(remote).forEach(key => {
      if (!(key in merged)) {
        // Property only exists in remote
        merged[key] = remote[key]
      } else if (!isEqual(merged[key], remote[key])) {
        // Property exists in both but different
        if (typeof merged[key] === 'object' && typeof remote[key] === 'object') {
          // Recursively merge objects
          merged[key] = objectMergeResolver.resolve(merged[key], remote[key], meta)
        } else {
          // Use timestamp for primitive values
          const remoteTime = meta?.remoteTimestamp || 0
          const localTime = meta?.localTimestamp || 0
          merged[key] = remoteTime > localTime ? remote[key] : merged[key]
        }
      }
    })
    
    return merged
  }
}

/**
 * Counter resolver - For numeric counters, accumulates changes
 */
export const counterResolver: ConflictResolver<number> = {
  resolve: (local: number, remote: number, meta?: ConflictMeta) => {
    // For counters, we might want to accumulate changes rather than replace
    // This requires tracking the base value, which would be in meta
    // For now, just use the higher value
    return Math.max(local, remote)
  }
}

/**
 * Set resolver - Merges sets
 */
export const setResolver: ConflictResolver<Set<any>> = {
  resolve: (local: Set<any>, remote: Set<any>) => {
    if (!(local instanceof Set)) return remote
    if (!(remote instanceof Set)) return local
    
    return new Set([...local, ...remote])
  }
}

/**
 * Custom field resolvers for specific use cases
 */
export const fieldResolvers: Record<string, ConflictResolver> = {
  // User preferences - local takes precedence
  'userPreferences': {
    resolve: (local: any, remote: any) => local
  },
  
  // Collaborative text - merge changes
  'sharedText': {
    resolve: (local: string, remote: string, meta?: ConflictMeta) => {
      // In a real implementation, this could use OT or CRDT
      // For now, concatenate with a separator if different
      if (local === remote) return local
      return `${local}\n--- Merged ---\n${remote}`
    }
  },
  
  // Shopping list items - merge and dedupe
  'shoppingList': arrayMergeResolver,
  
  // Participants - merge by ID with version check
  'participants': {
    resolve: (local: any[], remote: any[], meta?: ConflictMeta) => {
      return arrayMergeResolver.resolve(local, remote, meta)
    }
  },
  
  // Trip status - remote wins (server authority)
  'status': {
    resolve: (local: any, remote: any) => remote
  }
}

/**
 * Create a custom resolver with field-specific strategies
 */
export function createFieldResolver(
  fieldStrategies: Record<string, ConflictResolutionStrategy | ConflictResolver>
): ConflictResolver {
  return {
    resolve: (local: any, remote: any, meta?: ConflictMeta) => {
      const path = meta?.localUserId // This would need to be properly implemented
      
      // Deep merge with field-specific strategies
      const merged = cloneDeep(local)
      
      const applyStrategy = (obj: any, path: string[] = []): any => {
        Object.keys(remote).forEach(key => {
          const currentPath = [...path, key]
          const pathStr = currentPath.join('.')
          
          if (pathStr in fieldStrategies) {
            const strategy = fieldStrategies[pathStr]
            
            if (typeof strategy === 'string') {
              // Use predefined resolver
              switch (strategy) {
                case 'lastWriteWins':
                  obj[key] = lastWriteWinsResolver.resolve(obj[key], remote[key], meta)
                  break
                case 'version':
                  obj[key] = versionResolver.resolve(obj[key], remote[key], meta)
                  break
                default:
                  obj[key] = remote[key]
              }
            } else {
              // Use custom resolver
              obj[key] = strategy.resolve(obj[key], remote[key], meta)
            }
          } else if (typeof obj[key] === 'object' && typeof remote[key] === 'object') {
            // Recursively apply strategies
            obj[key] = applyStrategy(obj[key], currentPath)
          } else {
            // Default to last write wins
            obj[key] = lastWriteWinsResolver.resolve(obj[key], remote[key], meta)
          }
        })
        
        return obj
      }
      
      return applyStrategy(merged)
    }
  }
}

/**
 * Optimistic update resolver - Reorders operations for consistency
 */
export const optimisticResolver: ConflictResolver = {
  resolve: (local: any, remote: any, meta?: ConflictMeta) => {
    // If we have optimistic updates that haven't been confirmed,
    // we need to rebase them on top of the remote state
    // This would require tracking operation history
    
    // For now, remote wins but we could implement operation transform
    return remote
  }
}

/**
 * Create a resolver that delegates to specific resolvers based on data type
 */
export function createSmartResolver(): ConflictResolver {
  return {
    resolve: (local: any, remote: any, meta?: ConflictMeta) => {
      // Null/undefined handling
      if (local === null || local === undefined) return remote
      if (remote === null || remote === undefined) return local
      
      // Type-based resolution
      if (Array.isArray(local) && Array.isArray(remote)) {
        return arrayMergeResolver.resolve(local, remote, meta)
      } else if (local instanceof Set && remote instanceof Set) {
        return setResolver.resolve(local, remote, meta)
      } else if (typeof local === 'object' && typeof remote === 'object') {
        return objectMergeResolver.resolve(local, remote, meta)
      } else if (typeof local === 'number' && typeof remote === 'number') {
        // Check if it looks like a counter (integer values)
        if (Number.isInteger(local) && Number.isInteger(remote)) {
          return counterResolver.resolve(local, remote, meta)
        }
      }
      
      // Default to last write wins
      return lastWriteWinsResolver.resolve(local, remote, meta)
    }
  }
}