import React from 'react'
import clsx from 'clsx'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive'
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({
  variant = 'default',
  className,
  children,
  ...props
}, ref) => {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700',
    destructive: 'bg-red-50 text-red-900 dark:bg-red-900/10 dark:text-red-100 border-red-200 dark:border-red-800',
  }

  return (
    <div
      ref={ref}
      role="alert"
      className={clsx(
        'relative w-full rounded-lg border p-4',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

Alert.displayName = 'Alert'

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(({
  className,
  ...props
}, ref) => (
  <p
    ref={ref}
    className={clsx('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
))

AlertDescription.displayName = 'AlertDescription'

interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const AlertTitle = React.forwardRef<HTMLParagraphElement, AlertTitleProps>(({
  className,
  ...props
}, ref) => (
  <h5
    ref={ref}
    className={clsx('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
))

AlertTitle.displayName = 'AlertTitle'