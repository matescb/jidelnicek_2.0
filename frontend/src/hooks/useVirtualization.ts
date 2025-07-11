import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useVirtualizer, VirtualizerOptions, VirtualItem } from '@tanstack/react-virtual'

export interface UseVirtualListOptions<T> {
  items: T[]
  estimateSize: (index: number) => number
  overscan?: number
  scrollingDelay?: number
  getItemKey?: (index: number) => string | number
  horizontal?: boolean
  lanes?: number
  paddingStart?: number
  paddingEnd?: number
  scrollMargin?: number
  initialOffset?: number
  initialMeasurementsCache?: VirtualItem[]
  getScrollElement: () => HTMLElement | null
  onChange?: (instance: any) => void
}

/**
 * Hook for creating virtual lists with dynamic item sizes
 */
export function useVirtualList<T>({
  items,
  estimateSize,
  overscan = 5,
  getItemKey,
  horizontal = false,
  paddingStart = 0,
  paddingEnd = 0,
  scrollMargin = 0,
  initialOffset = 0,
  getScrollElement,
  onChange
}: UseVirtualListOptions<T>) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize,
    overscan,
    horizontal,
    paddingStart,
    paddingEnd,
    scrollMargin,
    initialOffset,
    getItemKey,
    onChange
  })

  return {
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    scrollToIndex: virtualizer.scrollToIndex,
    scrollToOffset: virtualizer.scrollToOffset,
    measure: virtualizer.measure,
    measureElement: virtualizer.measureElement,
    virtualizer
  }
}

export interface UseVirtualGridOptions<T> extends Omit<UseVirtualListOptions<T>, 'horizontal'> {
  columnCount: number
  rowGap?: number
  columnGap?: number
  itemHeight: number
  itemWidth?: number
}

/**
 * Hook for creating virtual grids
 */
export function useVirtualGrid<T>({
  items,
  columnCount,
  rowGap = 0,
  columnGap = 0,
  itemHeight,
  itemWidth,
  overscan = 2,
  getScrollElement,
  ...rest
}: UseVirtualGridOptions<T>) {
  const rowCount = Math.ceil(items.length / columnCount)
  
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement,
    estimateSize: () => itemHeight + rowGap,
    overscan,
    ...rest
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  
  const virtualItems = useMemo(() => {
    const items: Array<{
      index: number
      row: number
      column: number
      key: string
      size: number
      start: number
    }> = []

    virtualRows.forEach((virtualRow) => {
      const baseIndex = virtualRow.index * columnCount
      
      for (let col = 0; col < columnCount; col++) {
        const index = baseIndex + col
        if (index >= items.length) break
        
        items.push({
          index,
          row: virtualRow.index,
          column: col,
          key: `${virtualRow.index}-${col}`,
          size: itemHeight,
          start: virtualRow.start
        })
      }
    })

    return items
  }, [virtualRows, columnCount, itemHeight])

  return {
    virtualItems,
    totalSize: rowVirtualizer.getTotalSize(),
    scrollToIndex: (index: number) => {
      const row = Math.floor(index / columnCount)
      rowVirtualizer.scrollToIndex(row)
    },
    measureElement: rowVirtualizer.measureElement,
    virtualizer: rowVirtualizer
  }
}

export interface UseDynamicSizeListOptions<T> extends UseVirtualListOptions<T> {
  defaultItemSize?: number
  measureCache?: Map<string | number, number>
}

/**
 * Hook for virtual lists with dynamically measured item sizes
 */
export function useDynamicSizeList<T>({
  items,
  defaultItemSize = 100,
  measureCache = new Map(),
  getItemKey,
  ...rest
}: UseDynamicSizeListOptions<T>) {
  const [itemSizes] = useState(measureCache)

  const estimateSize = useCallback((index: number) => {
    const key = getItemKey ? getItemKey(index) : index
    return itemSizes.get(key) || defaultItemSize
  }, [itemSizes, defaultItemSize, getItemKey])

  const measureElement = useCallback((el: HTMLElement | null, index: number) => {
    if (!el) return
    
    const key = getItemKey ? getItemKey(index) : index
    const size = rest.horizontal ? el.offsetWidth : el.offsetHeight
    
    if (itemSizes.get(key) !== size) {
      itemSizes.set(key, size)
      // Force re-render by returning the measure function
      return () => virtualizer.measure()
    }
  }, [itemSizes, getItemKey, rest.horizontal])

  const virtualizer = useVirtualList({
    items,
    estimateSize,
    getItemKey,
    ...rest
  })

  return {
    ...virtualizer,
    measureElement,
    itemSizes
  }
}

export interface ScrollPosition {
  offset: number
  index?: number
}

/**
 * Hook for saving and restoring scroll position
 */
