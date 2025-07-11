import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton, type SkeletonProps } from './Skeleton'

export interface SkeletonFormProps extends Omit<SkeletonProps, 'shape'> {
  /**
   * Form layout variant
   */
  layout?: 'vertical' | 'horizontal' | 'inline' | 'grid'
  /**
   * Number of form fields
   */
  fields?: number
  /**
   * Show form title
   */
  showTitle?: boolean
  /**
   * Show field labels
   */
  showLabels?: boolean
  /**
   * Show help text
   */
  showHelpText?: boolean
  /**
   * Show submit/cancel buttons
   */
  showActions?: boolean
  /**
   * Field types to simulate
   */
  fieldTypes?: ('text' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'switch' | 'file')[]
  /**
   * Grid columns (for grid layout)
   */
  gridCols?: number
}

export const SkeletonForm: React.FC<SkeletonFormProps> = ({ 
  className,
  layout = 'vertical',
  fields = 4,
  showTitle = true,
  showLabels = true,
  showHelpText = false,
  showActions = true,
  fieldTypes,
  gridCols = 2,
  variant,
  animation,
  animate,
  ...props 
}) => {
  const skeletonProps = { variant, animation, animate }

  const renderField = (index: number) => {
    const fieldType = fieldTypes?.[index] || 'text'

    const renderInput = () => {
      switch (fieldType) {
        case 'textarea':
          return <Skeleton className="h-24 w-full" {...skeletonProps} />
        
        case 'select':
          return (
            <div className="relative">
              <Skeleton className="h-10 w-full" {...skeletonProps} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Skeleton width={16} height={16} {...skeletonProps} />
              </div>
            </div>
          )
        
        case 'checkbox':
        case 'radio':
          return (
            <div className="flex items-center gap-2">
              <Skeleton 
                width={16} 
                height={16} 
                shape={fieldType === 'radio' ? 'circular' : 'square'}
                {...skeletonProps}
              />
              <Skeleton className="h-4 w-32" {...skeletonProps} />
            </div>
          )
        
        case 'switch':
          return (
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" {...skeletonProps} />
              <Skeleton className="h-6 w-11 rounded-full" {...skeletonProps} />
            </div>
          )
        
        case 'file':
          return (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6">
              <div className="flex flex-col items-center gap-2">
                <Skeleton width={48} height={48} shape="square" {...skeletonProps} />
                <Skeleton className="h-4 w-32" {...skeletonProps} />
                <Skeleton className="h-3 w-48" {...skeletonProps} />
              </div>
            </div>
          )
        
        default: // text
          return <Skeleton className="h-10 w-full" {...skeletonProps} />
      }
    }

    if (layout === 'horizontal') {
      return (
        <div key={index} className="grid grid-cols-3 gap-4 items-center">
          {showLabels && <Skeleton className="h-4 w-24" {...skeletonProps} />}
          <div className={cn('col-span-2', !showLabels && 'col-span-3')}>
            {renderInput()}
            {showHelpText && <Skeleton className="h-3 w-48 mt-1" {...skeletonProps} />}
          </div>
        </div>
      )
    }

    if (layout === 'inline') {
      return (
        <div key={index} className="flex items-center gap-2">
          {showLabels && <Skeleton className="h-4 w-16" {...skeletonProps} />}
          <div className="flex-1">{renderInput()}</div>
        </div>
      )
    }

    // Vertical (default) and grid layouts
    return (
      <div key={index} className="space-y-2">
        {showLabels && <Skeleton className="h-4 w-24" {...skeletonProps} />}
        {renderInput()}
        {showHelpText && <Skeleton className="h-3 w-48 mt-1" {...skeletonProps} />}
      </div>
    )
  }

  const formFields = Array.from({ length: fields }, (_, i) => renderField(i))

  return (
    <div className={cn('w-full space-y-6', className)} {...props}>
      {showTitle && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" {...skeletonProps} />
          <Skeleton className="h-4 w-full max-w-md" {...skeletonProps} />
        </div>
      )}

      <div className={cn(
        layout === 'grid' 
          ? `grid gap-6 ${gridCols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`
          : 'space-y-4'
      )}>
        {formFields}
      </div>

      {showActions && (
        <div className="flex gap-3 pt-4">
          <Skeleton className="h-10 w-24" {...skeletonProps} />
          <Skeleton className="h-10 w-24" variant="light" {...skeletonProps} />
        </div>
      )}
    </div>
  )
}

// Preset form skeleton variants
export const SkeletonLoginForm: React.FC<Omit<SkeletonFormProps, 'fields' | 'fieldTypes'>> = (props) => (
  <SkeletonForm
    {...props}
    fields={2}
    fieldTypes={['text', 'text']}
    showTitle
    showLabels
    showActions
  />
)

export const SkeletonContactForm: React.FC<Omit<SkeletonFormProps, 'fields' | 'fieldTypes'>> = (props) => (
  <SkeletonForm
    {...props}
    fields={4}
    fieldTypes={['text', 'text', 'text', 'textarea']}
    showTitle
    showLabels
    showHelpText
    showActions
  />
)

export const SkeletonSettingsForm: React.FC<Omit<SkeletonFormProps, 'fields' | 'fieldTypes'>> = (props) => (
  <SkeletonForm
    {...props}
    layout="vertical"
    fields={5}
    fieldTypes={['switch', 'switch', 'select', 'radio', 'switch']}
    showTitle={false}
    showLabels
    showActions
  />
)

// Search form skeleton
export const SkeletonSearchForm: React.FC<SkeletonFormProps> = (props) => {
  const skeletonProps = { 
    variant: props.variant, 
    animation: props.animation, 
    animate: props.animate 
  }

  return (
    <div className={cn('w-full', props.className)}>
      <div className="relative">
        <Skeleton className="h-12 w-full pl-12" {...skeletonProps} />
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Skeleton width={20} height={20} {...skeletonProps} />
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Skeleton className="h-8 w-20" {...skeletonProps} />
        </div>
      </div>
    </div>
  )
}