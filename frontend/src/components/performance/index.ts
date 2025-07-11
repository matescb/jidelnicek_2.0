/**
 * Performance-optimized components for React applications
 * These components provide various optimization strategies to improve rendering performance
 */

export { MemoizedList, createMemoizedList } from './MemoizedList'
export { VirtualList, useVirtualListDynamic } from './VirtualList'
export { OptimizedImage, preloadImage, useResponsiveImage } from './OptimizedImage'
export { 
  DeferredComponent, 
  useDeferred, 
  BatchDeferred, 
  ProgressiveDisclosure,
  DeferredUtils 
} from './DeferredComponent'
export { LazyImage } from './LazyImage'
export { ResponsivePicture, PicturePresets, usePicturePreset } from './ResponsivePicture'

// Re-export optimization utilities
export * from '@/utils/performanceOptimization'
export * from '@/hooks/useOptimization'
export * from '@/utils/imageOptimization'
export * from '@/hooks/useLazyLoading'