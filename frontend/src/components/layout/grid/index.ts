/**
 * Responsive Grid System
 * 
 * A comprehensive grid system with CSS Grid and Flexbox implementations,
 * responsive controls, and common layout templates.
 */

// Core components
export { Grid } from './Grid'
export type { GridProps } from './Grid'

export { GridItem } from './GridItem'
export type { GridItemProps } from './GridItem'

export { ResponsiveGrid, ResponsiveGridPresets } from './ResponsiveGrid'
export type { ResponsiveGridProps } from './ResponsiveGrid'

export { FlexGrid, FlexItem } from './FlexGrid'
export type { FlexGridProps, FlexItemProps } from './FlexGrid'

// Layout templates
export { GridTemplates } from './GridTemplates'

// Utilities
export {
  parseResponsiveValue,
  generateResponsiveCSS,
  calculateColumns,
  gapToPixels,
  generateGridColumns,
  isResponsiveObject,
  mergeResponsiveValues,
  getMediaQuery,
  getContainerQuery,
  breakpoints
} from './utils'

export type { ResponsiveValue, Breakpoint } from './utils'