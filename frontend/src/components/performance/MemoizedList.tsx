import React, { memo, useCallback, useMemo } from 'react'
import { smartMemoCompare } from '@/utils/performanceOptimization'
import { useVirtualScroll } from '@/hooks/useOptimization'

/**
 * Generic memoized list component with virtualization support
 * Optimized for large lists with complex items
 */

interface MemoizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string | number
  itemHeight?: number | ((item: T, index: number) => number)
  className?: string
  gap?: number
  onItemClick?: (item: T, index: number) => void
  emptyMessage?: React.ReactNode
  loading?: boolean
  virtualize?: boolean
  virtualizeThreshold?: number
  overscan?: number
  estimatedItemHeight?: number
}

// Memoized list item wrapper
const MemoizedListItem = memo(
  <T,>({
    item,
    index,
    renderItem,
    onClick
  }: {
    item: T
    index: number
    renderItem: (item: T, index: number) => React.ReactNode
    onClick?: (item: T, index: number) => void
  }) => {
    const handleClick = useCallback(() => {
      onClick?.(item, index)
    }, [item, index, onClick])
    
    return (
      <div onClick={onClick ? handleClick : undefined}>
        {renderItem(item, index)}
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Only re-render if item or index changes
    return (
      prevProps.item === nextProps.item &&
      prevProps.index === nextProps.index &&
      prevProps.renderItem === nextProps.renderItem &&
      prevProps.onClick === nextProps.onClick
    )
  }
)

// Main list component
function MemoizedListComponent<T>({
  items,
  renderItem,
  keyExtractor,
  itemHeight,
  className = '',
  gap = 0,
  onItemClick,
  emptyMessage = 'No items to display',
  loading = false,
  virtualize = true,
  virtualizeThreshold = 50,
  overscan = 3,
  estimatedItemHeight = 100
}: MemoizedListProps<T>) {
  // Determine if we should use virtualization
  const shouldVirtualize = virtualize && items.length > virtualizeThreshold
  
  // Calculate item heights
  const getItemHeight = useCallback(
    (item: T, index: number) => {
      if (typeof itemHeight === 'function') {
        return itemHeight(item, index)
      }
      return itemHeight || estimatedItemHeight
    },
    [itemHeight, estimatedItemHeight]
  )
  
  // Stable render function
  const stableRenderItem = useCallback(
    (item: T, index: number) => renderItem(item, index),
    [renderItem]
  )
  
  // Stable click handler
  const stableOnItemClick = useCallback(
    (item: T, index: number) => onItemClick?.(item, index),
    [onItemClick]
  )
  
  // Loading state
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }
  
  // Empty state
  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 text-gray-500 ${className}`}>
        {emptyMessage}
      </div>
    )
  }
  
  // Virtual scrolling for large lists
  if (shouldVirtualize) {
    return (
      <VirtualizedList
        items={items}
        renderItem={stableRenderItem}
        keyExtractor={keyExtractor}
        getItemHeight={getItemHeight}
        className={className}
        gap={gap}
        onItemClick={stableOnItemClick}
        overscan={overscan}
      />
    )
  }
  
  // Regular list for small datasets
  return (
    <div className={className} style={{ gap }}>
      {items.map((item, index) => (
        <MemoizedListItem
          key={keyExtractor(item, index)}
          item={item}
          index={index}
          renderItem={stableRenderItem}
          onClick={stableOnItemClick}
        />
      ))}
    </div>
  )
}

// Virtualized list component
const VirtualizedList = memo(
  <T,>({
    items,
    renderItem,
    keyExtractor,
    getItemHeight,
    className,
    gap,
    onItemClick,
    overscan
  }: {
    items: T[]
    renderItem: (item: T, index: number) => React.ReactNode
    keyExtractor: (item: T, index: number) => string | number
    getItemHeight: (item: T, index: number) => number
    className?: string
    gap?: number
    onItemClick?: (item: T, index: number) => void
    overscan?: number
  }) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [containerHeight, setContainerHeight] = React.useState(600)
    
    // Calculate heights and positions
    const { itemPositions, totalHeight } = useMemo(() => {
      let currentPosition = 0
      const positions: { top: number; height: number }[] = []
      
      items.forEach((item, index) => {
        const height = getItemHeight(item, index)
        positions.push({ top: currentPosition, height })
        currentPosition += height + (gap || 0)
      })
      
      return {
        itemPositions: positions,
        totalHeight: currentPosition
      }
    }, [items, getItemHeight, gap])
    
    // Handle container resize
    React.useEffect(() => {
      const handleResize = () => {
        if (containerRef.current) {
          setContainerHeight(containerRef.current.clientHeight)
        }
      }
      
      handleResize()
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }, [])
    
    // Virtualization logic
    const [scrollTop, setScrollTop] = React.useState(0)
    
    const visibleRange = useMemo(() => {
      const startIndex = itemPositions.findIndex(
        pos => pos.top + pos.height > scrollTop
      )
      const endIndex = itemPositions.findIndex(
        pos => pos.top > scrollTop + containerHeight
      )
      
      return {
        start: Math.max(0, startIndex - (overscan || 3)),
        end: endIndex === -1 
          ? items.length 
          : Math.min(items.length, endIndex + (overscan || 3))
      }
    }, [scrollTop, containerHeight, itemPositions, items.length, overscan])
    
    const visibleItems = items.slice(visibleRange.start, visibleRange.end)
    const offsetY = visibleRange.start > 0 
      ? itemPositions[visibleRange.start].top 
      : 0
    
    return (
      <div
        ref={containerRef}
        className={`relative overflow-auto ${className}`}
        style={{ height: '100%' }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              gap
            }}
          >
            {visibleItems.map((item, virtualIndex) => {
              const actualIndex = visibleRange.start + virtualIndex
              return (
                <MemoizedListItem
                  key={keyExtractor(item, actualIndex)}
                  item={item}
                  index={actualIndex}
                  renderItem={renderItem}
                  onClick={onItemClick}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  },
  smartMemoCompare
)

// Export the memoized component
export const MemoizedList = memo(MemoizedListComponent, smartMemoCompare) as <T>(
  props: MemoizedListProps<T>
) => React.ReactElement

// Export a typed version for common use cases
export function createMemoizedList<T>() {
  return MemoizedList as React.FC<MemoizedListProps<T>>
}