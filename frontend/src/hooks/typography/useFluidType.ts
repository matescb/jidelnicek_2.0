import { useMemo } from 'react';
import { useWindowSize } from '../responsive/useWindowSize';

export interface FluidTypeConfig {
  /** Minimum font size in pixels */
  minSize: number;
  /** Maximum font size in pixels */
  maxSize: number;
  /** Minimum viewport width in pixels */
  minViewport?: number;
  /** Maximum viewport width in pixels */
  maxViewport?: number;
  /** Unit for the output (rem, em, px) */
  unit?: 'rem' | 'em' | 'px';
  /** Custom scaling factor (0.1 to 2) */
  scaleFactor?: number;
  /** Enable clamping to prevent extreme values */
  clamp?: boolean;
}

export interface FluidTypeResult {
  /** The calculated font size */
  fontSize: string;
  /** The CSS clamp() value */
  clampValue: string;
  /** The current calculated size in pixels */
  currentSize: number;
  /** Whether the size is at minimum */
  isAtMin: boolean;
  /** Whether the size is at maximum */
  isAtMax: boolean;
}

/**
 * Hook for calculating fluid typography sizes based on viewport
 * 
 * @example
 * ```tsx
 * const { fontSize, clampValue } = useFluidType({
 *   minSize: 16,
 *   maxSize: 24,
 *   minViewport: 320,
 *   maxViewport: 1200
 * });
 * 
 * return <h1 style={{ fontSize: clampValue }}>Fluid Heading</h1>
 * ```
 */
export function useFluidType({
  minSize,
  maxSize,
  minViewport = 320,
  maxViewport = 1200,
  unit = 'rem',
  scaleFactor = 1,
  clamp = true,
}: FluidTypeConfig): FluidTypeResult {
  const { width } = useWindowSize();

  const result = useMemo(() => {
    // Apply scaling factor
    const scaledMinSize = minSize * scaleFactor;
    const scaledMaxSize = maxSize * scaleFactor;

    // Calculate the current size based on viewport
    const viewportWidth = width || minViewport;
    const slope = (scaledMaxSize - scaledMinSize) / (maxViewport - minViewport);
    const yAxisIntersection = -minViewport * slope + scaledMinSize;
    
    let currentSize = slope * viewportWidth + yAxisIntersection;
    
    // Clamp the value if enabled
    if (clamp) {
      currentSize = Math.max(scaledMinSize, Math.min(scaledMaxSize, currentSize));
    }

    // Convert to the desired unit
    const convertToUnit = (px: number): string => {
      switch (unit) {
        case 'rem':
          return `${px / 16}rem`;
        case 'em':
          return `${px / 16}em`;
        default:
          return `${px}px`;
      }
    };

    // Calculate the clamp value for CSS
    const preferredValue = `${slope * 100}vw + ${convertToUnit(yAxisIntersection)}`;
    const clampValue = `clamp(${convertToUnit(scaledMinSize)}, ${preferredValue}, ${convertToUnit(scaledMaxSize)})`;

    return {
      fontSize: convertToUnit(currentSize),
      clampValue,
      currentSize,
      isAtMin: currentSize <= scaledMinSize,
      isAtMax: currentSize >= scaledMaxSize,
    };
  }, [minSize, maxSize, minViewport, maxViewport, unit, scaleFactor, clamp, width]);

  return result;
}

/**
 * Hook for calculating multiple fluid type scales at once
 * 
 * @example
 * ```tsx
 * const scales = useFluidTypeScale({
 *   base: { minSize: 16, maxSize: 18 },
 *   heading: { minSize: 32, maxSize: 48 },
 *   display: { minSize: 48, maxSize: 72 }
 * });
 * ```
 */
