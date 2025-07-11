import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton, type SkeletonProps } from './Skeleton'

export interface SkeletonAvatarProps extends Omit<SkeletonProps, 'shape' | 'width' | 'height'> {
  /**
   * Avatar size
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number
  /**
   * Avatar shape
   */
  shape?: 'circular' | 'square'
  /**
   * Show status indicator
   */
  showStatus?: boolean
  /**
   * Status position
   */
  statusPosition?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
  /**
   * Show initials placeholder
   */
  showInitials?: boolean
  /**
   * Show border
   */
  showBorder?: boolean
  /**
   * Group avatar (overlapping avatars)
   */
  isGrouped?: boolean
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({ 
  className,
  size = 'md',
  shape = 'circular',
  showStatus = false,
  statusPosition = 'bottom-right',
  showInitials = false,
  showBorder = false,
  isGrouped = false,
  variant,
  animation,
  animate,
  ...props 
}) => {
  const skeletonProps = { variant, animation, animate }

  const sizeMap = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    '2xl': 96
  }

  const avatarSize = typeof size === 'number' ? size : sizeMap[size]
  const statusSize = avatarSize <= 32 ? 8 : avatarSize <= 48 ? 10 : 12

  const statusPositionClasses = {
    'top-right': 'top-0 right-0',
    'bottom-right': 'bottom-0 right-0',
    'top-left': 'top-0 left-0',
    'bottom-left': 'bottom-0 left-0'
  }

  return (
    <div 
      className={cn(
        'relative inline-block',
        isGrouped && '-ml-2 first:ml-0',
        className
      )}
      style={{ width: avatarSize, height: avatarSize }}
      {...props}
    >
      <Skeleton 
        className={cn(
          showBorder && 'ring-2 ring-white dark:ring-gray-950',
          isGrouped && 'ring-2 ring-white dark:ring-gray-950'
        )}
        width={avatarSize} 
        height={avatarSize} 
        shape={shape}
        {...skeletonProps}
      />
      
      {showInitials && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton 
            className="opacity-50" 
            width={avatarSize * 0.5} 
            height={avatarSize * 0.3}
            {...skeletonProps}
          />
        </div>
      )}

      {showStatus && (
        <div 
          className={cn(
            'absolute',
            statusPositionClasses[statusPosition],
            'transform translate-x-1/4 -translate-y-1/4'
          )}
        >
          <Skeleton 
            width={statusSize} 
            height={statusSize} 
            shape="circular"
            variant="dark"
            className="ring-2 ring-white dark:ring-gray-950"
            {...skeletonProps}
          />
        </div>
      )}
    </div>
  )
}

// Avatar group component
export interface SkeletonAvatarGroupProps extends Omit<SkeletonAvatarProps, 'isGrouped'> {
  /**
   * Number of avatars to show
   */
  count?: number
  /**
   * Maximum avatars to display
   */
  max?: number
  /**
   * Show remainder count
   */
  showRemainder?: boolean
}

export const SkeletonAvatarGroup: React.FC<SkeletonAvatarGroupProps> = ({ 
  count = 3,
  max = 5,
  showRemainder = true,
  size = 'md',
  className,
  ...props 
}) => {
  const displayCount = Math.min(count, max)
  const remainder = count - displayCount

  return (
    <div className={cn('flex items-center', className)}>
      {Array.from({ length: displayCount }, (_, i) => (
        <SkeletonAvatar 
          key={i} 
          size={size} 
          isGrouped
          showStatus={false}
          {...props} 
        />
      ))}
      {showRemainder && remainder > 0 && (
        <SkeletonAvatar 
          size={size} 
          isGrouped
          showStatus={false}
          {...props} 
        />
      )}
    </div>
  )
}

// Avatar with text component
export interface SkeletonAvatarWithTextProps extends SkeletonAvatarProps {
  /**
   * Show title text
   */
  showTitle?: boolean
  /**
   * Show subtitle text
   */
  showSubtitle?: boolean
  /**
   * Text alignment
   */
  textAlign?: 'left' | 'center' | 'right'
  /**
   * Layout direction
   */
  layout?: 'horizontal' | 'vertical'
}

export const SkeletonAvatarWithText: React.FC<SkeletonAvatarWithTextProps> = ({ 
  showTitle = true,
  showSubtitle = true,
  textAlign = 'left',
  layout = 'horizontal',
  className,
  ...avatarProps 
}) => {
  const skeletonProps = { 
    variant: avatarProps.variant, 
    animation: avatarProps.animation, 
    animate: avatarProps.animate 
  }

  const textAlignClasses = {
    left: 'items-start',
    center: 'items-center',
    right: 'items-end'
  }

  if (layout === 'vertical') {
    return (
      <div className={cn('flex flex-col gap-2', textAlignClasses[textAlign], className)}>
        <SkeletonAvatar {...avatarProps} />
        <div className={cn('space-y-1', textAlignClasses[textAlign])}>
          {showTitle && <Skeleton className="h-4 w-24" {...skeletonProps} />}
          {showSubtitle && <Skeleton className="h-3 w-32" {...skeletonProps} />}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <SkeletonAvatar {...avatarProps} />
      <div className="space-y-1 flex-1">
        {showTitle && <Skeleton className="h-4 w-32" {...skeletonProps} />}
        {showSubtitle && <Skeleton className="h-3 w-48" {...skeletonProps} />}
      </div>
    </div>
  )
}

// Profile avatar skeleton (large with details)
export const SkeletonProfileAvatar: React.FC<SkeletonAvatarProps> = (props) => {
  const skeletonProps = { 
    variant: props.variant, 
    animation: props.animation, 
    animate: props.animate 
  }

  return (
    <div className={cn('flex flex-col items-center space-y-4', props.className)}>
      <SkeletonAvatar size="2xl" showBorder {...props} />
      <div className="text-center space-y-2">
        <Skeleton className="h-6 w-32 mx-auto" {...skeletonProps} />
        <Skeleton className="h-4 w-48 mx-auto" {...skeletonProps} />
        <div className="flex gap-2 justify-center mt-3">
          <Skeleton className="h-8 w-24" {...skeletonProps} />
          <Skeleton className="h-8 w-24" {...skeletonProps} />
        </div>
      </div>
    </div>
  )
}