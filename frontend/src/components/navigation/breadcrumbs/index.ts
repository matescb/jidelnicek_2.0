// Main breadcrumb components
export { Breadcrumbs, SimpleBreadcrumbs } from './Breadcrumbs';
export { BreadcrumbItem, BreadcrumbEllipsis } from './BreadcrumbItem';
export { BreadcrumbProvider, BreadcrumbContext } from './BreadcrumbProvider';

// Hooks
export {
  useBreadcrumbs,
  useSetBreadcrumbs,
  useBreadcrumbTitle,
  useBreadcrumbOperations,
  useTemporaryBreadcrumbs,
  useAppendBreadcrumb,
} from './hooks';

// Utilities
export {
  formatBreadcrumbLabel,
  isDynamicSegment,
  generateBreadcrumbsFromRoute,
  truncateBreadcrumbs,
  getParentBreadcrumbs,
  replaceDynamicSegments,
  getRouteMetadata,
} from './utils';

// Types
export type {
  BreadcrumbItem,
  BreadcrumbConfig,
  BreadcrumbContextValue,
  RouteMetadata,
} from './types';