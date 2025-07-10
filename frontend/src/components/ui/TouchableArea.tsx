import React, { forwardRef } from 'react'
import clsx from 'clsx'
import { touchTargets } from '@/styles/design-tokens'

interface TouchableAreaProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: keyof typeof touchTargets
  as?: 'button' | 'a' | 'div'
  href?: string
  children: React.ReactNode
}

/**
 * Ensures minimum touch target sizes for better mobile UX
 */
export const TouchableArea = forwardRef<
  HTMLButtonElement | HTMLAnchorElement | HTMLDivElement,
  TouchableAreaProps
>(({ size = 'comfortable', as = 'button', className, style, children, ...props }, ref) => {
  const minSize = touchTargets[size]
  const touchStyle = {
    minHeight: minSize,
    minWidth: minSize,
    ...style
  }

  const Component = as

  if (as === 'a') {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={clsx('inline-flex items-center justify-center', className)}
        style={touchStyle}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    )
  }

  if (as === 'div') {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={clsx('inline-flex items-center justify-center', className)}
        style={touchStyle}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    )
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={clsx('inline-flex items-center justify-center', className)}
      style={touchStyle}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  )
})

TouchableArea.displayName = 'TouchableArea'