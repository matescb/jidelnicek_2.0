import React, { CSSProperties } from 'react'
import clsx from 'clsx'
import { Grid, GridProps } from './Grid'
import { ResponsiveValue } from './utils'

export interface ResponsiveGridProps extends Omit<GridProps, 'columns'> {
  /** Minimum width for each grid item */
  minItemWidth?: string
  /** Maximum width for each grid item */
  maxItemWidth?: string
  /** Maximum number of columns */
  maxColumns?: number
  /** Use auto-fit or auto-fill */
  fillMode?: 'fit' | 'fill'
  /** Enable masonry layout (experimental) */
  masonry?: boolean
  /** Masonry gap for vertical spacing */
  masonryGap?: string
}

/**
 * Auto-responsive grid that automatically adjusts column count based on available space
 * 
 * @example
 * ```tsx
 * // Basic auto-responsive grid
 * <ResponsiveGrid minItemWidth="250px" gap={4}>
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </ResponsiveGrid>
 * 
 * // With maximum columns limit
 * <ResponsiveGrid minItemWidth="200px" maxColumns={4} gap={4}>
 *   {products.map(product => <ProductCard key={product.id} {...product} />)}
 * </ResponsiveGrid>
 * 
 * // Masonry layout
 * <ResponsiveGrid minItemWidth="300px" masonry masonryGap="1rem">
 *   {images.map(image => <ImageCard key={image.id} {...image} />)}
 * </ResponsiveGrid>
 * ```
 */
export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  minItemWidth = '250px',
  maxItemWidth = '1fr',
  maxColumns,
  fillMode = 'fill',
  masonry = false,
  masonryGap = '1rem',
  gap = 4,
  children,
  className,
  style,
  ...gridProps
}) => {
  const autoMode = fillMode === 'fit' ? 'auto-fit' : 'auto-fill'
  
  if (masonry) {
    // Masonry layout using CSS columns (experimental)
    const masonryStyles: CSSProperties = {
      columnWidth: minItemWidth,
      columnGap: typeof gap === 'number' ? `${gap * 0.25}rem` : gap as string,
      ...style
    }
    
    if (maxColumns) {
      masonryStyles.columnCount = maxColumns
    }
    
    return (
      <div
        className={clsx('masonry-grid', className)}
        style={masonryStyles}
      >
        {React.Children.map(children, (child, index) => (
          <div
            key={index}
            className="masonry-item"
            style={{
              breakInside: 'avoid',
              marginBottom: masonryGap
            }}
          >
            {child}
          </div>
        ))}
      </div>
    )
  }
  
  // Regular responsive grid
  const gridTemplateColumns = maxColumns
    ? `repeat(min(${maxColumns}, ${autoMode}), minmax(${minItemWidth}, ${maxItemWidth}))`
    : `repeat(${autoMode}, minmax(${minItemWidth}, ${maxItemWidth}))`
  
  return (
    <Grid
      {...gridProps}
      gap={gap}
      className={className}
      style={{
        gridTemplateColumns,
        ...style
      }}
    >
      {children}
    </Grid>
  )
}

ResponsiveGrid.displayName = 'ResponsiveGrid'

/**
 * Preset responsive grid configurations
 */
export const ResponsiveGridPresets = {
  cards: {
    minItemWidth: '280px',
    maxItemWidth: '1fr',
    gap: 6
  },
  gallery: {
    minItemWidth: '200px',
    maxItemWidth: '1fr',
    gap: 4
  },
  products: {
    minItemWidth: '250px',
    maxItemWidth: '1fr',
    gap: 5,
    maxColumns: 4
  },
  thumbnails: {
    minItemWidth: '120px',
    maxItemWidth: '1fr',
    gap: 3
  },
  features: {
    minItemWidth: '300px',
    maxItemWidth: '1fr',
    gap: 8,
    maxColumns: 3
  }
}

/**
 * Preset responsive grid component with common configurations
 * 
 * @example
 * ```tsx
 * <ResponsiveGrid.Cards>
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </ResponsiveGrid.Cards>
 * ```
 */
ResponsiveGrid.Cards = (props: Omit<ResponsiveGridProps, keyof typeof ResponsiveGridPresets.cards>) => (
  <ResponsiveGrid {...ResponsiveGridPresets.cards} {...props} />
)

ResponsiveGrid.Gallery = (props: Omit<ResponsiveGridProps, keyof typeof ResponsiveGridPresets.gallery>) => (
  <ResponsiveGrid {...ResponsiveGridPresets.gallery} {...props} />
)

ResponsiveGrid.Products = (props: Omit<ResponsiveGridProps, keyof typeof ResponsiveGridPresets.products>) => (
  <ResponsiveGrid {...ResponsiveGridPresets.products} {...props} />
)

ResponsiveGrid.Thumbnails = (props: Omit<ResponsiveGridProps, keyof typeof ResponsiveGridPresets.thumbnails>) => (
  <ResponsiveGrid {...ResponsiveGridPresets.thumbnails} {...props} />
)

ResponsiveGrid.Features = (props: Omit<ResponsiveGridProps, keyof typeof ResponsiveGridPresets.features>) => (
  <ResponsiveGrid {...ResponsiveGridPresets.features} {...props} />
)