import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, RefreshCw, WifiOff, ServerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

export type LoadingErrorType = 'network' | 'server' | 'timeout' | 'generic'

interface LoadingErrorProps {
  /**
   * Type of loading error
   */
  type?: LoadingErrorType
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
   * Resource being loaded (e.g., "recipes", "user profile")
   */
  resource?: string
  /**
   * Show retry button
   */
  showRetry?: boolean
  /**
   * Retry callback
   */
  onRetry?: () => void | Promise<void>
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

const errorTypeConfig: Record<LoadingErrorType, {
  icon: React.ComponentType<{ className?: string }>
  defaultTitle: string
  defaultMessage: string
  illustrationType: string
  color: string
}> = {
  network: {
    icon: WifiOff,
    defaultTitle: 'errors.loading.network.title',
    defaultMessage: 'errors.loading.network.message',
    illustrationType: 'offline',
    color: 'warning'
  },
  server: {
    icon: ServerOff,
    defaultTitle: 'errors.loading.server.title',
    defaultMessage: 'errors.loading.server.message',
    illustrationType: '500',
    color: 'error'
  },
  timeout: {
    icon: AlertCircle,
    defaultTitle: 'errors.loading.timeout.title',
    defaultMessage: 'errors.loading.timeout.message',
    illustrationType: 'timeout',
    color: 'warning'
  },
  generic: {
    icon: AlertCircle,
    defaultTitle: 'errors.loading.generic.title',
    defaultMessage: 'errors.loading.generic.message',
    illustrationType: 'error',
    color: 'error'
  }
}

export const LoadingError: React.FC<LoadingErrorProps> = ({
  type = 'generic',
  error,
  title,
  message,
  resource,
  showRetry = true,
  onRetry,
  customAction,
  showIllustration = true,
  className = '',
  compact = false
}) => {
  const { t } = useTypedTranslation()
  const [isRetrying, setIsRetrying] = useState(false)
  const config = errorTypeConfig[type]
  const Icon = config.icon

  const handleRetry = async () => {
    if (!onRetry) return
    
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      // Keep spinner for a minimum time for better UX
      setTimeout(() => setIsRetrying(false), 500)
    }
  }

  // Get appropriate message
  const errorMessage = React.useMemo(() => {
    if (message) return message
    if (resource) {
      return t(config.defaultMessage + 'WithResource', { resource })
    }
    return t(config.defaultMessage)
  }, [message, resource, config.defaultMessage, t])

  const errorTitle = title || t(config.defaultTitle)

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
            type={config.illustrationType}
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
          <motion.div
            animate={type === 'network' ? {
              opacity: [1, 0.3, 1],
              scale: [1, 0.95, 1]
            } : {}}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className={`p-4 rounded-full bg-${config.color}-100 dark:bg-${config.color}-900`}
          >
            <Icon className={`${compact ? 'h-8 w-8' : 'h-12 w-12'} text-${config.color}-600 dark:text-${config.color}-400`} />
          </motion.div>
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

      {/* Retry hint for timeout errors */}
      {type === 'timeout' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className={`text-text-muted ${compact ? 'text-xs mt-2' : 'text-sm mt-3'}`}
        >
          {t('errors.loading.timeout.hint')}
        </motion.p>
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
            onClick={handleRetry}
            disabled={isRetrying}
          >
            <motion.div
              animate={isRetrying ? { rotate: 360 } : {}}
              transition={{ 
                duration: 1,
                repeat: isRetrying ? Infinity : 0,
                ease: 'linear'
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.div>
            {isRetrying ? t('errors.actions.retrying') : t('errors.actions.retry')}
          </Button>
        )}

        {customAction && (
          <Button
            variant="outline"
            size={compact ? 'sm' : 'default'}
            onClick={customAction.onClick}
          >
            {customAction.icon}
            {customAction.label}
          </Button>
        )}
      </motion.div>

      {/* Additional help for network errors */}
      {type === 'network' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className={`text-text-muted text-center ${compact ? 'text-xs mt-4' : 'text-sm mt-6'} max-w-sm`}
        >
          <p>{t('errors.loading.network.tips.title')}</p>
          <ul className="mt-2 space-y-1">
            <li>{t('errors.loading.network.tips.checkConnection')}</li>
            <li>{t('errors.loading.network.tips.checkFirewall')}</li>
            <li>{t('errors.loading.network.tips.tryAgain')}</li>
          </ul>
        </motion.div>
      )}
    </motion.div>
  )
}