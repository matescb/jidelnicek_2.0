import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const skeletonVariants = cva(
  'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
  {
    variants: {
      variant: {
        default: 'bg-gray-200 dark:bg-gray-800',
        light: 'bg-gray-100 dark:bg-gray-900',
        dark: 'bg-gray-300 dark:bg-gray-700',
        primary: 'bg-primary/20 dark:bg-primary/10',
        secondary: 'bg-secondary/20 dark:bg-secondary/10'
      },
      shape: {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-md',
        square: 'rounded-md aspect-square'
      },
      animation: {
        shimmer: '',
        pulse: 'animate-pulse',
        wave: 'animate-wave',
        none: 'before:hidden'
      }
    },
    defaultVariants: {
      variant: 'default',
      shape: 'rectangular',
      animation: 'shimmer'
    }
  }
)

export interface SkeletonProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /**
   * Width of the skeleton
   */
  width?: string | number
  /**
   * Height of the skeleton
   */
  height?: string | number
  /**
   * Whether to show animation
   */
  animate?: boolean
  /**
   * Custom shimmer color
   */
  shimmerColor?: string
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ 
    className, 
    variant,
    shape,
    animation,
    animate = true,
    width,
    height,
    shimmerColor,
    style,
    ...props 
  }, ref) => {
    const shouldAnimate = animate && animation !== 'none'
    
    return (
      <div
        ref={ref}
        className={cn(
          skeletonVariants({ 
            variant, 
            shape, 
            animation: shouldAnimate ? animation : 'none' 
          }), 
          className
        )}
        style={{
          width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
          height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
          ...style,
          ...(shimmerColor && {
            '--shimmer-color': shimmerColor
          } as React.CSSProperties)
        }}
        aria-busy="true"
        aria-live="polite"
        role="status"
        {...props}
      >
        <span className="sr-only">Loading...</span>
      </div>
    )
  }
)

Skeleton.displayName = 'Skeleton'

// Utility function to create multiple skeletons
export const createSkeletons = (count: number, props?: SkeletonProps) => {
  return Array.from({ length: count }, (_, i) => (
    <Skeleton key={i} {...props} />
  ))
}

// Export all variants for easy access
export const skeletonVariantOptions = {
  variants: Object.keys(skeletonVariants.variants.variant),
  shapes: Object.keys(skeletonVariants.variants.shape),
  animations: Object.keys(skeletonVariants.variants.animation)
}