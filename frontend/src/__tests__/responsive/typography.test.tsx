/**
 * Tests for responsive typography components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  FluidText,
  ResponsiveHeading,
  ReadingWidth,
  TruncatedText,
} from '../../components/shared/Typography';
import { mockWindowResize, viewports, getComputedStyles } from './utils';

describe('FluidText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with default size', () => {
    render(<FluidText data-testid="text">Hello World</FluidText>);

    const text = screen.getByTestId('text');
    expect(text).toHaveTextContent('Hello World');
    expect(text.tagName).toBe('P');
  });

  it('should calculate fluid font size', () => {
    render(
      <FluidText
        data-testid="text"
        minSize="16px"
        maxSize="24px"
        minViewport="320px"
        maxViewport="1280px"
      >
        Fluid Text
      </FluidText>
    );

    const text = screen.getByTestId('text');
    const styles = getComputedStyles(text);
    
    // Should have clamp CSS function
    expect(text).toHaveStyle({
      fontSize: 'clamp(16px, calc(16px + (24 - 16) * ((100vw - 320px) / (1280 - 320))), 24px)',
    });
  });

  it('should handle different HTML elements', () => {
    const { rerender } = render(
      <FluidText as="h1" data-testid="text">
        Heading
      </FluidText>
    );

    let text = screen.getByTestId('text');
    expect(text.tagName).toBe('H1');

    rerender(
      <FluidText as="span" data-testid="text">
        Span
      </FluidText>
    );

    text = screen.getByTestId('text');
    expect(text.tagName).toBe('SPAN');
  });

  it('should apply responsive line height', () => {
    render(
      <FluidText
        data-testid="text"
        lineHeight={{ base: 1.5, md: 1.6, lg: 1.7 }}
      >
        Text with line height
      </FluidText>
    );

    const text = screen.getByTestId('text');
    expect(text).toHaveClass('leading-normal'); // 1.5
    expect(text).toHaveClass('md:leading-relaxed'); // ~1.6
    expect(text).toHaveClass('lg:leading-loose'); // ~1.7
  });

  it('should apply weight variations', () => {
    render(
      <FluidText data-testid="text" weight="bold">
        Bold Text
      </FluidText>
    );

    const text = screen.getByTestId('text');
    expect(text).toHaveClass('font-bold');
  });

  it('should handle viewport changes', () => {
    // Small viewport
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);
    const { rerender } = render(
      <FluidText
        data-testid="text"
        minSize="14px"
        maxSize="20px"
        minViewport="320px"
        maxViewport="1024px"
      >
        Responsive Text
      </FluidText>
    );

    let text = screen.getByTestId('text');
    let computedSize = parseFloat(window.getComputedStyle(text).fontSize);
    expect(computedSize).toBeCloseTo(14, 1); // Should be close to min

    // Large viewport
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);
    rerender(
      <FluidText
        data-testid="text"
        minSize="14px"
        maxSize="20px"
        minViewport="320px"
        maxViewport="1024px"
      >
        Responsive Text
      </FluidText>
    );

    text = screen.getByTestId('text');
    computedSize = parseFloat(window.getComputedStyle(text).fontSize);
    expect(computedSize).toBeCloseTo(20, 1); // Should be close to max
  });
});

describe('ResponsiveHeading', () => {
  it('should render with appropriate tag for level', () => {
    const { rerender } = render(
      <ResponsiveHeading level={1} data-testid="heading">
        H1 Heading
      </ResponsiveHeading>
    );

    let heading = screen.getByTestId('heading');
    expect(heading.tagName).toBe('H1');

    rerender(
      <ResponsiveHeading level={3} data-testid="heading">
        H3 Heading
      </ResponsiveHeading>
    );

    heading = screen.getByTestId('heading');
    expect(heading.tagName).toBe('H3');
  });

  it('should apply responsive sizes based on level', () => {
    render(
      <ResponsiveHeading level={1} data-testid="h1">
        Large Heading
      </ResponsiveHeading>
    );

    const h1 = screen.getByTestId('h1');
    expect(h1).toHaveClass('text-3xl');
    expect(h1).toHaveClass('md:text-4xl');
    expect(h1).toHaveClass('lg:text-5xl');
  });

  it('should handle mobile size adjustments', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <>
        <ResponsiveHeading level={1} data-testid="h1">
          H1
        </ResponsiveHeading>
        <ResponsiveHeading level={2} data-testid="h2">
          H2
        </ResponsiveHeading>
        <ResponsiveHeading level={3} data-testid="h3">
          H3
        </ResponsiveHeading>
      </>
    );

    const h1 = screen.getByTestId('h1');
    const h2 = screen.getByTestId('h2');
    const h3 = screen.getByTestId('h3');

    // Mobile sizes should be smaller
    expect(h1).toHaveClass('text-3xl');
    expect(h2).toHaveClass('text-2xl');
    expect(h3).toHaveClass('text-xl');
  });

  it('should apply custom responsive sizes', () => {
    render(
      <ResponsiveHeading
        level={2}
        data-testid="heading"
        size={{ base: 'xl', md: '2xl', lg: '3xl' }}
      >
        Custom Size
      </ResponsiveHeading>
    );

    const heading = screen.getByTestId('heading');
    expect(heading).toHaveClass('text-xl');
    expect(heading).toHaveClass('md:text-2xl');
    expect(heading).toHaveClass('lg:text-3xl');
  });

  it('should handle different alignments', () => {
    render(
      <ResponsiveHeading
        level={1}
        data-testid="heading"
        align={{ base: 'center', md: 'left', lg: 'right' }}
      >
        Aligned Heading
      </ResponsiveHeading>
    );

    const heading = screen.getByTestId('heading');
    expect(heading).toHaveClass('text-center');
    expect(heading).toHaveClass('md:text-left');
    expect(heading).toHaveClass('lg:text-right');
  });

  it('should apply custom className', () => {
    render(
      <ResponsiveHeading level={1} className="custom-heading" data-testid="heading">
        Custom Class
      </ResponsiveHeading>
    );

    const heading = screen.getByTestId('heading');
    expect(heading).toHaveClass('custom-heading');
  });
});

describe('ReadingWidth', () => {
  it('should constrain content width', () => {
    render(
      <ReadingWidth data-testid="container">
        <p>Long text content that should be constrained for optimal reading.</p>
      </ReadingWidth>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveClass('max-w-prose');
    expect(container).toHaveClass('mx-auto');
  });

  it('should handle different width presets', () => {
    const { rerender } = render(
      <ReadingWidth width="narrow" data-testid="container">
        <p>Narrow content</p>
      </ReadingWidth>
    );

    let container = screen.getByTestId('container');
    expect(container).toHaveClass('max-w-lg');

    rerender(
      <ReadingWidth width="wide" data-testid="container">
        <p>Wide content</p>
      </ReadingWidth>
    );

    container = screen.getByTestId('container');
    expect(container).toHaveClass('max-w-4xl');
  });

  it('should apply custom max width', () => {
    render(
      <ReadingWidth width="600px" data-testid="container">
        <p>Custom width content</p>
      </ReadingWidth>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveStyle({ maxWidth: '600px' });
  });

  it('should handle responsive widths', () => {
    render(
      <ReadingWidth
        width={{ base: 'narrow', md: 'normal', lg: 'wide' }}
        data-testid="container"
      >
        <p>Responsive width content</p>
      </ReadingWidth>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveClass('max-w-lg');
    expect(container).toHaveClass('md:max-w-prose');
    expect(container).toHaveClass('lg:max-w-4xl');
  });

  it('should apply padding', () => {
    render(
      <ReadingWidth padding data-testid="container">
        <p>Padded content</p>
      </ReadingWidth>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveClass('px-4');
    expect(container).toHaveClass('md:px-6');
    expect(container).toHaveClass('lg:px-8');
  });

  it('should center content', () => {
    render(
      <ReadingWidth center data-testid="container">
        <p>Centered content</p>
      </ReadingWidth>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveClass('text-center');
  });
});

describe('TruncatedText', () => {
  const longText = 'This is a very long text that should be truncated when it exceeds the specified number of lines or characters to maintain a clean layout.';

  it('should truncate text by lines', () => {
    render(
      <TruncatedText lines={2} data-testid="text">
        {longText}
      </TruncatedText>
    );

    const text = screen.getByTestId('text');
    expect(text).toHaveClass('line-clamp-2');
    expect(text).toHaveStyle({
      overflow: 'hidden',
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: '2',
    });
  });

  it('should truncate text by characters', () => {
    render(
      <TruncatedText maxChars={50} data-testid="text">
        {longText}
      </TruncatedText>
    );

    const text = screen.getByTestId('text');
    expect(text).toHaveTextContent('This is a very long text that should be truncated...');
  });

  it('should show custom ellipsis', () => {
    render(
      <TruncatedText maxChars={30} ellipsis=" [...]" data-testid="text">
        {longText}
      </TruncatedText>
    );

    const text = screen.getByTestId('text');
    expect(text).toHaveTextContent('This is a very long text that [...]');
  });

  it('should handle expandable text', () => {
    render(
      <TruncatedText lines={2} expandable data-testid="text">
        {longText}
      </TruncatedText>
    );

    const showMoreButton = screen.getByText(/show more/i);
    expect(showMoreButton).toBeInTheDocument();

    // Expand text
    showMoreButton.click();
    expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
    expect(screen.getByText(/show less/i)).toBeInTheDocument();

    // Collapse text
    const showLessButton = screen.getByText(/show less/i);
    showLessButton.click();
    expect(screen.getByText(/show more/i)).toBeInTheDocument();
  });

  it('should not truncate short text', () => {
    const shortText = 'Short text';
    
    render(
      <TruncatedText maxChars={50} data-testid="text">
        {shortText}
      </TruncatedText>
    );

    const text = screen.getByTestId('text');
    expect(text).toHaveTextContent(shortText);
    expect(text).not.toHaveTextContent('...');
  });

  it('should handle responsive line clamping', () => {
    render(
      <TruncatedText
        lines={{ base: 2, md: 3, lg: 4 }}
        data-testid="text"
      >
        {longText}
      </TruncatedText>
    );

    const text = screen.getByTestId('text');
    expect(text).toHaveClass('line-clamp-2');
    expect(text).toHaveClass('md:line-clamp-3');
    expect(text).toHaveClass('lg:line-clamp-4');
  });

  it('should preserve HTML when truncating', () => {
    const htmlText = 'This is <strong>bold</strong> and <em>italic</em> text.';
    
    render(
      <TruncatedText maxChars={20} preserveHtml data-testid="text">
        <span dangerouslySetInnerHTML={{ __html: htmlText }} />
      </TruncatedText>
    );

    const text = screen.getByTestId('text');
    const strong = text.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('bold');
  });

  it('should handle custom className', () => {
    render(
      <TruncatedText lines={2} className="custom-truncate" data-testid="text">
        {longText}
      </TruncatedText>
    );

    const text = screen.getByTestId('text');
    expect(text).toHaveClass('custom-truncate');
  });
});