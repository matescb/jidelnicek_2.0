import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton, type SkeletonProps } from './Skeleton'

export interface SkeletonTextProps extends Omit<SkeletonProps, 'shape' | 'height'> {
  /**
   * Number of lines
   */
  lines?: number
  /**
   * Text variant
   */
  textVariant?: 'paragraph' | 'heading' | 'caption' | 'quote' | 'code'
  /**
   * Heading level (h1-h6)
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
  /**
   * Enable random width variations
   */
  randomWidth?: boolean
  /**
   * Line spacing
   */
  spacing?: 'tight' | 'normal' | 'loose'
  /**
   * Maximum width
   */
  maxWidth?: string | number
  /**
   * Show as centered text
   */
  centered?: boolean
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ 
  className,
  lines = 3,
  textVariant = 'paragraph',
  headingLevel = 2,
  randomWidth = true,
  spacing = 'normal',
  maxWidth,
  centered = false,
  variant,
  animation,
  animate,
  width,
  ...props 
}) => {
  const skeletonProps = { variant, animation, animate }

  const spacingClasses = {
    tight: 'space-y-1',
    normal: 'space-y-2',
    loose: 'space-y-3'
  }

  const getLineHeight = () => {
    switch (textVariant) {
      case 'heading':
        const headingSizes = {
          1: 'h-8',
          2: 'h-7',
          3: 'h-6',
          4: 'h-5',
          5: 'h-4',
          6: 'h-4'
        }
        return headingSizes[headingLevel]
      case 'caption':
        return 'h-3'
      case 'quote':
        return 'h-5'
      case 'code':
        return 'h-4'
      default:
        return 'h-4'
    }
  }

  const getLineWidth = (index: number) => {
    if (width) return width
    if (!randomWidth) return '100%'

    // Generate consistent "random" widths based on index
    const widthOptions = ['100%', '95%', '85%', '75%', '65%', '55%']
    const patterns = [
      [0, 1, 3], // Full, almost full, shorter
      [0, 2, 4], // Full, medium, short
      [1, 0, 3], // Almost full, full, shorter
      [0, 0, 5], // Full, full, very short (last line)
    ]

    if (textVariant === 'heading') {
      return index === 0 ? '60%' : '40%'
    }

    const patternIndex = index % patterns.length
    const pattern = patterns[patternIndex]
    const widthIndex = pattern[index % pattern.length]
    
    // Last line is typically shorter
    if (index === lines - 1 && lines > 1) {
      return widthOptions[Math.min(widthIndex + 2, widthOptions.length - 1)]
    }

    return widthOptions[widthIndex]
  }

  const renderLines = () => {
    if (textVariant === 'code') {
      return (
        <div className="font-mono bg-gray-100 dark:bg-gray-900 p-4 rounded-md space-y-1">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton 
                className="h-4 w-8 text-xs" 
                variant="dark"
                {...skeletonProps}
              />
              <Skeleton 
                className={getLineHeight()} 
                width={getLineWidth(i)}
                {...skeletonProps}
              />
            </div>
          ))}
        </div>
      )
    }

    if (textVariant === 'quote') {
      return (
        <div className="border-l-4 border-gray-300 dark:border-gray-700 pl-4">
          <div className={spacingClasses[spacing]}>
            {Array.from({ length: lines }, (_, i) => (
              <Skeleton 
                key={i} 
                className={cn(getLineHeight(), 'italic')} 
                width={getLineWidth(i)}
                {...skeletonProps}
              />
            ))}
          </div>
          <Skeleton 
            className="h-3 w-32 mt-2" 
            {...skeletonProps}
          />
        </div>
      )
    }

    return Array.from({ length: lines }, (_, i) => (
      <Skeleton 
        key={i} 
        className={getLineHeight()} 
        width={getLineWidth(i)}
        {...skeletonProps}
      />
    ))
  }

  return (
    <div 
      className={cn(
        spacingClasses[spacing],
        centered && 'flex flex-col items-center',
        className
      )}
      style={{ maxWidth: maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : undefined }}
      {...props}
    >
      {renderLines()}
    </div>
  )
}

// Preset text skeleton variants
export const SkeletonParagraph: React.FC<Omit<SkeletonTextProps, 'textVariant'>> = (props) => (
  <SkeletonText textVariant="paragraph" lines={4} {...props} />
)

export const SkeletonHeading: React.FC<
  Omit<SkeletonTextProps, 'textVariant' | 'lines'> & { 
    level?: 1 | 2 | 3 | 4 | 5 | 6 
  }
> = ({ level = 2, ...props }) => (
  <SkeletonText 
    textVariant="heading" 
    headingLevel={level} 
    lines={level <= 2 ? 2 : 1}
    randomWidth={false}
    {...props} 
  />
)

export const SkeletonCaption: React.FC<Omit<SkeletonTextProps, 'textVariant' | 'lines'>> = (props) => (
  <SkeletonText textVariant="caption" lines={1} randomWidth={false} {...props} />
)

export const SkeletonQuote: React.FC<Omit<SkeletonTextProps, 'textVariant'>> = (props) => (
  <SkeletonText textVariant="quote" lines={3} {...props} />
)

export const SkeletonCodeBlock: React.FC<Omit<SkeletonTextProps, 'textVariant'>> = (props) => (
  <SkeletonText textVariant="code" lines={5} {...props} />
)

// Article skeleton combining multiple text elements
export const SkeletonArticle: React.FC<SkeletonTextProps> = (props) => {
  const skeletonProps = { 
    variant: props.variant, 
    animation: props.animation, 
    animate: props.animate 
  }

  return (
    <article className={cn('space-y-6', props.className)}>
      {/* Title */}
      <SkeletonHeading level={1} {...skeletonProps} />
      
      {/* Meta info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Skeleton width={32} height={32} shape="circular" {...skeletonProps} />
          <Skeleton className="h-4 w-24" {...skeletonProps} />
        </div>
        <Skeleton className="h-4 w-20" {...skeletonProps} />
        <Skeleton className="h-4 w-16" {...skeletonProps} />
      </div>

      {/* Featured image */}
      <Skeleton className="w-full h-64 md:h-96" {...skeletonProps} />

      {/* Content */}
      <div className="space-y-4">
        <SkeletonParagraph lines={5} {...skeletonProps} />
        <SkeletonHeading level={2} {...skeletonProps} />
        <SkeletonParagraph lines={4} {...skeletonProps} />
        <SkeletonQuote lines={2} {...skeletonProps} />
        <SkeletonParagraph lines={6} {...skeletonProps} />
      </div>

      {/* Tags */}
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton 
            key={i} 
            className="h-6 rounded-full" 
            width={60 + i * 10}
            {...skeletonProps}
          />
        ))}
      </div>
    </article>
  )
}