import React, { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'
import { Button } from '../button'

export interface InfiniteLoaderProps {
  hasMore: boolean
  isLoading: boolean
  isError?: boolean
  onLoadMore: () => void
  onRetry?: () => void
  threshold?: number
  rootMargin?: string
  loadingMessage?: string
  endMessage?: string
  errorMessage?: string
  className?: string
  spinnerVariant?: 'circle' | 'dots' | 'bars' | 'pulse'
}

export const InfiniteLoader: React.FC<InfiniteLoaderProps> = ({
  hasMore,
  isLoading,
  isError = false,
  onLoadMore,
  onRetry,
  threshold = 0.1,
  rootMargin = '100px',
  loadingMessage = 'Loading more...',
  endMessage = 'No more items to load',
  errorMessage = 'Failed to load items',
  className,
  spinnerVariant = 'dots'
}) => {
  const observerTarget = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries
    if (target.isIntersecting && hasMore && !isLoading && !isError) {
      onLoadMore()
    }
  }, [hasMore, isLoading, isError, onLoadMore])
  
  useEffect(() => {
    const element = observerTarget.current
    if (!element) return
    
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }
    
    // Create new observer
    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold,
      rootMargin
    })
    
    observerRef.current.observe(element)
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [handleObserver, threshold, rootMargin])
  
  const renderContent = () => {
    if (isError) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex flex-col items-center gap-3 py-8"
        >
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Retry
            </Button>
          )}
        </motion.div>
      )
    }
    
    if (isLoading) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex flex-col items-center gap-3 py-8"
        >
          <Spinner variant={spinnerVariant} size="md" />
          <p className="text-gray-600 dark:text-gray-400">{loadingMessage}</p>
        </motion.div>
      )
    }
    
    if (!hasMore) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center py-8"
        >
          <p className="text-gray-500 dark:text-gray-400">{endMessage}</p>
        </motion.div>
      )
    }
    
    return null
  }
  
  return (
    <div className={cn('w-full', className)}>
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
      
      {/* Intersection Observer Target */}
      {hasMore && !isError && (
        <div 
          ref={observerTarget} 
          className="h-1 w-full"
          aria-hidden="true"
        />
      )}
    </div>
  )
}