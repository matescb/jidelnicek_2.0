import React, { useRef, forwardRef, useImperativeHandle, CSSProperties, HTMLAttributes } from 'react'
import { useVirtualGrid } from '@/hooks/useVirtualization'
import { cn } from '@/lib/utils'

export interface VirtualGridProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: T[]
  height: number | string
  width?: number | string
  columnCount: number | ((containerWidth: number) => number)
  rowHeight: number
  columnWidth?: number | string
  gap?: number
  overscan?: number
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode
  getItemKey?: (item: T, index: number) => string | number
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  paddingStart?: number
  paddingEnd?: number
  initialScrollOffset?: number
  emptyMessage?: React.ReactNode
  loadingMessage?: React.ReactNode
  isLoading?: boolean
  containerPadding?: number
  minColumnWidth?: number
  maxColumnWidth?: number
  components?: {
    Container?: React.ComponentType<any>
    Scroller?: React.ComponentType<any>
    Grid?: React.ComponentType<any>
    Item?: React.ComponentType<any>
  }
}

export interface VirtualGridHandle {
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void
  scrollToOffset: (offset: number, options?: { smooth?: boolean }) => void
  getScrollOffset: () => number
  forceUpdate: () => void
}

/**
 * Virtual grid component for efficient 2D layouts
 */
export const VirtualGrid = forwardRef(<T,>(
  {
    items,
    height,
    width = '100%',
    columnCount,
    rowHeight,
    columnWidth,
    gap = 0,
    overscan = 2,
    renderItem,
    getItemKey,
    onScroll,
    paddingStart = 0,
    paddingEnd = 0,
    initialScrollOffset = 0,
    emptyMessage = 'No items to display',
    loadingMessage = 'Loading...',
    isLoading = false,
    containerPadding = 0,
    minColumnWidth = 100,
    maxColumnWidth,
    components = {},
    className,
    style,
    ...props
  }: VirtualGridProps<T>,
  ref: React.Ref<VirtualGridHandle>
) => {
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)

  const {
    Container = 'div',
    Scroller = 'div',
    Grid = 'div',
    Item = 'div'
  } = components

  // Calculate actual column count
  const actualColumnCount = React.useMemo(() => {
    if (typeof columnCount === 'function') {
      return columnCount(containerWidth)
    }
    if (columnCount > 0) {
      return columnCount
    }
    // Auto-calculate based on container width and min column width
    const availableWidth = containerWidth - 2 * containerPadding
    return Math.max(1, Math.floor(availableWidth / (minColumnWidth + gap)))
  }, [columnCount, containerWidth, containerPadding, minColumnWidth, gap])

  // Calculate actual column width
  const actualColumnWidth = React.useMemo(() => {
    if (columnWidth) return columnWidth
    const availableWidth = containerWidth - 2 * containerPadding - (actualColumnCount - 1) * gap
    const calculatedWidth = availableWidth / actualColumnCount
    
    if (maxColumnWidth) {
      return Math.min(calculatedWidth, maxColumnWidth)
    }
    return calculatedWidth
  }, [columnWidth, containerWidth, containerPadding, actualColumnCount, gap, maxColumnWidth])

  // Observe container width changes
  React.useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(containerRef.current)
    
    // Initial measurement
    setContainerWidth(containerRef.current.offsetWidth)

    return () => observer.disconnect()
  }, [])

  const {
    virtualItems,
    totalSize,
    scrollToIndex,
    measureElement
  } = useVirtualGrid({
    items,
    columnCount: actualColumnCount,
    rowGap: gap,
    columnGap: gap,
    itemHeight: rowHeight,
    itemWidth: typeof actualColumnWidth === 'number' ? actualColumnWidth : undefined,
    overscan,
    paddingStart,
    paddingEnd,
    initialOffset: initialScrollOffset,
    getScrollElement: () => scrollElementRef.current
  })

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) => scrollToIndex(index),
    scrollToOffset: (offset, options) => {
      if (scrollElementRef.current) {
        if (options?.smooth) {
          scrollElementRef.current.scrollTo({
            top: offset,
            behavior: 'smooth'
          })
        } else {
          scrollElementRef.current.scrollTop = offset
        }
      }
    },
    getScrollOffset: () => {
      if (!scrollElementRef.current) return 0
      return scrollElementRef.current.scrollTop
    },
    forceUpdate: () => {
      // Force re-render by measuring all items
      virtualItems.forEach((item) => {
        const element = document.querySelector(`[data-index="${item.index}"]`) as HTMLElement
        if (element) {
          measureElement(element, item.row)
        }
      })
    }
  }), [virtualItems, scrollToIndex, measureElement])

  // Handle empty state
  if (!isLoading && items.length === 0) {
    return (
      <Container
        ref={containerRef}
        className={cn(
          'flex items-center justify-center text-gray-500 dark:text-gray-400',
          className
        )}
        style={{
          height,
          width,
          ...style
        }}
        {...props}
      >
        {emptyMessage}
      </Container>
    )
  }

  // Handle loading state
  if (isLoading && items.length === 0) {
    return (
      <Container
        ref={containerRef}
        className={cn(
          'flex items-center justify-center text-gray-500 dark:text-gray-400',
          className
        )}
        style={{
          height,
          width,
          ...style
        }}
        {...props}
      >
        {loadingMessage}
      </Container>
    )
  }

  const scrollerStyle: CSSProperties = {
    height,
    width,
    overflow: 'auto',
    ...style
  }

  const gridStyle: CSSProperties = {
    position: 'relative',
    height: totalSize,
    width: '100%',
    padding: containerPadding
  }

  return (
    <Container
      ref={containerRef}
      className={cn('virtual-grid-container', className)}
      {...props}
    >
      <Scroller
        ref={scrollElementRef}
        className="virtual-grid-scroller"
        style={scrollerStyle}
        onScroll={onScroll}
        role="region"
        aria-label="Scrollable grid"
        tabIndex={0}
      >
        <Grid
          className="virtual-grid-content"
          style={gridStyle}
          role="grid"
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index]
            if (!item) return null

            const itemStyle: CSSProperties = {
              position: 'absolute',
              top: virtualItem.start,
              left: virtualItem.column * (Number(actualColumnWidth) + gap),
              width: actualColumnWidth,
              height: rowHeight
            }

            const key = getItemKey 
              ? getItemKey(item, virtualItem.index) 
              : virtualItem.index

            return (
              <Item
                key={key}
                data-index={virtualItem.index}
                data-row={virtualItem.row}
                data-column={virtualItem.column}
                className="virtual-grid-item"
                style={itemStyle}
                role="gridcell"
                aria-rowindex={virtualItem.row + 1}
                aria-colindex={virtualItem.column + 1}
              >
                {renderItem(item, virtualItem.index, itemStyle)}
              </Item>
            )
          })}
        </Grid>
      </Scroller>
    </Container>
  )
})

