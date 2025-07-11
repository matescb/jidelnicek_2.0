/**
 * Deep link configuration and patterns
 */

import { PATHS } from '../paths';

/**
 * Supported deep link schemes
 */
export const DEEP_LINK_SCHEMES = {
  APP: 'jidelnicek://',
  HTTPS: 'https://app.jidelnicek.cz/',
  HTTP: 'http://localhost:3000/',
} as const;

/**
 * Deep link pattern definitions
 */
export interface DeepLinkPattern {
  pattern: RegExp;
  route: string;
  requiresAuth?: boolean;
  extractParams?: (match: RegExpMatchArray) => Record<string, string>;
  validateParams?: (params: Record<string, string>) => boolean;
}

/**
 * Deep link patterns mapped to internal routes
 */
export const DEEP_LINK_PATTERNS: DeepLinkPattern[] = [
  // Recipe links
  {
    pattern: /^recipe\/([a-zA-Z0-9-]+)$/,
    route: PATHS.RECIPES.DETAIL,
    extractParams: (match) => ({ id: match[1] }),
  },
  {
    pattern: /^recipe\/([a-zA-Z0-9-]+)\/share$/,
    route: PATHS.RECIPES.DETAIL,
    extractParams: (match) => ({ id: match[1], share: 'true' }),
  },
  
  // Trip links
  {
    pattern: /^trip\/([a-zA-Z0-9-]+)$/,
    route: PATHS.TRIPS.DETAIL,
    requiresAuth: true,
    extractParams: (match) => ({ id: match[1] }),
  },
  {
    pattern: /^trip\/([a-zA-Z0-9-]+)\/join$/,
    route: PATHS.TRIPS.DETAIL,
    extractParams: (match) => ({ id: match[1], action: 'join' }),
    validateParams: (params) => {
      // Ensure join token is provided in query params
      return true; // Will be validated with query params
    },
  },
  {
    pattern: /^trip\/([a-zA-Z0-9-]+)\/planner$/,
    route: PATHS.TRIPS.PLANNER,
    requiresAuth: true,
    extractParams: (match) => ({ id: match[1] }),
  },
  
  // Shopping list links
  {
    pattern: /^shopping-list\/([a-zA-Z0-9-]+)$/,
    route: PATHS.SHOPPING.DETAIL,
    requiresAuth: true,
    extractParams: (match) => ({ id: match[1] }),
  },
  {
    pattern: /^shopping-list\/([a-zA-Z0-9-]+)\/share$/,
    route: PATHS.SHOPPING.DETAIL,
    extractParams: (match) => ({ id: match[1], share: 'true' }),
  },
  
  // Navigation shortcuts
  {
    pattern: /^dashboard$/,
    route: PATHS.DASHBOARD,
    requiresAuth: true,
  },
  {
    pattern: /^recipes$/,
    route: PATHS.RECIPES.LIST,
  },
  {
    pattern: /^recipes\/search$/,
    route: PATHS.RECIPES.SEARCH,
  },
  {
    pattern: /^recipes\/categories$/,
    route: PATHS.RECIPES.CATEGORIES,
  },
  {
    pattern: /^trips$/,
    route: PATHS.TRIPS.LIST,
    requiresAuth: true,
  },
  {
    pattern: /^profile$/,
    route: PATHS.USER.PROFILE,
    requiresAuth: true,
  },
  {
    pattern: /^settings$/,
    route: PATHS.USER.SETTINGS,
    requiresAuth: true,
  },
  
  // Auth links
  {
    pattern: /^verify-email\/([a-zA-Z0-9-]+)$/,
    route: PATHS.AUTH.VERIFY_EMAIL,
    extractParams: (match) => ({ token: match[1] }),
  },
  {
    pattern: /^reset-password\/([a-zA-Z0-9-]+)$/,
    route: PATHS.AUTH.RESET_PASSWORD,
    extractParams: (match) => ({ token: match[1] }),
  },
];

/**
 * Query parameter configurations
 */
export interface QueryParamConfig {
  name: string;
  required?: boolean;
  validate?: (value: string) => boolean;
  transform?: (value: string) => any;
}

/**
 * Query parameters for different deep link types
 */
export const DEEP_LINK_QUERY_PARAMS: Record<string, QueryParamConfig[]> = {
  'trip/join': [
    {
      name: 'token',
      required: true,
      validate: (value) => value.length > 0,
    },
  ],
  'recipe/share': [
    {
      name: 'source',
      validate: (value) => ['app', 'web', 'qr'].includes(value),
    },
  ],
  'shopping-list/share': [
    {
      name: 'token',
      validate: (value) => value.length > 0,
    },
  ],
};

/**
 * Deep link generation configurations
 */
export interface DeepLinkGenerationConfig {
  preferredScheme?: keyof typeof DEEP_LINK_SCHEMES;
  includeSource?: boolean;
  shortUrl?: boolean;
}

export const DEFAULT_GENERATION_CONFIG: DeepLinkGenerationConfig = {
  preferredScheme: 'APP',
  includeSource: true,
  shortUrl: false,
};

/**
 * Social media share configurations
 */
export const SOCIAL_SHARE_CONFIG = {
  facebook: {
    baseUrl: 'https://www.facebook.com/sharer/sharer.php',
    params: ['u'],
  },
  twitter: {
    baseUrl: 'https://twitter.com/intent/tweet',
    params: ['url', 'text', 'hashtags'],
  },
  whatsapp: {
    baseUrl: 'https://wa.me/',
    params: ['text'],
  },
  telegram: {
    baseUrl: 'https://t.me/share/url',
    params: ['url', 'text'],
  },
  email: {
    baseUrl: 'mailto:',
    params: ['subject', 'body'],
  },
} as const;

/**
 * Legacy deep link format mappings
 */
export const LEGACY_LINK_MAPPINGS: Record<string, string> = {
  'r/': 'recipe/',
  't/': 'trip/',
  's/': 'shopping-list/',
  'recipes/view/': 'recipe/',
  'trips/view/': 'trip/',
};

/**
 * Maximum deep link age for security (in milliseconds)
 */
export const MAX_DEEP_LINK_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Deep link analytics events
 */
export const DEEP_LINK_EVENTS = {
  OPENED: 'deep_link_opened',
  SHARED: 'deep_link_shared',
  FAILED: 'deep_link_failed',
  EXPIRED: 'deep_link_expired',
} as const;