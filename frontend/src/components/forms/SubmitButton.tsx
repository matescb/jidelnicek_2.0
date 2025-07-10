/**
 * Enhanced submit button component with loading states,
 * success/error indication, and accessibility features
 */

import React, { forwardRef, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { useTranslation } from 'react-i18next'

export interface SubmitButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Loading state (overrides internal state)
   */
  isLoading?: boolean
  /**
   * Success state (shows success indicator)
   */
  isSuccess?: boolean
  /**
   * Error state (shows error indicator)
   */
  isError?: boolean
  /**
   * Full width button
   */
  fullWidth?: boolean
  /**
   * Show loading spinner
   */
  showLoadingSpinner?: boolean
  /**
   * Loading text (replaces children when loading)
   */
  loadingText?: string
  /**
   * Success text (replaces children on success)
   */
  successText?: string
  /**
   * Error text (replaces children on error)
   */
  errorText?: string
  /**
   * Show state icon (check/x)
   */
  showStateIcon?: boolean
  /**
   * Auto-reset success/error state after delay (ms)
   */
  autoResetDelay?: number
  /**
   * Progress value (0-100) for progress indicator
   */
  progress?: number
  /**
   * Show progress bar
   */
  showProgress?: boolean
  /**
   * Custom loading icon
   */
  loadingIcon?: React.ReactNode
  /**
   * Announce state changes to screen readers
   */
  announceStateChanges?: boolean
  /**
   * Multi-step form support
   */
  stepInfo?: {
    current: number
    total: number
  }
}

