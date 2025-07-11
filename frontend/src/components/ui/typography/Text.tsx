import React from 'react';
import { cn } from '../../../lib/utils';

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Text size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Text alignment */
  align?: 'left' | 'center' | 'right' | 'justify';
  /** Responsive alignment for mobile */
  mobileAlign?: 'left' | 'center' | 'right';
  /** Font weight */
  weight?: 'thin' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';
  /** Line height */
  leading?: 'tight' | 'snug' | 'normal' | 'relaxed' | 'loose';
  /** Letter spacing */
  tracking?: 'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest';
  /** Text color */
  color?: 'primary' | 'secondary' | 'muted' | 'accent' | 'error' | 'success' | 'warning';
  /** Enable text truncation */
  truncate?: boolean;
  /** Number of lines to show before truncating (requires CSS line-clamp support) */
  clamp?: number;
  /** Maximum reading width */
  readingWidth?: 'narrow' | 'normal' | 'wide' | 'none';
  /** Semantic HTML element */
  as?: 'p' | 'span' | 'div' | 'small' | 'strong' | 'em' | 'mark' | 'del' | 'ins';
  /** Balance text wrapping for better line breaks */
  balance?: boolean;
  /** Enable pretty text wrapping */
  pretty?: boolean;
}

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
} as const;

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
} as const;

const mobileAlignClasses = {
  left: 'mobile:text-left',
  center: 'mobile:text-center',
  right: 'mobile:text-right',
} as const;

const weightClasses = {
  thin: 'font-thin',
  light: 'font-light',
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
  black: 'font-black',
} as const;

const leadingClasses = {
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
  loose: 'leading-loose',
} as const;

const trackingClasses = {
  tighter: 'tracking-tighter',
  tight: 'tracking-tight',
  normal: 'tracking-normal',
  wide: 'tracking-wide',
  wider: 'tracking-wider',
  widest: 'tracking-widest',
} as const;

const colorClasses = {
  primary: 'text-foreground',
  secondary: 'text-muted-foreground',
  muted: 'text-muted-foreground/70',
  accent: 'text-primary',
  error: 'text-destructive',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
} as const;

const readingWidthClasses = {
  narrow: 'reading-narrow',
  normal: 'reading-normal',
  wide: 'reading-wide',
  none: '',
} as const;

export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({
    className,
    size = 'md',
    align,
    mobileAlign,
    weight = 'normal',
    leading = 'normal',
    tracking = 'normal',
    color = 'primary',
    truncate = false,
    clamp,
    readingWidth = 'none',
    as: Component = 'p',
    balance = false,
    pretty = false,
    style,
    children,
    ...props
  }, ref) => {
    const classes = cn(
      sizeClasses[size],
      align && alignClasses[align],
      mobileAlign && mobileAlignClasses[mobileAlign],
      weightClasses[weight],
      leadingClasses[leading],
      trackingClasses[tracking],
      colorClasses[color],
      readingWidth !== 'none' && readingWidthClasses[readingWidth],
      truncate && 'text-truncate',
      balance && 'text-balance',
      pretty && 'text-pretty',
      className
    );

    const styles = {
      ...style,
      ...(clamp && {
        display: '-webkit-box',
        WebkitLineClamp: clamp,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }),
    };

    return (
      <Component
        ref={ref as any}
        className={classes}
        style={styles}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Text.displayName = 'Text';

// Pre-configured text components for common use cases
export const BodyText = React.forwardRef<HTMLParagraphElement, Omit<TextProps, 'size' | 'leading'>>(
  (props, ref) => <Text ref={ref} size="md" leading="relaxed" readingWidth="normal" {...props} />
);
BodyText.displayName = 'BodyText';

export const SmallText = React.forwardRef<HTMLParagraphElement, Omit<TextProps, 'size' | 'as'>>(
  (props, ref) => <Text ref={ref} as="small" size="sm" color="secondary" {...props} />
);
SmallText.displayName = 'SmallText';

export const LargeText = React.forwardRef<HTMLParagraphElement, Omit<TextProps, 'size' | 'leading'>>(
  (props, ref) => <Text ref={ref} size="lg" leading="relaxed" {...props} />
);
LargeText.displayName = 'LargeText';

export const MutedText = React.forwardRef<HTMLParagraphElement, Omit<TextProps, 'color'>>(
  (props, ref) => <Text ref={ref} color="muted" {...props} />
);
MutedText.displayName = 'MutedText';

export const Label = React.forwardRef<HTMLParagraphElement, Omit<TextProps, 'size' | 'weight' | 'as'>>(
  (props, ref) => <Text ref={ref} as="span" size="sm" weight="medium" {...props} />
);
Label.displayName = 'Label';