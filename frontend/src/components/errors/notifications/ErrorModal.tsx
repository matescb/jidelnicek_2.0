import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, X, Copy, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

interface ErrorModalProps {
  /**
   * Open state
   */
  isOpen: boolean
  /**
   * Close callback
   */
  onClose: () => void
  /**
   * Error object or message
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
   * Error details
   */
  details?: {
    code?: string
    timestamp?: string
    requestId?: string
    stack?: string
    additionalInfo?: Record<string, any>
  }
  /**
   * Show retry button
   */
  showRetry?: boolean
  /**
   * Retry callback
   */
  onRetry?: () => void | Promise<void>
  /**
   * Show report button
   */
  showReport?: boolean
  /**
   * Report callback
   */
  onReport?: () => void
  /**
   * Custom actions
   */
  customActions?: Array<{
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  }>
  /**
   * Show illustration
   */
  showIllustration?: boolean
  /**
   * Prevent closing on backdrop click
   */
  preventBackdropClose?: boolean
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  error,
  title,
  message,
  details,
  showRetry = true,
  onRetry,
  showReport = false,
  onReport,
  customActions,
  showIllustration = true,
  preventBackdropClose = false
}) => {
  const { t } = useTypedTranslation()
  const [isRetrying, setIsRetrying] = React.useState(false)
  const [isCopied, setIsCopied] = React.useState(false)
  const [showDetails, setShowDetails] = React.useState(false)

  // Extract error message
  const errorMessage = React.useMemo(() => {
    if (message) return message
    if (!error) return t('errors.generic.message')
    if (typeof error === 'string') return error
    return error.message || t('errors.generic.message')
  }, [error, message, t])

  const errorTitle = title || t('errors.generic.title')

  const handleRetry = async () => {
    if (!onRetry) return
    
    setIsRetrying(true)
    try {
      await onRetry()
      onClose()
    } catch (err) {
      // Retry failed, keep modal open
    } finally {
      setTimeout(() => setIsRetrying(false), 500)
    }
  }

  const handleCopyDetails = async () => {
    const detailsText = `
Error: ${errorTitle}
Message: ${errorMessage}
${details?.code ? `Code: ${details.code}` : ''}
${details?.timestamp ? `Timestamp: ${details.timestamp}` : ''}
${details?.requestId ? `Request ID: ${details.requestId}` : ''}
${error instanceof Error && error.stack ? `\nStack Trace:\n${error.stack}` : ''}
${details?.stack ? `\nStack Trace:\n${details.stack}` : ''}
${details?.additionalInfo ? `\nAdditional Info:\n${JSON.stringify(details.additionalInfo, null, 2)}` : ''}
    `.trim()

    await navigator.clipboard.writeText(detailsText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !preventBackdropClose) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleBackdropClick}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-surface rounded-lg shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-error-100 dark:bg-error-900">
                    <AlertCircle className="h-6 w-6 text-error-600 dark:text-error-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-text-primary">
                    {errorTitle}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                {/* Illustration */}
                {showIllustration && (
                  <div className="mb-4 flex justify-center">
                    <ErrorIllustration
                      type="error"
                      className="w-32 h-32"
                      animated
                    />
                  </div>
                )}

                {/* Message */}
                <p className="text-text-secondary mb-4">
                  {errorMessage}
                </p>

                {/* Details */}
                {(details || (error instanceof Error && import.meta.env.DEV)) && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
                    >
                      <motion.div
                        animate={{ rotate: showDetails ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </motion.div>
                      {showDetails ? t('errors.hideDetails') : t('errors.showDetails')}
                    </button>

                    <AnimatePresence>
                      {showDetails && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 p-3 bg-surface-elevated rounded-md">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-sm font-medium text-text-primary">
                                {t('errors.errorDetails')}
                              </h4>
                              <button
                                onClick={handleCopyDetails}
                                className="text-text-muted hover:text-text-primary"
                              >
                                {isCopied ? (
                                  <Check className="h-4 w-4 text-success-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                            <dl className="space-y-1 text-xs">
                              {details?.code && (
                                <>
                                  <dt className="text-text-muted">{t('errors.errorCode')}:</dt>
                                  <dd className="text-text-secondary font-mono mb-2">{details.code}</dd>
                                </>
                              )}
                              {details?.timestamp && (
                                <>
                                  <dt className="text-text-muted">{t('errors.timestamp')}:</dt>
                                  <dd className="text-text-secondary font-mono mb-2">{details.timestamp}</dd>
                                </>
                              )}
                              {details?.requestId && (
                                <>
                                  <dt className="text-text-muted">{t('errors.requestId')}:</dt>
                                  <dd className="text-text-secondary font-mono mb-2">{details.requestId}</dd>
                                </>
                              )}
                              {(details?.stack || (error instanceof Error && error.stack)) && (
                                <>
                                  <dt className="text-text-muted">{t('errors.stackTrace')}:</dt>
                                  <dd className="text-text-secondary font-mono text-xs">
                                    <pre className="mt-1 overflow-auto max-h-32">
                                      {details?.stack || (error instanceof Error && error.stack)}
                                    </pre>
                                  </dd>
                                </>
                              )}
                            </dl>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {showRetry && onRetry && (
                    <Button
                      variant="default"
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="flex-1"
                    >
                      {isRetrying ? t('errors.actions.retrying') : t('errors.actions.retry')}
                    </Button>
                  )}

                  {showReport && onReport && (
                    <Button
                      variant="outline"
                      onClick={onReport}
                      className="flex-1"
                    >
                      {t('errors.actions.report')}
                    </Button>
                  )}

                  {customActions?.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant || 'outline'}
                      onClick={action.onClick}
                      className="flex-1"
                    >
                      {action.label}
                    </Button>
                  ))}

                  <Button
                    variant="ghost"
                    onClick={onClose}
                    className="flex-1"
                  >
                    {t('errors.actions.close')}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Hook for managing error modals
export const useErrorModal = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [error, setError] = React.useState<Error | string | null>(null)
  const [options, setOptions] = React.useState<Partial<ErrorModalProps>>({})

  const showError = React.useCallback((
    error: Error | string,
    modalOptions?: Partial<ErrorModalProps>
  ) => {
    setError(error)
    setOptions(modalOptions || {})
    setIsOpen(true)
  }, [])

  const hideError = React.useCallback(() => {
    setIsOpen(false)
    // Clear error after animation
    setTimeout(() => {
      setError(null)
      setOptions({})
    }, 300)
  }, [])

  return {
    isOpen,
    error,
    options,
    showError,
    hideError
  }
}