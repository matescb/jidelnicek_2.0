import { useTranslation as useI18nTranslation } from 'react-i18next'
import { useCallback, useMemo } from 'react'
import type {
  TranslationKey,
  TranslationNamespace,
  TranslationOptions,
  TranslationValue,
  TypedTFunction,
  TranslationExistsFunction,
  KeyBuilder,
  TranslationResource,
  MissingTranslation,
} from '../types'

// Store for missing translations in development
const missingTranslations = new Set<string>()

/**
 * Type-safe translation hook with key autocomplete
 * 
 * @example
 * const { t } = useTypedTranslation()
 * const text = t('auth.login') // Autocomplete works here!
 */
export function useTypedTranslation(namespace?: TranslationNamespace) {
  const { t: originalT, i18n, ready } = useI18nTranslation(namespace)

  const t: TypedTFunction = useCallback(
    (key, options) => {
      const result = originalT(key as string, options as any)
      
      // Track missing translations in development
      if (import.meta.env.DEV && !i18n.exists(key as string)) {
        const missingKey = `${i18n.language}:${key}`
        if (!missingTranslations.has(missingKey)) {
          missingTranslations.add(missingKey)
          console.warn(`Missing translation: ${missingKey}`)
        }
      }
      
      return result
    },
    [originalT, i18n]
  )

  return {
    t,
    i18n,
    ready,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage.bind(i18n),
  }
}

/**
 * Namespace-specific translation hook
 * 
 * @example
 * const { t } = useNamespaceTranslation('auth')
 * const text = t('login') // Will translate 'auth.login'
 */
export function useNamespaceTranslation<NS extends TranslationNamespace>(namespace: NS) {
  const { t: originalT, i18n, ready } = useI18nTranslation(namespace)

  const t = useCallback(
    <K extends keyof TranslationResource[NS]>(
      key: K,
      options?: TranslationOptions<TranslationResource[NS][K] extends string ? TranslationResource[NS][K] : string>
    ): string => {
      return originalT(key as string, options as any)
    },
    [originalT]
  )

  const tWithPrefix = useCallback(
    (key: TranslationKey, options?: TranslationOptions): string => {
      return originalT(key as string, options as any)
    },
    [originalT]
  )

  return {
    t,
    tWithPrefix,
    i18n,
    ready,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage.bind(i18n),
  }
}

/**
 * Hook for dynamic translation key generation
 * 
 * @example
 * const { buildKey, t } = useDynamicTranslation()
 * const key = buildKey('recipes', 'units', unit)
 * const text = t(key)
 */
export function useDynamicTranslation() {
  const { t: originalT, i18n, ready } = useI18nTranslation()

  const buildKey = useCallback(
    (...parts: string[]): string => {
      return parts.filter(Boolean).join('.')
    },
    []
  )

  const buildNamespacedKey = useCallback(
    (namespace: TranslationNamespace, ...parts: string[]): string => {
      return [namespace, ...parts.filter(Boolean)].join('.')
    },
    []
  )

  const t = useCallback(
    (key: string, options?: TranslationOptions): string => {
      // Validate the key exists in development
      if (import.meta.env.DEV && !i18n.exists(key)) {
        console.warn(`Dynamic translation key not found: ${key}`)
      }
      return originalT(key, options as any)
    },
    [originalT, i18n]
  )

  const tSafe = useCallback(
    (key: string, defaultValue: string, options?: TranslationOptions): string => {
      if (i18n.exists(key)) {
        return originalT(key, options as any)
      }
      return defaultValue
    },
    [originalT, i18n]
  )

  return {
    buildKey,
    buildNamespacedKey,
    t,
    tSafe,
    i18n,
    ready,
    language: i18n.language,
  }
}

/**
 * Hook to check if a translation key exists
 * 
 * @example
 * const { exists, existsInLanguage } = useTranslationExists()
 * if (exists('recipes.specialKey')) {
 *   // Show special content
 * }
 */
export function useTranslationExists() {
  const { i18n } = useI18nTranslation()

  const exists: TranslationExistsFunction = useCallback(
    (key, options) => {
      return i18n.exists(key as string, options)
    },
    [i18n]
  )

  const existsInLanguage = useCallback(
    (key: TranslationKey, language: string): boolean => {
      return i18n.exists(key as string, { lng: language })
    },
    [i18n]
  )

  const existsInCurrentLanguage = useCallback(
    (key: TranslationKey): boolean => {
      return i18n.exists(key as string)
    },
    [i18n]
  )

  const getAvailableLanguages = useCallback(
    (key: TranslationKey): string[] => {
      const languages = Object.keys(i18n.options.resources || {})
      return languages.filter(lng => i18n.exists(key as string, { lng }))
    },
    [i18n]
  )

  return {
    exists,
    existsInLanguage,
    existsInCurrentLanguage,
    getAvailableLanguages,
  }
}

