import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number | ((index: number) => number)
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
  onScroll?: (scrollTop: number) => void
  emptyMessage?: React.ReactNode
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 3,
  className = '',
  onScroll,
  emptyMessage
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const isMobile = useMediaQuery('sm')
  
  // Calculate item heights
  const getItemHeight = useCallback((index: number) => {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight
  }, [itemHeight])
  
  // Calculate total height
  const totalHeight = items.reduce((acc, _, index) => {
    return acc + getItemHeight(index)
  }, 0)
  
  // Calculate visible range
  const getVisibleRange = useCallback(() => {
    let accumulatedHeight = 0
    let startIndex = 0
    let endIndex = items.length - 1
    
    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i)
      if (accumulatedHeight + height > scrollTop) {
        startIndex = Math.max(0, i - overscan)
        break
      }
      accumulatedHeight += height
    }
    
    // Find end index
    accumulatedHeight = 0
    for (let i = startIndex; i < items.length; i++) {
      if (accumulatedHeight > containerHeight + scrollTop) {
        endIndex = Math.min(items.length - 1, i + overscan)
        break
      }
      accumulatedHeight += getItemHeight(i)
    }
    
    return { startIndex, endIndex }
  }, [items.length, scrollTop, containerHeight, overscan, getItemHeight])
  
  const { startIndex, endIndex } = getVisibleRange()
  
  // Calculate offset for visible items
  const getItemOffset = useCallback((index: number) => {
    let offset = 0
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i)
    }
    return offset
  }, [getItemHeight])
  
  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop
    setScrollTop(scrollTop)
    onScroll?.(scrollTop)
  }, [onScroll])
  
  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }
    
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])
  
  if (items.length === 0 && emptyMessage) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        {emptyMessage}
      </div>
    )
  }
  
  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      onScroll={handleScroll}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {items.slice(startIndex, endIndex + 1).map((item, index) => {
          const actualIndex = startIndex + index
          const offset = getItemOffset(actualIndex)
          const height = getItemHeight(actualIndex)
          
          return (
            <div
              key={actualIndex}
              style={{
                position: 'absolute',
                top: offset,
                left: 0,
                right: 0,
                height,
              }}
            >
              {renderItem(item, actualIndex)}
            </div>
          )
        })}
      </div>
    </div>
  )
}