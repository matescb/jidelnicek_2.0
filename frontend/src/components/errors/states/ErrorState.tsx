import React from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, RefreshCw, Home, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

interface ErrorStateProps {
  /**
   * Error object or string
   */
  error?: Error | string | null
  /**
   * Custom title
   */
  title?: string
  /**
   * Custom message
   */
  message?: string
  /**
   * Show retry button
   */
  showRetry?: boolean
  /**
   * Retry callback
   */
  onRetry?: () => void
  /**
   * Show home button
   */
  showHome?: boolean
  /**
   * Home callback
   */
  onHome?: () => void
  /**
   * Show back button
   */
  showBack?: boolean
  /**
   * Back callback
   */
  onBack?: () => void
  /**
   * Custom action
   */
  customAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  /**
   * Show illustration
   */
  showIllustration?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Compact mode for smaller containers
   */
  compact?: boolean
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  title,
  message,
  showRetry = true,
  onRetry,
  showHome = false,
  onHome,
  showBack = false,
  onBack,
  customAction,
  showIllustration = true,
  className = '',
  compact = false
}) => {
  const { t } = useTypedTranslation()

  // Extract error message
  const errorMessage = React.useMemo(() => {
    if (message) return message
    if (!error) return t('errors.generic.message')
    if (typeof error === 'string') return error
    return error.message || t('errors.generic.message')
  }, [error, message, t])

  const errorTitle = title || t('errors.generic.title')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`flex flex-col items-center justify-center ${compact ? 'py-8' : 'py-16'} px-4 ${className}`}
    >
      {/* Illustration */}
      {showIllustration && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className={compact ? 'mb-4' : 'mb-8'}
        >
          <ErrorIllustration
            type="error"
            className={compact ? 'w-32 h-32' : 'w-48 h-48'}
            animated
          />
        </motion.div>
      )}

      {/* Icon */}
      {!showIllustration && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className={compact ? 'mb-4' : 'mb-6'}
        >
          <div className="p-4 rounded-full bg-error-100 dark:bg-error-900">
            <AlertCircle className={`${compact ? 'h-8 w-8' : 'h-12 w-12'} text-error-600 dark:text-error-400`} />
          </div>
        </motion.div>
      )}

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-center max-w-md"
      >
        <h3 className={`font-semibold text-text-primary ${compact ? 'text-lg mb-2' : 'text-xl mb-3'}`}>
          {errorTitle}
        </h3>
        <p className={`text-text-secondary ${compact ? 'text-sm' : 'text-base'}`}>
          {errorMessage}
        </p>
      </motion.div>

      {/* Error Details (for development) */}
      {import.meta.env.DEV && error instanceof Error && error.stack && (
        <motion.details
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-4 max-w-full"
        >
          <summary className="cursor-pointer text-sm text-text-muted hover:text-text-secondary">
            {t('errors.showDetails')}
          </summary>
          <pre className="mt-2 p-3 bg-surface-elevated rounded text-xs text-text-muted overflow-auto max-w-2xl">
            {error.stack}
          </pre>
        </motion.details>
      )}

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className={`flex flex-col sm:flex-row gap-3 ${compact ? 'mt-4' : 'mt-6'}`}
      >
        {showRetry && onRetry && (
          <Button
            variant="default"
            size={compact ? 'sm' : 'default'}
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4" />
            {t('errors.actions.retry')}
          </Button>
        )}
        
        {showHome && onHome && (
          <Button
            variant={showRetry ? 'outline' : 'default'}
            size={compact ? 'sm' : 'default'}
            onClick={onHome}
          >
            <Home className="h-4 w-4" />
            {t('errors.actions.goHome')}
          </Button>
        )}
        
        {showBack && onBack && (
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'default'}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('errors.actions.goBack')}
          </Button>
        )}

        {customAction && (
          <Button
            variant="secondary"
            size={compact ? 'sm' : 'default'}
            onClick={customAction.onClick}
          >
            {customAction.icon}
            {customAction.label}
          </Button>
        )}
      </motion.div>
    </motion.div>
  )
}