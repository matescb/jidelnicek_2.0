import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslations from './locales/en'
import csTranslations from './locales/cs'

export const languages = {
  en: { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English',
    flag: '🇬🇧',
    dir: 'ltr'
  },
  cs: { 
    code: 'cs', 
    name: 'Czech', 
    nativeName: 'Čeština',
    flag: '🇨🇿',
    dir: 'ltr'
  },
} as const

export type LanguageCode = keyof typeof languages

const resources = {
  en: { translation: enTranslations },
  cs: { translation: csTranslations },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'jidelnicek-language',
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
      format: (value: any, format?: string, lng?: string) => {
        // Date formatting
        if (format === 'date' && value instanceof Date) {
          return new Intl.DateTimeFormat(lng).format(value)
        }
        if (format === 'datetime' && value instanceof Date) {
          return new Intl.DateTimeFormat(lng, {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(value)
        }
        // Number formatting
        if (format === 'number' && typeof value === 'number') {
          return new Intl.NumberFormat(lng).format(value)
        }
        if (format === 'currency' && typeof value === 'number') {
          return new Intl.NumberFormat(lng, {
            style: 'currency',
            currency: lng === 'cs' ? 'CZK' : 'EUR'
          }).format(value)
        }
        return value
      }
    },
    
    // React specific options
    react: {
      useSuspense: false, // Disable suspense for SSR
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'u'],
    },
    
    // Namespace options
    defaultNS: 'translation',
    ns: ['translation'],
    
    // Performance options
    load: 'languageOnly',
    cleanCode: true,
    
    // Missing key handling
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV 
      ? (lng, ns, key) => console.warn(`Missing translation: ${lng}/${ns}/${key}`)
      : undefined,
  })

// Helper to change language and update HTML dir attribute
export const changeLanguage = (lng: LanguageCode) => {
  i18n.changeLanguage(lng)
  document.documentElement.lang = lng
  document.documentElement.dir = languages[lng].dir
}

// Helper to get current language info
export const getCurrentLanguage = (): typeof languages[LanguageCode] => {
  const current = i18n.language as LanguageCode
  return languages[current] || languages.en
}

export default i18n