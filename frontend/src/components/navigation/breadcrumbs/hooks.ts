import { useContext, useEffect, useCallback } from 'react';
import { BreadcrumbContext } from './BreadcrumbProvider';
import { BreadcrumbItem } from './types';

/**
 * Hook to get current breadcrumbs
 */
export function useBreadcrumbs() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumbs must be used within a BreadcrumbProvider');
  }
  return context.breadcrumbs;
}

/**
 * Hook to set custom breadcrumbs
 */
export function useSetBreadcrumbs() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useSetBreadcrumbs must be used within a BreadcrumbProvider');
  }

  const { setBreadcrumbs, clearBreadcrumbs } = context;

  // Return a function that sets breadcrumbs and returns a cleanup function
  return useCallback((breadcrumbs: BreadcrumbItem[]) => {
    setBreadcrumbs(breadcrumbs);
    return clearBreadcrumbs;
  }, [setBreadcrumbs, clearBreadcrumbs]);
}

/**
 * Hook to set custom breadcrumb title for current page
 */
export function useBreadcrumbTitle(title: string, dependencies: any[] = []) {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumbTitle must be used within a BreadcrumbProvider');
  }

  const { breadcrumbs, replaceBreadcrumb } = context;

  useEffect(() => {
    if (breadcrumbs.length > 0) {
      const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
      replaceBreadcrumb(lastBreadcrumb.id, {
        ...lastBreadcrumb,
        label: title,
      });
    }
  }, [title, ...dependencies]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook to manage breadcrumb operations
 */
export function useBreadcrumbOperations() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumbOperations must be used within a BreadcrumbProvider');
  }

  const { pushBreadcrumb, popBreadcrumb, replaceBreadcrumb, clearBreadcrumbs } = context;

  return {
    push: pushBreadcrumb,
    pop: popBreadcrumb,
    replace: replaceBreadcrumb,
    clear: clearBreadcrumbs,
  };
}

/**
 * Hook to temporarily override breadcrumbs (with automatic cleanup)
 */
export function useTemporaryBreadcrumbs(breadcrumbs: BreadcrumbItem[], enabled: boolean = true) {
  const setBreadcrumbs = useSetBreadcrumbs();

  useEffect(() => {
    if (!enabled) return;

    const cleanup = setBreadcrumbs(breadcrumbs);
    return cleanup;
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook to add a breadcrumb to the current path
 */
export function useAppendBreadcrumb(breadcrumb: Omit<BreadcrumbItem, 'id' | 'isActive'>) {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useAppendBreadcrumb must be used within a BreadcrumbProvider');
  }

  const { pushBreadcrumb } = context;

  useEffect(() => {
    const fullBreadcrumb: BreadcrumbItem = {
      ...breadcrumb,
      id: `appended-${breadcrumb.label}`,
      isActive: true,
    };

    pushBreadcrumb(fullBreadcrumb);

    // Cleanup: remove the appended breadcrumb when component unmounts
    return () => {
      context.popBreadcrumb();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}