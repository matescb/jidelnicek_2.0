/**
 * RTL (Right-to-Left) support utilities and configuration
 */

// RTL language codes
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'ji', 'ku', 'sd'] as const
export type RTLLanguage = typeof RTL_LANGUAGES[number]

// Check if a language code is RTL
export const isRTL = (languageCode: string): boolean => {
  return RTL_LANGUAGES.includes(languageCode as RTLLanguage)
}

// Direction type
export type Direction = 'ltr' | 'rtl'

// Get direction for a language code
export const getDirection = (languageCode: string): Direction => {
  return isRTL(languageCode) ? 'rtl' : 'ltr'
}

// Update document direction
export const updateDocumentDirection = (direction: Direction) => {
  document.documentElement.dir = direction
  document.documentElement.setAttribute('data-dir', direction)
  
  // Add/remove RTL class for CSS fallbacks
  if (direction === 'rtl') {
    document.documentElement.classList.add('rtl')
  } else {
    document.documentElement.classList.remove('rtl')
  }
}

// Direction-aware style utilities
export const directionalStyles = {
  // Margin utilities
  marginStart: (value: number | string) => ({
    marginInlineStart: value,
    marginLeft: undefined,
    marginRight: undefined,
  }),
  marginEnd: (value: number | string) => ({
    marginInlineEnd: value,
    marginLeft: undefined,
    marginRight: undefined,
  }),
  
  // Padding utilities
  paddingStart: (value: number | string) => ({
    paddingInlineStart: value,
    paddingLeft: undefined,
    paddingRight: undefined,
  }),
  paddingEnd: (value: number | string) => ({
    paddingInlineEnd: value,
    paddingLeft: undefined,
    paddingRight: undefined,
  }),
  
  // Position utilities
  start: (value: number | string) => ({
    insetInlineStart: value,
    left: undefined,
    right: undefined,
  }),
  end: (value: number | string) => ({
    insetInlineEnd: value,
    left: undefined,
    right: undefined,
  }),
  
  // Border utilities
  borderStart: (width: number | string, style?: string, color?: string) => ({
    borderInlineStart: `${width} ${style || 'solid'} ${color || 'currentColor'}`,
    borderLeft: undefined,
    borderRight: undefined,
  }),
  borderEnd: (width: number | string, style?: string, color?: string) => ({
    borderInlineEnd: `${width} ${style || 'solid'} ${color || 'currentColor'}`,
    borderLeft: undefined,
    borderRight: undefined,
  }),
  
  // Text alignment
  textAlign: (align: 'start' | 'end' | 'center') => ({
    textAlign: align === 'start' || align === 'end' ? align : align,
  }),
}

// Flip horizontal values for RTL
export const flipHorizontal = (value: 'left' | 'right', direction: Direction): 'left' | 'right' => {
  if (direction === 'rtl') {
    return value === 'left' ? 'right' : 'left'
  }
  return value
}

// Get logical property value
export const getLogicalValue = (
  startValue: any,
  endValue: any,
  direction: Direction
): { left?: any; right?: any } => {
  if (direction === 'rtl') {
    return { left: endValue, right: startValue }
  }
  return { left: startValue, right: endValue }
}

// CSS variable names for RTL support
export const RTL_CSS_VARS = {
  direction: '--direction',
  isRTL: '--is-rtl',
  startOffset: '--start-offset',
  endOffset: '--end-offset',
} as const

// Update CSS variables for RTL
export const updateRTLCSSVariables = (direction: Direction) => {
  const root = document.documentElement
  root.style.setProperty(RTL_CSS_VARS.direction, direction)
  root.style.setProperty(RTL_CSS_VARS.isRTL, direction === 'rtl' ? '1' : '0')
}

// Mirror transform for RTL (useful for icons)
export const getMirrorTransform = (shouldMirror: boolean, direction: Direction): string => {
  if (shouldMirror && direction === 'rtl') {
    return 'scaleX(-1)'
  }
  return 'none'
}

// Get start/end values based on direction
export const getStartEndValue = <T>(
  start: T,
  end: T,
  direction: Direction,
  property: 'start' | 'end'
): T => {
  if (direction === 'rtl') {
    return property === 'start' ? end : start
  }
  return property === 'start' ? start : end
}