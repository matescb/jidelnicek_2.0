import i18n from 'i18next'
import type {
  TranslationKey,
  TranslationNamespace,
  TranslationResource,
  TranslationMetadata,
  InterpolationParams,
  LanguageCode,
} from '../types'

/**
 * Translation key builder utilities
 */
export const keyBuilder = {
  /**
   * Build a translation key from parts
   * @example keyBuilder.join('auth', 'login') // 'auth.login'
   */
  join(...parts: string[]): string {
    return parts.filter(Boolean).join('.')
  },

  /**
   * Build a namespaced key
   * @example keyBuilder.namespaced('auth', 'login') // 'auth.login'
   */
  namespaced(namespace: TranslationNamespace, ...parts: string[]): string {
    return [namespace, ...parts.filter(Boolean)].join('.')
  },

  /**
   * Build a contextual key
   * @example keyBuilder.contextual('common.status', 'active') // 'common.status_active'
   */
  contextual(baseKey: string, context: string): string {
    return `${baseKey}_${context}`
  },

  /**
   * Build a plural key
   * @example keyBuilder.plural('items', 2) // 'items_other'
   */
  plural(baseKey: string, count: number): string {
    const pluralRule = new Intl.PluralRules(i18n.language).select(count)
    return `${baseKey}_${pluralRule}`
  },

  /**
   * Extract namespace from a key
   * @example keyBuilder.getNamespace('auth.login') // 'auth'
   */
  getNamespace(key: string): TranslationNamespace | undefined {
    const parts = key.split('.')
    return parts[0] as TranslationNamespace
  },

  /**
   * Remove namespace from a key
   * @example keyBuilder.removeNamespace('auth.login') // 'login'
   */
  removeNamespace(key: string): string {
    const parts = key.split('.')
    return parts.slice(1).join('.')
  },

  /**
   * Check if a key is namespaced
   * @example keyBuilder.isNamespaced('auth.login') // true
   */
  isNamespaced(key: string): boolean {
    return key.includes('.')
  },
}

/**
 * Missing translation detection utilities
 */
export const missingTranslationDetector = {
  /**
   * Check if a translation exists in current language
   */
  exists(key: TranslationKey): boolean {
    return i18n.exists(key as string)
  },

  /**
   * Check if a translation exists in a specific language
   */
  existsInLanguage(key: TranslationKey, language: LanguageCode): boolean {
    return i18n.exists(key as string, { lng: language })
  },

  /**
   * Get all missing translations for a language
   */
  getMissingForLanguage(language: LanguageCode, baseLanguage: LanguageCode = 'en'): string[] {
    const missing: string[] = []
    
    const checkKeys = (obj: any, prefix = '') => {
      Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          checkKeys(obj[key], fullKey)
        } else if (!i18n.exists(fullKey, { lng: language })) {
          missing.push(fullKey)
        }
      })
    }
    
    const baseResources = i18n.getResourceBundle(baseLanguage, 'translation')
    if (baseResources) {
      checkKeys(baseResources)
    }
    
    return missing
  },

  /**
   * Get translation coverage percentage
   */
  getCoverage(language: LanguageCode, baseLanguage: LanguageCode = 'en'): number {
    const missing = this.getMissingForLanguage(language, baseLanguage)
    const total = this.getTotalKeys(baseLanguage)
    
    if (total === 0) return 100
    return ((total - missing.length) / total) * 100
  },

  /**
   * Get total number of translation keys
   */
  getTotalKeys(language: LanguageCode = 'en'): number {
    let count = 0
    
    const countKeys = (obj: any) => {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          countKeys(obj[key])
        } else {
          count++
        }
      })
    }
    
    const resources = i18n.getResourceBundle(language, 'translation')
    if (resources) {
      countKeys(resources)
    }
    
    return count
  },

  /**
   * Generate a missing translation report
   */
  generateReport(languages: LanguageCode[] = ['en', 'cs']) {
    const report: Record<string, any> = {
      timestamp: new Date().toISOString(),
      languages: {},
    }

    languages.forEach(lang => {
      report.languages[lang] = {
        coverage: this.getCoverage(lang),
        missing: this.getMissingForLanguage(lang),
        total: this.getTotalKeys(lang),
      }
    })

    return report
  },
}

