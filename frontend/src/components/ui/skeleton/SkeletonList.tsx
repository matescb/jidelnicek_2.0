import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton, type SkeletonProps } from './Skeleton'

export interface SkeletonListProps extends Omit<SkeletonProps, 'shape'> {
  /**
   * Number of list items
   */
  count?: number
  /**
   * List item variant
   */
  itemVariant?: 'simple' | 'avatar' | 'icon' | 'detailed' | 'media'
  /**
   * Show dividers between items
   */
  showDivider?: boolean
  /**
   * Stagger animation delay (ms)
   */
  staggerDelay?: number
  /**
   * Show more/load more button
   */
  showLoadMore?: boolean
  /**
   * Item height for virtualization
   */
  itemHeight?: number
  /**
   * Custom item renderer
   */
  renderItem?: (index: number) => React.ReactNode
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ 
  className,
  count = 5,
  itemVariant = 'simple',
  showDivider = false,
  staggerDelay = 50,
  showLoadMore = false,
  itemHeight,
  renderItem,
  variant,
  animation,
  animate,
  ...props 
}) => {
  const skeletonProps = { variant, animation, animate }

  const renderListItem = (index: number) => {
    if (renderItem) {
      return renderItem(index)
    }

    const itemContent = () => {
      switch (itemVariant) {
        case 'avatar':
          return (
            <div className="flex items-center gap-3">
              <Skeleton 
                width={40} 
                height={40} 
                shape="circular"
                {...skeletonProps}
              />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" {...skeletonProps} />
                <Skeleton className="h-3 w-48" {...skeletonProps} />
              </div>
              <Skeleton width={24} height={24} shape="square" {...skeletonProps} />
            </div>
          )

        case 'icon':
          return (
            <div className="flex items-center gap-3">
              <Skeleton 
                width={24} 
                height={24} 
                shape="square"
                {...skeletonProps}
              />
              <Skeleton className="h-4 flex-1" {...skeletonProps} />
              <Skeleton className="h-4 w-16" {...skeletonProps} />
            </div>
          )

        case 'detailed':
          return (
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-5 w-48" {...skeletonProps} />
                  <Skeleton className="h-4 w-full max-w-md" {...skeletonProps} />
                  <Skeleton className="h-4 w-3/4 max-w-sm" {...skeletonProps} />
                </div>
                <Skeleton className="h-8 w-20" {...skeletonProps} />
              </div>
              <div className="flex gap-4 text-sm">
                <Skeleton className="h-3 w-24" {...skeletonProps} />
                <Skeleton className="h-3 w-32" {...skeletonProps} />
                <Skeleton className="h-3 w-20" {...skeletonProps} />
              </div>
            </div>
          )

        case 'media':
          return (
            <div className="flex gap-4">
              <Skeleton 
                width={120} 
                height={80} 
                shape="rectangular"
                {...skeletonProps}
              />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" {...skeletonProps} />
                <Skeleton className="h-4 w-full" {...skeletonProps} />
                <Skeleton className="h-4 w-1/2" {...skeletonProps} />
                <div className="flex gap-2 mt-2">
                  <Skeleton className="h-3 w-16" {...skeletonProps} />
                  <Skeleton className="h-3 w-20" {...skeletonProps} />
                </div>
              </div>
            </div>
          )

        default: // simple
          return (
            <div className="space-y-1">
              <Skeleton className="h-4 w-3/4" {...skeletonProps} />
              <Skeleton className="h-3 w-1/2" {...skeletonProps} />
            </div>
          )
      }
    }

    return (
      <div
        key={index}
        className={cn(
          'py-3',
          showDivider && index < count - 1 && 'border-b dark:border-gray-800'
        )}
        style={{
          animationDelay: staggerDelay ? `${index * staggerDelay}ms` : undefined,
          height: itemHeight
        }}
      >
        {itemContent()}
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)} {...props}>
      {Array.from({ length: count }, (_, i) => renderListItem(i))}
      {showLoadMore && (
        <div className="flex justify-center mt-4">
          <Skeleton className="h-10 w-32" {...skeletonProps} />
        </div>
      )}
    </div>
  )
}

// Infinite scroll skeleton list
export const SkeletonInfiniteList: React.FC<
  SkeletonListProps & { 
    loadingMore?: boolean 
  }
> = ({ 
  loadingMore = true,
  ...props 
}) => {
  return (
    <div className="space-y-0">
      <SkeletonList {...props} />
      {loadingMore && (
        <div className="py-4 flex justify-center">
          <div className="flex items-center gap-2">
            <Skeleton 
              width={16} 
              height={16} 
              shape="circular" 
              animation="pulse"
              {...props}
            />
            <Skeleton 
              width={16} 
              height={16} 
              shape="circular" 
              animation="pulse"
              style={{ animationDelay: '150ms' }}
              {...props}
            />
            <Skeleton 
              width={16} 
              height={16} 
              shape="circular" 
              animation="pulse"
              style={{ animationDelay: '300ms' }}
              {...props}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Chat/Message list skeleton
export const SkeletonMessageList: React.FC<SkeletonListProps> = (props) => {
  return (
    <SkeletonList
      {...props}
      renderItem={(index) => {
        const isRight = index % 3 === 0
        const skeletonProps = { 
          variant: props.variant, 
          animation: props.animation, 
          animate: props.animate 
        }
        
        return (
          <div className={cn('flex gap-2', isRight && 'justify-end')}>
            {!isRight && (
              <Skeleton 
                width={32} 
                height={32} 
                shape="circular"
                {...skeletonProps}
              />
            )}
            <div className={cn('space-y-1', isRight && 'items-end')}>
              <Skeleton 
                className="h-10 rounded-2xl" 
                width={180 + Math.random() * 120}
                {...skeletonProps}
              />
              <Skeleton 
                className="h-3" 
                width={60}
                {...skeletonProps}
              />
            </div>
          </div>
        )
      }}
    />
  )
}