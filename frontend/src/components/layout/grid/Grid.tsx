import React, { CSSProperties } from 'react'
import clsx from 'clsx'
import { parseResponsiveValue, ResponsiveValue } from './utils'
import './grid.css'

export interface GridProps {
  children: React.ReactNode
  /** Number of columns or responsive column configuration */
  columns?: ResponsiveValue<number | 'auto-fit' | 'auto-fill'>
  /** Number of rows or responsive row configuration */
  rows?: ResponsiveValue<number | 'auto'>
  /** Gap between grid items */
  gap?: ResponsiveValue<number | string>
  /** Row gap (overrides gap for rows) */
  rowGap?: ResponsiveValue<number | string>
  /** Column gap (overrides gap for columns) */
  columnGap?: ResponsiveValue<number | string>
  /** Minimum column width for auto-fit/auto-fill */
  minColumnWidth?: string
  /** Maximum column width for auto-fit/auto-fill */
  maxColumnWidth?: string
  /** Grid template areas for complex layouts */
  areas?: ResponsiveValue<string[]>
  /** Align items along the row axis */
  alignItems?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch' | 'baseline'>
  /** Justify items along the column axis */
  justifyItems?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch'>
  /** Align content along the row axis */
  alignContent?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'>
  /** Justify content along the column axis */
  justifyContent?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'>
  /** Auto flow direction */
  autoFlow?: ResponsiveValue<'row' | 'column' | 'row dense' | 'column dense'>
  /** Custom CSS classes */
  className?: string
  /** Inline styles */
  style?: CSSProperties
  /** HTML element type */
  as?: React.ElementType
  /** Enable container queries */
  containerQueries?: boolean
  /** Container name for container queries */
  containerName?: string
  /** Container type for container queries */
  containerType?: 'size' | 'inline-size'
}

/**
 * Responsive CSS Grid container component
 * 
 * @example
 * ```tsx
 * // Basic grid with 3 columns
 * <Grid columns={3} gap={4}>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </Grid>
 * 
 * // Responsive columns
 * <Grid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap={{ base: 2, md: 4 }}>
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </Grid>
 * 
 * // Auto-fit layout
 * <Grid columns="auto-fit" minColumnWidth="250px" gap={4}>
 *   {cards.map(card => <Card key={card.id} {...card} />)}
 * </Grid>
 * 
 * // Grid areas layout
 * <Grid
 *   areas={[
 *     'header header header',
 *     'sidebar content content',
 *     'footer footer footer'
 *   ]}
 *   columns="200px 1fr 1fr"
 *   rows="auto 1fr auto"
 *   gap={4}
 * >
 *   <GridItem area="header">Header</GridItem>
 *   <GridItem area="sidebar">Sidebar</GridItem>
 *   <GridItem area="content">Content</GridItem>
 *   <GridItem area="footer">Footer</GridItem>
 * </Grid>
 * ```
 */
export const Grid: React.FC<GridProps> = ({
  children,
  columns = 1,
  rows,
  gap = 4,
  rowGap,
  columnGap,
  minColumnWidth = '200px',
  maxColumnWidth = '1fr',
  areas,
  alignItems = 'stretch',
  justifyItems = 'stretch',
  alignContent,
  justifyContent,
  autoFlow,
  className,
  style,
  as: Component = 'div',
  containerQueries = false,
  containerName,
  containerType = 'inline-size'
}) => {
  const getGridTemplateColumns = () => {
    const cols = parseResponsiveValue(columns)
    
    if (cols === 'auto-fit' || cols === 'auto-fill') {
      return `repeat(${cols}, minmax(${minColumnWidth}, ${maxColumnWidth}))`
    }
    
    if (typeof cols === 'number') {
      return `repeat(${cols}, 1fr)`
    }
    
    return cols
  }

  const getGridTemplateRows = () => {
    if (!rows) return undefined
    
    const rowValue = parseResponsiveValue(rows)
    
    if (rowValue === 'auto') {
      return 'auto'
    }
    
    if (typeof rowValue === 'number') {
      return `repeat(${rowValue}, 1fr)`
    }
    
    return rowValue
  }

  const getGridTemplateAreas = () => {
    if (!areas) return undefined
    
    const areaValue = parseResponsiveValue(areas)
    
    if (Array.isArray(areaValue)) {
      return areaValue.map(row => `"${row}"`).join(' ')
    }
    
    return areaValue
  }

  const getGapValue = (value: ResponsiveValue<number | string> | undefined) => {
    if (!value) return undefined
    
    const gapValue = parseResponsiveValue(value)
    
    if (typeof gapValue === 'number') {
      return `${gapValue * 0.25}rem` // Assuming 1 unit = 0.25rem
    }
    
    return gapValue
  }

  const gridStyles: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: getGridTemplateColumns(),
    gridTemplateRows: getGridTemplateRows(),
    gridTemplateAreas: getGridTemplateAreas(),
    gap: getGapValue(gap),
    rowGap: getGapValue(rowGap),
    columnGap: getGapValue(columnGap),
    alignItems: parseResponsiveValue(alignItems),
    justifyItems: parseResponsiveValue(justifyItems),
    alignContent: alignContent ? parseResponsiveValue(alignContent) : undefined,
    justifyContent: justifyContent ? parseResponsiveValue(justifyContent) : undefined,
    gridAutoFlow: autoFlow ? parseResponsiveValue(autoFlow) : undefined,
    ...style
  }

  if (containerQueries) {
    gridStyles.containerType = containerType
    if (containerName) {
      gridStyles.containerName = containerName
    }
  }

  // Generate responsive class names for Tailwind
  const getResponsiveClasses = () => {
    const classes: string[] = []
    
    // Handle responsive columns with Tailwind classes
    if (typeof columns === 'object' && columns !== null) {
      Object.entries(columns).forEach(([breakpoint, value]) => {
        if (typeof value === 'number') {
          const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
          classes.push(`${prefix}grid-cols-${value}`)
        }
      })
    } else if (typeof columns === 'number') {
      classes.push(`grid-cols-${columns}`)
    }
    
    // Handle responsive gap with Tailwind classes
    if (typeof gap === 'object' && gap !== null) {
      Object.entries(gap).forEach(([breakpoint, value]) => {
        if (typeof value === 'number') {
          const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
          classes.push(`${prefix}gap-${value}`)
        }
      })
    } else if (typeof gap === 'number') {
      classes.push(`gap-${gap}`)
    }
    
    return classes
  }

  return (
    <Component
      className={clsx(
        'grid',
        getResponsiveClasses(),
        className
      )}
      style={gridStyles}
    >
      {children}
    </Component>
  )
}

Grid.displayName = 'Grid'