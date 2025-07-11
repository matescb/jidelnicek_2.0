import { act, renderHook, RenderHookResult } from '@testing-library/react'
import { ReactElement } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'

/**
 * Performance test utilities for measuring component performance
 */

// Performance metrics interface
export interface PerformanceMetrics {
  renderTime: number
  renderCount: number
  memoryUsage?: MemoryUsage
  updateTime?: number
  mountTime?: number
  unmountTime?: number
}

// Memory usage interface
export interface MemoryUsage {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

// Component performance monitor
export class ComponentPerformanceMonitor {
  private renderStartTime = 0
  private renderCount = 0
  private metrics: PerformanceMetrics[] = []

  startRender() {
    this.renderStartTime = performance.now()
  }

  endRender() {
    const renderTime = performance.now() - this.renderStartTime
    this.renderCount++
    
    const metrics: PerformanceMetrics = {
      renderTime,
      renderCount: this.renderCount,
      memoryUsage: this.getMemoryUsage()
    }
    
    this.metrics.push(metrics)
    return metrics
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics
  }

  getAverageRenderTime(): number {
    if (this.metrics.length === 0) return 0
    const totalTime = this.metrics.reduce((sum, m) => sum + m.renderTime, 0)
    return totalTime / this.metrics.length
  }

  getRenderCount(): number {
    return this.renderCount
  }

  reset() {
    this.renderStartTime = 0
    this.renderCount = 0
    this.metrics = []
  }

  private getMemoryUsage(): MemoryUsage | undefined {
    // @ts-ignore - performance.memory is not in TypeScript types
    if (performance.memory) {
      return {
        // @ts-ignore
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        // @ts-ignore
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        // @ts-ignore
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      }
    }
    return undefined
  }
}

// Render with performance monitoring
export function renderWithPerformance(
  ui: ReactElement,
  options?: RenderOptions
): RenderResult & { performanceMonitor: ComponentPerformanceMonitor } {
  const monitor = new ComponentPerformanceMonitor()
  
  monitor.startRender()
  const result = render(ui, options)
  monitor.endRender()

  return {
    ...result,
    performanceMonitor: monitor
  }
}

// Hook performance monitor
export function renderHookWithPerformance<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: {
    initialProps?: TProps
    wrapper?: React.ComponentType<{ children: React.ReactNode }>
  }
): RenderHookResult<TResult, TProps> & { performanceMonitor: ComponentPerformanceMonitor } {
  const monitor = new ComponentPerformanceMonitor()
  
  monitor.startRender()
  const result = renderHook(hook, options)
  monitor.endRender()

  return {
    ...result,
    performanceMonitor: monitor
  }
}

// Measure re-renders
export async function measureReRenders(
  callback: () => void | Promise<void>,
  expectedCount: number,
  timeout = 1000
): Promise<number> {
  let renderCount = 0
  const originalConsoleError = console.error
  
  // Track renders by intercepting console errors from React
  console.error = (...args) => {
    if (args[0]?.includes?.('rendered')) {
      renderCount++
    }
    originalConsoleError(...args)
  }

  try {
    await act(async () => {
      await callback()
    })

    // Wait for any pending updates
    await new Promise(resolve => setTimeout(resolve, timeout))
    
    return renderCount
  } finally {
    console.error = originalConsoleError
  }
}

// Performance benchmarking
export async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations = 100
): Promise<{
  name: string
  average: number
  min: number
  max: number
  iterations: number
  times: number[]
}> {
  const times: number[] = []
  
  // Warm up
  for (let i = 0; i < 5; i++) {
    await fn()
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  const average = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)

  return {
    name,
    average,
    min,
    max,
    iterations,
    times
  }
}

// Memory leak detector
export class MemoryLeakDetector {
  private initialMemory?: MemoryUsage
  private samples: MemoryUsage[] = []

  start() {
    this.initialMemory = this.getMemoryUsage()
    this.samples = []
  }

  sample() {
    const memory = this.getMemoryUsage()
    if (memory) {
      this.samples.push(memory)
    }
  }

  async checkForLeak(
    threshold = 1048576 // 1MB default threshold
  ): Promise<{ leaked: boolean; delta: number }> {
    if (!this.initialMemory || this.samples.length === 0) {
      return { leaked: false, delta: 0 }
    }

    const lastSample = this.samples[this.samples.length - 1]
    const delta = lastSample.usedJSHeapSize - this.initialMemory.usedJSHeapSize

    return {
      leaked: delta > threshold,
      delta
    }
  }

