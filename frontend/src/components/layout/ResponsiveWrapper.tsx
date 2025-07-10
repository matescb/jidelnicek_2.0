import React from 'react'
import { useBreakpoint } from '@hooks/useMediaQuery'

interface ResponsiveWrapperProps {
  mobile?: React.ReactNode
  tablet?: React.ReactNode
  desktop?: React.ReactNode
  children?: React.ReactNode
}

/**
 * Component that renders different content based on screen size
 */
export const ResponsiveWrapper: React.FC<ResponsiveWrapperProps> = ({
  mobile,
  tablet,
  desktop,
  children
}) => {
  const breakpoint = useBreakpoint()
  
  // Mobile: xs, sm
  if ((breakpoint === 'xs' || breakpoint === 'sm') && mobile) {
    return <>{mobile}</>
  }
  
  // Tablet: md
  if (breakpoint === 'md' && tablet) {
    return <>{tablet}</>
  }
  
  // Desktop: lg, xl, 2xl
  if ((breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl') && desktop) {
    return <>{desktop}</>
  }
  
  // Fallback to children or most appropriate content
  if (children) return <>{children}</>
  if (desktop) return <>{desktop}</>
  if (tablet) return <>{tablet}</>
  if (mobile) return <>{mobile}</>
  
  return null
}