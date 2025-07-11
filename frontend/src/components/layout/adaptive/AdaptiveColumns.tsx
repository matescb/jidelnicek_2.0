import React from 'react';
import { cn } from '@/lib/utils';

interface AdaptiveColumnsProps {
  children: React.ReactNode;
  className?: string;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  stackAt?: 'sm' | 'md' | 'lg' | 'never';
  columns?: 2 | 3 | 4;
  ratio?: '1:1' | '1:2' | '2:1' | '1:3' | '3:1' | 'auto';
  align?: 'start' | 'center' | 'end' | 'stretch';
  reverse?: boolean;
}

const gapClasses = {
  sm: 'gap-2 md:gap-3',
  md: 'gap-4 md:gap-6',
  lg: 'gap-6 md:gap-8',
  xl: 'gap-8 md:gap-12',
};

const stackBreakpoints = {
  sm: 'flex-col sm:flex-row',
  md: 'flex-col md:flex-row',
  lg: 'flex-col lg:flex-row',
  never: 'flex-row',
};

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function AdaptiveColumns({
  children,
  className,
  gap = 'md',
  stackAt = 'md',
  columns = 2,
  ratio = 'auto',
  align = 'stretch',
  reverse = false,
}: AdaptiveColumnsProps) {
  const childrenArray = React.Children.toArray(children);
  
  // Apply ratio classes to children
  const ratioClasses = {
    '1:1': ['flex-1', 'flex-1'],
    '1:2': ['flex-1', 'flex-2'],
    '2:1': ['flex-2', 'flex-1'],
    '1:3': ['flex-1', 'flex-3'],
    '3:1': ['flex-3', 'flex-1'],
    'auto': Array(columns).fill('flex-1'),
  };

  return (
    <div
      className={cn(
        'flex',
        stackBreakpoints[stackAt],
        gapClasses[gap],
        alignClasses[align],
        reverse && 'flex-col-reverse md:flex-row-reverse',
        className
      )}
    >
      {childrenArray.map((child, index) => (
        <div
          key={index}
          className={cn(
            'min-w-0', // Prevent flex items from overflowing
            ratio !== 'auto' && ratioClasses[ratio]?.[index],
            ratio === 'auto' && 'flex-1'
          )}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// Two-column layout with specific configurations
interface AdaptiveTwoColumnProps {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  stackAt?: 'sm' | 'md' | 'lg' | 'never';
  leftWidth?: 'narrow' | 'wide' | 'equal';
  reverse?: boolean;
  leftSticky?: boolean;
  rightSticky?: boolean;
}

const leftWidthClasses = {
  narrow: 'w-full md:w-1/3 lg:w-1/4',
  wide: 'w-full md:w-2/3 lg:w-3/4',
  equal: 'w-full md:w-1/2',
};

const rightWidthClasses = {
  narrow: 'w-full md:w-2/3 lg:w-3/4',
  wide: 'w-full md:w-1/3 lg:w-1/4',
  equal: 'w-full md:w-1/2',
};

export function AdaptiveTwoColumn({
  left,
  right,
  className,
  gap = 'md',
  stackAt = 'md',
  leftWidth = 'equal',
  reverse = false,
  leftSticky = false,
  rightSticky = false,
}: AdaptiveTwoColumnProps) {
  const containerClass = cn(
    'flex',
    stackBreakpoints[stackAt],
    gapClasses[gap],
    reverse && 'flex-col-reverse md:flex-row-reverse',
    className
  );

  return (
    <div className={containerClass}>
      <div
        className={cn(
          leftWidthClasses[leftWidth],
          leftSticky && 'md:sticky md:top-4 md:self-start'
        )}
      >
        {left}
      </div>
      <div
        className={cn(
          rightWidthClasses[leftWidth],
          rightSticky && 'md:sticky md:top-4 md:self-start'
        )}
      >
        {right}
      </div>
    </div>
  );
}

// Masonry-style adaptive columns
interface AdaptiveMasonryProps {
  children: React.ReactNode;
  className?: string;
  columns?: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  gap?: 'sm' | 'md' | 'lg';
}

export function AdaptiveMasonry({
  children,
  className,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
}: AdaptiveMasonryProps) {
  return (
    <div
      className={cn(
        'columns-1',
        columns.tablet === 2 && 'md:columns-2',
        columns.tablet === 3 && 'md:columns-3',
        columns.desktop === 2 && 'lg:columns-2',
        columns.desktop === 3 && 'lg:columns-3',
        columns.desktop === 4 && 'lg:columns-4',
        gapClasses[gap],
        className
      )}
    >
      {React.Children.map(children, (child, index) => (
        <div key={index} className="break-inside-avoid mb-4">
          {child}
        </div>
      ))}
    </div>
  );
}