import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary-100 text-primary-900 border-transparent',
        secondary: 'bg-secondary-100 text-secondary-900 border-transparent',
        destructive: 'bg-error-100 text-error-900 border-transparent',
        outline: 'text-text-primary border-border',
        success: 'bg-success-100 text-success-900 border-transparent',
        warning: 'bg-warning-100 text-warning-900 border-transparent',
        error: 'bg-error-100 text-error-900 border-transparent',
        primary: 'bg-primary-100 text-primary-900 border-transparent',
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