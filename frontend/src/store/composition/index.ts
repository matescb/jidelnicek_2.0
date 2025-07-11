/**
 * Store Composition System
 * Main exports for the Zustand store composition utilities
 */

// Types
export * from './types';

// Store Composer
export {
  composeStore,
  combineStores,
  createSlice,
  extendSlice,
} from './storeComposer';

// Slice Factory
export {
  createCrudSlice,
  createAsyncSlice,
  createListSlice,
  createFormSlice,
  createModalSlice,
  createPaginatedAsyncSlice,
} from './sliceFactory';

// Selectors
export {
  createSelector,
  combineSelectors,
  createParametricSelector,
  createCrossStoreSelector,
  useSelectorHook,
  createDerivedSelector,
  useListSelector,
  createSliceSelector,
  createPropertySelector,
  pipeSelectors,
  createFilteredSelector,
  createSortedSelector,
  createPaginatedSelector,
} from './selectors';

// Middleware
export {
  loggerMiddleware,
  devtoolsMiddleware,
  actionTrackingMiddleware,
  performanceMiddleware,
  composeMiddleware,
  conditionalMiddleware,
  batchingMiddleware,
  validationMiddleware,
} from './middleware';

// Re-export commonly used types for convenience
export type {
  SliceConfig,
  StoreCompositionConfig,
  ComposedStore,
  CrudOperations,
  AsyncState,
  ListState,
  FormState,
  ModalState,
  Selector,
  ParametricSelector,
  StoreMiddleware,
} from './types';