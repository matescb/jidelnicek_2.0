/**
 * Hydration Utility Functions
 * 
 * Helper functions for state hydration, validation, and merging
 */

import type { DeepMergeOptions, ValidationResult } from './types';

/**
 * Deep merge two objects with configurable options
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
  options: DeepMergeOptions = {}
): T {
  const {
    cloneArrays = false,
    customMerge,
    skipKeys = [],
  } = options;

  // Clone target to avoid mutations
  const result = { ...target };

  for (const key in source) {
    // Skip specified keys
    if (skipKeys.includes(key)) {
      continue;
    }

    const sourceValue = source[key];
    const targetValue = result[key];

    // Use custom merge if provided
    if (customMerge) {
      const customResult = customMerge(key, targetValue, sourceValue);
      if (customResult !== undefined) {
        result[key] = customResult;
        continue;
      }
    }

    // Handle null or undefined
    if (sourceValue === null || sourceValue === undefined) {
      result[key] = sourceValue;
      continue;
    }

    // Handle arrays
    if (Array.isArray(sourceValue)) {
      result[key] = cloneArrays 
        ? [...sourceValue] as any
        : sourceValue as any;
      continue;
    }

    // Handle objects (but not dates, regexes, etc.)
    if (
      typeof sourceValue === 'object' &&
      sourceValue.constructor === Object &&
      targetValue &&
      typeof targetValue === 'object' &&
      targetValue.constructor === Object
    ) {
      result[key] = deepMerge(targetValue, sourceValue, options);
      continue;
    }

    // Direct assignment for primitives and other types
    result[key] = sourceValue;
  }

  return result;
}

/**
 * Shallow merge two objects
 */
export function shallowMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  return { ...target, ...source };
}

/**
 * Validate state shape against expected structure
 */
export function validateStateShape(
  state: unknown,
  schema: Record<string, any>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  function validate(value: any, schemaValue: any, path: string = '') {
    // Check type
    const valueType = Array.isArray(value) ? 'array' : typeof value;
    const schemaType = Array.isArray(schemaValue) ? 'array' : typeof schemaValue;

    if (valueType !== schemaType) {
      errors.push(`Type mismatch at ${path || 'root'}: expected ${schemaType}, got ${valueType}`);
      return;
    }

    // Validate objects recursively
    if (valueType === 'object' && value !== null && schemaValue !== null) {
      // Check for missing required keys
      for (const key in schemaValue) {
        if (!(key in value)) {
          warnings.push(`Missing key at ${path}.${key}`);
        } else {
          validate(value[key], schemaValue[key], path ? `${path}.${key}` : key);
        }
      }

      // Check for extra keys
      for (const key in value) {
        if (!(key in schemaValue)) {
          warnings.push(`Extra key at ${path}.${key}`);
        }
      }
    }
  }

  try {
    validate(state, schema);
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Create a state validator function
 */
export function createStateValidator<T>(
  schema: Record<string, any>
): (state: unknown) => state is T {
  return (state: unknown): state is T => {
    const result = validateStateShape(state, schema);
    return result.valid;
  };
}

/**
 * Measure hydration timing
 */
export function measureHydrationTime<T>(
  fn: () => T,
  label: string
): T {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Hydration] ${label} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Hydration] ${label} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Create hydration timing middleware
 */
export function withHydrationTiming<T extends (...args: any[]) => any>(
  fn: T,
  label: string
): T {
  return ((...args: Parameters<T>) => {
    return measureHydrationTime(() => fn(...args), label);
  }) as T;
}

/**
 * Wait for hydration with timeout
 */
export async function waitForHydration(
  checkFn: () => boolean,
  options: {
    timeout?: number;
    interval?: number;
    label?: string;
  } = {}
): Promise<void> {
  const {
    timeout = 5000,
    interval = 100,
    label = 'hydration',
  } = options;

  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (checkFn()) {
        resolve();
        return;
      }

      if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for ${label} after ${timeout}ms`));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Batch hydration operations
 */
export async function batchHydrate<T>(
  items: Array<{ fn: () => Promise<T>; label: string }>,
  options: {
    maxConcurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<T[]> {
  const {
    maxConcurrency = 3,
    onProgress,
  } = options;

  const results: T[] = [];
  const queue = [...items];
  let completed = 0;

  async function processNext(): Promise<void> {
    const item = queue.shift();
    if (!item) return;

    try {
      const result = await measureHydrationTime(
        () => item.fn(),
        item.label
      );
      results.push(result);
    } catch (error) {
      console.error(`[Hydration] Batch item ${item.label} failed:`, error);
      throw error;
    } finally {
      completed++;
      onProgress?.(completed, items.length);
    }

    if (queue.length > 0) {
      await processNext();
    }
  }

  // Start concurrent processing
  const workers = Array(Math.min(maxConcurrency, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);

  return results;
}

/**
 * Create a hydration checkpoint
 */
export function createHydrationCheckpoint(
  stores: Record<string, { getState: () => any }>
): () => Record<string, any> {
  const checkpoint = Object.entries(stores).reduce((acc, [name, store]) => {
    acc[name] = store.getState();
    return acc;
  }, {} as Record<string, any>);

  return () => checkpoint;
}

/**
 * Diff two state objects
 */
export function diffStates<T extends Record<string, any>>(
  oldState: T,
  newState: T
): Array<{ path: string; oldValue: any; newValue: any }> {
  const changes: Array<{ path: string; oldValue: any; newValue: any }> = [];

  function diff(old: any, current: any, path: string = '') {
    // Handle primitives and null
    if (old === current) return;
    if (old == null || current == null || typeof old !== 'object' || typeof current !== 'object') {
      changes.push({ path: path || 'root', oldValue: old, newValue: current });
      return;
    }

    // Handle arrays
    if (Array.isArray(old) || Array.isArray(current)) {
      if (!Array.isArray(old) || !Array.isArray(current) || old.length !== current.length) {
        changes.push({ path: path || 'root', oldValue: old, newValue: current });
        return;
      }
      old.forEach((item, index) => {
        diff(item, current[index], path ? `${path}[${index}]` : `[${index}]`);
      });
      return;
    }

    // Handle objects
    const allKeys = new Set([...Object.keys(old), ...Object.keys(current)]);
    allKeys.forEach(key => {
      const oldValue = old[key];
      const newValue = current[key];
      if (oldValue !== newValue) {
        diff(oldValue, newValue, path ? `${path}.${key}` : key);
      }
    });
  }

  diff(oldState, newState);
  return changes;
}

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(
  json: string,
  fallback: T
): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn('[Hydration] Failed to parse JSON:', error);
    return fallback;
  }
}

/**
 * Check if running on server
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Check if running on client
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get hydration data from DOM
 */
export function getHydrationData<T>(
  id: string = '__HYDRATION_DATA__'
): T | null {
  if (isServer()) return null;

  const element = document.getElementById(id);
  if (!element) return null;

  try {
    const data = element.textContent || '';
    return JSON.parse(data);
  } catch (error) {
    console.error('[Hydration] Failed to parse hydration data:', error);
    return null;
  }
}

/**
 * Inject hydration data into DOM
 */
export function injectHydrationData(
  data: any,
  id: string = '__HYDRATION_DATA__'
): string {
  const serialized = JSON.stringify(data);
  return `<script id="${id}" type="application/json">${serialized}</script>`;
}