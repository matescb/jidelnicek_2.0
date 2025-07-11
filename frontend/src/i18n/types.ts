import enTranslations from './locales/en'

// Get the type of the English translations (our source of truth)
export type TranslationResource = typeof enTranslations

// Recursive type to generate dot-notation paths from nested object
export type DotNotationPaths<T extends Record<string, any>, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends Record<string, any>
    ? K extends string
      ? T[K] extends (...args: any[]) => any
        ? never
        : DotNotationPaths<T[K], `${Prefix}${Prefix extends '' ? '' : '.'}${K}`>
      : never
    : K extends string
    ? `${Prefix}${Prefix extends '' ? '' : '.'}${K}`
    : never
}[keyof T]

// Get all translation keys as dot notation paths
export type TranslationKey = DotNotationPaths<TranslationResource>

// Get the type of a specific translation value by its key
export type TranslationValue<K extends TranslationKey> = K extends `${infer NS}.${infer Rest}`
  ? NS extends keyof TranslationResource
    ? Rest extends string
      ? GetNestedValue<TranslationResource[NS], Rest>
      : never
    : never
  : K extends keyof TranslationResource
  ? TranslationResource[K]
  : never

// Helper type to get nested value from object using dot notation
type GetNestedValue<T, Path extends string> = Path extends `${infer Key}.${infer Rest}`
  ? Key extends keyof T
    ? GetNestedValue<T[Key], Rest>
    : never
  : Path extends keyof T
  ? T[Path]
  : never

// Extract interpolation parameters from a translation string
export type InterpolationParams<T extends string> = T extends `${string}{{${infer Param}}}${infer Rest}`
  ? Param extends `${infer P}, ${string}`
    ? { [K in P]: string | number } & InterpolationParams<Rest>
    : { [K in Param]: string | number } & InterpolationParams<Rest>
  : {}

// Options for translation functions
export interface TranslationOptions<T extends string = string> {
  defaultValue?: string
  count?: number
  context?: string
  replace?: InterpolationParams<T>
  interpolation?: Record<string, any>
  lng?: string
  fallbackLng?: string | string[]
  ns?: string | string[]
  keySeparator?: string | false
  nsSeparator?: string | false
  returnObjects?: boolean
  returnDetails?: boolean
  joinArrays?: string
  postProcess?: string | string[]
}

// Namespace type
export type TranslationNamespace = keyof TranslationResource

// Type-safe translation function
export type TypedTFunction = <K extends TranslationKey>(
  key: K,
  options?: TranslationOptions<TranslationValue<K> extends string ? TranslationValue<K> : string>
) => TranslationValue<K> extends string ? string : TranslationValue<K>

// Translation exists function
export type TranslationExistsFunction = (key: TranslationKey, options?: { lng?: string; ns?: string }) => boolean

// Dynamic key builder type
export type KeyBuilder<NS extends TranslationNamespace> = {
  [K in keyof TranslationResource[NS]]: TranslationResource[NS][K] extends Record<string, any>
    ? KeyBuilder<NS> & {
        [SubK in keyof TranslationResource[NS][K]]: TranslationResource[NS][K][SubK] extends Record<string, any>
          ? KeyBuilder<NS>
          : () => string
      }
    : () => string
}

// Plural suffixes supported by i18next
export type PluralSuffix = '_zero' | '_one' | '_two' | '_few' | '_many' | '_other'

// Development mode types
export interface MissingTranslation {
  key: string
  namespace?: string
  language?: string
  timestamp: Date
}

// Translation component props
export interface TransProps<K extends TranslationKey = TranslationKey> {
  i18nKey: K
  values?: TranslationOptions<TranslationValue<K> extends string ? TranslationValue<K> : string>['replace']
  components?: Record<string, React.ReactElement>
  children?: React.ReactNode
  shouldUnescape?: boolean
  parent?: React.ReactNode | null
  count?: number
  context?: string
  defaults?: string
  ns?: string | string[]
  t?: TypedTFunction
}

// Export namespace types for convenience
export type AuthTranslations = TranslationResource['auth']
export type NavigationTranslations = TranslationResource['navigation']
export type RecipesTranslations = TranslationResource['recipes']
export type TripsTranslations = TranslationResource['trips']
export type CommonTranslations = TranslationResource['common']
export type ErrorsTranslations = TranslationResource['errors']
export type NutritionTranslations = TranslationResource['nutrition']
export type SettingsTranslations = TranslationResource['settings']

// Language code type
export type LanguageCode = 'en' | 'cs'

// Missing key report type
export interface MissingKeyReport {
  totalKeys: number
  missingKeys: {
    [language: string]: string[]
  }
  coveragePercentage: {
    [language: string]: number
  }
  timestamp: Date
}

// Translation metadata
export interface TranslationMetadata {
  key: TranslationKey
  namespace: TranslationNamespace
  hasInterpolation: boolean
  interpolationParams?: string[]
  supportsPluralForms: boolean
  isContextual: boolean
}