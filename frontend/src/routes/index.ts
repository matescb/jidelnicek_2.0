/**
 * Route system exports
 * 
 * This module provides a comprehensive routing system with:
 * - Type-safe route definitions
 * - Path builders and constants
 * - Navigation utilities
 * - Permission-based routing
 * - Breadcrumb generation
 */

// Export all types
export * from './types';

// Export path constants and builders
export * from './paths';

// Export route configuration and utilities
export {
  // Route collections
  routes,
  authRoutes,
  dashboardRoutes,
  recipeRoutes,
  tripRoutes,
  ingredientRoutes,
  shoppingRoutes,
  profileRoutes,
  adminRoutes,
  errorRoutes,
  exampleRoutes,
  routeGroups,
  
  // Utility functions
  getNavigationItems,
  findRouteByPath,
  getBreadcrumbs,
} from './config';

// Re-export commonly used items for convenience
export { PATHS } from './paths';
export { pathBuilders, queryBuilders, buildUrl } from './paths';
export { UserRole } from './types';