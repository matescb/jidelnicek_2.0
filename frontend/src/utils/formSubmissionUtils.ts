/**
 * Utility functions for common form submission patterns
 */

import { useCallback, useRef, useState } from 'react'

/**
 * Debounced form submission
 */
export function useDebouncedSubmit<T = any>(
  handler: (data: T) => Promise<void> | void,
  delay = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const [isPending, setIsPending] = useState(false)

  const debouncedSubmit = useCallback(
    (data: T) => {
      setIsPending(true)
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(async () => {
        try {
          await handler(data)
        } finally {
          setIsPending(false)
        }
      }, delay)
    },
    [handler, delay]
  )

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      setIsPending(false)
    }
  }, [])

  return { debouncedSubmit, cancel, isPending }
}

/**
 * Throttled form submission
 */
export function useThrottledSubmit<T = any>(
  handler: (data: T) => Promise<void> | void,
  interval = 1000
) {
  const lastRunRef = useRef<number>(0)
  const [isThrottled, setIsThrottled] = useState(false)

  const throttledSubmit = useCallback(
    async (data: T) => {
      const now = Date.now()
      const timeSinceLastRun = now - lastRunRef.current

      if (timeSinceLastRun < interval) {
        setIsThrottled(true)
        setTimeout(() => setIsThrottled(false), interval - timeSinceLastRun)
        return
      }

      lastRunRef.current = now
      await handler(data)
    },
    [handler, interval]
  )

  return { throttledSubmit, isThrottled }
}

/**
 * Sequential form submissions
 */
export function useSequentialSubmit<T = any, R = any>() {
  const [queue, setQueue] = useState<Array<{ data: T; handler: (data: T) => Promise<R> }>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<R[]>([])
  const [errors, setErrors] = useState<Error[]>([])

  const addToQueue = useCallback((data: T, handler: (data: T) => Promise<R>) => {
    setQueue(prev => [...prev, { data, handler }])
  }, [])

  const processQueue = useCallback(async () => {
    if (isProcessing || queue.length === 0) return

    setIsProcessing(true)
    setCurrentIndex(0)
    setResults([])
    setErrors([])

    for (let i = 0; i < queue.length; i++) {
      setCurrentIndex(i)
      const { data, handler } = queue[i]

      try {
        const result = await handler(data)
        setResults(prev => [...prev, result])
      } catch (error) {
        setErrors(prev => [...prev, error as Error])
        // Continue processing or stop based on your requirements
      }
    }

    setQueue([])
    setIsProcessing(false)
  }, [queue, isProcessing])

  const clear = useCallback(() => {
    setQueue([])
    setCurrentIndex(0)
    setResults([])
    setErrors([])
  }, [])

  return {
    addToQueue,
    processQueue,
    clear,
    isProcessing,
    currentIndex,
    totalItems: queue.length,
    results,
    errors,
    progress: queue.length > 0 ? (currentIndex / queue.length) * 100 : 0,
  }
}

/**
 * Batch form submissions
 */
export function useBatchSubmit<T = any, R = any>(
  handler: (items: T[]) => Promise<R>,
  options: {
    batchSize?: number
    debounceDelay?: number
  } = {}
) {
  const { batchSize = 10, debounceDelay = 500 } = options
  const [batch, setBatch] = useState<T[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const submitBatch = useCallback(async () => {
    if (batch.length === 0) return

    setIsSubmitting(true)
    try {
      await handler(batch)
      setBatch([])
    } finally {
      setIsSubmitting(false)
    }
  }, [batch, handler])

  const addToBatch = useCallback(
    (item: T) => {
      setBatch(prev => {
        const newBatch = [...prev, item]
        
        // Submit immediately if batch is full
        if (newBatch.length >= batchSize) {
          submitBatch()
          return []
        }
        
        return newBatch
      })

      // Debounce submission
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(submitBatch, debounceDelay)
    },
    [batchSize, debounceDelay, submitBatch]
  )

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    await submitBatch()
  }, [submitBatch])

  return {
    addToBatch,
    flush,
    isSubmitting,
    batchSize: batch.length,
  }
}

/**
 * Form submission with exponential backoff retry
 */
