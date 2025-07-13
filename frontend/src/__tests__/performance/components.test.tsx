import React, { Suspense, lazy } from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { 
  renderWithPerformance, 
  ComponentPerformanceMonitor,
  performanceHelpers,
  FPSMonitor,
  MemoryLeakDetector
} from './utils'

// Import performance components
import { LazyImage } from '@/components/performance/LazyImage'
import { MemoizedList } from '@/components/performance/MemoizedList'
import { VirtualList } from '@/components/performance/VirtualList'
import { DeferredComponent } from '@/components/performance/DeferredComponent'
import { OptimizedImage } from '@/components/performance/OptimizedImage'
import { VirtualGrid } from '@/components/performance/virtual/VirtualGrid'
import { VirtualTable } from '@/components/performance/virtual/VirtualTable'
import { WindowScroller } from '@/components/performance/virtual/WindowScroller'

// Mock heavy component for lazy loading tests
const HeavyComponent = lazy(() => {
  return new Promise<{ default: React.ComponentType }>(resolve => {
    setTimeout(() => {
      resolve({
        default: () => <div data-testid="heavy-component">Heavy Component Loaded</div>
      })
    }, 100)
  })
})

describe('Component Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('LazyImage', () => {
    it('should lazy load images efficiently', async () => {
      const monitor = new ComponentPerformanceMonitor()
      
      monitor.startRender()
      const { rerender } = render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          placeholder="placeholder.jpg"
        />
      )
      monitor.endRender()

      // Initial render should be fast
      const metrics = monitor.getMetrics()[0]
      expect(metrics.renderTime).toBeLessThan(10)

      // Simulate intersection
      const image = screen.getByRole('img')
      
      // Mock intersection observer callback
      const observerCallback = vi.fn()
      const observer = new IntersectionObserver(observerCallback)
      observer.observe(image)

      // Trigger intersection
      act(() => {
        observerCallback([
          {
            isIntersecting: true,
            target: image,
            intersectionRatio: 1
          } as any
        ])
      })

      await waitFor(() => {
        expect(image).toHaveAttribute('src', 'test-image.jpg')
      })
    })

    it('should handle multiple lazy images without performance degradation', async () => {
      const imageCount = 100
      const { performanceMonitor } = renderWithPerformance(
        <div>
          {Array.from({ length: imageCount }, (_, i) => (
            <LazyImage
              key={i}
              src={`image-${i}.jpg`}
              alt={`Image ${i}`}
              placeholder="placeholder.jpg"
            />
          ))}
        </div>
      )

      // Rendering 100 lazy images should still be fast
      expect(performanceMonitor.getAverageRenderTime()).toBeLessThan(50)
    })
  })

  describe('MemoizedList', () => {
    it('should prevent unnecessary re-renders', async () => {
      const items = performanceHelpers.createLargeDataset(100)
      const renderItem = vi.fn((item: any) => (
        <div key={item.id}>{item.name}</div>
      ))

      const { rerender, performanceMonitor } = renderWithPerformance(
        <MemoizedList
          items={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
        />
      )

      const initialRenderCount = renderItem.mock.calls.length
      expect(initialRenderCount).toBe(100)

      // Re-render with same items
      performanceMonitor.startRender()
      rerender(
        <MemoizedList
          items={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
        />
      )
      performanceMonitor.endRender()

      // Should not re-render items
      expect(renderItem.mock.calls.length).toBe(initialRenderCount)
    })

    it('should handle large lists efficiently', async () => {
      const items = performanceHelpers.createLargeDataset(1000)
      
      const { performanceMonitor } = renderWithPerformance(
        <MemoizedList
          items={items}
          renderItem={(item) => <div>{item.name}</div>}
          keyExtractor={(item) => item.id.toString()}
        />
      )

      // Even with 1000 items, initial render should be reasonable
      expect(performanceMonitor.getAverageRenderTime()).toBeLessThan(100)
    })
  })

  describe('VirtualList', () => {
    it('should virtualize large lists efficiently', async () => {
      const items = performanceHelpers.createLargeDataset(10000)
      
      const { performanceMonitor } = renderWithPerformance(
        <div style={{ height: '600px', overflow: 'auto' }}>
          <VirtualList
            items={items}
            height={600}
            itemHeight={50}
            renderItem={(item) => (
              <div style={{ height: 50 }}>{item.name}</div>
            )}
          />
        </div>
      )

      // Should render quickly even with 10k items
      expect(performanceMonitor.getAverageRenderTime()).toBeLessThan(50)

      // Check that only visible items are rendered
      const renderedItems = screen.getAllByText(/Item \d+/)
      expect(renderedItems.length).toBeLessThan(20) // Only visible items
    })

    it('should handle scroll performance', async () => {
      const items = performanceHelpers.createLargeDataset(10000)
      const fpsMonitor = new FPSMonitor()
      
      render(
        <div style={{ height: '600px', overflow: 'auto' }} data-testid="scroll-container">
          <VirtualList
            items={items}
            height={600}
            itemHeight={50}
            renderItem={(item) => (
              <div style={{ height: 50 }}>{item.name}</div>
            )}
          />
        </div>
      )

      const scrollContainer = screen.getByTestId('scroll-container')
      
      fpsMonitor.start()
      
      // Simulate rapid scrolling
      for (let i = 0; i < 10; i++) {
        act(() => {
          scrollContainer.scrollTop = i * 1000
        })
        await performanceHelpers.waitForIdle()
      }
      
      fpsMonitor.stop()
      
      // Should maintain good FPS during scrolling
      expect(fpsMonitor.getAverageFPS()).toBeGreaterThan(30)
    })
  })

  describe('DeferredComponent', () => {
    it('should defer non-critical rendering', async () => {
      const monitor = new ComponentPerformanceMonitor()
      
      monitor.startRender()
      render(
        <DeferredComponent delay={100}>
          <div data-testid="deferred-content">Deferred Content</div>
        </DeferredComponent>
      )
      monitor.endRender()

      // Initial render should be instant
      expect(monitor.getAverageRenderTime()).toBeLessThan(5)

      // Content should not be visible initially
      expect(screen.queryByTestId('deferred-content')).not.toBeInTheDocument()

      // Wait for deferred content
      await waitFor(() => {
        expect(screen.getByTestId('deferred-content')).toBeInTheDocument()
      }, { timeout: 200 })
    })
  })

  describe('Lazy Loading Components', () => {
    it('should lazy load components with code splitting', async () => {
      const { performanceMonitor } = renderWithPerformance(
        <Suspense fallback={<div>Loading...</div>}>
          <HeavyComponent />
        </Suspense>
      )

      // Initial render with suspense should be fast
      expect(performanceMonitor.getAverageRenderTime()).toBeLessThan(10)

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument()

      // Wait for lazy component
      await waitFor(() => {
        expect(screen.getByTestId('heavy-component')).toBeInTheDocument()
      })
    })
  })

  describe('VirtualGrid', () => {
    it('should virtualize grid layouts efficiently', async () => {
      const items = performanceHelpers.createLargeDataset(10000)
      
      const { performanceMonitor } = renderWithPerformance(
        <div style={{ height: '600px', width: '800px', overflow: 'auto' }}>
          <VirtualGrid
            items={items}
            columnCount={4}
            rowHeight={100}
            columnWidth={200}
            height={600}
            width={800}
            renderItem={(item) => (
              <div style={{ height: 100, width: 200 }}>{item.name}</div>
            )}
          />
        </div>
      )

      // Should handle large grids efficiently
      expect(performanceMonitor.getAverageRenderTime()).toBeLessThan(50)
    })
  })

  describe('Memory Leak Prevention', () => {
    it('should not leak memory on repeated mounting/unmounting', async () => {
      const detector = new MemoryLeakDetector()
      detector.start()

      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <VirtualList
            items={performanceHelpers.createLargeDataset(1000)}
            height={600}
            itemHeight={50}
            renderItem={(item) => <div>{item.name}</div>}
          />
        )
        
        await performanceHelpers.waitForIdle()
        unmount()
        
        // Force garbage collection if available
        performanceHelpers.forceGC()
        detector.sample()
      }

      const { leaked, delta } = await detector.checkForLeak()
      expect(leaked).toBe(false)
      expect(delta).toBeLessThan(5 * 1024 * 1024) // Less than 5MB increase
    })
  })

  describe('OptimizedImage', () => {
    it('should handle responsive images efficiently', async () => {
      const { performanceMonitor } = renderWithPerformance(
        <OptimizedImage
          src="image.jpg"
          alt="Test"
          sizes="(max-width: 768px) 100vw, 50vw"
          srcSet="image-320.jpg 320w, image-640.jpg 640w, image-1280.jpg 1280w"
        />
      )

      expect(performanceMonitor.getAverageRenderTime()).toBeLessThan(10)
    })

    it('should optimize image loading with progressive enhancement', async () => {
      const { container } = render(
        <OptimizedImage
          src="high-res.jpg"
          placeholder="low-res.jpg"
          alt="Progressive Image"
          loading="lazy"
          decoding="async"
        />
      )

      const img = container.querySelector('img')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('decoding', 'async')
    })
  })

  describe('WindowScroller', () => {
    it('should sync virtual scrolling with window scroll', async () => {
      const items = performanceHelpers.createLargeDataset(1000)
      
      render(
        <WindowScroller>
          {({ height, isScrolling, scrollTop }) => (
            <VirtualList
              items={items}
              height={height}
              itemHeight={50}
              scrollTop={scrollTop}
              isScrolling={isScrolling}
              renderItem={(item) => <div>{item.name}</div>}
            />
          )}
        </WindowScroller>
      )

      // Simulate window scroll
      act(() => {
        window.scrollY = 500
        window.dispatchEvent(new Event('scroll'))
      })

      await performanceHelpers.waitForIdle()

      // Should update virtual list based on window scroll
      const visibleItems = screen.getAllByText(/Item \d+/)
      expect(visibleItems.length).toBeGreaterThan(0)
    })
  })

  describe('Component Update Performance', () => {
    it('should batch updates efficiently', async () => {
      const UpdateTest = () => {
        const [count, setCount] = React.useState(0)
        
        const handleMultipleUpdates = () => {
          // Multiple state updates should be batched
          setCount(c => c + 1)
          setCount(c => c + 1)
          setCount(c => c + 1)
        }

        return (
          <div>
            <span data-testid="count">{count}</span>
            <button onClick={handleMultipleUpdates}>Update</button>
          </div>
        )
      }

      const monitor = new ComponentPerformanceMonitor()
      const { getByRole, getByTestId } = render(<UpdateTest />)

      monitor.startRender()
      await userEvent.click(getByRole('button'))
      monitor.endRender()

      // Should batch updates and render once
      expect(getByTestId('count')).toHaveTextContent('3')
      expect(monitor.getRenderCount()).toBe(1)
    })
  })
})