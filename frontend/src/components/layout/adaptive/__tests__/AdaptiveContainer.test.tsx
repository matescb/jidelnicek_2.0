import React from 'react';
import { render } from '@testing-library/react';
import { AdaptiveContainer, AdaptiveSection, AdaptiveGrid } from '../AdaptiveContainer';

describe('AdaptiveContainer', () => {
  it('renders with default props', () => {
    const { container } = render(
      <AdaptiveContainer>
        <div>Test content</div>
      </AdaptiveContainer>
    );
    
    const element = container.firstChild;
    expect(element).toHaveClass('w-full', 'mx-auto');
    expect(element).toHaveTextContent('Test content');
  });

  it('applies variant classes correctly', () => {
    const { container: fluidContainer } = render(
      <AdaptiveContainer variant="fluid">Content</AdaptiveContainer>
    );
    expect(fluidContainer.firstChild).toHaveClass('min-w-0');

    const { container: fixedContainer } = render(
      <AdaptiveContainer variant="fixed" maxWidth="lg">Content</AdaptiveContainer>
    );
    expect(fixedContainer.firstChild).toHaveClass('max-w-screen-lg');

    const { container: fullContainer } = render(
      <AdaptiveContainer variant="full">Content</AdaptiveContainer>
    );
    expect(fullContainer.firstChild).not.toHaveClass('max-w-screen-xl');
  });

  it('applies padding classes correctly', () => {
    const { container } = render(
      <AdaptiveContainer padding="lg">Content</AdaptiveContainer>
    );
    expect(container.firstChild).toHaveClass('px-8', 'md:px-12', 'lg:px-16');
  });

  it('applies safe area classes when enabled', () => {
    const { container } = render(
      <AdaptiveContainer safeArea={true}>Content</AdaptiveContainer>
    );
    expect(container.firstChild).toHaveClass('safe-area-inset-x');
  });

  it('does not center when center prop is false', () => {
    const { container } = render(
      <AdaptiveContainer center={false}>Content</AdaptiveContainer>
    );
    expect(container.firstChild).not.toHaveClass('mx-auto');
  });
});

describe('AdaptiveSection', () => {
  it('renders as section by default', () => {
    const { container } = render(
      <AdaptiveSection>Content</AdaptiveSection>
    );
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('renders as specified element', () => {
    const { container } = render(
      <AdaptiveSection as="article">Content</AdaptiveSection>
    );
    expect(container.querySelector('article')).toBeInTheDocument();
  });

  it('applies spacing classes', () => {
    const { container } = render(
      <AdaptiveSection spacing="lg">Content</AdaptiveSection>
    );
    const section = container.querySelector('section');
    expect(section).toHaveClass('py-8', 'md:py-12', 'lg:py-16');
  });
});

describe('AdaptiveGrid', () => {
  it('renders with default grid columns', () => {
    const { container } = render(
      <AdaptiveGrid>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </AdaptiveGrid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  });

  it('applies custom column configuration', () => {
    const { container } = render(
      <AdaptiveGrid columns={{ mobile: 2, tablet: 3, desktop: 4 }}>
        <div>Item 1</div>
        <div>Item 2</div>
      </AdaptiveGrid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4');
  });

  it('applies gap classes', () => {
    const { container } = render(
      <AdaptiveGrid gap="lg">
        <div>Item 1</div>
      </AdaptiveGrid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('gap-4', 'md:gap-6', 'lg:gap-8');
  });
});