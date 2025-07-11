import React, { createContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { BreadcrumbItem, BreadcrumbContextValue } from './types';
import { generateBreadcrumbsFromRoute } from './utils';

export const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

interface BreadcrumbProviderProps {
  children: ReactNode;
  autoGenerate?: boolean;
}

export const BreadcrumbProvider: React.FC<BreadcrumbProviderProps> = ({
  children,
  autoGenerate = true,
}) => {
  const location = useLocation();
  const params = useParams();
  const [breadcrumbs, setBreadcrumbsState] = useState<BreadcrumbItem[]>([]);
  const [customBreadcrumbs, setCustomBreadcrumbs] = useState<BreadcrumbItem[] | null>(null);

  // Auto-generate breadcrumbs from route
  useEffect(() => {
    if (autoGenerate && !customBreadcrumbs) {
      const generated = generateBreadcrumbsFromRoute(location.pathname, params);
      setBreadcrumbsState(generated);
    }
  }, [location.pathname, params, autoGenerate, customBreadcrumbs]);

  // Set custom breadcrumbs (overrides auto-generation)
  const setBreadcrumbs = useCallback((breadcrumbs: BreadcrumbItem[]) => {
    setCustomBreadcrumbs(breadcrumbs);
    setBreadcrumbsState(breadcrumbs);
  }, []);

  // Clear custom breadcrumbs (returns to auto-generation)
  const clearBreadcrumbs = useCallback(() => {
    setCustomBreadcrumbs(null);
    if (autoGenerate) {
      const generated = generateBreadcrumbsFromRoute(location.pathname, params);
      setBreadcrumbsState(generated);
    } else {
      setBreadcrumbsState([]);
    }
  }, [location.pathname, params, autoGenerate]);

  // Add a breadcrumb to the end
  const pushBreadcrumb = useCallback((breadcrumb: BreadcrumbItem) => {
    setBreadcrumbsState((prev) => {
      const updated = prev.map((b) => ({ ...b, isActive: false }));
      return [...updated, { ...breadcrumb, isActive: true }];
    });
    setCustomBreadcrumbs((prev) => {
      if (!prev) return null;
      const updated = prev.map((b) => ({ ...b, isActive: false }));
      return [...updated, { ...breadcrumb, isActive: true }];
    });
  }, []);

  // Remove the last breadcrumb
  const popBreadcrumb = useCallback(() => {
    setBreadcrumbsState((prev) => {
      if (prev.length <= 1) return prev;
      const updated = [...prev.slice(0, -1)];
      if (updated.length > 0) {
        updated[updated.length - 1].isActive = true;
      }
      return updated;
    });
    setCustomBreadcrumbs((prev) => {
      if (!prev || prev.length <= 1) return prev;
      const updated = [...prev.slice(0, -1)];
      if (updated.length > 0) {
        updated[updated.length - 1].isActive = true;
      }
      return updated;
    });
  }, []);

  // Replace a specific breadcrumb
  const replaceBreadcrumb = useCallback((id: string, breadcrumb: BreadcrumbItem) => {
    const updateBreadcrumbs = (items: BreadcrumbItem[]) =>
      items.map((b) => (b.id === id ? { ...breadcrumb, id } : b));

    setBreadcrumbsState((prev) => updateBreadcrumbs(prev));
    setCustomBreadcrumbs((prev) => (prev ? updateBreadcrumbs(prev) : null));
  }, []);

  const value: BreadcrumbContextValue = {
    breadcrumbs,
    setBreadcrumbs,
    clearBreadcrumbs,
    pushBreadcrumb,
    popBreadcrumb,
    replaceBreadcrumb,
  };

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
};