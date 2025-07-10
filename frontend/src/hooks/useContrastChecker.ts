import { useMemo, useCallback } from 'react'
import { useTheme } from './useTheme'
import { getContrastRatio, meetsContrastStandard } from '../config/theme'

export type ContrastStandard = 'AA' | 'AAA'
export type TextSize = 'normal' | 'large'

interface ContrastResult {
  /**
   * The contrast ratio between the two colors
   */
  ratio: number
  /**
   * Whether the contrast meets WCAG AA standard
   */
  meetsAA: boolean
  /**
   * Whether the contrast meets WCAG AAA standard
   */
  meetsAAA: boolean
  /**
   * Human-readable rating
   */
  rating: 'fail' | 'AA' | 'AAA'
  /**
   * Whether the contrast is sufficient for the given context
   */
  isAccessible: boolean
}

interface ContrastSuggestion {
  /**
   * Suggested color value
   */
  color: string
  /**
   * The contrast ratio with this color
   */
  ratio: number
  /**
   * The adjustment made (lighter or darker)
   */
  adjustment: 'lighter' | 'darker'
  /**
   * The amount of adjustment (0-1)
   */
  adjustmentAmount: number
}

interface UseContrastCheckerReturn {
  /**
   * Check contrast between two colors
   */
  checkContrast: (foreground: string, background: string, textSize?: TextSize) => ContrastResult
  /**
   * Get contrast suggestions if current contrast is poor
   */
  getSuggestions: (
    foreground: string,
    background: string,
    standard?: ContrastStandard,
    textSize?: TextSize
  ) => ContrastSuggestion[]
  /**
   * Check contrast using theme color paths
   */
  checkThemeContrast: (foregroundPath: string, backgroundPath: string, textSize?: TextSize) => ContrastResult
  /**
   * Find the best contrasting color from a list
   */
  findBestContrast: (
    colors: string[],
    background: string,
    standard?: ContrastStandard,
    textSize?: TextSize
  ) => string | null
}

/**
 * Hook to check color contrast for accessibility
 * Provides WCAG compliance checking and suggestions
 * 
 * @returns Object with contrast checking utilities
 * 
 * @example
 * ```tsx
 * const { checkContrast, getSuggestions } = useContrastChecker()
 * 
 * const result = checkContrast('#3b82f6', '#ffffff')
 * if (!result.meetsAA) {
 *   const suggestions = getSuggestions('#3b82f6', '#ffffff')
 *   // Use suggestions[0].color for better contrast
 * }
 * ```
 */
