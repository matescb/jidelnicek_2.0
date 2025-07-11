// Main persistence middleware exports
export { persist, createPersistedStore, persistWithDefaults } from './persistenceMiddleware';

// Storage adapters
export {
  LocalStorageAdapter,
  SessionStorageAdapter,
  IndexedDBAdapter,
  MemoryAdapter,
  createStorageAdapter,
} from './storageAdapters';

// Migration utilities
export {
  SchemaValidator,
  MigrationRunner,
  migrationHelpers,
  createMigrationManifest,
  testMigration,
  type MigrationConfig,
} from './migrations';

// Encryption utilities
export {
  EncryptionManager,
  createEncryptedStorage,
  encryptFields,
  decryptFields,
  generateSecureKey,
  hashData,
} from './encryption';

// Types
export type {
  PersistOptions,
  StateStorage,
  EncryptionOptions,
  StorageAdapter,
  StorageBackend,
  MigrationManifest,
  PersistedState,
  CompressionOptions,
  StorageMetrics,
  StorageQuota,
  MultiStorageOptions,
  Persist,
  PersistStorage,
} from './types';

// Re-export useful Zustand types
export type { StateCreator, StoreMutatorIdentifier } from 'zustand';