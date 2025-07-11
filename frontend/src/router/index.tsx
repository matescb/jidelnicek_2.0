import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@components/auth/ProtectedRoute'
import { PublicRoute } from '@components/auth/PublicRoute'
import { RootLayout } from '@components/layouts/RootLayout'
import { AuthLayout } from '@components/layouts/AuthLayout'
import { DashboardLayout } from '@components/layouts/DashboardLayout'
import { ErrorBoundary } from '@components/common/ErrorBoundary'

// Lazy load pages for code splitting
const HomePage = lazy(() => import('@pages/HomePage'))
const LoginPage = lazy(() => import('@pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@pages/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('@pages/auth/VerifyEmailPage'))

const DashboardPage = lazy(() => import('@pages/dashboard/DashboardPage'))
const RecipeListPage = lazy(() => import('@pages/recipes/RecipeListPage'))
const RecipeDetailPage = lazy(() => import('@pages/recipes/RecipeDetailPage'))
const RecipeCreatePage = lazy(() => import('@pages/recipes/RecipeCreatePage'))
const RecipeEditPage = lazy(() => import('@pages/recipes/RecipeEditPage'))

const TripListPage = lazy(() => import('@pages/TripListPage'))
const TripDetailPage = lazy(() => import('@pages/trips/TripDetailPage'))
const TripCreatePage = lazy(() => import('@pages/trips/TripCreatePage'))
const TripEditPage = lazy(() => import('@pages/trips/TripEditPage'))
const TripPlannerPage = lazy(() => import('@pages/trips/TripPlannerPage'))
const TripParticipantsPage = lazy(() => import('@pages/trips/TripParticipantsPage'))

const ProfilePage = lazy(() => import('@pages/profile/ProfilePage'))
const SettingsPage = lazy(() => import('@pages/profile/SettingsPage'))

const NotFoundPage = lazy(() => import('@pages/NotFoundPage'))

// Component-based pages (wrapping existing components)
const ShoppingListView = lazy(() => import('@components/trips/ShoppingListView'))
const TripCalendarView = lazy(() => import('@components/trips/TripCalendarView'))

// Development-only pages
const ThemeShowcasePage = lazy(() => import('@pages/theme/ThemeShowcasePage'))
const UserProfileDemo = lazy(() => import('@pages/participants/UserProfileDemo'))
const AnimationShowcase = lazy(() => import('@components/examples/AnimationShowcase'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'auth',
        element: (
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        ),
        children: [
          {
            path: 'login',
            element: <LoginPage />,
          },
          {
            path: 'register',
            element: <RegisterPage />,
          },
          {
            path: 'forgot-password',
            element: <ForgotPasswordPage />,
          },
          {
            path: 'reset-password',
            element: <ResetPasswordPage />,
          },
          {
            path: 'verify-email',
            element: <VerifyEmailPage />,
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
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'recipes',
            children: [
              {
                index: true,
                element: <RecipeListPage />,
              },
              {
                path: 'new',
                element: <RecipeCreatePage />,
              },
              {
                path: ':id',
                element: <RecipeDetailPage />,
              },
              {
                path: ':id/edit',
                element: <RecipeEditPage />,
              },
            ],
          },
          {
            path: 'trips',
            children: [
              {
                index: true,
                element: <TripListPage />,
              },
              {
                path: 'new',
                element: <TripCreatePage />,
              },
              {
                path: ':id',
                element: <TripDetailPage />,
              },
              {
                path: ':id/edit',
                element: <TripEditPage />,
              },
              {
                path: ':id/planner',
                element: <TripPlannerPage />,
              },
              {
                path: ':id/participants',
                element: <TripParticipantsPage />,
              },
              {
                path: 'calendar',
                element: <TripCalendarView />,
              },
            ],
          },
          {
            path: 'profile',
            element: <ProfilePage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
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
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'users',
            element: <DashboardPage />, // Placeholder
          },
          {
            path: 'users/:id',
            element: <DashboardPage />, // Placeholder
          },
          {
            path: 'moderation',
            element: <DashboardPage />, // Placeholder
          },
          {
            path: 'reports',
            element: <DashboardPage />, // Placeholder
          },
          {
            path: 'settings',
            element: <DashboardPage />, // Placeholder
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
        children: [
          {
            index: true,
            element: <ShoppingListView />,
          },
          {
            path: ':id',
            element: <ShoppingListView />, // Placeholder for detail view
          },
        ],
      },
      // Error routes
      {
        path: '403',
        element: <NotFoundPage />, // Placeholder
      },
      {
        path: '500',
        element: <NotFoundPage />, // Placeholder
      },
      // Development-only routes
      ...(import.meta.env.DEV ? [
        {
          path: 'theme-showcase',
          element: <ThemeShowcasePage />,
        },
        {
          path: 'user-profile-demo',
          element: <UserProfileDemo />,
        },
        {
          path: 'animation-showcase',
          element: <AnimationShowcase />,
        },
      ] : []),
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
], {
  // future: {
  //   v7_startTransition: true,
  // },
})

// Route configuration for breadcrumbs
export const routeConfig = {
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