import React, { useState } from 'react';
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from './ErrorBoundary';
import { ErrorProvider, useErrorContext, useErrorCapture } from '@/contexts/ErrorContext';
import { ErrorSeverity, errorLogger } from '@/services/errorLogger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Zap, RefreshCw } from 'lucide-react';

// Component that throws errors
const ErrorThrower: React.FC = () => {
  const [errorType, setErrorType] = useState<string>('');
  const handleError = useErrorHandler();
  const captureError = useErrorCapture();

  const throwError = (type: string) => {
    setErrorType(type);
    
    switch (type) {
      case 'network':
        throw new Error('NetworkError: Failed to fetch data from server');
      case 'auth':
        throw new Error('401 Unauthorized: Your session has expired');
      case 'validation':
        throw new Error('ValidationError: Invalid email format');
      case 'async':
        // Async errors need to be caught and rethrown
        setTimeout(() => {
          try {
            throw new Error('AsyncError: Something went wrong asynchronously');
          } catch (error) {
            handleError(error as Error);
          }
        }, 100);
        break;
      case 'captured':
        // Manually capture error without throwing
        captureError(
          new Error('Captured error: This was caught manually'),
          ErrorSeverity.MEDIUM,
          { component: 'ErrorThrower', action: 'manual-capture' }
        );
        break;
      default:
        throw new Error('Unknown error occurred');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Thrower Component</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click buttons to throw different types of errors:
        </p>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => throwError('network')}
          >
            Network Error
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => throwError('auth')}
          >
            Auth Error
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => throwError('validation')}
          >
            Validation Error
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => throwError('async')}
          >
            Async Error
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => throwError('captured')}
          >
            Captured Error
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => throwError('unknown')}
          >
            Unknown Error
          </Button>
        </div>
        
        {errorType && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Last error type: {errorType}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Component with its own error boundary
const IsolatedComponent = withErrorBoundary(() => {
  const [shouldError, setShouldError] = useState(false);
  
  if (shouldError) {
    throw new Error('Isolated component error');
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Isolated Component</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This component has its own error boundary
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShouldError(true)}
        >
          Throw Isolated Error
        </Button>
      </CardContent>
    </Card>
  );
}, {
  level: 'component',
  isolate: true,
  fallback: (
    <Card className="border-red-500">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Isolated component failed</span>
        </div>
      </CardContent>
    </Card>
  )
});

// Error history viewer
const ErrorHistoryViewer: React.FC = () => {
  const { errors, dismissError, dismissAll, clearAll, getErrorCount } = useErrorContext();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Error History</span>
          <span className="text-sm font-normal text-gray-500">
            {getErrorCount()} errors
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <p className="text-sm text-gray-500">No errors recorded</p>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2 mb-4">
              <Button size="sm" variant="outline" onClick={dismissAll}>
                Dismiss All
              </Button>
              <Button size="sm" variant="destructive" onClick={clearAll}>
                Clear All
              </Button>
            </div>
            
            {errors.map(error => (
              <div
                key={error.id}
                className="p-3 border rounded-lg bg-red-50 dark:bg-red-900/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {error.error.message}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {error.severity} • {error.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissError(error.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main example component
export const ErrorBoundaryExample: React.FC = () => {
  const [resetKey, setResetKey] = useState(0);
  
  // Configure error logger
  React.useEffect(() => {
    errorLogger.configure({
      customEndpoint: {
        url: '/api/errors',
        headers: { 'X-API-Key': 'demo' }
      }
    });
    
    errorLogger.setRateLimit({
      maxErrors: 5,
      windowMs: 30000 // 30 seconds
    });
  }, []);
  
  return (
    <ErrorProvider 
      maxErrors={20}
      autoRecovery={true}
      onError={(error) => {
        console.log('Error captured by provider:', error);
      }}
    >
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Error Boundary Example</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Demonstrating comprehensive error handling with recovery
          </p>
        </div>
        
        {/* Page-level error boundary */}
        <ErrorBoundary
          level="page"
          resetKeys={[resetKey]}
          resetOnPropsChange={true}
          enableRecovery={true}
          showDetails={true}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Component that can throw errors */}
            <ErrorBoundary
              level="section"
              fallback={
                <Card className="border-orange-500">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Zap className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                      <p className="text-orange-700 dark:text-orange-300">
                        This section encountered an error
                      </p>
                    </div>
                  </CardContent>
                </Card>
              }
            >
              <ErrorThrower />
            </ErrorBoundary>
            
            {/* Isolated component with own boundary */}
            <IsolatedComponent />
            
            {/* Error history */}
            <div className="md:col-span-2">
              <ErrorHistoryViewer />
            </div>
          </div>
          
          {/* Reset button */}
          <div className="text-center mt-6">
            <Button
              onClick={() => setResetKey(prev => prev + 1)}
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset All Error Boundaries
            </Button>
          </div>
        </ErrorBoundary>
        
        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Features Demonstrated</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="list-disc list-inside space-y-1">
              <li>Multi-level error boundaries (page, section, component)</li>
              <li>Error classification and severity levels</li>
              <li>Automatic error recovery with exponential backoff</li>
              <li>Error logging with rate limiting</li>
              <li>Global error context and history tracking</li>
              <li>Custom error components and fallbacks</li>
              <li>Reset keys for programmatic recovery</li>
              <li>Isolated error boundaries that don't affect siblings</li>
              <li>i18n support for error messages</li>
              <li>Developer-friendly error details in development mode</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </ErrorProvider>
  );
};

export default ErrorBoundaryExample;