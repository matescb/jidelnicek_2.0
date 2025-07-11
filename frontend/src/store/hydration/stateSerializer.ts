/**
 * State Serialization Utilities
 * 
 * Safe JSON serialization with support for complex types like Date, Map, Set,
 * and circular references
 */

import type { Serializer, Deserializer, SerializationConfig } from './types';

/**
 * Type markers for serialization
 */
const TYPE_MARKERS = {
  DATE: '__date__',
  MAP: '__map__',
  SET: '__set__',
  UNDEFINED: '__undefined__',
  REGEXP: '__regexp__',
  ERROR: '__error__',
  CIRCULAR: '__circular__',
} as const;

/**
 * Default serializers for built-in types
 */
const DEFAULT_SERIALIZERS = new Map<string, Serializer<any>>([
  ['Date', (value: Date) => ({ [TYPE_MARKERS.DATE]: value.toISOString() })],
  ['Map', (value: Map<any, any>) => ({ [TYPE_MARKERS.MAP]: Array.from(value.entries()) })],
  ['Set', (value: Set<any>) => ({ [TYPE_MARKERS.SET]: Array.from(value) })],
  ['RegExp', (value: RegExp) => ({ [TYPE_MARKERS.REGEXP]: { source: value.source, flags: value.flags } })],
  ['Error', (value: Error) => ({ [TYPE_MARKERS.ERROR]: { message: value.message, stack: value.stack } })],
]);

/**
 * Default deserializers for built-in types
 */
const DEFAULT_DESERIALIZERS = new Map<string, Deserializer<any>>([
  [TYPE_MARKERS.DATE, (value: any) => new Date(value[TYPE_MARKERS.DATE])],
  [TYPE_MARKERS.MAP, (value: any) => new Map(value[TYPE_MARKERS.MAP])],
  [TYPE_MARKERS.SET, (value: any) => new Set(value[TYPE_MARKERS.SET])],
  [TYPE_MARKERS.REGEXP, (value: any) => new RegExp(value[TYPE_MARKERS.REGEXP].source, value[TYPE_MARKERS.REGEXP].flags)],
  [TYPE_MARKERS.ERROR, (value: any) => {
    const error = new Error(value[TYPE_MARKERS.ERROR].message);
    error.stack = value[TYPE_MARKERS.ERROR].stack;
    return error;
  }],
]);

/**
 * Serialize state with support for complex types and circular references
 */
export function serialize<T>(
  state: T,
  config: SerializationConfig = {}
): string {
  const {
    compress = false,
    serializers = new Map(),
    maxDepth = 10,
  } = config;

  const seen = new WeakMap<object, string>();
  const allSerializers = new Map([...DEFAULT_SERIALIZERS, ...serializers]);
  let circularCounter = 0;

  function replacer(key: string, value: any, depth: number = 0): any {
    // Handle max depth
    if (depth > maxDepth) {
      console.warn(`Maximum serialization depth (${maxDepth}) exceeded at key: ${key}`);
      return undefined;
    }

    // Handle undefined
    if (value === undefined) {
      return { [TYPE_MARKERS.UNDEFINED]: true };
    }

    // Handle primitives
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // Handle circular references
    if (seen.has(value)) {
      return { [TYPE_MARKERS.CIRCULAR]: seen.get(value) };
    }

    // Mark object as seen
    const path = `$circular_${circularCounter++}`;
    seen.set(value, path);

    // Get constructor name for type checking
    const typeName = value.constructor?.name;

    // Check for custom serializer
    if (typeName && allSerializers.has(typeName)) {
      const serializer = allSerializers.get(typeName)!;
      return serializer(value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item, index) => replacer(`${key}[${index}]`, item, depth + 1));
    }

    // Handle plain objects
    if (typeName === 'Object') {
      const result: any = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = replacer(`${key}.${k}`, v, depth + 1);
      }
      return result;
    }

    // Fallback for other objects
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      console.warn(`Unable to serialize object of type ${typeName} at key: ${key}`);
      return undefined;
    }
  }

  const serialized = JSON.stringify(state, (key, value) => replacer(key, value));

  // Apply compression if enabled
  if (compress && typeof window !== 'undefined' && 'CompressionStream' in window) {
    return compressString(serialized);
  }

  return serialized;
}

/**
 * Deserialize state with support for complex types
 */
