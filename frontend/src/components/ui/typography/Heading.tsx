import React from 'react';
import { cn } from '../../../lib/utils';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading level */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Display variant for hero text */
  display?: 'sm' | 'md' | 'lg' | 'xl' | false;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Responsive alignment for mobile */
  mobileAlign?: 'left' | 'center' | 'right';
  /** Font weight */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';
  /** Letter spacing */
  tracking?: 'tighter' | 'tight' | 'normal' | 'wide';
  /** Text color */
  color?: 'primary' | 'secondary' | 'muted' | 'accent';
  /** Balance text wrapping for better line breaks */
  balance?: boolean;
  /** Responsive margins */
  spacing?: 'tight' | 'normal' | 'loose';
  /** Enable gradient text effect */
  gradient?: boolean;
  /** Semantic HTML element override */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'span';
}

const levelClasses = {
  1: 'text-4xl',
  2: 'text-3xl',
  3: 'text-2xl',
  4: 'text-xl',
  5: 'text-lg',
  6: 'text-base',
} as const;

const displayClasses = {
  sm: 'text-display-sm',
  md: 'text-display-md',
  lg: 'text-display-lg',
  xl: 'text-display-xl',
} as const;

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

const mobileAlignClasses = {
  left: 'mobile:text-left',
  center: 'mobile:text-center',
  right: 'mobile:text-right',
} as const;

const weightClasses = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
  black: 'font-black',
} as const;

const trackingClasses = {
  tighter: 'tracking-tighter',
  tight: 'tracking-tight',
  normal: 'tracking-normal',
  wide: 'tracking-wide',
} as const;

const colorClasses = {
  primary: 'text-foreground',
  secondary: 'text-muted-foreground',
  muted: 'text-muted-foreground/70',
  accent: 'text-primary',
} as const;

const spacingClasses = {
  tight: 'mb-2 mt-4',
  normal: 'mb-4 mt-8 first:mt-0',
  loose: 'mb-6 mt-12 first:mt-0',
} as const;

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({
    className,
    level = 2,
    display = false,
    align,
    mobileAlign,
    weight = 'semibold',
    tracking = 'tight',
    color = 'primary',
    balance = true,
    spacing = 'normal',
    gradient = false,
    as,
    style,
    children,
    ...props
  }, ref) => {
    const Component = as || (`h${level}` as any);
    
    const classes = cn(
      // Base heading styles
      'leading-tight',
      // Size classes
      display ? displayClasses[display] : levelClasses[level],
      // Alignment
      align && alignClasses[align],
      mobileAlign && mobileAlignClasses[mobileAlign],
      // Typography
      weightClasses[weight],
      trackingClasses[tracking],
      !gradient && colorClasses[color],
      // Layout
      spacingClasses[spacing],
      // Text wrapping
      balance && 'text-balance',
      // Gradient effect
      gradient && 'bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent',
      className
    );

    return (
      <Component
        ref={ref}
        className={classes}
        style={style}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Heading.displayName = 'Heading';

// Pre-configured heading components
export const H1 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading ref={ref} level={1} {...props} />
);
H1.displayName = 'H1';

export const H2 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading ref={ref} level={2} {...props} />
);
H2.displayName = 'H2';

export const H3 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading ref={ref} level={3} {...props} />
);
H3.displayName = 'H3';

export const H4 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading ref={ref} level={4} {...props} />
);
H4.displayName = 'H4';

export const H5 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading ref={ref} level={5} {...props} />
);
H5.displayName = 'H5';

export const H6 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level'>>(
  (props, ref) => <Heading ref={ref} level={6} {...props} />
);
H6.displayName = 'H6';

// Display heading components for hero sections
export const DisplayHeading = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'display'>>(
  ({ level = 1, ...props }, ref) => (
    <Heading 
      ref={ref} 
      level={level} 
      display="lg" 
      weight="bold"
      spacing="loose"
      {...props} 
    />
  )
);
DisplayHeading.displayName = 'DisplayHeading';

export const PageTitle = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level' | 'weight' | 'spacing'>>(
  (props, ref) => (
    <Heading 
      ref={ref} 
      level={1} 
      weight="bold"
      spacing="normal"
      balance
      {...props} 
    />
  )
);
PageTitle.displayName = 'PageTitle';

export const SectionTitle = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level' | 'weight'>>(
  (props, ref) => (
    <Heading 
      ref={ref} 
      level={2} 
      weight="semibold"
      balance
      {...props} 
    />
  )
);
SectionTitle.displayName = 'SectionTitle';

export const CardTitle = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'level' | 'weight' | 'spacing'>>(
  (props, ref) => (
    <Heading 
      ref={ref} 
      level={3} 
      weight="semibold"
      spacing="tight"
      {...props} 
    />
  )
);
CardTitle.displayName = 'CardTitle';