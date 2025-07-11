import React, { useRef, useState, useCallback, useEffect } from 'react'
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  threshold?: number
  maxPull?: number
  refreshContent?: React.ReactNode
  className?: string
  indicatorClassName?: string
  disabled?: boolean
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 80,
  maxPull = 150,
  refreshContent,
  className,
  indicatorClassName,
  disabled = false
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const controls = useAnimation()
  const y = useMotionValue(0)
  
  // Transform values for animations
  const indicatorOpacity = useTransform(y, [0, threshold], [0, 1])
  const indicatorScale = useTransform(y, [0, threshold, maxPull], [0.8, 1, 1.2])
  const iconRotation = useTransform(y, [0, threshold, maxPull], [0, 180, 360])

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || disabled) return
    
    setIsRefreshing(true)
    controls.start({ y: threshold })
    
    try {
      await onRefresh()
    } finally {
      await controls.start({ y: 0 })
      setIsRefreshing(false)
    }
  }, [onRefresh, isRefreshing, disabled, controls, threshold])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return
    
    const scrollTop = containerRef.current?.scrollTop || 0
    if (scrollTop === 0) {
      setIsPulling(true)
    }
  }, [disabled, isRefreshing])

  const handleDragEnd = useCallback(() => {
    if (!isPulling) return
    
    setIsPulling(false)
    const currentY = y.get()
    
    if (currentY >= threshold) {
      handleRefresh()
    } else {
      controls.start({ y: 0 })
    }
  }, [isPulling, y, threshold, handleRefresh, controls])

  // iOS-style rubber band effect
  const calculateDragConstraints = (offset: number) => {
    if (offset < 0) return 0
    if (offset < threshold) return offset
    
    // Apply resistance after threshold
    const resistanceFactor = 0.5
    const extraPull = (offset - threshold) * resistanceFactor
    return Math.min(threshold + extraPull, maxPull)
  }

  // Platform-specific styles
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  
  const defaultIndicator = (
    <div className="flex flex-col items-center justify-center py-4">
      <motion.div
        style={{ scale: indicatorScale, opacity: indicatorOpacity }}
        className={clsx(
          'w-10 h-10 rounded-full',
          'bg-gray-100 dark:bg-gray-800',
          'flex items-center justify-center',
          'shadow-sm'
        )}
      >
        <motion.div style={{ rotate: iconRotation }}>
          <ArrowPathIcon 
            className={clsx(
              'w-6 h-6',
              isRefreshing 
                ? 'text-primary-600 dark:text-primary-400' 
                : 'text-gray-600 dark:text-gray-400'
            )}
          />
        </motion.div>
      </motion.div>
      
      {isRefreshing && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-gray-600 dark:text-gray-400 mt-2"
        >
          Refreshing...
        </motion.p>
      )}
    </div>
  )

  return (
    <div className={clsx('relative overflow-hidden', className)}>
      {/* Pull indicator */}
      <motion.div
        style={{ y }}
        className={clsx(
          'absolute inset-x-0 top-0 z-10',
          'flex items-center justify-center',
          '-mt-20',
          indicatorClassName
        )}
      >
        {refreshContent || defaultIndicator}
      </motion.div>

      {/* Scrollable content */}
      <motion.div
        ref={containerRef}
        style={{ y }}
        drag={isPulling ? 'y' : false}
        dragConstraints={{ top: 0, bottom: maxPull }}
        dragElastic={0}
        onDragEnd={handleDragEnd}
        onTouchStart={handleTouchStart}
        animate={controls}
        className="h-full overflow-y-auto overscroll-contain"
        onDrag={(_, info) => {
          const dragY = calculateDragConstraints(info.offset.y)
          y.set(dragY)
        }}
      >
        {children}
      </motion.div>

      {/* Loading spinner for Android style */}
      {!isIOS && isRefreshing && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}
    </div>
  )
}

// Custom hook for programmatic refresh
export const usePullToRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const refresh = useCallback(async (callback: () => Promise<void>) => {
    setIsRefreshing(true)
    try {
      await callback()
    } finally {
      setIsRefreshing(false)
    }
  }, [])
  
  return { isRefreshing, refresh }
}