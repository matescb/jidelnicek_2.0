import React from 'react'
import { render, screen } from '@testing-library/react'
import { Grid, GridItem } from './index'

describe('Grid Component', () => {
  it('renders children correctly', () => {
    const { container } = render(
      <Grid>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </Grid>
    )
    
    const grid = container.firstChild as HTMLElement
    expect(grid).toBeInTheDocument()
    expect(grid.children).toHaveLength(3)
  })

  it('applies grid styles', () => {
    const { container } = render(
      <Grid columns={3} gap={4}>
        <div>Item</div>
      </Grid>
    )
    
    const grid = container.firstChild as HTMLElement
    expect(grid).toHaveStyle({ display: 'grid' })
    expect(grid).toHaveClass('grid', 'grid-cols-3', 'gap-4')
  })

  it('handles responsive columns', () => {
    const { container } = render(
      <Grid 
        columns={{ base: 1, md: 2, lg: 3 }} 
      >
        <div>Item</div>
      </Grid>
    )
    
    const grid = container.firstChild as HTMLElement
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
  })

  it('supports grid areas', () => {
    const { container } = render(
      <Grid
        areas={['header header', 'sidebar content']}
      >
        <GridItem area="header">Header</GridItem>
        <GridItem area="sidebar">Sidebar</GridItem>
        <GridItem area="content">Content</GridItem>
      </Grid>
    )
    
    const grid = container.firstChild as HTMLElement
    expect(grid).toHaveStyle({
      gridTemplateAreas: '"header header" "sidebar content"'
    })
  })
})

describe('GridItem Component', () => {
  it('renders with span classes', () => {
    const { container } = render(
      <Grid>
        <GridItem colSpan={2}>
          Spanning item
        </GridItem>
      </Grid>
    )
    
    const item = screen.getByText('Spanning item')
    expect(item).toHaveClass('col-span-2')
  })

  it('handles responsive spans', () => {
    const { container } = render(
      <Grid>
        <GridItem 
          colSpan={{ base: 'full', md: 2 }} 
        >
          Responsive item
        </GridItem>
      </Grid>
    )
    
    const item = screen.getByText('Responsive item')
    expect(item).toHaveClass('col-span-full', 'md:col-span-2')
  })

  it('applies grid area', () => {
    const { container } = render(
      <Grid areas={['header']}>
        <GridItem area="header">
          Header
        </GridItem>
      </Grid>
    )
    
    const item = screen.getByText('Header')
    expect(item).toHaveStyle({ gridArea: 'header' })
  })
})