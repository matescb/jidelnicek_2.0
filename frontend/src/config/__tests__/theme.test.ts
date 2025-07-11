import {
  themes,
  validateTheme,
  createCustomTheme,
  applyThemeToCSSVariables,
  Theme,
  ThemeName,
  ColorScale
} from '../theme'

describe('Theme Configuration', () => {
  describe('Default Themes', () => {
    it('should have light and dark themes', () => {
      expect(themes.light).toBeDefined()
      expect(themes.dark).toBeDefined()
    })

    it('should have valid structure for light theme', () => {
      const { light } = themes
      
      expect(light.name).toBe('Light')
      expect(light.colors).toBeDefined()
      expect(light.colors.primary).toBeDefined()
      expect(light.colors.background).toBeDefined()
      expect(light.colors.text).toBeDefined()
      expect(light.typography).toBeDefined()
      expect(light.spacing).toBeDefined()
      expect(light.borderRadius).toBeDefined()
      expect(light.shadows).toBeDefined()
    })

    it('should have valid structure for dark theme', () => {
      const { dark } = themes
      
      expect(dark.name).toBe('Dark')
      expect(dark.colors).toBeDefined()
      expect(dark.colors.primary).toBeDefined()
      expect(dark.colors.background).toBeDefined()
      expect(dark.colors.text).toBeDefined()
    })

    it('should have all required color scales', () => {
      const requiredScales = ['primary', 'secondary', 'success', 'warning', 'error', 'info']
      
      Object.values(themes).forEach(theme => {
        requiredScales.forEach(scale => {
          expect(theme.colors[scale as keyof typeof theme.colors]).toBeDefined()
        })
      })
    })

    it('should have proper color scale structure', () => {
      const colorScale = themes.light.colors.primary as ColorScale
      const expectedShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
      
      expectedShades.forEach(shade => {
        expect(colorScale[shade as keyof ColorScale]).toBeDefined()
        expect(colorScale[shade as keyof ColorScale]).toMatch(/^#[0-9a-fA-F]{6}$/)
      })
    })
  })

  describe('Theme Validation', () => {
    it('should validate a correct theme', () => {
      const validTheme = {
        name: 'Valid',
        colors: {
          primary: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          secondary: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          success: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          warning: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          error: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          info: { 50: '#fff', 100: '#eee', 200: '#ddd', 300: '#ccc', 400: '#bbb', 500: '#aaa', 600: '#999', 700: '#888', 800: '#777', 900: '#666' },
          background: '#fff',
          surface: '#f5f5f5',
          surfaceElevated: '#fff',
          card: '#fff',
          popover: '#fff',
          modal: '#fff',
          text: {
            primary: '#000',
            secondary: '#666',
            muted: '#999',
            disabled: '#ccc',
            inverse: '#fff'
          },
          border: {
            default: '#ddd',
            subtle: '#eee',
            strong: '#999'
          }
        },
        typography: {
          fontFamily: {
            sans: 'Arial, sans-serif',
            mono: 'monospace'
          }
        },
        spacing: {
          unit: 4,
          containerPadding: '1rem'
        },
        borderRadius: {
          sm: '0.25rem',
          md: '0.375rem',
          lg: '0.5rem',
          xl: '0.75rem',
          full: '9999px'
        },
        shadows: {
          sm: 'none',
          md: 'none',
          lg: 'none',
          xl: 'none'
        }
      }
      
      expect(validateTheme(validTheme)).toBe(true)
    })

    it('should reject theme without name', () => {
      const invalidTheme = {
        colors: themes.light.colors,
        typography: themes.light.typography,
        spacing: themes.light.spacing,
        borderRadius: themes.light.borderRadius,
        shadows: themes.light.shadows
      } as any
      
      expect(validateTheme(invalidTheme)).toBe(false)
    })

    it('should reject theme with missing color scales', () => {
      const invalidTheme = {
        ...themes.light,
        colors: {
          ...themes.light.colors,
          primary: undefined
        }
      } as any
      
      expect(validateTheme(invalidTheme)).toBe(false)
    })

    it('should reject theme with invalid color scale structure', () => {
      const invalidTheme = {
        ...themes.light,
        colors: {
          ...themes.light.colors,
          primary: '#fff' // Should be a scale object, not a string
        }
      } as any
      
      expect(validateTheme(invalidTheme)).toBe(false)
    })

    it('should reject theme with missing text colors', () => {
      const invalidTheme = {
        ...themes.light,
        colors: {
          ...themes.light.colors,
          text: {
            primary: '#000'
            // Missing other required text colors
          }
        }
      } as any
      
      expect(validateTheme(invalidTheme)).toBe(false)
    })
  })

  describe('Custom Theme Creation', () => {
    it('should create a custom theme with defaults', () => {
      const customTheme = createCustomTheme('Custom', {
        colors: {
          primary: { 50: '#e3f2fd', 100: '#bbdefb', 200: '#90caf9', 300: '#64b5f6', 400: '#42a5f5', 500: '#2196f3', 600: '#1e88e5', 700: '#1976d2', 800: '#1565c0', 900: '#0d47a1' }
        }
      })
      
      expect(customTheme.name).toBe('Custom')
      expect(customTheme.colors.primary).toBeDefined()
      expect(customTheme.colors.secondary).toBeDefined() // Should use defaults
      expect(customTheme.typography).toBeDefined()
      expect(customTheme.spacing).toBeDefined()
    })

    it('should merge custom properties with defaults', () => {
      const customTheme = createCustomTheme('Custom', {
        colors: {
          background: '#f0f0f0'
        },
        typography: {
          fontFamily: {
            sans: 'Roboto, sans-serif'
          }
        }
      })
      
      expect(customTheme.colors.background).toBe('#f0f0f0')
      expect(customTheme.colors.primary).toBeDefined() // From defaults
      expect(customTheme.typography.fontFamily.sans).toBe('Roboto, sans-serif')
      expect(customTheme.typography.fontFamily.mono).toBeDefined() // From defaults
    })

    it('should validate created custom themes', () => {
      const customTheme = createCustomTheme('Custom', {
        colors: {
          primary: { 50: '#e3f2fd', 100: '#bbdefb', 200: '#90caf9', 300: '#64b5f6', 400: '#42a5f5', 500: '#2196f3', 600: '#1e88e5', 700: '#1976d2', 800: '#1565c0', 900: '#0d47a1' }
        }
      })
      
      expect(validateTheme(customTheme)).toBe(true)
    })
  })

  describe('CSS Variable Application', () => {
    beforeEach(() => {
      // Clear any existing CSS variables
      const style = document.documentElement.style
      const props = Array.from(style).filter(prop => prop.startsWith('--'))
      props.forEach(prop => style.removeProperty(prop))
    })

    it('should apply theme colors as CSS variables', () => {
      applyThemeToCSSVariables(themes.light)
      
      const style = document.documentElement.style
      
      // Check primary colors
      expect(style.getPropertyValue('--color-primary-50')).toBe('#e3f2fd')
      expect(style.getPropertyValue('--color-primary-500')).toBe('#2196f3')
      
      // Check background colors
      expect(style.getPropertyValue('--color-background')).toBe('#ffffff')
      expect(style.getPropertyValue('--color-surface')).toBe('#f5f5f5')
      
      // Check text colors
      expect(style.getPropertyValue('--color-text-primary')).toBe('#1a1a1a')
      expect(style.getPropertyValue('--color-text-secondary')).toBe('#666666')
    })

    it('should apply theme spacing as CSS variables', () => {
      applyThemeToCSSVariables(themes.light)
      
      const style = document.documentElement.style
      
      expect(style.getPropertyValue('--spacing-unit')).toBe('4')
      expect(style.getPropertyValue('--spacing-container-padding')).toBe('1rem')
    })

    it('should apply theme typography as CSS variables', () => {
      applyThemeToCSSVariables(themes.light)
      
      const style = document.documentElement.style
      
      expect(style.getPropertyValue('--font-family-sans')).toBe(themes.light.typography.fontFamily.sans)
      expect(style.getPropertyValue('--font-family-mono')).toBe(themes.light.typography.fontFamily.mono)
    })

    it('should apply theme border radius as CSS variables', () => {
      applyThemeToCSSVariables(themes.light)
      
      const style = document.documentElement.style
      
      expect(style.getPropertyValue('--border-radius-sm')).toBe('0.25rem')
      expect(style.getPropertyValue('--border-radius-md')).toBe('0.375rem')
      expect(style.getPropertyValue('--border-radius-lg')).toBe('0.5rem')
      expect(style.getPropertyValue('--border-radius-xl')).toBe('0.75rem')
      expect(style.getPropertyValue('--border-radius-full')).toBe('9999px')
    })

    it('should apply theme shadows as CSS variables', () => {
      applyThemeToCSSVariables(themes.light)
      
      const style = document.documentElement.style
      
      expect(style.getPropertyValue('--shadow-sm')).toBeDefined()
      expect(style.getPropertyValue('--shadow-md')).toBeDefined()
      expect(style.getPropertyValue('--shadow-lg')).toBeDefined()
      expect(style.getPropertyValue('--shadow-xl')).toBeDefined()
    })

    it('should handle nested color properties', () => {
      applyThemeToCSSVariables(themes.light)
      
      const style = document.documentElement.style
      
      // Border colors
      expect(style.getPropertyValue('--color-border-default')).toBe('#e0e0e0')
      expect(style.getPropertyValue('--color-border-subtle')).toBe('#f0f0f0')
      expect(style.getPropertyValue('--color-border-strong')).toBe('#999999')
    })

    it('should update CSS variables when switching themes', () => {
      // Apply light theme
      applyThemeToCSSVariables(themes.light)
      
      let style = document.documentElement.style
      const lightBackground = style.getPropertyValue('--color-background')
      
      // Apply dark theme
      applyThemeToCSSVariables(themes.dark)
      
      style = document.documentElement.style
      const darkBackground = style.getPropertyValue('--color-background')
      
      expect(lightBackground).not.toBe(darkBackground)
      expect(darkBackground).toBe('#0a0a0a')
    })
  })

  describe('Theme Type Safety', () => {
    it('should enforce ThemeName type', () => {
      const validThemeNames: ThemeName[] = ['light', 'dark']
      
      validThemeNames.forEach(name => {
        expect(themes[name]).toBeDefined()
      })
    })

    it('should have consistent theme structure', () => {
      const themeKeys = Object.keys(themes.light)
      
      Object.values(themes).forEach(theme => {
        expect(Object.keys(theme)).toEqual(themeKeys)
      })
    })
  })
})