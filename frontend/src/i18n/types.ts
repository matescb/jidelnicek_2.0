import type { TFunction } from 'i18next'
import type enTranslations from './locales/en'

// Define the shape of our translations based on the English translations
export type TranslationKeys = typeof enTranslations

// Create a dot-notation type for all translation keys
type DotPrefix<T extends string> = T extends '' ? '' : `${T}.`

type DotNestedKeys<T> = (
  T extends object ?
    { [K in Exclude<keyof T, symbol>]: 
        `${DotPrefix<K & string>}${DotNestedKeys<T[K]>}` 
    }[Exclude<keyof T, symbol>]
  : ''
) extends infer D ? Extract<D, string> : never

export type TranslationKey = DotNestedKeys<TranslationKeys>

// Namespace types
export type Namespace = 'common' | 'auth' | 'recipes' | 'trips' | 'admin' | 'validation' | 'errors'

// Language info type
export interface LanguageInfo {
  code: string
  name: string
  nativeName: string
  flag: string
  dir: 'ltr' | 'rtl'
  dateFormat?: string
  currency?: string
  numberFormat?: string
}

// Translation context types for gender/formal variations
export interface TranslationContext {
  gender?: 'male' | 'female' | 'neutral'
  formal?: boolean
  count?: number
}

// Translation options extending i18next options
export interface TranslationOptions {
  ns?: Namespace | Namespace[]
  context?: TranslationContext
  defaultValue?: string
  fallbackLng?: string
  interpolation?: Record<string, any>
  count?: number
}

// Type-safe translation function
export type TypedTFunction = TFunction<Namespace, TranslationKeys>

// Missing translation info
export interface MissingTranslation {
  key: string
  namespace: string
  language: string
  timestamp: Date
  defaultValue?: string
}

// Language pack metadata
export interface LanguagePackMeta {
  version: string
  lastUpdated: string
  completeness: number
  namespaces: Namespace[]
}

// Backend sync configuration
export interface BackendConfig {
  apiUrl: string
  apiKey?: string
  syncInterval?: number
  cacheStrategy?: 'localStorage' | 'sessionStorage' | 'memory'
}

// Pluralization rules
export interface PluralizationRule {
  languages: string[]
  rule: (count: number) => number
}

// Format function types
export type FormatFunction = (value: any, format?: string, lng?: string, options?: any) => string

// Translation file structure
export interface TranslationFile {
  [key: string]: string | TranslationFile
}

// Validation result
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  coverage: number
}

export interface ValidationError {
  type: 'missing_key' | 'type_mismatch' | 'invalid_interpolation'
  key: string
  language: string
  namespace: string
  message: string
}

export interface ValidationWarning {
  type: 'unused_key' | 'duplicate_key' | 'inconsistent_format'
  key: string
  language: string
  namespace: string
  message: string
}