/**
 * Configuration module exports
 * 
 * Central export point for all configuration modules
 */

// Theme configuration
export * from './theme'

// Re-export specific items for convenience
export {
  lightTheme,
  darkTheme,
  themes,
  defaultTheme,
  getThemeColor,
  generateColorVariation,
  getContrastRatio,
  meetsContrastStandard,
  applyThemeToCSSVariables,
  createCustomTheme,
  validateTheme,
  getCSSVariable,
  setCSSVariable,
} from './theme'

// Export types
export type {
  Theme,
  ThemeColors,
  ThemeSpacing,
  ThemeRadii,
  ThemeShadows,
  ThemeTypography,
  ColorScale,
  ThemeName,
} from './theme'