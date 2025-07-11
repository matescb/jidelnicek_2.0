import React, { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTransitionProvider } from './TransitionProvider';

interface PreloadConfig {
  path: string;
  priority: 'high' | 'medium' | 'low';
  component?: () => Promise<any>;
  data?: () => Promise<any>;
  resources?: string[];
  timestamp?: number;
  retryCount?: number;
  maxRetries?: number;
  ttl?: number;
}

interface PreloadManagerProps {
  children?: React.ReactNode;
  maxPreloads?: number;
  preloadDelay?: number;
  cacheTimeout?: number;
  enableNetworkAwarePreload?: boolean;
  onPreloadError?: (path: string, error: Error) => void;
  onPreloadSuccess?: (path: string) => void;
}

// Global preload cache
const preloadCache = new Map<string, PreloadConfig>();
const preloadQueue: PreloadConfig[] = [];
const activePreloads = new Set<string>();

// Priority weights
const PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  low: 1,
};

export const PreloadManager: React.FC<PreloadManagerProps> = ({
  children,
  maxPreloads = 3,
  preloadDelay = 100,
  cacheTimeout = 300000, // 5 minutes
  enableNetworkAwarePreload = true,
  onPreloadError,
  onPreloadSuccess,
}) => {
  const location = useLocation();
  const { settings } = useTransitionProvider();
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check network conditions
  const shouldPreloadBasedOnNetwork = useCallback(() => {
    if (!enableNetworkAwarePreload || typeof navigator === 'undefined') {
      return true;
    }

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!connection) return true;

    // Don't preload on slow connections
    if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      return false;
    }

    return true;
  }, [enableNetworkAwarePreload]);

  // Process preload queue
  const processQueue = useCallback(async () => {
    if (!settings.enablePreload || activePreloads.size >= maxPreloads || !shouldPreloadBasedOnNetwork()) {
      return;
    }

    // Sort queue by priority
    preloadQueue.sort((a, b) => 
      PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
    );

    while (preloadQueue.length > 0 && activePreloads.size < maxPreloads) {
      const config = preloadQueue.shift();
      if (!config || activePreloads.has(config.path)) continue;

      activePreloads.add(config.path);

      try {
        // Preload component
        if (config.component) {
          await config.component();
        }

        // Preload data
        if (config.data) {
          await config.data();
        }

        // Preload resources
        if (config.resources) {
          await preloadResources(config.resources);
        }

        // Cache the config
        preloadCache.set(config.path, {
          ...config,
          timestamp: Date.now(),
        });

        if (onPreloadSuccess) {
          onPreloadSuccess(config.path);
        }
      } catch (error) {
        console.error(`Failed to preload ${config.path}:`, error);
        
        // Retry logic
        const retryCount = config.retryCount || 0;
        const maxRetries = config.maxRetries || 2;
        
        if (retryCount < maxRetries) {
          // Re-queue with incremented retry count
          preloadQueue.push({
            ...config,
            retryCount: retryCount + 1,
          });
        } else if (onPreloadError) {
          onPreloadError(config.path, error as Error);
        }
      } finally {
        activePreloads.delete(config.path);
      }
    }
  }, [settings.enablePreload, maxPreloads, shouldPreloadBasedOnNetwork, onPreloadSuccess, onPreloadError]);

  // Preload resources (images, scripts, etc.)
  const preloadResources = async (resources: string[]) => {
    const promises = resources.map(resource => {
      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = resource;
        link.onload = () => resolve(resource);
        link.onerror = () => reject(new Error(`Failed to preload ${resource}`));
        document.head.appendChild(link);
      });
    });

    await Promise.allSettled(promises);
  };

  // Add route to preload queue
  const queuePreload = useCallback((config: PreloadConfig) => {
    if (!settings.enablePreload || !shouldPreloadBasedOnNetwork()) return;

    // Check if already cached
    const cached = preloadCache.get(config.path);
    const ttl = config.ttl || cacheTimeout;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < ttl) {
      return;
    }

    // Check if already in queue or being processed
    const inQueue = preloadQueue.some(item => item.path === config.path);
    if (inQueue || activePreloads.has(config.path)) {
      return;
    }

    preloadQueue.push(config);

    // Debounce processing
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
    }
    preloadTimerRef.current = setTimeout(processQueue, preloadDelay);
  }, [settings.enablePreload, cacheTimeout, processQueue, preloadDelay, shouldPreloadBasedOnNetwork]);

  // Clean up old cache entries
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    for (const [path, config] of preloadCache.entries()) {
      if (config.timestamp && now - config.timestamp > cacheTimeout) {
        preloadCache.delete(path);
      }
    }
  }, [cacheTimeout]);

  // Set up periodic cleanup
  useEffect(() => {
    cleanupTimerRef.current = setInterval(cleanupCache, 60000); // Every minute

    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
      }
    };
  }, [cleanupCache]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (preloadTimerRef.current) {
        clearTimeout(preloadTimerRef.current);
      }
    };
  }, []);

  return <>{children}</>;
};