/**
 * Hook for pluralization with type safety
 * 
 * @example
 * const { tPlural } = usePluralTranslation()
 * const text = tPlural('recipes.recipes', count)
 */
export function usePluralTranslation() {
  const { t: originalT, i18n } = useI18nTranslation()

  const tPlural = useCallback(
    (key: TranslationKey, count: number, options?: Omit<TranslationOptions, 'count'>): string => {
      return originalT(key as string, { ...options, count } as any)
    },
    [originalT]
  )

  const tPluralWithDefault = useCallback(
    (
      key: TranslationKey,
      count: number,
      defaultSingular: string,
      defaultPlural: string,
      options?: Omit<TranslationOptions, 'count'>
    ): string => {
      if (i18n.exists(key as string)) {
        return originalT(key as string, { ...options, count } as any)
      }
      return count === 1 ? defaultSingular : defaultPlural
    },
    [originalT, i18n]
  )

  return {
    tPlural,
    tPluralWithDefault,
  }
}

/**
 * Hook for contextual translations
 * 
 * @example
 * const { tContext } = useContextualTranslation()
 * const text = tContext('common.status', 'active') // Uses 'common.status_active' if exists
 */
export function useContextualTranslation() {
  const { t: originalT, i18n } = useI18nTranslation()

  const tContext = useCallback(
    (key: TranslationKey, context: string, options?: Omit<TranslationOptions, 'context'>): string => {
      return originalT(key as string, { ...options, context } as any)
    },
    [originalT]
  )

  const tContextWithDefault = useCallback(
    (
      key: TranslationKey,
      context: string,
      defaultValue: string,
      options?: Omit<TranslationOptions, 'context'>
    ): string => {
      const contextKey = `${key}_${context}`
      if (i18n.exists(contextKey)) {
        return originalT(key as string, { ...options, context } as any)
      }
      return defaultValue
    },
    [originalT, i18n]
  )

  return {
    tContext,
    tContextWithDefault,
  }
}

/**
 * Development hook for finding missing translations
 * 
 * @example
 * const { getMissingKeys, checkCoverage } = useMissingTranslations()
 * const report = checkCoverage()
 */
export function useMissingTranslations() {
  const { i18n } = useI18nTranslation()

  const getAllKeys = useCallback((): string[] => {
    const keys: string[] = []
    
    const extractKeys = (obj: any, prefix = ''): void => {
      Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          extractKeys(obj[key], fullKey)
        } else {
          keys.push(fullKey)
        }
      })
    }
    
    const resources = i18n.options.resources
    if (resources && resources[i18n.options.fallbackLng as string]) {
      extractKeys(resources[i18n.options.fallbackLng as string].translation)
    }
    
    return keys
  }, [i18n])

  const getMissingKeys = useCallback(
    (language: string): string[] => {
      const allKeys = getAllKeys()
      return allKeys.filter(key => !i18n.exists(key, { lng: language }))
    },
    [getAllKeys, i18n]
  )

  const checkCoverage = useCallback(() => {
    const languages = Object.keys(i18n.options.resources || {})
    const allKeys = getAllKeys()
    const totalKeys = allKeys.length

    const report = {
      totalKeys,
      missingKeys: {} as Record<string, string[]>,
      coveragePercentage: {} as Record<string, number>,
      timestamp: new Date(),
    }

    languages.forEach(lng => {
      const missing = getMissingKeys(lng)
      report.missingKeys[lng] = missing
      report.coveragePercentage[lng] = ((totalKeys - missing.length) / totalKeys) * 100
    })

    return report
  }, [getAllKeys, getMissingKeys, i18n])

  const getMissingFromStore = useCallback((): MissingTranslation[] => {
    return Array.from(missingTranslations).map(key => {
      const [language, ...keyParts] = key.split(':')
      return {
        key: keyParts.join(':'),
        language,
        timestamp: new Date(),
      }
    })
  }, [])

  return {
    getAllKeys,
    getMissingKeys,
    checkCoverage,
    getMissingFromStore,
  }
}

/**
 * Hook for creating translation key builders (useful for large nested structures)
 * 
 * @example
 * const keys = useTranslationKeys('recipes')
 * const key = keys.units.g() // Returns 'recipes.units.g'
 */
export function useTranslationKeys<NS extends TranslationNamespace>(namespace: NS) {
  const createKeyBuilder = useCallback(
    (prefix: string = namespace): any => {
      return new Proxy({}, {
        get(target, prop: string) {
          const key = prefix ? `${prefix}.${prop}` : prop
          
          return new Proxy(() => key, {
            get(fnTarget, fnProp: string) {
              return createKeyBuilder(`${key}.${fnProp}`)
            },
          })
        },
      })
    },
    [namespace]
  )

  return useMemo(() => createKeyBuilder(), [createKeyBuilder])
}