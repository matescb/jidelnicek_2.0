import { useState, useEffect } from 'react'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('lg')

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      let currentBreakpoint: Breakpoint = 'xs'

      for (const [key, value] of Object.entries(breakpoints)) {
        if (width >= value) {
          currentBreakpoint = key as Breakpoint
        }
      }

      setBreakpoint(currentBreakpoint)
    }

    // Initial check
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return breakpoint
}