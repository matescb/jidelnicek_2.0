import React, { useState } from 'react'
import { 
  Spinner, 
  LoadingOverlay, 
  LoadingButton, 
  InfiniteLoader, 
  LoadingDots, 
  TypingIndicator,
  ProgressRing,
  ContentLoader,
  ErrorState,
  EmptyState,
  AsyncComponent,
  SuspenseFallback
} from './index'
import { Button } from '../button'

export const LoadingShowcase: React.FC = () => {
  const [showOverlay, setShowOverlay] = useState(false)
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [contentState, setContentState] = useState<'loading' | 'error' | 'empty' | 'success'>('success')
  const [infiniteLoading, setInfiniteLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  
  const handleButtonClick = async () => {
    setButtonState('loading')
    await new Promise(resolve => setTimeout(resolve, 2000))
    setButtonState('success')
    await new Promise(resolve => setTimeout(resolve, 1500))
    setButtonState('idle')
  }
  
  const handleLoadMore = async () => {
    setInfiniteLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setInfiniteLoading(false)
    // Simulate end of list after 3 loads
    if (Math.random() > 0.7) {
      setHasMore(false)
    }
  }
  
  const simulateProgress = () => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 300)
  }
  
  return (
    <div className="space-y-12 p-8">
      {/* Spinner Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Spinner Variants</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center space-y-2">
            <Spinner variant="circle" size="lg" />
            <p className="text-sm text-gray-600">Circle</p>
          </div>
          <div className="text-center space-y-2">
            <Spinner variant="dots" size="lg" />
            <p className="text-sm text-gray-600">Dots</p>
          </div>
          <div className="text-center space-y-2">
            <Spinner variant="bars" size="lg" />
            <p className="text-sm text-gray-600">Bars</p>
          </div>
          <div className="text-center space-y-2">
            <Spinner variant="pulse" size="lg" />
            <p className="text-sm text-gray-600">Pulse</p>
          </div>
        </div>
      </section>
      
      {/* Spinner Sizes */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Spinner Sizes</h2>
        <div className="flex items-center gap-8">
          <Spinner size="xs" />
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
          <Spinner size="xl" />
        </div>
      </section>
      
      {/* Spinner Colors */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Spinner Colors</h2>
        <div className="flex items-center gap-8">
          <Spinner color="primary" />
          <Spinner color="secondary" />
          <Spinner color="destructive" />
          <Spinner color="success" />
          <Spinner color="warning" />
        </div>
      </section>
      
      {/* Loading Overlay */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Loading Overlay</h2>
        <div className="flex gap-4 flex-wrap">
          <Button onClick={() => setShowOverlay(true)}>
            Show Loading Overlay
          </Button>
          <Button 
            onClick={() => {
              setShowOverlay(true)
              setProgress(0)
              const interval = setInterval(() => {
                setProgress(prev => {
                  if (prev >= 100) {
                    clearInterval(interval)
                    setTimeout(() => setShowOverlay(false), 500)
                    return 100
                  }
                  return prev + 10
                })
              }, 300)
            }}
          >
            Show with Progress
          </Button>
        </div>
        <LoadingOverlay
          isOpen={showOverlay}
          message="Processing your request..."
          progress={progress > 0 ? progress : undefined}
          onCancel={() => setShowOverlay(false)}
          variant="blur"
        />
      </section>
      
      {/* Loading Button */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Loading Button</h2>
        <div className="flex gap-4 flex-wrap">
          <LoadingButton
            isLoading={buttonState === 'loading'}
            isSuccess={buttonState === 'success'}
            isError={buttonState === 'error'}
            loadingText="Processing..."
            successText="Complete!"
            onClick={handleButtonClick}
          >
            Submit Form
          </LoadingButton>
          
          <LoadingButton
            variant="outline"
            isLoading={buttonState === 'loading'}
            spinnerVariant="dots"
          >
            Save Draft
          </LoadingButton>
          
          <LoadingButton
            variant="destructive"
            isLoading={buttonState === 'loading'}
            spinnerVariant="bars"
            size="sm"
          >
            Delete
          </LoadingButton>
        </div>
      </section>
      
      {/* Loading Dots */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Loading Dots & Typing Indicator</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-8">
            <LoadingDots size="xs" />
            <LoadingDots size="sm" />
            <LoadingDots size="md" />
            <LoadingDots size="lg" />
            <LoadingDots size="xl" />
          </div>
          <div className="space-y-2">
            <TypingIndicator userName="Alice" />
            <LoadingDots variant="bubble" />
          </div>
        </div>
      </section>
      
      {/* Progress Ring */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Progress Ring</h2>
        <div className="flex items-center gap-8">
          <ProgressRing value={75} size="sm" />
          <ProgressRing value={45} size="md" color="warning" />
          <ProgressRing value={100} size="lg" color="success" showCheckmark />
          <ProgressRing isIndeterminate size="md" />
          <div>
            <ProgressRing value={progress} size="lg" />
            <Button size="sm" onClick={simulateProgress} className="mt-2">
              Start Progress
            </Button>
          </div>
        </div>
      </section>
      
      {/* Content Loader */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Content Loader States</h2>
        <div className="flex gap-4 mb-4">
          <Button size="sm" onClick={() => setContentState('loading')}>Loading</Button>
          <Button size="sm" onClick={() => setContentState('error')}>Error</Button>
          <Button size="sm" onClick={() => setContentState('empty')}>Empty</Button>
          <Button size="sm" onClick={() => setContentState('success')}>Success</Button>
        </div>
        <div className="border rounded-lg p-4">
          <ContentLoader
            isLoading={contentState === 'loading'}
            isError={contentState === 'error'}
            isEmpty={contentState === 'empty'}
            onRetry={() => setContentState('loading')}
          >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Content Loaded Successfully</h3>
              <p className="text-gray-600">This is the actual content that loads after the loading state.</p>
            </div>
          </ContentLoader>
        </div>
      </section>
      
      {/* Infinite Loader */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Infinite Loader</h2>
        <div className="border rounded-lg p-4 space-y-4">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                Item {i}
              </div>
            ))}
          </div>
          <InfiniteLoader
            hasMore={hasMore}
            isLoading={infiniteLoading}
            onLoadMore={handleLoadMore}
            spinnerVariant="dots"
          />
        </div>
      </section>
      
      {/* Error and Empty States */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Error & Empty States</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <ErrorState
              message="Failed to load data"
              error={new Error('Network connection failed')}
              onRetry={() => console.log('Retry clicked')}
            />
          </div>
          <div className="border rounded-lg p-4">
            <EmptyState
              title="No recipes found"
              message="Start by creating your first recipe to get cooking!"
              action={<Button size="sm">Create Recipe</Button>}
            />
          </div>
        </div>
      </section>
    </div>
  )
}