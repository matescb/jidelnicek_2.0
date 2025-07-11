# Route Configuration System

This directory contains a comprehensive route configuration system for the React application. It provides type-safe routing, centralized path management, and utilities for navigation.

## Structure

- `types.ts` - TypeScript interfaces and types for route configuration
- `paths.ts` - Centralized path constants and builder functions
- `config.tsx` - Main route configuration with all application routes
- `router-integration.tsx` - Example integration with React Router
- `index.ts` - Main exports

## Features

### 1. Type-Safe Routes

All routes are defined with TypeScript interfaces ensuring type safety:

```typescript
interface RouteConfig {
  id: string;
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
  meta: RouteMetadata;
  roles?: UserRole[];
  requireAuth?: boolean;
  children?: RouteConfig[];
}
```

### 2. Centralized Path Management

All paths are defined in one place with builder functions:

```typescript
import { PATHS, pathBuilders } from '@/routes';

// Static paths
const loginPath = PATHS.AUTH.LOGIN; // '/login'

// Dynamic paths with type-safe builders
const recipeDetail = pathBuilders.recipes.detail('123'); // '/recipes/123'
const tripEdit = pathBuilders.trips.edit('456'); // '/trips/456/edit'
```

### 3. Permission-Based Routing

Routes can specify required roles:

```typescript
{
  id: 'admin.users',
  path: '/admin/users',
  component: UserManagementPage,
  roles: [UserRole.ADMIN],
  requireAuth: true,
  meta: {
    title: 'User Management',
    icon: FiUsers,
  }
}
```

### 4. Navigation Utilities

Generate navigation items from route configuration:

```typescript
import { getNavigationItems, routes } from '@/routes';

// Get navigation items for a specific user role
const navItems = getNavigationItems(routes, UserRole.ADMIN);

// Returns NavigationItem[] with proper filtering and sorting
```

### 5. Breadcrumb Generation

Automatically generate breadcrumbs for any route:

```typescript
import { getBreadcrumbs } from '@/routes';

const breadcrumbs = getBreadcrumbs('recipes.detail');
// Returns: [
//   { label: 'Recipes', path: '/recipes', icon: FiBook },
//   { label: 'Recipe Details', path: '/recipes/:id', icon: FiEye, current: true }
// ]
```

## Usage

### Basic Route Definition

```typescript
const recipeRoutes: RouteConfig[] = [
  {
    id: 'recipes',
    path: '/recipes',
    component: lazy(() => import('@/pages/RecipeListPage')),
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Recipes',
      icon: FiBook,
      description: 'Browse recipes',
      navOrder: 2,
    },
    children: [
      {
        id: 'recipes.create',
        path: '/recipes/new',
        component: lazy(() => import('@/pages/RecipeCreatePage')),
        roles: [UserRole.ADMIN, UserRole.OWNER],
        meta: {
          title: 'Create Recipe',
          icon: FiPlus,
          hideInNav: true,
        },
      },
    ],
  },
];
```

### Using Path Builders

```typescript
// In components
import { pathBuilders, buildUrl } from '@/routes';

// Simple navigation
navigate(pathBuilders.recipes.detail(recipeId));

// With query parameters
const searchUrl = buildUrl('/recipes', {
  category: 'desserts',
  page: 2,
  sort: 'name',
});
// Result: '/recipes?category=desserts&page=2&sort=name'

// Using query builders
const paginatedUrl = buildUrl('/recipes', {
  ...queryBuilders.pagination(2, 20),
  ...queryBuilders.sort('createdAt', 'desc'),
});
```

### Integration with React Router

```typescript
// In your main app file
import { createRouterFromConfig } from '@/routes/router-integration';

const router = createRouterFromConfig();

function App() {
  return <RouterProvider router={router} />;
}
```

### Navigation Component Example

```typescript
import { getNavigationItems, routes } from '@/routes';
import { useAuth } from '@/hooks/useAuth';

function Navigation() {
  const { user } = useAuth();
  const navItems = getNavigationItems(routes, user?.role);
  
  return (
    <nav>
      {navItems.map((item) => (
        <NavLink key={item.id} to={item.path}>
          {item.icon && <item.icon />}
          {item.label}
          {item.badge && (
            <Badge variant={item.badgeVariant}>{item.badge}</Badge>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
```

### Protected Route Example

Routes with `requireAuth` or `roles` are automatically protected:

```typescript
// This route requires authentication and admin role
{
  id: 'admin.settings',
  path: '/admin/settings',
  component: AdminSettingsPage,
  requireAuth: true,
  roles: [UserRole.ADMIN],
  meta: {
    title: 'Admin Settings',
  }
}
```

## Route Groups

Routes can be organized into groups for better navigation structure:

```typescript
const routeGroups: RouteGroup[] = [
  {
    id: 'main',
    label: 'Main',
    icon: FiHome,
    order: 1,
    routes: [dashboardRoutes, recipeRoutes, tripRoutes],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: FiShield,
    order: 100,
    roles: [UserRole.ADMIN],
    routes: adminRoutes,
  },
];
```

## Development Routes

Development-only routes are automatically excluded in production:

```typescript
// These routes only appear in development
export const exampleRoutes: RouteConfig[] = [
  {
    id: 'examples',
    path: '/examples',
    component: ExamplesPage,
    meta: {
      title: 'Examples',
      badge: 'Dev',
    },
  },
];

// In config.tsx
export const routes = [
  ...mainRoutes,
  ...(process.env.NODE_ENV === 'development' ? exampleRoutes : []),
];
```

## Best Practices

1. **Always use path constants**: Never hardcode paths in components
2. **Use path builders for dynamic routes**: Ensures type safety
3. **Define metadata for all routes**: Helps with SEO and navigation
4. **Specify roles at route level**: Centralizes permission logic
5. **Lazy load all page components**: Improves performance
6. **Group related routes**: Makes navigation structure clear
7. **Use route IDs**: Enables easy route lookup and breadcrumb generation

## Adding New Routes

1. Add path constant to `paths.ts`
2. Create path builder if route has parameters
3. Add route configuration to appropriate section in `config.tsx`
4. Update navigation order if needed
5. Specify required roles and authentication
6. Add lazy-loaded component import

Example:

```typescript
// 1. In paths.ts
INGREDIENTS: {
  SUPPLIERS: '/ingredients/suppliers',
}

// 2. In config.tsx
{
  id: 'ingredients.suppliers',
  path: PATHS.INGREDIENTS.SUPPLIERS,
  component: lazy(() => import('@/pages/ingredients/SuppliersPage')),
  requireAuth: true,
  meta: {
    title: 'Suppliers',
    icon: FiTruck,
    description: 'Manage ingredient suppliers',
  },
}
```