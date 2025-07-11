import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import type { 
  LanguageInfo, 
  LanguageCode,
  Namespace,
  TranslationContext,
  TranslationOptions
} from './types'
import { format } from './utils/formatting'
import { getPluralizationRule } from './utils/pluralization'
import { trackMissingTranslation } from './utils/missing-tracker'
import { createNamespaceBackend } from './utils/lazy-loading'
import { getTranslationBackend, MockTranslationBackend } from './utils/backend'

// Import initial translations (common namespace)
import enCommon from './locales/en'
import csCommon from './locales/cs'

// Enhanced language configuration
export const languages: Record<string, LanguageInfo> = {
  en: { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English',
    flag: '🇬🇧',
    dir: 'ltr',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    numberFormat: 'en-US'
  },
  cs: { 
    code: 'cs', 
    name: 'Czech', 
    nativeName: 'Čeština',
    flag: '🇨🇿',
    dir: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    currency: 'CZK',
    numberFormat: 'cs-CZ'
  },
} as const

export type { LanguageCode } from './types'

// Initial resources (only common namespace)
const resources = {
  en: { 
    common: enCommon,
    // Other namespaces will be lazy-loaded
  },
  cs: { 
    common: csCommon,
    // Other namespaces will be lazy-loaded
  },
}

// Configure backends
const isDevelopment = import.meta.env.DEV
const useBackend = import.meta.env.VITE_I18N_USE_BACKEND === 'true'

// Create backend instance
const translationBackend = isDevelopment && !useBackend
  ? new MockTranslationBackend()
  : getTranslationBackend({
      apiUrl: import.meta.env.VITE_I18N_API_URL || '/api/translations',
      apiKey: import.meta.env.VITE_I18N_API_KEY
    })

// Create namespace backend for lazy loading
const namespaceBackend = createNamespaceBackend()

// Enhanced i18n configuration
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(namespaceBackend) // Add namespace backend
  .use(translationBackend.createI18nextBackend()) // Add translation backend
  .init({
    resources,
    fallbackLng: 'en',
    debug: isDevelopment,
    
    // Namespace configuration
    defaultNS: 'common',
    ns: ['common'], // Start with common, others loaded on demand
    fallbackNS: 'common',
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'jidelnicek-language',
    },
    
    // Backend options
    backend: {
      autoSync: true,
      loadPath: '{{lng}}/{{ns}}',
      addPath: '{{lng}}/{{ns}}/{{key}}',
    },
    
    // Interpolation options with enhanced formatting
    interpolation: {
      escapeValue: false, // React already escapes values
      format, // Use our enhanced format function
      formatSeparator: ':',
      nestingPrefix: '$t(',
      nestingSuffix: ')',
    },
    
    // Context support
    contextSeparator: '_',
    
    // Pluralization
    pluralSeparator: '_',
    simplifyPluralSuffix: false,
    
    // React specific options
    react: {
      useSuspense: false, // Disable suspense for SSR
      bindI18n: 'languageChanged loaded added removed',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'u', 'mark', 'em', 'sub', 'sup'],
    },
    
    // Performance options
    load: 'languageOnly',
    cleanCode: true,
    preload: ['en', 'cs'],
    partialBundledLanguages: true,
    
    // Missing key handling with tracking
    saveMissing: true,
    missingKeyHandler: (lng, ns, key, fallbackValue) => {
      if (isDevelopment) {
        console.warn(`Missing translation: ${lng}/${ns}/${key}`)
        trackMissingTranslation(key, ns, lng[0], fallbackValue)
      }
    },
    
    // Post processing
    postProcess: ['contextProcessor', 'pluralProcessor'],
    returnNull: false,
    returnEmptyString: false,
    
    // Key separator
    keySeparator: '.',
    nsSeparator: ':',
  })

// Add custom post processors
i18n.use({
  type: 'postProcessor',
  name: 'contextProcessor',
  process(value: string, key: string, options: any) {
    // Handle gender context
    if (options.context?.gender) {
      const genderKey = `${key}_${options.context.gender}`
      const genderValue = i18n.t(genderKey, { ...options, context: undefined })
      if (genderValue !== genderKey) {
        return genderValue
      }
    }
    
    // Handle formal/informal context
    if (options.context?.formal !== undefined) {
      const formalKey = `${key}_${options.context.formal ? 'formal' : 'informal'}`
      const formalValue = i18n.t(formalKey, { ...options, context: undefined })
      if (formalValue !== formalKey) {
        return formalValue
      }
    }
    
    return value
  }
})

i18n.use({
  type: 'postProcessor',
  name: 'pluralProcessor',
  process(value: string, key: string, options: any) {
    if (typeof options.count === 'number') {
      const language = options.lng || i18n.language
      const pluralRule = getPluralizationRule(language)
      const pluralIndex = pluralRule(options.count)
      
      // Try different plural forms
      const pluralSuffixes = ['_zero', '_one', '_two', '_few', '_many', '_other']
      const pluralKey = `${key}${pluralSuffixes[pluralIndex] || '_other'}`
      const pluralValue = i18n.t(pluralKey, { ...options, count: undefined })
      
      if (pluralValue !== pluralKey) {
        return pluralValue
      }
    }
    
    return value
  }
})

// Enhanced helper functions

// Type-safe translation function
export function t(
  key: string, 
  options?: TranslationOptions & Record<string, any>
): string {
  return i18n.t(key, options as any)
}

// Helper to change language with enhanced features
export const changeLanguage = async (lng: LanguageCode) => {
  await i18n.changeLanguage(lng)
  
  // Update HTML attributes
  document.documentElement.lang = lng
  document.documentElement.dir = languages[lng].dir
  
  // Update meta tags
  const metaLang = document.querySelector('meta[http-equiv="content-language"]')
  if (metaLang) {
    metaLang.setAttribute('content', lng)
  }
  
  // Trigger custom event
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lng } }))
}

// Helper to get current language info
export const getCurrentLanguage = (): LanguageInfo => {
  const current = i18n.language as LanguageCode
  return languages[current] || languages.en
}

// Helper to load namespaces on demand
export const loadNamespaces = async (namespaces: Namespace | Namespace[]) => {
  const ns = Array.isArray(namespaces) ? namespaces : [namespaces]
  await i18n.loadNamespaces(ns)
}

// Helper to check if namespace is loaded
export const isNamespaceLoaded = (namespace: Namespace): boolean => {
  return i18n.hasLoadedNamespace(namespace)
}

// Helper to get available languages
export const getAvailableLanguages = (): LanguageInfo[] => {
  return Object.values(languages)
}

// Helper to format with context
export const tWithContext = (
  key: string,
  context: TranslationContext,
  interpolation?: Record<string, any>
): string => {
  return i18n.t(key, { context, ...interpolation })
}

// Helper for pluralization
export const tPlural = (
  key: string,
  count: number,
  interpolation?: Record<string, any>
): string => {
  return i18n.t(key, { count, ...interpolation })
}

// Helper to get translation exists
export const hasTranslation = (
  key: string,
  options?: { ns?: Namespace; lng?: LanguageCode }
): boolean => {
  return i18n.exists(key, options)
}

// Export types and utilities
export * from './types'
export { 
  getMissingTranslations,
  exportMissingTranslations,
  generateMissingTranslationReport 
} from './utils/missing-tracker'
export { 
  validateTranslations,
  generateValidationReport 
} from './utils/validation'
export { format } from './utils/formatting'

export default i18n