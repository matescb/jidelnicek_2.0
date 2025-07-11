import React from 'react'
import { Button } from '@/components/ui/button'
import { 
  // Pages
  ErrorPage404,
  ErrorPage403,
  ErrorPage500,
  ErrorPageOffline,
  ErrorPageMaintenance,
  // States
  EmptyState,
  ErrorState,
  LoadingError,
  NetworkError,
  ValidationError,
  ValidationSummary,
  // Notifications
  ErrorToast,
  ErrorBanner,
  ErrorAlert,
  ErrorModal,
  useErrorToast,
  useErrorModal,
  // Types
  ErrorToastType,
  ErrorBannerType,
  ErrorAlertType
} from './index'

export const ErrorShowcase: React.FC = () => {
  const [currentPage, setCurrentPage] = React.useState<string | null>(null)
  const { toasts, showToast, removeToast } = useErrorToast()
  const { isOpen, error, options, showError, hideError } = useErrorModal()

  // Sample validation errors
  const validationErrors = {
    email: 'Invalid email format',
    password: ['Password must be at least 8 characters', 'Password must contain a number'],
    username: 'Username is already taken'
  }

  const sections = [
    {
      title: 'Error Pages',
      description: 'Full page error states for routing errors',
      items: [
        {
          label: '404 - Not Found',
          onClick: () => setCurrentPage('404')
        },
        {
          label: '403 - Forbidden',
          onClick: () => setCurrentPage('403')
        },
        {
          label: '500 - Server Error',
          onClick: () => setCurrentPage('500')
        },
        {
          label: 'Offline',
          onClick: () => setCurrentPage('offline')
        },
        {
          label: 'Maintenance',
          onClick: () => setCurrentPage('maintenance')
        }
      ]
    },
    {
      title: 'Error States',
      description: 'Component-level error states',
      component: (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-3">Empty States</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmptyState
                type="search"
                message="No results found for your search"
                primaryAction={{
                  label: 'Clear filters',
                  onClick: () => console.log('Clear filters')
                }}
              />
              <EmptyState
                type="list"
                message="No items to display"
                primaryAction={{
                  label: 'Add item',
                  onClick: () => console.log('Add item')
                }}
                compact
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Error States</h4>
            <div className="space-y-4">
              <ErrorState
                error={new Error('Failed to load data')}
                onRetry={() => console.log('Retry')}
                compact
              />
              <LoadingError
                type="network"
                resource="recipes"
                onRetry={() => console.log('Retry')}
              />
              <NetworkError
                showOfflineMode
                onOfflineMode={() => console.log('Offline mode')}
                compact
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Validation Errors</h4>
            <div className="space-y-4">
              <ValidationError
                errors="This field is required"
                inline
                showIcon
              />
              <ValidationSummary errors={validationErrors} />
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Notifications',
      description: 'Toast, banner, alert, and modal notifications',
      component: (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-3">Toasts</h4>
            <div className="flex flex-wrap gap-2">
              {(['error', 'warning', 'success', 'info'] as ErrorToastType[]).map(type => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => showToast({
                    type,
                    title: `${type.charAt(0).toUpperCase() + type.slice(1)} Toast`,
                    message: `This is a ${type} toast message`,
                    action: {
                      label: 'Undo',
                      onClick: () => console.log('Undo')
                    }
                  })}
                >
                  Show {type} toast
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Banners</h4>
            <div className="space-y-2">
              {(['error', 'warning', 'success', 'info'] as ErrorBannerType[]).map(type => (
                <ErrorBanner
                  key={type}
                  type={type}
                  title={`${type.charAt(0).toUpperCase() + type.slice(1)} Banner`}
                  message={`This is a ${type} banner message`}
                  primaryAction={{
                    label: 'Take action',
                    onClick: () => console.log('Action')
                  }}
                  slim
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Alerts</h4>
            <div className="space-y-2">
              {(['error', 'warning', 'success', 'info'] as ErrorAlertType[]).map(type => (
                <ErrorAlert
                  key={type}
                  type={type}
                  title={`${type.charAt(0).toUpperCase() + type.slice(1)} Alert`}
                  message={`This is a ${type} alert message`}
                  details="Additional details about this alert"
                  collapsible
                  dismissible
                  actions={[
                    {
                      label: 'Primary',
                      onClick: () => console.log('Primary'),
                      variant: 'primary'
                    },
                    {
                      label: 'Secondary',
                      onClick: () => console.log('Secondary')
                    }
                  ]}
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Modal</h4>
            <Button
              variant="outline"
              onClick={() => showError(
                new Error('This is a sample error'),
                {
                  title: 'Operation Failed',
                  details: {
                    code: 'ERR_SAMPLE',
                    timestamp: new Date().toISOString(),
                    requestId: 'req_123456',
                    additionalInfo: {
                      endpoint: '/api/sample',
                      method: 'POST'
                    }
                  },
                  onRetry: () => {
                    console.log('Retry')
                    return new Promise(resolve => setTimeout(resolve, 1000))
                  },
                  showReport: true,
                  onReport: () => console.log('Report')
                }
              )}
            >
              Show Error Modal
            </Button>
          </div>
        </div>
      )
    }
  ]

  // Render full page error if selected
  if (currentPage) {
    const pageProps = {
      customAction: {
        label: 'Back to showcase',
        onClick: () => setCurrentPage(null)
      }
    }

    switch (currentPage) {
      case '404':
        return <ErrorPage404 {...pageProps} />
      case '403':
        return <ErrorPage403 {...pageProps} />
      case '500':
        return <ErrorPage500 {...pageProps} errorDetails={{
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date().toISOString(),
          requestId: 'req_' + Math.random().toString(36).substr(2, 9)
        }} />
      case 'offline':
        return <ErrorPageOffline {...pageProps} />
      case 'maintenance':
        return <ErrorPageMaintenance {...pageProps} estimatedEndTime={new Date(Date.now() + 3600000)} showProgress progress={65} />
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-4">Error Components Showcase</h1>
        <p className="text-text-secondary">
          Comprehensive error handling UI components for all error scenarios
        </p>
      </div>

      {sections.map((section, index) => (
        <div key={index} className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">{section.title}</h2>
            <p className="text-text-secondary">{section.description}</p>
          </div>
          
          {section.items ? (
            <div className="flex flex-wrap gap-2">
              {section.items.map((item, itemIndex) => (
                <Button
                  key={itemIndex}
                  variant="outline"
                  onClick={item.onClick}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg p-6 bg-surface">
              {section.component}
            </div>
          )}
        </div>
      ))}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <ErrorToast
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={isOpen}
        onClose={hideError}
        error={error}
        {...options}
      />
    </div>
  )
}