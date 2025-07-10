/**
 * Theme Configuration System for Jidelnicek Application
 * 
 * This module provides a comprehensive theme configuration with:
 * - Type-safe theme structure
 * - Color palette definitions for light and dark themes
 * - Helper functions for theme manipulation
 * - Support for custom theme extensions
 * - Integration with CSS variables
 */

// Type definitions for theme structure
export interface ColorScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950?: string
}

export interface ThemeColors {
  primary: ColorScale
  secondary: ColorScale
  success: ColorScale
  warning: ColorScale
  error: ColorScale
  info: ColorScale
  // Single value colors
  background: string
  surface: string
  surfaceElevated: string
  card: string
  popover: string
  modal: string
  // Text colors
  text: {
    primary: string
    secondary: string
    muted: string
    disabled: string
    inverse: string
  }
  // Border colors
  border: {
    default: string
    subtle: string
    strong: string
    focus: string
  }
  // Input specific colors
  input: {
    background: string
    border: string
    borderHover: string
    borderFocus: string
    placeholder: string
  }
  // Focus ring
  focusRing: string
}

export interface ThemeSpacing {
  0: string
  1: string
  2: string
  3: string
  4: string
  5: string
  6: string
  8: string
  10: string
  12: string
  16: string
  20: string
  24: string
}

export interface ThemeRadii {
  none: string
  sm: string
  md: string
  lg: string
  xl: string
  '2xl': string
  '3xl': string
  full: string
}

export interface ThemeShadows {
  sm: string
  md: string
  lg: string
  xl: string
  '2xl': string
  inner: string
  none: string
}

export interface ThemeTypography {
  fontFamily: {
    sans: string
    serif: string
    mono: string
  }
  fontSize: {
    xs: [string, { lineHeight: string }]
    sm: [string, { lineHeight: string }]
    base: [string, { lineHeight: string }]
    lg: [string, { lineHeight: string }]
    xl: [string, { lineHeight: string }]
    '2xl': [string, { lineHeight: string }]
    '3xl': [string, { lineHeight: string }]
    '4xl': [string, { lineHeight: string }]
    '5xl': [string, { lineHeight: string }]
  }
  fontWeight: {
    thin: string
    light: string
    normal: string
    medium: string
    semibold: string
    bold: string
    extrabold: string
  }
}

export interface Theme {
  name: string
  colors: ThemeColors
  spacing: ThemeSpacing
  radii: ThemeRadii
  shadows: ThemeShadows
  typography: ThemeTypography
  transitions: {
    duration: {
      fast: string
      base: string
      slow: string
      slower: string
    }
    easing: {
      easeIn: string
      easeOut: string
      easeInOut: string
      bounce: string
    }
  }
}

// Color palette definitions
const colorPalettes = {
  primary: {
    light: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
      950: '#1e1b4b',
    },
    dark: {
      50: '#1e1b4b',
      100: '#312e81',
      200: '#3730a3',
      300: '#4338ca',
      400: '#4f46e5',
      500: '#6366f1',
      600: '#818cf8',
      700: '#a5b4fc',
      800: '#c7d2fe',
      900: '#e0e7ff',
      950: '#eef2ff',
    },
  },
  secondary: {
    light: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
    dark: {
      50: '#020617',
      100: '#0f172a',
      200: '#1e293b',
      300: '#334155',
      400: '#475569',
      500: '#64748b',
      600: '#94a3b8',
      700: '#cbd5e1',
      800: '#e2e8f0',
      900: '#f1f5f9',
      950: '#f8fafc',
    },
  },
  success: {
    light: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    dark: {
      50: '#14532d',
      100: '#166534',
      200: '#15803d',
      300: '#16a34a',
      400: '#22c55e',
      500: '#4ade80',
      600: '#86efac',
      700: '#bbf7d0',
      800: '#dcfce7',
      900: '#f0fdf4',
    },
  },
  warning: {
    light: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    dark: {
      50: '#78350f',
      100: '#92400e',
      200: '#b45309',
      300: '#d97706',
      400: '#f59e0b',
      500: '#fbbf24',
      600: '#fcd34d',
      700: '#fde68a',
      800: '#fef3c7',
      900: '#fffbeb',
    },
  },
  error: {
    light: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    dark: {
      50: '#7f1d1d',
      100: '#991b1b',
      200: '#b91c1c',
      300: '#dc2626',
      400: '#ef4444',
      500: '#f87171',
      600: '#fca5a5',
      700: '#fecaca',
      800: '#fee2e2',
      900: '#fef2f2',
    },
  },
  info: {
    light: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    dark: {
      50: '#1e3a8a',
      100: '#1e40af',
      200: '#1d4ed8',
      300: '#2563eb',
      400: '#3b82f6',
      500: '#60a5fa',
      600: '#93c5fd',
      700: '#bfdbfe',
      800: '#dbeafe',
      900: '#eff6ff',
    },
  },
}

