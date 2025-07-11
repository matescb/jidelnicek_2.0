import { lazy } from 'react';
import {
  FiHome,
  FiBook,
  FiMapPin,
  FiShoppingCart,
  FiUser,
  FiSettings,
  FiUsers,
  FiShield,
  FiCalendar,
  FiList,
  FiPlus,
  FiEdit,
  FiEye,
  FiLogIn,
  FiUserPlus,
  FiLock,
  FiMail,
  FiAlertCircle,
  FiXCircle,
  FiPackage,
  FiActivity,
  FiFileText,
  FiBarChart2,
} from 'react-icons/fi';
import { PATHS } from './paths';
import { RouteConfig, UserRole, ErrorRouteConfig, RouteGroup, NavigationItem, BreadcrumbItem } from './types';

/**
 * Lazy-loaded page components
 */
const pages = {
  // Auth pages
  LoginPage: lazy(() => import('../pages/auth/LoginPage')),
  RegisterPage: lazy(() => import('../pages/auth/RegisterPage')),
  ForgotPasswordPage: lazy(() => import('../pages/auth/ForgotPasswordPage')),
  ResetPasswordPage: lazy(() => import('../pages/auth/ResetPasswordPage')),
  VerifyEmailPage: lazy(() => import('../pages/auth/VerifyEmailPage')),
  
  // Dashboard
  DashboardPage: lazy(() => import('../pages/dashboard/DashboardPage')),
  
  // Recipe pages
  RecipeListPage: lazy(() => import('../pages/recipes/RecipeListPage')),
  RecipeDetailPage: lazy(() => import('../pages/recipes/RecipeDetailPage')),
  RecipeCreatePage: lazy(() => import('../pages/recipes/RecipeCreatePage')),
  RecipeEditPage: lazy(() => import('../pages/recipes/RecipeEditPage')),
  
  // Trip pages
  TripListPage: lazy(() => import('../pages/trips/TripListPage')),
  TripDetailPage: lazy(() => import('../pages/trips/TripDetailPage')),
  TripCreatePage: lazy(() => import('../pages/trips/TripCreatePage')),
  TripEditPage: lazy(() => import('../pages/trips/TripEditPage')),
  TripParticipantsPage: lazy(() => import('../pages/trips/TripParticipantsPage')),
  TripPlannerPage: lazy(() => import('../pages/trips/TripPlannerPage')),
  
  // Ingredient pages
  IngredientListPage: lazy(() => import('../pages/ingredients/index')),
  
  // User pages
  ProfilePage: lazy(() => import('../pages/profile/ProfilePage')),
  SettingsPage: lazy(() => import('../pages/profile/SettingsPage')),
  
  // Error pages
  NotFoundPage: lazy(() => import('../pages/NotFoundPage')),
  
  // Example pages (dev only)
  ThemeShowcasePage: lazy(() => import('../pages/theme/ThemeShowcasePage')),
  ToastExamplePage: lazy(() => import('../pages/examples/ToastExamplePage')),
};

/**
 * Authentication routes
 */
export const authRoutes: RouteConfig[] = [
  {
    id: 'auth.login',
    path: PATHS.AUTH.LOGIN,
    component: pages.LoginPage,
    layout: 'auth',
    requireGuest: true,
    meta: {
      title: 'Login',
      icon: FiLogIn,
      description: 'Sign in to your account',
    },
  },
  {
    id: 'auth.register',
    path: PATHS.AUTH.REGISTER,
    component: pages.RegisterPage,
    layout: 'auth',
    requireGuest: true,
    meta: {
      title: 'Register',
      icon: FiUserPlus,
      description: 'Create a new account',
    },
  },
  {
    id: 'auth.forgot-password',
    path: PATHS.AUTH.FORGOT_PASSWORD,
    component: pages.ForgotPasswordPage,
    layout: 'auth',
    requireGuest: true,
    meta: {
      title: 'Forgot Password',
      icon: FiLock,
      description: 'Reset your password',
    },
  },
  {
    id: 'auth.reset-password',
    path: PATHS.AUTH.RESET_PASSWORD,
    component: pages.ResetPasswordPage,
    layout: 'auth',
    requireGuest: true,
    meta: {
      title: 'Reset Password',
      icon: FiLock,
      description: 'Set a new password',
    },
  },
  {
    id: 'auth.verify-email',
    path: PATHS.AUTH.VERIFY_EMAIL,
    component: pages.VerifyEmailPage,
    layout: 'auth',
    meta: {
      title: 'Verify Email',
      icon: FiMail,
      description: 'Verify your email address',
    },
  },
];

