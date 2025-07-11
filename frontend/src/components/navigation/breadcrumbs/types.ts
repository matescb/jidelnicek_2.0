import { ReactNode } from 'react';

export interface BreadcrumbItem {
  id: string;
  label: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  isDynamic?: boolean;
  params?: Record<string, string>;
}

export interface BreadcrumbConfig {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  showHome?: boolean;
  maxItems?: number;
  truncateMode?: 'middle' | 'end';
  className?: string;
}

export interface BreadcrumbContextValue {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  clearBreadcrumbs: () => void;
  pushBreadcrumb: (breadcrumb: BreadcrumbItem) => void;
  popBreadcrumb: () => void;
  replaceBreadcrumb: (id: string, breadcrumb: BreadcrumbItem) => void;
}

export interface RouteMetadata {
  title?: string;
  breadcrumb?: string | ((params: Record<string, string>) => string);
  parent?: string;
  icon?: ReactNode;
}