// Spacing scale (consistent with Tailwind)
const spacing: ThemeSpacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
}

// Border radius scale
const radii: ThemeRadii = {
  none: '0',
  sm: '0.125rem',    // 2px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  '3xl': '1.5rem',   // 24px
  full: '9999px',
}

// Typography configuration
const typography: ThemeTypography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    serif: "'Georgia', Cambria, 'Times New Roman', Times, serif",
    mono: "'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace",
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],  // 36px
    '5xl': ['3rem', { lineHeight: '1' }],          // 48px
  },
  fontWeight: {
    thin: '100',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
}

// Light theme configuration
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: colorPalettes.primary.light,
    secondary: colorPalettes.secondary.light,
    success: colorPalettes.success.light,
    warning: colorPalettes.warning.light,
    error: colorPalettes.error.light,
    info: colorPalettes.info.light,
    background: '#ffffff',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    card: '#ffffff',
    popover: '#ffffff',
    modal: '#ffffff',
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#64748b',
      disabled: '#94a3b8',
      inverse: '#ffffff',
    },
    border: {
      default: '#e2e8f0',
      subtle: '#f1f5f9',
      strong: '#cbd5e1',
      focus: '#6366f1',
    },
    input: {
      background: '#ffffff',
      border: '#e2e8f0',
      borderHover: '#cbd5e1',
      borderFocus: '#6366f1',
      placeholder: '#94a3b8',
    },
    focusRing: '#6366f1',
  },
  spacing,
  radii,
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: 'none',
  },
  typography,
  transitions: {
    duration: {
      fast: '150ms',
      base: '200ms',
      slow: '300ms',
      slower: '400ms',
    },
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
}

// Dark theme configuration
export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: colorPalettes.primary.dark,
    secondary: colorPalettes.secondary.dark,
    success: colorPalettes.success.dark,
    warning: colorPalettes.warning.dark,
    error: colorPalettes.error.dark,
    info: colorPalettes.info.dark,
    background: '#0a0a0a',
    surface: '#0f172a',
    surfaceElevated: '#1e293b',
    card: '#1e293b',
    popover: '#1e293b',
    modal: '#0f172a',
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      muted: '#94a3b8',
      disabled: '#64748b',
      inverse: '#0f172a',
    },
    border: {
      default: '#334155',
      subtle: '#1e293b',
      strong: '#475569',
      focus: '#6366f1',
    },
    input: {
      background: '#1e293b',
      border: '#334155',
      borderHover: '#475569',
      borderFocus: '#6366f1',
      placeholder: '#64748b',
    },
    focusRing: '#6366f1',
  },
  spacing,
  radii,
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.5)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.6), 0 2px 4px -2px rgb(0 0 0 / 0.6)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.6), 0 8px 10px -6px rgb(0 0 0 / 0.6)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.8)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.5)',
    none: 'none',
  },
  typography,
  transitions: {
    duration: {
      fast: '150ms',
      base: '200ms',
      slow: '300ms',
      slower: '400ms',
    },
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
}

// Default themes object
export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const

// Helper function to get a color value from a theme
export function getThemeColor(theme: Theme, path: string): string | undefined {
  const keys = path.split('.')
  let value: any = theme.colors
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      return undefined
    }
  }
  
  return typeof value === 'string' ? value : undefined
}

