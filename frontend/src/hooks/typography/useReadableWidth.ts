import { useMemo } from 'react';
import { useWindowSize } from '../responsive/useWindowSize';

export interface ReadableWidthConfig {
  /** Font size in pixels */
  fontSize?: number;
  /** Target characters per line */
  charactersPerLine?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Language/script (affects character width calculations) */
  language?: 'en' | 'cs' | 'cjk' | 'ar';
  /** Font family type */
  fontFamily?: 'sans' | 'serif' | 'mono';
  /** Padding on mobile devices */
  mobilePadding?: number;
  /** Enable responsive adjustments */
  responsive?: boolean;
}

export interface ReadableWidthResult {
  /** Optimal width in pixels */
  width: number;
  /** Optimal width as CSS value */
  cssWidth: string;
  /** Optimal width in ch units */
  chWidth: string;
  /** Maximum width constraint */
  maxWidth: string;
  /** Container styles object */
  containerStyles: React.CSSProperties;
  /** Whether the current viewport is constraining the width */
  isConstrained: boolean;
  /** Estimated characters per line at current width */
  estimatedCPL: number;
}

// Average character width multipliers for different languages and fonts
const CHARACTER_WIDTH_MULTIPLIERS = {
  en: {
    sans: 0.45,
    serif: 0.42,
    mono: 0.6,
  },
  cs: {
    sans: 0.46,
    serif: 0.43,
    mono: 0.6,
  },
  cjk: {
    sans: 1.0,
    serif: 1.0,
    mono: 1.0,
  },
  ar: {
    sans: 0.5,
    serif: 0.48,
    mono: 0.6,
  },
} as const;

/**
 * Hook for calculating optimal reading width based on typography settings
 * 
 * @example
 * ```tsx
 * const { containerStyles } = useReadableWidth({
 *   fontSize: 16,
 *   charactersPerLine: 65,
 *   language: 'en'
 * });
 * 
 * return <article style={containerStyles}>...</article>
 * ```
 */
export function useReadableWidth({
  fontSize = 16,
  charactersPerLine = 65,
  minWidth = 320,
  maxWidth = 1200,
  language = 'en',
  fontFamily = 'sans',
  mobilePadding = 20,
  responsive = true,
}: ReadableWidthConfig = {}): ReadableWidthResult {
  const { width: viewportWidth } = useWindowSize();

  const result = useMemo(() => {
    // Get character width multiplier
    const multiplier = CHARACTER_WIDTH_MULTIPLIERS[language][fontFamily];
    
    // Calculate optimal width based on characters per line
    const averageCharWidth = fontSize * multiplier;
    const optimalWidth = Math.round(charactersPerLine * averageCharWidth);
    
    // Apply constraints
    let constrainedWidth = Math.max(minWidth, Math.min(maxWidth, optimalWidth));
    
    // Responsive adjustments
    if (responsive && viewportWidth) {
      const availableWidth = viewportWidth - (mobilePadding * 2);
      constrainedWidth = Math.min(constrainedWidth, availableWidth);
    }
    
    // Calculate actual characters per line
    const estimatedCPL = Math.round(constrainedWidth / averageCharWidth);
    
    // Convert to CSS values
    const cssWidth = `${constrainedWidth}px`;
    const chWidth = `${charactersPerLine}ch`;
    const maxWidthCss = responsive && viewportWidth && viewportWidth < maxWidth
      ? `calc(100vw - ${mobilePadding * 2}px)`
      : `${maxWidth}px`;

    // Container styles
    const containerStyles: React.CSSProperties = {
      width: '100%',
      maxWidth: cssWidth,
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingLeft: viewportWidth && viewportWidth <= 768 ? `${mobilePadding}px` : undefined,
      paddingRight: viewportWidth && viewportWidth <= 768 ? `${mobilePadding}px` : undefined,
    };

    return {
      width: constrainedWidth,
      cssWidth,
      chWidth,
      maxWidth: maxWidthCss,
      containerStyles,
      isConstrained: constrainedWidth !== optimalWidth,
      estimatedCPL,
    };
  }, [fontSize, charactersPerLine, minWidth, maxWidth, language, fontFamily, mobilePadding, responsive, viewportWidth]);

  return result;
}

/**
 * Hook for responsive characters per line based on viewport
 * 
 * @example
 * ```tsx
 * const cpl = useResponsiveCPL({
 *   desktop: 75,
 *   tablet: 65,
 *   mobile: 45
 * });
 * ```
 */
export function useResponsiveCPL({
  desktop = 75,
  tablet = 65,
  mobile = 45,
  breakpoints = {
    desktop: 1024,
    tablet: 768,
  },
}: {
  desktop?: number;
  tablet?: number;
  mobile?: number;
  breakpoints?: {
    desktop?: number;
    tablet?: number;
  };
} = {}): number {
  const { width } = useWindowSize();

  return useMemo(() => {
    if (!width) return mobile;
    
    if (width >= (breakpoints.desktop || 1024)) {
      return desktop;
    } else if (width >= (breakpoints.tablet || 768)) {
      return tablet;
    } else {
      return mobile;
    }
  }, [width, desktop, tablet, mobile, breakpoints]);
}

/**
 * Preset configurations for common reading scenarios
 */
export const readableWidthPresets = {
  article: {
    charactersPerLine: 65,
    minWidth: 320,
    maxWidth: 720,
  },
  narrow: {
    charactersPerLine: 45,
    minWidth: 280,
    maxWidth: 520,
  },
  wide: {
    charactersPerLine: 80,
    minWidth: 320,
    maxWidth: 960,
  },
  documentation: {
    charactersPerLine: 75,
    minWidth: 320,
    maxWidth: 840,
  },
  mobile: {
    charactersPerLine: 45,
    minWidth: 280,
    maxWidth: 480,
  },
} as const;

/**
 * Hook for using preset readable width configurations
 * 
 * @example
 * ```tsx
 * const { containerStyles } = useReadableWidthPreset('article', {
 *   fontSize: 18,
 *   language: 'en'
 * });
 * ```
 */
export function useReadableWidthPreset(
  preset: keyof typeof readableWidthPresets,
  overrides?: Partial<ReadableWidthConfig>
): ReadableWidthResult {
  const config = useMemo(() => ({
    ...readableWidthPresets[preset],
    ...overrides,
  }), [preset, overrides]);

  return useReadableWidth(config);
}

/**
 * Hook for calculating font size based on desired characters per line
 * 
 * @example
 * ```tsx
 * const fontSize = useFontSizeForCPL({
 *   targetCPL: 65,
 *   containerWidth: 720
 * });
 * ```
 */
export function useFontSizeForCPL({
  targetCPL = 65,
  containerWidth,
  language = 'en',
  fontFamily = 'sans',
  minFontSize = 14,
  maxFontSize = 24,
}: {
  targetCPL?: number;
  containerWidth?: number;
  language?: 'en' | 'cs' | 'cjk' | 'ar';
  fontFamily?: 'sans' | 'serif' | 'mono';
  minFontSize?: number;
  maxFontSize?: number;
} = {}): number {
  const { width: viewportWidth } = useWindowSize();

  return useMemo(() => {
    const width = containerWidth || viewportWidth || 720;
    const multiplier = CHARACTER_WIDTH_MULTIPLIERS[language][fontFamily];
    
    // Calculate font size needed for target CPL
    const calculatedFontSize = width / (targetCPL * multiplier);
    
    // Apply constraints
    return Math.max(minFontSize, Math.min(maxFontSize, Math.round(calculatedFontSize)));
  }, [targetCPL, containerWidth, viewportWidth, language, fontFamily, minFontSize, maxFontSize]);
}