export const useContrastChecker = (): UseContrastCheckerReturn => {
  const { getColor, generateVariation } = useTheme()

  const checkContrast = useCallback((
    foreground: string,
    background: string,
    textSize: TextSize = 'normal'
  ): ContrastResult => {
    const ratio = getContrastRatio(foreground, background)
    const isLargeText = textSize === 'large'
    
    const meetsAA = meetsContrastStandard(foreground, background, 'AA', isLargeText)
    const meetsAAA = meetsContrastStandard(foreground, background, 'AAA', isLargeText)
    
    let rating: 'fail' | 'AA' | 'AAA' = 'fail'
    if (meetsAAA) rating = 'AAA'
    else if (meetsAA) rating = 'AA'
    
    return {
      ratio,
      meetsAA,
      meetsAAA,
      rating,
      isAccessible: meetsAA
    }
  }, [])

  const getSuggestions = useCallback((
    foreground: string,
    background: string,
    standard: ContrastStandard = 'AA',
    textSize: TextSize = 'normal'
  ): ContrastSuggestion[] => {
    const currentRatio = getContrastRatio(foreground, background)
    const isLargeText = textSize === 'large'
    const targetRatio = standard === 'AA' 
      ? (isLargeText ? 3 : 4.5)
      : (isLargeText ? 4.5 : 7)
    
    // If contrast already meets standard, return empty array
    if (currentRatio >= targetRatio) {
      return []
    }
    
    const suggestions: ContrastSuggestion[] = []
    
    // Try making the foreground lighter/darker
    const adjustments = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    
    for (const amount of adjustments) {
      // Try lighter
      const lighter = generateVariation(foreground, 'lighter', amount)
      const lighterRatio = getContrastRatio(lighter, background)
      
      if (lighterRatio >= targetRatio) {
        suggestions.push({
          color: lighter,
          ratio: lighterRatio,
          adjustment: 'lighter',
          adjustmentAmount: amount
        })
        break // Found a solution
      }
      
      // Try darker
      const darker = generateVariation(foreground, 'darker', amount)
      const darkerRatio = getContrastRatio(darker, background)
      
      if (darkerRatio >= targetRatio) {
        suggestions.push({
          color: darker,
          ratio: darkerRatio,
          adjustment: 'darker',
          adjustmentAmount: amount
        })
        break // Found a solution
      }
    }
    
    // If no perfect solution found, return the best attempts
    if (suggestions.length === 0) {
      const maxLighter = generateVariation(foreground, 'lighter', 0.9)
      const maxDarker = generateVariation(foreground, 'darker', 0.9)
      const lighterRatio = getContrastRatio(maxLighter, background)
      const darkerRatio = getContrastRatio(maxDarker, background)
      
      if (lighterRatio > currentRatio) {
        suggestions.push({
          color: maxLighter,
          ratio: lighterRatio,
          adjustment: 'lighter',
          adjustmentAmount: 0.9
        })
      }
      
      if (darkerRatio > currentRatio) {
        suggestions.push({
          color: maxDarker,
          ratio: darkerRatio,
          adjustment: 'darker',
          adjustmentAmount: 0.9
        })
      }
    }
    
    // Sort by ratio (best first)
    return suggestions.sort((a, b) => b.ratio - a.ratio)
  }, [generateVariation])

  const checkThemeContrast = useCallback((
    foregroundPath: string,
    backgroundPath: string,
    textSize: TextSize = 'normal'
  ): ContrastResult => {
    const foreground = getColor(foregroundPath)
    const background = getColor(backgroundPath)
    
    if (!foreground || !background) {
      console.warn(`Theme colors not found: ${foregroundPath}, ${backgroundPath}`)
      return {
        ratio: 0,
        meetsAA: false,
        meetsAAA: false,
        rating: 'fail',
        isAccessible: false
      }
    }
    
    return checkContrast(foreground, background, textSize)
  }, [getColor, checkContrast])

  const findBestContrast = useCallback((
    colors: string[],
    background: string,
    standard: ContrastStandard = 'AA',
    textSize: TextSize = 'normal'
  ): string | null => {
    const isLargeText = textSize === 'large'
    const targetRatio = standard === 'AA' 
      ? (isLargeText ? 3 : 4.5)
      : (isLargeText ? 4.5 : 7)
    
    let bestColor: string | null = null
    let bestRatio = 0
    
    for (const color of colors) {
      const ratio = getContrastRatio(color, background)
      
      if (ratio >= targetRatio && ratio > bestRatio) {
        bestColor = color
        bestRatio = ratio
      }
    }
    
    // If no color meets the standard, return the one with highest contrast
    if (!bestColor) {
      for (const color of colors) {
        const ratio = getContrastRatio(color, background)
        if (ratio > bestRatio) {
          bestColor = color
          bestRatio = ratio
        }
      }
    }
    
    return bestColor
  }, [])

  return {
    checkContrast,
    getSuggestions,
    checkThemeContrast,
    findBestContrast
  }
}

/**
 * Hook to automatically check contrast for a component
 * Updates when theme changes
 * 
 * @param foregroundPath - Theme color path for foreground
 * @param backgroundPath - Theme color path for background
 * @param textSize - Size of the text
 * @returns Contrast check result
 * 
 * @example
 * ```tsx
 * const contrast = useAutoContrastCheck('text.primary', 'background')
 * 
 * if (!contrast.isAccessible) {
 *   console.warn('Poor contrast detected')
 * }
 * ```
 */
export const useAutoContrastCheck = (
  foregroundPath: string,
  backgroundPath: string,
  textSize: TextSize = 'normal'
): ContrastResult => {
  const { checkThemeContrast } = useContrastChecker()
  const { theme } = useTheme()
  
  return useMemo(() => {
    return checkThemeContrast(foregroundPath, backgroundPath, textSize)
  }, [checkThemeContrast, foregroundPath, backgroundPath, textSize, theme])
}