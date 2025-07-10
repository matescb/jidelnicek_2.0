import React from 'react'
import { motion } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const progressVariants = cva(
  'relative overflow-hidden rounded-full',
  {
    variants: {
      variant: {
        default: 'bg-gray-200 dark:bg-gray-800',
        light: 'bg-gray-100 dark:bg-gray-900',
        dark: 'bg-gray-300 dark:bg-gray-700'
      },
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
        xl: 'h-4'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

const progressIndicatorVariants = cva(
  'h-full transition-all duration-300 ease-in-out',
  {
    variants: {
      variant: {
        default: 'bg-primary-600 dark:bg-primary-500',
        success: 'bg-green-600 dark:bg-green-500',
        warning: 'bg-yellow-600 dark:bg-yellow-500',
        danger: 'bg-red-600 dark:bg-red-500',
        info: 'bg-blue-600 dark:bg-blue-500'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface ProgressBarProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  /**
   * Current value
   */
  value?: number
  /**
   * Maximum value
   */
  max?: number
  /**
   * Variant for the indicator
   */
  indicatorVariant?: VariantProps<typeof progressIndicatorVariants>['variant']
  /**
   * Additional classes for indicator
   */
  indicatorClassName?: string
  /**
   * Show percentage label
   */
  showLabel?: boolean
  /**
   * Animate on mount
   */
  animate?: boolean
}

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(({
  value = 0,
  max = 100,
  className,
  variant,
  size,
  indicatorVariant,
  indicatorClassName,
  showLabel = false,
  animate = true,
  ...props
}, ref) => {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100)

  return (
    <div className="w-full">
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={`${percentage}% complete`}
        className={cn(progressVariants({ variant, size }), 'w-full', className)}
        {...props}
      >
        <motion.div
          className={cn(
            progressIndicatorVariants({ variant: indicatorVariant }),
            indicatorClassName
          )}
          initial={animate ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>{value}/{max}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
    </div>
  )
})

ProgressBar.displayName = 'ProgressBar'

// Circular Progress Component
export interface ProgressCircleProps {
  /**
   * Current value
   */
  value?: number
  /**
   * Maximum value
   */
  max?: number
  /**
   * Size of the circle
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Stroke width
   */
  strokeWidth?: number
  /**
   * Show percentage in center
   */
  showLabel?: boolean
  /**
   * Color variant
   */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  /**
   * Additional classes
   */
  className?: string
  /**
   * Animate on mount
   */
  animate?: boolean
}

const sizeMap = {
  sm: 40,
  md: 60,
  lg: 80,
  xl: 100
}

const colorMap = {
  default: 'stroke-primary-600 dark:stroke-primary-500',
  success: 'stroke-green-600 dark:stroke-green-500',
  warning: 'stroke-yellow-600 dark:stroke-yellow-500',
  danger: 'stroke-red-600 dark:stroke-red-500',
  info: 'stroke-blue-600 dark:stroke-blue-500'
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  value = 0,
  max = 100,
  size = 'md',
  strokeWidth = 4,
  showLabel = true,
  variant = 'default',
  className,
  animate = true
}) => {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100)
  const sizeValue = sizeMap[size]
  const radius = (sizeValue - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn('relative inline-flex', className)}>
      <svg
        width={sizeValue}
        height={sizeValue}
        className="transform -rotate-90"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={`${percentage}% complete`}
      >
        {/* Background circle */}
        <circle
          cx={sizeValue / 2}
          cy={sizeValue / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-gray-200 dark:stroke-gray-800"
        />
        {/* Progress circle */}
        <motion.circle
          cx={sizeValue / 2}
          cy={sizeValue / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn('fill-none', colorMap[variant])}
          initial={animate ? { strokeDashoffset: circumference } : { strokeDashoffset }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  )
}

// Export the original Progress component for backward compatibility
export const Progress = ProgressBar