export function useScrollRestoration(
  key: string,
  virtualizer?: any
) {
  const scrollPositions = useRef<Map<string, ScrollPosition>>(new Map())
  
  // Save scroll position
  const saveScrollPosition = useCallback(() => {
    if (!virtualizer) return
    
    const offset = virtualizer.scrollOffset || 0
    const index = virtualizer.getVirtualItems()[0]?.index || 0
    
    scrollPositions.current.set(key, { offset, index })
    
    // Also save to sessionStorage for persistence across page reloads
    try {
      sessionStorage.setItem(
        `scroll-position-${key}`,
        JSON.stringify({ offset, index })
      )
    } catch (e) {
      console.warn('Failed to save scroll position to sessionStorage:', e)
    }
  }, [key, virtualizer])

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    if (!virtualizer) return
    
    // Try to get from memory first
    let position = scrollPositions.current.get(key)
    
    // Fall back to sessionStorage
    if (!position) {
      try {
        const saved = sessionStorage.getItem(`scroll-position-${key}`)
        if (saved) {
          position = JSON.parse(saved)
        }
      } catch (e) {
        console.warn('Failed to restore scroll position from sessionStorage:', e)
      }
    }
    
    if (position) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (position.index !== undefined) {
          virtualizer.scrollToIndex(position.index, { align: 'start' })
        } else {
          virtualizer.scrollToOffset(position.offset)
        }
      })
    }
  }, [key, virtualizer])

  // Auto-save on scroll
  useEffect(() => {
    if (!virtualizer) return
    
    const scrollElement = virtualizer.scrollElement
    if (!scrollElement) return
    
    let scrollTimeout: NodeJS.Timeout
    
    const handleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(saveScrollPosition, 150)
    }
    
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [virtualizer, saveScrollPosition])

  return {
    saveScrollPosition,
    restoreScrollPosition
  }
}

/**
 * Hook for keyboard navigation in virtual lists
 */
export function useVirtualKeyboardNavigation(
  virtualizer: any,
  options: {
    onItemSelect?: (index: number) => void
    onItemActivate?: (index: number) => void
    enableWrapping?: boolean
  } = {}
) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const { onItemSelect, onItemActivate, enableWrapping = false } = options

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const items = virtualizer.getVirtualItems()
    const totalItems = virtualizer.options.count
    
    if (!items.length) return

    let newIndex = focusedIndex

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        newIndex = focusedIndex + 1
        if (newIndex >= totalItems) {
          newIndex = enableWrapping ? 0 : totalItems - 1
        }
        break
        
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        newIndex = focusedIndex - 1
        if (newIndex < 0) {
          newIndex = enableWrapping ? totalItems - 1 : 0
        }
        break
        
      case 'Home':
        e.preventDefault()
        newIndex = 0
        break
        
      case 'End':
        e.preventDefault()
        newIndex = totalItems - 1
        break
        
      case 'PageDown':
        e.preventDefault()
        newIndex = Math.min(focusedIndex + items.length, totalItems - 1)
        break
        
      case 'PageUp':
        e.preventDefault()
        newIndex = Math.max(focusedIndex - items.length, 0)
        break
        
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && onItemSelect) {
          onItemSelect(focusedIndex)
        }
        return
        
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && onItemActivate) {
          onItemActivate(focusedIndex)
        }
        return
        
      default:
        return
    }

    setFocusedIndex(newIndex)
    virtualizer.scrollToIndex(newIndex, { align: 'center' })
  }, [focusedIndex, virtualizer, enableWrapping, onItemSelect, onItemActivate])

  useEffect(() => {
    const scrollElement = virtualizer.scrollElement
    if (!scrollElement) return

    scrollElement.addEventListener('keydown', handleKeyDown)
    
    return () => {
      scrollElement.removeEventListener('keydown', handleKeyDown)
    }
  }, [virtualizer, handleKeyDown])

  return {
    focusedIndex,
    setFocusedIndex
  }
}

/**
 * Hook for intersection observer based lazy loading
 */
export function useVirtualIntersection(
  virtualizer: any,
  options: {
    rootMargin?: string
    threshold?: number | number[]
    onIntersect?: (entries: IntersectionObserverEntry[]) => void
  } = {}
) {
  const { rootMargin = '100px', threshold = 0, onIntersect } = options
  const observer = useRef<IntersectionObserver>()

  useEffect(() => {
    const scrollElement = virtualizer.scrollElement
    if (!scrollElement) return

    observer.current = new IntersectionObserver(
      (entries) => {
        if (onIntersect) {
          onIntersect(entries)
        }
      },
      {
        root: scrollElement,
        rootMargin,
        threshold
      }
    )

    return () => {
      observer.current?.disconnect()
    }
  }, [virtualizer, rootMargin, threshold, onIntersect])

  const observe = useCallback((element: HTMLElement) => {
    observer.current?.observe(element)
  }, [])

  const unobserve = useCallback((element: HTMLElement) => {
    observer.current?.unobserve(element)
  }, [])

  return {
    observe,
    unobserve
  }
}