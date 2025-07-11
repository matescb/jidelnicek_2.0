import type { PluralizationRule } from '../types'

// Pluralization rules for different languages
export const pluralizationRules: PluralizationRule[] = [
  {
    // English: 1 item vs. many items
    languages: ['en'],
    rule: (count: number) => (count === 1 ? 0 : 1)
  },
  {
    // Czech: complex pluralization rules
    // 1 item, 2-4 items, 5+ items
    languages: ['cs'],
    rule: (count: number) => {
      if (count === 1) return 0
      if (count >= 2 && count <= 4) return 1
      return 2
    }
  },
  {
    // French: 0-1 vs. many
    languages: ['fr'],
    rule: (count: number) => (count === 0 || count === 1 ? 0 : 1)
  },
  {
    // Polish: complex rules
    languages: ['pl'],
    rule: (count: number) => {
      if (count === 1) return 0
      const lastDigit = count % 10
      const lastTwoDigits = count % 100
      if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
        return 1
      }
      return 2
    }
  },
  {
    // Russian: complex rules
    languages: ['ru'],
    rule: (count: number) => {
      const lastDigit = count % 10
      const lastTwoDigits = count % 100
      if (lastDigit === 1 && lastTwoDigits !== 11) return 0
      if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
        return 1
      }
      return 2
    }
  }
]

// Get pluralization rule for a language
export const getPluralizationRule = (language: string): ((count: number) => number) => {
  const rule = pluralizationRules.find(r => r.languages.includes(language))
  return rule?.rule || ((count: number) => (count === 1 ? 0 : 1)) // Default to English rule
}

// Generate plural forms for a key
export const generatePluralForms = (key: string, count: number, language: string): string => {
  const rule = getPluralizationRule(language)
  const pluralIndex = rule(count)
  
  // Map index to suffix
  const suffixes = ['_one', '_few', '_many']
  const suffix = suffixes[pluralIndex] || ''
  
  return `${key}${suffix}`
}

// Helper to check if a key has plural forms
export const hasPluralForms = (translations: Record<string, any>, key: string): boolean => {
  return !!(
    translations[`${key}_one`] ||
    translations[`${key}_few`] ||
    translations[`${key}_many`] ||
    translations[`${key}_zero`] ||
    translations[`${key}_other`]
  )
}