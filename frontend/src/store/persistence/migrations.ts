import type { MigrationManifest } from './types';

export interface MigrationConfig {
  version: number;
  migrations: MigrationManifest;
  onMigrationStart?: (fromVersion: number, toVersion: number) => void;
  onMigrationComplete?: (fromVersion: number, toVersion: number) => void;
  onMigrationError?: (error: Error, fromVersion: number, toVersion: number) => void;
}

// Schema validation utilities
export class SchemaValidator {
  private schemas: Map<number, any> = new Map();

  registerSchema(version: number, schema: any): void {
    this.schemas.set(version, schema);
  }

  validate(data: any, version: number): { valid: boolean; errors?: string[] } {
    const schema = this.schemas.get(version);
    if (!schema) {
      return { valid: true }; // No schema registered, assume valid
    }

    const errors = this.validateAgainstSchema(data, schema);
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateAgainstSchema(data: any, schema: any, path = ''): string[] {
    const errors: string[] = [];

    // Simple schema validation (can be extended or replaced with a library like zod)
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (actualType !== schema.type) {
        errors.push(`${path}: Expected type ${schema.type}, got ${actualType}`);
      }
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`${path}: Missing required field '${field}'`);
        }
      }
    }

    if (schema.properties && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          errors.push(...this.validateAgainstSchema(
            data[key],
            subSchema,
            path ? `${path}.${key}` : key
          ));
        }
      }
    }

    return errors;
  }
}

// Migration runner
export class MigrationRunner {
  private config: MigrationConfig;
  private validator: SchemaValidator;
  private rollbackData: Map<number, any> = new Map();

  constructor(config: MigrationConfig, validator?: SchemaValidator) {
    this.config = config;
    this.validator = validator || new SchemaValidator();
  }

  async migrate(
    data: any,
    fromVersion: number
  ): Promise<{ data: any; version: number }> {
    let currentData = data;
    let currentVersion = fromVersion;

    // No migration needed
    if (currentVersion >= this.config.version) {
      return { data: currentData, version: currentVersion };
    }

    this.config.onMigrationStart?.(currentVersion, this.config.version);

    try {
      // Run migrations sequentially
      for (let v = currentVersion + 1; v <= this.config.version; v++) {
        const migration = this.config.migrations[v];
        
        if (!migration) {
          console.warn(`No migration found for version ${v}, skipping`);
          continue;
        }

        // Store rollback data
        this.rollbackData.set(v, structuredClone(currentData));

        // Run migration
        currentData = await this.runMigration(migration, currentData, v);
        currentVersion = v;

        // Validate migrated data
        const validation = this.validator.validate(currentData, v);
        if (!validation.valid) {
          throw new Error(
            `Migration to version ${v} produced invalid data: ${validation.errors?.join(', ')}`
          );
        }
      }

      this.config.onMigrationComplete?.(fromVersion, this.config.version);
      return { data: currentData, version: currentVersion };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onMigrationError?.(err, fromVersion, currentVersion);
      
      // Attempt rollback
      if (this.rollbackData.size > 0) {
        const rollbackVersion = Math.min(...Array.from(this.rollbackData.keys())) - 1;
        const rollbackData = this.rollbackData.get(rollbackVersion + 1);
        
        if (rollbackData) {
          console.warn(`Migration failed, rolling back to version ${rollbackVersion}`);
          return { data: rollbackData, version: rollbackVersion };
        }
      }
      
      throw err;
    } finally {
      this.rollbackData.clear();
    }
  }

  private async runMigration(
    migration: (state: any) => any,
    data: any,
    version: number
  ): Promise<any> {
    try {
      const result = await migration(data);
      return result;
    } catch (error) {
      throw new Error(
        `Migration to version ${version} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Common migration patterns
export const migrationHelpers = {
  // Rename a field
  renameField: (oldName: string, newName: string) => (state: any) => {
    if (oldName in state) {
      const { [oldName]: value, ...rest } = state;
      return { ...rest, [newName]: value };
    }
    return state;
  },

  // Add a new field with default value
  addField: (fieldName: string, defaultValue: any) => (state: any) => ({
    ...state,
    [fieldName]: defaultValue,
  }),

  // Remove a field
  removeField: (fieldName: string) => (state: any) => {
    const { [fieldName]: _, ...rest } = state;
    return rest;
  },

  // Transform field value
  transformField: (
    fieldName: string,
    transformer: (value: any) => any
  ) => (state: any) => ({
    ...state,
    [fieldName]: fieldName in state ? transformer(state[fieldName]) : state[fieldName],
  }),

  // Merge nested objects
  mergeNested: (path: string, updates: any) => (state: any) => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = state;
    const newState = { ...state };
    let pointer = newState;

    for (const key of keys) {
      if (!pointer[key]) pointer[key] = {};
      pointer[key] = { ...pointer[key] };
      pointer = pointer[key];
    }

    pointer[lastKey] = { ...pointer[lastKey], ...updates };
    return newState;
  },

  // Array operations
  arrayOperation: (
    path: string,
    operation: 'push' | 'unshift' | 'filter' | 'map',
    value: any
  ) => (state: any) => {
    const keys = path.split('.');
    const newState = { ...state };
    let pointer = newState;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      pointer[key] = { ...pointer[key] };
      pointer = pointer[key];
    }

    const lastKey = keys[keys.length - 1];
    const array = pointer[lastKey] || [];

    switch (operation) {
      case 'push':
        pointer[lastKey] = [...array, value];
        break;
      case 'unshift':
        pointer[lastKey] = [value, ...array];
        break;
      case 'filter':
        pointer[lastKey] = array.filter(value);
        break;
      case 'map':
        pointer[lastKey] = array.map(value);
        break;
    }

    return newState;
  },

  // Compose multiple migrations
  compose: (...migrations: Array<(state: any) => any>) => (state: any) => {
    return migrations.reduce((acc, migration) => migration(acc), state);
  },
};

// Example migration manifest builder
export function createMigrationManifest(): {
  addMigration: (version: number, migration: (state: any) => any) => void;
  getManifest: () => MigrationManifest;
} {
  const manifest: MigrationManifest = {};

  return {
    addMigration(version: number, migration: (state: any) => any) {
      manifest[version] = migration;
    },
    getManifest() {
      return manifest;
    },
  };
}

// Utility to test migrations
export async function testMigration(
  migration: (state: any) => any,
  testData: any,
  expectedResult: any
): Promise<boolean> {
  try {
    const result = await migration(testData);
    return JSON.stringify(result) === JSON.stringify(expectedResult);
  } catch (error) {
    console.error('Migration test failed:', error);
    return false;
  }
}