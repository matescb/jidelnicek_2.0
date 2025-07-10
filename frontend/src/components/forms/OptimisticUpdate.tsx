/**
 * Optimistic UI update component
 * Shows temporary success state with rollback on error
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import clsx from 'clsx'
import { Check, AlertCircle, RefreshCw, Cloud, CloudOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

export interface OptimisticUpdateState<T = any> {
  /**
   * Current data
   */
  data: T
  /**
   * Optimistic data (temporary)
   */
  optimisticData: T | null
  /**
   * Is syncing with server
   */
  isSyncing: boolean
  /**
   * Has sync error
   */
  hasError: boolean
  /**
   * Error details
   */
  error: Error | null
  /**
   * Is showing optimistic state
   */
  isOptimistic: boolean
}

export interface OptimisticUpdateProps<T = any> {
  /**
   * Initial data
   */
  initialData: T
  /**
   * Update handler (returns promise)
   */
  onUpdate: (data: T) => Promise<T>
  /**
   * Optimistic update transformer
   */
  optimisticUpdate?: (currentData: T, update: Partial<T>) => T
  /**
   * Show sync indicator
   */
  showSyncIndicator?: boolean
  /**
   * Auto-retry on error
   */
  autoRetry?: boolean
  /**
   * Max retry attempts
   */
  maxRetries?: number
  /**
   * Retry delay (ms)
   */
  retryDelay?: number
  /**
   * Rollback delay on error (ms)
   */
  rollbackDelay?: number
  /**
   * Children render function
   */
  children: (state: OptimisticUpdateState<T>, actions: {
    update: (data: Partial<T>) => Promise<void>
    retry: () => Promise<void>
    reset: () => void
  }) => React.ReactNode
  /**
   * On success callback
   */
  onSuccess?: (data: T) => void
  /**
   * On error callback
   */
  onError?: (error: Error, previousData: T) => void
}

