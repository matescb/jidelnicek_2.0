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
    default: 'bg-secondary-100 text-secondary-900 border-border',
    destructive: 'bg-error-50 text-error-900 border-error-200',
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