export function deserialize<T>(
  serialized: string,
  config: SerializationConfig = {}
): T {
  const {
    compress = false,
    deserializers = new Map(),
  } = config;

  // Decompress if needed
  let data = serialized;
  if (compress && typeof window !== 'undefined' && 'DecompressionStream' in window) {
    data = decompressString(serialized);
  }

  const allDeserializers = new Map([...DEFAULT_DESERIALIZERS, ...deserializers]);
  const circularRefs = new Map<string, any>();

  function reviver(key: string, value: any): any {
    // Handle type markers
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Check for undefined marker
      if (TYPE_MARKERS.UNDEFINED in value) {
        return undefined;
      }

      // Check for circular reference
      if (TYPE_MARKERS.CIRCULAR in value) {
        const ref = value[TYPE_MARKERS.CIRCULAR];
        return circularRefs.get(ref);
      }

      // Check for type markers
      for (const [marker, deserializer] of allDeserializers) {
        if (marker in value) {
          const deserialized = deserializer(value);
          // Store for circular reference resolution
          if (typeof deserialized === 'object' && deserialized !== null) {
            const path = `$circular_${circularRefs.size}`;
            circularRefs.set(path, deserialized);
          }
          return deserialized;
        }
      }
    }

    return value;
  }

  return JSON.parse(data, reviver);
}

/**
 * Compress string using CompressionStream API
 */
function compressString(str: string): string {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    
    // Use CompressionStream if available
    if ('CompressionStream' in globalThis) {
      const cs = new (globalThis as any).CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(data);
      writer.close();
      
      // Read compressed data
      const reader = cs.readable.getReader();
      const chunks: Uint8Array[] = [];
      
      return new Promise<string>((resolve) => {
        function read() {
          reader.read().then(({ done, value }: any) => {
            if (done) {
              const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
              let offset = 0;
              for (const chunk of chunks) {
                compressed.set(chunk, offset);
                offset += chunk.length;
              }
              resolve(btoa(String.fromCharCode(...compressed)));
            } else {
              chunks.push(value);
              read();
            }
          });
        }
        read();
      }) as any; // Type assertion for simplicity
    }
    
    // Fallback to base64 if CompressionStream not available
    return btoa(str);
  } catch (error) {
    console.warn('Compression failed:', error);
    return str;
  }
}

/**
 * Decompress string using DecompressionStream API
 */
function decompressString(str: string): string {
  try {
    // Try to decompress if it looks like base64
    if (/^[A-Za-z0-9+/=]+$/.test(str)) {
      const compressed = Uint8Array.from(atob(str), c => c.charCodeAt(0));
      
      if ('DecompressionStream' in globalThis) {
        const ds = new (globalThis as any).DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(compressed);
        writer.close();
        
        // Read decompressed data
        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        
        return new Promise<string>((resolve) => {
          function read() {
            reader.read().then(({ done, value }: any) => {
              if (done) {
                const decoder = new TextDecoder();
                resolve(chunks.map(chunk => decoder.decode(chunk)).join(''));
              } else {
                chunks.push(value);
                read();
              }
            });
          }
          read();
        }) as any; // Type assertion for simplicity
      }
      
      // Fallback: assume it's just base64 encoded
      return atob(str);
    }
    
    return str;
  } catch (error) {
    console.warn('Decompression failed:', error);
    return str;
  }
}

/**
 * Create a snapshot of multiple stores
 */
export function createSnapshot(
  stores: Record<string, any>,
  config: SerializationConfig = {}
): string {
  const snapshot = {
    timestamp: Date.now(),
    stores: Object.entries(stores).reduce((acc, [name, state]) => {
      acc[name] = JSON.parse(serialize(state, config));
      return acc;
    }, {} as Record<string, any>),
  };

  return serialize(snapshot, config);
}

/**
 * Restore stores from snapshot
 */
export function restoreSnapshot(
  snapshot: string,
  config: SerializationConfig = {}
): { timestamp: number; stores: Record<string, any> } {
  return deserialize(snapshot, config);
}

/**
 * Validate serialized data structure
 */
export function isValidSerializedData(data: string): boolean {
  try {
    JSON.parse(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get size of serialized data in bytes
 */
export function getSerializedSize(data: string): number {
  return new Blob([data]).size;
}

/**
 * Create custom serializer for a class
 */
export function createClassSerializer<T>(
  className: string,
  serialize: (instance: T) => any,
  deserialize: (data: any) => T
): { serializer: [string, Serializer<T>]; deserializer: [string, Deserializer<T>] } {
  const marker = `__${className.toLowerCase()}__`;
  
  return {
    serializer: [className, (value: T) => ({ [marker]: serialize(value) })],
    deserializer: [marker, (value: any) => deserialize(value[marker])],
  };
}