import { useMemo } from 'react'
import { useTheme } from './useTheme'
import { getCSSVariable } from '../config/theme'

interface ThemeColorOptions {
  /**
   * Opacity value between 0 and 1
   */
  opacity?: number
  /**
   * Whether to return CSS variable reference (e.g., var(--color-primary-500))
   * or the actual hex value
   */
  returnVar?: boolean
}

/**
 * Hook to get theme colors with type safety
 * 
 * @param path - The color path (e.g., 'primary.500', 'text.primary', 'background')
 * @param options - Options for opacity and return format
 * @returns The color value as hex or CSS variable
 * 
 * @example
 * ```tsx
 * const primaryColor = useThemeColor('primary.500')
 * const textColor = useThemeColor('text.primary', { opacity: 0.8 })
 * const bgVar = useThemeColor('background', { returnVar: true })
 * ```
 */
export const useThemeColor = (path: string, options: ThemeColorOptions = {}) => {
  const { getColor } = useTheme()
  const { opacity, returnVar = false } = options

  return useMemo(() => {
    // Try to get the color from theme config
    const color = getColor(path)
    
    if (!color) {
      console.warn(`Theme color not found for path: ${path}`)
      return undefined
    }

    // If returnVar is true, return CSS variable reference
    if (returnVar) {
      const varName = `--color-${path.replace(/\./g, '-')}`
      
      if (opacity !== undefined && opacity >= 0 && opacity <= 1) {
        // Return CSS variable with opacity using modern CSS color syntax
        return `rgb(from var(${varName}) r g b / ${opacity})`
      }
      
      return `var(${varName})`
    }

    // Apply opacity if specified
    if (opacity !== undefined && opacity >= 0 && opacity <= 1) {
      // Convert hex to rgba
      const hex = color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16)
      const g = parseInt(hex.substr(2, 2), 16)
      const b = parseInt(hex.substr(4, 2), 16)
      
      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }

    return color
  }, [path, getColor, opacity, returnVar])
}

/**
 * Hook to get multiple theme colors at once
 * 
 * @param paths - Array of color paths
 * @param options - Options to apply to all colors
 * @returns Object with color paths as keys and color values
 * 
 * @example
 * ```tsx
 * const colors = useThemeColors(['primary.500', 'secondary.600', 'text.primary'])
 * // Returns: { 'primary.500': '#3b82f6', 'secondary.600': '#7c3aed', 'text.primary': '#1f2937' }
 * ```
 */
export const useThemeColors = (paths: string[], options: ThemeColorOptions = {}) => {
  const { getColor } = useTheme()
  const { opacity, returnVar = false } = options

  return useMemo(() => {
    const colors: Record<string, string | undefined> = {}

    paths.forEach(path => {
      const color = getColor(path)
      
      if (!color) {
        console.warn(`Theme color not found for path: ${path}`)
        colors[path] = undefined
        return
      }

      if (returnVar) {
        const varName = `--color-${path.replace(/\./g, '-')}`
        colors[path] = opacity !== undefined && opacity >= 0 && opacity <= 1
          ? `rgb(from var(${varName}) r g b / ${opacity})`
          : `var(${varName})`
      } else if (opacity !== undefined && opacity >= 0 && opacity <= 1) {
        const hex = color.replace('#', '')
        const r = parseInt(hex.substr(0, 2), 16)
        const g = parseInt(hex.substr(2, 2), 16)
        const b = parseInt(hex.substr(4, 2), 16)
        colors[path] = `rgba(${r}, ${g}, ${b}, ${opacity})`
      } else {
        colors[path] = color
      }
    })

    return colors
  }, [paths, getColor, opacity, returnVar])
}

/**
 * Hook to get a dynamic color based on theme
 * Returns different colors for light and dark themes
 * 
 * @param lightPath - Color path for light theme
 * @param darkPath - Color path for dark theme
 * @param options - Options for opacity and return format
 * @returns The appropriate color based on current theme
 * 
 * @example
 * ```tsx
 * const borderColor = useThemeDynamicColor('border.subtle', 'border.strong')
 * ```
 */
export const useThemeDynamicColor = (
  lightPath: string,
  darkPath: string,
  options: ThemeColorOptions = {}
) => {
  const { theme } = useTheme()
  const path = theme === 'dark' ? darkPath : lightPath
  
  return useThemeColor(path, options)
}