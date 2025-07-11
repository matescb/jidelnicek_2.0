import { Component, ReactNode, ErrorInfo } from 'react'
import { Link } from 'react-router-dom'
import { errorLogger, ErrorSeverity } from '@/services/errorLogger'
import { getUserFriendlyMessage, formatErrorForDevelopment, isRetryableError } from '@/utils/errorHelpers'
import { ErrorContext, ErrorContextValue } from '@/contexts/ErrorContext'
import { ErrorMessage } from '@/components/ui/error/ErrorMessage'
import { Button } from '@/components/ui/button'
import { RefreshCw, Home, Bug, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  children?: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolate?: boolean
  level?: 'page' | 'section' | 'component'
  showDetails?: boolean
  enableRecovery?: boolean
  customErrorComponent?: React.ComponentType<{
    error: Error
    retry: () => void
    reset: () => void
  }>
}

interface State {
  hasError: boolean
  error: Error | null
  errorId: string | null
  errorInfo: ErrorInfo | null
  retryCount: number
  isRecovering: boolean
  isCopied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  static contextType = ErrorContext
  declare context: ErrorContextValue | undefined

  private resetTimeoutId?: NodeJS.Timeout
  private previousResetKeys?: Array<string | number>

  public state: State = {
    hasError: false,
    error: null,
    errorId: null,
    errorInfo: null,
    retryCount: 0,
    isRecovering: false,
    isCopied: false
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props
    
    // Determine severity based on error boundary level
    const severity = level === 'page' ? ErrorSeverity.HIGH : 
                    level === 'section' ? ErrorSeverity.MEDIUM : 
                    ErrorSeverity.LOW

    // Log error with context
    const errorId = errorLogger.logError(error, severity, errorInfo, {
      component: this.constructor.name,
      metadata: {
        level,
        retryCount: this.state.retryCount
      }
    })

    // Update state with error info
    this.setState({ errorId, errorInfo })

    // If we have error context, report to it
    if (this.context && !this.props.isolate) {
      this.context.captureError(error, errorInfo, severity, {
        component: this.constructor.name
      })
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo)
    }

    // Set up recovery timeout for retryable errors
    if (this.props.enableRecovery && isRetryableError(error)) {
      this.scheduleRecovery()
    }
  }

  componentDidMount() {
    this.previousResetKeys = this.props.resetKeys
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state
    
    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetOnPropsChange && this.hasResetKeysChanged(resetKeys)) {
        this.resetError()
      }
    }
    
    this.previousResetKeys = resetKeys
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  private hasResetKeysChanged = (resetKeys?: Array<string | number>): boolean => {
    if (!resetKeys || !this.previousResetKeys) {
      return false
    }
    
    if (resetKeys.length !== this.previousResetKeys.length) {
      return true
    }
    
    return resetKeys.some((key, index) => key !== this.previousResetKeys![index])
  }

  private scheduleRecovery = () => {
    const { retryCount } = this.state
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000) // Exponential backoff, max 30s
    
    this.resetTimeoutId = setTimeout(() => {
      this.handleRetry()
    }, delay)
  }

  private handleRetry = async () => {
    const { errorId } = this.state
    
    if (!errorId || !errorLogger.shouldRetry(errorId)) {
      return
    }
    
    this.setState({ isRecovering: true })
    
    try {
      // If we have error context and recovery callbacks
      if (this.context && errorId) {
        const recovered = await this.context.attemptRecovery(errorId)
        if (recovered) {
          this.resetError()
          return
        }
      }
      
      // Otherwise, just reset the error boundary
      this.resetError()
    } catch (error) {
      console.error('Recovery failed:', error)
      this.setState({ isRecovering: false })
    }
  }

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false
    })
    
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = undefined
    }
  }

  private handleCopyError = async () => {
    const { error, errorInfo } = this.state
    if (!error) return
    
    const errorText = formatErrorForDevelopment(error)
    const fullText = `${errorText}\n\nComponent Stack:${errorInfo?.componentStack || 'Not available'}`
    
    try {
      await navigator.clipboard.writeText(fullText)
      this.setState({ isCopied: true })
      setTimeout(() => this.setState({ isCopied: false }), 2000)
    } catch (err) {
      console.error('Failed to copy error:', err)
    }
  }

  public render() {
    const { 
      hasError, 
      error, 
      errorInfo, 
      retryCount, 
      isRecovering, 
      isCopied 
    } = this.state
    
    const { 
      children, 
      fallback, 
      customErrorComponent: CustomError,
      level = 'component',
      showDetails = process.env.NODE_ENV === 'development'
    } = this.props

    if (hasError && error) {
      // Use custom error component if provided
      if (CustomError) {
        return (
          <CustomError 
            error={error} 
            retry={() => this.handleRetry()} 
            reset={() => this.resetError()}
          />
        )
      }

      // Use fallback if provided
      if (fallback) {
        return <>{fallback}</>
      }

      const { title, message, action } = getUserFriendlyMessage(error)
      const isRetryable = isRetryableError(error)

      // Component-level error
      if (level === 'component') {
        return (
          <ErrorMessage
            type="error"
            title={title}
            message={message}
            details={showDetails ? error.stack : undefined}
            onDismiss={() => this.resetError()}
          />
        )
      }

      // Page or section level error
      return (
        <div className={`${level === 'page' ? 'min-h-screen' : 'min-h-[400px]'} flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4`}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full text-center"
          >
            <AnimatePresence mode="wait">
              {isRecovering ? (
                <motion.div
                  key="recovering"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-8"
                >
                  <RefreshCw className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                  <p className="mt-4 text-gray-600 dark:text-gray-400">
                    Attempting to recover...
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="mb-8">
                    <motion.div
                      animate={{ 
                        rotate: [0, -10, 10, -10, 0],
                        transition: { duration: 0.5 }
                      }}
                    >
                      <Bug className="mx-auto h-12 w-12 text-red-500" />
                    </motion.div>
                  </div>
                  
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {title}
                  </h1>
                  
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    {message}
                  </p>
                  
                  {retryCount > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                      Retry attempt: {retryCount}
                    </p>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {isRetryable && (
                      <Button
                        onClick={() => this.handleRetry()}
                        disabled={isRecovering}
                        className="inline-flex items-center"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {action || 'Try Again'}
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Page
                    </Button>
                    
                    <Link to="/">
                      <Button variant="outline" className="w-full sm:w-auto">
                        <Home className="mr-2 h-4 w-4" />
                        Go Home
                      </Button>
                    </Link>
                  </div>
                  
                  {showDetails && error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-8"
                    >
                      <details className="text-left">
                        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center gap-2">
                          <Bug className="h-4 w-4" />
                          Developer Details
                        </summary>
                        <div className="mt-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Error Details</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={this.handleCopyError}
                              className="h-6 px-2"
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto p-4 bg-red-50 dark:bg-red-900/20 rounded-lg max-h-64">
{formatErrorForDevelopment(error)}

Component Stack:
{errorInfo?.componentStack || 'Not available'}
                          </pre>
                        </div>
                      </details>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )
    }

    return <>{children}</>
  }
}

// HOC for adding error boundary to components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Props
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Hook for error boundary (for functional components)
export function useErrorHandler() {
  return (error: Error) => {
    throw error // This will be caught by the nearest error boundary
  }
}