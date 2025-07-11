import React, { memo, useRef, useState, useEffect, useCallback } from 'react'
import { throttle } from 'lodash'
import { useRenderTracking } from '@/hooks/useOptimization'

/**
 * High-performance virtual list component
 * Renders only visible items for optimal performance with large datasets
 */

interface VirtualListProps<T> {
  items: T[]
  height: number | string
  itemHeight: number | ((index: number, item: T) => number)
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
  overscan?: number
  className?: string
  onScroll?: (scrollTop: number, scrollHeight: number) => void
  estimatedItemHeight?: number
  getItemKey?: (item: T, index: number) => string | number
  onEndReached?: () => void
  endReachedThreshold?: number
  headerHeight?: number
  renderHeader?: () => React.ReactNode
  renderEmpty?: () => React.ReactNode
  debug?: boolean
}

interface ItemMeta {
  height: number
  offset: number
}

const VirtualListItem = memo(
  ({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) => (
    <div style={style}>{children}</div>
  )
)

function VirtualListComponent<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 3,
  className = '',
  onScroll,
  estimatedItemHeight = 50,
  getItemKey,
  onEndReached,
  endReachedThreshold = 0.8,
  headerHeight = 0,
  renderHeader,
  renderEmpty,
  debug = false
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(
    typeof height === 'number' ? height : 0
  )
  
  // Performance tracking in debug mode
  const renderMetrics = debug ? useRenderTracking('VirtualList') : null
  
  // Cache for item measurements
  const itemMetaCache = useRef<Map<number, ItemMeta>>(new Map())
  const measuredHeights = useRef<Map<number, number>>(new Map())
  
  // Get item height with caching
  const getItemHeight = useCallback(
    (index: number, item: T): number => {
      if (measuredHeights.current.has(index)) {
        return measuredHeights.current.get(index)!
      }
      
      const height = typeof itemHeight === 'function'
        ? itemHeight(index, item)
        : itemHeight
      
      measuredHeights.current.set(index, height)
      return height
    },
    [itemHeight]
  )
  
  // Calculate item positions
  const calculateItemMeta = useCallback(() => {
    const meta = new Map<number, ItemMeta>()
    let offset = headerHeight
    
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i, items[i])
      meta.set(i, { height, offset })
      offset += height
    }
    
    itemMetaCache.current = meta
    return { meta, totalHeight: offset }
  }, [items, getItemHeight, headerHeight])
  
  // Get visible range
  const getVisibleRange = useCallback(() => {
    const { meta } = calculateItemMeta()
    
    let startIndex = 0
    let endIndex = items.length - 1
    let foundStart = false
    
    for (let i = 0; i < items.length; i++) {
      const itemMeta = meta.get(i)
      if (!itemMeta) continue
      
      const itemTop = itemMeta.offset
      const itemBottom = itemTop + itemMeta.height
      
      if (!foundStart && itemBottom > scrollTop) {
        startIndex = Math.max(0, i - overscan)
        foundStart = true
      }
      
      if (itemTop > scrollTop + containerHeight) {
        endIndex = Math.min(items.length - 1, i + overscan)
        break
      }
    }
    
    return { startIndex, endIndex }
  }, [items, scrollTop, containerHeight, overscan, calculateItemMeta])
  
  // Calculate visible items and total height
  const { visibleItems, totalHeight, offsetY } = React.useMemo(() => {
    const { startIndex, endIndex } = getVisibleRange()
    const { meta, totalHeight } = calculateItemMeta()
    
    const visibleItems: Array<{ item: T; index: number; style: React.CSSProperties }> = []
    
    for (let i = startIndex; i <= endIndex; i++) {
      const itemMeta = meta.get(i)
      if (!itemMeta) continue
      
      visibleItems.push({
        item: items[i],
        index: i,
        style: {
          position: 'absolute',
          top: itemMeta.offset,
          left: 0,
          right: 0,
          height: itemMeta.height
        }
      })
    }
    
    const offsetY = startIndex > 0 ? meta.get(startIndex)?.offset || 0 : 0
    
    return { visibleItems, totalHeight, offsetY }
  }, [items, getVisibleRange, calculateItemMeta])
  
  // Handle container resize
  useEffect(() => {
    if (typeof height === 'string' && containerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0]
        if (entry) {
          setContainerHeight(entry.contentRect.height)
        }
      })
      
      resizeObserver.observe(containerRef.current)
      return () => resizeObserver.disconnect()
    }
  }, [height])
  
  // Throttled scroll handler
  const handleScroll = useCallback(
    throttle((e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop
      const scrollHeight = e.currentTarget.scrollHeight
      
      setScrollTop(newScrollTop)
      onScroll?.(newScrollTop, scrollHeight)
      
      // Check if end reached
      if (onEndReached && scrollHeight > 0) {
        const scrollPercentage = (newScrollTop + containerHeight) / scrollHeight
        if (scrollPercentage >= endReachedThreshold) {
          onEndReached()
        }
      }
    }, 16), // ~60fps
    [containerHeight, onScroll, onEndReached, endReachedThreshold]
  )
  
  // Debug info
  useEffect(() => {
    if (debug && renderMetrics) {
      console.log('[VirtualList Debug]', {
        totalItems: items.length,
        visibleItems: visibleItems.length,
        scrollTop,
        containerHeight,
        totalHeight,
        ...renderMetrics
      })
    }
  }, [debug, renderMetrics, items.length, visibleItems.length, scrollTop, containerHeight, totalHeight])
  
  // Empty state
  if (items.length === 0 && renderEmpty) {
    return (
      <div ref={containerRef} className={className} style={{ height }}>
        {renderEmpty()}
      </div>
    )
  }
  
  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      {/* Header */}
      {renderHeader && (
        <div style={{ height: headerHeight }}>
          {renderHeader()}
        </div>
      )}
      
      {/* Scroll container */}
      <div
        ref={scrollRef}
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {/* Visible items */}
        {visibleItems.map(({ item, index, style }) => {
          const key = getItemKey ? getItemKey(item, index) : index
          return (
            <VirtualListItem key={key} style={style}>
              {renderItem(item, index, style)}
            </VirtualListItem>
          )
        })}
      </div>
      
      {/* Debug overlay */}
      {debug && (
        <div
          className="absolute top-0 right-0 bg-black bg-opacity-75 text-white text-xs p-2 m-2 rounded"
          style={{ pointerEvents: 'none' }}
        >
          <div>Visible: {visibleItems.length}/{items.length}</div>
          <div>Scroll: {Math.round(scrollTop)}/{Math.round(totalHeight)}</div>
          <div>Height: {containerHeight}px</div>
        </div>
      )}
    </div>
  )
}

// Export memoized component
export const VirtualList = memo(VirtualListComponent) as <T>(
  props: VirtualListProps<T>
) => React.ReactElement

// Helper hook for virtual list with dynamic heights
export function useVirtualListDynamic<T>(
  items: T[],
  estimatedHeight: number = 50
) {
  const heights = useRef(new Map<number, number>())
  
  const measureItem = useCallback((index: number, element: HTMLElement | null) => {
    if (element) {
      const height = element.getBoundingClientRect().height
      heights.current.set(index, height)
    }
  }, [])
  
  const getItemHeight = useCallback(
    (index: number) => heights.current.get(index) || estimatedHeight,
    [estimatedHeight]
  )
  
  return { measureItem, getItemHeight }
}