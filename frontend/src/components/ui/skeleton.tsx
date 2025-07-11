import React from 'react'
import { motion } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { skeletonPulse, getAnimation } from '@/utils/animations'

const skeletonVariants = cva(
  'rounded-md relative overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-secondary-200',
        light: 'bg-secondary-100',
        dark: 'bg-secondary-300'
      },
      animation: {
        pulse: 'animate-pulse',
        wave: 'skeleton-wave',
        none: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      animation: 'pulse'
    }
  }
)

export interface SkeletonProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /**
   * Whether to show animation
   */
  animate?: boolean
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  variant,
  animation,
  animate = true,
  ...props 
}) => {
  const shouldAnimate = animate && animation !== 'none'
  
  return (
    <motion.div
      className={cn(
        skeletonVariants({ variant, animation: 'none' }), 
        className
      )}
      initial={{ opacity: 0 }}
      animate={shouldAnimate ? getAnimation(skeletonPulse).animate : { opacity: 1 }}
      transition={{ duration: 0.3 }}
      {...props}
    />
  )
}

// Skeleton variants for common use cases
export const SkeletonText: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return <Skeleton className={cn('h-4 w-full', className)} {...props} />
}

export const SkeletonAvatar: React.FC<SkeletonProps & { size?: 'sm' | 'md' | 'lg' }> = ({ 
  size = 'md',
  className, 
  ...props 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }
  
  return <Skeleton className={cn('rounded-full', sizeClasses[size], className)} {...props} />
}

export const SkeletonCard: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div className={cn('space-y-3', className)}>
      <Skeleton className="h-32 w-full" {...props} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" {...props} />
        <Skeleton className="h-4 w-1/2" {...props} />
      </div>
    </div>
  )
}