import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton, type SkeletonProps } from './Skeleton'

export interface SkeletonCardProps extends Omit<SkeletonProps, 'shape'> {
  /**
   * Show image placeholder
   */
  showImage?: boolean
  /**
   * Image height
   */
  imageHeight?: string | number
  /**
   * Number of description lines
   */
  lines?: number
  /**
   * Show action buttons
   */
  showActions?: boolean
  /**
   * Card layout variant
   */
  layout?: 'vertical' | 'horizontal' | 'grid'
  /**
   * Show avatar instead of image
   */
  showAvatar?: boolean
  /**
   * Show metadata (date, tags, etc.)
   */
  showMetadata?: boolean
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  className,
  showImage = true,
  imageHeight = 192,
  lines = 2,
  showActions = false,
  layout = 'vertical',
  showAvatar = false,
  showMetadata = false,
  variant,
  animation,
  animate,
  ...props 
}) => {
  const skeletonProps = { variant, animation, animate }

  if (layout === 'horizontal') {
    return (
      <div className={cn('flex gap-4', className)} {...props}>
        {showImage && (
          <Skeleton 
            className="flex-shrink-0" 
            width={showAvatar ? 64 : 120} 
            height={showAvatar ? 64 : 90}
            shape={showAvatar ? 'circular' : 'rectangular'}
            {...skeletonProps}
          />
        )}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" {...skeletonProps} />
          <div className="space-y-2">
            {Array.from({ length: lines }, (_, i) => (
              <Skeleton 
                key={i} 
                className="h-4" 
                width={i === lines - 1 ? '60%' : '100%'}
                {...skeletonProps}
              />
            ))}
          </div>
          {showMetadata && (
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-3 w-16" {...skeletonProps} />
              <Skeleton className="h-3 w-20" {...skeletonProps} />
            </div>
          )}
          {showActions && (
            <div className="flex gap-2 mt-3">
              <Skeleton className="h-8 w-20" {...skeletonProps} />
              <Skeleton className="h-8 w-20" {...skeletonProps} />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (layout === 'grid') {
    return (
      <div className={cn('space-y-3', className)} {...props}>
        {showImage && (
          <Skeleton 
            className="w-full aspect-square" 
            shape="rectangular"
            {...skeletonProps}
          />
        )}
        <div className="space-y-2 px-1">
          <Skeleton className="h-4 w-3/4" {...skeletonProps} />
          <Skeleton className="h-3 w-1/2" {...skeletonProps} />
          {showMetadata && (
            <div className="flex justify-between items-center mt-2">
              <Skeleton className="h-5 w-16" {...skeletonProps} />
              <Skeleton className="h-5 w-20" {...skeletonProps} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Default vertical layout
  return (
    <div className={cn('space-y-3', className)} {...props}>
      {showImage && (
        <Skeleton 
          className="w-full" 
          height={imageHeight}
          shape="rectangular"
          {...skeletonProps}
        />
      )}
      <div className="space-y-3 p-4">
        {showAvatar && (
          <div className="flex items-center gap-3">
            <Skeleton 
              width={40} 
              height={40} 
              shape="circular"
              {...skeletonProps}
            />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-32" {...skeletonProps} />
              <Skeleton className="h-3 w-24" {...skeletonProps} />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" {...skeletonProps} />
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton 
              key={i} 
              className="h-4" 
              width={i === lines - 1 ? '60%' : '100%'}
              {...skeletonProps}
            />
          ))}
        </div>
        {showMetadata && (
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-6 w-16 rounded-full" {...skeletonProps} />
            <Skeleton className="h-6 w-20 rounded-full" {...skeletonProps} />
            <Skeleton className="h-6 w-24 rounded-full" {...skeletonProps} />
          </div>
        )}
        {showActions && (
          <div className="flex gap-2 justify-end mt-4">
            <Skeleton className="h-9 w-24" {...skeletonProps} />
            <Skeleton className="h-9 w-24" {...skeletonProps} />
          </div>
        )}
      </div>
    </div>
  )
}

// Preset card skeleton variants
export const SkeletonProductCard: React.FC<Omit<SkeletonCardProps, 'layout'>> = (props) => (
  <SkeletonCard 
    layout="grid" 
    showImage 
    showMetadata 
    lines={1}
    {...props}
  />
)

export const SkeletonBlogCard: React.FC<Omit<SkeletonCardProps, 'layout'>> = (props) => (
  <SkeletonCard 
    layout="vertical"
    showImage
    showAvatar
    showMetadata
    lines={3}
    {...props}
  />
)

export const SkeletonProfileCard: React.FC<Omit<SkeletonCardProps, 'layout'>> = (props) => (
  <SkeletonCard
    layout="horizontal"
    showAvatar
    showActions
    lines={2}
    {...props}
  />
)