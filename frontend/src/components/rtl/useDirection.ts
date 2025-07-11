// Re-export the useDirection hook from DirectionalProvider
export { useDirection } from './DirectionalProvider'

// Additional direction-aware hooks
import { useMemo } from 'react'
import { useDirection as useDirectionBase } from './DirectionalProvider'
import { flipHorizontal, getStartEndValue } from '@/i18n/rtl'

// Hook for getting flipped horizontal values
export const useFlippedValue = <T extends 'left' | 'right'>(value: T): T => {
  const { direction } = useDirectionBase()
  return useMemo(() => flipHorizontal(value, direction) as T, [value, direction])
}

// Hook for getting start/end values
export const useStartEndValue = <T>(start: T, end: T, property: 'start' | 'end'): T => {
  const { direction } = useDirectionBase()
  return useMemo(
    () => getStartEndValue(start, end, direction, property),
    [start, end, direction, property]
  )
}

// Hook for directional className
export const useDirectionalClass = (
  ltrClass: string,
  rtlClass: string
): string => {
  const { isRTL } = useDirectionBase()
  return isRTL ? rtlClass : ltrClass
}

// Hook for directional styles
export const useDirectionalStyle = (
  ltrStyle: React.CSSProperties,
  rtlStyle: React.CSSProperties
): React.CSSProperties => {
  const { isRTL } = useDirectionBase()
  return isRTL ? rtlStyle : ltrStyle
}