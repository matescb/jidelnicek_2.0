import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const progressRingVariants = cva(
  'relative inline-flex items-center justify-center',
  {
    variants: {
      size: {
        xs: 'w-8 h-8',
        sm: 'w-12 h-12',
        md: 'w-16 h-16',
        lg: 'w-24 h-24',
        xl: 'w-32 h-32'
      },
      color: {
        primary: 'text-primary-600 dark:text-primary-500',
        secondary: 'text-gray-600 dark:text-gray-400',
        success: 'text-green-600 dark:text-green-500',
        warning: 'text-yellow-600 dark:text-yellow-500',
        destructive: 'text-red-600 dark:text-red-500'
      }
    },
    defaultVariants: {
      size: 'md',
      color: 'primary'
    }
  }
)

export interface ProgressRingProps extends VariantProps<typeof progressRingVariants> {
  value?: number
  max?: number
  isIndeterminate?: boolean
  showPercentage?: boolean
  showCheckmark?: boolean
  strokeWidth?: number
  className?: string
  label?: string
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value = 0,
  max = 100,
  isIndeterminate = false,
  showPercentage = true,
  showCheckmark = false,
  strokeWidth = 4,
  size,
  color,
  className,
  label
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const isComplete = percentage >= 100
  
  // Calculate dimensions based on size
  const dimensions = {
    xs: 32,
    sm: 48,
    md: 64,
    lg: 96,
    xl: 128
  }[size || 'md']
  
  const radius = (dimensions - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  return (
    <div className={cn(progressRingVariants({ size, color }), className)}>
      <svg
        className="transform -rotate-90"
        width={dimensions}
        height={dimensions}
      >
        {/* Background circle */}
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="opacity-20"
        />
        
        {/* Progress circle */}
        {isIndeterminate ? (
          <motion.circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ) : (
          <motion.circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {isComplete && showCheckmark ? (
            <motion.div
              key="checkmark"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.3, type: "spring" }}
              className="text-current"
            >
              <Check className={cn(
                size === 'xs' && 'h-3 w-3',
                size === 'sm' && 'h-4 w-4',
                size === 'md' && 'h-6 w-6',
                size === 'lg' && 'h-8 w-8',
                size === 'xl' && 'h-12 w-12'
              )} />
            </motion.div>
          ) : (
            showPercentage && !isIndeterminate && (
              <motion.span
                key="percentage"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'font-semibold text-current',
                  size === 'xs' && 'text-xs',
                  size === 'sm' && 'text-sm',
                  size === 'md' && 'text-base',
                  size === 'lg' && 'text-xl',
                  size === 'xl' && 'text-2xl'
                )}
              >
                {Math.round(percentage)}%
              </motion.span>
            )
          )}
        </AnimatePresence>
        
        {label && (
          <span className={cn(
            'text-gray-600 dark:text-gray-400 mt-1',
            size === 'xs' && 'text-xs',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base',
            size === 'xl' && 'text-lg'
          )}>
            {label}
          </span>
        )}
      </div>
    </div>
  )
}