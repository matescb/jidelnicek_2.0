/**
 * Centralized path constants and builders for type-safe routing
 */

/**
 * Base paths for main sections
 */
export const PATHS = {
  // Root
  ROOT: '/',
  
  // Auth
  AUTH: {
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password/:token',
    VERIFY_EMAIL: '/verify-email/:token',
  },
  
  // Dashboard
  DASHBOARD: '/dashboard',
  
  // Recipes
  RECIPES: {
    LIST: '/recipes',
    CREATE: '/recipes/new',
    DETAIL: '/recipes/:id',
    EDIT: '/recipes/:id/edit',
    CATEGORIES: '/recipes/categories',
    SEARCH: '/recipes/search',
  },
  
  // Trips
  TRIPS: {
    LIST: '/trips',
    CREATE: '/trips/new',
    DETAIL: '/trips/:id',
    EDIT: '/trips/:id/edit',
    CALENDAR: '/trips/calendar',
    PARTICIPANTS: '/trips/:id/participants',
    PLANNER: '/trips/:id/planner',
    SHOPPING: '/trips/:id/shopping-list',
  },
  
  // Ingredients
  INGREDIENTS: {
    LIST: '/ingredients',
    CATEGORIES: '/ingredients/categories',
    CREATE: '/ingredients/new',
    EDIT: '/ingredients/:id/edit',
  },
  
  // Shopping
  SHOPPING: {
    LISTS: '/shopping-lists',
    DETAIL: '/shopping-lists/:id',
    CREATE: '/shopping-lists/new',
  },
  
  // User
  USER: {
    PROFILE: '/profile',
    SETTINGS: '/profile/settings',
    PREFERENCES: '/profile/preferences',
    NOTIFICATIONS: '/profile/notifications',
  },
  
  // Admin
  ADMIN: {
    DASHBOARD: '/admin',
    USERS: '/admin/users',
    USER_DETAIL: '/admin/users/:id',
    MODERATION: '/admin/moderation',
    SETTINGS: '/admin/settings',
    REPORTS: '/admin/reports',
    LOGS: '/admin/logs',
  },
  
  // Error pages
  ERRORS: {
    NOT_FOUND: '/404',
    FORBIDDEN: '/403',
    SERVER_ERROR: '/500',
  },
  
  // Examples (development only)
  EXAMPLES: {
    ROOT: '/examples',
    THEME: '/examples/theme',
    TOAST: '/examples/toast',
    FORMS: '/examples/forms',
    ANIMATIONS: '/examples/animations',
  },
} as const;

/**
 * Type-safe path builder functions
 */
export const pathBuilders = {
  // Auth
  auth: {
    resetPassword: (token: string) => `/reset-password/${token}`,
    verifyEmail: (token: string) => `/verify-email/${token}`,
  },
  
  // Recipes
  recipes: {
    detail: (id: string | number) => `/recipes/${id}`,
    edit: (id: string | number) => `/recipes/${id}/edit`,
    search: (query?: string) => query ? `/recipes/search?q=${encodeURIComponent(query)}` : '/recipes/search',
  },
  
  // Trips
  trips: {
    detail: (id: string | number) => `/trips/${id}`,
    edit: (id: string | number) => `/trips/${id}/edit`,
    participants: (id: string | number) => `/trips/${id}/participants`,
    planner: (id: string | number) => `/trips/${id}/planner`,
    shoppingList: (id: string | number) => `/trips/${id}/shopping-list`,
  },
  
  // Ingredients
  ingredients: {
    edit: (id: string | number) => `/ingredients/${id}/edit`,
  },
  
  // Shopping Lists
  shopping: {
    detail: (id: string | number) => `/shopping-lists/${id}`,
  },
  
  // Admin
  admin: {
    userDetail: (id: string | number) => `/admin/users/${id}`,
  },
};

/**
 * Query parameter builders
 */
export const queryBuilders = {
  /**
   * Build pagination query params
   */
  pagination: (page: number, limit: number = 20) => ({
    page: page.toString(),
    limit: limit.toString(),
  }),
  
  /**
   * Build filter query params
   */
  filters: (filters: Record<string, any>) => {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params[key] = String(value);
      }
    });
    return params;
  },
  
  /**
   * Build sort query params
   */
  sort: (field: string, order: 'asc' | 'desc' = 'asc') => ({
    sort: field,
    order,
  }),
  
  /**
   * Build search query params
   */
  search: (query: string) => ({
    q: query,
  }),
};

/**
 * Utility function to build URL with query parameters
 */
export function buildUrl(path: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return path;
  }
  
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * Utility function to parse dynamic path segments
 */
export function parsePath(path: string): { segments: string[]; params: string[] } {
  const segments = path.split('/').filter(Boolean);
  const params: string[] = [];
  
  segments.forEach((segment) => {
    if (segment.startsWith(':')) {
      params.push(segment.slice(1));
    }
  });
  
  return { segments, params };
}

/**
 * Utility function to validate if a path matches a pattern
 */
export function matchPath(pattern: string, path: string): boolean | Record<string, string> {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);
  
  if (patternSegments.length !== pathSegments.length) {
    return false;
  }
  
  const params: Record<string, string> = {};
  
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];
    
    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      return false;
    }
  }
  
  return Object.keys(params).length > 0 ? params : true;
}

/**
 * Get the base path without parameters
 */
export function getBasePath(path: string): string {
  return path.split('?')[0].split('#')[0];
}

/**
 * Check if path is external
 */
export function isExternalPath(path: string): boolean {
  return /^https?:\/\//.test(path) || /^mailto:/.test(path) || /^tel:/.test(path);
}

/**
 * Normalize path (remove trailing slashes, etc.)
 */
export function normalizePath(path: string): string {
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}