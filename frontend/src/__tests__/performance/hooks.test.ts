import { vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  renderHookWithPerformance,
  performanceHelpers,
  ComponentPerformanceMonitor 
} from './utils'

// Import optimization hooks
import {
  useDebounce,
  useThrottle,
  useMemoizedCallback,
  useDeepCompareMemo,
  useDeepCompareEffect,
  useWhyDidYouUpdate,
  useRenderTracking,
  useLazyInitialState,
  useStableCallback,
  useDeferredValue,
  useProgressiveEnhancement,
  useLazyLoad,
  useVirtualScroll
} from '@/hooks/useOptimization'

import {
  useVirtualList,
  useVirtualGrid,
  useDynamicSizeList,
  useScrollRestoration,
  useVirtualKeyboardNavigation,
  useVirtualIntersection
} from '@/hooks/useVirtualization'

describe('Performance Optimization Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('useDebounce', () => {
    it('should debounce value updates efficiently', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: 'initial' } }
      )

      // Initial state
      const [immediate, debounced, isPending] = result.current
      expect(immediate).toBe('initial')
      expect(debounced).toBe('initial')
      expect(isPending).toBe(false)

      // Update value multiple times rapidly
      act(() => {
        rerender({ value: 'update1' })
        rerender({ value: 'update2' })
        rerender({ value: 'update3' })
      })

      // Immediate value should update, debounced should not
      expect(result.current[0]).toBe('update3')
      expect(result.current[1]).toBe('initial')
      expect(result.current[2]).toBe(true) // isPending

      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(300)
      })

      // Debounced value should now be updated
      expect(result.current[1]).toBe('update3')
      expect(result.current[2]).toBe(false)
    })

    it('should handle leading and trailing options', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300, { leading: true, trailing: false }),
        { initialProps: { value: 'initial' } }
      )

      act(() => {
        rerender({ value: 'update' })
      })

      // With leading: true, debounced value should update immediately
      expect(result.current[1]).toBe('update')
    })

    it('should cancel pending debounce on unmount', () => {
      const { result, unmount, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: 'initial' } }
      )

      act(() => {
        rerender({ value: 'update' })
      })

      // Unmount before debounce completes
      unmount()

      act(() => {
        vi.advanceTimersByTime(300)
      })

      // Should not throw or cause issues
      expect(true).toBe(true)
    })
  })

  describe('useThrottle', () => {
    it('should throttle value updates', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 100),
        { initialProps: { value: 0 } }
      )

      expect(result.current).toBe(0)

      // Rapid updates
      for (let i = 1; i <= 10; i++) {
        act(() => {
          rerender({ value: i })
          vi.advanceTimersByTime(20)
        })
      }

      // Should have throttled updates
      expect(result.current).toBeGreaterThan(0)
      expect(result.current).toBeLessThan(10)
    })

    it('should respect leading and trailing options', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 100, { leading: false, trailing: true }),
        { initialProps: { value: 0 } }
      )

      act(() => {
        rerender({ value: 1 })
      })

      // With leading: false, should not update immediately
      expect(result.current).toBe(0)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should update after throttle period
      expect(result.current).toBe(1)
    })
  })

  describe('useMemoizedCallback', () => {
    it('should track dependency changes in development', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const callback = vi.fn()
      const { result, rerender } = renderHook(
        ({ dep1, dep2 }) => useMemoizedCallback(callback, [dep1, dep2], 'TestCallback'),
        { initialProps: { dep1: 'a', dep2: 'b' } }
      )

      // Rerender with changed dependency
      rerender({ dep1: 'a', dep2: 'c' })

      // Should log dependency change
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useMemoizedCallback] TestCallback'),
        expect.any(Array),
        expect.any(Object)
      )

      consoleSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })

    it('should maintain callback reference when dependencies dont change', () => {
      const callback = vi.fn()
      const { result, rerender } = renderHook(
        ({ dep }) => useMemoizedCallback(callback, [dep]),
        { initialProps: { dep: 'value' } }
      )

      const firstCallback = result.current

      // Rerender with same dependency
      rerender({ dep: 'value' })

      expect(result.current).toBe(firstCallback)
    })
  })

  describe('useDeepCompareMemo', () => {
    it('should only recompute when deep equality fails', () => {
      const factory = vi.fn(() => ({ computed: true }))
      const { result, rerender } = renderHook(
        ({ obj }) => useDeepCompareMemo(factory, [obj]),
        { initialProps: { obj: { a: 1, b: 2 } } }
      )

      expect(factory).toHaveBeenCalledTimes(1)

      // Rerender with deeply equal object
      rerender({ obj: { a: 1, b: 2 } })
      expect(factory).toHaveBeenCalledTimes(1) // Not called again

      // Rerender with different object
      rerender({ obj: { a: 1, b: 3 } })
      expect(factory).toHaveBeenCalledTimes(2) // Called again
    })

    it('should handle complex nested objects', () => {
      const factory = vi.fn(() => 'computed')
      const { result, rerender } = renderHook(
        ({ data }) => useDeepCompareMemo(factory, [data]),
        { 
          initialProps: { 
            data: { 
              users: [{ id: 1, name: 'John' }],
              settings: { theme: 'dark' }
            }
          }
        }
      )

      // Rerender with same nested structure
      rerender({ 
        data: { 
          users: [{ id: 1, name: 'John' }],
          settings: { theme: 'dark' }
        }
      })

      expect(factory).toHaveBeenCalledTimes(1)
    })
  })

  describe('useRenderTracking', () => {
    it('should track render count and time', () => {
      const { result, rerender } = renderHook(() => 
        useRenderTracking('TestComponent')
      )

      expect(result.current.renderCount).toBe(1)
      expect(result.current.renderTime).toBeGreaterThan(0)
      expect(result.current.averageRenderTime).toBeGreaterThan(0)

      rerender()

      expect(result.current.renderCount).toBe(2)
    })

    it('should warn about slow renders in development', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation()
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      // Mock slow render
      const originalNow = performance.now
      let mockTime = 0
      performance.now = vi.fn(() => {
        const time = mockTime
        mockTime += 20 // Simulate 20ms render
        return time
      })

      renderHook(() => useRenderTracking('SlowComponent'))

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RenderTracking] SlowComponent slow render')
      )

      consoleSpy.mockRestore()
      performance.now = originalNow
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('useLazyInitialState', () => {
    it('should compute initial state lazily', () => {
      const factory = vi.fn(() => performanceHelpers.createLargeDataset(1000))
      
      const { result, rerender } = renderHook(
        ({ deps }) => useLazyInitialState(factory, deps),
        { initialProps: { deps: [] } }
      )

      expect(factory).toHaveBeenCalledTimes(1)
      expect(result.current).toHaveLength(1000)

      // Rerender with same deps
      rerender({ deps: [] })
      expect(factory).toHaveBeenCalledTimes(1)

      // Rerender with different deps
      rerender({ deps: ['changed'] })
      expect(factory).toHaveBeenCalledTimes(2)
    })
  })

  describe('useStableCallback', () => {
    it('should maintain stable reference while updating implementation', () => {
      const { result, rerender } = renderHook(
        ({ value }) => {
          const callback = useStableCallback(() => value)
          return { callback, value }
        },
        { initialProps: { value: 1 } }
      )

      const firstCallback = result.current.callback

      // Callback should return current value
      expect(result.current.callback()).toBe(1)

      // Update value
      rerender({ value: 2 })

      // Reference should be stable
      expect(result.current.callback).toBe(firstCallback)
      
      // But implementation should be updated
      expect(result.current.callback()).toBe(2)
    })
  })

  describe('useDeferredValue', () => {
    it('should defer value updates', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDeferredValue(value, 100),
        { initialProps: { value: 'initial' } }
      )

      expect(result.current).toBe('initial')

      act(() => {
        rerender({ value: 'updated' })
      })

      // Value should not update immediately
      expect(result.current).toBe('initial')

      // Fast forward
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Value should now be updated
      expect(result.current).toBe('updated')
    })
  })

  describe('useProgressiveEnhancement', () => {
    it('should delay enhancement', async () => {
      const { result } = renderHook(() => useProgressiveEnhancement(100))

      // Initially not enhanced
      expect(result.current).toBe(false)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should be enhanced after delay
      expect(result.current).toBe(true)
    })
  })

  describe('useLazyLoad', () => {
    it('should detect intersection for lazy loading', () => {
      let observerCallback: IntersectionObserverCallback | null = null
      const mockObserve = vi.fn()
      const mockDisconnect = vi.fn()

      // Mock IntersectionObserver
      const originalIO = global.IntersectionObserver
      global.IntersectionObserver = vi.fn((callback) => {
        observerCallback = callback
        return {
          observe: mockObserve,
          disconnect: mockDisconnect,
          unobserve: vi.fn(),
          takeRecords: vi.fn(() => [])
        }
      }) as any

      const { result } = renderHook(() => useLazyLoad())
      const [ref, isIntersecting] = result.current

      // Create a mock element
      const element = document.createElement('div')
      Object.defineProperty(ref, 'current', {
        value: element,
        configurable: true
      })

      // Trigger effect
      act(() => {
        vi.runAllTimers()
      })

      expect(mockObserve).toHaveBeenCalledWith(element)
      expect(isIntersecting).toBe(false)

      // Simulate intersection
      act(() => {
        observerCallback?.([{
          isIntersecting: true,
          target: element
        } as any], {} as any)
      })

      expect(result.current[1]).toBe(true)

      global.IntersectionObserver = originalIO
    })
  })

  describe('useVirtualScroll', () => {
    it('should calculate virtual scroll metrics', () => {
      const items = performanceHelpers.createLargeDataset(1000)
      
      const { result } = renderHook(() => 
        useVirtualScroll({
          items,
          itemHeight: 50,
          containerHeight: 500,
          overscan: 3
        })
      )

      expect(result.current.totalHeight).toBe(50000) // 1000 * 50
      expect(result.current.visibleItems.length).toBeLessThanOrEqual(16) // 10 visible + 6 overscan
      expect(result.current.offsetY).toBe(0)
      expect(result.current.startIndex).toBe(0)
    })

    it('should update on scroll', () => {
      const items = performanceHelpers.createLargeDataset(1000)
      
      const { result } = renderHook(() => 
        useVirtualScroll({
          items,
          itemHeight: 50,
          containerHeight: 500,
          overscan: 3
        })
      )

      // Simulate scroll
      const mockEvent = {
        currentTarget: { scrollTop: 5000 }
      } as React.UIEvent<HTMLElement>

      act(() => {
        result.current.handleScroll(mockEvent)
      })

      // Should update visible range
      expect(result.current.startIndex).toBeGreaterThan(90)
      expect(result.current.offsetY).toBeGreaterThan(4500)
    })
  })

  describe('Virtual List Hooks', () => {
    it('should handle dynamic size lists efficiently', () => {
      const items = performanceHelpers.createLargeDataset(100)
      const scrollElement = document.createElement('div')
      
      const { result } = renderHook(() => 
        useDynamicSizeList({
          items,
          getScrollElement: () => scrollElement,
          defaultItemSize: 100
        })
      )

      expect(result.current.virtualItems).toBeDefined()
      expect(result.current.totalSize).toBeGreaterThan(0)
    })

    it('should restore scroll position', () => {
      const mockScrollToIndex = vi.fn()
      const virtualizer = {
        scrollOffset: 1000,
        getVirtualItems: () => [{ index: 20 }],
        scrollToIndex: mockScrollToIndex,
        scrollToOffset: vi.fn(),
        scrollElement: document.createElement('div')
      }

      const { result } = renderHook(() => 
        useScrollRestoration('test-key', virtualizer)
      )

      // Save position
      act(() => {
        result.current.saveScrollPosition()
      })

      // Restore position
      act(() => {
        result.current.restoreScrollPosition()
      })

      // Should attempt to restore
      act(() => {
        vi.runAllTimers()
      })

      expect(mockScrollToIndex).toHaveBeenCalledWith(20, { align: 'start' })
    })

    it('should handle keyboard navigation', () => {
      const mockScrollToIndex = vi.fn()
      const virtualizer = {
        getVirtualItems: () => Array.from({ length: 10 }, (_, i) => ({ index: i })),
        options: { count: 100 },
        scrollToIndex: mockScrollToIndex,
        scrollElement: document.createElement('div')
      }

      const onItemSelect = vi.fn()
      const { result } = renderHook(() => 
        useVirtualKeyboardNavigation(virtualizer, { onItemSelect })
      )

      // Initial state
      expect(result.current.focusedIndex).toBe(-1)

      // Simulate arrow down
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      act(() => {
        virtualizer.scrollElement.dispatchEvent(event)
      })

      expect(result.current.focusedIndex).toBe(0)
      expect(mockScrollToIndex).toHaveBeenCalledWith(0, { align: 'center' })

      // Update focused index for next test
      act(() => {
        result.current.setFocusedIndex(5)
      })

      // Simulate space for selection
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' })
      act(() => {
        virtualizer.scrollElement.dispatchEvent(spaceEvent)
      })

      expect(onItemSelect).toHaveBeenCalledWith(5)
    })
  })

  describe('Performance Benchmarks', () => {
    it('should maintain performance with rapid hook updates', async () => {
      const monitor = new ComponentPerformanceMonitor()
      
      monitor.startRender()
      const { rerender } = renderHook(
        ({ value }) => {
          const debounced = useDebounce(value, 100)[1]
          const throttled = useThrottle(value, 100)
          const deferred = useDeferredValue(value, 50)
          return { debounced, throttled, deferred }
        },
        { initialProps: { value: 0 } }
      )
      monitor.endRender()

      // Rapid updates
      for (let i = 1; i <= 100; i++) {
        monitor.startRender()
        rerender({ value: i })
        monitor.endRender()
      }

      // Average render time should stay low
      expect(monitor.getAverageRenderTime()).toBeLessThan(5)
    })
  })
})