/**
 * Dashboard routes
 */
export const dashboardRoutes: RouteConfig[] = [
  {
    id: 'dashboard',
    path: PATHS.DASHBOARD,
    component: pages.DashboardPage,
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Dashboard',
      icon: FiHome,
      description: 'Overview and quick actions',
      navOrder: 1,
    },
  },
];

/**
 * Recipe routes
 */
export const recipeRoutes: RouteConfig[] = [
  {
    id: 'recipes',
    path: PATHS.RECIPES.LIST,
    component: pages.RecipeListPage,
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Recipes',
      icon: FiBook,
      description: 'Browse and manage recipes',
      navOrder: 2,
    },
    children: [
      {
        id: 'recipes.create',
        path: PATHS.RECIPES.CREATE,
        component: pages.RecipeCreatePage,
        requireAuth: true,
        roles: [UserRole.ADMIN, UserRole.OWNER],
        meta: {
          title: 'Create Recipe',
          icon: FiPlus,
          description: 'Add a new recipe',
          hideInNav: true,
        },
      },
      {
        id: 'recipes.detail',
        path: PATHS.RECIPES.DETAIL,
        component: pages.RecipeDetailPage,
        requireAuth: true,
        meta: {
          title: 'Recipe Details',
          icon: FiEye,
          description: 'View recipe details',
          hideInNav: true,
        },
      },
      {
        id: 'recipes.edit',
        path: PATHS.RECIPES.EDIT,
        component: pages.RecipeEditPage,
        requireAuth: true,
        roles: [UserRole.ADMIN, UserRole.OWNER],
        meta: {
          title: 'Edit Recipe',
          icon: FiEdit,
          description: 'Edit recipe',
          hideInNav: true,
        },
      },
    ],
  },
];

/**
 * Trip routes
 */
export const tripRoutes: RouteConfig[] = [
  {
    id: 'trips',
    path: PATHS.TRIPS.LIST,
    component: pages.TripListPage,
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Trips',
      icon: FiMapPin,
      description: 'Manage your food trips',
      navOrder: 3,
    },
    children: [
      {
        id: 'trips.create',
        path: PATHS.TRIPS.CREATE,
        component: pages.TripCreatePage,
        requireAuth: true,
        meta: {
          title: 'Create Trip',
          icon: FiPlus,
          description: 'Plan a new trip',
          hideInNav: true,
        },
      },
      {
        id: 'trips.detail',
        path: PATHS.TRIPS.DETAIL,
        component: pages.TripDetailPage,
        requireAuth: true,
        meta: {
          title: 'Trip Details',
          icon: FiEye,
          description: 'View trip details',
          hideInNav: true,
        },
      },
      {
        id: 'trips.edit',
        path: PATHS.TRIPS.EDIT,
        component: pages.TripEditPage,
        requireAuth: true,
        roles: [UserRole.ADMIN, UserRole.OWNER],
        meta: {
          title: 'Edit Trip',
          icon: FiEdit,
          description: 'Edit trip details',
          hideInNav: true,
        },
      },
      {
        id: 'trips.participants',
        path: PATHS.TRIPS.PARTICIPANTS,
        component: pages.TripParticipantsPage,
        requireAuth: true,
        meta: {
          title: 'Participants',
          icon: FiUsers,
          description: 'Manage trip participants',
          hideInNav: true,
        },
      },
      {
        id: 'trips.planner',
        path: PATHS.TRIPS.PLANNER,
        component: pages.TripPlannerPage,
        requireAuth: true,
        meta: {
          title: 'Meal Planner',
          icon: FiCalendar,
          description: 'Plan meals for the trip',
          hideInNav: true,
        },
      },
    ],
  },
  {
    id: 'trips.calendar',
    path: PATHS.TRIPS.CALENDAR,
    component: pages.TripListPage, // TODO: Create dedicated calendar view
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Trip Calendar',
      icon: FiCalendar,
      description: 'View trips in calendar',
      navOrder: 4,
    },
  },
];

