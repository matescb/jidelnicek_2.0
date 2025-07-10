import React from 'react'
import clsx from 'clsx'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  indicatorClassName?: string
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({
  value = 0,
  max = 100,
  className,
  indicatorClassName,
  ...props
}, ref) => {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100)

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={clsx(
        'relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800',
        className
      )}
      {...props}
    >
      <div
        className={clsx(
          'h-full transition-all duration-300 ease-in-out bg-primary-600 dark:bg-primary-500',
          indicatorClassName
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
})

Progress.displayName = 'Progress'