import type { EncryptionOptions } from './types';

// Simple encryption utilities using Web Crypto API
export class EncryptionManager {
  private algorithm: string;
  private keyCache: Map<string, CryptoKey> = new Map();

  constructor(algorithm: 'AES-GCM' | 'AES-CBC' = 'AES-GCM') {
    this.algorithm = algorithm;
  }

  // Generate a crypto key from a password
  private async generateKey(password: string): Promise<CryptoKey> {
    const cached = this.keyCache.get(password);
    if (cached) return cached;

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('zustand-persist-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.algorithm, length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    this.keyCache.set(password, key);
    return key;
  }

  // Encrypt data
  async encrypt(data: string, password: string): Promise<string> {
    try {
      const key = await this.generateKey(password);
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv,
        },
        key,
        encoder.encode(data)
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedData), iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt data
  async decrypt(encryptedData: string, password: string): Promise<string> {
    try {
      const key = await this.generateKey(password);
      
      // Convert from base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      
      // Extract IV and data
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv,
        },
        key,
        data
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Clear key cache
  clearCache(): void {
    this.keyCache.clear();
  }
}

// Helper function to handle selective field encryption
export function encryptFields(
  data: any,
  fields: string[],
  encryptFn: (value: string) => Promise<string>
): Promise<any> {
  return processFields(data, fields, encryptFn, 'encrypt');
}

// Helper function to handle selective field decryption
export function decryptFields(
  data: any,
  fields: string[],
  decryptFn: (value: string) => Promise<string>
): Promise<any> {
  return processFields(data, fields, decryptFn, 'decrypt');
}

// Process fields recursively
async function processFields(
  data: any,
  fields: string[],
  processFn: (value: string) => Promise<string>,
  mode: 'encrypt' | 'decrypt'
): Promise<any> {
  if (!data || typeof data !== 'object') return data;

  const result = Array.isArray(data) ? [...data] : { ...data };

  for (const field of fields) {
    const path = field.split('.');
    await processPath(result, path, processFn, mode);
  }

  return result;
}

// Process a specific path in the object
async function processPath(
  obj: any,
  path: string[],
  processFn: (value: string) => Promise<string>,
  mode: 'encrypt' | 'decrypt'
): Promise<void> {
  if (path.length === 0) return;

  const [current, ...rest] = path;

  if (rest.length === 0) {
    // We've reached the target field
    if (obj[current] !== undefined && obj[current] !== null) {
      if (mode === 'encrypt') {
        obj[current] = await processFn(String(obj[current]));
      } else {
        try {
          obj[current] = await processFn(obj[current]);
        } catch (error) {
          console.error(`Failed to decrypt field ${current}:`, error);
          // Keep the encrypted value if decryption fails
        }
      }
    }
  } else {
    // Continue traversing
    if (obj[current] && typeof obj[current] === 'object') {
      if (Array.isArray(obj[current])) {
        // Handle arrays
        for (const item of obj[current]) {
          await processPath(item, rest, processFn, mode);
        }
      } else {
        // Handle objects
        await processPath(obj[current], rest, processFn, mode);
      }
    }
  }
}

// Create an encryption wrapper for storage
export function createEncryptedStorage(
  storage: any,
  options: EncryptionOptions
): any {
  const encryptionManager = new EncryptionManager(options.algorithm);

  return {
    async getItem(name: string): Promise<string | null> {
      const encryptedData = await storage.getItem(name);
      if (!encryptedData) return null;

      try {
        const decrypted = await encryptionManager.decrypt(encryptedData, options.key);
        
        if (options.fields && options.fields.length > 0) {
          const parsed = JSON.parse(decrypted);
          const processedData = await decryptFields(
            parsed,
            options.fields,
            (value) => encryptionManager.decrypt(value, options.key)
          );
          return JSON.stringify(processedData);
        }
        
        return decrypted;
      } catch (error) {
        console.error('Failed to decrypt stored data:', error);
        return null;
      }
    },

    async setItem(name: string, value: string): Promise<void> {
      try {
        let dataToEncrypt = value;
        
        if (options.fields && options.fields.length > 0) {
          const parsed = JSON.parse(value);
          const processedData = await encryptFields(
            parsed,
            options.fields,
            (value) => encryptionManager.encrypt(value, options.key)
          );
          dataToEncrypt = JSON.stringify(processedData);
        }
        
        const encrypted = await encryptionManager.encrypt(dataToEncrypt, options.key);
        await storage.setItem(name, encrypted);
      } catch (error) {
        console.error('Failed to encrypt data for storage:', error);
        throw error;
      }
    },

    async removeItem(name: string): Promise<void> {
      await storage.removeItem(name);
    },

    clear: storage.clear?.bind(storage),
    getAllKeys: storage.getAllKeys?.bind(storage),
  };
}

// Utility to generate secure keys
export function generateSecureKey(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Utility to hash sensitive data
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}