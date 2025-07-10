import React from 'react'
import { motion } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva(
  'animate-spin',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12'
      },
      variant: {
        default: 'text-current',
        primary: 'text-primary-600 dark:text-primary-500',
        secondary: 'text-gray-600 dark:text-gray-400',
        destructive: 'text-red-600 dark:text-red-500',
        success: 'text-green-600 dark:text-green-500',
        warning: 'text-yellow-600 dark:text-yellow-500'
      }
    },
    defaultVariants: {
      size: 'md',
      variant: 'default'
    }
  }
)

export interface LoadingSpinnerProps extends VariantProps<typeof spinnerVariants> {
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Color of the spinner (overrides variant)
   */
  color?: string
  /**
   * ARIA label for accessibility
   */
  label?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size,
  variant,
  className,
  color,
  label = 'Loading'
}) => {
  return (
    <motion.svg
      className={cn(spinnerVariants({ size, variant }), className)}
      style={color ? { color } : undefined}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-label={label}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </motion.svg>
  )
}