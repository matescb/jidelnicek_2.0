import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, CSSProperties } from 'react'
import { useVirtualList } from '@/hooks/useVirtualization'
import { cn } from '@/lib/utils'

export interface WindowScrollerProps<T> {
  items: T[]
  itemHeight?: number | ((index: number) => number)
  overscan?: number
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode
  getItemKey?: (item: T, index: number) => string | number
  onScroll?: (scrollTop: number) => void
  scrollElement?: HTMLElement | Window
  scrollOffset?: number
  className?: string
  style?: CSSProperties
  estimatedItemSize?: number
  components?: {
    Container?: React.ComponentType<any>
    Item?: React.ComponentType<any>
  }
}

export interface WindowScrollerHandle {
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void
  scrollToOffset: (offset: number, options?: { smooth?: boolean }) => void
  getScrollOffset: () => number
  forceUpdate: () => void
}

/**
 * Virtual list that uses window or custom element for scrolling
 * Useful for implementing infinite scroll or when the list takes full page height
 */
export const WindowScroller = forwardRef(<T,>(
  {
    items,
    itemHeight = 50,
    overscan = 5,
    renderItem,
    getItemKey,
    onScroll,
    scrollElement,
    scrollOffset = 0,
    className,
    style,
    estimatedItemSize = 50,
    components = {}
  }: WindowScrollerProps<T>,
  ref: React.Ref<WindowScrollerHandle>
) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [windowHeight, setWindowHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  
  const {
    Container = 'div',
    Item = 'div'
  } = components

  // Get the actual scroll element
  const getScrollElement = () => {
    if (scrollElement) {
      return scrollElement as HTMLElement
    }
    return typeof window !== 'undefined' ? document.documentElement : null
  }

  const estimateSize = typeof itemHeight === 'function' 
    ? itemHeight 
    : () => itemHeight as number

  const {
    virtualItems,
    totalSize,
    scrollToIndex,
    scrollToOffset: virtualScrollToOffset,
    measureElement
  } = useVirtualList({
    items,
    estimateSize,
    overscan,
    getScrollElement: () => {
      // Return a proxy element that reports window scroll values
      const scrollEl = getScrollElement()
      if (!scrollEl) return null

      return {
        scrollTop: scrollTop - scrollOffset,
        scrollHeight: totalSize + scrollOffset,
        clientHeight: windowHeight,
        addEventListener: (event: string, handler: any) => {
          if (scrollElement) {
            scrollElement.addEventListener(event, handler)
          } else {
            window.addEventListener(event, handler)
          }
        },
        removeEventListener: (event: string, handler: any) => {
          if (scrollElement) {
            scrollElement.removeEventListener(event, handler)
          } else {
            window.removeEventListener(event, handler)
          }
        }
      } as any
    },
    getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined
  })

  // Update window dimensions and scroll position
  useEffect(() => {
    const updateDimensions = () => {
      setWindowHeight(window.innerHeight)
    }

    const updateScrollPosition = () => {
      const scrollEl = getScrollElement()
      if (!scrollEl) return

      let newScrollTop: number
      if (scrollElement && scrollElement !== window) {
        newScrollTop = (scrollElement as HTMLElement).scrollTop
      } else {
        newScrollTop = window.pageYOffset || document.documentElement.scrollTop
      }

      setScrollTop(newScrollTop)
      onScroll?.(newScrollTop)
    }

    // Initial values
    updateDimensions()
    updateScrollPosition()

    // Add event listeners
    const scrollTarget = scrollElement || window
    scrollTarget.addEventListener('scroll', updateScrollPosition, { passive: true })
    window.addEventListener('resize', updateDimensions)

    return () => {
      scrollTarget.removeEventListener('scroll', updateScrollPosition)
      window.removeEventListener('resize', updateDimensions)
    }
  }, [scrollElement, onScroll])

  // Custom scroll methods that work with window scrolling
  const scrollToOffset = (offset: number, options?: { smooth?: boolean }) => {
    const targetOffset = offset + scrollOffset
    
    if (scrollElement && scrollElement !== window) {
      const element = scrollElement as HTMLElement
      if (options?.smooth) {
        element.scrollTo({
          top: targetOffset,
          behavior: 'smooth'
        })
      } else {
        element.scrollTop = targetOffset
      }
    } else {
      if (options?.smooth) {
        window.scrollTo({
          top: targetOffset,
          behavior: 'smooth'
        })
      } else {
        window.scrollTo(0, targetOffset)
      }
    }
  }

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) => {
      const offset = virtualItems.find(item => item.index === index)?.start || 0
      scrollToOffset(offset, { smooth: options?.align === 'auto' })
    },
    scrollToOffset,
    getScrollOffset: () => scrollTop,
    forceUpdate: () => {
      virtualItems.forEach((item) => {
        const element = document.querySelector(`[data-index="${item.index}"]`) as HTMLElement
        if (element) {
          measureElement(element, item.index)
        }
      })
    }
  }), [virtualItems, scrollToOffset, scrollTop, measureElement])

  // Calculate container offset from top of scroll element
  const [containerOffset, setContainerOffset] = useState(0)
  useEffect(() => {
    if (!containerRef.current) return

    const updateOffset = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      const scrollEl = getScrollElement()
      
      if (scrollElement && scrollElement !== window) {
        // For custom scroll element, calculate relative position
        const scrollRect = (scrollElement as HTMLElement).getBoundingClientRect()
        setContainerOffset(rect.top - scrollRect.top + (scrollElement as HTMLElement).scrollTop)
      } else {
        // For window scrolling, use absolute position
        setContainerOffset(rect.top + window.pageYOffset)
      }
    }

    updateOffset()
    
    // Update on scroll and resize
    const scrollTarget = scrollElement || window
    scrollTarget.addEventListener('scroll', updateOffset, { passive: true })
    window.addEventListener('resize', updateOffset)

    return () => {
      scrollTarget.removeEventListener('scroll', updateOffset)
      window.removeEventListener('resize', updateOffset)
    }
  }, [scrollElement])

  if (items.length === 0) {
    return null
  }

  const containerStyle: CSSProperties = {
    position: 'relative',
    height: totalSize,
    ...style
  }

  return (
    <Container
      ref={containerRef}
      className={cn('window-scroller', className)}
      style={containerStyle}
      role="list"
      aria-label="Scrollable list"
    >
      {virtualItems.map((virtualItem) => {
        const item = items[virtualItem.index]
        if (!item) return null

        const key = getItemKey 
          ? getItemKey(item, virtualItem.index) 
          : virtualItem.index

        const itemStyle: CSSProperties = {
          position: 'absolute',
          top: virtualItem.start,
          left: 0,
          width: '100%',
          height: virtualItem.size
        }

        return (
          <Item
            key={key}
            data-index={virtualItem.index}
            className="window-scroller-item"
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
    </Container>
  )
})

WindowScroller.displayName = 'WindowScroller'

/**
 * Hook to track window scroll position and dimensions
 */
export function useWindowScroll() {
  const [scrollPosition, setScrollPosition] = useState({
    x: 0,
    y: 0
  })
  
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0
  })

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition({
        x: window.pageXOffset,
        y: window.pageYOffset
      })
    }

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    // Set initial values
    handleScroll()
    handleResize()

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return {
    scrollX: scrollPosition.x,
    scrollY: scrollPosition.y,
    windowWidth: windowSize.width,
    windowHeight: windowSize.height
  }
}

