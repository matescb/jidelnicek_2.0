import React, { useRef, forwardRef, useImperativeHandle, CSSProperties, HTMLAttributes } from 'react'
import { useVirtualList } from '@/hooks/useVirtualization'
import { cn } from '@/lib/utils'

export interface VirtualListProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: T[]
  height: number | string
  width?: number | string
  itemHeight?: number | ((index: number) => number)
  overscan?: number
  horizontal?: boolean
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode
  getItemKey?: (item: T, index: number) => string | number
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  paddingStart?: number
  paddingEnd?: number
  initialScrollOffset?: number
  scrollRestoreKey?: string
  emptyMessage?: React.ReactNode
  loadingMessage?: React.ReactNode
  isLoading?: boolean
  estimatedItemSize?: number
  scrollbarWidth?: number
  components?: {
    Container?: React.ComponentType<any>
    Scroller?: React.ComponentType<any>
    Item?: React.ComponentType<any>
  }
}

export interface VirtualListHandle {
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void
  scrollToOffset: (offset: number, options?: { smooth?: boolean }) => void
  getScrollOffset: () => number
  forceUpdate: () => void
}

/**
 * Basic virtual list component for rendering large lists efficiently
 */
export const VirtualList = forwardRef(<T,>(
  {
    items,
    height,
    width = '100%',
    itemHeight = 50,
    overscan = 5,
    horizontal = false,
    renderItem,
    getItemKey,
    onScroll,
    paddingStart = 0,
    paddingEnd = 0,
    initialScrollOffset = 0,
    emptyMessage = 'No items to display',
    loadingMessage = 'Loading...',
    isLoading = false,
    estimatedItemSize = 50,
    scrollbarWidth = 17,
    components = {},
    className,
    style,
    ...props
  }: VirtualListProps<T>,
  ref: React.Ref<VirtualListHandle>
) => {
  const scrollElementRef = useRef<HTMLDivElement>(null)
  
  const {
    Container = 'div',
    Scroller = 'div',
    Item = 'div'
  } = components

  const estimateSize = typeof itemHeight === 'function' 
    ? itemHeight 
    : () => itemHeight as number

  const {
    virtualItems,
    totalSize,
    scrollToIndex,
    scrollToOffset,
    measureElement
  } = useVirtualList({
    items,
    estimateSize,
    overscan,
    horizontal,
    paddingStart,
    paddingEnd,
    initialOffset: initialScrollOffset,
    getScrollElement: () => scrollElementRef.current,
    getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined
  })

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) => scrollToIndex(index, options),
    scrollToOffset: (offset, options) => {
      if (scrollElementRef.current) {
        if (options?.smooth) {
          scrollElementRef.current.scrollTo({
            [horizontal ? 'left' : 'top']: offset,
            behavior: 'smooth'
          })
        } else {
          scrollElementRef.current[horizontal ? 'scrollLeft' : 'scrollTop'] = offset
        }
      }
    },
    getScrollOffset: () => {
      if (!scrollElementRef.current) return 0
      return scrollElementRef.current[horizontal ? 'scrollLeft' : 'scrollTop']
    },
    forceUpdate: () => {
      // Force re-render by measuring all items
      virtualItems.forEach((item) => {
        const element = document.querySelector(`[data-index="${item.index}"]`) as HTMLElement
        if (element) {
          measureElement(element, item.index)
        }
      })
    }
  }), [virtualItems, scrollToIndex, horizontal, measureElement])

  // Handle empty state
  if (!isLoading && items.length === 0) {
    return (
      <Container
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
    height: horizontal ? '100%' : height,
    width: horizontal ? width : '100%',
    overflow: 'auto',
    ...style
  }

  const contentStyle: CSSProperties = {
    [horizontal ? 'width' : 'height']: totalSize,
    [horizontal ? 'height' : 'width']: '100%',
    position: 'relative'
  }

  return (
    <Container
      className={cn('virtual-list-container', className)}
      {...props}
    >
      <Scroller
        ref={scrollElementRef}
        className="virtual-list-scroller"
        style={scrollerStyle}
        onScroll={onScroll}
        role="region"
        aria-label="Scrollable list"
        tabIndex={0}
      >
        <div
          className="virtual-list-content"
          style={contentStyle}
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index]
            if (!item) return null

            const itemStyle: CSSProperties = {
              position: 'absolute',
              [horizontal ? 'left' : 'top']: 0,
              [horizontal ? 'top' : 'left']: virtualItem.start,
              [horizontal ? 'height' : 'width']: '100%',
              [horizontal ? 'width' : 'height']: virtualItem.size
            }

            const key = getItemKey 
              ? getItemKey(item, virtualItem.index) 
              : virtualItem.index

            return (
              <Item
                key={key}
                data-index={virtualItem.index}
                className="virtual-list-item"
                style={itemStyle}
                ref={(el: HTMLElement | null) => measureElement(el, virtualItem.index)}
                role="listitem"
                aria-posinset={virtualItem.index + 1}
                aria-setsize={items.length}
              >
                {renderItem(item, virtualItem.index, itemStyle)}
              </Item>
            )
          })}
        </div>
      </Scroller>
    </Container>
  )
})

VirtualList.displayName = 'VirtualList'

// Higher-order component for easy memoization
export function withVirtualList<T>(
  Component: React.ComponentType<{ item: T; index: number; style: CSSProperties }>
) {
  return React.memo(Component, (prevProps, nextProps) => {
    return (
      prevProps.item === nextProps.item &&
      prevProps.index === nextProps.index &&
      prevProps.style.top === nextProps.style.top &&
      prevProps.style.height === nextProps.style.height
    )
  })
}