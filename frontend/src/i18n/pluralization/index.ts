/**
 * Advanced pluralization rules for i18next
 * Supports complex pluralization for Czech, Arabic, and English
 * Also includes ordinal number support
 */

import type { Module, Formatter } from 'i18next'

/**
 * Czech pluralization rules
 * - 1 = one
 * - 2-4 = few  
 * - 5+ = many
 * - Special rules for numbers ending in 2,3,4 except 12,13,14
 */
export const czechPluralRules = (count: number): string => {
  if (count === 1) return 'one'
  
  // Check for special cases 12, 13, 14
  if (count >= 12 && count <= 14) return 'many'
  
  // Get last digit for numbers ending in 2, 3, 4
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  // Numbers ending in 2, 3, 4 (except 12, 13, 14) use 'few'
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return 'few'
  }
  
  return 'many'
}

/**
 * Arabic pluralization rules (6 forms)
 * - 0 = zero
 * - 1 = one
 * - 2 = two
 * - n % 100 = 3..10 = few
 * - n % 100 = 11..99 = many
 * - other = other
 */
export const arabicPluralRules = (count: number): string => {
  if (count === 0) return 'zero'
  if (count === 1) return 'one'
  if (count === 2) return 'two'
  
  const mod100 = count % 100
  if (mod100 >= 3 && mod100 <= 10) return 'few'
  if (mod100 >= 11 && mod100 <= 99) return 'many'
  
  return 'other'
}

/**
 * English pluralization rules (simple)
 * - 1 = one
 * - other = other
 */
export const englishPluralRules = (count: number): string => {
  return count === 1 ? 'one' : 'other'
}

/**
 * Get ordinal suffix for a number in different languages
 */
export const getOrdinalSuffix = (num: number, language: string): string => {
  switch (language) {
    case 'en':
      return getEnglishOrdinal(num)
    case 'cs':
      return getCzechOrdinal(num)
    case 'ar':
      return getArabicOrdinal(num)
    default:
      return String(num)
  }
}

/**
 * English ordinal rules
 */
const getEnglishOrdinal = (num: number): string => {
  const j = num % 10
  const k = num % 100
  
  if (j === 1 && k !== 11) {
    return num + 'st'
  }
  if (j === 2 && k !== 12) {
    return num + 'nd'
  }
  if (j === 3 && k !== 13) {
    return num + 'rd'
  }
  return num + 'th'
}

/**
 * Czech ordinal rules
 */
const getCzechOrdinal = (num: number): string => {
  return num + '.'
}

/**
 * Arabic ordinal rules
 */
const getArabicOrdinal = (num: number): string => {
  // Arabic uses different system, typically "الأول", "الثاني", etc.
  // For simplicity, we'll use numeric representation
  return 'ال' + num
}

/**
 * Custom pluralization resolver for i18next
 */
export const pluralizationResolver = (language: string) => {
  return (count: number): string => {
    switch (language) {
      case 'cs':
        return czechPluralRules(count)
      case 'ar':
        return arabicPluralRules(count)
      case 'en':
      default:
        return englishPluralRules(count)
    }
  }
}

/**
 * i18next pluralization module
 */
export const pluralizationModule: Module = {
  type: 'i18nFormat',
  init: function() {
    // Module initialization
  }
}

/**
 * Custom formatter for ordinals
 */
export const ordinalFormatter: Formatter = (value: any, format?: string, lng?: string) => {
  if (format === 'ordinal' && typeof value === 'number' && lng) {
    return getOrdinalSuffix(value, lng)
  }
  return value
}

/**
 * Helper to get plural key suffix based on count
 * This is useful for manual plural key generation
 */
export const getPluralKeySuffix = (count: number, language: string): string => {
  const form = pluralizationResolver(language)(count)
  
  // Map to i18next expected suffixes
  switch (form) {
    case 'zero':
      return '_zero'
    case 'one':
      return '_one'
    case 'two':
      return '_two'
    case 'few':
      return '_few'
    case 'many':
      return '_many'
    case 'other':
      return '_other'
    default:
      return '_other'
  }
}

/**
 * Pluralization rules configuration for i18next
 */
export const pluralizationRules = {
  cs: {
    plurals: czechPluralRules,
    numbers: [1, 2, 5] // Example numbers for each form
  },
  ar: {
    plurals: arabicPluralRules,
    numbers: [0, 1, 2, 3, 11, 100] // Example numbers for each form
  },
  en: {
    plurals: englishPluralRules,
    numbers: [1, 2] // Example numbers for each form
  }
}

/**
 * Export all pluralization utilities
 */
export default {
  czechPluralRules,
  arabicPluralRules,
  englishPluralRules,
  getOrdinalSuffix,
  pluralizationResolver,
  pluralizationModule,
  ordinalFormatter,
  getPluralKeySuffix,
  pluralizationRules
}