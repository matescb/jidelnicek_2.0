/**
 * Form data persistence hook
 * 
 * This hook provides functionality to persist form data to localStorage,
 * restore on mount, clear on successful submit, and exclude sensitive data.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { FieldValues, UseFormReturn, Path, PathValue } from 'react-hook-form';

export interface UseFormPersistOptions<TFieldValues extends FieldValues = FieldValues> {
  /**
   * Storage key for form data
   */
  storageKey: string;
  /**
   * Form instance from useForm or useZodForm
   */
  form?: UseFormReturn<TFieldValues>;
  /**
   * Enable persistence (default: true)
   */
  enabled?: boolean;
  /**
   * Exclude sensitive fields from persistence
   */
  excludeFields?: (keyof TFieldValues)[];
  /**
   * Storage type (default: 'localStorage')
   */
  storage?: 'localStorage' | 'sessionStorage';
  /**
   * Debounce delay for saving (default: 1000ms)
   */
  debounceMs?: number;
  /**
   * Transform data before saving
   */
  serialize?: (data: Partial<TFieldValues>) => string;
  /**
   * Transform data after loading
   */
  deserialize?: (data: string) => Partial<TFieldValues>;
  /**
   * Validate loaded data
   */
  validate?: (data: any) => data is Partial<TFieldValues>;
  /**
   * Clear on successful submit (default: true)
   */
  clearOnSuccess?: boolean;
  /**
   * Persist specific fields only
   */
  includeFields?: (keyof TFieldValues)[];
  /**
   * Expiry time in milliseconds
   */
  expiryMs?: number;
}

export interface UseFormPersistReturn<TFieldValues extends FieldValues = FieldValues> {
  /**
   * Save current form data
   */
  save: (data?: Partial<TFieldValues>) => void;
  /**
   * Load persisted data
   */
  load: () => Partial<TFieldValues> | null;
  /**
   * Clear persisted data
   */
  clear: () => void;
  /**
   * Check if data exists
   */
  hasPersistedData: boolean;
  /**
   * Get persisted data without loading into form
   */
  getPersistedData: () => Partial<TFieldValues> | null;
  /**
   * Last save timestamp
   */
  lastSaveTime: number | null;
  /**
   * Check if persisted data is expired
   */
  isExpired: boolean;
}

interface PersistedData<T> {
  data: T;
  timestamp: number;
  version: string;
}

const STORAGE_VERSION = '1.0';

/**
 * Hook for persisting form data
 * 
 * @example
 * ```tsx
 * const form = useZodForm({
 *   schema: userSchema,
 *   defaultValues: { name: '', email: '', password: '' }
 * });
 * 
 * const persistence = useFormPersist({
 *   storageKey: 'user-registration-form',
 *   form,
 *   excludeFields: ['password'], // Don't persist sensitive data
 *   clearOnSuccess: true,
 *   expiryMs: 24 * 60 * 60 * 1000 // 24 hours
 * });
 * 
 * // Form will auto-persist and restore
 * 
 * // Manual save
 * persistence.save(form.getValues());
 * 
 * // Clear on logout
 * persistence.clear();
 * ```
 */
