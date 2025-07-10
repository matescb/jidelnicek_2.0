/**
 * Post-submission feedback component
 * Shows success, error, or warning messages with appropriate styling and actions
 */

import React, { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { CheckCircle, XCircle, AlertTriangle, Info, X, RotateCcw, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

export type FeedbackType = 'success' | 'error' | 'warning' | 'info'

export interface FeedbackAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  icon?: React.ReactNode
}

export interface SubmissionFeedbackProps {
  /**
   * Feedback type
   */
  type: FeedbackType
  /**
   * Main message
   */
  message: string
  /**
   * Additional details or description
   */
  description?: string
  /**
   * List of items (for errors, next steps, etc.)
   */
  items?: string[]
  /**
   * Actions to display
   */
  actions?: FeedbackAction[]
  /**
   * Auto-dismiss after delay (ms)
   */
  autoDismiss?: number
  /**
   * Dismissible by user
   */
  dismissible?: boolean
  /**
   * Dismiss callback
   */
  onDismiss?: () => void
  /**
   * Show icon
   */
  showIcon?: boolean
  /**
   * Compact variant
   */
  compact?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Animation variant
   */
  animation?: 'fade' | 'slide' | 'scale'
  /**
   * Position for slide animation
   */
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export const SubmissionFeedback: React.FC<SubmissionFeedbackProps> = ({
  type,
  message,
  description,
  items,
  actions,
  autoDismiss,
  dismissible = true,
  onDismiss,
  showIcon = true,
  compact = false,
  className,
  animation = 'fade',
  position = 'top',
}) => {
  const { t } = useTranslation()
  const dismissTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (autoDismiss && autoDismiss > 0) {
      dismissTimerRef.current = setTimeout(() => {
        onDismiss?.()
      }, autoDismiss)
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current)
      }
    }
  }, [autoDismiss, onDismiss])

  const iconConfig = {
    success: { Icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
    error: { Icon: XCircle, color: 'text-red-600 dark:text-red-400' },
    warning: { Icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400' },
    info: { Icon: Info, color: 'text-blue-600 dark:text-blue-400' },
  }

  const backgroundConfig = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  }

  const textConfig = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
    info: 'text-blue-800 dark:text-blue-200',
  }

  const { Icon, color: iconColor } = iconConfig[type]

  const animationVariants = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slide: {
      initial: {
        opacity: 0,
        x: position === 'left' ? -20 : position === 'right' ? 20 : 0,
        y: position === 'top' ? -20 : position === 'bottom' ? 20 : 0,
      },
      animate: { opacity: 1, x: 0, y: 0 },
      exit: {
        opacity: 0,
        x: position === 'left' ? -20 : position === 'right' ? 20 : 0,
        y: position === 'top' ? -20 : position === 'bottom' ? 20 : 0,
      },
    },
    scale: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.9 },
    },
  }

  return (
    <motion.div
      className={clsx(
        'rounded-lg border',
        backgroundConfig[type],
        compact ? 'p-3' : 'p-4',
        className
      )}
      variants={animationVariants[animation]}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex">
        {showIcon && (
          <div className="flex-shrink-0">
            <Icon className={clsx(compact ? 'h-4 w-4' : 'h-5 w-5', iconColor)} />
          </div>
        )}
        
        <div className={clsx('flex-1', showIcon && (compact ? 'ml-2' : 'ml-3'))}>
          <h3 className={clsx(
            'font-medium',
            compact ? 'text-sm' : 'text-base',
            textConfig[type]
          )}>
            {message}
          </h3>
          
          {description && (
            <p className={clsx(
              'mt-1',
              compact ? 'text-xs' : 'text-sm',
              textConfig[type],
              'opacity-90'
            )}>
              {description}
            </p>
          )}
          
          {items && items.length > 0 && (
            <ul className={clsx(
              'mt-2 space-y-1',
              compact ? 'text-xs' : 'text-sm',
              textConfig[type],
              'opacity-90'
            )}>
              {items.map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          
          {actions && actions.length > 0 && (
            <div className={clsx(
              'flex flex-wrap gap-2',
              compact ? 'mt-2' : 'mt-3'
            )}>
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={clsx(
                    'inline-flex items-center font-medium rounded transition-colors',
                    compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
                    action.variant === 'primary'
                      ? clsx(
                          type === 'success' && 'bg-green-600 text-white hover:bg-green-700',
                          type === 'error' && 'bg-red-600 text-white hover:bg-red-700',
                          type === 'warning' && 'bg-yellow-600 text-white hover:bg-yellow-700',
                          type === 'info' && 'bg-blue-600 text-white hover:bg-blue-700'
                        )
                      : clsx(
                          'bg-white dark:bg-gray-800 border',
                          type === 'success' && 'border-green-300 text-green-700 hover:bg-green-50',
                          type === 'error' && 'border-red-300 text-red-700 hover:bg-red-50',
                          type === 'warning' && 'border-yellow-300 text-yellow-700 hover:bg-yellow-50',
                          type === 'info' && 'border-blue-300 text-blue-700 hover:bg-blue-50'
                        )
                  )}
                >
                  {action.icon && (
                    <span className="mr-1.5">{action.icon}</span>
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {dismissible && (
          <div className="flex-shrink-0 ml-3">
            <button
              onClick={onDismiss}
              className={clsx(
                'rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
                textConfig[type]
              )}
              aria-label={t('common.close')}
            >
              <X className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/**
 * Next steps component for guiding users after form submission
 */
export interface NextStepsProps {
  /**
   * Steps to display
   */
  steps: Array<{
    label: string
    description?: string
    action?: () => void
    completed?: boolean
  }>
  /**
   * Title
   */
  title?: string
  /**
   * Variant style
   */
  variant?: 'list' | 'cards'
  /**
   * Additional CSS classes
   */
  className?: string
}

export const NextSteps: React.FC<NextStepsProps> = ({
  steps,
  title,
  variant = 'list',
  className,
}) => {
  const { t } = useTranslation()

  if (variant === 'cards') {
    return (
      <div className={className}>
        {title && (
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            {title}
          </h3>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className={clsx(
                'relative rounded-lg border p-4 transition-all',
                step.completed
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300'
              )}
            >
              <div className="flex items-start">
                <div
                  className={clsx(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    step.completed
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {step.completed ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <div className="ml-3 flex-1">
                  <h4 className={clsx(
                    'font-medium',
                    step.completed
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-gray-900 dark:text-gray-100'
                  )}>
                    {step.label}
                  </h4>
                  {step.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {step.description}
                    </p>
                  )}
                  {step.action && !step.completed && (
                    <button
                      onClick={step.action}
                      className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center"
                    >
                      {t('common.continue')}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {title && (
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          {title}
        </h3>
      )}
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start">
            <div
              className={clsx(
                'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                step.completed
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              )}
            >
              {step.completed ? <Check className="w-3 h-3" /> : index + 1}
            </div>
            <div className="ml-3 flex-1">
              <p className={clsx(
                'font-medium',
                step.completed
                  ? 'text-green-800 dark:text-green-200 line-through'
                  : 'text-gray-900 dark:text-gray-100'
              )}>
                {step.label}
              </p>
              {step.description && (
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>
              )}
              {step.action && !step.completed && (
                <button
                  onClick={step.action}
                  className="mt-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  {t('common.markComplete')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Feedback with retry mechanism
 */
export interface RetryFeedbackProps extends Omit<SubmissionFeedbackProps, 'actions'> {
  /**
   * Retry handler
   */
  onRetry: () => void
  /**
   * Retry button text
   */
  retryText?: string
  /**
   * Show retry count
   */
  retryCount?: number
  /**
   * Max retries
   */
  maxRetries?: number
}

export const RetryFeedback: React.FC<RetryFeedbackProps> = ({
  onRetry,
  retryText,
  retryCount = 0,
  maxRetries = 3,
  ...props
}) => {
  const { t } = useTranslation()
  const canRetry = maxRetries === undefined || retryCount < maxRetries

  const actions: FeedbackAction[] = []

  if (canRetry) {
    actions.push({
      label: retryText || t('common.retry'),
      onClick: onRetry,
      variant: 'primary',
      icon: <RotateCcw className="h-3 w-3" />,
    })
  }

  const description = props.description || (
    retryCount > 0 && canRetry
      ? t('form.retryAttempt', { current: retryCount, max: maxRetries })
      : retryCount >= maxRetries
      ? t('form.maxRetriesReached')
      : undefined
  )

  return (
    <SubmissionFeedback
      {...props}
      description={description}
      actions={actions}
    />
  )
}