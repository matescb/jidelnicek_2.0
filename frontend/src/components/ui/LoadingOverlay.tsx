import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from './LoadingSpinner'
import { LoadingDots } from './LoadingDots'
import { ProgressBar } from './progress'

const overlayVariants = cva(
  'absolute inset-0 z-50 flex items-center justify-center',
  {
    variants: {
      variant: {
        default: 'bg-white/80 dark:bg-gray-950/80',
        dark: 'bg-gray-900/90 dark:bg-gray-900/90',
        light: 'bg-white/90 dark:bg-gray-950/90',
        blur: 'bg-white/60 backdrop-blur-sm dark:bg-gray-950/60'
      },
      position: {
        fixed: 'fixed',
        absolute: 'absolute',
        relative: 'relative'
      }
    },
    defaultVariants: {
      variant: 'default',
      position: 'absolute'
    }
  }
)

export interface LoadingOverlayProps extends VariantProps<typeof overlayVariants> {
  /**
   * Whether the overlay is visible
   */
  isLoading?: boolean
  /**
   * Loading indicator type
   */
  indicator?: 'spinner' | 'dots' | 'progress' | 'custom'
  /**
   * Progress value (for progress indicator)
   */
  progress?: number
  /**
   * Loading text
   */
  text?: string
  /**
   * Custom loading content
   */
  children?: React.ReactNode
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Click handler for overlay
   */
  onClick?: () => void
  /**
   * Whether clicking overlay should close it
   */
  closeOnClick?: boolean
  /**
   * Spinner/dots size
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Full screen overlay
   */
  fullScreen?: boolean
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading = true,
  indicator = 'spinner',
  progress,
  text,
  children,
  className,
  variant,
  position,
  onClick,
  closeOnClick = false,
  size = 'lg',
  fullScreen = false
}) => {
  const handleClick = () => {
    if (closeOnClick && onClick) {
      onClick()
    }
  }

  const overlayClass = fullScreen 
    ? cn('fixed inset-0 z-50 flex items-center justify-center', 
        variant === 'blur' && 'backdrop-blur-sm',
        variant === 'default' && 'bg-white/80 dark:bg-gray-950/80',
        variant === 'dark' && 'bg-gray-900/90 dark:bg-gray-900/90',
        variant === 'light' && 'bg-white/90 dark:bg-gray-950/90',
        className)
    : cn(overlayVariants({ variant, position }), className)

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className={overlayClass}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleClick}
        >
          <div className="flex flex-col items-center justify-center gap-4">
            {children ? (
              children
            ) : (
              <>
                {indicator === 'spinner' && (
                  <LoadingSpinner size={size} variant="primary" />
                )}
                {indicator === 'dots' && (
                  <LoadingDots size={size} variant="primary" />
                )}
                {indicator === 'progress' && progress !== undefined && (
                  <div className="w-48">
                    <ProgressBar 
                      value={progress} 
                      max={100} 
                      size="md"
                      indicatorVariant="default"
                      showLabel
                    />
                  </div>
                )}
                {text && (
                  <motion.p
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {text}
                  </motion.p>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Container Loading Overlay - for specific sections
export interface ContainerLoadingProps extends Omit<LoadingOverlayProps, 'fullScreen' | 'position'> {
  /**
   * Minimum height for the container
   */
  minHeight?: string
}

export const ContainerLoading: React.FC<ContainerLoadingProps> = ({
  minHeight = '200px',
  ...props
}) => {
  return (
    <div className="relative" style={{ minHeight }}>
      <LoadingOverlay {...props} position="absolute" fullScreen={false} />
    </div>
  )
}

// Page Loading Overlay - for full page loading states
export const PageLoading: React.FC<Omit<LoadingOverlayProps, 'fullScreen'>> = (props) => {
  return <LoadingOverlay {...props} fullScreen position="fixed" />
}