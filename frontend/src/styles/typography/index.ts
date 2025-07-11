// Typography utility exports
export * from '../../components/ui/typography/Text';
export * from '../../components/ui/typography/Heading';
export * from '../../components/ui/typography/ResponsiveText';
export * from '../../hooks/typography/useFluidType';
export * from '../../hooks/typography/useReadableWidth';

// Import typography CSS files
import './typography.css';
import './prose.css';

// Typography configuration constants
export const TYPOGRAPHY_CONFIG = {
  // Font stacks
  fonts: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    secondary: 'Georgia, "Times New Roman", Times, serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  
  // Font sizes (in pixels)
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  // Line heights
  lineHeights: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  // Letter spacing (em)
  letterSpacing: {
    tighter: -0.05,
    tight: -0.025,
    normal: 0,
    wide: 0.025,
    wider: 0.05,
    widest: 0.1,
  },
  
  // Font weights
  weights: {
    thin: 100,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  
  // Reading widths (ch)
  readingWidths: {
    narrow: 45,
    normal: 65,
    wide: 75,
  },
  
  // Breakpoints for responsive typography
  breakpoints: {
    mobile: 480,
    tablet: 768,
    desktop: 1024,
    wide: 1280,
  },
} as const;

// Typography scale generator
export function generateTypographyScale(
  baseFontSize: number = 16,
  scaleRatio: number = 1.25
): Record<string, number> {
  return {
    xs: Math.round(baseFontSize / (scaleRatio * scaleRatio)),
    sm: Math.round(baseFontSize / scaleRatio),
    base: baseFontSize,
    lg: Math.round(baseFontSize * scaleRatio),
    xl: Math.round(baseFontSize * scaleRatio * scaleRatio),
    '2xl': Math.round(baseFontSize * Math.pow(scaleRatio, 3)),
    '3xl': Math.round(baseFontSize * Math.pow(scaleRatio, 4)),
    '4xl': Math.round(baseFontSize * Math.pow(scaleRatio, 5)),
    '5xl': Math.round(baseFontSize * Math.pow(scaleRatio, 6)),
  };
}

// Utility function to convert pixels to rem
export function pxToRem(px: number, baseFontSize: number = 16): string {
  return `${px / baseFontSize}rem`;
}

// Utility function to convert pixels to em
export function pxToEm(px: number, baseFontSize: number = 16): string {
  return `${px / baseFontSize}em`;
}

// Utility function to create fluid typography CSS
export function createFluidType(
  minSize: number,
  maxSize: number,
  minViewport: number = 320,
  maxViewport: number = 1200
): string {
  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const yAxisIntersection = -minViewport * slope + minSize;
  
  return `clamp(${pxToRem(minSize)}, ${slope * 100}vw + ${pxToRem(yAxisIntersection)}, ${pxToRem(maxSize)})`;
}

// Typography style presets
export const typographyPresets = {
  // Body text preset
  body: {
    fontSize: TYPOGRAPHY_CONFIG.sizes.base,
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.relaxed,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.normal,
    fontWeight: TYPOGRAPHY_CONFIG.weights.normal,
  },
  
  // Heading presets
  h1: {
    fontSize: TYPOGRAPHY_CONFIG.sizes['4xl'],
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.tight,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.tight,
    fontWeight: TYPOGRAPHY_CONFIG.weights.bold,
  },
  h2: {
    fontSize: TYPOGRAPHY_CONFIG.sizes['3xl'],
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.tight,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.tight,
    fontWeight: TYPOGRAPHY_CONFIG.weights.semibold,
  },
  h3: {
    fontSize: TYPOGRAPHY_CONFIG.sizes['2xl'],
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.snug,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.tight,
    fontWeight: TYPOGRAPHY_CONFIG.weights.semibold,
  },
  h4: {
    fontSize: TYPOGRAPHY_CONFIG.sizes.xl,
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.snug,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.normal,
    fontWeight: TYPOGRAPHY_CONFIG.weights.semibold,
  },
  h5: {
    fontSize: TYPOGRAPHY_CONFIG.sizes.lg,
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.normal,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.normal,
    fontWeight: TYPOGRAPHY_CONFIG.weights.medium,
  },
  h6: {
    fontSize: TYPOGRAPHY_CONFIG.sizes.base,
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.normal,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.wide,
    fontWeight: TYPOGRAPHY_CONFIG.weights.medium,
  },
  
  // Special presets
  caption: {
    fontSize: TYPOGRAPHY_CONFIG.sizes.sm,
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.normal,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.normal,
    fontWeight: TYPOGRAPHY_CONFIG.weights.normal,
  },
  label: {
    fontSize: TYPOGRAPHY_CONFIG.sizes.sm,
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.normal,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.wide,
    fontWeight: TYPOGRAPHY_CONFIG.weights.medium,
  },
  button: {
    fontSize: TYPOGRAPHY_CONFIG.sizes.base,
    lineHeight: TYPOGRAPHY_CONFIG.lineHeights.normal,
    letterSpacing: TYPOGRAPHY_CONFIG.letterSpacing.wide,
    fontWeight: TYPOGRAPHY_CONFIG.weights.medium,
  },
} as const;

// Export type definitions
export type FontSize = keyof typeof TYPOGRAPHY_CONFIG.sizes;
export type FontWeight = keyof typeof TYPOGRAPHY_CONFIG.weights;
export type LineHeight = keyof typeof TYPOGRAPHY_CONFIG.lineHeights;
export type LetterSpacing = keyof typeof TYPOGRAPHY_CONFIG.letterSpacing;
export type ReadingWidth = keyof typeof TYPOGRAPHY_CONFIG.readingWidths;
export type TypographyPreset = keyof typeof typographyPresets;