/**
 * Ingredient routes
 */
export const ingredientRoutes: RouteConfig[] = [
  {
    id: 'ingredients',
    path: PATHS.INGREDIENTS.LIST,
    component: pages.IngredientListPage,
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Ingredients',
      icon: FiPackage,
      description: 'Manage ingredients',
      navOrder: 5,
    },
  },
];

/**
 * Shopping list routes
 */
export const shoppingRoutes: RouteConfig[] = [
  {
    id: 'shopping',
    path: PATHS.SHOPPING.LISTS,
    component: pages.TripListPage, // TODO: Create dedicated shopping list page
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Shopping Lists',
      icon: FiShoppingCart,
      description: 'View shopping lists',
      navOrder: 6,
    },
  },
];

/**
 * User profile routes
 */
export const profileRoutes: RouteConfig[] = [
  {
    id: 'profile',
    path: PATHS.USER.PROFILE,
    component: pages.ProfilePage,
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Profile',
      icon: FiUser,
      description: 'Your profile',
      hideInNav: true,
    },
  },
  {
    id: 'settings',
    path: PATHS.USER.SETTINGS,
    component: pages.SettingsPage,
    layout: 'dashboard',
    requireAuth: true,
    meta: {
      title: 'Settings',
      icon: FiSettings,
      description: 'Account settings',
      hideInNav: true,
    },
  },
];

/**
 * Admin routes
 */
export const adminRoutes: RouteConfig[] = [
  {
    id: 'admin',
    path: PATHS.ADMIN.DASHBOARD,
    component: pages.DashboardPage, // TODO: Create admin dashboard
    layout: 'dashboard',
    requireAuth: true,
    roles: [UserRole.ADMIN],
    meta: {
      title: 'Admin',
      icon: FiShield,
      description: 'Administration',
      navOrder: 100,
    },
    children: [
      {
        id: 'admin.users',
        path: PATHS.ADMIN.USERS,
        component: pages.DashboardPage, // TODO: Create user management page
        requireAuth: true,
        roles: [UserRole.ADMIN],
        meta: {
          title: 'Users',
          icon: FiUsers,
          description: 'Manage users',
        },
      },
      {
        id: 'admin.moderation',
        path: PATHS.ADMIN.MODERATION,
        component: pages.DashboardPage, // TODO: Create moderation page
        requireAuth: true,
        roles: [UserRole.ADMIN],
        meta: {
          title: 'Moderation',
          icon: FiAlertCircle,
          description: 'Content moderation',
          badge: 'New',
          badgeVariant: 'warning',
        },
      },
      {
        id: 'admin.reports',
        path: PATHS.ADMIN.REPORTS,
        component: pages.DashboardPage, // TODO: Create reports page
        requireAuth: true,
        roles: [UserRole.ADMIN],
        meta: {
          title: 'Reports',
          icon: FiBarChart2,
          description: 'View reports',
        },
      },
      {
        id: 'admin.settings',
        path: PATHS.ADMIN.SETTINGS,
        component: pages.DashboardPage, // TODO: Create admin settings page
        requireAuth: true,
        roles: [UserRole.ADMIN],
        meta: {
          title: 'Settings',
          icon: FiSettings,
          description: 'System settings',
        },
      },
    ],
  },
];

/**
 * Error routes
 */
export const errorRoutes: ErrorRouteConfig[] = [
  {
    statusCode: 404,
    path: PATHS.ERRORS.NOT_FOUND,
    component: pages.NotFoundPage,
    meta: {
      title: 'Page Not Found',
      icon: FiXCircle,
      description: 'The page you are looking for does not exist',
    },
  },
  {
    statusCode: 403,
    path: PATHS.ERRORS.FORBIDDEN,
    component: pages.NotFoundPage, // TODO: Create forbidden page
    meta: {
      title: 'Access Denied',
      icon: FiAlertCircle,
      description: 'You do not have permission to access this page',
    },
  },
  {
    statusCode: 500,
    path: PATHS.ERRORS.SERVER_ERROR,
    component: pages.NotFoundPage, // TODO: Create server error page
    meta: {
      title: 'Server Error',
      icon: FiAlertCircle,
      description: 'An unexpected error occurred',
    },
  },
];

