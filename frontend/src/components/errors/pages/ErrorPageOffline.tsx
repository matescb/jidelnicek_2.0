import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, RefreshCw, Wifi, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

interface ErrorPageOfflineProps {
  /**
   * Custom title for the error page
   */
  title?: string
  /**
   * Custom message for the error page
   */
  message?: string
  /**
   * Show retry button
   */
  showRetry?: boolean
  /**
   * Show connection status
   */
  showConnectionStatus?: boolean
  /**
   * Custom action button
   */
  customAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
}

export const ErrorPageOffline: React.FC<ErrorPageOfflineProps> = ({
  title,
  message,
  showRetry = true,
  showConnectionStatus = true,
  customAction
}) => {
  const { t } = useTypedTranslation()
  const [isOnline, setIsOnline] = useState(!navigator.onLine)
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastChecked, setLastChecked] = useState(new Date())

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check connection status periodically
    const interval = setInterval(() => {
      setIsOnline(navigator.onLine)
      setLastChecked(new Date())
    }, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const handleRetry = async () => {
    setIsRetrying(true)
    setLastChecked(new Date())
    
    // Check connection
    try {
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache' 
      })
      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      // Still offline
    }
    
    setTimeout(() => {
      setIsRetrying(false)
    }, 1000)
  }

  const handleGoHome = () => {
    if (isOnline) {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full text-center"
      >
        {/* Connection Status Indicator */}
        {showConnectionStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <AnimatePresence mode="wait">
              {isOnline ? (
                <motion.div
                  key="online"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success-100 dark:bg-success-900 text-success-700 dark:text-success-300"
                >
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('errors.offline.statusOnline')}</span>
                </motion.div>
              ) : (
                <motion.div
                  key="offline"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-error-100 dark:bg-error-900 text-error-700 dark:text-error-300"
                >
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('errors.offline.statusOffline')}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Animated Icon */}
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="mb-8"
        >
          <WifiOff className="w-24 h-24 mx-auto text-text-muted" />
        </motion.div>

        {/* Illustration */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <ErrorIllustration
            type="offline"
            className="w-64 h-64 mx-auto"
            animated
          />
        </motion.div>

        {/* Title and Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary">
            {title || t('errors.offline.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-md mx-auto">
            {message || t('errors.offline.message')}
          </p>
        </motion.div>

        {/* Last Checked */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mb-6 text-sm text-text-muted"
        >
          {t('errors.offline.lastChecked', { 
            time: lastChecked.toLocaleTimeString() 
          })}
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          {showRetry && (
            <Button
              variant="default"
              size="lg"
              onClick={handleRetry}
              disabled={isRetrying}
              className="min-w-[160px]"
            >
              <motion.div
                animate={isRetrying ? { rotate: 360 } : {}}
                transition={{ 
                  duration: 1,
                  repeat: isRetrying ? Infinity : 0,
                  ease: 'linear'
                }}
              >
                <RefreshCw className="h-5 w-5" />
              </motion.div>
              {isRetrying ? t('errors.actions.checking') : t('errors.actions.retry')}
            </Button>
          )}

          {isOnline && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleGoHome}
              className="min-w-[160px]"
            >
              <Home className="h-5 w-5" />
              {t('errors.actions.goHome')}
            </Button>
          )}

          {customAction && (
            <Button
              variant="secondary"
              size="lg"
              onClick={customAction.onClick}
              className="min-w-[160px]"
            >
              {customAction.icon}
              {customAction.label}
            </Button>
          )}
        </motion.div>

        {/* Help text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-8 space-y-2"
        >
          <p className="text-sm text-text-muted">
            {t('errors.offline.helpText')}
          </p>
          <ul className="text-sm text-text-muted space-y-1">
            <li>{t('errors.offline.tip1')}</li>
            <li>{t('errors.offline.tip2')}</li>
            <li>{t('errors.offline.tip3')}</li>
          </ul>
        </motion.div>
      </motion.div>
    </div>
  )
}