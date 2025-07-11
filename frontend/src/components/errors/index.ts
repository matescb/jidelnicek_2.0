// Error Pages
export * from './pages'

// Error States
export * from './states'

// Error Illustrations
export * from './illustrations'

// Error Notifications
export * from './notifications'

// Re-export commonly used components for convenience
export {
  // Pages
  ErrorPage404,
  ErrorPage403,
  ErrorPage500,
  ErrorPageOffline,
  ErrorPageMaintenance
} from './pages'

export {
  // States
  EmptyState,
  ErrorState,
  LoadingError,
  NetworkError,
  ValidationError
} from './states'

export {
  // Illustrations
  ErrorIllustration
} from './illustrations'

export {
  // Notifications
  ErrorToast,
  ErrorBanner,
  ErrorAlert,
  ErrorModal,
  // Hooks
  useErrorToast,
  useErrorModal
} from './notifications'