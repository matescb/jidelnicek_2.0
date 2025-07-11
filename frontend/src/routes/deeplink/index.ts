/**
 * Deep linking support system exports
 */

// Components
export {
  DeepLinkHandler,
  DeepLinkRoute,
  ProtectedDeepLinkHandler,
  DeepLinkPreview,
} from './DeepLinkHandler';

// Configuration
export {
  DEEP_LINK_SCHEMES,
  DEEP_LINK_PATTERNS,
  DEEP_LINK_QUERY_PARAMS,
  DEEP_LINK_EVENTS,
  SOCIAL_SHARE_CONFIG,
  DEFAULT_GENERATION_CONFIG,
  MAX_DEEP_LINK_AGE,
  type DeepLinkPattern,
  type QueryParamConfig,
  type DeepLinkGenerationConfig,
} from './deepLinkConfig';

// Parser utilities
export {
  parseDeepLink,
  extractDeepLinkFromSource,
  isDeepLink,
  validateDeepLink,
  getDeepLinkInfo,
  type ParsedDeepLink,
} from './parser';

// Share utilities
export {
  generateRecipeShareLink,
  generateTripInviteLink,
  generateShoppingListShareLink,
  generateNavigationLink,
  generateSocialShareUrl,
  generateQRCode,
  copyToClipboard,
  shareNative,
  canShareNative,
  getShareMessage,
  trackShareEvent,
  generateShortUrl,
  type ShareLinkOptions,
} from './shareUtils';

// React hooks
export {
  useDeepLink,
  useShareLink,
  useAppLink,
  useUniversalLink,
  useDeepLinkState,
} from './hooks';

/**
 * Quick start guide:
 * 
 * 1. Add DeepLinkHandler to your app root:
 *    ```tsx
 *    <DeepLinkHandler fallbackPath="/" onError={handleError}>
 *      <App />
 *    </DeepLinkHandler>
 *    ```
 * 
 * 2. Use hooks in components:
 *    ```tsx
 *    const { generateRecipeLink, shareLink } = useShareLink();
 *    const link = generateRecipeLink(recipeId);
 *    await shareLink(link, { title: 'Check out this recipe!' });
 *    ```
 * 
 * 3. Handle incoming deep links:
 *    ```tsx
 *    const { handleDeepLink } = useDeepLink();
 *    // Automatically handles navigation and auth
 *    ```
 * 
 * 4. Check deep link state in components:
 *    ```tsx
 *    const { isFromDeepLink, deepLinkParams } = useDeepLinkState();
 *    if (isFromDeepLink) {
 *      // Handle special behavior for deep linked users
 *    }
 *    ```
 */