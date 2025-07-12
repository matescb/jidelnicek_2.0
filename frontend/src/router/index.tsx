import { Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@components/auth/ProtectedRoute'
import { PublicRoute } from '@components/auth/PublicRoute'
import { RootLayout } from '@components/layouts/RootLayout'
import { AuthLayout } from '@components/layouts/AuthLayout'
import { DashboardLayout } from '@components/layouts/DashboardLayout'
import { ErrorBoundary } from '@components/common/ErrorBoundary'
import { lazyRoute } from '@utils/lazyLoad'
import { RouteMetadata } from '@utils/routePreloader'

// Loading fallback component
const RouteLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-pulse">
      <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  </div>
)

// Lazy load pages with enhanced error handling and retry logic
const HomePage = lazyRoute(() => import('@pages/HomePage'), 'HomePage', {
  preload: true,
  onLoadError: (name, error) => {
    console.error(`Failed to load ${name}:`, error)
  }
})

// Auth pages
const LoginPage = lazyRoute(() => import('@pages/auth/LoginPage'), 'LoginPage')
const RegisterPage = lazyRoute(() => import('@pages/auth/RegisterPage'), 'RegisterPage')
const ForgotPasswordPage = lazyRoute(() => import('@pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = lazyRoute(() => import('@pages/auth/ResetPasswordPage'), 'ResetPasswordPage')
const VerifyEmailPage = lazyRoute(() => import('@pages/auth/VerifyEmailPage'), 'VerifyEmailPage')

// Dashboard pages
const DashboardPage = lazyRoute(() => import('@pages/dashboard/DashboardPage'), 'DashboardPage', {
  preload: true // Preload dashboard as it's commonly accessed after login
})

// Recipe pages
const RecipeListPage = lazyRoute(() => import('@pages/recipes/RecipeListPage'), 'RecipeListPage')
const RecipeDetailPage = lazyRoute(() => import('@pages/recipes/RecipeDetailPage'), 'RecipeDetailPage')
const RecipeCreatePage = lazyRoute(() => import('@pages/recipes/RecipeCreatePage'), 'RecipeCreatePage')
const RecipeEditPage = lazyRoute(() => import('@pages/recipes/RecipeEditPage'), 'RecipeEditPage')

// Trip pages
const TripListPage = lazyRoute(() => import('@pages/TripListPage'), 'TripListPage')
const TripDetailPage = lazyRoute(() => import('@pages/trips/TripDetailPage'), 'TripDetailPage')
const TripCreatePage = lazyRoute(() => import('@pages/trips/TripCreatePage'), 'TripCreatePage')
const TripEditPage = lazyRoute(() => import('@pages/trips/TripEditPage'), 'TripEditPage')
const TripPlannerPage = lazyRoute(() => import('@pages/trips/TripPlannerPage'), 'TripPlannerPage')
const TripParticipantsPage = lazyRoute(() => import('@pages/trips/TripParticipantsPage'), 'TripParticipantsPage')

// Ingredient pages
const IngredientsPage = lazyRoute(() => import('@pages/ingredients'), 'IngredientsPage')

// Profile pages
const ProfilePage = lazyRoute(() => import('@pages/profile/ProfilePage'), 'ProfilePage')
const SettingsPage = lazyRoute(() => import('@pages/profile/SettingsPage'), 'SettingsPage')

// Error pages
const NotFoundPage = lazyRoute(() => import('@pages/NotFoundPage'), 'NotFoundPage')

// Component-based pages (wrapping existing components)
const ShoppingListView = lazyRoute(() => import('@components/trips/ShoppingListView'), 'ShoppingListView')
const TripCalendarView = lazyRoute(() => import('@components/trips/TripCalendarView'), 'TripCalendarView')

// Development-only pages
const ThemeShowcasePage = lazyRoute(() => import('@pages/theme/ThemeShowcasePage'), 'ThemeShowcasePage')
const UserProfileDemo = lazyRoute(() => import('@pages/participants/UserProfileDemo'), 'UserProfileDemo')
const AnimationShowcase = lazyRoute(() => import('@components/examples/AnimationShowcase'), 'AnimationShowcase')

// Wrapper component for adding Suspense boundaries to routes
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    {children}
  </Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary level="page" />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <HomePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'auth',
        element: (
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        ),
        errorElement: <ErrorBoundary level="section" />,
        children: [
          {
            path: 'login',
            element: (
              <SuspenseWrapper>
                <LoginPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'register',
            element: (
              <SuspenseWrapper>
                <RegisterPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'forgot-password',
            element: (
              <SuspenseWrapper>
                <ForgotPasswordPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'reset-password',
            element: (
              <SuspenseWrapper>
                <ResetPasswordPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'verify-email',
            element: (
              <SuspenseWrapper>
                <VerifyEmailPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        errorElement: <ErrorBoundary level="section" />,
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <DashboardPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'recipes',
            children: [
              {
                index: true,
                element: (
                  <SuspenseWrapper>
                    <RecipeListPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: 'new',
                element: (
                  <SuspenseWrapper>
                    <RecipeCreatePage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: ':id',
                element: (
                  <SuspenseWrapper>
                    <RecipeDetailPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: ':id/edit',
                element: (
                  <SuspenseWrapper>
                    <RecipeEditPage />
                  </SuspenseWrapper>
                ),
              },
            ],
          },
          {
            path: 'trips',
            children: [
              {
                index: true,
                element: (
                  <SuspenseWrapper>
                    <TripListPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: 'new',
                element: (
                  <SuspenseWrapper>
                    <TripCreatePage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: ':id',
                element: (
                  <SuspenseWrapper>
                    <TripDetailPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: ':id/edit',
                element: (
                  <SuspenseWrapper>
                    <TripEditPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: ':id/planner',
                element: (
                  <SuspenseWrapper>
                    <TripPlannerPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: ':id/participants',
                element: (
                  <SuspenseWrapper>
                    <TripParticipantsPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: 'calendar',
                element: (
                  <SuspenseWrapper>
                    <TripCalendarView />
                  </SuspenseWrapper>
                ),
              },
            ],
          },
          {
            path: 'ingredients',
            children: [
              {
                index: true,
                element: (
                  <SuspenseWrapper>
                    <IngredientsPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: 'new',
                element: (
                  <SuspenseWrapper>
                    <IngredientsPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: ':id',
                element: (
                  <SuspenseWrapper>
                    <IngredientsPage />
                  </SuspenseWrapper>
                ),
              },
              {
                path: ':id/edit',
                element: (
                  <SuspenseWrapper>
                    <IngredientsPage />
                  </SuspenseWrapper>
                ),
              },
            ],
          },
          {
            path: 'profile',
            element: (
              <SuspenseWrapper>
                <ProfilePage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'settings',
            element: (
              <SuspenseWrapper>
                <SettingsPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      // Admin routes (outside dashboard layout)
      {
        path: 'admin',
        element: (
          <ProtectedRoute requiredRole="admin">
            <DashboardLayout />
          </ProtectedRoute>
        ),
        errorElement: <ErrorBoundary level="section" />,
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <DashboardPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'users',
            element: (
              <SuspenseWrapper>
                <DashboardPage />
              </SuspenseWrapper>
            ), // Placeholder
          },
          {
            path: 'users/:id',
            element: (
              <SuspenseWrapper>
                <DashboardPage />
              </SuspenseWrapper>
            ), // Placeholder
          },
          {
            path: 'moderation',
            element: (
              <SuspenseWrapper>
                <DashboardPage />
              </SuspenseWrapper>
            ), // Placeholder
          },
          {
            path: 'reports',
            element: (
              <SuspenseWrapper>
                <DashboardPage />
              </SuspenseWrapper>
            ), // Placeholder
          },
          {
            path: 'settings',
            element: (
              <SuspenseWrapper>
                <DashboardPage />
              </SuspenseWrapper>
            ), // Placeholder
          },
        ],
      },
      // Shopping lists routes
      {
        path: 'shopping-lists',
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        errorElement: <ErrorBoundary level="section" />,
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <ShoppingListView />
              </SuspenseWrapper>
            ),
          },
          {
            path: ':id',
            element: (
              <SuspenseWrapper>
                <ShoppingListView />
              </SuspenseWrapper>
            ), // Placeholder for detail view
          },
        ],
      },
      // Error routes
      {
        path: '403',
        element: (
          <SuspenseWrapper>
            <NotFoundPage />
          </SuspenseWrapper>
        ), // Placeholder
      },
      {
        path: '500',
        element: (
          <SuspenseWrapper>
            <NotFoundPage />
          </SuspenseWrapper>
        ), // Placeholder
      },
      // Development-only routes
      ...(import.meta.env.DEV ? [
        {
          path: 'theme-showcase',
          element: (
            <SuspenseWrapper>
              <ThemeShowcasePage />
            </SuspenseWrapper>
          ),
        },
        {
          path: 'user-profile-demo',
          element: (
            <SuspenseWrapper>
              <UserProfileDemo />
            </SuspenseWrapper>
          ),
        },
        {
          path: 'animation-showcase',
          element: (
            <SuspenseWrapper>
              <AnimationShowcase />
            </SuspenseWrapper>
          ),
        },
      ] : []),
      {
        path: '*',
        element: (
          <SuspenseWrapper>
            <NotFoundPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
], {
  // future: {
  //   v7_startTransition: true,
  // },
})

// Route configuration for breadcrumbs
const routeConfig = {
  '/': { label: 'Home', icon: 'home' },
  '/auth/login': { label: 'Login' },
  '/auth/register': { label: 'Register' },
  '/auth/forgot-password': { label: 'Forgot Password' },
  '/auth/reset-password': { label: 'Reset Password' },
  '/auth/verify-email': { label: 'Verify Email' },
  '/dashboard': { label: 'Dashboard', icon: 'dashboard' },
  '/dashboard/recipes': { label: 'Recipes', icon: 'recipe' },
  '/dashboard/recipes/new': { label: 'New Recipe' },
  '/dashboard/recipes/:id': { label: 'Recipe Details' },
  '/dashboard/recipes/:id/edit': { label: 'Edit Recipe' },
  '/dashboard/trips': { label: 'Trips', icon: 'trip' },
  '/dashboard/trips/new': { label: 'New Trip' },
  '/dashboard/trips/:id': { label: 'Trip Details' },
  '/dashboard/trips/:id/edit': { label: 'Edit Trip' },
  '/dashboard/trips/:id/planner': { label: 'Trip Planner' },
  '/dashboard/trips/:id/participants': { label: 'Participants' },
  '/dashboard/profile': { label: 'Profile', icon: 'user' },
  '/dashboard/settings': { label: 'Settings', icon: 'settings' },
  ...(import.meta.env.DEV ? {
    '/theme-showcase': { label: 'Theme Showcase', icon: 'palette' },
    '/user-profile-demo': { label: 'User Profile Demo', icon: 'user' },
    '/animation-showcase': { label: 'Animation Showcase', icon: 'play' },
  } : {}),
}

const routeMetadata: RouteMetadata[] = [
  // High priority routes
  { path: '/', component: HomePage, preloadPriority: 'high', preloadOn: 'immediate' },
  { path: '/dashboard', component: DashboardPage, preloadPriority: 'high', preloadOn: 'immediate' },
  
  // Auth routes - preload on hover
  { path: '/auth/login', component: LoginPage, preloadPriority: 'medium', preloadOn: 'hover' },
  { path: '/auth/register', component: RegisterPage, preloadPriority: 'medium', preloadOn: 'hover' },
  
  // Main feature routes - preload on idle
  { path: '/dashboard/recipes', component: RecipeListPage, preloadPriority: 'medium', preloadOn: 'idle' },
  { path: '/dashboard/trips', component: TripListPage, preloadPriority: 'medium', preloadOn: 'idle' },
  
  // Detail pages - preload on hover/visible
  { path: '/dashboard/recipes/:id', component: RecipeDetailPage, preloadPriority: 'low', preloadOn: 'hover' },
  { path: '/dashboard/trips/:id', component: TripDetailPage, preloadPriority: 'low', preloadOn: 'hover' },
  
  // Create/Edit pages - preload on hover
  { path: '/dashboard/recipes/new', component: RecipeCreatePage, preloadPriority: 'low', preloadOn: 'hover' },
  { path: '/dashboard/recipes/:id/edit', component: RecipeEditPage, preloadPriority: 'low', preloadOn: 'hover' },
  { path: '/dashboard/trips/new', component: TripCreatePage, preloadPriority: 'low', preloadOn: 'hover' },
  { path: '/dashboard/trips/:id/edit', component: TripEditPage, preloadPriority: 'low', preloadOn: 'hover' },
  
  // Profile routes
  { path: '/dashboard/profile', component: ProfilePage, preloadPriority: 'low', preloadOn: 'idle' },
  { path: '/dashboard/settings', component: SettingsPage, preloadPriority: 'low', preloadOn: 'idle' },
]

export { routeConfig, routeMetadata }