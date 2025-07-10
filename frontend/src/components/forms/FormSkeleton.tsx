/**
 * Loading skeleton for forms
 * Shows placeholder UI while form data is loading
 */

import React from 'react'
import clsx from 'clsx'

export interface SkeletonFieldConfig {
  /**
   * Field type for appropriate skeleton
   */
  type?: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'toggle'
  /**
   * Field label
   */
  label?: boolean
  /**
   * Show help text skeleton
   */
  helpText?: boolean
  /**
   * Width variant
   */
  width?: 'full' | 'half' | 'third' | 'quarter'
}

export interface FormSkeletonProps {
  /**
   * Number of fields to show
   */
  fields?: number
  /**
   * Field configurations
   */
  fieldConfigs?: SkeletonFieldConfig[]
  /**
   * Show form title
   */
  showTitle?: boolean
  /**
   * Show form description
   */
  showDescription?: boolean
  /**
   * Show submit button
   */
  showSubmitButton?: boolean
  /**
   * Submit button text
   */
  submitButtonText?: string
  /**
   * Animate skeleton
   */
  animate?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Layout variant
   */
  layout?: 'vertical' | 'horizontal' | 'grid'
  /**
   * Grid columns (for grid layout)
   */
  gridCols?: 1 | 2 | 3 | 4
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  fields = 3,
  fieldConfigs,
  showTitle = true,
  showDescription = false,
  showSubmitButton = true,
  submitButtonText = 'Submit',
  animate = true,
  className,
  layout = 'vertical',
  gridCols = 2,
}) => {
  const configs = fieldConfigs || Array.from({ length: fields }, () => ({ type: 'text' as const }))

  const skeletonClass = clsx(
    'bg-gray-200 dark:bg-gray-700 rounded',
    animate && 'animate-pulse'
  )

  const widthClasses = {
    full: 'w-full',
    half: 'w-1/2',
    third: 'w-1/3',
    quarter: 'w-1/4',
  }

  const renderFieldSkeleton = (config: SkeletonFieldConfig, index: number) => {
    const fieldWidth = widthClasses[config.width || 'full']

    return (
      <div key={index} className={clsx(layout === 'horizontal' && 'flex items-center space-x-4')}>
        {/* Label */}
        {config.label !== false && (
          <div className={clsx(layout === 'horizontal' ? 'w-1/3' : 'mb-2')}>
            <div className={clsx(skeletonClass, 'h-4 w-24')} />
          </div>
        )}

        {/* Field */}
        <div className={clsx(layout === 'horizontal' ? 'flex-1' : fieldWidth)}>
          {config.type === 'textarea' ? (
            <div className={clsx(skeletonClass, 'h-24 w-full')} />
          ) : config.type === 'select' ? (
            <div className={clsx(skeletonClass, 'h-10 w-full rounded-md')} />
          ) : config.type === 'checkbox' || config.type === 'radio' ? (
            <div className="flex items-center space-x-2">
              <div className={clsx(skeletonClass, 'h-4 w-4')} />
              <div className={clsx(skeletonClass, 'h-4 w-32')} />
            </div>
          ) : config.type === 'toggle' ? (
            <div className="flex items-center space-x-3">
              <div className={clsx(skeletonClass, 'h-6 w-11 rounded-full')} />
              <div className={clsx(skeletonClass, 'h-4 w-32')} />
            </div>
          ) : (
            <div className={clsx(skeletonClass, 'h-10 w-full')} />
          )}

          {/* Help text */}
          {config.helpText && (
            <div className={clsx(skeletonClass, 'h-3 w-3/4 mt-1')} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('space-y-6', className)} aria-busy="true" aria-label="Loading form">
      {/* Title */}
      {showTitle && (
        <div>
          <div className={clsx(skeletonClass, 'h-8 w-48')} />
          {showDescription && (
            <div className={clsx(skeletonClass, 'h-4 w-96 mt-2')} />
          )}
        </div>
      )}

      {/* Fields */}
      <div
        className={clsx(
          layout === 'grid'
            ? `grid gap-6 grid-cols-1 sm:grid-cols-${gridCols}`
            : 'space-y-4'
        )}
      >
        {configs.map((config, index) => renderFieldSkeleton(config, index))}
      </div>

      {/* Submit button */}
      {showSubmitButton && (
        <div className="flex justify-end">
          <div className={clsx(skeletonClass, 'h-10 w-32 rounded-md')} />
        </div>
      )}
    </div>
  )
}

/**
 * Skeleton for individual form field
 */
export interface FieldSkeletonProps {
  /**
   * Show label
   */
  showLabel?: boolean
  /**
   * Label width
   */
  labelWidth?: string
  /**
   * Field type
   */
  type?: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'toggle'
  /**
   * Show help text
   */
  showHelpText?: boolean
  /**
   * Show error skeleton
   */
  showError?: boolean
  /**
   * Animate skeleton
   */
  animate?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
}

export const FieldSkeleton: React.FC<FieldSkeletonProps> = ({
  showLabel = true,
  labelWidth = 'w-24',
  type = 'text',
  showHelpText = false,
  showError = false,
  animate = true,
  className,
}) => {
  const skeletonClass = clsx(
    'bg-gray-200 dark:bg-gray-700 rounded',
    animate && 'animate-pulse'
  )

  return (
    <div className={className}>
      {showLabel && (
        <div className={clsx(skeletonClass, 'h-4', labelWidth, 'mb-2')} />
      )}

      {type === 'textarea' ? (
        <div className={clsx(skeletonClass, 'h-24 w-full')} />
      ) : type === 'select' ? (
        <div className={clsx(skeletonClass, 'h-10 w-full rounded-md')} />
      ) : type === 'checkbox' || type === 'radio' ? (
        <div className="flex items-center space-x-2">
          <div className={clsx(skeletonClass, 'h-4 w-4')} />
          <div className={clsx(skeletonClass, 'h-4 w-32')} />
        </div>
      ) : type === 'toggle' ? (
        <div className="flex items-center space-x-3">
          <div className={clsx(skeletonClass, 'h-6 w-11 rounded-full')} />
          <div className={clsx(skeletonClass, 'h-4 w-32')} />
        </div>
      ) : (
        <div className={clsx(skeletonClass, 'h-10 w-full')} />
      )}

      {showHelpText && (
        <div className={clsx(skeletonClass, 'h-3 w-3/4 mt-1')} />
      )}

      {showError && (
        <div className={clsx(skeletonClass, 'h-4 w-1/2 mt-1')} />
      )}
    </div>
  )
}

/**
 * Button skeleton
 */
export interface ButtonSkeletonProps {
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Full width
   */
  fullWidth?: boolean
  /**
   * Animate skeleton
   */
  animate?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
}

export const ButtonSkeleton: React.FC<ButtonSkeletonProps> = ({
  size = 'md',
  fullWidth = false,
  animate = true,
  className,
}) => {
  const skeletonClass = clsx(
    'bg-gray-200 dark:bg-gray-700 rounded-md',
    animate && 'animate-pulse'
  )

  const sizeClasses = {
    sm: 'h-8 w-20',
    md: 'h-10 w-32',
    lg: 'h-12 w-40',
  }

  return (
    <div
      className={clsx(
        skeletonClass,
        !fullWidth && sizeClasses[size],
        fullWidth && 'w-full h-10',
        className
      )}
    />
  )
}

/**
 * Card skeleton for form sections
 */
export interface CardSkeletonProps {
  /**
   * Show header
   */
  showHeader?: boolean
  /**
   * Number of content lines
   */
  contentLines?: number
  /**
   * Show footer
   */
  showFooter?: boolean
  /**
   * Animate skeleton
   */
  animate?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  showHeader = true,
  contentLines = 3,
  showFooter = false,
  animate = true,
  className,
}) => {
  const skeletonClass = clsx(
    'bg-gray-200 dark:bg-gray-700 rounded',
    animate && 'animate-pulse'
  )

  return (
    <div className={clsx('border border-gray-200 dark:border-gray-700 rounded-lg p-6', className)}>
      {showHeader && (
        <div className="mb-4">
          <div className={clsx(skeletonClass, 'h-6 w-48')} />
          <div className={clsx(skeletonClass, 'h-4 w-96 mt-2')} />
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: contentLines }, (_, i) => (
          <div key={i} className={clsx(skeletonClass, 'h-4', i % 2 === 0 ? 'w-full' : 'w-4/5')} />
        ))}
      </div>

      {showFooter && (
        <div className="mt-6 flex justify-end space-x-3">
          <div className={clsx(skeletonClass, 'h-10 w-24 rounded-md')} />
          <div className={clsx(skeletonClass, 'h-10 w-32 rounded-md')} />
        </div>
      )}
    </div>
  )
}

/**
 * Loading overlay for existing forms
 */
export interface FormLoadingOverlayProps {
  /**
   * Show overlay
   */
  show: boolean
  /**
   * Loading message
   */
  message?: string
  /**
   * Show spinner
   */
  showSpinner?: boolean
  /**
   * Blur background
   */
  blur?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
}

export const FormLoadingOverlay: React.FC<FormLoadingOverlayProps> = ({
  show,
  message,
  showSpinner = true,
  blur = true,
  className,
}) => {
  if (!show) return null

  return (
    <div
      className={clsx(
        'absolute inset-0 flex items-center justify-center z-10',
        blur && 'backdrop-blur-sm',
        'bg-white/50 dark:bg-gray-900/50',
        className
      )}
    >
      <div className="text-center">
        {showSpinner && (
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        )}
        {message && (
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}