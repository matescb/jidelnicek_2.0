/**
 * Deep link parsing utilities
 */

import {
  DEEP_LINK_SCHEMES,
  DEEP_LINK_PATTERNS,
  LEGACY_LINK_MAPPINGS,
  DEEP_LINK_QUERY_PARAMS,
  type DeepLinkPattern,
} from './deepLinkConfig';

/**
 * Parsed deep link result
 */
export interface ParsedDeepLink {
  scheme: string;
  path: string;
  route: string;
  params: Record<string, string>;
  queryParams: Record<string, string>;
  requiresAuth: boolean;
  isValid: boolean;
  error?: string;
}

/**
 * Parse a deep link URL into its components
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  try {
    // Normalize the URL
    const normalizedUrl = normalizeDeepLink(url);
    
    // Extract scheme and path
    const { scheme, path, queryParams } = extractUrlComponents(normalizedUrl);
    
    // Handle legacy formats
    const modernPath = convertLegacyPath(path);
    
    // Find matching pattern
    const match = findMatchingPattern(modernPath);
    
    if (!match) {
      return {
        scheme,
        path: modernPath,
        route: '/',
        params: {},
        queryParams,
        requiresAuth: false,
        isValid: false,
        error: `No matching route found for path: ${modernPath}`,
      };
    }
    
    // Extract parameters
    const params = match.pattern.extractParams
      ? match.pattern.extractParams(match.match)
      : {};
    
    // Validate parameters
    if (match.pattern.validateParams && !match.pattern.validateParams(params)) {
      return {
        scheme,
        path: modernPath,
        route: match.pattern.route,
        params,
        queryParams,
        requiresAuth: match.pattern.requiresAuth || false,
        isValid: false,
        error: 'Invalid parameters',
      };
    }
    
    // Validate query parameters
    const queryValidation = validateQueryParams(modernPath, queryParams);
    if (!queryValidation.isValid) {
      return {
        scheme,
        path: modernPath,
        route: match.pattern.route,
        params,
        queryParams,
        requiresAuth: match.pattern.requiresAuth || false,
        isValid: false,
        error: queryValidation.error,
      };
    }
    
    // Build final route with parameters
    let route = match.pattern.route;
    Object.entries(params).forEach(([key, value]) => {
      route = route.replace(`:${key}`, value);
    });
    
    return {
      scheme,
      path: modernPath,
      route,
      params,
      queryParams,
      requiresAuth: match.pattern.requiresAuth || false,
      isValid: true,
    };
  } catch (error) {
    return {
      scheme: '',
      path: '',
      route: '/',
      params: {},
      queryParams: {},
      requiresAuth: false,
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to parse deep link',
    };
  }
}

/**
 * Normalize deep link URL
 */
function normalizeDeepLink(url: string): string {
  // Remove whitespace
  url = url.trim();
  
  // Handle missing scheme
  if (!url.includes('://')) {
    // Check if it starts with a known scheme prefix
    const schemePrefix = Object.values(DEEP_LINK_SCHEMES).find(scheme =>
      url.startsWith(scheme.replace('://', ''))
    );
    
    if (schemePrefix) {
      url = schemePrefix + url.substring(schemePrefix.replace('://', '').length);
    } else {
      // Default to app scheme
      url = DEEP_LINK_SCHEMES.APP + url;
    }
  }
  
  return url;
}

/**
 * Extract URL components
 */
function extractUrlComponents(url: string): {
  scheme: string;
  path: string;
  queryParams: Record<string, string>;
} {
  // Parse URL
  const urlObj = new URL(url);
  
  // Extract scheme
  const scheme = urlObj.protocol + '//';
  
  // Extract path (remove leading slash)
  let path = urlObj.pathname.substring(1);
  
  // Handle host as part of path for app scheme
  if (urlObj.protocol === 'jidelnicek:') {
    path = urlObj.host + (path ? '/' + path : '');
  }
  
  // Extract query parameters
  const queryParams: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });
  
  return { scheme, path, queryParams };
}

