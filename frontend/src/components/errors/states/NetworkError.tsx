import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi, RefreshCw, Globe, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

interface NetworkErrorProps {
  /**
   * Custom title
   */
  title?: string
  /**
   * Custom message
   */
  message?: string
  /**
   * Show connection status indicator
   */
  showConnectionStatus?: boolean
  /**
   * Show retry button
   */
  showRetry?: boolean
  /**
   * Retry callback
   */
  onRetry?: () => void | Promise<void>
  /**
   * Show offline mode button
   */
  showOfflineMode?: boolean
  /**
   * Offline mode callback
   */
  onOfflineMode?: () => void
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

export const NetworkError: React.FC<NetworkErrorProps> = ({
  title,
  message,
  showConnectionStatus = true,
  showRetry = true,
  onRetry,
  showOfflineMode = false,
  onOfflineMode,
  customAction,
  showIllustration = true,
  className = '',
  compact = false
}) => {
  const { t } = useTypedTranslation()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isRetrying, setIsRetrying] = useState(false)
  const [connectionSpeed, setConnectionSpeed] = useState<'fast' | 'slow' | 'offline'>('offline')

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      checkConnectionSpeed()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setConnectionSpeed('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check
    checkConnectionSpeed()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const checkConnectionSpeed = async () => {
    if (!navigator.onLine) {
      setConnectionSpeed('offline')
      return
    }

    try {
      const startTime = performance.now()
      await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache',
        mode: 'no-cors'
      })
      const endTime = performance.now()
      const duration = endTime - startTime

      if (duration < 500) {
        setConnectionSpeed('fast')
      } else {
        setConnectionSpeed('slow')
      }
    } catch {
      setConnectionSpeed('offline')
    }
  }

  const handleRetry = async () => {
    if (!onRetry) return
    
    setIsRetrying(true)
    await checkConnectionSpeed()
    
    try {
      await onRetry()
    } finally {
      setTimeout(() => setIsRetrying(false), 500)
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionSpeed) {
      case 'fast':
        return 'success'
      case 'slow':
        return 'warning'
      default:
        return 'error'
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionSpeed) {
      case 'fast':
        return t('errors.network.connectionFast')
      case 'slow':
        return t('errors.network.connectionSlow')
      default:
        return t('errors.network.connectionOffline')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`flex flex-col items-center justify-center ${compact ? 'py-8' : 'py-16'} px-4 ${className}`}
    >
      {/* Connection Status */}
      {showConnectionStatus && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={compact ? 'mb-4' : 'mb-6'}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={connectionSpeed}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-${getConnectionStatusColor()}-100 dark:bg-${getConnectionStatusColor()}-900 text-${getConnectionStatusColor()}-700 dark:text-${getConnectionStatusColor()}-300`}
            >
              {connectionSpeed === 'offline' ? (
                <WifiOff className="h-4 w-4" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              <span className="text-xs font-medium">{getConnectionStatusText()}</span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}

      {/* Illustration */}
      {showIllustration && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className={compact ? 'mb-4' : 'mb-8'}
        >
          <ErrorIllustration
            type="offline"
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
            animate={{
              opacity: [1, 0.3, 1],
              scale: [1, 0.95, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="p-4 rounded-full bg-error-100 dark:bg-error-900"
          >
            <Globe className={`${compact ? 'h-8 w-8' : 'h-12 w-12'} text-error-600 dark:text-error-400`} />
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
          {title || t('errors.network.title')}
        </h3>
        <p className={`text-text-secondary ${compact ? 'text-sm' : 'text-base'}`}>
          {message || t('errors.network.message')}
        </p>
      </motion.div>

      {/* Connection Tips */}
      {connectionSpeed === 'slow' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className={`flex items-center gap-2 ${compact ? 'mt-2' : 'mt-3'} text-warning-600 dark:text-warning-400`}
        >
          <AlertCircle className="h-4 w-4" />
          <span className={compact ? 'text-xs' : 'text-sm'}>
            {t('errors.network.slowConnectionTip')}
          </span>
        </motion.div>
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
            {isRetrying ? t('errors.actions.checking') : t('errors.actions.retry')}
          </Button>
        )}

        {showOfflineMode && onOfflineMode && (
          <Button
            variant="outline"
            size={compact ? 'sm' : 'default'}
            onClick={onOfflineMode}
          >
            <WifiOff className="h-4 w-4" />
            {t('errors.actions.offlineMode')}
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

      {/* Help Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className={`text-text-muted text-center ${compact ? 'text-xs mt-4' : 'text-sm mt-6'} max-w-sm`}
      >
        <p className="font-medium mb-2">{t('errors.network.tips.title')}</p>
        <ul className="space-y-1">
          <li>{t('errors.network.tips.checkWifi')}</li>
          <li>{t('errors.network.tips.checkData')}</li>
          <li>{t('errors.network.tips.checkRouter')}</li>
          {connectionSpeed === 'slow' && (
            <li>{t('errors.network.tips.closeApps')}</li>
          )}
        </ul>
      </motion.div>
    </motion.div>
  )
}