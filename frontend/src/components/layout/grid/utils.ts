/**
 * Responsive value type that can be a single value or an object with breakpoint keys
 */
export type ResponsiveValue<T> = T | {
  base?: T
  xs?: T
  sm?: T
  md?: T
  lg?: T
  xl?: T
  '2xl'?: T
}

/**
 * Breakpoint configuration
 */
export const breakpoints = {
  base: 0,
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const

export type Breakpoint = keyof typeof breakpoints

/**
 * Parse responsive value based on current viewport
 * Note: This is a simplified version. In a real app, you'd use a hook to get current breakpoint
 */
export function parseResponsiveValue<T>(value: ResponsiveValue<T>): T | undefined {
  if (value === null || value === undefined) {
    return undefined
  }

  // If it's not an object, return as is
  if (typeof value !== 'object' || Array.isArray(value)) {
    return value as T
  }

  // In a real implementation, this would check the current viewport width
  // For now, we'll return the base value or the first defined value
  const responsiveObj = value as Record<Breakpoint, T>
  
  return responsiveObj.base ?? 
         responsiveObj.xs ?? 
         responsiveObj.sm ?? 
         responsiveObj.md ?? 
         responsiveObj.lg ?? 
         responsiveObj.xl ?? 
         responsiveObj['2xl']
}

/**
 * Generate CSS custom properties for responsive values
 */
export function generateResponsiveCSS<T>(
  propertyName: string,
  value: ResponsiveValue<T>,
  formatter?: (val: T) => string
): Record<string, string> {
  const styles: Record<string, string> = {}

  if (value === null || value === undefined) {
    return styles
  }

  // Single value
  if (typeof value !== 'object' || Array.isArray(value)) {
    const formattedValue = formatter ? formatter(value as T) : String(value)
    styles[propertyName] = formattedValue
    return styles
  }

  // Responsive object
  const responsiveObj = value as Record<Breakpoint, T>
  
  Object.entries(responsiveObj).forEach(([breakpoint, val]) => {
    if (val !== undefined) {
      const formattedValue = formatter ? formatter(val) : String(val)
      
      if (breakpoint === 'base') {
        styles[propertyName] = formattedValue
      } else {
        // Use CSS custom properties for responsive values
        styles[`--${propertyName}-${breakpoint}`] = formattedValue
      }
    }
  })

  return styles
}

/**
 * Calculate column count based on container width and min item width
 */
export function calculateColumns(
  containerWidth: number,
  minItemWidth: number,
  maxColumns?: number,
  gap: number = 0
): number {
  const availableWidth = containerWidth - gap
  const itemWidthWithGap = minItemWidth + gap
  const columns = Math.floor(availableWidth / itemWidthWithGap) || 1
  
  return maxColumns ? Math.min(columns, maxColumns) : columns
}

/**
 * Convert gap value to pixels
 */
export function gapToPixels(gap: number | string): number {
  if (typeof gap === 'number') {
    // Assuming 1 unit = 4px (0.25rem with base 16px)
    return gap * 4
  }
  
  // Parse string values
  if (gap.endsWith('px')) {
    return parseFloat(gap)
  }
  
  if (gap.endsWith('rem')) {
    return parseFloat(gap) * 16
  }
  
  if (gap.endsWith('em')) {
    return parseFloat(gap) * 16
  }
  
  return 0
}

/**
 * Generate grid template columns for responsive values
 */
export function generateGridColumns(
  columns: ResponsiveValue<number | string | 'auto-fit' | 'auto-fill'>,
  minWidth?: string,
  maxWidth?: string
): string {
  const value = parseResponsiveValue(columns)
  
  if (!value) return 'none'
  
  if (value === 'auto-fit' || value === 'auto-fill') {
    return `repeat(${value}, minmax(${minWidth || '0'}, ${maxWidth || '1fr'}))`
  }
  
  if (typeof value === 'number') {
    return `repeat(${value}, 1fr)`
  }
  
  return value
}

/**
 * Check if a value is a responsive object
 */
export function isResponsiveObject<T>(value: ResponsiveValue<T>): value is Record<Breakpoint, T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).some(key => key in breakpoints)
  )
}

/**
 * Merge responsive values with defaults
 */
export function mergeResponsiveValues<T>(
  value: ResponsiveValue<T> | undefined,
  defaultValue: ResponsiveValue<T>
): ResponsiveValue<T> {
  if (!value) return defaultValue
  
  if (!isResponsiveObject(value) || !isResponsiveObject(defaultValue)) {
    return value
  }
  
  return {
    ...defaultValue,
    ...value
  }
}

/**
 * Create media query string for a breakpoint
 */
export function getMediaQuery(breakpoint: Breakpoint): string {
  const width = breakpoints[breakpoint]
  return width > 0 ? `(min-width: ${width}px)` : ''
}

/**
 * Generate container query string
 */
export function getContainerQuery(breakpoint: Breakpoint, containerName?: string): string {
  const width = breakpoints[breakpoint]
  const container = containerName ? `${containerName} ` : ''
  return width > 0 ? `@container ${container}(min-width: ${width}px)` : ''
}