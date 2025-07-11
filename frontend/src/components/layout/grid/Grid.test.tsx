import React from 'react'
import { render, screen } from '@testing-library/react'
import { Grid, GridItem } from './index'

describe('Grid Component', () => {
  it('renders children correctly', () => {
    render(
      <Grid data-testid="grid">
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </Grid>
    )
    
    const grid = screen.getByTestId('grid')
    expect(grid).toBeInTheDocument()
    expect(grid.children).toHaveLength(3)
  })

  it('applies grid styles', () => {
    render(
      <Grid columns={3} gap={4} data-testid="grid">
        <div>Item</div>
      </Grid>
    )
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveStyle({ display: 'grid' })
    expect(grid).toHaveClass('grid', 'grid-cols-3', 'gap-4')
  })

  it('handles responsive columns', () => {
    render(
      <Grid 
        columns={{ base: 1, md: 2, lg: 3 }} 
        data-testid="grid"
      >
        <div>Item</div>
      </Grid>
    )
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
  })

  it('supports grid areas', () => {
    render(
      <Grid
        areas={['header header', 'sidebar content']}
        data-testid="grid"
      >
        <GridItem area="header">Header</GridItem>
        <GridItem area="sidebar">Sidebar</GridItem>
        <GridItem area="content">Content</GridItem>
      </Grid>
    )
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveStyle({
      gridTemplateAreas: '"header header" "sidebar content"'
    })
  })
})

describe('GridItem Component', () => {
  it('renders with span classes', () => {
    render(
      <Grid>
        <GridItem colSpan={2} data-testid="item">
          Spanning item
        </GridItem>
      </Grid>
    )
    
    const item = screen.getByTestId('item')
    expect(item).toHaveClass('col-span-2')
  })

  it('handles responsive spans', () => {
    render(
      <Grid>
        <GridItem 
          colSpan={{ base: 'full', md: 2 }} 
          data-testid="item"
        >
          Responsive item
        </GridItem>
      </Grid>
    )
    
    const item = screen.getByTestId('item')
    expect(item).toHaveClass('col-span-full', 'md:col-span-2')
  })

  it('applies grid area', () => {
    render(
      <Grid areas={['header']}>
        <GridItem area="header" data-testid="item">
          Header
        </GridItem>
      </Grid>
    )
    
    const item = screen.getByTestId('item')
    expect(item).toHaveStyle({ gridArea: 'header' })
  })
})