import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton, type SkeletonProps } from './Skeleton'

export interface SkeletonTableProps extends Omit<SkeletonProps, 'shape'> {
  /**
   * Number of rows to display
   */
  rows?: number
  /**
   * Number of columns
   */
  columns?: number
  /**
   * Show table header
   */
  showHeader?: boolean
  /**
   * Column widths (can be percentages or pixel values)
   */
  columnWidths?: (string | number)[]
  /**
   * Show row actions column
   */
  showActions?: boolean
  /**
   * Show checkbox column
   */
  showCheckbox?: boolean
  /**
   * Compact table variant
   */
  compact?: boolean
  /**
   * Cell content variations
   */
  cellVariations?: ('text' | 'number' | 'badge' | 'avatar' | 'date')[]
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ 
  className,
  rows = 5,
  columns = 4,
  showHeader = true,
  columnWidths,
  showActions = false,
  showCheckbox = false,
  compact = false,
  cellVariations,
  variant,
  animation,
  animate,
  ...props 
}) => {
  const skeletonProps = { variant, animation, animate }
  const totalColumns = columns + (showActions ? 1 : 0) + (showCheckbox ? 1 : 0)
  const cellHeight = compact ? 'h-8' : 'h-12'

  const renderCell = (colIndex: number, isHeader = false) => {
    const variation = cellVariations?.[colIndex] || 'text'
    const width = columnWidths?.[colIndex]

    if (isHeader) {
      return (
        <Skeleton 
          className="h-4" 
          width={width || (colIndex === 0 ? '40%' : '60%')}
          {...skeletonProps}
        />
      )
    }

    switch (variation) {
      case 'avatar':
        return (
          <div className="flex items-center gap-2">
            <Skeleton 
              width={32} 
              height={32} 
              shape="circular"
              {...skeletonProps}
            />
            <Skeleton 
              className="h-4 flex-1" 
              width={width || '60%'}
              {...skeletonProps}
            />
          </div>
        )
      case 'badge':
        return (
          <Skeleton 
            className="h-6 rounded-full" 
            width={width || 64}
            {...skeletonProps}
          />
        )
      case 'number':
        return (
          <Skeleton 
            className="h-4" 
            width={width || 48}
            {...skeletonProps}
          />
        )
      case 'date':
        return (
          <Skeleton 
            className="h-4" 
            width={width || 80}
            {...skeletonProps}
          />
        )
      default:
        return (
          <Skeleton 
            className="h-4" 
            width={width || `${60 + Math.random() * 30}%`}
            {...skeletonProps}
          />
        )
    }
  }

  return (
    <div className={cn('w-full overflow-hidden', className)} {...props}>
      <div className="w-full">
        {/* Header */}
        {showHeader && (
          <div className="border-b dark:border-gray-800">
            <div className={cn('flex gap-4 px-4 py-3', cellHeight)}>
              {showCheckbox && (
                <div className="w-8 flex-shrink-0">
                  <Skeleton 
                    width={16} 
                    height={16} 
                    shape="square"
                    {...skeletonProps}
                  />
                </div>
              )}
              {Array.from({ length: columns }, (_, i) => (
                <div key={i} className="flex-1">
                  {renderCell(i, true)}
                </div>
              ))}
              {showActions && (
                <div className="w-24 flex-shrink-0">
                  <Skeleton className="h-4 w-16" {...skeletonProps} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <div 
              key={rowIndex} 
              className={cn(
                'flex gap-4 px-4 border-b dark:border-gray-800',
                cellHeight,
                'items-center'
              )}
            >
              {showCheckbox && (
                <div className="w-8 flex-shrink-0">
                  <Skeleton 
                    width={16} 
                    height={16} 
                    shape="square"
                    {...skeletonProps}
                  />
                </div>
              )}
              {Array.from({ length: columns }, (_, colIndex) => (
                <div key={colIndex} className="flex-1">
                  {renderCell(colIndex)}
                </div>
              ))}
              {showActions && (
                <div className="w-24 flex-shrink-0 flex gap-1 justify-end">
                  <Skeleton 
                    width={28} 
                    height={28} 
                    shape="square"
                    {...skeletonProps}
                  />
                  <Skeleton 
                    width={28} 
                    height={28} 
                    shape="square"
                    {...skeletonProps}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Responsive table skeleton that stacks on mobile
export const SkeletonResponsiveTable: React.FC<SkeletonTableProps> = ({ 
  rows = 3,
  ...props 
}) => {
  const skeletonProps = { 
    variant: props.variant, 
    animation: props.animation, 
    animate: props.animate 
  }

  return (
    <>
      {/* Desktop view */}
      <div className="hidden md:block">
        <SkeletonTable rows={rows} {...props} />
      </div>

      {/* Mobile view - stacked cards */}
      <div className="md:hidden space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="p-4 border rounded-lg dark:border-gray-800 space-y-3">
            <div className="flex justify-between items-start">
              <Skeleton className="h-5 w-32" {...skeletonProps} />
              <Skeleton className="h-6 w-16 rounded-full" {...skeletonProps} />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" {...skeletonProps} />
              <Skeleton className="h-4 w-3/4" {...skeletonProps} />
            </div>
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-4 w-24" {...skeletonProps} />
              <div className="flex gap-2">
                <Skeleton width={32} height={32} shape="square" {...skeletonProps} />
                <Skeleton width={32} height={32} shape="square" {...skeletonProps} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}