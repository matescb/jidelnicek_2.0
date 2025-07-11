import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Home, RefreshCw, ChevronLeft, ChevronDown, AlertCircle, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

interface ErrorPage500Props {
  /**
   * Custom title for the error page
   */
  title?: string
  /**
   * Custom message for the error page
   */
  message?: string
  /**
   * Error details for debugging
   */
  errorDetails?: {
    code?: string
    timestamp?: string
    requestId?: string
    stack?: string
  }
  /**
   * Show retry button
   */
  showRetry?: boolean
  /**
   * Retry callback
   */
  onRetry?: () => void
  /**
   * Custom action button
   */
  customAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
}

export const ErrorPage500: React.FC<ErrorPage500Props> = ({
  title,
  message,
  errorDetails,
  showRetry = true,
  onRetry,
  customAction
}) => {
  const { t } = useTypedTranslation()
  const navigate = useNavigate()
  const [isRetrying, setIsRetrying] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const handleGoHome = () => {
    navigate('/')
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      if (onRetry) {
        await onRetry()
      } else {
        window.location.reload()
      }
    } finally {
      setIsRetrying(false)
    }
  }

  const handleCopyDetails = async () => {
    if (!errorDetails) return

    const detailsText = `
Error Code: ${errorDetails.code || 'N/A'}
Timestamp: ${errorDetails.timestamp || new Date().toISOString()}
Request ID: ${errorDetails.requestId || 'N/A'}
${errorDetails.stack ? `\nStack Trace:\n${errorDetails.stack}` : ''}
    `.trim()

    await navigator.clipboard.writeText(detailsText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full text-center"
      >
        {/* Error Code */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-8xl md:text-9xl font-bold text-error-600 dark:text-error-400">
            500
          </h1>
        </motion.div>

        {/* Illustration */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <ErrorIllustration
            type="500"
            className="w-64 h-64 mx-auto"
            animated
          />
        </motion.div>

        {/* Alert Animation */}
        <motion.div
          animate={{ 
            y: [0, -10, 0],
            rotate: [0, -5, 5, 0]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1
          }}
          className="mb-6"
        >
          <AlertCircle className="w-16 h-16 mx-auto text-error-500 dark:text-error-400" />
        </motion.div>

        {/* Title and Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary">
            {title || t('errors.500.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-md mx-auto">
            {message || t('errors.500.message')}
          </p>
        </motion.div>

        {/* Error Details */}
        {errorDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mb-6"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-text-muted"
            >
              <motion.div
                animate={{ rotate: showDetails ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 mr-1" />
              </motion.div>
              {showDetails ? t('errors.hideDetails') : t('errors.showDetails')}
            </Button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 p-4 bg-surface-elevated rounded-lg text-left max-w-md mx-auto">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-semibold text-text-primary">
                        {t('errors.errorDetails')}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyDetails}
                        className="h-6 w-6"
                      >
                        {isCopied ? (
                          <Check className="h-3 w-3 text-success-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <dl className="space-y-1 text-xs">
                      {errorDetails.code && (
                        <>
                          <dt className="text-text-muted">{t('errors.errorCode')}:</dt>
                          <dd className="text-text-secondary font-mono">{errorDetails.code}</dd>
                        </>
                      )}
                      {errorDetails.timestamp && (
                        <>
                          <dt className="text-text-muted">{t('errors.timestamp')}:</dt>
                          <dd className="text-text-secondary font-mono">{errorDetails.timestamp}</dd>
                        </>
                      )}
                      {errorDetails.requestId && (
                        <>
                          <dt className="text-text-muted">{t('errors.requestId')}:</dt>
                          <dd className="text-text-secondary font-mono">{errorDetails.requestId}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

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
              {isRetrying ? t('errors.actions.retrying') : t('errors.actions.retry')}
            </Button>
          )}

          <Button
            variant={showRetry ? "outline" : "default"}
            size="lg"
            onClick={handleGoHome}
            className="min-w-[160px]"
          >
            <Home className="h-5 w-5" />
            {t('errors.actions.goHome')}
          </Button>

          <Button
            variant="ghost"
            size="lg"
            onClick={handleGoBack}
            className="min-w-[160px]"
          >
            <ChevronLeft className="h-5 w-5" />
            {t('errors.actions.goBack')}
          </Button>

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
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-8 text-sm text-text-muted"
        >
          {t('errors.500.helpText')}
        </motion.p>
      </motion.div>
    </div>
  )
}