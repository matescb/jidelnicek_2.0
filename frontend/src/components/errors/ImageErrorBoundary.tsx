import React, { useState, useCallback, useEffect, ImgHTMLAttributes } from 'react';
import { ErrorBoundary, withErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { RefreshCw, Image as ImageIcon, ImageOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ErrorInfo } from 'react';
import { errorLogger, ErrorSeverity } from '@/services/errorLogger';

interface ImageErrorBoundaryProps {
  children: React.ReactNode;
  fallbackSrc?: string;
  placeholderSrc?: string;
  altText?: string;
  retryDelay?: number;
  maxRetries?: number;
  onImageError?: (src: string, error: Error) => void;
}

interface ImageState {
  status: 'loading' | 'loaded' | 'error';
  retryCount: number;
  src?: string;
}

// Default placeholder image (base64 encoded 1x1 transparent pixel)
const DEFAULT_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Default fallback image (base64 encoded placeholder icon)
const DEFAULT_FALLBACK = `data:image/svg+xml;base64,${btoa(`
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#f3f4f6"/>
    <g transform="translate(100, 100)">
      <rect x="-40" y="-30" width="80" height="60" fill="none" stroke="#9ca3af" stroke-width="2" rx="4"/>
      <circle cx="-20" cy="-10" r="8" fill="#9ca3af"/>
      <path d="M-40 10 L-10 -20 L10 0 L40 -30 L40 30 L-40 30 Z" fill="#d1d5db"/>
    </g>
  </svg>
`)}`;

const ImageErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  reset: () => void;
  src?: string;
  altText?: string;
  fallbackSrc?: string;
  retryCount: number;
  maxRetries: number;
}> = ({ error, retry, reset, src, altText, fallbackSrc, retryCount, maxRetries }) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  const canRetry = retryCount < maxRetries;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
      style={{ aspectRatio: '16/9' }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%">
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="1"/>
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          <ImageOff className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
        </motion.div>

        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('errors.image.failed')}
        </h3>

        {altText && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {altText}
          </p>
        )}

        {retryCount > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            {t('errors.image.attempts', { count: retryCount })}
          </p>
        )}

        <div className="flex gap-2">
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={retry}
              className="h-7 text-xs"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {t('common.retry')}
            </Button>
          )}

          {fallbackSrc && fallbackSrc !== DEFAULT_FALLBACK && (
            <Button
              size="sm"
              variant="outline"
              onClick={reset}
              className="h-7 text-xs"
            >
              <ImageIcon className="mr-1 h-3 w-3" />
              {t('errors.image.useFallback')}
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDetails(!showDetails)}
            className="h-7 text-xs"
          >
            {showDetails ? t('common.hideDetails') : t('common.showDetails')}
          </Button>
        </div>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 w-full"
            >
              <div className="bg-white dark:bg-gray-900 rounded p-2 text-left">
                <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                  <span className="font-medium">URL:</span> {src || 'N/A'}
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    <span className="font-medium">Error:</span> {error.message}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Enhanced Image component with error handling
export const ErrorBoundaryImage: React.FC<
  ImgHTMLAttributes<HTMLImageElement> & {
    fallbackSrc?: string;
    placeholderSrc?: string;
    retryDelay?: number;
    maxRetries?: number;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
  }
> = ({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  placeholderSrc = DEFAULT_PLACEHOLDER,
  retryDelay = 1000,
  maxRetries = 3,
  onLoadStart,
  onLoadEnd,
  onError,
  onLoad,
  className,
  ...props
}) => {
  const [imageState, setImageState] = useState<ImageState>({
    status: 'loading',
    retryCount: 0,
    src: src
  });

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageState(prev => ({ ...prev, status: 'loaded' }));
    onLoadEnd?.();
    onLoad?.(e);
  }, [onLoad, onLoadEnd]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    
    if (imageState.retryCount < maxRetries && target.src !== fallbackSrc) {
      // Retry with delay
      setTimeout(() => {
        setImageState(prev => ({
          ...prev,
          retryCount: prev.retryCount + 1,
          src: `${src}?retry=${prev.retryCount + 1}` // Add cache buster
        }));
      }, retryDelay * Math.pow(2, imageState.retryCount)); // Exponential backoff
    } else if (target.src !== fallbackSrc) {
      // Use fallback
      setImageState({
        status: 'error',
        retryCount: imageState.retryCount,
        src: fallbackSrc
      });
    } else {
      // Fallback also failed
      setImageState(prev => ({ ...prev, status: 'error' }));
    }

    onError?.(e);
  }, [src, fallbackSrc, imageState.retryCount, maxRetries, retryDelay, onError]);

  useEffect(() => {
    if (src !== imageState.src && src) {
      onLoadStart?.();
      setImageState({
        status: 'loading',
        retryCount: 0,
        src: src
      });
    }
  }, [src]);

  if (imageState.status === 'error' && imageState.src === fallbackSrc) {
    // Both original and fallback failed
    return (
      <div className={className} style={{ position: 'relative' }}>
        <ImageErrorFallback
          error={new Error('Image failed to load')}
          retry={() => setImageState({ status: 'loading', retryCount: 0, src })}
          reset={() => setImageState({ status: 'loading', retryCount: 0, src: fallbackSrc })}
          src={src}
          altText={alt}
          fallbackSrc={fallbackSrc}
          retryCount={imageState.retryCount}
          maxRetries={maxRetries}
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="wait">
        {imageState.status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800"
          >
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.img
        key={imageState.src}
        src={imageState.src || placeholderSrc}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        initial={{ opacity: 0 }}
        animate={{ opacity: imageState.status === 'loaded' ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        {...props}
      />
    </div>
  );
};

export class ImageErrorBoundary extends ErrorBoundary {
  constructor(props: ImageErrorBoundaryProps) {
    super({
      ...props,
      level: 'component',
      enableRecovery: true,
      customErrorComponent: ({ error, retry, reset }) => {
        const [retryCount, setRetryCount] = useState(0);

        const handleRetry = () => {
          setRetryCount(prev => prev + 1);
          retry();
        };

        return (
          <ImageErrorFallback
            error={error}
            retry={handleRetry}
            reset={reset}
            altText={props.altText}
            fallbackSrc={props.fallbackSrc}
            retryCount={retryCount}
            maxRetries={props.maxRetries || 3}
          />
        );
      },
      onError: (error: Error, errorInfo: ErrorInfo) => {
        // Log image errors with low severity
        errorLogger.logError(error, ErrorSeverity.LOW, errorInfo, {
          component: 'ImageErrorBoundary',
          metadata: {
            altText: props.altText
          }
        });

        if (props.onImageError) {
          props.onImageError('', error);
        }
      }
    });
  }
}

// HOC for image components
export function withImageErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ImageErrorBoundaryProps, 'children'>
) {
  return withErrorBoundary(Component, {
    level: 'component',
    ...options
  });
}

// Hook for image error handling
export function useImageErrorHandler() {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [imageRetries, setImageRetries] = useState<Map<string, number>>(new Map());

  const handleImageError = useCallback((src: string, maxRetries = 3) => {
    const currentRetries = imageRetries.get(src) || 0;

    if (currentRetries < maxRetries) {
      setImageRetries(prev => new Map(prev).set(src, currentRetries + 1));
      return true; // Can retry
    } else {
      setFailedImages(prev => new Set(prev).add(src));
      return false; // Cannot retry
    }
  }, [imageRetries]);

  const resetImage = useCallback((src: string) => {
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(src);
      return newSet;
    });
    setImageRetries(prev => {
      const newMap = new Map(prev);
      newMap.delete(src);
      return newMap;
    });
  }, []);

  const isImageFailed = useCallback((src: string) => {
    return failedImages.has(src);
  }, [failedImages]);

  return {
    handleImageError,
    resetImage,
    isImageFailed,
    failedImages: Array.from(failedImages),
    retryCount: (src: string) => imageRetries.get(src) || 0
  };
}