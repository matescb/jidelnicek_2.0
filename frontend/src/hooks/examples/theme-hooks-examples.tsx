/**
 * Examples demonstrating the usage of theme-aware utility hooks
 * This file shows best practices for using the theme hooks in components
 */

import React from 'react'
import {
  useThemeColor,
  useThemeColors,
  useThemeDynamicColor,
  useColorScheme,
  useThemeTransition,
  useThemeTransitionStyles,
  useContrastChecker,
  useAutoContrastCheck,
  useThemeClasses,
  useComponentThemeClasses,
  useThemeStyles
} from '../index'

/**
 * Example 1: Using useThemeColor for dynamic theme colors
 */
export const ThemeColorExample: React.FC = () => {
  // Get single colors
  const primaryColor = useThemeColor('primary.500')
  const bgColor = useThemeColor('background')
  const textColorWithOpacity = useThemeColor('text.primary', { opacity: 0.8 })
  const primaryVar = useThemeColor('primary.500', { returnVar: true })

  // Get multiple colors at once
  const colors = useThemeColors(['primary.500', 'secondary.600', 'text.primary'])

  // Get dynamic color based on theme
  const borderColor = useThemeDynamicColor('border.subtle', 'border.strong')

  return (
    <div style={{ backgroundColor: bgColor }}>
      <h1 style={{ color: primaryColor }}>Theme Colors</h1>
      <p style={{ color: textColorWithOpacity }}>Text with opacity</p>
      <div 
        style={{ 
          border: `2px solid ${borderColor}`,
          backgroundColor: primaryVar // Uses CSS variable
        }}
      >
        <p>Primary: {colors['primary.500']}</p>
        <p>Secondary: {colors['secondary.600']}</p>
      </div>
    </div>
  )
}

/**
 * Example 2: Color scheme management with system detection
 */
export const ColorSchemeExample: React.FC = () => {
  const {
    colorScheme,
    preference,
    systemColorScheme,
    setPreference,
    toggle,
    isUsingSystem
  } = useColorScheme()

  return (
    <div className="color-scheme-demo">
      <h2>Color Scheme Settings</h2>
      <p>Current scheme: {colorScheme}</p>
      <p>System preference: {systemColorScheme}</p>
      <p>User preference: {preference}</p>
      
      <div>
        <label>
          <input
            type="radio"
            name="scheme"
            value="system"
            checked={preference === 'system'}
            onChange={(e) => setPreference('system')}
          />
          System ({systemColorScheme})
        </label>
        <label>
          <input
            type="radio"
            name="scheme"
            value="light"
            checked={preference === 'light'}
            onChange={(e) => setPreference('light')}
          />
          Light
        </label>
        <label>
          <input
            type="radio"
            name="scheme"
            value="dark"
            checked={preference === 'dark'}
            onChange={(e) => setPreference('dark')}
          />
          Dark
        </label>
      </div>
      
      <button onClick={toggle}>
        Quick Toggle (currently: {colorScheme})
      </button>
    </div>
  )
}

/**
 * Example 3: Theme transitions without flashing
 */
export const ThemeTransitionExample: React.FC = () => {
  const { executeTransition } = useThemeTransition({
    duration: 100,
    onTransitionStart: () => console.log('Theme transition started'),
    onTransitionEnd: () => console.log('Theme transition ended')
  })

  // Add transition styles to document
  useThemeTransitionStyles()

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    executeTransition(() => {
      // Your theme change logic here
      console.log(`Changing to ${newTheme} theme`)
    })
  }

  return (
    <div>
      <h2>Smooth Theme Transitions</h2>
      <button onClick={() => handleThemeChange('light')}>
        Switch to Light
      </button>
      <button onClick={() => handleThemeChange('dark')}>
        Switch to Dark
      </button>
    </div>
  )
}

/**
 * Example 4: Contrast checking for accessibility
 */
export const ContrastCheckerExample: React.FC = () => {
  const { checkContrast, getSuggestions, checkThemeContrast, findBestContrast } = useContrastChecker()
  
  // Check specific colors
  const result = checkContrast('#3b82f6', '#ffffff')
  
  // Check theme colors
  const themeResult = checkThemeContrast('primary.500', 'background')
  
  // Auto-check with hook
  const autoResult = useAutoContrastCheck('text.primary', 'surface', 'normal')

  // Get suggestions for poor contrast
  const suggestions = getSuggestions('#ffcc00', '#ffffff', 'AA', 'normal')

  // Find best contrasting color
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
  const bestColor = findBestContrast(colors, '#ffffff', 'AA', 'normal')

  return (
    <div>
      <h2>Contrast Checking</h2>
      
      <div>
        <h3>Manual Check</h3>
        <p>Ratio: {result.ratio.toFixed(2)}</p>
        <p>Rating: {result.rating}</p>
        <p>Accessible: {result.isAccessible ? 'Yes' : 'No'}</p>
      </div>

      <div>
        <h3>Theme Colors Check</h3>
        <p>Primary on Background: {themeResult.rating}</p>
        <p>Text on Surface: {autoResult.rating}</p>
      </div>

      {suggestions.length > 0 && (
        <div>
          <h3>Contrast Suggestions</h3>
          {suggestions.map((suggestion, i) => (
            <div key={i}>
              <div 
                style={{ 
                  backgroundColor: suggestion.color,
                  width: 50,
                  height: 50,
                  display: 'inline-block'
                }}
              />
              <p>
                {suggestion.adjustment} by {suggestion.adjustmentAmount * 100}%
                (ratio: {suggestion.ratio.toFixed(2)})
              </p>
            </div>
          ))}
        </div>
      )}

      <p>Best contrasting color: {bestColor}</p>
    </div>
  )
}

