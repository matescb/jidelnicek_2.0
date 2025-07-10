import React from 'react'
import clsx from 'clsx'

interface StackProps {
  children: React.ReactNode
  direction?: 'horizontal' | 'vertical' | { xs?: 'horizontal' | 'vertical'; sm?: 'horizontal' | 'vertical'; md?: 'horizontal' | 'vertical'; lg?: 'horizontal' | 'vertical' }
  spacing?: number | string
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  wrap?: boolean
  className?: string
  as?: React.ElementType
}

/**
 * Flexible stack layout component using flexbox
 */
export const Stack: React.FC<StackProps> = ({
  children,
  direction = 'vertical',
  spacing = 4,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className,
  as: Component = 'div'
}) => {
  const getDirectionClasses = () => {
    if (typeof direction === 'string') {
      return direction === 'horizontal' ? 'flex-row' : 'flex-col'
    }
    
    const classes = ['flex-col'] // Default to vertical
    if (direction.xs) classes.push(direction.xs === 'horizontal' ? 'flex-row' : 'flex-col')
    if (direction.sm) classes.push(direction.sm === 'horizontal' ? 'sm:flex-row' : 'sm:flex-col')
    if (direction.md) classes.push(direction.md === 'horizontal' ? 'md:flex-row' : 'md:flex-col')
    if (direction.lg) classes.push(direction.lg === 'horizontal' ? 'lg:flex-row' : 'lg:flex-col')
    
    return classes.join(' ')
  }

  const getSpacingClasses = () => {
    const isHorizontal = typeof direction === 'string' 
      ? direction === 'horizontal' 
      : false // For responsive direction, we'll handle spacing differently
    
    if (typeof spacing === 'string') return spacing
    
    return isHorizontal ? `space-x-${spacing}` : `space-y-${spacing}`
  }

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline'
  }

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly'
  }

  return (
    <Component
      className={clsx(
        'flex',
        getDirectionClasses(),
        getSpacingClasses(),
        alignClasses[align],
        justifyClasses[justify],
        wrap && 'flex-wrap',
        className
      )}
    >
      {children}
    </Component>
  )
}