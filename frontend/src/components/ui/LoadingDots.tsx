import React from 'react'
import { motion } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const dotsVariants = cva(
  'inline-flex items-center gap-1',
  {
    variants: {
      size: {
        sm: 'gap-0.5',
        md: 'gap-1',
        lg: 'gap-1.5',
        xl: 'gap-2'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
)

const dotVariants = cva(
  'rounded-full',
  {
    variants: {
      size: {
        sm: 'h-1.5 w-1.5',
        md: 'h-2 w-2',
        lg: 'h-2.5 w-2.5',
        xl: 'h-3 w-3'
      },
      variant: {
        default: 'bg-gray-600 dark:bg-gray-400',
        primary: 'bg-primary-600 dark:bg-primary-500',
        secondary: 'bg-gray-500 dark:bg-gray-500',
        success: 'bg-green-600 dark:bg-green-500',
        warning: 'bg-yellow-600 dark:bg-yellow-500',
        danger: 'bg-red-600 dark:bg-red-500'
      }
    },
    defaultVariants: {
      size: 'md',
      variant: 'default'
    }
  }
)

export interface LoadingDotsProps extends VariantProps<typeof dotsVariants> {
  /**
   * Color variant for dots
   */
  variant?: VariantProps<typeof dotVariants>['variant']
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * ARIA label for accessibility
   */
  label?: string
  /**
   * Animation duration in seconds
   */
  duration?: number
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  size,
  variant,
  className,
  label = 'Loading',
  duration = 0.6
}) => {
  const dotAnimation = {
    initial: { opacity: 0.3, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: {
      duration: duration,
      repeat: Infinity,
      repeatType: 'reverse' as const,
      ease: 'easeInOut'
    }
  }

  return (
    <div 
      className={cn(dotsVariants({ size }), className)}
      role="status"
      aria-label={label}
    >
      <motion.span
        className={cn(dotVariants({ size, variant }))}
        {...dotAnimation}
        transition={{ ...dotAnimation.transition, delay: 0 }}
      />
      <motion.span
        className={cn(dotVariants({ size, variant }))}
        {...dotAnimation}
        transition={{ ...dotAnimation.transition, delay: duration / 3 }}
      />
      <motion.span
        className={cn(dotVariants({ size, variant }))}
        {...dotAnimation}
        transition={{ ...dotAnimation.transition, delay: (duration / 3) * 2 }}
      />
    </div>
  )
}

// Inline Loading Dots for text
export const InlineLoadingDots: React.FC<LoadingDotsProps> = (props) => {
  return (
    <span className="inline-flex items-center">
      <span className="mr-1">Loading</span>
      <LoadingDots {...props} size="sm" />
    </span>
  )
}