/**
 * Example 5: Theme-aware class names
 */
export const ThemeClassesExample: React.FC = () => {
  const {
    themeClass,
    themeClasses,
    conditionalClass,
    themeVariant,
    mergeClasses,
    componentClasses
  } = useThemeClasses()

  const isActive = true
  const size = 'large'

  return (
    <div className={mergeClasses(
      'base-container',
      themeClass('container'), // 'theme-light-container' or 'theme-dark-container'
      conditionalClass(isActive, 'active', 'inactive'),
      componentClasses('card', { elevated: true, rounded: true })
    )}>
      <h2 className={themeClasses('title', 'responsive')}>
        Theme Classes Example
      </h2>
      
      <button className={themeVariant({
        light: 'btn-light',
        dark: 'btn-dark',
        default: 'btn-default'
      })}>
        Theme Variant Button
      </button>
    </div>
  )
}

/**
 * Example 6: Component-specific theme classes (BEM-style)
 */
export const ComponentThemeClassesExample: React.FC = () => {
  const classes = useComponentThemeClasses('recipe-card')
  const [isFavorite, setIsFavorite] = React.useState(false)

  return (
    <article className={classes.root({ 
      featured: true, 
      favorite: isFavorite 
    })}>
      <header className={classes.element('header')}>
        <h3 className={classes.element('title', { large: true })}>
          Delicious Recipe
        </h3>
      </header>
      
      <div className={classes.element('content')}>
        <p>Recipe content here...</p>
      </div>
      
      <button 
        className={classes.modifier('action-button')}
        onClick={() => setIsFavorite(!isFavorite)}
      >
        {isFavorite ? '❤️' : '🤍'} Favorite
      </button>
    </article>
  )
}

/**
 * Example 7: CSS Modules with theme support
 */
// Assuming you have a CSS module file
const mockStyles = {
  container: 'Component_container__abc123',
  container_dark: 'Component_container_dark__def456',
  title: 'Component_title__ghi789',
  titleLarge: 'Component_titleLarge__jkl012',
  button: 'Component_button__mno345'
}

export const ThemeStylesExample: React.FC = () => {
  const s = useThemeStyles(mockStyles)
  const isLarge = true

  return (
    <div className={s.theme('container')}>
      <h1 className={s.conditional(isLarge, 'titleLarge', 'title')}>
        CSS Modules with Theme
      </h1>
      <button className={s.merge('button', s.theme('button'))}>
        Themed Button
      </button>
    </div>
  )
}

/**
 * Example 8: Complete theme-aware component
 */
export const CompleteThemeComponent: React.FC = () => {
  // Color scheme management
  const { colorScheme, toggle } = useColorScheme()
  
  // Theme colors
  const bgColor = useThemeColor('surface', { returnVar: true })
  const textColor = useThemeColor('text.primary')
  const accentColor = useThemeColor('primary.500')
  
  // Contrast checking
  const { checkThemeContrast } = useContrastChecker()
  const contrast = checkThemeContrast('text.primary', 'surface')
  
  // Theme classes
  const classes = useComponentThemeClasses('theme-demo')
  
  // Theme transitions
  const { executeTransition } = useThemeTransition()

  const handleThemeToggle = () => {
    executeTransition(() => {
      toggle()
    })
  }

  return (
    <div 
      className={classes.root({ 
        accessible: contrast.meetsAA 
      })}
      style={{ 
        backgroundColor: bgColor,
        color: textColor 
      }}
    >
      <header className={classes.element('header')}>
        <h1 style={{ color: accentColor }}>
          Complete Theme Integration
        </h1>
        <button 
          onClick={handleThemeToggle}
          className={classes.element('toggle-button')}
        >
          Current theme: {colorScheme}
        </button>
      </header>
      
      <main className={classes.element('content')}>
        <p>
          This component demonstrates all theme hooks working together.
          Contrast ratio: {contrast.ratio.toFixed(2)} ({contrast.rating})
        </p>
      </main>
    </div>
  )
}

// Export all examples
export default {
  ThemeColorExample,
  ColorSchemeExample,
  ThemeTransitionExample,
  ContrastCheckerExample,
  ThemeClassesExample,
  ComponentThemeClassesExample,
  ThemeStylesExample,
  CompleteThemeComponent
}