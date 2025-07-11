import React from 'react'
import { motion } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const dotsVariants = cva(
  'inline-flex items-center gap-1',
  {
    variants: {
      size: {
        xs: 'scale-50',
        sm: 'scale-75',
        md: 'scale-100',
        lg: 'scale-125',
        xl: 'scale-150'
      },
      variant: {
        default: '',
        bubble: 'bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2 shadow-sm'
      },
      color: {
        primary: 'text-primary-600 dark:text-primary-500',
        secondary: 'text-gray-600 dark:text-gray-400',
        muted: 'text-gray-400 dark:text-gray-600',
        current: 'text-current'
      }
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
      color: 'secondary'
    }
  }
)

export interface LoadingDotsProps extends VariantProps<typeof dotsVariants> {
  className?: string
  duration?: number
  dotCount?: number
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  size,
  variant,
  color,
  className,
  duration = 1.4,
  dotCount = 3
}) => {
  const dotSize = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
    xl: 'w-3 h-3'
  }[size || 'md']
  
  return (
    <div 
      className={cn(dotsVariants({ size, variant, color }), className)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: dotCount }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(dotSize, 'bg-current rounded-full')}
          animate={{
            y: [0, -8, 0],
            opacity: [0.3, 1, 0.3]
          }}
          transition={{
            duration,
            repeat: Infinity,
            delay: i * (duration / dotCount),
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  )
}

// Chat bubble typing indicator variant
export const TypingIndicator: React.FC<{
  className?: string
  userName?: string
}> = ({ className, userName }) => {
  return (
    <div className={cn('flex items-end gap-2', className)}>
      {userName && (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {userName} is typing
        </span>
      )}
      <LoadingDots 
        variant="bubble" 
        size="sm" 
        color="secondary"
      />
    </div>
  )
}