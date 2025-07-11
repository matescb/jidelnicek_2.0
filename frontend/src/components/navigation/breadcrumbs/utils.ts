import { RouteMetadata, BreadcrumbItem } from './types';
import { routes } from '@/routes/config';
import { RouteConfig } from '@/routes/types';

/**
 * Format breadcrumb label from route segment
 */
export function formatBreadcrumbLabel(segment: string): string {
  // Remove hyphens and underscores, capitalize words
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Check if a segment is a dynamic parameter
 */
export function isDynamicSegment(segment: string): boolean {
  return segment.startsWith(':');
}

/**
 * Extract route metadata from route config
 */
export function getRouteMetadata(path: string): RouteMetadata | null {
  // Find matching route config
  const route = findRouteByPath(routes, path);
  if (!route) return null;

  return {
    title: route.meta?.title,
    breadcrumb: route.meta?.breadcrumb,
    icon: route.meta?.icon,
  };
}

/**
 * Find route config by path
 */
function findRouteByPath(routes: RouteConfig[], path: string): RouteConfig | null {
  for (const route of routes) {
    if (route.path === path) {
      return route;
    }
    if (route.children) {
      const childRoute = findRouteByPath(route.children, path);
      if (childRoute) return childRoute;
    }
  }
  return null;
}

/**
 * Generate breadcrumbs from route path
 */
export function generateBreadcrumbsFromRoute(
  pathname: string,
  params: Record<string, string> = {},
  routeMetadata?: Record<string, RouteMetadata>
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always include home
  breadcrumbs.push({
    id: 'home',
    label: 'Home',
    path: '/',
  });

  let currentPath = '';
  segments.forEach((segment, index) => {
    const isDynamic = isDynamicSegment(segment);
    let label = segment;
    let actualSegment = segment;

    if (isDynamic) {
      const paramName = segment.substring(1);
      actualSegment = params[paramName] || segment;
      label = formatBreadcrumbLabel(actualSegment);
    } else {
      label = formatBreadcrumbLabel(segment);
    }

    currentPath += `/${actualSegment}`;

    // Check for route metadata
    const metadata = routeMetadata?.[currentPath] || getRouteMetadata(currentPath);
    if (metadata?.breadcrumb) {
      label = typeof metadata.breadcrumb === 'function'
        ? metadata.breadcrumb(params)
        : metadata.breadcrumb;
    }

    breadcrumbs.push({
      id: `breadcrumb-${index}`,
      label,
      path: currentPath,
      isDynamic,
      isActive: index === segments.length - 1,
      icon: metadata?.icon,
    });
  });

  return breadcrumbs;
}

/**
 * Truncate breadcrumbs for mobile display
 */
export function truncateBreadcrumbs(
  breadcrumbs: BreadcrumbItem[],
  maxItems: number = 3,
  mode: 'middle' | 'end' = 'middle'
): BreadcrumbItem[] {
  if (breadcrumbs.length <= maxItems) {
    return breadcrumbs;
  }

  if (mode === 'end') {
    // Keep first and last items
    return [
      breadcrumbs[0],
      {
        id: 'ellipsis',
        label: '...',
        path: undefined,
      },
      ...breadcrumbs.slice(-(maxItems - 2)),
    ];
  }

  // Middle truncation: keep first, last, and some middle items
  const firstItems = Math.floor((maxItems - 1) / 2);
  const lastItems = Math.ceil((maxItems - 1) / 2);

  return [
    ...breadcrumbs.slice(0, firstItems),
    {
      id: 'ellipsis',
      label: '...',
      path: undefined,
    },
    ...breadcrumbs.slice(-lastItems),
  ];
}

/**
 * Get parent breadcrumbs for a given path
 */
export function getParentBreadcrumbs(
  currentPath: string,
  breadcrumbs: BreadcrumbItem[]
): BreadcrumbItem[] {
  const currentIndex = breadcrumbs.findIndex(b => b.path === currentPath);
  if (currentIndex === -1) return breadcrumbs;
  
  return breadcrumbs.slice(0, currentIndex);
}

/**
 * Replace dynamic segments in path with actual values
 */
export function replaceDynamicSegments(
  path: string,
  params: Record<string, string>
): string {
  let result = path;
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`:${key}`, value);
  });
  return result;
}