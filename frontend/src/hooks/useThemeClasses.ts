import { useMemo } from 'react'
import { useTheme } from './useTheme'

type ClassValue = string | number | boolean | undefined | null
type ClassObject = Record<string, boolean | undefined>
type ClassArray = ClassValue[]
type ClassInput = ClassValue | ClassObject | ClassArray

interface ThemeClassOptions {
  /**
   * Prefix for theme-specific classes
   * @default 'theme'
   */
  prefix?: string
  /**
   * Separator between prefix and theme name
   * @default '-'
   */
  separator?: string
}

/**
 * Utility to merge class names (simplified clsx/classnames implementation)
 */
function cx(...inputs: ClassInput[]): string {
  const classes: string[] = []
  
  for (const input of inputs) {
    if (!input) continue
    
    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input))
    } else if (Array.isArray(input)) {
      const result = cx(...input)
      if (result) classes.push(result)
    } else if (typeof input === 'object') {
      for (const key in input) {
        if (input[key]) classes.push(key)
      }
    }
  }
  
  return classes.filter(Boolean).join(' ')
}

/**
 * Hook to generate theme-aware class names
 * Helps create classes that adapt to the current theme
 * 
 * @param options - Configuration options
 * @returns Utility functions for theme-aware classes
 * 
 * @example
 * ```tsx
 * const { themeClass, conditionalClass, mergeClasses } = useThemeClasses()
 * 
 * <div className={mergeClasses(
 *   'base-class',
 *   themeClass('special'), // 'theme-light-special' or 'theme-dark-special'
 *   conditionalClass(isActive, 'active', 'inactive')
 * )}>
 * ```
 */
export const useThemeClasses = (options: ThemeClassOptions = {}) => {
  const { theme } = useTheme()
  const { prefix = 'theme', separator = '-' } = options

  /**
   * Generate a theme-specific class name
   */
  const themeClass = useMemo(() => {
    return (className: string) => {
      return `${prefix}${separator}${theme}${separator}${className}`
    }
  }, [theme, prefix, separator])

  /**
   * Generate theme-specific classes with variants
   */
  const themeClasses = useMemo(() => {
    return (...classNames: string[]) => {
      return classNames.map(className => themeClass(className)).join(' ')
    }
  }, [themeClass])

  /**
   * Generate conditional classes based on theme
   */
  const conditionalClass = useMemo(() => {
    return (
      condition: boolean | undefined | null,
      trueClass: string,
      falseClass?: string
    ) => {
      if (condition) {
        return trueClass
      }
      return falseClass || ''
    }
  }, [])

  /**
   * Generate theme-variant classes
   */
  const themeVariant = useMemo(() => {
    return (variants: Record<string, string>) => {
      return variants[theme] || variants.default || ''
    }
  }, [theme])

  /**
   * Merge multiple class values with theme awareness
   */
  const mergeClasses = useMemo(() => {
    return (...inputs: ClassInput[]) => cx(...inputs)
  }, [])

  /**
   * Generate component-specific theme classes
   */
  const componentClasses = useMemo(() => {
    return (componentName: string, modifiers: Record<string, boolean> = {}) => {
      const baseClass = `${componentName}`
      const themeSpecificClass = `${componentName}${separator}${theme}`
      
      const modifierClasses = Object.entries(modifiers)
        .filter(([_, isActive]) => isActive)
        .map(([modifier]) => `${componentName}${separator}${modifier}`)
      
      return cx(baseClass, themeSpecificClass, ...modifierClasses)
    }
  }, [theme, separator])

  return {
    /**
     * Current theme name
     */
    theme,
    /**
     * Generate a single theme-specific class
     */
    themeClass,
    /**
     * Generate multiple theme-specific classes
     */
    themeClasses,
    /**
     * Conditionally apply a class
     */
    conditionalClass,
    /**
     * Select a class based on theme variant
     */
    themeVariant,
    /**
     * Merge multiple class inputs
     */
    mergeClasses,
    /**
     * Generate BEM-style component classes with theme
     */
    componentClasses,
    /**
     * The cx utility for general class merging
     */
    cx
  }
}

/**
 * Hook to create a theme-aware class name builder for a specific component
 * 
 * @param componentName - Base name of the component
 * @param options - Configuration options
 * @returns Class builder functions for the component
 * 
 * @example
 * ```tsx
 * const classes = useComponentThemeClasses('button')
 * 
 * <button className={classes.root({ primary: true, large: size === 'large' })}>
 *   <span className={classes.element('icon')}>🎯</span>
 *   <span className={classes.element('text', { emphasized: true })}>Click me</span>
 * </button>
 * ```
 */
export const useComponentThemeClasses = (
  componentName: string,
  options: ThemeClassOptions = {}
) => {
  const { theme } = useTheme()
  const { separator = '-' } = options

  return useMemo(() => {
    const root = (modifiers: Record<string, boolean | undefined> = {}) => {
      const baseClass = componentName
      const themeClass = `${componentName}${separator}${theme}`
      
      const modifierClasses = Object.entries(modifiers)
        .filter(([_, isActive]) => isActive)
        .map(([modifier]) => `${componentName}${separator}${modifier}`)
      
      return cx(baseClass, themeClass, ...modifierClasses)
    }

    const element = (
      elementName: string,
      modifiers: Record<string, boolean | undefined> = {}
    ) => {
      const baseClass = `${componentName}__${elementName}`
      const themeClass = `${componentName}__${elementName}${separator}${theme}`
      
      const modifierClasses = Object.entries(modifiers)
        .filter(([_, isActive]) => isActive)
        .map(([modifier]) => `${componentName}__${elementName}${separator}${modifier}`)
      
      return cx(baseClass, themeClass, ...modifierClasses)
    }

    const modifier = (modifierName: string) => {
      return `${componentName}${separator}${modifierName}`
    }

    return {
      root,
      element,
      modifier,
      /**
       * Get the base component name
       */
      base: componentName,
      /**
       * Get the current theme
       */
      theme
    }
  }, [componentName, theme, separator])
}

/**
 * Create theme-aware CSS module classes
 * 
 * @param styles - CSS module styles object
 * @returns Enhanced styles with theme utilities
 * 
 * @example
 * ```tsx
 * import styles from './Component.module.css'
 * 
 * const Component = () => {
 *   const s = useThemeStyles(styles)
 *   
 *   return (
 *     <div className={s.theme('container')}>
 *       <h1 className={s.conditional(isLarge, 'titleLarge', 'title')}>
 *         Hello
 *       </h1>
 *     </div>
 *   )
 * }
 * ```
 */
export const useThemeStyles = <T extends Record<string, string>>(styles: T) => {
  const { theme } = useTheme()
  
  return useMemo(() => {
    return {
      ...styles,
      /**
       * Get a theme-specific style if it exists
       */
      theme: (baseKey: string) => {
        const themeKey = `${baseKey}_${theme}`
        return styles[themeKey] || styles[baseKey] || ''
      },
      /**
       * Conditionally apply styles
       */
      conditional: (
        condition: boolean | undefined | null,
        trueKey: keyof T,
        falseKey?: keyof T
      ) => {
        if (condition) {
          return styles[trueKey] || ''
        }
        return falseKey ? styles[falseKey] || '' : ''
      },
      /**
       * Merge multiple style keys
       */
      merge: (...keys: (keyof T | undefined | null | false)[]) => {
        return keys
          .filter(Boolean)
          .map(key => styles[key!])
          .filter(Boolean)
          .join(' ')
      }
    }
  }, [styles, theme])
}