export function useFluidTypeScale<T extends Record<string, Omit<FluidTypeConfig, 'minViewport' | 'maxViewport' | 'unit' | 'scaleFactor' | 'clamp'>>>(
  scales: T,
  globalConfig?: Partial<Pick<FluidTypeConfig, 'minViewport' | 'maxViewport' | 'unit' | 'scaleFactor' | 'clamp'>>
): Record<keyof T, FluidTypeResult> {
  const { width } = useWindowSize();

  return useMemo(() => {
    const results = {} as Record<keyof T, FluidTypeResult>;

    for (const [key, config] of Object.entries(scales)) {
      const fullConfig: FluidTypeConfig = {
        ...config,
        ...globalConfig,
      };

      // Calculate fluid type for this scale
      const { minSize, maxSize, minViewport = 320, maxViewport = 1200, unit = 'rem', scaleFactor = 1, clamp = true } = fullConfig;
      
      const scaledMinSize = minSize * scaleFactor;
      const scaledMaxSize = maxSize * scaleFactor;
      const viewportWidth = width || minViewport;
      const slope = (scaledMaxSize - scaledMinSize) / (maxViewport - minViewport);
      const yAxisIntersection = -minViewport * slope + scaledMinSize;
      
      let currentSize = slope * viewportWidth + yAxisIntersection;
      
      if (clamp) {
        currentSize = Math.max(scaledMinSize, Math.min(scaledMaxSize, currentSize));
      }

      const convertToUnit = (px: number): string => {
        switch (unit) {
          case 'rem':
            return `${px / 16}rem`;
          case 'em':
            return `${px / 16}em`;
          default:
            return `${px}px`;
        }
      };

      const preferredValue = `${slope * 100}vw + ${convertToUnit(yAxisIntersection)}`;
      const clampValue = `clamp(${convertToUnit(scaledMinSize)}, ${preferredValue}, ${convertToUnit(scaledMaxSize)})`;

      results[key as keyof T] = {
        fontSize: convertToUnit(currentSize),
        clampValue,
        currentSize,
        isAtMin: currentSize <= scaledMinSize,
        isAtMax: currentSize >= scaledMaxSize,
      };
    }

    return results;
  }, [scales, globalConfig, width]);
}

/**
 * Preset fluid type scales for common use cases
 */
export const fluidTypePresets = {
  // Body text scale
  body: {
    minSize: 14,
    maxSize: 16,
  },
  // Heading scales
  h6: {
    minSize: 16,
    maxSize: 18,
  },
  h5: {
    minSize: 18,
    maxSize: 20,
  },
  h4: {
    minSize: 20,
    maxSize: 24,
  },
  h3: {
    minSize: 24,
    maxSize: 30,
  },
  h2: {
    minSize: 30,
    maxSize: 36,
  },
  h1: {
    minSize: 36,
    maxSize: 48,
  },
  // Display scales
  displaySm: {
    minSize: 48,
    maxSize: 60,
  },
  displayMd: {
    minSize: 60,
    maxSize: 72,
  },
  displayLg: {
    minSize: 72,
    maxSize: 96,
  },
} as const;

/**
 * Hook for using preset fluid type scales
 * 
 * @example
 * ```tsx
 * const { h1, h2, body } = useFluidTypePresets(['h1', 'h2', 'body']);
 * ```
 */
export function useFluidTypePresets<T extends keyof typeof fluidTypePresets>(
  presets: T[],
  globalConfig?: Partial<Pick<FluidTypeConfig, 'minViewport' | 'maxViewport' | 'unit' | 'scaleFactor' | 'clamp'>>
): Record<T, FluidTypeResult> {
  const selectedPresets = useMemo(() => {
    const selected = {} as Record<T, Omit<FluidTypeConfig, 'minViewport' | 'maxViewport' | 'unit' | 'scaleFactor' | 'clamp'>>;
    
    for (const preset of presets) {
      selected[preset] = fluidTypePresets[preset];
    }
    
    return selected;
  }, [presets]);

  return useFluidTypeScale(selectedPresets, globalConfig);
}