export function OptimisticUpdate<T = any>({
  initialData,
  onUpdate,
  optimisticUpdate = (current, update) => ({ ...current, ...update }),
  showSyncIndicator = true,
  autoRetry = true,
  maxRetries = 3,
  retryDelay = 1000,
  rollbackDelay = 3000,
  children,
  onSuccess,
  onError,
}: OptimisticUpdateProps<T>) {
  const { t } = useTranslation()
  const [data, setData] = useState<T>(initialData)
  const [optimisticData, setOptimisticData] = useState<T | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const rollbackTimeoutRef = useRef<NodeJS.Timeout>()
  const retryTimeoutRef = useRef<NodeJS.Timeout>()

  const isOptimistic = optimisticData !== null

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (rollbackTimeoutRef.current) clearTimeout(rollbackTimeoutRef.current)
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

  const reset = useCallback(() => {
    setOptimisticData(null)
    setIsSyncing(false)
    setHasError(false)
    setError(null)
    setRetryCount(0)
    if (rollbackTimeoutRef.current) clearTimeout(rollbackTimeoutRef.current)
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
  }, [])

  const performUpdate = useCallback(
    async (updateData: T, isRetry = false) => {
      try {
        setIsSyncing(true)
        setHasError(false)
        setError(null)

        const result = await onUpdate(updateData)
        
        // Success - update real data
        setData(result)
        setOptimisticData(null)
        setRetryCount(0)
        
        if (onSuccess) {
          onSuccess(result)
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Update failed')
        setHasError(true)
        setError(error)
        
        if (onError) {
          onError(error, data)
        }

        // Handle retry logic
        if (autoRetry && retryCount < maxRetries) {
          setRetryCount(prev => prev + 1)
          retryTimeoutRef.current = setTimeout(() => {
            performUpdate(updateData, true)
          }, retryDelay * Math.pow(2, retryCount)) // Exponential backoff
        } else {
          // Rollback after delay
          rollbackTimeoutRef.current = setTimeout(() => {
            setOptimisticData(null)
            setRetryCount(0)
          }, rollbackDelay)
        }
      } finally {
        setIsSyncing(false)
      }
    },
    [onUpdate, data, autoRetry, maxRetries, retryDelay, rollbackDelay, retryCount, onSuccess, onError]
  )

  const update = useCallback(
    async (updateData: Partial<T>) => {
      // Apply optimistic update immediately
      const newOptimisticData = optimisticUpdate(isOptimistic ? optimisticData : data, updateData)
      setOptimisticData(newOptimisticData)
      
      // Sync with server
      await performUpdate(newOptimisticData)
    },
    [data, optimisticData, isOptimistic, optimisticUpdate, performUpdate]
  )

  const retry = useCallback(async () => {
    if (optimisticData) {
      setRetryCount(0)
      await performUpdate(optimisticData, true)
    }
  }, [optimisticData, performUpdate])

  const state: OptimisticUpdateState<T> = {
    data: isOptimistic ? optimisticData : data,
    optimisticData,
    isSyncing,
    hasError,
    error,
    isOptimistic,
  }

  const actions = {
    update,
    retry,
    reset,
  }

  return (
    <>
      {children(state, actions)}
      {showSyncIndicator && <SyncIndicator state={state} onRetry={retry} />}
    </>
  )
}

/**
 * Sync indicator component
 */
interface SyncIndicatorProps<T = any> {
  state: OptimisticUpdateState<T>
  onRetry?: () => void
}

function SyncIndicator<T = any>({ state, onRetry }: SyncIndicatorProps<T>) {
  const { t } = useTranslation()
  const { isSyncing, hasError, isOptimistic } = state

  if (!isOptimistic && !isSyncing && !hasError) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-4 right-4 z-50"
      >
        <div
          className={clsx(
            'flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg',
            'text-sm font-medium',
            hasError
              ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : isSyncing
              ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
          )}
        >
          {hasError ? (
            <>
              <CloudOff className="h-4 w-4" />
              <span>{t('form.syncError')}</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="ml-2 p-1 hover:bg-black/10 rounded"
                  aria-label={t('common.retry')}
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
            </>
          ) : isSyncing ? (
            <>
              <Cloud className="h-4 w-4 animate-pulse" />
              <span>{t('form.syncing')}</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>{t('form.synced')}</span>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Hook for managing optimistic updates
 */
export function useOptimisticUpdate<T = any>(
  initialData: T,
  options: Omit<OptimisticUpdateProps<T>, 'initialData' | 'children'>
) {
  const [state, setState] = useState<OptimisticUpdateState<T>>({
    data: initialData,
    optimisticData: null,
    isSyncing: false,
    hasError: false,
    error: null,
    isOptimistic: false,
  })

  const updateState = useCallback((updates: Partial<OptimisticUpdateState<T>>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const component = useCallback(
    (children: OptimisticUpdateProps<T>['children']) => (
      <OptimisticUpdate
        initialData={initialData}
        {...options}
        onSuccess={(data) => {
          updateState({ data, optimisticData: null, isOptimistic: false })
          options.onSuccess?.(data)
        }}
        onError={(error, previousData) => {
          updateState({ hasError: true, error })
          options.onError?.(error, previousData)
        }}
      >
        {children}
      </OptimisticUpdate>
    ),
    [initialData, options, updateState]
  )

  return {
    ...state,
    OptimisticUpdate: component,
  }
}

/**
 * Optimistic list updates
 */
export interface OptimisticListProps<T = any> {
  /**
   * List items
   */
  items: T[]
  /**
   * Item key extractor
   */
  keyExtractor: (item: T) => string | number
  /**
   * Add item handler
   */
  onAdd?: (item: T) => Promise<T>
  /**
   * Update item handler
   */
  onUpdate?: (id: string | number, item: Partial<T>) => Promise<T>
  /**
   * Delete item handler
   */
  onDelete?: (id: string | number) => Promise<void>
  /**
   * Reorder handler
   */
  onReorder?: (items: T[]) => Promise<T[]>
  /**
   * Children render function
   */
  children: (
    items: T[],
    actions: {
      add: (item: T) => Promise<void>
      update: (id: string | number, updates: Partial<T>) => Promise<void>
      delete: (id: string | number) => Promise<void>
      reorder: (fromIndex: number, toIndex: number) => Promise<void>
    },
    state: {
      pendingAdds: Set<string | number>
      pendingUpdates: Map<string | number, Partial<T>>
      pendingDeletes: Set<string | number>
      errors: Map<string | number, Error>
    }
  ) => React.ReactNode
}

export function OptimisticList<T = any>({
  items: initialItems,
  keyExtractor,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  children,
}: OptimisticListProps<T>) {
  const [items, setItems] = useState(initialItems)
  const [pendingAdds, setPendingAdds] = useState<Set<string | number>>(new Set())
  const [pendingUpdates, setPendingUpdates] = useState<Map<string | number, Partial<T>>>(new Map())
  const [pendingDeletes, setPendingDeletes] = useState<Set<string | number>>(new Set())
  const [errors, setErrors] = useState<Map<string | number, Error>>(new Map())

  // Update items when initialItems change
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const add = useCallback(
    async (item: T) => {
      if (!onAdd) return

      const id = keyExtractor(item)
      const optimisticItems = [...items, item]
      
      setPendingAdds(prev => new Set(prev).add(id))
      setItems(optimisticItems)

      try {
        const result = await onAdd(item)
        setItems(prev => prev.map(i => keyExtractor(i) === id ? result : i))
      } catch (error) {
        setItems(prev => prev.filter(i => keyExtractor(i) !== id))
        setErrors(prev => new Map(prev).set(id, error as Error))
      } finally {
        setPendingAdds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [items, keyExtractor, onAdd]
  )

  const update = useCallback(
    async (id: string | number, updates: Partial<T>) => {
      if (!onUpdate) return

      setPendingUpdates(prev => new Map(prev).set(id, updates))
      setItems(prev => prev.map(item => 
        keyExtractor(item) === id ? { ...item, ...updates } : item
      ))

      try {
        const result = await onUpdate(id, updates)
        setItems(prev => prev.map(item => 
          keyExtractor(item) === id ? result : item
        ))
      } catch (error) {
        // Rollback
        setItems(initialItems)
        setErrors(prev => new Map(prev).set(id, error as Error))
      } finally {
        setPendingUpdates(prev => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
      }
    },
    [initialItems, keyExtractor, onUpdate]
  )

  const deleteItem = useCallback(
    async (id: string | number) => {
      if (!onDelete) return

      const itemToDelete = items.find(item => keyExtractor(item) === id)
      if (!itemToDelete) return

      setPendingDeletes(prev => new Set(prev).add(id))
      setItems(prev => prev.filter(item => keyExtractor(item) !== id))

      try {
        await onDelete(id)
      } catch (error) {
        // Rollback
        setItems(prev => [...prev, itemToDelete])
        setErrors(prev => new Map(prev).set(id, error as Error))
      } finally {
        setPendingDeletes(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [items, keyExtractor, onDelete]
  )

  const reorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!onReorder) return

      const reorderedItems = [...items]
      const [movedItem] = reorderedItems.splice(fromIndex, 1)
      reorderedItems.splice(toIndex, 0, movedItem)

      setItems(reorderedItems)

      try {
        const result = await onReorder(reorderedItems)
        setItems(result)
      } catch (error) {
        // Rollback
        setItems(items)
        setErrors(prev => new Map(prev).set('reorder', error as Error))
      }
    },
    [items, onReorder]
  )

  const actions = { add, update, delete: deleteItem, reorder }
  const state = { pendingAdds, pendingUpdates, pendingDeletes, errors }

  return <>{children(items, actions, state)}</>
}