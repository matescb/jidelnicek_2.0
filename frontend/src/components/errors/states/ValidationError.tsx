import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, X, ChevronDown } from 'lucide-react'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'

export interface ValidationErrorItem {
  field: string
  message: string
  code?: string
}

interface ValidationErrorProps {
  /**
   * Single error message or array of errors
   */
  errors: string | ValidationErrorItem[]
  /**
   * Field name for single field errors
   */
  fieldName?: string
  /**
   * Show as inline error (compact)
   */
  inline?: boolean
  /**
   * Show icon
   */
  showIcon?: boolean
  /**
   * Dismissible
   */
  dismissible?: boolean
  /**
   * On dismiss callback
   */
  onDismiss?: () => void
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Show error details (for multiple errors)
   */
  showDetails?: boolean
  /**
   * Initially expanded (for multiple errors)
   */
  initiallyExpanded?: boolean
}

export const ValidationError: React.FC<ValidationErrorProps> = ({
  errors,
  fieldName,
  inline = false,
  showIcon = true,
  dismissible = false,
  onDismiss,
  className = '',
  showDetails = true,
  initiallyExpanded = false
}) => {
  const { t } = useTypedTranslation()
  const [isExpanded, setIsExpanded] = React.useState(initiallyExpanded)

  const errorArray = React.useMemo(() => {
    if (typeof errors === 'string') {
      return [{
        field: fieldName || 'field',
        message: errors
      }]
    }
    return errors
  }, [errors, fieldName])

  const isSingleError = errorArray.length === 1
  const hasFieldNames = errorArray.some(e => e.field && e.field !== 'field')

  if (inline && isSingleError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.2 }}
        className={`flex items-start gap-1.5 mt-1 ${className}`}
      >
        {showIcon && (
          <AlertCircle className="h-3.5 w-3.5 text-error-500 mt-0.5 flex-shrink-0" />
        )}
        <span className="text-sm text-error-600 dark:text-error-400">
          {errorArray[0].message}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`rounded-md border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-950 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        {showIcon && (
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <AlertCircle className="h-5 w-5 text-error-600 dark:text-error-400 flex-shrink-0" />
          </motion.div>
        )}

        <div className="flex-1">
          {/* Single Error */}
          {isSingleError && (
            <p className="text-sm text-error-800 dark:text-error-200">
              {errorArray[0].message}
            </p>
          )}

          {/* Multiple Errors */}
          {!isSingleError && (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-error-800 dark:text-error-200">
                  {t('errors.validation.multipleErrors', { count: errorArray.length })}
                </h4>
                {showDetails && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-sm text-error-600 dark:text-error-400 hover:text-error-700 dark:hover:text-error-300 flex items-center gap-1"
                  >
                    <span>{isExpanded ? t('errors.hideDetails') : t('errors.showDetails')}</span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </motion.div>
                  </button>
                )}
              </div>

              <AnimatePresence>
                {(isExpanded || !showDetails) && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 space-y-1 overflow-hidden"
                  >
                    {errorArray.map((error, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="text-sm text-error-700 dark:text-error-300"
                      >
                        {hasFieldNames && (
                          <span className="font-medium">
                            {t(`fields.${error.field}`, { defaultValue: error.field })}:{' '}
                          </span>
                        )}
                        {error.message}
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-error-600 dark:text-error-400 hover:text-error-700 dark:hover:text-error-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// Field-level validation error wrapper
interface FieldValidationWrapperProps {
  error?: string | null
  touched?: boolean
  children: React.ReactNode
}

export const FieldValidationWrapper: React.FC<FieldValidationWrapperProps> = ({
  error,
  touched,
  children
}) => {
  const showError = touched && error

  return (
    <div>
      {children}
      <AnimatePresence>
        {showError && (
          <ValidationError
            errors={error}
            inline
            showIcon
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Validation summary component for forms
interface ValidationSummaryProps {
  errors: Record<string, string | string[]>
  title?: string
  className?: string
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  title,
  className = ''
}) => {
  const { t } = useTypedTranslation()
  
  const errorItems = React.useMemo(() => {
    const items: ValidationErrorItem[] = []
    
    Object.entries(errors).forEach(([field, messages]) => {
      if (Array.isArray(messages)) {
        messages.forEach(message => {
          items.push({ field, message })
        })
      } else if (messages) {
        items.push({ field, message: messages })
      }
    })
    
    return items
  }, [errors])

  if (errorItems.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`mb-6 ${className}`}
    >
      <div className="rounded-md border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-950 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-error-800 dark:text-error-200 mb-2">
              {title || t('errors.validation.formErrors')}
            </h3>
            <ul className="space-y-1">
              {errorItems.map((error, index) => (
                <li key={index} className="text-sm text-error-700 dark:text-error-300">
                  <span className="font-medium">
                    {t(`fields.${error.field}`, { defaultValue: error.field })}:
                  </span>{' '}
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  )
}