/**
 * Development-only example routes
 */
export const exampleRoutes: RouteConfig[] = [
  {
    id: 'examples',
    path: PATHS.EXAMPLES.ROOT,
    component: pages.ThemeShowcasePage,
    layout: 'dashboard',
    meta: {
      title: 'Examples',
      icon: FiActivity,
      description: 'Component examples',
      navOrder: 200,
      badge: 'Dev',
      badgeVariant: 'default',
    },
    children: [
      {
        id: 'examples.theme',
        path: PATHS.EXAMPLES.THEME,
        component: pages.ThemeShowcasePage,
        meta: {
          title: 'Theme Showcase',
          icon: FiEye,
          description: 'Theme components',
        },
      },
      {
        id: 'examples.toast',
        path: PATHS.EXAMPLES.TOAST,
        component: pages.ToastExamplePage,
        meta: {
          title: 'Toast Examples',
          icon: FiAlertCircle,
          description: 'Toast notifications',
        },
      },
    ],
  },
];

/**
 * All routes combined
 */
export const routes: RouteConfig[] = [
  ...authRoutes,
  ...dashboardRoutes,
  ...recipeRoutes,
  ...tripRoutes,
  ...ingredientRoutes,
  ...shoppingRoutes,
  ...profileRoutes,
  ...adminRoutes,
  ...(process.env.NODE_ENV === 'development' ? exampleRoutes : []),
];

/**
 * Route groups for navigation organization
 */
export const routeGroups: RouteGroup[] = [
  {
    id: 'main',
    label: 'Main',
    icon: FiHome,
    order: 1,
    routes: [
      ...dashboardRoutes,
      ...recipeRoutes,
      ...tripRoutes,
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: FiPackage,
    order: 2,
    routes: [
      ...ingredientRoutes,
      ...shoppingRoutes,
    ],
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

/**
 * Get navigation items from routes
 */
export function getNavigationItems(
  routes: RouteConfig[],
  userRole?: UserRole
): NavigationItem[] {
  return routes
    .filter((route) => {
      // Filter by navigation visibility
      if (route.meta.hideInNav) return false;
      
      // Filter by user role
      if (route.roles && userRole && !route.roles.includes(userRole)) {
        return false;
      }
      
      return true;
    })
    .map((route) => ({
      id: route.id,
      label: route.meta.title,
      path: route.path,
      icon: route.meta.icon,
      badge: route.meta.badge,
      badgeVariant: route.meta.badgeVariant,
      roles: route.roles,
      children: route.children
        ? getNavigationItems(route.children, userRole)
        : undefined,
    }))
    .sort((a, b) => {
      const orderA = routes.find((r) => r.id === a.id)?.meta.navOrder ?? 999;
      const orderB = routes.find((r) => r.id === b.id)?.meta.navOrder ?? 999;
      return orderA - orderB;
    });
}

/**
 * Find route by path
 */
export function findRouteByPath(
  path: string,
  routeList: RouteConfig[] = routes
): RouteConfig | undefined {
  for (const route of routeList) {
    if (route.path === path) {
      return route;
    }
    if (route.children) {
      const found = findRouteByPath(path, route.children);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Get breadcrumbs for a route
 */
export function getBreadcrumbs(
  routeId: string,
  routeList: RouteConfig[] = routes,
  breadcrumbs: BreadcrumbItem[] = []
): BreadcrumbItem[] {
  for (const route of routeList) {
    if (route.id === routeId) {
      return [
        ...breadcrumbs,
        {
          label: route.meta.title,
          path: route.path,
          icon: route.meta.icon,
          current: true,
        },
      ];
    }
    if (route.children) {
      const found = getBreadcrumbs(routeId, route.children, [
        ...breadcrumbs,
        {
          label: route.meta.title,
          path: route.path,
          icon: route.meta.icon,
        },
      ]);
      if (found.length > breadcrumbs.length) {
        return found;
      }
    }
  }
  return breadcrumbs;
}