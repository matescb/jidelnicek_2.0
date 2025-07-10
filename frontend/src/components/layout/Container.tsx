import React from 'react'
import clsx from 'clsx'
import { containerMaxWidths } from '@styles/design-tokens'

interface ContainerProps {
  children: React.ReactNode
  maxWidth?: keyof typeof containerMaxWidths
  className?: string
  as?: React.ElementType
  noPadding?: boolean
  fluid?: boolean
}

/**
 * Responsive container component with consistent max-widths and padding
 */
export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'xl',
  className,
  as: Component = 'div',
  noPadding = false,
  fluid = false
}) => {
  return (
    <Component
      className={clsx(
        'mx-auto w-full',
        !fluid && [
          maxWidth === 'sm' && 'max-w-screen-sm',
          maxWidth === 'md' && 'max-w-screen-md',
          maxWidth === 'lg' && 'max-w-screen-lg',
          maxWidth === 'xl' && 'max-w-screen-xl',
          maxWidth === '2xl' && 'max-w-screen-2xl',
          maxWidth === 'full' && 'max-w-full'
        ],
        !noPadding && 'px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {children}
    </Component>
  )
}