import React from 'react'
import clsx from 'clsx'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  className,
  children,
  ...props
}) => {
  const variantClasses = {
    default: 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100 border-transparent',
    secondary: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-transparent',
    destructive: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100 border-transparent',
    outline: 'text-gray-950 dark:text-gray-50 border-gray-200 dark:border-gray-800',
  }

  return (
    <div
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}