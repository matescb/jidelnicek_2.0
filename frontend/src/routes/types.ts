import { ComponentType, LazyExoticComponent } from 'react';
import { IconType } from 'react-icons';

/**
 * User roles for permission-based routing
 */
export enum UserRole {
  ADMIN = 'admin',
  OWNER = 'owner',
  PARTICIPANT = 'participant',
  GUEST = 'guest',
}

/**
 * Route metadata interface
 */
export interface RouteMetadata {
  /** Page title for document title and breadcrumbs */
  title: string;
  /** Icon component for navigation menus */
  icon?: IconType;
  /** Description for tooltips or meta tags */
  description?: string;
  /** Keywords for search or SEO */
  keywords?: string[];
  /** Whether to show in navigation menus */
  hideInNav?: boolean;
  /** Navigation priority (lower = higher priority) */
  navOrder?: number;
  /** Badge text (e.g., "New", "Beta") */
  badge?: string;
  /** Badge variant */
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
}

/**
 * Route configuration interface
 */
export interface RouteConfig {
  /** Unique route identifier */
  id: string;
  /** Route path pattern */
  path: string;
  /** Component to render (lazy loaded) */
  component: LazyExoticComponent<ComponentType<any>>;
  /** Route metadata */
  meta: RouteMetadata;
  /** Layout to use (if different from parent) */
  layout?: 'auth' | 'dashboard' | 'minimal' | 'root';
  /** Required roles to access route */
  roles?: UserRole[];
  /** Whether route requires authentication */
  requireAuth?: boolean;
  /** Whether route is only for unauthenticated users */
  requireGuest?: boolean;
  /** Child routes */
  children?: RouteConfig[];
  /** Whether this is an index route */
  index?: boolean;
  /** Redirect path */
  redirect?: string;
  /** Custom route guards */
  guards?: RouteGuard[];
  /** Route-specific feature flags */
  features?: string[];
}

/**
 * Route guard function type
 */
export type RouteGuard = (context: RouteGuardContext) => boolean | Promise<boolean>;

/**
 * Context passed to route guards
 */
export interface RouteGuardContext {
  user: any; // Replace with your User type
  route: RouteConfig;
  params: Record<string, string>;
  query: Record<string, string>;
}

/**
 * Navigation item for menus
 */
export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: IconType;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
  children?: NavigationItem[];
  divider?: boolean;
  disabled?: boolean;
  external?: boolean;
  roles?: UserRole[];
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: IconType;
  current?: boolean;
}

/**
 * Route params type helper
 */
export type RouteParams<T extends string> = {
  [K in T]: string;
};

/**
 * Dynamic route builder function type
 */
export type RouteBuilder<T extends string = string> = (
  params: RouteParams<T>,
  query?: Record<string, any>
) => string;

/**
 * Route group configuration for organizing routes
 */
export interface RouteGroup {
  id: string;
  label: string;
  icon?: IconType;
  routes: RouteConfig[];
  roles?: UserRole[];
  order?: number;
}

/**
 * Error route configuration
 */
export interface ErrorRouteConfig {
  statusCode: number;
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
  meta: RouteMetadata;
}

/**
 * Route transition configuration
 */
export interface RouteTransition {
  /** Transition type */
  type: 'fade' | 'slide' | 'scale' | 'none';
  /** Transition duration in ms */
  duration?: number;
  /** Transition easing */
  easing?: string;
}

/**
 * Route loading configuration
 */
export interface RouteLoadingConfig {
  /** Show loading indicator */
  showLoader?: boolean;
  /** Minimum loading time in ms */
  minLoadTime?: number;
  /** Loading component */
  component?: ComponentType;
}

/**
 * Full route configuration with all options
 */
export interface FullRouteConfig extends RouteConfig {
  transition?: RouteTransition;
  loading?: RouteLoadingConfig;
  errorBoundary?: ComponentType<any>;
  preload?: boolean;
  cache?: boolean;
}