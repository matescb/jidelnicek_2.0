import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100 border-transparent',
        secondary: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-transparent',
        destructive: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100 border-transparent',
        outline: 'text-gray-950 dark:text-gray-50 border-gray-200 dark:border-gray-800',
        success: 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100 border-transparent',
        warning: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100 border-transparent',
        error: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100 border-transparent',
        primary: 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100 border-transparent',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  size,
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </div>
  )
}