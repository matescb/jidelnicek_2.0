/**
 * Tests for responsive grid components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Grid, GridItem, ResponsiveGrid, FlexGrid } from '../../components/shared/Grid';
import { mockWindowResize, viewports, getComputedStyles } from './utils';

describe('Grid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with default props', () => {
    render(
      <Grid data-testid="grid">
        <div>Item 1</div>
        <div>Item 2</div>
      </Grid>
    );

    const grid = screen.getByTestId('grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveStyle({
      display: 'grid',
      gap: '1rem',
    });
  });

  it('should apply responsive columns', () => {
    render(
      <Grid
        data-testid="grid"
        cols={{ base: 1, sm: 2, md: 3, lg: 4 }}
        gap="2rem"
      >
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
        <div>Item 4</div>
      </Grid>
    );

    const grid = screen.getByTestId('grid');
    const styles = getComputedStyles(grid);
    
    // Should have responsive grid template columns
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('sm:grid-cols-2');
    expect(grid).toHaveClass('md:grid-cols-3');
    expect(grid).toHaveClass('lg:grid-cols-4');
  });

  it('should handle auto-fit columns', () => {
    render(
      <Grid
        data-testid="grid"
        cols="auto-fit"
        minChildWidth="200px"
      >
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </Grid>
    );

    const grid = screen.getByTestId('grid');
    expect(grid).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    });
  });

  it('should handle auto-fill columns', () => {
    render(
      <Grid
        data-testid="grid"
        cols="auto-fill"
        minChildWidth="250px"
      >
        <div>Item 1</div>
        <div>Item 2</div>
      </Grid>
    );

    const grid = screen.getByTestId('grid');
    expect(grid).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    });
  });

  it('should apply custom className', () => {
    render(
      <Grid data-testid="grid" className="custom-grid">
        <div>Item</div>
      </Grid>
    );

    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass('custom-grid');
  });
});

describe('GridItem', () => {
  it('should render with default span', () => {
    render(
      <Grid>
        <GridItem data-testid="item">Content</GridItem>
      </Grid>
    );

    const item = screen.getByTestId('item');
    expect(item).toBeInTheDocument();
    expect(item).toHaveTextContent('Content');
  });

  it('should apply responsive span', () => {
    render(
      <Grid>
        <GridItem
          data-testid="item"
          span={{ base: 1, sm: 2, md: 3, lg: 4 }}
        >
          Content
        </GridItem>
      </Grid>
    );

    const item = screen.getByTestId('item');
    expect(item).toHaveClass('col-span-1');
    expect(item).toHaveClass('sm:col-span-2');
    expect(item).toHaveClass('md:col-span-3');
    expect(item).toHaveClass('lg:col-span-4');
  });

  it('should apply row span', () => {
    render(
      <Grid>
        <GridItem
          data-testid="item"
          rowSpan={2}
        >
          Content
        </GridItem>
      </Grid>
    );

    const item = screen.getByTestId('item');
    expect(item).toHaveClass('row-span-2');
  });

  it('should apply start positions', () => {
    render(
      <Grid>
        <GridItem
          data-testid="item"
          colStart={2}
          rowStart={3}
        >
          Content
        </GridItem>
      </Grid>
    );

    const item = screen.getByTestId('item');
    expect(item).toHaveClass('col-start-2');
    expect(item).toHaveClass('row-start-3');
  });

  it('should apply responsive row span', () => {
    render(
      <Grid>
        <GridItem
          data-testid="item"
          rowSpan={{ base: 1, md: 2, lg: 3 }}
        >
          Content
        </GridItem>
      </Grid>
    );

    const item = screen.getByTestId('item');
    expect(item).toHaveClass('row-span-1');
    expect(item).toHaveClass('md:row-span-2');
    expect(item).toHaveClass('lg:row-span-3');
  });
});

describe('ResponsiveGrid', () => {
  beforeEach(() => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);
  });

  it('should render children in auto-fit grid', () => {
    render(
      <ResponsiveGrid data-testid="responsive-grid">
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
        <div>Item 4</div>
      </ResponsiveGrid>
    );

    const grid = screen.getByTestId('responsive-grid');
    expect(grid).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    });
  });

  it('should adjust columns on mobile', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <ResponsiveGrid data-testid="responsive-grid" minItemWidth="300px">
        <div>Item 1</div>
        <div>Item 2</div>
      </ResponsiveGrid>
    );

    const grid = screen.getByTestId('responsive-grid');
    expect(grid).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    });
  });

  it('should apply custom gap', () => {
    render(
      <ResponsiveGrid data-testid="responsive-grid" gap="2rem">
        <div>Item 1</div>
        <div>Item 2</div>
      </ResponsiveGrid>
    );

    const grid = screen.getByTestId('responsive-grid');
    expect(grid).toHaveStyle({
      gap: '2rem',
    });
  });

  it('should handle responsive gap', () => {
    render(
      <ResponsiveGrid
        data-testid="responsive-grid"
        gap={{ base: '1rem', md: '2rem', lg: '3rem' }}
      >
        <div>Item 1</div>
        <div>Item 2</div>
      </ResponsiveGrid>
    );

    const grid = screen.getByTestId('responsive-grid');
    expect(grid).toHaveClass('gap-4'); // 1rem
    expect(grid).toHaveClass('md:gap-8'); // 2rem
    expect(grid).toHaveClass('lg:gap-12'); // 3rem
  });
});

describe('FlexGrid', () => {
  it('should render as flex container', () => {
    render(
      <FlexGrid data-testid="flex-grid">
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </FlexGrid>
    );

    const grid = screen.getByTestId('flex-grid');
    expect(grid).toHaveStyle({
      display: 'flex',
      flexWrap: 'wrap',
    });
  });

  it('should apply direction', () => {
    render(
      <FlexGrid data-testid="flex-grid" direction="column">
        <div>Item 1</div>
        <div>Item 2</div>
      </FlexGrid>
    );

    const grid = screen.getByTestId('flex-grid');
    expect(grid).toHaveClass('flex-col');
  });

  it('should apply responsive direction', () => {
    render(
      <FlexGrid
        data-testid="flex-grid"
        direction={{ base: 'column', md: 'row' }}
      >
        <div>Item 1</div>
        <div>Item 2</div>
      </FlexGrid>
    );

    const grid = screen.getByTestId('flex-grid');
    expect(grid).toHaveClass('flex-col');
    expect(grid).toHaveClass('md:flex-row');
  });

  it('should apply justify and align', () => {
    render(
      <FlexGrid
        data-testid="flex-grid"
        justify="center"
        align="center"
      >
        <div>Item 1</div>
        <div>Item 2</div>
      </FlexGrid>
    );

    const grid = screen.getByTestId('flex-grid');
    expect(grid).toHaveClass('justify-center');
    expect(grid).toHaveClass('items-center');
  });

  it('should apply responsive spacing', () => {
    render(
      <FlexGrid
        data-testid="flex-grid"
        gap={{ base: '0.5rem', md: '1rem', lg: '2rem' }}
      >
        <div>Item 1</div>
        <div>Item 2</div>
      </FlexGrid>
    );

    const grid = screen.getByTestId('flex-grid');
    expect(grid).toHaveClass('gap-2'); // 0.5rem
    expect(grid).toHaveClass('md:gap-4'); // 1rem
    expect(grid).toHaveClass('lg:gap-8'); // 2rem
  });

  it('should handle wrap behavior', () => {
    render(
      <FlexGrid data-testid="flex-grid" wrap="nowrap">
        <div>Item 1</div>
        <div>Item 2</div>
      </FlexGrid>
    );

    const grid = screen.getByTestId('flex-grid');
    expect(grid).toHaveClass('flex-nowrap');
  });

  it('should apply custom className', () => {
    render(
      <FlexGrid data-testid="flex-grid" className="custom-flex">
        <div>Item</div>
      </FlexGrid>
    );

    const grid = screen.getByTestId('flex-grid');
    expect(grid).toHaveClass('custom-flex');
  });
});