/**
 * Infinite scroll helper component
 */
export interface InfiniteScrollerProps<T> extends WindowScrollerProps<T> {
  hasMore: boolean
  loadMore: () => void | Promise<void>
  isLoadingMore?: boolean
  loadMoreThreshold?: number
  loader?: React.ReactNode
}

export const InfiniteScroller = forwardRef(<T,>(
  {
    hasMore,
    loadMore,
    isLoadingMore = false,
    loadMoreThreshold = 200,
    loader = <div className="p-4 text-center">Loading more...</div>,
    ...props
  }: InfiniteScrollerProps<T>,
  ref: React.Ref<WindowScrollerHandle>
) => {
  const [isLoading, setIsLoading] = useState(false)
  const windowScrollerRef = useRef<WindowScrollerHandle>(null)

  // Forward ref methods
  useImperativeHandle(ref, () => ({
    scrollToIndex: (...args) => windowScrollerRef.current?.scrollToIndex(...args),
    scrollToOffset: (...args) => windowScrollerRef.current?.scrollToOffset(...args),
    getScrollOffset: () => windowScrollerRef.current?.getScrollOffset() || 0,
    forceUpdate: () => windowScrollerRef.current?.forceUpdate()
  }), [])

  const handleScroll = async (scrollTop: number) => {
    props.onScroll?.(scrollTop)

    if (!hasMore || isLoading || isLoadingMore) return

    const scrollEl = props.scrollElement || window
    const scrollHeight = scrollEl === window 
      ? document.documentElement.scrollHeight
      : (scrollEl as HTMLElement).scrollHeight
    
    const clientHeight = scrollEl === window
      ? window.innerHeight
      : (scrollEl as HTMLElement).clientHeight

    if (scrollHeight - scrollTop - clientHeight < loadMoreThreshold) {
      setIsLoading(true)
      try {
        await loadMore()
      } finally {
        setIsLoading(false)
      }
    }
  }

  // Add loader to items if loading
  const itemsWithLoader = isLoadingMore || isLoading
    ? [...props.items, { __loader: true } as any]
    : props.items

  const renderItemWithLoader = (item: T, index: number, style: CSSProperties) => {
    if ((item as any).__loader) {
      return loader
    }
    return props.renderItem(item, index, style)
  }

  return (
    <WindowScroller
      ref={windowScrollerRef}
      {...props}
      items={itemsWithLoader}
      renderItem={renderItemWithLoader}
      onScroll={handleScroll}
    />
  )
})

InfiniteScroller.displayName = 'InfiniteScroller'