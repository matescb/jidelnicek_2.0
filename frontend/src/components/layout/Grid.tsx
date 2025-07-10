import React from 'react'
import clsx from 'clsx'

interface GridProps {
  children: React.ReactNode
  cols?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number }
  gap?: number | string
  className?: string
  as?: React.ElementType
}

/**
 * Responsive grid layout component
 */
export const Grid: React.FC<GridProps> = ({
  children,
  cols = 1,
  gap = 4,
  className,
  as: Component = 'div'
}) => {
  const getColsClasses = () => {
    if (typeof cols === 'number') {
      return `grid-cols-${cols}`
    }
    
    const classes = []
    if (cols.xs) classes.push(`grid-cols-${cols.xs}`)
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`)
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`)
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`)
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`)
    
    return classes.join(' ')
  }

  const gapClass = typeof gap === 'number' ? `gap-${gap}` : gap

  return (
    <Component
      className={clsx(
        'grid',
        getColsClasses(),
        gapClass,
        className
      )}
    >
      {children}
    </Component>
  )
}

interface GridItemProps {
  children: React.ReactNode
  span?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number }
  start?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number }
  className?: string
  as?: React.ElementType
}

/**
 * Grid item component with responsive span control
 */
export const GridItem: React.FC<GridItemProps> = ({
  children,
  span,
  start,
  className,
  as: Component = 'div'
}) => {
  const getSpanClasses = () => {
    if (!span) return ''
    
    if (typeof span === 'number') {
      return `col-span-${span}`
    }
    
    const classes = []
    if (span.xs) classes.push(`col-span-${span.xs}`)
    if (span.sm) classes.push(`sm:col-span-${span.sm}`)
    if (span.md) classes.push(`md:col-span-${span.md}`)
    if (span.lg) classes.push(`lg:col-span-${span.lg}`)
    if (span.xl) classes.push(`xl:col-span-${span.xl}`)
    
    return classes.join(' ')
  }

  const getStartClasses = () => {
    if (!start) return ''
    
    if (typeof start === 'number') {
      return `col-start-${start}`
    }
    
    const classes = []
    if (start.xs) classes.push(`col-start-${start.xs}`)
    if (start.sm) classes.push(`sm:col-start-${start.sm}`)
    if (start.md) classes.push(`md:col-start-${start.md}`)
    if (start.lg) classes.push(`lg:col-start-${start.lg}`)
    if (start.xl) classes.push(`xl:col-start-${start.xl}`)
    
    return classes.join(' ')
  }

  return (
    <Component
      className={clsx(
        getSpanClasses(),
        getStartClasses(),
        className
      )}
    >
      {children}
    </Component>
  )
}