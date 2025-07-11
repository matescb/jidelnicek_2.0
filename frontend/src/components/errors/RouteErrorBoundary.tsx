import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary, withErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search, FileQuestion, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ErrorInfo } from 'react';
import { errorLogger, ErrorSeverity } from '@/services/errorLogger';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  routeName?: string;
  suggestedRoutes?: Array<{
    path: string;
    label: string;
    icon?: React.ReactNode;
  }>;
}

const RouteErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  reset: () => void;
  routeName?: string;
  suggestedRoutes?: Array<{
    path: string;
    label: string;
    icon?: React.ReactNode;
  }>;
}> = ({ error, retry, reset, routeName, suggestedRoutes }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect if it's a 404 error
  const is404 = error.message.toLowerCase().includes('not found') || 
                error.message.includes('404');

  // Default suggested routes based on common navigation patterns
  const defaultSuggestions = [
    { path: '/', label: t('navigation.home'), icon: <Home className="h-4 w-4" /> },
    { path: '/recipes', label: t('navigation.recipes'), icon: <Search className="h-4 w-4" /> },
    { path: '/meal-plans', label: t('navigation.mealPlans'), icon: <MapPin className="h-4 w-4" /> },
  ];

  const suggestions = suggestedRoutes || defaultSuggestions;

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', damping: 15 }}
          className="mb-8"
        >
          <div className="mx-auto h-24 w-24 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <FileQuestion className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </motion.div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {is404 ? t('errors.route.notFound') : t('errors.route.title')}
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-2">
          {is404 
            ? t('errors.route.notFoundMessage', { path: location.pathname })
            : t('errors.route.message', { route: routeName || location.pathname })
          }
        </p>

        {!is404 && (
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-8">
            {t('errors.route.details')}
          </p>
        )}

        {/* Main Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Button
            onClick={handleGoBack}
            variant="outline"
            className="inline-flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.goBack')}
          </Button>

          {!is404 && (
            <Button
              onClick={retry}
              className="inline-flex items-center"
            >
              {t('common.tryAgain')}
            </Button>
          )}

          <Link to="/">
            <Button variant={is404 ? 'default' : 'outline'}>
              <Home className="mr-2 h-4 w-4" />
              {t('common.goHome')}
            </Button>
          </Link>
        </div>

        {/* Suggested Routes */}
        <div className="border-t pt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('errors.route.suggestions')}
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {suggestions.map((route) => (
              <Link
                key={route.path}
                to={route.path}
                className="group"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 
                           bg-white dark:bg-gray-800 hover:border-primary 
                           dark:hover:border-primary transition-colors"
                >
                  <div className="flex flex-col items-center gap-2">
                    {route.icon && (
                      <div className="text-gray-400 group-hover:text-primary transition-colors">
                        {route.icon}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 
                                   group-hover:text-primary dark:group-hover:text-primary 
                                   transition-colors">
                      {route.label}
                    </span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Developer Details */}
        {process.env.NODE_ENV === 'development' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-8"
          >
            <details className="text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 
                               dark:hover:text-gray-300 text-center">
                {t('errors.developerDetails')}
              </summary>
              <pre className="mt-4 text-xs text-red-600 dark:text-red-400 overflow-auto 
                            p-4 bg-red-50 dark:bg-red-900/20 rounded-lg max-h-64">
{error.stack}
              </pre>
            </details>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export class RouteErrorBoundary extends ErrorBoundary {
  constructor(props: RouteErrorBoundaryProps) {
    super({
      ...props,
      level: 'page',
      customErrorComponent: ({ error, retry, reset }) => (
        <RouteErrorFallback
          error={error}
          retry={retry}
          reset={reset}
          routeName={props.routeName}
          suggestedRoutes={props.suggestedRoutes}
        />
      ),
      onError: (error: Error, errorInfo: ErrorInfo) => {
        // Log route-specific errors with high severity
        errorLogger.logError(error, ErrorSeverity.HIGH, errorInfo, {
          component: 'RouteErrorBoundary',
          metadata: {
            route: props.routeName || window.location.pathname,
            referrer: document.referrer
          }
        });
      }
    });
  }
}

// HOC for wrapping routes with error boundary
export function withRouteErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<RouteErrorBoundaryProps, 'children'>
) {
  return withErrorBoundary(Component, {
    level: 'page',
    customErrorComponent: ({ error, retry, reset }) => (
      <RouteErrorFallback
        error={error}
        retry={retry}
        reset={reset}
        {...options}
      />
    )
  });
}