/**
 * Fallback management utilities
 */
export const fallbackManager = {
  /**
   * Get translation with fallback
   */
  getWithFallback(key: TranslationKey, fallback: string): string {
    return i18n.exists(key as string) ? i18n.t(key as string) : fallback
  },

  /**
   * Get translation with multiple fallbacks
   */
  getWithFallbacks(keys: TranslationKey[], defaultValue?: string): string {
    for (const key of keys) {
      if (i18n.exists(key as string)) {
        return i18n.t(key as string)
      }
    }
    return defaultValue || keys[keys.length - 1]
  },

  /**
   * Get translation with language fallback chain
   */
  getWithLanguageFallback(
    key: TranslationKey,
    languages: LanguageCode[],
    defaultValue?: string
  ): string {
    for (const lang of languages) {
      if (i18n.exists(key as string, { lng: lang })) {
        return i18n.t(key as string, { lng: lang })
      }
    }
    return defaultValue || i18n.t(key as string)
  },

  /**
   * Create a fallback chain for a key
   */
  createFallbackChain(baseKey: string, suffixes: string[]): TranslationKey[] {
    return [baseKey, ...suffixes.map(suffix => `${baseKey}.${suffix}`)] as TranslationKey[]
  },
}

/**
 * Key interpolation utilities
 */
export const interpolationHelpers = {
  /**
   * Extract interpolation variables from a translation string
   */
  extractVariables(text: string): string[] {
    const regex = /{{(\w+)}}/g
    const variables: string[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      variables.push(match[1])
    }

    return [...new Set(variables)]
  },

  /**
   * Validate interpolation parameters
   */
  validateParams<T extends string>(
    key: TranslationKey,
    params: Record<string, any>
  ): { valid: boolean; missing: string[]; extra: string[] } {
    const translation = i18n.t(key as string, { interpolation: { escapeValue: false } })
    const required = this.extractVariables(translation)
    const provided = Object.keys(params)

    const missing = required.filter(v => !provided.includes(v))
    const extra = provided.filter(v => !required.includes(v))

    return {
      valid: missing.length === 0,
      missing,
      extra,
    }
  },

  /**
   * Create type-safe interpolation object
   */
  createInterpolation<T extends string>(
    values: InterpolationParams<T>
  ): Record<string, any> {
    return values as Record<string, any>
  },

  /**
   * Safe interpolation with validation
   */
  safeInterpolate(
    key: TranslationKey,
    params: Record<string, any>,
    options?: { strict?: boolean }
  ): string {
    if (options?.strict) {
      const validation = this.validateParams(key, params)
      if (!validation.valid) {
        console.warn(`Interpolation validation failed for ${key}:`, validation)
      }
    }

    return i18n.t(key as string, params)
  },
}

/**
 * Translation metadata utilities
 */
export const metadataExtractor = {
  /**
   * Get metadata for a translation key
   */
  getMetadata(key: TranslationKey): TranslationMetadata {
    const namespace = keyBuilder.getNamespace(key as string) || 'translation'
    const translation = i18n.t(key as string, { interpolation: { escapeValue: false } })
    const interpolationParams = interpolationHelpers.extractVariables(translation)

    return {
      key,
      namespace: namespace as TranslationNamespace,
      hasInterpolation: interpolationParams.length > 0,
      interpolationParams: interpolationParams.length > 0 ? interpolationParams : undefined,
      supportsPluralForms: this.checkPluralSupport(key),
      isContextual: this.checkContextualSupport(key),
    }
  },

  /**
   * Check if a key supports plural forms
   */
  checkPluralSupport(key: TranslationKey): boolean {
    const pluralSuffixes = ['_zero', '_one', '_two', '_few', '_many', '_other']
    return pluralSuffixes.some(suffix => i18n.exists(`${key}${suffix}`))
  },

  /**
   * Check if a key supports contextual variations
   */
  checkContextualSupport(key: TranslationKey): boolean {
    // Check common context patterns
    const contexts = ['male', 'female', 'neutral', 'formal', 'informal']
    return contexts.some(context => i18n.exists(`${key}_${context}`))
  },

  /**
   * Get all variations of a key (plural, contextual, etc.)
   */
  getVariations(key: TranslationKey): string[] {
    const variations: string[] = [key as string]
    
    // Check plural forms
    const pluralSuffixes = ['_zero', '_one', '_two', '_few', '_many', '_other']
    pluralSuffixes.forEach(suffix => {
      if (i18n.exists(`${key}${suffix}`)) {
        variations.push(`${key}${suffix}`)
      }
    })
    
    // Check common contexts
    const contexts = ['male', 'female', 'neutral', 'formal', 'informal']
    contexts.forEach(context => {
      if (i18n.exists(`${key}_${context}`)) {
        variations.push(`${key}_${context}`)
      }
    })
    
    return variations
  },
}