export function useRetrySubmit<T = any, R = any>(
  handler: (data: T) => Promise<R>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
  } = {}
) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
  } = options

  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastError, setLastError] = useState<Error | null>(null)

  const submitWithRetry = useCallback(
    async (data: T): Promise<R> => {
      let attempt = 0
      let delay = initialDelay

      while (attempt <= maxRetries) {
        try {
          setIsRetrying(attempt > 0)
          setRetryCount(attempt)
          
          const result = await handler(data)
          
          // Success - reset state
          setRetryCount(0)
          setLastError(null)
          setIsRetrying(false)
          
          return result
        } catch (error) {
          setLastError(error as Error)
          attempt++

          if (attempt > maxRetries) {
            setIsRetrying(false)
            throw error
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay))
          
          // Calculate next delay with exponential backoff
          delay = Math.min(delay * backoffFactor, maxDelay)
        }
      }

      throw lastError || new Error('Max retries exceeded')
    },
    [handler, maxRetries, initialDelay, maxDelay, backoffFactor]
  )

  return {
    submit: submitWithRetry,
    retryCount,
    isRetrying,
    lastError,
    canRetry: retryCount < maxRetries,
  }
}

/**
 * Progress tracking for long-running submissions
 */
export function useProgressTracking() {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [steps, setSteps] = useState<Array<{ name: string; completed: boolean }>>([])

  const updateProgress = useCallback((value: number, status?: string) => {
    setProgress(Math.min(100, Math.max(0, value)))
    if (status) {
      setStatus(status)
    }
  }, [])

  const addStep = useCallback((name: string) => {
    setSteps(prev => [...prev, { name, completed: false }])
  }, [])

  const completeStep = useCallback((index: number) => {
    setSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, completed: true } : step
    ))
  }, [])

  const reset = useCallback(() => {
    setProgress(0)
    setStatus('')
    setSteps([])
  }, [])

  return {
    progress,
    status,
    steps,
    updateProgress,
    addStep,
    completeStep,
    reset,
    completedSteps: steps.filter(s => s.completed).length,
    totalSteps: steps.length,
  }
}

/**
 * Auto-save form data
 */
export function useAutoSave<T = any>(
  saveHandler: (data: T) => Promise<void> | void,
  options: {
    debounceDelay?: number
    enabled?: boolean
    onSuccess?: () => void
    onError?: (error: Error) => void
  } = {}
) {
  const {
    debounceDelay = 1000,
    enabled = true,
    onSuccess,
    onError,
  } = options

  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const save = useCallback(
    async (data: T) => {
      if (!enabled) return

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(async () => {
        setIsSaving(true)
        try {
          await saveHandler(data)
          setLastSaved(new Date())
          onSuccess?.()
        } catch (error) {
          onError?.(error as Error)
        } finally {
          setIsSaving(false)
        }
      }, debounceDelay)
    },
    [enabled, saveHandler, debounceDelay, onSuccess, onError]
  )

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    save,
    cancel,
    isSaving,
    lastSaved,
  }
}

/**
 * Form submission queue with priority
 */
export interface QueuedSubmission<T = any> {
  id: string
  data: T
  priority: number
  timestamp: number
}

export function usePriorityQueue<T = any, R = any>(
  handler: (data: T) => Promise<R>
) {
  const [queue, setQueue] = useState<QueuedSubmission<T>[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentItem, setCurrentItem] = useState<QueuedSubmission<T> | null>(null)

  const enqueue = useCallback((data: T, priority = 0) => {
    const item: QueuedSubmission<T> = {
      id: `${Date.now()}-${Math.random()}`,
      data,
      priority,
      timestamp: Date.now(),
    }

    setQueue(prev => {
      const next = [...prev, item]
      // Sort by priority (higher first), then by timestamp (older first)
      return next.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return a.timestamp - b.timestamp
      })
    })

    return item.id
  }, [])

  const processNext = useCallback(async () => {
    if (isProcessing || queue.length === 0) return

    const [next, ...rest] = queue
    setQueue(rest)
    setCurrentItem(next)
    setIsProcessing(true)

    try {
      await handler(next.data)
    } finally {
      setIsProcessing(false)
      setCurrentItem(null)
      
      // Process next item if available
      if (rest.length > 0) {
        setTimeout(processNext, 0)
      }
    }
  }, [queue, isProcessing, handler])

  const remove = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id))
  }, [])

  const clear = useCallback(() => {
    setQueue([])
  }, [])

  return {
    enqueue,
    processNext,
    remove,
    clear,
    queue,
    isProcessing,
    currentItem,
    size: queue.length,
  }
}