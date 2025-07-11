/**
 * State Hydration System for Zustand
 * 
 * Provides comprehensive hydration support for both SSR and client-side scenarios
 */

// Main hydration middleware
export { 
  hydrationMiddleware,
  createServerSnapshot,
  hydrateFromSnapshot,
  getHydrationStatus,
  waitForStores,
  resetHydration,
  createHydrationScript,
} from './hydrationMiddleware';

// React context and components
export {
  HydrationProvider,
  HydrationBoundary,
  HydrationScript,
  useHydration,
  useWaitForHydration,
  useStoreHydrationStatus,
  useManualHydration,
  withHydration,
} from './hydrationContext';

// State serialization utilities
export {
  serialize,
  deserialize,
  createSnapshot,
  restoreSnapshot,
  isValidSerializedData,
  getSerializedSize,
  createClassSerializer,
  type Serializer,
  type Deserializer,
} from './stateSerializer';

// Utility functions
export {
  deepMerge,
  shallowMerge,
  validateStateShape,
  createStateValidator,
  measureHydrationTime,
  withHydrationTiming,
  waitForHydration,
  batchHydrate,
  createHydrationCheckpoint,
  diffStates,
  safeJsonParse,
  isServer,
  isClient,
  getHydrationData,
  injectHydrationData,
} from './utils';

// Types
export type {
  HydrationOptions,
  HydrationState,
  HydrationContextValue,
  ServerStateSnapshot,
  SerializationConfig,
  HydrationQueueItem,
  DeepMergeOptions,
  ValidationResult,
} from './types';

/**
 * Example usage with a Zustand store:
 * 
 * ```typescript
 * import { create } from 'zustand';
 * import { hydrationMiddleware } from '@/store/hydration';
 * 
 * interface UserStore {
 *   user: User | null;
 *   isAuthenticated: boolean;
 *   login: (user: User) => void;
 *   logout: () => void;
 * }
 * 
 * export const useUserStore = create<UserStore>()(
 *   hydrationMiddleware({
 *     name: 'user-store',
 *     merge: 'deep',
 *     transform: (state) => ({
 *       ...state,
 *       // Ensure dates are properly restored
 *       user: state.user ? {
 *         ...state.user,
 *         createdAt: new Date(state.user.createdAt),
 *       } : null,
 *     }),
 *     validate: (state): state is Partial<UserStore> => {
 *       return typeof state === 'object' && state !== null;
 *     },
 *   })(
 *     (set) => ({
 *       user: null,
 *       isAuthenticated: false,
 *       login: (user) => set({ user, isAuthenticated: true }),
 *       logout: () => set({ user: null, isAuthenticated: false }),
 *     })
 *   )
 * );
 * ```
 * 
 * Server-side usage:
 * 
 * ```typescript
 * // In your SSR handler
 * import { createServerSnapshot } from '@/store/hydration';
 * 
 * const snapshot = createServerSnapshot();
 * const html = renderToString(
 *   <HydrationProvider serverSnapshot={snapshot}>
 *     <App />
 *   </HydrationProvider>
 * );
 * 
 * // Include hydration script in HTML
 * const fullHtml = `
 *   <!DOCTYPE html>
 *   <html>
 *     <body>
 *       <div id="root">${html}</div>
 *       <HydrationScript snapshot={snapshot} />
 *     </body>
 *   </html>
 * `;
 * ```
 * 
 * Client-side usage:
 * 
 * ```typescript
 * // In your client entry point
 * import { HydrationProvider } from '@/store/hydration';
 * 
 * function App() {
 *   return (
 *     <HydrationProvider autoHydrate>
 *       <HydrationBoundary 
 *         stores={['user-store', 'ui-store']}
 *         fallback={<LoadingSpinner />}
 *       >
 *         <MainApp />
 *       </HydrationBoundary>
 *     </HydrationProvider>
 *   );
 * }
 * ```
 */