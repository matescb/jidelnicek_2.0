import React, { CSSProperties } from 'react'
import clsx from 'clsx'
import { parseResponsiveValue, ResponsiveValue } from './utils'

export interface GridItemProps {
  children: React.ReactNode
  /** Number of columns to span */
  colSpan?: ResponsiveValue<number | 'full'>
  /** Number of rows to span */
  rowSpan?: ResponsiveValue<number | 'full'>
  /** Starting column position */
  colStart?: ResponsiveValue<number | 'auto'>
  /** Ending column position */
  colEnd?: ResponsiveValue<number | 'auto'>
  /** Starting row position */
  rowStart?: ResponsiveValue<number | 'auto'>
  /** Ending row position */
  rowEnd?: ResponsiveValue<number | 'auto'>
  /** Grid area name */
  area?: string
  /** Order in the grid */
  order?: ResponsiveValue<number>
  /** Align self along the row axis */
  alignSelf?: ResponsiveValue<'auto' | 'start' | 'center' | 'end' | 'stretch' | 'baseline'>
  /** Justify self along the column axis */
  justifySelf?: ResponsiveValue<'auto' | 'start' | 'center' | 'end' | 'stretch'>
  /** Custom CSS classes */
  className?: string
  /** Inline styles */
  style?: CSSProperties
  /** HTML element type */
  as?: React.ElementType
}

/**
 * Grid item component with responsive positioning and spanning
 * 
 * @example
 * ```tsx
 * // Basic span
 * <GridItem colSpan={2}>Wide item</GridItem>
 * 
 * // Responsive span
 * <GridItem colSpan={{ base: 'full', md: 2, lg: 3 }}>
 *   Responsive item
 * </GridItem>
 * 
 * // Positioned item
 * <GridItem colStart={2} colEnd={4} rowStart={1} rowEnd={3}>
 *   Positioned item
 * </GridItem>
 * 
 * // Named grid area
 * <GridItem area="header">Header content</GridItem>
 * 
 * // Self alignment
 * <GridItem alignSelf="center" justifySelf="end">
 *   Aligned item
 * </GridItem>
 * ```
 */
export const GridItem: React.FC<GridItemProps> = ({
  children,
  colSpan,
  rowSpan,
  colStart,
  colEnd,
  rowStart,
  rowEnd,
  area,
  order,
  alignSelf = 'auto',
  justifySelf = 'auto',
  className,
  style,
  as: Component = 'div'
}) => {
  const getSpanValue = (span: ResponsiveValue<number | 'full'> | undefined, type: 'col' | 'row') => {
    if (!span) return undefined
    
    const spanValue = parseResponsiveValue(span)
    
    if (spanValue === 'full') {
      return type === 'col' ? '1 / -1' : undefined
    }
    
    if (typeof spanValue === 'number') {
      return `span ${spanValue} / span ${spanValue}`
    }
    
    return spanValue
  }

  const getPositionValue = (value: ResponsiveValue<number | 'auto'> | undefined) => {
    if (!value) return undefined
    
    const posValue = parseResponsiveValue(value)
    
    if (posValue === 'auto') {
      return 'auto'
    }
    
    return posValue
  }

  const gridItemStyles: CSSProperties = {
    gridColumn: colSpan ? getSpanValue(colSpan, 'col') : undefined,
    gridRow: rowSpan ? getSpanValue(rowSpan, 'row') : undefined,
    gridColumnStart: getPositionValue(colStart),
    gridColumnEnd: getPositionValue(colEnd),
    gridRowStart: getPositionValue(rowStart),
    gridRowEnd: getPositionValue(rowEnd),
    gridArea: area,
    order: order ? parseResponsiveValue(order) : undefined,
    alignSelf: parseResponsiveValue(alignSelf),
    justifySelf: parseResponsiveValue(justifySelf),
    ...style
  }

  // Generate responsive class names for Tailwind
  const getResponsiveClasses = () => {
    const classes: string[] = []
    
    // Handle responsive column span
    if (typeof colSpan === 'object' && colSpan !== null) {
      Object.entries(colSpan).forEach(([breakpoint, value]) => {
        const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
        if (value === 'full') {
          classes.push(`${prefix}col-span-full`)
        } else if (typeof value === 'number') {
          classes.push(`${prefix}col-span-${value}`)
        }
      })
    } else if (colSpan === 'full') {
      classes.push('col-span-full')
    } else if (typeof colSpan === 'number') {
      classes.push(`col-span-${colSpan}`)
    }
    
    // Handle responsive row span
    if (typeof rowSpan === 'object' && rowSpan !== null) {
      Object.entries(rowSpan).forEach(([breakpoint, value]) => {
        const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
        if (value === 'full') {
          classes.push(`${prefix}row-span-full`)
        } else if (typeof value === 'number') {
          classes.push(`${prefix}row-span-${value}`)
        }
      })
    } else if (rowSpan === 'full') {
      classes.push('row-span-full')
    } else if (typeof rowSpan === 'number') {
      classes.push(`row-span-${rowSpan}`)
    }
    
    // Handle responsive column start
    if (typeof colStart === 'object' && colStart !== null) {
      Object.entries(colStart).forEach(([breakpoint, value]) => {
        const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
        if (value === 'auto') {
          classes.push(`${prefix}col-start-auto`)
        } else if (typeof value === 'number') {
          classes.push(`${prefix}col-start-${value}`)
        }
      })
    } else if (colStart === 'auto') {
      classes.push('col-start-auto')
    } else if (typeof colStart === 'number') {
      classes.push(`col-start-${colStart}`)
    }
    
    // Handle responsive order
    if (typeof order === 'object' && order !== null) {
      Object.entries(order).forEach(([breakpoint, value]) => {
        const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
        if (typeof value === 'number') {
          classes.push(`${prefix}order-${value}`)
        }
      })
    } else if (typeof order === 'number') {
      classes.push(`order-${order}`)
    }
    
    return classes
  }

  return (
    <Component
      className={clsx(
        getResponsiveClasses(),
        className
      )}
      style={gridItemStyles}
    >
      {children}
    </Component>
  )
}

GridItem.displayName = 'GridItem'