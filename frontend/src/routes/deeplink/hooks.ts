/**
 * Deep linking React hooks
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { parseDeepLink, type ParsedDeepLink } from './parser';
import {
  generateRecipeShareLink,
  generateTripInviteLink,
  generateShoppingListShareLink,
  generateNavigationLink,
  generateSocialShareUrl,
  copyToClipboard,
  shareNative,
  canShareNative,
  type ShareLinkOptions,
} from './shareUtils';
import { DEEP_LINK_EVENTS } from './deepLinkConfig';

/**
 * Hook to handle incoming deep links
 */
export function useDeepLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const [lastHandledLink, setLastHandledLink] = useState<string | null>(null);
  
  const handleDeepLink = useCallback(
    async (url: string) => {
      // Avoid handling the same link twice
      if (url === lastHandledLink) {
        return;
      }
      
      setLastHandledLink(url);
      
      // Parse the deep link
      const parsed = parseDeepLink(url);
      
      // Track event
      trackDeepLinkEvent(DEEP_LINK_EVENTS.OPENED, parsed);
      
      if (!parsed.isValid) {
        console.error('Invalid deep link:', parsed.error);
        trackDeepLinkEvent(DEEP_LINK_EVENTS.FAILED, parsed);
        return;
      }
      
      // Check authentication requirement
      if (parsed.requiresAuth && !isAuthenticated()) {
        // Store deep link for after authentication
        sessionStorage.setItem('pendingDeepLink', url);
        navigate('/login', {
          state: { from: parsed.route },
        });
        return;
      }
      
      // Build navigation options
      const navigationOptions: any = {
        state: {
          fromDeepLink: true,
          deepLinkParams: parsed.params,
        },
      };
      
      // Add query parameters
      if (Object.keys(parsed.queryParams).length > 0) {
        const searchParams = new URLSearchParams(parsed.queryParams);
        navigationOptions.search = searchParams.toString();
      }
      
      // Navigate to the route
      navigate(parsed.route, navigationOptions);
    },
    [navigate, lastHandledLink]
  );
  
  // Handle deep links from app launch
  useEffect(() => {
    // Check for pending deep link after authentication
    const pendingLink = sessionStorage.getItem('pendingDeepLink');
    if (pendingLink) {
      sessionStorage.removeItem('pendingDeepLink');
      handleDeepLink(pendingLink);
      return;
    }
    
    // Check URL parameters for deep link
    const urlParams = new URLSearchParams(window.location.search);
    const deepLinkParam = urlParams.get('deeplink');
    if (deepLinkParam) {
      handleDeepLink(deepLinkParam);
      return;
    }
    
    // Listen for custom deep link events (from native app)
    const handleCustomEvent = (event: CustomEvent) => {
      if (event.detail?.url) {
        handleDeepLink(event.detail.url);
      }
    };
    
    window.addEventListener('deeplink', handleCustomEvent as EventListener);
    
    return () => {
      window.removeEventListener('deeplink', handleCustomEvent as EventListener);
    };
  }, [handleDeepLink]);
  
  return {
    handleDeepLink,
    parseDeepLink,
  };
}

/**
 * Hook to generate share links
 */
export function useShareLink() {
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  
  const generateRecipeLink = useCallback(
    (recipeId: string | number, options?: ShareLinkOptions) => {
      return generateRecipeShareLink(recipeId, options);
    },
    []
  );
  
  const generateTripLink = useCallback(
    (tripId: string | number, inviteToken: string, options?: ShareLinkOptions) => {
      return generateTripInviteLink(tripId, inviteToken, options);
    },
    []
  );
  
  const generateShoppingLink = useCallback(
    (listId: string | number, shareToken?: string, options?: ShareLinkOptions) => {
      return generateShoppingListShareLink(listId, shareToken, options);
    },
    []
  );
  
  const shareLink = useCallback(
    async (
      link: string,
      options: ShareLinkOptions & { method?: 'native' | 'copy' | string } = {}
    ) => {
      setIsSharing(true);
      setShareError(null);
      
      try {
        const { method = 'native', ...shareOptions } = options;
        
        if (method === 'native' && canShareNative()) {
          const success = await shareNative(link, shareOptions);
          if (!success) {
            throw new Error('Native share cancelled or failed');
          }
        } else if (method === 'copy' || !canShareNative()) {
          const success = await copyToClipboard(link);
          if (!success) {
            throw new Error('Failed to copy to clipboard');
          }
        } else if (method in { facebook: 1, twitter: 1, whatsapp: 1, telegram: 1, email: 1 }) {
          const socialUrl = generateSocialShareUrl(
            method as keyof typeof generateSocialShareUrl,
            link,
            shareOptions
          );
          window.open(socialUrl, '_blank');
        }
        
        // Track share event
        trackDeepLinkEvent(DEEP_LINK_EVENTS.SHARED, {
          path: link,
          method,
        } as any);
        
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Share failed';
        setShareError(message);
        return false;
      } finally {
        setIsSharing(false);
      }
    },
    []
  );
  
  return {
    generateRecipeLink,
    generateTripLink,
    generateShoppingLink,
    shareLink,
    isSharing,
    shareError,
    canShareNative: canShareNative(),
  };
}

/**
 * Hook to create internal app links
 */
export function useAppLink() {
  const generateLink = useCallback(
    (path: string, options?: ShareLinkOptions) => {
      return generateNavigationLink(path, options);
    },
    []
  );
  
  const openInApp = useCallback((path: string) => {
    const appLink = generateNavigationLink(path, {
      preferredScheme: 'APP',
    });
    
    // Try to open in app
    window.location.href = appLink;
    
    // Fallback to web after delay
    setTimeout(() => {
      window.location.href = path;
    }, 2000);
  }, []);
  
  return {
    generateLink,
    openInApp,
  };
}

/**
 * Hook to handle universal links
 */
export function useUniversalLink() {
  const { handleDeepLink } = useDeepLink();
  const [isHandling, setIsHandling] = useState(false);
  
  useEffect(() => {
    // Handle universal links on iOS/Android
    if ('universal-links' in window) {
      const handleUniversalLink = (event: any) => {
        setIsHandling(true);
        const url = event.detail?.url || event.url;
        if (url) {
          // Convert universal link to deep link
          const deepLink = url.replace(
            /^https?:\/\/[^\/]+/,
            'jidelnicek://'
          );
          handleDeepLink(deepLink);
        }
        setIsHandling(false);
      };
      
      window.addEventListener('universal-link', handleUniversalLink);
      
      return () => {
        window.removeEventListener('universal-link', handleUniversalLink);
      };
    }
  }, [handleDeepLink]);
  
  return { isHandling };
}

/**
 * Hook to get deep link state from navigation
 */
export function useDeepLinkState<T = any>(): {
  isFromDeepLink: boolean;
  deepLinkParams?: T;
} {
  const location = useLocation();
  const state = location.state as any;
  
  return {
    isFromDeepLink: state?.fromDeepLink || false,
    deepLinkParams: state?.deepLinkParams,
  };
}

/**
 * Helper to check if user is authenticated
 */
function isAuthenticated(): boolean {
  // This should check your actual auth state
  // For now, we'll check for a token in localStorage
  return !!localStorage.getItem('authToken');
}

/**
 * Track deep link events
 */
function trackDeepLinkEvent(
  event: string,
  data: Partial<ParsedDeepLink>
): void {
  // Analytics tracking
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', event, {
      deep_link_path: data.path,
      deep_link_route: data.route,
      deep_link_valid: data.isValid,
    });
  }
}