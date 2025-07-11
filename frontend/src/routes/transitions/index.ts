// Main components
export {
  RouteTransition,
  PageTransition,
  SectionTransition,
} from './RouteTransition';

export {
  PageTransitions,
  PageTransitionWrapper,
  StaggeredContent,
  StaggeredItem,
} from './PageTransitions';

export {
  TransitionProvider,
  useTransitionProvider,
  transitionPresets,
  applyTransitionPreset,
  useTransitionSettings,
} from './TransitionProvider';

export {
  ScrollRestoration,
  useScrollRestoration,
  ScrollToTopButton,
} from './ScrollRestoration';

export {
  PreloadManager,
  usePreloadRoute,
  PreloadLink,
  ResourceHints,
} from './PreloadManager';

export {
  RouteErrorBoundary,
  AsyncErrorBoundary,
} from './RouteErrorBoundary';

export {
  ProgressBar,
  ManualProgressBar,
  IndeterminateProgressBar,
  CircularProgress,
  StepProgress,
} from './ProgressBar';

// Loading states
export {
  PageSkeleton,
  ComponentLoader,
  ProgressiveSkeleton,
  ListSkeleton,
  CardSkeleton,
  TableSkeleton,
  FormSkeleton,
} from './LoadingStates';

// Transitions and animations
export {
  fadeVariants,
  slideLeftVariants,
  slideRightVariants,
  slideUpVariants,
  slideDownVariants,
  scaleVariants,
  scaleFadeVariants,
  rotateVariants,
  slideScaleVariants,
  pageTransitions,
  getTransitionVariants,
  staggerContainerVariants,
  staggerItemVariants,
  listItemVariants,
  overlayVariants,
  modalVariants,
  timingFunctions,
  springPresets,
  createCustomTransition,
  routeTransitions,
} from './transitions';

// Hooks
export {
  useProgressBar,
  useRouteTransition,
  useLoadingState,
  useProgressiveLoading,
  useMultipleLoadingStates,
  useAnimatedListLoading,
  useRoutePrefetch,
  usePageTransition,
  useNavigationDirection,
  useTransitionState,
  useGestureTransition,
  useTransitionPerformance,
} from './hooks';

// Types
export type { RouteTransitionOptions, LoadingStateOptions } from './hooks';
export type { TransitionMode, TransitionDirection } from './PageTransitions';