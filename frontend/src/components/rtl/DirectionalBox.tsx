import React, { CSSProperties, ReactNode } from 'react'
import { useDirection } from './DirectionalProvider'
import { directionalStyles, flipHorizontal, getMirrorTransform } from '@/i18n/rtl'
import { cn } from '@/lib/utils'

interface DirectionalBoxProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  
  // Directional spacing
  marginStart?: number | string
  marginEnd?: number | string
  paddingStart?: number | string
  paddingEnd?: number | string
  
  // Directional positioning
  start?: number | string
  end?: number | string
  
  // Directional borders
  borderStart?: string
  borderEnd?: string
  
  // Text alignment
  textAlign?: 'start' | 'end' | 'center'
  
  // Transform mirroring
  mirrorTransform?: boolean
  
  // Flex direction
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  
  // Other HTML attributes
  as?: keyof JSX.IntrinsicElements
  [key: string]: any
}

export const DirectionalBox: React.FC<DirectionalBoxProps> = ({
  children,
  className,
  style = {},
  marginStart,
  marginEnd,
  paddingStart,
  paddingEnd,
  start,
  end,
  borderStart,
  borderEnd,
  textAlign,
  mirrorTransform = false,
  flexDirection,
  as: Component = 'div',
  ...props
}) => {
  const { direction, isRTL } = useDirection()
  
  // Build directional styles
  const directionalStylesObj: CSSProperties = {
    ...style,
  }
  
  // Apply margin
  if (marginStart !== undefined) {
    Object.assign(directionalStylesObj, directionalStyles.marginStart(marginStart))
  }
  if (marginEnd !== undefined) {
    Object.assign(directionalStylesObj, directionalStyles.marginEnd(marginEnd))
  }
  
  // Apply padding
  if (paddingStart !== undefined) {
    Object.assign(directionalStylesObj, directionalStyles.paddingStart(paddingStart))
  }
  if (paddingEnd !== undefined) {
    Object.assign(directionalStylesObj, directionalStyles.paddingEnd(paddingEnd))
  }
  
  // Apply positioning
  if (start !== undefined) {
    Object.assign(directionalStylesObj, directionalStyles.start(start))
  }
  if (end !== undefined) {
    Object.assign(directionalStylesObj, directionalStyles.end(end))
  }
  
  // Apply borders
  if (borderStart) {
    const [width, style, color] = borderStart.split(' ')
    Object.assign(directionalStylesObj, directionalStyles.borderStart(width, style, color))
  }
  if (borderEnd) {
    const [width, style, color] = borderEnd.split(' ')
    Object.assign(directionalStylesObj, directionalStyles.borderEnd(width, style, color))
  }
  
  // Apply text alignment
  if (textAlign) {
    Object.assign(directionalStylesObj, directionalStyles.textAlign(textAlign))
  }
  
  // Apply mirror transform
  if (mirrorTransform) {
    directionalStylesObj.transform = getMirrorTransform(true, direction)
  }
  
  // Handle flex direction for RTL
  if (flexDirection) {
    if (isRTL && (flexDirection === 'row' || flexDirection === 'row-reverse')) {
      directionalStylesObj.flexDirection = flexDirection === 'row' ? 'row-reverse' : 'row'
    } else {
      directionalStylesObj.flexDirection = flexDirection
    }
  }
  
  return (
    <Component
      className={cn(className, {
        'dir-rtl': isRTL,
        'dir-ltr': !isRTL,
      })}
      style={directionalStylesObj}
      data-direction={direction}
      {...props}
    >
      {children}
    </Component>
  )
}

// Convenience components
export const DirectionalFlex: React.FC<DirectionalBoxProps & { gap?: number | string }> = ({
  gap,
  ...props
}) => {
  return (
    <DirectionalBox
      style={{
        display: 'flex',
        gap,
        ...props.style,
      }}
      {...props}
    />
  )
}

export const DirectionalGrid: React.FC<DirectionalBoxProps & { 
  gap?: number | string
  columns?: number | string
}> = ({
  gap,
  columns,
  ...props
}) => {
  return (
    <DirectionalBox
      style={{
        display: 'grid',
        gap,
        gridTemplateColumns: typeof columns === 'number' 
          ? `repeat(${columns}, 1fr)` 
          : columns,
        ...props.style,
      }}
      {...props}
    />
  )
}