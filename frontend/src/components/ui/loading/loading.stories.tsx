import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
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
  EmptyState
} from './index'
import { Button } from '../button'

const meta: Meta = {
  title: 'UI/Loading',
  tags: ['autodocs'],
}

export default meta

// Spinner Stories
export const SpinnerVariants: StoryObj = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-4">
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
  ),
}

export const SpinnerSizes: StoryObj = {
  render: () => (
    <div className="flex items-center gap-8 p-4">
      <Spinner size="xs" />
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
      <Spinner size="xl" />
    </div>
  ),
}

export const SpinnerColors: StoryObj = {
  render: () => (
    <div className="flex items-center gap-8 p-4">
      <Spinner color="primary" />
      <Spinner color="secondary" />
      <Spinner color="destructive" />
      <Spinner color="success" />
      <Spinner color="warning" />
    </div>
  ),
}

// Loading Overlay Story
export const LoadingOverlayDemo: StoryObj = {
  render: () => {
    const [showOverlay, setShowOverlay] = useState(false)
    const [progress, setProgress] = useState(0)
    
    const showWithProgress = () => {
      setShowOverlay(true)
      setProgress(0)
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            setTimeout(() => {
              setShowOverlay(false)
              setProgress(0)
            }, 500)
            return 100
          }
          return prev + 10
        })
      }, 300)
    }
    
    return (
      <div className="space-y-4 p-4">
        <div className="flex gap-4">
          <Button onClick={() => setShowOverlay(true)}>
            Show Basic Overlay
          </Button>
          <Button onClick={showWithProgress}>
            Show with Progress
          </Button>
        </div>
        
        <LoadingOverlay
          isOpen={showOverlay}
          message="Processing your request..."
          progress={progress > 0 ? progress : undefined}
          onCancel={() => {
            setShowOverlay(false)
            setProgress(0)
          }}
          variant="blur"
        />
      </div>
    )
  },
}

// Loading Button Story
export const LoadingButtonDemo: StoryObj = {
  render: () => {
    const [state1, setState1] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [state2, setState2] = useState<'idle' | 'loading'>('idle')
    
    const handleClick1 = async () => {
      setState1('loading')
      await new Promise(resolve => setTimeout(resolve, 2000))
      setState1('success')
      await new Promise(resolve => setTimeout(resolve, 1500))
      setState1('idle')
    }
    
    const handleClick2 = async () => {
      setState2('loading')
      await new Promise(resolve => setTimeout(resolve, 2000))
      setState2('idle')
    }
    
    return (
      <div className="flex gap-4 flex-wrap p-4">
        <LoadingButton
          isLoading={state1 === 'loading'}
          isSuccess={state1 === 'success'}
          isError={state1 === 'error'}
          loadingText="Processing..."
          successText="Complete!"
          onClick={handleClick1}
        >
          Submit Form
        </LoadingButton>
        
        <LoadingButton
          variant="outline"
          isLoading={state2 === 'loading'}
          spinnerVariant="dots"
          onClick={handleClick2}
        >
          Save Draft
        </LoadingButton>
        
        <LoadingButton
          variant="destructive"
          isLoading={false}
          size="sm"
        >
          Delete
        </LoadingButton>
      </div>
    )
  },
}

// Progress Ring Story
export const ProgressRingDemo: StoryObj = {
  render: () => {
    const [progress, setProgress] = useState(0)
    
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
      <div className="space-y-8 p-4">
        <div className="flex items-center gap-8">
          <ProgressRing value={25} size="sm" />
          <ProgressRing value={50} size="md" color="warning" />
          <ProgressRing value={75} size="lg" color="primary" />
          <ProgressRing value={100} size="lg" color="success" showCheckmark />
        </div>
        
        <div className="flex items-center gap-8">
          <ProgressRing isIndeterminate size="md" />
          <div className="text-center">
            <ProgressRing value={progress} size="lg" />
            <Button size="sm" onClick={simulateProgress} className="mt-4">
              Start Progress
            </Button>
          </div>
        </div>
      </div>
    )
  },
}

// Loading Dots Story
export const LoadingDotsDemo: StoryObj = {
  render: () => (
    <div className="space-y-8 p-4">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Sizes</h3>
        <div className="flex items-center gap-8">
          <LoadingDots size="xs" />
          <LoadingDots size="sm" />
          <LoadingDots size="md" />
          <LoadingDots size="lg" />
          <LoadingDots size="xl" />
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Chat Indicators</h3>
        <div className="space-y-2">
          <TypingIndicator userName="Alice" />
          <LoadingDots variant="bubble" />
        </div>
      </div>
    </div>
  ),
}

// Content States Story
export const ContentStatesDemo: StoryObj = {
  render: () => {
    const [state, setState] = useState<'loading' | 'error' | 'empty' | 'success'>('success')
    
    return (
      <div className="space-y-4 p-4">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setState('loading')}>Loading</Button>
          <Button size="sm" onClick={() => setState('error')}>Error</Button>
          <Button size="sm" onClick={() => setState('empty')}>Empty</Button>
          <Button size="sm" onClick={() => setState('success')}>Success</Button>
        </div>
        
        <div className="border rounded-lg p-4 min-h-[200px]">
          <ContentLoader
            isLoading={state === 'loading'}
            isError={state === 'error'}
            isEmpty={state === 'empty'}
            onRetry={() => setState('loading')}
          >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Content Loaded Successfully</h3>
              <p className="text-gray-600">
                This is the actual content that loads after the loading state.
              </p>
            </div>
          </ContentLoader>
        </div>
      </div>
    )
  },
}

// Infinite Loader Story
export const InfiniteLoaderDemo: StoryObj = {
  render: () => {
    const [items, setItems] = useState([1, 2, 3, 4, 5])
    const [isLoading, setIsLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    
    const loadMore = async () => {
      setIsLoading(true)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const newItems = Array.from(
        { length: 5 }, 
        (_, i) => items.length + i + 1
      )
      setItems([...items, ...newItems])
      
      if (items.length >= 15) {
        setHasMore(false)
      }
      
      setIsLoading(false)
    }
    
    return (
      <div className="max-w-md mx-auto p-4">
        <div className="border rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {items.map(i => (
              <div key={i} className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                Item {i}
              </div>
            ))}
          </div>
          
          <InfiniteLoader
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={loadMore}
            spinnerVariant="dots"
          />
        </div>
      </div>
    )
  },
}