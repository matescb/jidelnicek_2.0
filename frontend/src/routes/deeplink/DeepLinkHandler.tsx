/**
 * Main deep link handler component
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { parseDeepLink } from './parser';
import { DEEP_LINK_EVENTS, MAX_DEEP_LINK_AGE } from './deepLinkConfig';
import { useDeepLink } from './hooks';

/**
 * Deep link handler props
 */
interface DeepLinkHandlerProps {
  children?: React.ReactNode;
  fallbackPath?: string;
  onError?: (error: string) => void;
}

/**
 * Deep link handler component
 * This component should be placed at the app root to handle all incoming deep links
 */
export const DeepLinkHandler: React.FC<DeepLinkHandlerProps> = ({
  children,
  fallbackPath = '/',
  onError,
}) => {
  const { handleDeepLink } = useDeepLink();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Handle deep links from URL hash (for web compatibility)
    if (location.hash && location.hash.startsWith('#deeplink=')) {
      const deepLink = decodeURIComponent(location.hash.substring(10));
      setIsProcessing(true);
      
      handleDeepLink(deepLink)
        .then(() => {
          // Clear the hash
          window.history.replaceState(null, '', window.location.pathname);
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Failed to handle deep link';
          setError(errorMessage);
          if (onError) {
            onError(errorMessage);
          }
        })
        .finally(() => {
          setIsProcessing(false);
        });
    }
  }, [location.hash, handleDeepLink, onError]);
  
  // Handle Android App Links / iOS Universal Links
  useEffect(() => {
    const handleAppLink = (event: Event) => {
      const customEvent = event as CustomEvent;
      const url = customEvent.detail?.url;
      
      if (url) {
        setIsProcessing(true);
        handleDeepLink(url)
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.message : 'Failed to handle app link';
            setError(errorMessage);
            if (onError) {
              onError(errorMessage);
            }
          })
          .finally(() => {
            setIsProcessing(false);
          });
      }
    };
    
    // Listen for app link events from native code
    window.addEventListener('applink', handleAppLink);
    
    return () => {
      window.removeEventListener('applink', handleAppLink);
    };
  }, [handleDeepLink, onError]);
  
  // Show loading state while processing
  if (isProcessing) {
    return <DeepLinkLoadingState />;
  }
  
  // Show error state if there was an error
  if (error) {
    return <DeepLinkErrorState error={error} fallbackPath={fallbackPath} />;
  }
  
  return <>{children}</>;
};

/**
 * Loading state component
 */
const DeepLinkLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Opening link...</p>
      </div>
    </div>
  );
};

/**
 * Error state component
 */
interface DeepLinkErrorStateProps {
  error: string;
  fallbackPath: string;
}

const DeepLinkErrorState: React.FC<DeepLinkErrorStateProps> = ({
  error,
  fallbackPath,
}) => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate(fallbackPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [navigate, fallbackPath]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto w-12 h-12 text-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">Invalid Link</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Redirecting to home in {countdown} seconds...
          </p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(fallbackPath)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Go to Home
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Route component for handling deep link redirects
 * Use this for specific deep link routes that need custom handling
 */
export const DeepLinkRoute: React.FC = () => {
  const location = useLocation();
  const { handleDeepLink } = useDeepLink();
  const [isProcessing, setIsProcessing] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const deepLink = searchParams.get('url') || searchParams.get('link');
    
    if (deepLink) {
      handleDeepLink(deepLink)
        .then((parsed) => {
          if (parsed && parsed.isValid) {
            setRedirectPath(parsed.route);
          } else {
            setRedirectPath('/');
          }
        })
        .catch(() => {
          setRedirectPath('/');
        })
        .finally(() => {
          setIsProcessing(false);
        });
    } else {
      setRedirectPath('/');
      setIsProcessing(false);
    }
  }, [location.search, handleDeepLink]);
  
  if (isProcessing) {
    return <DeepLinkLoadingState />;
  }
  
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }
  
  return null;
};

/**
 * Protected deep link handler
 * Ensures authentication before processing deep links
 */
interface ProtectedDeepLinkHandlerProps {
  isAuthenticated: boolean;
  loginPath?: string;
}

export const ProtectedDeepLinkHandler: React.FC<ProtectedDeepLinkHandlerProps> = ({
  isAuthenticated,
  loginPath = '/login',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const deepLink = searchParams.get('deeplink');
    
    if (deepLink && !isAuthenticated) {
      // Store the deep link for after authentication
      sessionStorage.setItem('pendingDeepLink', deepLink);
      
      // Redirect to login
      navigate(loginPath, {
        state: { from: location.pathname + location.search },
      });
    }
  }, [location, isAuthenticated, navigate, loginPath]);
  
  return null;
};

/**
 * Deep link preview component
 * Shows a preview of where a deep link will navigate
 */
interface DeepLinkPreviewProps {
  url: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const DeepLinkPreview: React.FC<DeepLinkPreviewProps> = ({
  url,
  onConfirm,
  onCancel,
}) => {
  const parsed = parseDeepLink(url);
  
  if (!parsed.isValid) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
        <p className="text-sm text-destructive">Invalid link: {parsed.error}</p>
      </div>
    );
  }
  
  const getLinkDescription = () => {
    if (parsed.path.startsWith('recipe/')) {
      return 'View Recipe';
    }
    if (parsed.path.startsWith('trip/')) {
      return parsed.path.includes('/join') ? 'Join Trip' : 'View Trip';
    }
    if (parsed.path.startsWith('shopping-list/')) {
      return 'View Shopping List';
    }
    return 'Open in App';
  };
  
  return (
    <div className="p-4 bg-accent/50 border border-accent rounded-md space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 text-primary"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
        </div>
        <div className="flex-1 space-y-1">
          <p className="font-medium text-sm">{getLinkDescription()}</p>
          <p className="text-xs text-muted-foreground break-all">{url}</p>
        </div>
      </div>
      
      {(onConfirm || onCancel) && (
        <div className="flex gap-2 justify-end">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Open
            </button>
          )}
        </div>
      )}
    </div>
  );
};