VirtualGrid.displayName = 'VirtualGrid'

/**
 * Responsive virtual grid that automatically adjusts column count
 */
export const ResponsiveVirtualGrid = forwardRef(<T,>(
  props: Omit<VirtualGridProps<T>, 'columnCount'> & {
    minColumnWidth?: number
    maxColumns?: number
    preferredColumnWidth?: number
  },
  ref: React.Ref<VirtualGridHandle>
) => {
  const {
    minColumnWidth = 200,
    maxColumns = 6,
    preferredColumnWidth = 250,
    gap = 16,
    containerPadding = 16,
    ...restProps
  } = props

  const calculateColumns = React.useCallback((containerWidth: number) => {
    const availableWidth = containerWidth - 2 * containerPadding
    
    // Try to fit columns at preferred width
    let columns = Math.floor(availableWidth / (preferredColumnWidth + gap))
    
    // Ensure we have at least 1 column
    columns = Math.max(1, columns)
    
    // Respect max columns
    columns = Math.min(columns, maxColumns)
    
    // Check if columns are too narrow
    const actualWidth = (availableWidth - (columns - 1) * gap) / columns
    if (actualWidth < minColumnWidth && columns > 1) {
      columns = columns - 1
    }
    
    return columns
  }, [minColumnWidth, maxColumns, preferredColumnWidth, gap, containerPadding])

  return (
    <VirtualGrid
      ref={ref}
      columnCount={calculateColumns}
      gap={gap}
      containerPadding={containerPadding}
      {...restProps}
    />
  )
})

ResponsiveVirtualGrid.displayName = 'ResponsiveVirtualGrid'