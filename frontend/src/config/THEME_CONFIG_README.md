# Theme Configuration System

This directory contains the comprehensive theme configuration system for the Jidelnicek application.

## Overview

The theme configuration system provides:
- Type-safe theme structure with full TypeScript support
- Color palette definitions for light and dark themes
- Helper functions for theme manipulation and accessibility
- Support for custom theme extensions
- Seamless integration with CSS variables and Tailwind CSS

## Files

- `theme.ts` - Main theme configuration file with all theme definitions and utilities
- `index.ts` - Central export point for all configuration modules
- `theme.example.ts` - Usage examples demonstrating various theme features

## Features

### 1. Type-Safe Theme Structure

The theme system uses TypeScript interfaces to ensure type safety:

```typescript
interface Theme {
  name: string
  colors: ThemeColors
  spacing: ThemeSpacing
  radii: ThemeRadii
  shadows: ThemeShadows
  typography: ThemeTypography
  transitions: TransitionConfig
}
```

### 2. Color System

Each theme includes comprehensive color scales:

- **Primary, Secondary** - Brand colors with 11 shades (50-950)
- **Semantic Colors** - Success, Warning, Error, Info (10 shades each)
- **Surface Colors** - Background, surface, card, popover, modal
- **Text Colors** - Primary, secondary, muted, disabled, inverse
- **Border Colors** - Default, subtle, strong, focus
- **Input Colors** - Background, border, hover, focus states

### 3. Helper Functions

#### Color Manipulation
```typescript
// Get a color value from theme
getThemeColor(theme, 'primary.500') // '#6366f1'

// Generate color variations
generateColorVariation('#6366f1', 'lighter', 0.2)
generateColorVariation('#6366f1', 'darker', 0.1)
```

#### Accessibility
```typescript
// Check contrast ratio
getContrastRatio('#0f172a', '#ffffff') // 13.1

// Validate WCAG standards
meetsContrastStandard('#0f172a', '#ffffff', 'AA') // true
meetsContrastStandard('#64748b', '#ffffff', 'AAA', true) // false
```

#### Theme Management
```typescript
// Apply theme to CSS variables
applyThemeToCSSVariables(lightTheme)

// Create custom theme
const customTheme = createCustomTheme(lightTheme, {
  name: 'brand',
  colors: { /* custom colors */ }
})

// Validate theme structure
validateTheme(customTheme) // true/false
```

### 4. CSS Variable Integration

The theme system automatically generates CSS variables:

```css
:root {
  --color-primary-500: #6366f1;
  --color-text-primary: #0f172a;
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  /* ... and many more */
}
```

### 5. React Integration

Use with the enhanced ThemeContext and useTheme hook:

```typescript
const MyComponent = () => {
  const { 
    theme,              // Current theme name
    themeConfig,        // Full theme configuration
    colors,             // Quick access to colors
    spacing,            // Quick access to spacing
    getColor,           // Helper to get color by path
    generateVariation,  // Generate color variations
    checkContrast,      // Check contrast ratios
  } = useTheme()

  return (
    <div style={{ 
      backgroundColor: colors.surface,
      padding: spacing[4],
      color: getColor('text.primary')
    }}>
      Content
    </div>
  )
}
```

## Usage Examples

### Basic Usage

```typescript
import { lightTheme, darkTheme, themes } from '@/config/theme'

// Access theme values
const primaryColor = lightTheme.colors.primary[500]
const spacing = lightTheme.spacing[4]
```

### Creating a Custom Theme

```typescript
import { createCustomTheme, lightTheme } from '@/config/theme'

const brandTheme = createCustomTheme(lightTheme, {
  name: 'brand',
  colors: {
    ...lightTheme.colors,
    primary: {
      // Custom primary color scale
      50: '#fef3e2',
      // ... other shades
      500: '#f69b0a', // Brand orange
      // ... more shades
    }
  }
})
```

### Using in Components

```typescript
import { useTheme } from '@/hooks/useTheme'

const Button = ({ children }) => {
  const { colors, radii, spacing, transitions } = useTheme()
  
  return (
    <button
      style={{
        backgroundColor: colors.primary[600],
        color: colors.text.inverse,
        padding: `${spacing[2]} ${spacing[4]}`,
        borderRadius: radii.md,
        transition: `all ${transitions.duration.base} ${transitions.easing.easeInOut}`,
      }}
    >
      {children}
    </button>
  )
}
```

### Checking Accessibility

```typescript
import { getContrastRatio, meetsContrastStandard } from '@/config/theme'

const checkButtonAccessibility = (bgColor: string, textColor: string) => {
  const ratio = getContrastRatio(textColor, bgColor)
  const meetsAA = meetsContrastStandard(textColor, bgColor, 'AA')
  const meetsAAA = meetsContrastStandard(textColor, bgColor, 'AAA')
  
  console.log({
    ratio: ratio.toFixed(2),
    meetsAA,
    meetsAAA,
    recommendation: meetsAA ? 'Accessible' : 'Needs improvement'
  })
}
```

## Extending the System

### Adding New Color Scales

To add a new color scale, update the theme configuration:

```typescript
const customTheme = createCustomTheme(baseTheme, {
  colors: {
    ...baseTheme.colors,
    accent: {
      50: '#fff1f2',
      100: '#ffe4e6',
      // ... more shades
      500: '#f43f5e',
      // ... more shades
      900: '#881337',
    }
  }
})
```

### Adding New Theme Properties

Extend the Theme interface and add your properties:

```typescript
interface ExtendedTheme extends Theme {
  animations: {
    fadeIn: string
    slideUp: string
  }
}
```

## Best Practices

1. **Use semantic color names** - Prefer `colors.text.primary` over `colors.secondary[900]`
2. **Check contrast ratios** - Always validate text/background combinations for accessibility
3. **Use theme values** - Avoid hardcoding colors, spacing, etc.
4. **Test in both themes** - Ensure your components work in light and dark modes
5. **Leverage CSS variables** - They update automatically when theme changes

## Migration Guide

If migrating from inline styles or hardcoded values:

1. Replace hardcoded colors with theme colors
2. Replace pixel values with spacing scale
3. Use theme shadows instead of custom box-shadows
4. Apply theme radii for consistent border radius
5. Use theme transitions for animations

## Future Enhancements

Planned features for the theme system:

1. Color mode preference detection and sync
2. Theme builder UI for creating custom themes
3. Export themes to design tools (Figma, Sketch)
4. Runtime theme switching with smooth transitions
5. Theme marketplace for sharing custom themes

## Support

For questions or issues with the theme system, please refer to the examples in `theme.example.ts` or consult the type definitions in `theme.ts`.