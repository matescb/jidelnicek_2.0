import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import type { 
  Namespace, 
  TranslationKey, 
  TypedTFunction,
  TranslationContext 
} from '../types'
import { loadNamespaces } from '../index.enhanced'

// Type-safe translation hook
export function useTypedTranslation(
  namespace?: Namespace | Namespace[]
): {
  t: TypedTFunction
  i18n: ReturnType<typeof useTranslation>['i18n']
  ready: boolean
} {
  const ns = namespace || 'common'
  const { t, i18n, ready } = useTranslation(ns)
  
  // Load namespaces on mount
  useEffect(() => {
    if (namespace && !ready) {
      const namespaces = Array.isArray(namespace) ? namespace : [namespace]
      loadNamespaces(namespaces)
    }
  }, [namespace, ready])
  
  return {
    t: t as TypedTFunction,
    i18n,
    ready
  }
}

// Hook with context support
export function useContextualTranslation(
  namespace?: Namespace | Namespace[],
  defaultContext?: TranslationContext
): {
  t: (key: TranslationKey, options?: any) => string
  tWithContext: (key: TranslationKey, context: TranslationContext, options?: any) => string
  i18n: ReturnType<typeof useTranslation>['i18n']
  ready: boolean
} {
  const { t, i18n, ready } = useTypedTranslation(namespace)
  
  const tWithContext = (
    key: TranslationKey, 
    context: TranslationContext, 
    options?: any
  ): string => {
    return t(key, { ...options, context: { ...defaultContext, ...context } })
  }
  
  const enhancedT = (key: TranslationKey, options?: any): string => {
    return t(key, { ...options, context: defaultContext })
  }
  
  return {
    t: enhancedT,
    tWithContext,
    i18n,
    ready
  }
}

// Hook for pluralization
export function usePluralTranslation(
  namespace?: Namespace | Namespace[]
): {
  tPlural: (key: TranslationKey, count: number, options?: any) => string
  t: TypedTFunction
  i18n: ReturnType<typeof useTranslation>['i18n']
  ready: boolean
} {
  const { t, i18n, ready } = useTypedTranslation(namespace)
  
  const tPlural = (key: TranslationKey, count: number, options?: any): string => {
    return t(key, { count, ...options })
  }
  
  return {
    tPlural,
    t,
    i18n,
    ready
  }
}

// Hook for formatted translations
export function useFormattedTranslation(
  namespace?: Namespace | Namespace[]
): {
  tFormat: (key: TranslationKey, values: Record<string, any>, format?: Record<string, string>) => string
  t: TypedTFunction
  i18n: ReturnType<typeof useTranslation>['i18n']
  ready: boolean
} {
  const { t, i18n, ready } = useTypedTranslation(namespace)
  
  const tFormat = (
    key: TranslationKey, 
    values: Record<string, any>, 
    format?: Record<string, string>
  ): string => {
    // Apply format to values
    const formattedValues = { ...values }
    
    if (format) {
      Object.entries(format).forEach(([valueKey, formatString]) => {
        if (values[valueKey] !== undefined) {
          formattedValues[valueKey] = `{{${valueKey}, ${formatString}}}`
        }
      })
    }
    
    return t(key, formattedValues)
  }
  
  return {
    tFormat,
    t,
    i18n,
    ready
  }
}

// Combined hook with all features
export function useEnhancedTranslation(
  namespace?: Namespace | Namespace[],
  options?: {
    defaultContext?: TranslationContext
    suspense?: boolean
  }
): {
  t: TypedTFunction
  tContext: (key: TranslationKey, context: TranslationContext, options?: any) => string
  tPlural: (key: TranslationKey, count: number, options?: any) => string
  tFormat: (key: TranslationKey, values: Record<string, any>, format?: Record<string, string>) => string
  exists: (key: TranslationKey) => boolean
  language: string
  changeLanguage: (lng: string) => Promise<void>
  ready: boolean
} {
  const ns = namespace || 'common'
  const { t, i18n, ready } = useTranslation(ns, { useSuspense: options?.suspense })
  
  const typedT = t as TypedTFunction
  
  const tContext = (
    key: TranslationKey, 
    context: TranslationContext, 
    interpolation?: any
  ): string => {
    return typedT(key, { 
      ...interpolation, 
      context: { ...options?.defaultContext, ...context } 
    })
  }
  
  const tPlural = (key: TranslationKey, count: number, interpolation?: any): string => {
    return typedT(key, { count, ...interpolation })
  }
  
  const tFormat = (
    key: TranslationKey, 
    values: Record<string, any>, 
    format?: Record<string, string>
  ): string => {
    const formattedValues = { ...values }
    
    if (format) {
      Object.entries(format).forEach(([valueKey, formatString]) => {
        if (values[valueKey] !== undefined) {
          formattedValues[valueKey] = `{{${valueKey}, ${formatString}}}`
        }
      })
    }
    
    return typedT(key, formattedValues)
  }
  
  const exists = (key: TranslationKey): boolean => {
    return i18n.exists(key)
  }
  
  return {
    t: typedT,
    tContext,
    tPlural,
    tFormat,
    exists,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage,
    ready
  }
}