export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      isLoading: externalLoading,
      isSuccess: externalSuccess,
      isError: externalError,
      fullWidth = false,
      showLoadingSpinner = true,
      loadingText,
      successText,
      errorText,
      showStateIcon = true,
      autoResetDelay = 3000,
      progress,
      showProgress = false,
      loadingIcon,
      announceStateChanges = true,
      stepInfo,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation()
    const announcerRef = useRef<HTMLDivElement>(null)
    const [internalState, setInternalState] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const resetTimeoutRef = useRef<NodeJS.Timeout>()

    // Determine current state
    const isLoading = externalLoading ?? internalState === 'loading'
    const isSuccess = externalSuccess ?? internalState === 'success'
    const isError = externalError ?? internalState === 'error'

    // Auto-reset state
    useEffect(() => {
      if ((isSuccess || isError) && autoResetDelay > 0 && !externalSuccess && !externalError) {
        resetTimeoutRef.current = setTimeout(() => {
          setInternalState('idle')
        }, autoResetDelay)
      }

      return () => {
        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current)
        }
      }
    }, [isSuccess, isError, autoResetDelay, externalSuccess, externalError])

    // Announce state changes
    useEffect(() => {
      if (announceStateChanges && announcerRef.current) {
        if (isLoading) {
          announcerRef.current.textContent = loadingText || t('form.submitting')
        } else if (isSuccess) {
          announcerRef.current.textContent = successText || t('form.submitSuccess')
        } else if (isError) {
          announcerRef.current.textContent = errorText || t('form.submitError')
        }
      }
    }, [isLoading, isSuccess, isError, loadingText, successText, errorText, announceStateChanges, t])

    // Base classes
    const baseClasses = 'relative inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'

    // Variant classes
    const variantClasses = {
      primary: clsx(
        'border border-transparent text-white focus:ring-primary-500',
        {
          'bg-primary-600 hover:bg-primary-700': !isSuccess && !isError,
          'bg-green-600 hover:bg-green-700': isSuccess,
          'bg-red-600 hover:bg-red-700': isError,
        }
      ),
      secondary: clsx(
        'border text-gray-700 dark:text-gray-300 focus:ring-primary-500',
        {
          'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700': !isSuccess && !isError,
          'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300': isSuccess,
          'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300': isError,
        }
      ),
      danger: clsx(
        'border border-transparent text-white focus:ring-red-500',
        {
          'bg-red-600 hover:bg-red-700': !isSuccess && !isError,
          'bg-green-600 hover:bg-green-700': isSuccess,
          'bg-red-800 hover:bg-red-900': isError,
        }
      ),
      success: clsx(
        'border border-transparent text-white focus:ring-green-500',
        {
          'bg-green-600 hover:bg-green-700': !isError,
          'bg-red-600 hover:bg-red-700': isError,
        }
      ),
    }

    // Size classes
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm rounded',
      md: 'px-4 py-2 text-sm rounded-md',
      lg: 'px-6 py-3 text-base rounded-md',
    }

    // Icon size classes
    const iconSizeClasses = {
      sm: 'h-3.5 w-3.5',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    }

    // Determine button content
    const getButtonContent = () => {
      const iconClass = clsx(iconSizeClasses[size], 'flex-shrink-0')
      
      if (isLoading) {
        return (
          <>
            {showLoadingSpinner && (
              loadingIcon || <Loader2 className={clsx(iconClass, 'animate-spin mr-2')} />
            )}
            <span>{loadingText || children}</span>
            {stepInfo && (
              <span className="ml-2 text-xs opacity-75">
                ({stepInfo.current}/{stepInfo.total})
              </span>
            )}
          </>
        )
      }

      if (isSuccess && (successText || showStateIcon)) {
        return (
          <>
            {showStateIcon && <Check className={clsx(iconClass, 'mr-2')} />}
            <span>{successText || children}</span>
          </>
        )
      }

      if (isError && (errorText || showStateIcon)) {
        return (
          <>
            {showStateIcon && <X className={clsx(iconClass, 'mr-2')} />}
            <span>{errorText || children}</span>
          </>
        )
      }

      return children
    }

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!externalLoading && !externalSuccess && !externalError) {
        setInternalState('loading')
        try {
          if (onClick) {
            await onClick(e)
          }
          if (!e.defaultPrevented) {
            setInternalState('success')
          }
        } catch (error) {
          setInternalState('error')
          throw error
        }
      } else if (onClick) {
        onClick(e)
      }
    }

    return (
      <>
        <button
          ref={ref}
          type="submit"
          className={clsx(
            baseClasses,
            variantClasses[variant],
            sizeClasses[size],
            fullWidth && 'w-full',
            (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
            className
          )}
          disabled={disabled || isLoading}
          onClick={handleClick}
          aria-busy={isLoading}
          aria-live="polite"
          aria-label={
            isLoading ? loadingText || t('form.submitting') :
            isSuccess ? successText || t('form.submitSuccess') :
            isError ? errorText || t('form.submitError') :
            undefined
          }
          {...props}
        >
          <span className="relative flex items-center justify-center">
            {getButtonContent()}
          </span>
          
          {showProgress && progress !== undefined && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 dark:bg-white/10 rounded-b-md overflow-hidden">
              <div
                className="h-full bg-white/30 dark:bg-white/50 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
        </button>

        {/* Screen reader announcements */}
        {announceStateChanges && (
          <div
            ref={announcerRef}
            className="sr-only"
            aria-live="polite"
            aria-atomic="true"
          />
        )}
      </>
    )
  }
)

SubmitButton.displayName = 'SubmitButton'

/**
 * Hook to manage submit button state
 */
export function useSubmitButton(options?: {
  autoResetDelay?: number
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const [state, setState] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const resetTimeoutRef = useRef<NodeJS.Timeout>()

  const setLoading = () => setState('loading')
  const setSuccess = () => {
    setState('success')
    options?.onSuccess?.()
    
    if (options?.autoResetDelay) {
      resetTimeoutRef.current = setTimeout(() => {
        setState('idle')
      }, options.autoResetDelay)
    }
  }
  
  const setError = (error?: Error) => {
    setState('error')
    if (error && options?.onError) {
      options.onError(error)
    }
    
    if (options?.autoResetDelay) {
      resetTimeoutRef.current = setTimeout(() => {
        setState('idle')
      }, options.autoResetDelay)
    }
  }
  
  const reset = () => {
    setState('idle')
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current)
    }
  }

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  return {
    state,
    isLoading: state === 'loading',
    isSuccess: state === 'success',
    isError: state === 'error',
    setLoading,
    setSuccess,
    setError,
    reset,
  }
}