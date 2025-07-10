import { useContext } from 'react'
import { ThemeContext } from '@context/ThemeContext'
import { 
  getThemeColor, 
  generateColorVariation, 
  getContrastRatio, 
  meetsContrastStandard,
  getCSSVariable,
  setCSSVariable,
} from '../config/theme'

export const useTheme = () => {
  const context = useContext(ThemeContext)
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  
  // Add helper functions to the returned object
  return {
    ...context,
    // Helper to get a color from the current theme
    getColor: (path: string) => getThemeColor(context.themeConfig, path),
    // Helper to generate color variations
    generateVariation: (color: string, variation: 'lighter' | 'darker', amount?: number) => 
      generateColorVariation(color, variation, amount),
    // Helper to check contrast
    checkContrast: (foreground: string, background: string) => 
      getContrastRatio(foreground, background),
    // Helper to validate contrast standards
    meetsContrastStandard: (foreground: string, background: string, standard?: 'AA' | 'AAA', largeText?: boolean) =>
      meetsContrastStandard(foreground, background, standard, largeText),
    // CSS variable helpers
    getCSSVariable,
    setCSSVariable,
    // Quick access to common theme values
    colors: context.themeConfig.colors,
    spacing: context.themeConfig.spacing,
    radii: context.themeConfig.radii,
    shadows: context.themeConfig.shadows,
    typography: context.themeConfig.typography,
    transitions: context.themeConfig.transitions,
  }
}