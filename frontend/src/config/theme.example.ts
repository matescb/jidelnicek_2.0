/**
 * Theme Configuration Usage Examples
 * 
 * This file demonstrates how to use the theme configuration system
 */

import {
  themes,
  lightTheme,
  darkTheme,
  getThemeColor,
  generateColorVariation,
  getContrastRatio,
  meetsContrastStandard,
  applyThemeToCSSVariables,
  createCustomTheme,
  validateTheme,
  Theme,
} from './theme'

// Example 1: Accessing theme values
export function accessThemeValues() {
  // Get primary color from light theme
  const primaryColor = lightTheme.colors.primary[500] // '#6366f1'
  
  // Get text color using helper function
  const textColor = getThemeColor(lightTheme, 'text.primary') // '#0f172a'
  
  // Get spacing value
  const spacing = lightTheme.spacing[4] // '1rem'
  
  // Get shadow
  const shadow = lightTheme.shadows.md
  
  console.log({ primaryColor, textColor, spacing, shadow })
}

// Example 2: Creating color variations
export function createColorVariations() {
  const baseColor = '#6366f1'
  
  // Create lighter variation
  const lighter = generateColorVariation(baseColor, 'lighter', 0.2)
  
  // Create darker variation
  const darker = generateColorVariation(baseColor, 'darker', 0.2)
  
  console.log({ baseColor, lighter, darker })
}

// Example 3: Checking contrast ratios
export function checkAccessibility() {
  const background = lightTheme.colors.background
  const textPrimary = lightTheme.colors.text.primary
  const textMuted = lightTheme.colors.text.muted
  
  // Check contrast ratio
  const primaryRatio = getContrastRatio(textPrimary, background)
  const mutedRatio = getContrastRatio(textMuted, background)
  
  // Check if meets WCAG standards
  const primaryMeetsAA = meetsContrastStandard(textPrimary, background, 'AA')
  const mutedMeetsAA = meetsContrastStandard(textMuted, background, 'AA')
  
  console.log({
    primaryRatio,
    mutedRatio,
    primaryMeetsAA,
    mutedMeetsAA,
  })
}

// Example 4: Creating a custom theme
export function createBrandTheme() {
  const brandTheme = createCustomTheme(lightTheme, {
    name: 'brand',
    colors: {
      ...lightTheme.colors,
      primary: {
        50: '#fef3e2',
        100: '#fde1b6',
        200: '#fbcd85',
        300: '#f9b954',
        400: '#f8aa2f',
        500: '#f69b0a', // Brand orange
        600: '#f59309',
        700: '#f38908',
        800: '#f17f06',
        900: '#ef6d05',
        950: '#ed5a04',
      },
      // Override specific text colors
      text: {
        ...lightTheme.colors.text,
        primary: '#1a1a1a',
      },
    },
  })
  
  // Validate the custom theme
  const isValid = validateTheme(brandTheme)
  console.log('Brand theme is valid:', isValid)
  
  return brandTheme
}

// Example 5: Applying theme to CSS variables
export function applyTheme(themeName: 'light' | 'dark') {
  const theme = themes[themeName]
  
  // Apply theme to CSS variables
  applyThemeToCSSVariables(theme)
  
  // Add/remove dark class for Tailwind
  if (themeName === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Example 6: Using theme in React components
export function ComponentExample() {
  // This is a conceptual example - actual implementation would be in a React component
  
  const theme = lightTheme
  
  const styles = {
    container: {
      backgroundColor: theme.colors.background,
      color: theme.colors.text.primary,
      padding: theme.spacing[4],
      borderRadius: theme.radii.md,
      boxShadow: theme.shadows.md,
    },
    button: {
      backgroundColor: theme.colors.primary[600],
      color: theme.colors.text.inverse,
      padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
      borderRadius: theme.radii.md,
      border: 'none',
      cursor: 'pointer',
      transition: `background-color ${theme.transitions.duration.base} ${theme.transitions.easing.easeInOut}`,
    },
    input: {
      backgroundColor: theme.colors.input.background,
      borderColor: theme.colors.input.border,
      color: theme.colors.text.primary,
      padding: theme.spacing[2],
      borderRadius: theme.radii.md,
      borderWidth: '1px',
      borderStyle: 'solid',
    },
  }
  
  return styles
}

// Example 7: Theme-aware color function
export function getSemanticColor(
  theme: Theme,
  semantic: 'success' | 'warning' | 'error' | 'info',
  shade: keyof Theme['colors']['success'] = 500
): string {
  return theme.colors[semantic][shade]
}

// Example 8: Generate accessible color pairs
export function generateAccessiblePairs(theme: Theme) {
  const background = theme.colors.background
  const pairs = []
  
  // Check all text colors
  for (const [key, color] of Object.entries(theme.colors.text)) {
    const ratio = getContrastRatio(color, background)
    const meetsAA = meetsContrastStandard(color, background, 'AA')
    const meetsAAA = meetsContrastStandard(color, background, 'AAA')
    
    pairs.push({
      name: `text.${key}`,
      foreground: color,
      background,
      ratio: ratio.toFixed(2),
      meetsAA,
      meetsAAA,
    })
  }
  
  return pairs
}

// Example 9: Create a high contrast theme
export function createHighContrastTheme() {
  return createCustomTheme(darkTheme, {
    name: 'high-contrast',
    colors: {
      ...darkTheme.colors,
      background: '#000000',
      text: {
        primary: '#ffffff',
        secondary: '#f0f0f0',
        muted: '#e0e0e0',
        disabled: '#a0a0a0',
        inverse: '#000000',
      },
      border: {
        default: '#ffffff',
        subtle: '#808080',
        strong: '#ffffff',
        focus: '#00ff00',
      },
    },
  })
}

// Example 10: Export theme for design tools
export function exportThemeForFigma(theme: Theme) {
  const figmaTokens = {
    colors: {},
    spacing: {},
    typography: {},
    shadows: {},
    radii: {},
  }
  
  // Export colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    if (typeof value === 'object' && 'primary' in theme.colors && key in theme.colors.primary) {
      // Color scales
      Object.entries(value).forEach(([shade, color]) => {
        figmaTokens.colors[`${key}/${shade}`] = { value: color }
      })
    } else if (typeof value === 'string') {
      figmaTokens.colors[key] = { value }
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        figmaTokens.colors[`${key}/${subKey}`] = { value: subValue }
      })
    }
  })
  
  // Export other tokens
  Object.entries(theme.spacing).forEach(([key, value]) => {
    figmaTokens.spacing[key] = { value }
  })
  
  Object.entries(theme.radii).forEach(([key, value]) => {
    figmaTokens.radii[key] = { value }
  })
  
  return figmaTokens
}