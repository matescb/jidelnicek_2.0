import { create } from 'zustand';
import { 
  persist, 
  createPersistedStore, 
  persistWithDefaults,
  migrationHelpers,
  createMigrationManifest,
  IndexedDBAdapter,
  createStorageAdapter,
  type PersistOptions
} from './index';

// Example 1: Basic persistence with localStorage
interface BasicStore {
  count: number;
  user: { name: string; email: string } | null;
  increment: () => void;
  setUser: (user: { name: string; email: string }) => void;
}

export const useBasicStore = create<BasicStore>()(
  persist(
    (set) => ({
      count: 0,
      user: null,
      increment: () => set((state) => ({ count: state.count + 1 })),
      setUser: (user) => set({ user }),
    }),
    {
      name: 'basic-store',
      // Persist only specific fields
      partialize: (state) => ({ count: state.count, user: state.user }),
    }
  )
);

// Example 2: Advanced persistence with encryption and compression
interface SecureStore {
  apiKey: string;
  userData: {
    id: string;
    email: string;
    profile: {
      name: string;
      avatar: string;
      preferences: Record<string, any>;
    };
  } | null;
  largeData: any[];
  setApiKey: (key: string) => void;
  setUserData: (data: any) => void;
  addLargeData: (item: any) => void;
}

export const useSecureStore = create<SecureStore>()(
  persist(
    (set) => ({
      apiKey: '',
      userData: null,
      largeData: [],
      setApiKey: (apiKey) => set({ apiKey }),
      setUserData: (userData) => set({ userData }),
      addLargeData: (item) => set((state) => ({ 
        largeData: [...state.largeData, item] 
      })),
    }),
    {
      name: 'secure-store',
      // Enable compression for large data
      compress: true,
      // Enable encryption with field-specific encryption
      encrypt: {
        key: process.env.REACT_APP_ENCRYPTION_KEY || 'your-secure-key-here',
        fields: ['apiKey', 'userData.profile.preferences'],
        algorithm: 'AES-GCM',
      },
      // Use IndexedDB for large data storage
      storage: new IndexedDBAdapter('myapp-secure-storage'),
      // Whitelist specific fields
      whitelist: ['apiKey', 'userData', 'largeData'],
    }
  )
);

// Example 3: Store with migrations
interface VersionedStore {
  version: number;
  settings: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
    // New fields added in v2
    autoSave?: boolean;
    // Field renamed in v3
    colorScheme?: 'light' | 'dark' | 'auto';
  };
  updateSettings: (settings: Partial<VersionedStore['settings']>) => void;
}

// Create migration manifest
const migrations = createMigrationManifest();

// Migration from v1 to v2: Add autoSave field
migrations.addMigration(2, (state: any) => ({
  ...state,
  settings: {
    ...state.settings,
    autoSave: true, // Default value for new field
  },
}));

// Migration from v2 to v3: Rename theme to colorScheme
migrations.addMigration(3, migrationHelpers.compose(
  migrationHelpers.renameField('settings.theme', 'settings.colorScheme'),
  migrationHelpers.transformField('settings.colorScheme', (value) => {
    // Transform old values to new format if needed
    return value === 'light' || value === 'dark' ? value : 'auto';
  })
));

export const useVersionedStore = create<VersionedStore>()(
  persist(
    (set) => ({
      version: 3,
      settings: {
        theme: 'light',
        colorScheme: 'light',
        language: 'en',
        notifications: true,
        autoSave: true,
      },
      updateSettings: (newSettings) => 
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),
    }),
    {
      name: 'versioned-store',
      version: 3,
      migrate: (persistedState: any, version: number) => {
        // Run migrations based on version
        let migratedState = persistedState;
        
        if (version < 2) {
          migratedState = migrations.getManifest()[2](migratedState);
        }
        
        if (version < 3) {
          migratedState = migrations.getManifest()[3](migratedState);
        }
        
        return migratedState;
      },
    }
  )
);

// Example 4: Multi-storage with fallback
interface MultiStorageStore {
  tempData: any; // Session storage
  persistentData: any; // Local storage with IndexedDB fallback
  setTempData: (data: any) => void;
  setPersistentData: (data: any) => void;
}

export const useMultiStorageStore = create<MultiStorageStore>()(
  createPersistedStore(
    (set) => ({
      tempData: null,
      persistentData: null,
      setTempData: (tempData) => set({ tempData }),
      setPersistentData: (persistentData) => set({ persistentData }),
    }),
    {
      name: 'multi-storage',
      storageBackend: 'localStorage',
      fallbackStorage: 'indexedDB',
      // Use sessionStorage for temp data
      partialize: (state) => ({
        persistentData: state.persistentData,
        // tempData is not persisted to localStorage
      }),
    }
  )
);

// Example 5: Store with quota management
interface QuotaManagedStore {
  files: Array<{ id: string; name: string; data: string }>;
  addFile: (file: { id: string; name: string; data: string }) => void;
  removeFile: (id: string) => void;
}

export const useQuotaManagedStore = create<QuotaManagedStore>()(
  persist(
    (set) => ({
      files: [],
      addFile: (file) => set((state) => ({ 
        files: [...state.files, file] 
      })),
      removeFile: (id) => set((state) => ({
        files: state.files.filter((f) => f.id !== id)
      })),
    }),
    {
      name: 'quota-managed-store',
      storage: createStorageAdapter('localStorage', {
        quota: {
          maxSize: 5 * 1024 * 1024, // 5MB limit
          warningThreshold: 4 * 1024 * 1024, // Warn at 4MB
          onQuotaExceeded: (size, maxSize) => {
            console.error(`Storage quota exceeded: ${size} > ${maxSize}`);
            // Could trigger UI notification here
          },
        },
      }),
      compress: true, // Enable compression to save space
    }
  )
);

// Example 6: Testing with memory storage
interface TestStore {
  data: string;
  setData: (data: string) => void;
}

export const createTestStore = () => create<TestStore>()(
  persist(
    (set) => ({
      data: '',
      setData: (data) => set({ data }),
    }),
    {
      name: 'test-store',
      storage: createStorageAdapter('memory'),
    }
  )
);

// Utility to clear all persisted data
export async function clearAllPersistedData() {
  const stores = [
    'basic-store',
    'secure-store',
    'versioned-store',
    'multi-storage',
    'quota-managed-store',
  ];

  for (const storeName of stores) {
    try {
      localStorage.removeItem(storeName);
      sessionStorage.removeItem(storeName);
      
      // Clear IndexedDB
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name?.includes(storeName)) {
          await indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (error) {
      console.error(`Failed to clear ${storeName}:`, error);
    }
  }
}

// Example of using the persist API directly
export function demonstratePersistAPI() {
  // Access persist API
  const store = useBasicStore.getState();
  
  // Check if hydration is complete
  if ('persist' in store) {
    const persistApi = (store as any).persist;
    
    // Manually trigger rehydration
    persistApi.rehydrate();
    
    // Clear storage
    persistApi.clearStorage();
    
    // Update options at runtime
    persistApi.setOptions({
      compress: true,
    });
    
    // Get current options
    const options = persistApi.getOptions();
    console.log('Current persist options:', options);
  }
}