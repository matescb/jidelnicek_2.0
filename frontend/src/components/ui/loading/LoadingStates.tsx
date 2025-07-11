import React, { ReactNode, Suspense, Component, ErrorInfo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, RefreshCw, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'
import { Button } from '../button'

// Content Loader Wrapper
export interface ContentLoaderProps {
  isLoading: boolean
  isError?: boolean
  isEmpty?: boolean
  error?: Error | null
  onRetry?: () => void
  loadingComponent?: ReactNode
  errorComponent?: ReactNode
  emptyComponent?: ReactNode
  children: ReactNode
  className?: string
}

export const ContentLoader: React.FC<ContentLoaderProps> = ({
  isLoading,
  isError = false,
  isEmpty = false,
  error,
  onRetry,
  loadingComponent,
  errorComponent,
  emptyComponent,
  children,
  className
}) => {
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[200px]', className)}>
        {loadingComponent || <Spinner size="lg" />}
      </div>
    )
  }
  
  if (isError) {
    return (
      <div className={cn('flex items-center justify-center min-h-[200px]', className)}>
        {errorComponent || (
          <ErrorState 
            error={error} 
            onRetry={onRetry}
          />
        )}
      </div>
    )
  }
  
  if (isEmpty) {
    return (
      <div className={cn('flex items-center justify-center min-h-[200px]', className)}>
        {emptyComponent || <EmptyState />}
      </div>
    )
  }
  
  return <>{children}</>
}

// Error State Component
export interface ErrorStateProps {
  error?: Error | null
  message?: string
  onRetry?: () => void
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  message = 'Something went wrong',
  onRetry,
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center gap-4 p-8 text-center', className)}
    >
      <AlertCircle className="h-12 w-12 text-red-500" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {message}
        </h3>
        {error?.message && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error.message}
          </p>
        )}
      </div>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Try Again
        </Button>
      )}
    </motion.div>
  )
}

// Empty State Component
export interface EmptyStateProps {
  title?: string
  message?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data found',
  message = 'There are no items to display at the moment.',
  icon,
  action,
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center gap-4 p-8 text-center', className)}
    >
      {icon || <Package className="h-12 w-12 text-gray-400" />}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
          {message}
        </p>
      </div>
      {action}
    </motion.div>
  )
}

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
  },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <ErrorState
            error={this.state.error}
            message="Application error"
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        )
      )
    }
    
    return this.props.children
  }
}

// Suspense Fallback Component
export interface SuspenseFallbackProps {
  message?: string
  spinnerVariant?: 'circle' | 'dots' | 'bars' | 'pulse'
  className?: string
}

export const SuspenseFallback: React.FC<SuspenseFallbackProps> = ({
  message = 'Loading...',
  spinnerVariant = 'circle',
  className
}) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-4 min-h-[200px]',
      className
    )}>
      <Spinner variant={spinnerVariant} size="lg" />
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  )
}

// Async Component Wrapper
export interface AsyncComponentProps {
  children: ReactNode
  fallback?: ReactNode
  errorFallback?: ReactNode
}

export const AsyncComponent: React.FC<AsyncComponentProps> = ({
  children,
  fallback,
  errorFallback
}) => {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback || <SuspenseFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}