  private getMemoryUsage(): MemoryUsage | undefined {
    // @ts-ignore
    if (performance.memory) {
      return {
        // @ts-ignore
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        // @ts-ignore
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        // @ts-ignore
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      }
    }
    return undefined
  }
}

// FPS monitor
export class FPSMonitor {
  private lastTime = performance.now()
  private frames = 0
  private fps = 0
  private fpsHistory: number[] = []
  private rafId?: number

  start() {
    this.lastTime = performance.now()
    this.frames = 0
    this.measure()
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
    }
  }

  getFPS(): number {
    return this.fps
  }

  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
  }

  private measure = () => {
    const now = performance.now()
    const delta = now - this.lastTime
    this.frames++

    if (delta >= 1000) {
      this.fps = Math.round((this.frames * 1000) / delta)
      this.fpsHistory.push(this.fps)
      this.frames = 0
      this.lastTime = now
    }

    this.rafId = requestAnimationFrame(this.measure)
  }
}

// Bundle size utilities
export function calculateBundleSize(code: string): {
  raw: number
  gzipped: number
} {
  const rawSize = new Blob([code]).size
  
  // Estimate gzipped size (rough approximation)
  // Real gzip compression typically achieves 70-80% reduction
  const gzipped = Math.round(rawSize * 0.3)
  
  return {
    raw: rawSize,
    gzipped
  }
}

// Performance test helpers
export const performanceHelpers = {
  // Wait for idle callback
  waitForIdle: (timeout = 1000): Promise<void> => {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => resolve(), { timeout })
      } else {
        setTimeout(resolve, 16) // Fallback to next frame
      }
    })
  },

  // Simulate heavy computation
  simulateHeavyComputation: (duration = 100) => {
    const start = performance.now()
    while (performance.now() - start < duration) {
      // Busy loop
    }
  },

  // Create large dataset
  createLargeDataset: (size: number) => {
    return Array.from({ length: size }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: `Description for item ${i}`,
      value: Math.random() * 1000,
      tags: Array.from({ length: 5 }, (_, j) => `tag-${i}-${j}`),
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1
      }
    }))
  },

  // Force garbage collection (if available)
  forceGC: () => {
    // @ts-ignore
    if (global.gc) {
      // @ts-ignore
      global.gc()
    }
  },

  // Measure function execution time
  measureTime: async <T>(
    fn: () => T | Promise<T>
  ): Promise<{ result: T; time: number }> => {
    const start = performance.now()
    const result = await fn()
    const time = performance.now() - start
    return { result, time }
  }
}

// Performance expectations
export const performanceExpectations = {
  // Check if render time is within acceptable range
  toRenderWithinMs: (actual: number, expected: number, tolerance = 0.2) => {
    const pass = actual <= expected * (1 + tolerance)
    return {
      pass,
      message: () =>
        pass
          ? `Expected render time ${actual}ms to not be within ${expected}ms ± ${tolerance * 100}%`
          : `Expected render time ${actual}ms to be within ${expected}ms ± ${tolerance * 100}%`
    }
  },

  // Check if memory usage is acceptable
  toUseMemoryLessThan: (actual: number, expected: number) => {
    const pass = actual < expected
    return {
      pass,
      message: () =>
        pass
          ? `Expected memory usage ${actual} bytes to not be less than ${expected} bytes`
          : `Expected memory usage ${actual} bytes to be less than ${expected} bytes`
    }
  },

  // Check FPS
  toMaintainFPSAbove: (actual: number, expected: number) => {
    const pass = actual >= expected
    return {
      pass,
      message: () =>
        pass
          ? `Expected FPS ${actual} to not be above ${expected}`
          : `Expected FPS ${actual} to be above ${expected}`
    }
  }
}

// Custom Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toRenderWithinMs(expected: number, tolerance?: number): R
      toUseMemoryLessThan(expected: number): R
      toMaintainFPSAbove(expected: number): R
    }
  }
}

// Register custom matchers
expect.extend({
  toRenderWithinMs: performanceExpectations.toRenderWithinMs,
  toUseMemoryLessThan: performanceExpectations.toUseMemoryLessThan,
  toMaintainFPSAbove: performanceExpectations.toMaintainFPSAbove
})