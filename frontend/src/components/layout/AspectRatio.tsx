import React from 'react'
import clsx from 'clsx'
import { aspectRatios } from '@styles/design-tokens'

interface AspectRatioProps {
  ratio?: keyof typeof aspectRatios | string
  children: React.ReactNode
  className?: string
}

/**
 * Maintains aspect ratio for responsive content
 */
export const AspectRatio: React.FC<AspectRatioProps> = ({
  ratio = 'video',
  children,
  className
}) => {
  const aspectRatio = ratio in aspectRatios 
    ? aspectRatios[ratio as keyof typeof aspectRatios]
    : ratio

  return (
    <div 
      className={clsx('relative w-full overflow-hidden', className)}
      style={{ aspectRatio }}
    >
      <div className="absolute inset-0">
        {children}
      </div>
    </div>
  )
}