// Hook for preloading routes
export const usePreloadRoute = () => {
  const { settings } = useTransitionProvider();
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  const preloadRoute = useCallback((config: Omit<PreloadConfig, 'timestamp'>) => {
    if (!settings.enablePreload) return;

    const fullConfig: PreloadConfig = {
      ...config,
      priority: config.priority || 'medium',
    };

    // Check cache first
    const cached = preloadCache.get(config.path);
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 300000) {
      return Promise.resolve();
    }

    // Add to queue
    queuePreload(fullConfig);
  }, [settings.enablePreload]);

  const preloadOnHover = useCallback((
    path: string,
    config?: Partial<PreloadConfig>
  ) => {
    if (!settings.enablePreload) return;

    return {
      onMouseEnter: () => {
        preloadTimerRef.current = setTimeout(() => {
          preloadRoute({
            path,
            priority: 'low',
            ...config,
          });
        }, 200);
      },
      onMouseLeave: () => {
        if (preloadTimerRef.current) {
          clearTimeout(preloadTimerRef.current);
        }
      },
      onFocus: () => {
        preloadRoute({
          path,
          priority: 'low',
          ...config,
        });
      },
    };
  }, [settings.enablePreload, preloadRoute]);

  const preloadMultiple = useCallback((configs: Omit<PreloadConfig, 'timestamp'>[]) => {
    if (!settings.enablePreload) return;

    configs.forEach(config => preloadRoute(config));
  }, [settings.enablePreload, preloadRoute]);

  const cancelPreload = useCallback((path: string) => {
    const index = preloadQueue.findIndex(item => item.path === path);
    if (index !== -1) {
      preloadQueue.splice(index, 1);
    }
  }, []);

  const isPreloaded = useCallback((path: string): boolean => {
    const cached = preloadCache.get(path);
    return !!(cached && cached.timestamp && Date.now() - cached.timestamp < 300000);
  }, []);

  const clearPreloadCache = useCallback(() => {
    preloadCache.clear();
    preloadQueue.length = 0;
    activePreloads.clear();
  }, []);

  return {
    preloadRoute,
    preloadOnHover,
    preloadMultiple,
    cancelPreload,
    isPreloaded,
    clearPreloadCache,
  };
};

// Helper function to queue preload (exported for PreloadManager)
function queuePreload(config: PreloadConfig) {
  const inQueue = preloadQueue.some(item => item.path === config.path);
  if (!inQueue && !activePreloads.has(config.path)) {
    preloadQueue.push(config);
  }
}

// Component for preloading links
interface PreloadLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  priority?: 'high' | 'medium' | 'low';
  component?: () => Promise<any>;
  data?: () => Promise<any>;
  resources?: string[];
  children: React.ReactNode;
  preloadOnFocus?: boolean;
  preloadDelay?: number;
}

export const PreloadLink: React.FC<PreloadLinkProps> = ({
  to,
  priority = 'medium',
  component,
  data,
  resources,
  children,
  preloadOnFocus = true,
  preloadDelay = 200,
  ...props
}) => {
  const { preloadRoute } = usePreloadRoute();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      preloadRoute({
        path: to,
        priority,
        component,
        data,
        resources,
      });
    }, preloadDelay);
  }, [to, priority, component, data, resources, preloadRoute, preloadDelay]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleFocus = useCallback(() => {
    if (preloadOnFocus) {
      preloadRoute({
        path: to,
        priority: 'high',
        component,
        data,
        resources,
      });
    }
  }, [preloadOnFocus, to, component, data, resources, preloadRoute]);

  return (
    <a 
      href={to} 
      {...props} 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
    >
      {children}
    </a>
  );
};

// Resource hints component
interface ResourceHintsProps {
  prefetch?: string[];
  preconnect?: string[];
  dns?: string[];
}

export const ResourceHints: React.FC<ResourceHintsProps> = ({
  prefetch = [],
  preconnect = [],
  dns = [],
}) => {
  useEffect(() => {
    const head = document.head;

    // Add prefetch links
    const prefetchLinks = prefetch.map(href => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      head.appendChild(link);
      return link;
    });

    // Add preconnect links
    const preconnectLinks = preconnect.map(href => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      head.appendChild(link);
      return link;
    });

    // Add DNS prefetch links
    const dnsLinks = dns.map(href => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = href;
      head.appendChild(link);
      return link;
    });

    // Cleanup
    return () => {
      [...prefetchLinks, ...preconnectLinks, ...dnsLinks].forEach(link => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [prefetch, preconnect, dns]);

  return null;
};