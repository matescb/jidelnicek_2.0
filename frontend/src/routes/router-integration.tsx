/**
 * Example integration of the route configuration system with React Router
 * 
 * This file demonstrates how to use the route configuration to generate
 * React Router routes dynamically.
 */

import { Suspense } from 'react';
import { RouteObject, createBrowserRouter } from 'react-router-dom';
import { RouteConfig, ErrorRouteConfig } from './types';
import { routes, errorRoutes } from './config';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { PublicRoute } from '../components/auth/PublicRoute';
import { PermissionGate } from '../components/auth/PermissionGate';
import { RootLayout } from '../components/layouts/RootLayout';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingScreen } from '../components/common/LoadingScreen';

/**
 * Layout components map
 */
const layoutComponents = {
  root: RootLayout,
  auth: AuthLayout,
  dashboard: DashboardLayout,
  minimal: RootLayout, // You can create a MinimalLayout if needed
};

/**
 * Convert RouteConfig to React Router RouteObject
 */
function routeConfigToRouteObject(route: RouteConfig): RouteObject {
  const Component = route.component;
  
  // Build element with authentication and permission checks
  let element = (
    <Suspense fallback={<LoadingScreen />}>
      <Component />
    </Suspense>
  );
  
  // Apply permission gate if roles are specified
  if (route.roles && route.roles.length > 0) {
    element = (
      <PermissionGate requiredRoles={route.roles}>
        {element}
      </PermissionGate>
    );
  }
  
  // Apply authentication wrapper
  if (route.requireAuth) {
    element = <ProtectedRoute>{element}</ProtectedRoute>;
  } else if (route.requireGuest) {
    element = <PublicRoute>{element}</PublicRoute>;
  }
  
  // Build route object
  const routeObject: RouteObject = {
    path: route.path,
    element,
    errorElement: <ErrorBoundary />,
  };
  
  // Handle index routes
  if (route.index) {
    routeObject.index = true;
    delete routeObject.path;
  }
  
  // Handle redirects
  if (route.redirect) {
    // For redirects, we'd typically use Navigate component
    const NavigateComponent = () => {
      // This would use react-router's Navigate component
      return null; // Placeholder
    };
    routeObject.element = <NavigateComponent />;
  }
  
  // Handle children
  if (route.children && route.children.length > 0) {
    routeObject.children = route.children.map(routeConfigToRouteObject);
  }
  
  return routeObject;
}

/**
 * Group routes by layout
 */
function groupRoutesByLayout(routes: RouteConfig[]): Map<string, RouteConfig[]> {
  const grouped = new Map<string, RouteConfig[]>();
  
  routes.forEach((route) => {
    const layout = route.layout || 'root';
    if (!grouped.has(layout)) {
      grouped.set(layout, []);
    }
    grouped.get(layout)!.push(route);
  });
  
  return grouped;
}

/**
 * Create router from route configuration
 */
export function createRouterFromConfig() {
  const groupedRoutes = groupRoutesByLayout(routes);
  const rootRoutes: RouteObject[] = [];
  
  // Create routes for each layout
  groupedRoutes.forEach((layoutRoutes, layoutKey) => {
    const LayoutComponent = layoutComponents[layoutKey as keyof typeof layoutComponents];
    
    if (layoutKey === 'root') {
      // Root layout routes are added directly
      rootRoutes.push(...layoutRoutes.map(routeConfigToRouteObject));
    } else {
      // Other layouts are grouped under their layout component
      const layoutRoute: RouteObject = {
        element: <LayoutComponent />,
        errorElement: <ErrorBoundary />,
        children: layoutRoutes.map(routeConfigToRouteObject),
      };
      
      // Determine the base path for the layout
      if (layoutKey === 'auth') {
        layoutRoute.path = 'auth';
      } else if (layoutKey === 'dashboard') {
        layoutRoute.path = '/';
      }
      
      rootRoutes.push(layoutRoute);
    }
  });
  
  // Add error routes
  errorRoutes.forEach((errorRoute) => {
    rootRoutes.push({
      path: errorRoute.path,
      element: (
        <Suspense fallback={<LoadingScreen />}>
          <errorRoute.component />
        </Suspense>
      ),
    });
  });
  
  // Add catch-all 404 route
  rootRoutes.push({
    path: '*',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        {(() => {
          const NotFoundRoute = errorRoutes.find(r => r.statusCode === 404);
          if (NotFoundRoute) {
            const Component = NotFoundRoute.component;
            return <Component />;
          }
          return <div>404 - Page not found</div>;
        })()}
      </Suspense>
    ),
  });
  
  // Create the router
  return createBrowserRouter([
    {
      path: '/',
      element: <RootLayout />,
      errorElement: <ErrorBoundary />,
      children: rootRoutes,
    },
  ]);
}

/**
 * Hook to get current route metadata
 */
export function useRouteMetadata() {
  // This would use React Router's useLocation and match it against our route config
  // to return the current route's metadata
  return null; // Placeholder
}

/**
 * Example usage in your main app file:
 * 
 * import { createRouterFromConfig } from './routes/router-integration';
 * 
 * const router = createRouterFromConfig();
 * 
 * function App() {
 *   return <RouterProvider router={router} />;
 * }
 */