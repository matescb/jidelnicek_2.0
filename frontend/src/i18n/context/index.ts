/**
 * Advanced context support for i18next
 * Supports gender, formality, and custom contexts
 */

import type { TOptions } from 'i18next'

/**
 * Context types supported by the system
 */
export type GenderContext = 'masculine' | 'feminine' | 'neuter'
export type FormalityContext = 'formal' | 'informal'
export type CustomContext = string

export interface ContextOptions {
  gender?: GenderContext
  formality?: FormalityContext
  context?: CustomContext
  [key: string]: any
}

/**
 * Helper to build context key suffix
 */
export const getContextKeySuffix = (options: ContextOptions): string => {
  const suffixes: string[] = []
  
  if (options.gender) {
    suffixes.push(`_${options.gender}`)
  }
  
  if (options.formality) {
    suffixes.push(`_${options.formality}`)
  }
  
  if (options.context) {
    suffixes.push(`_${options.context}`)
  }
  
  return suffixes.join('')
}

/**
 * Helper to check if translation needs context
 */
export const needsContext = (key: string, language: string): boolean => {
  // Languages that commonly need gender context
  const genderLanguages = ['cs', 'ar', 'fr', 'es', 'de', 'ru']
  
  // Languages that have formal/informal distinction
  const formalityLanguages = ['cs', 'de', 'fr', 'es', 'ja', 'ko']
  
  return genderLanguages.includes(language) || formalityLanguages.includes(language)
}

/**
 * Context-aware translation options builder
 */
export const buildContextOptions = (
  baseOptions: TOptions = {},
  context: ContextOptions = {}
): TOptions => {
  const contextSuffix = getContextKeySuffix(context)
  
  return {
    ...baseOptions,
    context: contextSuffix ? contextSuffix.substring(1) : undefined, // Remove leading underscore
    ...context
  }
}

/**
 * Gender context helpers for specific languages
 */
export const genderHelpers = {
  czech: {
    /**
     * Get proper ending for Czech adjectives based on gender
     */
    getAdjectiveEnding: (gender: GenderContext): string => {
      switch (gender) {
        case 'masculine':
          return 'ý'
        case 'feminine':
          return 'á'
        case 'neuter':
          return 'é'
        default:
          return 'ý'
      }
    },
    
    /**
     * Get proper verb ending for past tense based on gender
     */
    getPastTenseEnding: (gender: GenderContext, plural = false): string => {
      if (plural) return 'i'
      
      switch (gender) {
        case 'masculine':
          return ''
        case 'feminine':
          return 'a'
        case 'neuter':
          return 'o'
        default:
          return ''
      }
    }
  },
  
  arabic: {
    /**
     * Get proper pronoun based on gender and formality
     */
    getPronoun: (gender: GenderContext, formality: FormalityContext): string => {
      if (formality === 'formal') {
        return gender === 'feminine' ? 'حضرتكِ' : 'حضرتك'
      }
      return gender === 'feminine' ? 'أنتِ' : 'أنتَ'
    }
  }
}

/**
 * Formality context helpers
 */
export const formalityHelpers = {
  /**
   * Get appropriate greeting based on formality
   */
  getGreeting: (language: string, formality: FormalityContext): string => {
    const greetings: Record<string, Record<FormalityContext, string>> = {
      cs: {
        formal: 'Dobrý den',
        informal: 'Ahoj'
      },
      de: {
        formal: 'Guten Tag',
        informal: 'Hallo'
      },
      fr: {
        formal: 'Bonjour',
        informal: 'Salut'
      }
    }
    
    return greetings[language]?.[formality] || ''
  }
}

/**
 * Context resolver for complex scenarios
 */
export class ContextResolver {
  private language: string
  private defaultContext: ContextOptions
  
  constructor(language: string, defaultContext: ContextOptions = {}) {
    this.language = language
    this.defaultContext = defaultContext
  }
  
  /**
   * Resolve context based on user profile or preferences
   */
  resolveUserContext(user?: { gender?: string; prefersFormal?: boolean }): ContextOptions {
    const context: ContextOptions = { ...this.defaultContext }
    
    if (user?.gender) {
      context.gender = user.gender as GenderContext
    }
    
    if (user?.prefersFormal !== undefined) {
      context.formality = user.prefersFormal ? 'formal' : 'informal'
    }
    
    return context
  }
  
  /**
   * Get context-specific translation key
   */
  getContextKey(baseKey: string, context: ContextOptions): string {
    const suffix = getContextKeySuffix(context)
    return baseKey + suffix
  }
  
  /**
   * Check if context variant exists
   */
  hasContextVariant(translations: Record<string, any>, baseKey: string, context: ContextOptions): boolean {
    const contextKey = this.getContextKey(baseKey, context)
    return contextKey in translations
  }
}

/**
 * Context-aware interpolation helper
 */
export const contextInterpolation = (
  value: string,
  context: ContextOptions,
  language: string
): string => {
  // Apply gender-specific replacements
  if (context.gender && language === 'cs') {
    const ending = genderHelpers.czech.getAdjectiveEnding(context.gender)
    value = value.replace(/\{\{adj\}\}/g, ending)
  }
  
  // Apply formality-specific replacements
  if (context.formality) {
    const greeting = formalityHelpers.getGreeting(language, context.formality)
    value = value.replace(/\{\{greeting\}\}/g, greeting)
  }
  
  return value
}

/**
 * Context validation helper
 */
export const validateContext = (context: ContextOptions): boolean => {
  const validGenders: GenderContext[] = ['masculine', 'feminine', 'neuter']
  const validFormalities: FormalityContext[] = ['formal', 'informal']
  
  if (context.gender && !validGenders.includes(context.gender)) {
    console.warn(`Invalid gender context: ${context.gender}`)
    return false
  }
  
  if (context.formality && !validFormalities.includes(context.formality)) {
    console.warn(`Invalid formality context: ${context.formality}`)
    return false
  }
  
  return true
}

/**
 * Export all context utilities
 */
export default {
  getContextKeySuffix,
  needsContext,
  buildContextOptions,
  genderHelpers,
  formalityHelpers,
  ContextResolver,
  contextInterpolation,
  validateContext
}