/**
 * Convert legacy path formats
 */
function convertLegacyPath(path: string): string {
  let modernPath = path;
  
  // Apply legacy mappings
  Object.entries(LEGACY_LINK_MAPPINGS).forEach(([legacy, modern]) => {
    if (modernPath.startsWith(legacy)) {
      modernPath = modern + modernPath.substring(legacy.length);
    }
  });
  
  return modernPath;
}

/**
 * Find matching pattern for path
 */
function findMatchingPattern(path: string): {
  pattern: DeepLinkPattern;
  match: RegExpMatchArray;
} | null {
  for (const pattern of DEEP_LINK_PATTERNS) {
    const match = path.match(pattern.pattern);
    if (match) {
      return { pattern, match };
    }
  }
  
  return null;
}

/**
 * Validate query parameters
 */
function validateQueryParams(
  path: string,
  queryParams: Record<string, string>
): { isValid: boolean; error?: string } {
  // Find relevant query param config
  const configKey = Object.keys(DEEP_LINK_QUERY_PARAMS).find(key =>
    path.includes(key)
  );
  
  if (!configKey) {
    return { isValid: true };
  }
  
  const configs = DEEP_LINK_QUERY_PARAMS[configKey];
  
  for (const config of configs) {
    const value = queryParams[config.name];
    
    // Check required
    if (config.required && !value) {
      return {
        isValid: false,
        error: `Missing required parameter: ${config.name}`,
      };
    }
    
    // Validate if present
    if (value && config.validate && !config.validate(value)) {
      return {
        isValid: false,
        error: `Invalid parameter value: ${config.name}`,
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Extract deep link from various sources
 */
export function extractDeepLinkFromSource(source: string): string | null {
  // Check if it's already a deep link
  if (isDeepLink(source)) {
    return source;
  }
  
  // Try to extract from common share formats
  const patterns = [
    // WhatsApp/Telegram format
    /Check out this on Jidelnicek: (jidelnicek:\/\/[^\s]+)/,
    // Email format
    /href="(jidelnicek:\/\/[^"]+)"/,
    // QR code data
    /^(jidelnicek:\/\/.+)$/,
  ];
  
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Check if a string is a deep link
 */
export function isDeepLink(url: string): boolean {
  return Object.values(DEEP_LINK_SCHEMES).some(scheme =>
    url.startsWith(scheme)
  );
}

/**
 * Validate deep link format
 */
export function validateDeepLink(url: string): {
  isValid: boolean;
  error?: string;
} {
  const parsed = parseDeepLink(url);
  return {
    isValid: parsed.isValid,
    error: parsed.error,
  };
}

/**
 * Get deep link info for display
 */
export function getDeepLinkInfo(url: string): {
  type: string;
  title: string;
  description: string;
  icon: string;
} {
  const parsed = parseDeepLink(url);
  
  if (!parsed.isValid) {
    return {
      type: 'invalid',
      title: 'Invalid Link',
      description: 'This link is not valid',
      icon: 'error',
    };
  }
  
  // Determine type from path
  if (parsed.path.startsWith('recipe/')) {
    return {
      type: 'recipe',
      title: 'Recipe',
      description: 'View recipe details',
      icon: 'restaurant_menu',
    };
  }
  
  if (parsed.path.startsWith('trip/')) {
    if (parsed.path.includes('/join')) {
      return {
        type: 'trip-invitation',
        title: 'Trip Invitation',
        description: 'Join a trip',
        icon: 'group_add',
      };
    }
    return {
      type: 'trip',
      title: 'Trip',
      description: 'View trip details',
      icon: 'luggage',
    };
  }
  
  if (parsed.path.startsWith('shopping-list/')) {
    return {
      type: 'shopping-list',
      title: 'Shopping List',
      description: 'View shopping list',
      icon: 'shopping_cart',
    };
  }
  
  return {
    type: 'navigation',
    title: 'Navigation',
    description: 'Open in app',
    icon: 'open_in_new',
  };
}