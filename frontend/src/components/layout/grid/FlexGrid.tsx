import React, { CSSProperties } from 'react'
import clsx from 'clsx'
import { parseResponsiveValue, ResponsiveValue } from './utils'

export interface FlexGridProps {
  children: React.ReactNode
  /** Direction of the flex container */
  direction?: ResponsiveValue<'row' | 'column' | 'row-reverse' | 'column-reverse'>
  /** Wrap behavior */
  wrap?: ResponsiveValue<'wrap' | 'nowrap' | 'wrap-reverse'>
  /** Gap between items (uses margin for older browser support) */
  gap?: ResponsiveValue<number | string>
  /** Row gap (overrides gap for rows) */
  rowGap?: ResponsiveValue<number | string>
  /** Column gap (overrides gap for columns) */
  columnGap?: ResponsiveValue<number | string>
  /** Align items along the cross axis */
  alignItems?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch' | 'baseline'>
  /** Justify content along the main axis */
  justifyContent?: ResponsiveValue<'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'>
  /** Align content when wrapped */
  alignContent?: ResponsiveValue<'start' | 'center' | 'end' | 'between' | 'around' | 'evenly' | 'stretch'>
  /** Responsive columns using flex-basis */
  columns?: ResponsiveValue<number>
  /** Minimum width for flex items when using columns */
  minItemWidth?: string
  /** Custom CSS classes */
  className?: string
  /** Inline styles */
  style?: CSSProperties
  /** HTML element type */
  as?: React.ElementType
  /** Use legacy gap polyfill for older browsers */
  legacyGap?: boolean
}

/**
 * Flexbox-based grid with responsive controls and gap polyfill
 * 
 * @example
 * ```tsx
 * // Basic flex grid
 * <FlexGrid wrap="wrap" gap={4}>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </FlexGrid>
 * 
 * // Responsive columns with flex
 * <FlexGrid columns={{ base: 1, sm: 2, md: 3 }} gap={4}>
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </FlexGrid>
 * 
 * // Centered layout
 * <FlexGrid
 *   direction="column"
 *   alignItems="center"
 *   justifyContent="center"
 *   gap={6}
 * >
 *   <Logo />
 *   <Title />
 *   <Description />
 * </FlexGrid>
 * ```
 */
