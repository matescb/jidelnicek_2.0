import React, { useState } from 'react'
import { 
  LoadingSpinner, 
  LoadingDots, 
  InlineLoadingDots,
  LoadingOverlay,
  ContainerLoading,
  PageLoading,
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  ProgressBar,
  ProgressCircle
} from './'

export const LoadingShowcase: React.FC = () => {
  const [showOverlay, setShowOverlay] = useState(false)
  const [showPageLoading, setShowPageLoading] = useState(false)
  const [progress, setProgress] = useState(65)

  return (
    <div className="p-8 space-y-12 bg-white dark:bg-gray-950">
      {/* Loading Spinners */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Loading Spinners</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Sizes</h3>
            <div className="flex items-center gap-4">
              <LoadingSpinner size="sm" />
              <LoadingSpinner size="md" />
              <LoadingSpinner size="lg" />
              <LoadingSpinner size="xl" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Variants</h3>
            <div className="flex items-center gap-4">
              <LoadingSpinner variant="default" />
              <LoadingSpinner variant="primary" />
              <LoadingSpinner variant="secondary" />
              <LoadingSpinner variant="destructive" />
              <LoadingSpinner variant="success" />
              <LoadingSpinner variant="warning" />
            </div>
          </div>
        </div>
      </section>

      {/* Loading Dots */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Loading Dots</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Sizes</h3>
            <div className="flex items-center gap-8">
              <LoadingDots size="sm" />
              <LoadingDots size="md" />
              <LoadingDots size="lg" />
              <LoadingDots size="xl" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Variants</h3>
            <div className="flex items-center gap-8">
              <LoadingDots variant="default" />
              <LoadingDots variant="primary" />
              <LoadingDots variant="secondary" />
              <LoadingDots variant="success" />
              <LoadingDots variant="warning" />
              <LoadingDots variant="danger" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Inline Usage</h3>
            <p className="text-gray-700 dark:text-gray-300">
              <InlineLoadingDots size="sm" variant="primary" />
            </p>
          </div>
        </div>
      </section>

      {/* Progress Bars */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Progress Bars</h2>
        <div className="space-y-6 max-w-md">
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Sizes</h3>
            <div className="space-y-3">
              <ProgressBar value={progress} size="sm" />
              <ProgressBar value={progress} size="md" />
              <ProgressBar value={progress} size="lg" />
              <ProgressBar value={progress} size="xl" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Variants</h3>
            <div className="space-y-3">
              <ProgressBar value={progress} indicatorVariant="default" />
              <ProgressBar value={progress} indicatorVariant="success" />
              <ProgressBar value={progress} indicatorVariant="warning" />
              <ProgressBar value={progress} indicatorVariant="danger" />
              <ProgressBar value={progress} indicatorVariant="info" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">With Label</h3>
            <ProgressBar value={progress} max={100} showLabel indicatorVariant="primary" />
          </div>
        </div>
      </section>

      {/* Progress Circles */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Progress Circles</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Sizes</h3>
            <div className="flex items-center gap-4">
              <ProgressCircle value={progress} size="sm" />
              <ProgressCircle value={progress} size="md" />
              <ProgressCircle value={progress} size="lg" />
              <ProgressCircle value={progress} size="xl" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Variants</h3>
            <div className="flex items-center gap-4">
              <ProgressCircle value={progress} variant="default" />
              <ProgressCircle value={progress} variant="success" />
              <ProgressCircle value={progress} variant="warning" />
              <ProgressCircle value={progress} variant="danger" />
              <ProgressCircle value={progress} variant="info" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Without Label</h3>
            <div className="flex items-center gap-4">
              <ProgressCircle value={progress} showLabel={false} />
            </div>
          </div>
        </div>
      </section>

      {/* Skeletons */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Skeletons</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Basic Skeleton</h3>
            <div className="space-y-2 max-w-md">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Skeleton Text</h3>
            <div className="space-y-2 max-w-md">
              <SkeletonText />
              <SkeletonText className="w-3/4" />
              <SkeletonText className="w-1/2" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Skeleton Avatar</h3>
            <div className="flex items-center gap-4">
              <SkeletonAvatar size="sm" />
              <SkeletonAvatar size="md" />
              <SkeletonAvatar size="lg" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Skeleton Card</h3>
            <div className="max-w-sm">
              <SkeletonCard />
            </div>
          </div>
        </div>
      </section>

      {/* Loading Overlays */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Loading Overlays</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Container Loading</h3>
            <ContainerLoading isLoading text="Loading content..." />
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Overlay with Progress</h3>
            <div className="relative h-48 bg-gray-100 dark:bg-gray-900 rounded-lg">
              <LoadingOverlay 
                isLoading 
                indicator="progress" 
                progress={progress} 
                text="Processing files..."
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Interactive Overlays</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setShowOverlay(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Show Container Overlay
              </button>
              <button
                onClick={() => setShowPageLoading(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Show Page Loading
              </button>
            </div>
            
            {/* Container with overlay */}
            <div className="relative mt-4 p-8 bg-gray-100 dark:bg-gray-900 rounded-lg h-32">
              <p className="text-gray-700 dark:text-gray-300">This is content that can be covered by an overlay.</p>
              <LoadingOverlay 
                isLoading={showOverlay}
                variant="blur"
                text="Loading..."
                closeOnClick
                onClick={() => setShowOverlay(false)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Page Loading Overlay */}
      <PageLoading 
        isLoading={showPageLoading}
        variant="blur"
        text="Loading application..."
        closeOnClick
        onClick={() => setShowPageLoading(false)}
      />

      {/* Progress Control */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Progress Control</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setProgress(Math.max(0, progress - 10))}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
          >
            -10%
          </button>
          <span className="text-gray-700 dark:text-gray-300 min-w-[4rem] text-center">{progress}%</span>
          <button
            onClick={() => setProgress(Math.min(100, progress + 10))}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
          >
            +10%
          </button>
        </div>
      </section>
    </div>
  )
}