/**
 * Development utilities
 */
export const developmentHelpers = {
  /**
   * Log missing translations to console
   */
  logMissingTranslations(language?: LanguageCode) {
    const missing = missingTranslationDetector.getMissingForLanguage(
      language || i18n.language as LanguageCode
    )
    
    if (missing.length > 0) {
      console.group(`Missing translations for ${language || i18n.language}`)
      missing.forEach(key => console.warn(`- ${key}`))
      console.groupEnd()
    } else {
      console.log(`All translations present for ${language || i18n.language}`)
    }
  },

  /**
   * Export missing translations as JSON
   */
  exportMissingAsJson(language: LanguageCode): string {
    const missing = missingTranslationDetector.getMissingForLanguage(language)
    const missingObj: Record<string, string> = {}
    
    missing.forEach(key => {
      missingObj[key] = `TODO: Translate ${key}`
    })
    
    return JSON.stringify(missingObj, null, 2)
  },

  /**
   * Validate all translation files
   */
  validateTranslations(): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const languages = Object.keys(i18n.options.resources || {}) as LanguageCode[]
    
    languages.forEach(lang => {
      const missing = missingTranslationDetector.getMissingForLanguage(lang)
      if (missing.length > 0) {
        errors.push(`${lang}: ${missing.length} missing translations`)
      }
    })
    
    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Find unused translations
   */
  findUnusedKeys(usedKeys: Set<string>): string[] {
    const allKeys: string[] = []
    
    const extractKeys = (obj: any, prefix = '') => {
      Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          extractKeys(obj[key], fullKey)
        } else {
          allKeys.push(fullKey)
        }
      })
    }
    
    const resources = i18n.getResourceBundle(i18n.language, 'translation')
    if (resources) {
      extractKeys(resources)
    }
    
    return allKeys.filter(key => !usedKeys.has(key))
  },
}

/**
 * Format helpers for common use cases
 */
export const formatHelpers = {
  /**
   * Format a number with localization
   */
  number(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(i18n.language, options).format(value)
  },

  /**
   * Format a date with localization
   */
  date(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    const date = value instanceof Date ? value : new Date(value)
    return new Intl.DateTimeFormat(i18n.language, options).format(date)
  },

  /**
   * Format currency with localization
   */
  currency(value: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: currency,
    }).format(value)
  },

  /**
   * Format relative time
   */
  relativeTime(value: Date | string | number, options?: Intl.RelativeTimeFormatOptions): string {
    const date = value instanceof Date ? value : new Date(value)
    const now = new Date()
    const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000)
    
    const rtf = new Intl.RelativeTimeFormat(i18n.language, options)
    
    // Determine the appropriate unit
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 60 * 60 * 24 * 365],
      ['month', 60 * 60 * 24 * 30],
      ['week', 60 * 60 * 24 * 7],
      ['day', 60 * 60 * 24],
      ['hour', 60 * 60],
      ['minute', 60],
      ['second', 1],
    ]
    
    for (const [unit, secondsInUnit] of units) {
      if (Math.abs(diffInSeconds) >= secondsInUnit) {
        return rtf.format(Math.floor(diffInSeconds / secondsInUnit), unit)
      }
    }
    
    return rtf.format(diffInSeconds, 'second')
  },
}