export function useFormPersist<TFieldValues extends FieldValues = FieldValues>({
  storageKey,
  form,
  enabled = true,
  excludeFields = [],
  storage = 'localStorage',
  debounceMs = 1000,
  serialize = JSON.stringify,
  deserialize = JSON.parse,
  validate,
  clearOnSuccess = true,
  includeFields,
  expiryMs,
}: UseFormPersistOptions<TFieldValues>): UseFormPersistReturn<TFieldValues> {
  const [hasPersistedData, setHasPersistedData] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const storageRef = useRef(typeof window !== 'undefined' ? window[storage] : null);

  // Get storage key with prefix
  const getStorageKey = useCallback(() => {
    return `form-persist:${storageKey}`;
  }, [storageKey]);

  // Filter data based on include/exclude fields
  const filterData = useCallback(
    (data: Partial<TFieldValues>): Partial<TFieldValues> => {
      let filtered = { ...data };

      // Include only specified fields
      if (includeFields && includeFields.length > 0) {
        filtered = includeFields.reduce((acc, field) => {
          if (field in data) {
            acc[field] = data[field];
          }
          return acc;
        }, {} as Partial<TFieldValues>);
      }

      // Exclude sensitive fields
      excludeFields.forEach(field => {
        delete filtered[field];
      });

      return filtered;
    },
    [includeFields, excludeFields]
  );

  // Check if data is expired
  const checkExpiry = useCallback(
    (timestamp: number): boolean => {
      if (!expiryMs) return false;
      return Date.now() - timestamp > expiryMs;
    },
    [expiryMs]
  );

  // Save data to storage
  const save = useCallback(
    (data?: Partial<TFieldValues>) => {
      if (!enabled || !storageRef.current) return;

      const dataToSave = data || (form ? form.getValues() : {});
      const filteredData = filterData(dataToSave as Partial<TFieldValues>);

      try {
        const persistedData: PersistedData<Partial<TFieldValues>> = {
          data: filteredData,
          timestamp: Date.now(),
          version: STORAGE_VERSION,
        };

        storageRef.current.setItem(getStorageKey(), serialize(persistedData));
        setLastSaveTime(persistedData.timestamp);
        setHasPersistedData(true);
        setIsExpired(false);
      } catch (error) {
        console.error('Failed to persist form data:', error);
      }
    },
    [enabled, form, filterData, serialize, getStorageKey]
  );

  // Save with debouncing
  const debouncedSave = useCallback(
    (data?: Partial<TFieldValues>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        save(data);
      }, debounceMs);
    },
    [save, debounceMs]
  );

  // Load data from storage
  const load = useCallback((): Partial<TFieldValues> | null => {
    if (!enabled || !storageRef.current) return null;

    try {
      const item = storageRef.current.getItem(getStorageKey());
      if (!item) return null;

      const persistedData: PersistedData<Partial<TFieldValues>> = deserialize(item);

      // Check version compatibility
      if (persistedData.version !== STORAGE_VERSION) {
        clear();
        return null;
      }

      // Check expiry
      if (checkExpiry(persistedData.timestamp)) {
        setIsExpired(true);
        clear();
        return null;
      }

      // Validate data if validator provided
      if (validate && !validate(persistedData.data)) {
        clear();
        return null;
      }

      setLastSaveTime(persistedData.timestamp);
      setHasPersistedData(true);
      return persistedData.data;
    } catch (error) {
      console.error('Failed to load persisted form data:', error);
      clear();
      return null;
    }
  }, [enabled, deserialize, getStorageKey, validate, checkExpiry]);

  // Get persisted data without loading into form
  const getPersistedData = useCallback((): Partial<TFieldValues> | null => {
    return load();
  }, [load]);

  // Clear persisted data
  const clear = useCallback(() => {
    if (!storageRef.current) return;

    try {
      storageRef.current.removeItem(getStorageKey());
      setHasPersistedData(false);
      setLastSaveTime(null);
      setIsExpired(false);
    } catch (error) {
      console.error('Failed to clear persisted form data:', error);
    }
  }, [getStorageKey]);

  // Auto-load on mount
  useEffect(() => {
    if (!enabled || !form) return;

    const persistedData = load();
    if (persistedData) {
      // Set form values for each field
      Object.entries(persistedData).forEach(([key, value]) => {
        form.setValue(key as Path<TFieldValues>, value as PathValue<TFieldValues, Path<TFieldValues>>);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save on form changes
  useEffect(() => {
    if (!enabled || !form) return;

    const subscription = form.watch((data) => {
      debouncedSave(data as Partial<TFieldValues>);
    });

    return () => {
      subscription.unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, form, debouncedSave]);

  // Clear on successful submit if enabled
  useEffect(() => {
    if (!enabled || !form || !clearOnSuccess) return;

    const handleSubmitSuccess = () => {
      if (form.formState.isSubmitSuccessful) {
        clear();
      }
    };

    handleSubmitSuccess();
  }, [enabled, form?.formState.isSubmitSuccessful, clearOnSuccess, clear]);

  // Check if persisted data exists on mount
  useEffect(() => {
    if (!enabled || !storageRef.current) return;

    const item = storageRef.current.getItem(getStorageKey());
    setHasPersistedData(!!item);

    if (item) {
      try {
        const persistedData: PersistedData<Partial<TFieldValues>> = deserialize(item);
        setLastSaveTime(persistedData.timestamp);
        setIsExpired(checkExpiry(persistedData.timestamp));
      } catch {
        // Invalid data
      }
    }
  }, [enabled, getStorageKey, deserialize, checkExpiry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    save,
    load,
    clear,
    hasPersistedData,
    getPersistedData,
    lastSaveTime,
    isExpired,
  };
}

/**
 * Hook for managing multiple form persistence instances
 */
export function useMultiFormPersist() {
  const instances = useRef<Map<string, UseFormPersistReturn<any>>>(new Map());

  const clearAll = useCallback(() => {
    instances.current.forEach(instance => instance.clear());
  }, []);

  const clearByPrefix = useCallback((prefix: string) => {
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    if (!storage) return;

    const keys = Object.keys(storage);
    keys.forEach(key => {
      if (key.startsWith(`form-persist:${prefix}`)) {
        storage.removeItem(key);
      }
    });
  }, []);

  const register = useCallback(
    <T extends FieldValues>(key: string, instance: UseFormPersistReturn<T>) => {
      instances.current.set(key, instance);
      
      return () => {
        instances.current.delete(key);
      };
    },
    []
  );

  return {
    register,
    clearAll,
    clearByPrefix,
    instances: instances.current,
  };
}