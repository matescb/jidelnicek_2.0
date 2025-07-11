import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { Text, TextProps } from './Text';

export interface ResponsiveTextProps extends Omit<TextProps, 'children'> {
  /** Text content for desktop screens */
  desktop?: React.ReactNode;
  /** Text content for tablet screens */
  tablet?: React.ReactNode;
  /** Text content for mobile screens */
  mobile: React.ReactNode;
  /** Character limit for desktop */
  desktopLimit?: number;
  /** Character limit for tablet */
  tabletLimit?: number;
  /** Character limit for mobile */
  mobileLimit?: number;
  /** Show ellipsis when truncated */
  showEllipsis?: boolean;
  /** Custom breakpoints */
  breakpoints?: {
    desktop?: string;
    tablet?: string;
  };
  /** Loading state while determining screen size */
  loading?: React.ReactNode;
  /** Enable dynamic font loading based on viewport */
  dynamicFontLoading?: boolean;
  /** Performance mode - reduces re-renders */
  performanceMode?: boolean;
}

const truncateText = (text: string, limit: number, showEllipsis: boolean): string => {
  if (text.length <= limit) return text;
  const truncated = text.substring(0, limit).trim();
  return showEllipsis ? `${truncated}...` : truncated;
};

export const ResponsiveText = React.forwardRef<HTMLParagraphElement, ResponsiveTextProps>(
  ({
    desktop,
    tablet,
    mobile,
    desktopLimit,
    tabletLimit,
    mobileLimit,
    showEllipsis = true,
    breakpoints = {
      desktop: '(min-width: 1024px)',
      tablet: '(min-width: 768px) and (max-width: 1023px)',
    },
    loading = null,
    dynamicFontLoading = false,
    performanceMode = false,
    className,
    ...textProps
  }, ref) => {
    const isDesktop = useMediaQuery(breakpoints.desktop || '(min-width: 1024px)');
    const isTablet = useMediaQuery(breakpoints.tablet || '(min-width: 768px) and (max-width: 1023px)');
    const isMobile = !isDesktop && !isTablet;

    // Determine which content to show
    const content = useMemo(() => {
      let text: React.ReactNode = mobile;
      let limit: number | undefined;

      if (isDesktop && desktop !== undefined) {
        text = desktop;
        limit = desktopLimit;
      } else if (isTablet && tablet !== undefined) {
        text = tablet;
        limit = tabletLimit;
      } else {
        limit = mobileLimit;
      }

      // Apply character limit if specified and text is a string
      if (limit && typeof text === 'string') {
        text = truncateText(text, limit, showEllipsis);
      }

      return text;
    }, [
      isDesktop,
      isTablet,
      desktop,
      tablet,
      mobile,
      desktopLimit,
      tabletLimit,
      mobileLimit,
      showEllipsis,
    ]);

    // Dynamic font loading classes
    const fontLoadingClasses = useMemo(() => {
      if (!dynamicFontLoading) return '';
      
      if (isDesktop) {
        return 'font-display-swap-desktop';
      } else if (isTablet) {
        return 'font-display-swap-tablet';
      } else {
        return 'font-display-swap-mobile';
      }
    }, [dynamicFontLoading, isDesktop, isTablet]);

    // Performance mode: reduce re-renders by memoizing the entire component
    const textElement = useMemo(() => (
      <Text
        ref={ref}
        className={cn(fontLoadingClasses, className)}
        {...textProps}
      >
        {content}
      </Text>
    ), [content, fontLoadingClasses, className, textProps, ref]);

    // Show loading state if screen size is not yet determined
    if (loading !== null && isDesktop === false && isTablet === false && isMobile === false) {
      return <>{loading}</>;
    }

    return performanceMode ? textElement : (
      <Text
        ref={ref}
        className={cn(fontLoadingClasses, className)}
        {...textProps}
      >
        {content}
      </Text>
    );
  }
);

ResponsiveText.displayName = 'ResponsiveText';

// Responsive text with different sizes for different screens
export interface ResponsiveSizedTextProps extends Omit<TextProps, 'size'> {
  /** Size for desktop screens */
  desktopSize?: TextProps['size'];
  /** Size for tablet screens */
  tabletSize?: TextProps['size'];
  /** Size for mobile screens */
  mobileSize?: TextProps['size'];
  /** Default size fallback */
  size?: TextProps['size'];
}

export const ResponsiveSizedText = React.forwardRef<HTMLParagraphElement, ResponsiveSizedTextProps>(
  ({
    desktopSize,
    tabletSize,
    mobileSize,
    size = 'md',
    className,
    ...props
  }, ref) => {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

    const currentSize = useMemo(() => {
      if (isDesktop && desktopSize) return desktopSize;
      if (isTablet && tabletSize) return tabletSize;
      if (!isDesktop && !isTablet && mobileSize) return mobileSize;
      return size;
    }, [isDesktop, isTablet, desktopSize, tabletSize, mobileSize, size]);

    return (
      <Text
        ref={ref}
        size={currentSize}
        className={className}
        {...props}
      />
    );
  }
);

ResponsiveSizedText.displayName = 'ResponsiveSizedText';

// Utility component for responsive line clamping
export interface ResponsiveClampTextProps extends Omit<TextProps, 'clamp'> {
  /** Number of lines for desktop */
  desktopClamp?: number;
  /** Number of lines for tablet */
  tabletClamp?: number;
  /** Number of lines for mobile */
  mobileClamp?: number;
  /** Default clamp fallback */
  clamp?: number;
}

export const ResponsiveClampText = React.forwardRef<HTMLParagraphElement, ResponsiveClampTextProps>(
  ({
    desktopClamp,
    tabletClamp,
    mobileClamp,
    clamp = 3,
    className,
    ...props
  }, ref) => {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

    const currentClamp = useMemo(() => {
      if (isDesktop && desktopClamp) return desktopClamp;
      if (isTablet && tabletClamp) return tabletClamp;
      if (!isDesktop && !isTablet && mobileClamp) return mobileClamp;
      return clamp;
    }, [isDesktop, isTablet, desktopClamp, tabletClamp, mobileClamp, clamp]);

    return (
      <Text
        ref={ref}
        clamp={currentClamp}
        className={className}
        {...props}
      />
    );
  }
);

ResponsiveClampText.displayName = 'ResponsiveClampText';