export const FlexGrid: React.FC<FlexGridProps> = ({
  children,
  direction = 'row',
  wrap = 'wrap',
  gap = 0,
  rowGap,
  columnGap,
  alignItems = 'stretch',
  justifyContent = 'start',
  alignContent,
  columns,
  minItemWidth = '200px',
  className,
  style,
  as: Component = 'div',
  legacyGap = false
}) => {
  const getGapValue = (value: ResponsiveValue<number | string> | undefined) => {
    if (!value) return '0'
    
    const gapValue = parseResponsiveValue(value)
    
    if (typeof gapValue === 'number') {
      return `${gapValue * 0.25}rem`
    }
    
    return gapValue
  }

  const getFlexBasis = () => {
    if (!columns) return undefined
    
    const cols = parseResponsiveValue(columns)
    
    if (typeof cols === 'number' && cols > 0) {
      const gapAdjustment = legacyGap ? getGapValue(gap) : '0px'
      return `calc((100% - ${gapAdjustment} * ${cols - 1}) / ${cols})`
    }
    
    return undefined
  }

  const flexStyles: CSSProperties = {
    display: 'flex',
    flexDirection: parseResponsiveValue(direction),
    flexWrap: parseResponsiveValue(wrap),
    alignItems: parseResponsiveValue(alignItems),
    justifyContent: justifyContent === 'between' ? 'space-between' :
                    justifyContent === 'around' ? 'space-around' :
                    justifyContent === 'evenly' ? 'space-evenly' :
                    parseResponsiveValue(justifyContent),
    alignContent: alignContent ? (
      alignContent === 'between' ? 'space-between' :
      alignContent === 'around' ? 'space-around' :
      alignContent === 'evenly' ? 'space-evenly' :
      parseResponsiveValue(alignContent)
    ) : undefined,
    ...style
  }

  // Modern gap support
  if (!legacyGap) {
    flexStyles.gap = getGapValue(gap)
    if (rowGap) flexStyles.rowGap = getGapValue(rowGap)
    if (columnGap) flexStyles.columnGap = getGapValue(columnGap)
  }

  // Generate responsive class names for Tailwind
  const getResponsiveClasses = () => {
    const classes: string[] = ['flex']
    
    // Direction classes
    if (typeof direction === 'object' && direction !== null) {
      Object.entries(direction).forEach(([breakpoint, value]) => {
        const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
        classes.push(`${prefix}flex-${value}`)
      })
    } else {
      classes.push(`flex-${direction}`)
    }
    
    // Wrap classes
    if (typeof wrap === 'object' && wrap !== null) {
      Object.entries(wrap).forEach(([breakpoint, value]) => {
        const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
        classes.push(`${prefix}flex-${value}`)
      })
    } else {
      classes.push(`flex-${wrap}`)
    }
    
    // Gap classes (if not using legacy)
    if (!legacyGap && typeof gap === 'object' && gap !== null) {
      Object.entries(gap).forEach(([breakpoint, value]) => {
        if (typeof value === 'number') {
          const prefix = breakpoint === 'base' ? '' : `${breakpoint}:`
          classes.push(`${prefix}gap-${value}`)
        }
      })
    } else if (!legacyGap && typeof gap === 'number') {
      classes.push(`gap-${gap}`)
    }
    
    return classes
  }

  const flexBasis = getFlexBasis()

  // Legacy gap polyfill using margins
  if (legacyGap) {
    const gapSize = getGapValue(gap)
    const isRow = parseResponsiveValue(direction) === 'row' || parseResponsiveValue(direction) === 'row-reverse'
    
    return (
      <Component
        className={clsx(getResponsiveClasses(), className)}
        style={flexStyles}
      >
        {React.Children.map(children, (child, index) => {
          const isLast = index === React.Children.count(children) - 1
          const marginStyle: CSSProperties = {}
          
          if (!isLast) {
            if (isRow) {
              marginStyle.marginRight = gapSize
            } else {
              marginStyle.marginBottom = gapSize
            }
          }
          
          if (columns && flexBasis) {
            marginStyle.flexBasis = flexBasis
            marginStyle.minWidth = minItemWidth
            marginStyle.flexGrow = 0
            marginStyle.flexShrink = 0
          }
          
          return (
            <div style={marginStyle}>
              {child}
            </div>
          )
        })}
      </Component>
    )
  }

  // Modern implementation
  return (
    <Component
      className={clsx(getResponsiveClasses(), className)}
      style={flexStyles}
    >
      {columns ? React.Children.map(children, (child) => (
        <div
          style={{
            flexBasis: flexBasis,
            minWidth: minItemWidth,
            flexGrow: 0,
            flexShrink: 0
          }}
        >
          {child}
        </div>
      )) : children}
    </Component>
  )
}

FlexGrid.displayName = 'FlexGrid'

/**
 * Flex item component for use within FlexGrid
 */
export interface FlexItemProps {
  children: React.ReactNode
  /** Flex grow factor */
  grow?: ResponsiveValue<number>
  /** Flex shrink factor */
  shrink?: ResponsiveValue<number>
  /** Flex basis */
  basis?: ResponsiveValue<string | number>
  /** Align self */
  alignSelf?: ResponsiveValue<'auto' | 'start' | 'center' | 'end' | 'stretch' | 'baseline'>
  /** Order */
  order?: ResponsiveValue<number>
  /** Custom CSS classes */
  className?: string
  /** Inline styles */
  style?: CSSProperties
  /** HTML element type */
  as?: React.ElementType
}

export const FlexItem: React.FC<FlexItemProps> = ({
  children,
  grow = 0,
  shrink = 1,
  basis = 'auto',
  alignSelf = 'auto',
  order,
  className,
  style,
  as: Component = 'div'
}) => {
  const flexItemStyles: CSSProperties = {
    flexGrow: parseResponsiveValue(grow),
    flexShrink: parseResponsiveValue(shrink),
    flexBasis: parseResponsiveValue(basis),
    alignSelf: parseResponsiveValue(alignSelf),
    order: order ? parseResponsiveValue(order) : undefined,
    ...style
  }

  return (
    <Component
      className={className}
      style={flexItemStyles}
    >
      {children}
    </Component>
  )
}

FlexItem.displayName = 'FlexItem'