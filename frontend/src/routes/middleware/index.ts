// Main middleware system
export {
  NavigationMiddlewareProvider,
  useNavigationMiddleware,
  withRouteMiddleware,
} from './NavigationMiddleware';

// Built-in middleware functions
export {
  createAuthMiddleware,
  createPermissionMiddleware,
  createUnsavedChangesMiddleware,
  createAnalyticsMiddleware,
  createRouteLoggingMiddleware,
  createMaintenanceModeMiddleware,
  createFeatureFlagMiddleware,
  createRateLimitMiddleware,
  createDebugMiddleware,
} from './middlewares';

// Unsaved changes guard component
export {
  UnsavedChangesGuard,
  useUnsavedChanges,
} from './UnsavedChangesGuard';

// Route logging components
export {
  RouteLogger,
  useRouteLogs,
  RoutePerformanceMonitor,
} from './RouteLogger';

// Navigation hooks
export {
  useNavigationGuard,
  useBeforeUnload,
  useRouteMiddleware,
  useNavigationBlock,
  useNavigationHistory,
  useRouteTransition,
  useConfirmNavigation,
} from './hooks';

// TypeScript types
export type {
  NavigationContext,
  MiddlewareResult,
  NavigationMiddleware,
  MiddlewareError,
  RouteGuardOptions,
  UnsavedChangesOptions,
  RouteLogEntry,
  NavigationBlocker,
  MiddlewareChainOptions,
} from './types';