// Helper function to generate color variations
export function generateColorVariation(color: string, variation: 'lighter' | 'darker', amount: number = 0.1): string {
  // Convert hex to RGB
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Calculate variation
  const factor = variation === 'lighter' ? 1 + amount : 1 - amount
  const newR = Math.round(Math.min(255, Math.max(0, r * factor)))
  const newG = Math.round(Math.min(255, Math.max(0, g * factor)))
  const newB = Math.round(Math.min(255, Math.max(0, b * factor)))
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`
}

// Helper function to check contrast ratio between two colors
export function getContrastRatio(color1: string, color2: string): number {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }
  
  // Calculate relative luminance
  const getLuminance = (rgb: { r: number; g: number; b: number }) => {
    const { r, g, b } = rgb
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }
  
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  
  if (!rgb1 || !rgb2) return 1
  
  const lum1 = getLuminance(rgb1)
  const lum2 = getLuminance(rgb2)
  
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  
  return (lighter + 0.05) / (darker + 0.05)
}

// Helper function to check if contrast meets WCAG standards
export function meetsContrastStandard(
  foreground: string,
  background: string,
  standard: 'AA' | 'AAA' = 'AA',
  largeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  
  if (standard === 'AA') {
    return largeText ? ratio >= 3 : ratio >= 4.5
  } else {
    return largeText ? ratio >= 4.5 : ratio >= 7
  }
}

// Function to apply theme to CSS variables
export function applyThemeToCSSVariables(theme: Theme): void {
  const root = document.documentElement
  
  // Apply color scales
  Object.entries(theme.colors).forEach(([colorName, colorValue]) => {
    if (typeof colorValue === 'object' && 'primary' in theme.colors && colorName in theme.colors.primary) {
      // Handle color scales
      Object.entries(colorValue).forEach(([scale, value]) => {
        root.style.setProperty(`--color-${colorName}-${scale}`, value)
      })
    } else if (typeof colorValue === 'string') {
      // Handle single color values
      root.style.setProperty(`--color-${colorName}`, colorValue)
    } else if (typeof colorValue === 'object') {
      // Handle nested objects (text, border, input)
      Object.entries(colorValue).forEach(([key, value]) => {
        const varName = key === 'default' ? colorName : `${colorName}-${key}`
        root.style.setProperty(`--color-${varName}`, value as string)
      })
    }
  })
  
  // Apply shadows
  Object.entries(theme.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value)
  })
  
  // Apply other theme properties as needed
  root.style.setProperty('--font-sans', theme.typography.fontFamily.sans)
  root.style.setProperty('--font-serif', theme.typography.fontFamily.serif)
  root.style.setProperty('--font-mono', theme.typography.fontFamily.mono)
}

// Function to create a custom theme by extending an existing one
export function createCustomTheme(
  baseTheme: Theme,
  customizations: Partial<Theme>
): Theme {
  return {
    ...baseTheme,
    ...customizations,
    colors: {
      ...baseTheme.colors,
      ...(customizations.colors || {}),
    },
    spacing: {
      ...baseTheme.spacing,
      ...(customizations.spacing || {}),
    },
    radii: {
      ...baseTheme.radii,
      ...(customizations.radii || {}),
    },
    shadows: {
      ...baseTheme.shadows,
      ...(customizations.shadows || {}),
    },
    typography: {
      ...baseTheme.typography,
      ...(customizations.typography || {}),
    },
    transitions: {
      ...baseTheme.transitions,
      ...(customizations.transitions || {}),
    },
  }
}

// Function to validate theme structure
export function validateTheme(theme: any): theme is Theme {
  const requiredColorScales = ['primary', 'secondary', 'success', 'warning', 'error', 'info']
  const requiredColorSingles = ['background', 'surface', 'surfaceElevated', 'card', 'popover', 'modal', 'focusRing']
  const requiredColorObjects = ['text', 'border', 'input']
  
  // Check if theme has required properties
  if (!theme || typeof theme !== 'object') return false
  if (!theme.name || typeof theme.name !== 'string') return false
  if (!theme.colors || typeof theme.colors !== 'object') return false
  
  // Check color scales
  for (const scale of requiredColorScales) {
    if (!theme.colors[scale] || typeof theme.colors[scale] !== 'object') return false
    // Check if scale has required shades
    const requiredShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
    for (const shade of requiredShades) {
      if (!theme.colors[scale][shade] || typeof theme.colors[scale][shade] !== 'string') return false
    }
  }
  
  // Check single color values
  for (const single of requiredColorSingles) {
    if (!theme.colors[single] || typeof theme.colors[single] !== 'string') return false
  }
  
  // Check color objects
  for (const obj of requiredColorObjects) {
    if (!theme.colors[obj] || typeof theme.colors[obj] !== 'object') return false
  }
  
  // Check other required properties
  if (!theme.spacing || typeof theme.spacing !== 'object') return false
  if (!theme.radii || typeof theme.radii !== 'object') return false
  if (!theme.shadows || typeof theme.shadows !== 'object') return false
  if (!theme.typography || typeof theme.typography !== 'object') return false
  if (!theme.transitions || typeof theme.transitions !== 'object') return false
  
  return true
}

// Export a function to get CSS variable values
export function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// Export a function to set CSS variable values
export function setCSSVariable(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value)
}

// Type for theme names
export type ThemeName = keyof typeof themes

// Export default theme
export const defaultTheme = lightTheme