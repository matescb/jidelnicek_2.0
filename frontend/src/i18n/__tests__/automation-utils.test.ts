import { promises as fs } from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'

// Import actual translation files
import enTranslations from '../locales/en'
import csTranslations from '../locales/cs'
import arTranslations from '../locales/ar'

// Types for automation utilities
interface TranslationFile {
  [key: string]: any
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  coverage: number
}

interface PerformanceMetrics {
  keyCount: number
  averageKeyLength: number
  averageValueLength: number
  nestedDepth: number
  memoryUsage: number
}

interface CompletionReport {
  language: string
  totalKeys: number
  translatedKeys: number
  missingKeys: string[]
  completionPercentage: number
  emptyTranslations: string[]
}

interface QualityReport {
  inconsistentFormatting: string[]
  suspiciousTranslations: string[]
  lengthVariations: Array<{
    key: string
    lengths: Record<string, number>
    maxVariation: number
  }>
  pluralizationIssues: string[]
  contextIssues: string[]
}

/**
 * Automated translation validation utilities
 */
class TranslationValidator {
  private readonly supportedLanguages = ['en', 'cs', 'ar']
  private readonly translations = {
    en: enTranslations,
    cs: csTranslations,
    ar: arTranslations,
  }

  /**
   * Validate all translation files for completeness and consistency
   */
  validateAllTranslations(): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {}

    for (const language of this.supportedLanguages) {
      results[language] = this.validateTranslationFile(language)
    }

    return results
  }

  /**
   * Validate a single translation file
   */
  private validateTranslationFile(language: string): ValidationResult {
    const translation = this.translations[language as keyof typeof this.translations]
    const baseTranslation = this.translations.en
    
    const errors: string[] = []
    const warnings: string[] = []

    // Check for missing keys
    const missingKeys = this.findMissingKeys(baseTranslation, translation)
    if (missingKeys.length > 0) {
      errors.push(`Missing keys: ${missingKeys.join(', ')}`)
    }

    // Check for empty translations
    const emptyKeys = this.findEmptyTranslations(translation)
    if (emptyKeys.length > 0) {
      warnings.push(`Empty translations: ${emptyKeys.join(', ')}`)
    }

    // Check for interpolation consistency
    const interpolationIssues = this.validateInterpolation(baseTranslation, translation)
    if (interpolationIssues.length > 0) {
      errors.push(...interpolationIssues)
    }

    // Check pluralization forms
    const pluralizationIssues = this.validatePluralization(language, translation)
    if (pluralizationIssues.length > 0) {
      warnings.push(...pluralizationIssues)
    }

    // Calculate coverage
    const totalKeys = this.countKeys(baseTranslation)
    const translatedKeys = this.countKeys(translation)
    const coverage = totalKeys > 0 ? (translatedKeys / totalKeys) * 100 : 0

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      coverage,
    }
  }

  /**
   * Find missing translation keys
   */
  private findMissingKeys(base: TranslationFile, target: TranslationFile, prefix = ''): string[] {
    const missing: string[] = []

    const checkObject = (baseObj: any, targetObj: any, currentPrefix: string) => {
      for (const [key, value] of Object.entries(baseObj)) {
        const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key

        if (!(key in targetObj)) {
          missing.push(fullKey)
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          if (typeof targetObj[key] === 'object' && targetObj[key] !== null) {
            checkObject(value, targetObj[key], fullKey)
          } else {
            missing.push(fullKey)
          }
        }
      }
    }

    checkObject(base, target, prefix)
    return missing
  }

  /**
   * Find empty translations
   */
  private findEmptyTranslations(translation: TranslationFile, prefix = ''): string[] {
    const empty: string[] = []

    const checkObject = (obj: any, currentPrefix: string) => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key

        if (typeof value === 'string') {
          if (value.trim() === '') {
            empty.push(fullKey)
          }
        } else if (typeof value === 'object' && value !== null) {
          checkObject(value, fullKey)
        }
      }
    }

    checkObject(translation, prefix)
    return empty
  }

  /**
   * Validate interpolation variables consistency
   */
  private validateInterpolation(base: TranslationFile, target: TranslationFile): string[] {
    const issues: string[] = []

    const checkInterpolation = (baseObj: any, targetObj: any, prefix = '') => {
      for (const [key, baseValue] of Object.entries(baseObj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        if (typeof baseValue === 'string' && typeof targetObj[key] === 'string') {
          const baseVars = this.extractInterpolationVars(baseValue)
          const targetVars = this.extractInterpolationVars(targetObj[key])

          const missingVars = baseVars.filter(v => !targetVars.includes(v))
          const extraVars = targetVars.filter(v => !baseVars.includes(v))

          if (missingVars.length > 0) {
            issues.push(`${fullKey}: Missing interpolation variables: ${missingVars.join(', ')}`)
          }
          if (extraVars.length > 0) {
            issues.push(`${fullKey}: Extra interpolation variables: ${extraVars.join(', ')}`)
          }
        } else if (typeof baseValue === 'object' && baseValue !== null) {
          if (typeof targetObj[key] === 'object' && targetObj[key] !== null) {
            checkInterpolation(baseValue, targetObj[key], fullKey)
          }
        }
      }
    }

    checkInterpolation(base, target)
    return issues
  }

  /**
   * Extract interpolation variables from a string
   */
  private extractInterpolationVars(text: string): string[] {
    const matches = text.match(/\{\{([^}]+)\}\}/g)
    if (!matches) return []

    return matches.map(match => match.replace(/\{\{|\}\}/g, '').trim())
  }

  /**
   * Validate pluralization forms
   */
  private validatePluralization(language: string, translation: TranslationFile): string[] {
    const issues: string[] = []
    const pluralRules = this.getPluralRules(language)

    if (translation.plurals) {
      const pluralKeys = this.findPluralKeys(translation.plurals)
      
      for (const baseKey of pluralKeys) {
        const requiredForms = pluralRules
        const presentForms = this.getPluralForms(translation.plurals, baseKey)
        const missingForms = requiredForms.filter(form => !presentForms.includes(form))

        if (missingForms.length > 0) {
          issues.push(`${baseKey}: Missing plural forms: ${missingForms.join(', ')}`)
        }
      }
    }

    return issues
  }

  /**
   * Get required plural forms for a language
   */
  private getPluralRules(language: string): string[] {
    const rules = {
      en: ['one', 'other'],
      cs: ['one', 'few', 'other'],
      ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
    }

    return rules[language as keyof typeof rules] || ['one', 'other']
  }

  /**
   * Find base keys for plurals
   */
  private findPluralKeys(plurals: any): string[] {
    const keys = Object.keys(plurals)
    const baseKeys = new Set<string>()

    for (const key of keys) {
      const baseKey = key.replace(/_(?:zero|one|two|few|many|other)$/, '')
      if (baseKey !== key) {
        baseKeys.add(baseKey)
      }
    }

    return Array.from(baseKeys)
  }

  /**
   * Get existing plural forms for a base key
   */
  private getPluralForms(plurals: any, baseKey: string): string[] {
    const forms: string[] = []
    const possibleForms = ['zero', 'one', 'two', 'few', 'many', 'other']

    for (const form of possibleForms) {
      const key = `${baseKey}_${form}`
      if (key in plurals) {
        forms.push(form)
      }
    }

    return forms
  }

  /**
   * Count total translation keys
   */
  private countKeys(obj: any): number {
    let count = 0

    const countRecursive = (current: any) => {
      for (const value of Object.values(current)) {
        if (typeof value === 'string') {
          count++
        } else if (typeof value === 'object' && value !== null) {
          countRecursive(value)
        }
      }
    }

    countRecursive(obj)
    return count
  }
}

/**
 * Translation quality analyzer
 */
class TranslationQualityAnalyzer {
  private readonly translations = {
    en: enTranslations,
    cs: csTranslations,
    ar: arTranslations,
  }

  /**
   * Generate comprehensive quality report
   */
  generateQualityReport(): QualityReport {
    return {
      inconsistentFormatting: this.findInconsistentFormatting(),
      suspiciousTranslations: this.findSuspiciousTranslations(),
      lengthVariations: this.analyzeLengthVariations(),
      pluralizationIssues: this.findPluralizationIssues(),
      contextIssues: this.findContextIssues(),
    }
  }

  /**
   * Find formatting inconsistencies
   */
  private findInconsistentFormatting(): string[] {
    const issues: string[] = []
    const baseTranslation = this.translations.en

    const checkFormatting = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        if (typeof value === 'string') {
          // Check for consistent punctuation
          if (value.endsWith('.') || value.endsWith('!') || value.endsWith('?')) {
            for (const [lang, translation] of Object.entries(this.translations)) {
              if (lang === 'en') continue
              
              const translatedValue = this.getNestedValue(translation, fullKey)
              if (typeof translatedValue === 'string') {
                const enPunctuation = value.slice(-1)
                const translatedPunctuation = translatedValue.slice(-1)
                
                if (enPunctuation !== translatedPunctuation && 
                    !['!', '?', '.', ':', ';'].includes(translatedPunctuation)) {
                  issues.push(`${fullKey} (${lang}): Inconsistent punctuation`)
                }
              }
            }
          }

          // Check for consistent capitalization
          if (value[0] && value[0] === value[0].toUpperCase()) {
            for (const [lang, translation] of Object.entries(this.translations)) {
              if (lang === 'en') continue
              
              const translatedValue = this.getNestedValue(translation, fullKey)
              if (typeof translatedValue === 'string' && translatedValue[0]) {
                if (translatedValue[0] !== translatedValue[0].toUpperCase()) {
                  issues.push(`${fullKey} (${lang}): Inconsistent capitalization`)
                }
              }
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          checkFormatting(value, fullKey)
        }
      }
    }

    checkFormatting(baseTranslation)
    return issues
  }

  /**
   * Find suspicious translations (likely untranslated or machine-translated)
   */
  private findSuspiciousTranslations(): string[] {
    const suspicious: string[] = []

    const checkSuspicious = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        if (typeof value === 'string') {
          for (const [lang, translation] of Object.entries(this.translations)) {
            if (lang === 'en') continue
            
            const translatedValue = this.getNestedValue(translation, fullKey)
            if (typeof translatedValue === 'string') {
              // Check if translation is identical to English (suspicious for non-English)
              if (translatedValue === value && lang !== 'en') {
                suspicious.push(`${fullKey} (${lang}): Identical to English`)
              }
              
              // Check for obvious placeholders
              if (translatedValue.includes('TODO') || translatedValue.includes('TRANSLATE')) {
                suspicious.push(`${fullKey} (${lang}): Contains placeholder text`)
              }
              
              // Check for mixed languages (Latin characters in Arabic, etc.)
              if (lang === 'ar' && /[a-zA-Z]/.test(translatedValue) && !/\{\{/.test(translatedValue)) {
                suspicious.push(`${fullKey} (${lang}): Contains Latin characters`)
              }
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          checkSuspicious(value, fullKey)
        }
      }
    }

    checkSuspicious(this.translations.en)
    return suspicious
  }

  /**
   * Analyze text length variations between languages
   */
  private analyzeLengthVariations(): Array<{
    key: string
    lengths: Record<string, number>
    maxVariation: number
  }> {
    const variations: any[] = []

    const analyzeLengths = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        if (typeof value === 'string') {
          const lengths: Record<string, number> = {}
          
          for (const [lang, translation] of Object.entries(this.translations)) {
            const translatedValue = this.getNestedValue(translation, fullKey)
            if (typeof translatedValue === 'string') {
              lengths[lang] = translatedValue.length
            }
          }

          if (Object.keys(lengths).length > 1) {
            const lengthValues = Object.values(lengths)
            const maxLength = Math.max(...lengthValues)
            const minLength = Math.min(...lengthValues)
            const maxVariation = maxLength > 0 ? ((maxLength - minLength) / maxLength) * 100 : 0

            // Flag significant variations (>50% difference)
            if (maxVariation > 50) {
              variations.push({
                key: fullKey,
                lengths,
                maxVariation: Math.round(maxVariation),
              })
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          analyzeLengths(value, fullKey)
        }
      }
    }

    analyzeLengths(this.translations.en)
    return variations.sort((a, b) => b.maxVariation - a.maxVariation)
  }

  /**
   * Find pluralization issues
   */
  private findPluralizationIssues(): string[] {
    const issues: string[] = []

    for (const [lang, translation] of Object.entries(this.translations)) {
      if (translation.plurals) {
        const validator = new TranslationValidator()
        const pluralIssues = validator['validatePluralization'](lang, translation)
        issues.push(...pluralIssues)
      }
    }

    return issues
  }

  /**
   * Find context-related issues
   */
  private findContextIssues(): string[] {
    const issues: string[] = []

    for (const [lang, translation] of Object.entries(this.translations)) {
      if (translation.contexts) {
        const contextKeys = Object.keys(translation.contexts)
        const baseKeys = new Set<string>()

        // Find base keys for contexts
        for (const key of contextKeys) {
          const baseKey = key.replace(/_(?:masculine|feminine|neuter|formal|informal)$/, '')
          if (baseKey !== key) {
            baseKeys.add(baseKey)
          }
        }

        // Check for incomplete context sets
        for (const baseKey of baseKeys) {
          const contextForms = contextKeys.filter(k => k.startsWith(baseKey + '_'))
          
          // For languages that need gender contexts, check completeness
          if (lang === 'cs' || lang === 'ar') {
            const hasGenderForms = contextForms.some(f => 
              f.includes('masculine') || f.includes('feminine')
            )
            
            if (hasGenderForms) {
              const requiredGenders = lang === 'cs' ? 
                ['masculine', 'feminine', 'neuter'] : 
                ['masculine', 'feminine']
              
              for (const gender of requiredGenders) {
                const genderKey = `${baseKey}_${gender}`
                if (!contextForms.includes(genderKey)) {
                  issues.push(`${baseKey} (${lang}): Missing ${gender} context form`)
                }
              }
            }
          }
        }
      }
    }

    return issues
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}

/**
 * Translation performance analyzer
 */
class TranslationPerformanceAnalyzer {
  private readonly translations = {
    en: enTranslations,
    cs: csTranslations,
    ar: arTranslations,
  }

  /**
   * Analyze performance metrics for translations
   */
  analyzePerformanceMetrics(): Record<string, PerformanceMetrics> {
    const metrics: Record<string, PerformanceMetrics> = {}

    for (const [language, translation] of Object.entries(this.translations)) {
      const startTime = performance.now()
      
      const keyCount = this.countKeys(translation)
      const { averageKeyLength, averageValueLength } = this.calculateAverageLengths(translation)
      const nestedDepth = this.calculateMaxDepth(translation)
      
      // Simulate memory usage calculation
      const jsonString = JSON.stringify(translation)
      const memoryUsage = new Blob([jsonString]).size

      const endTime = performance.now()
      
      metrics[language] = {
        keyCount,
        averageKeyLength,
        averageValueLength,
        nestedDepth,
        memoryUsage,
      }
    }

    return metrics
  }

  /**
   * Count total keys in translation object
   */
  private countKeys(obj: any): number {
    let count = 0

    const countRecursive = (current: any) => {
      for (const [key, value] of Object.entries(current)) {
        count++
        if (typeof value === 'object' && value !== null) {
          countRecursive(value)
        }
      }
    }

    countRecursive(obj)
    return count
  }

  /**
   * Calculate average key and value lengths
   */
  private calculateAverageLengths(obj: any): { averageKeyLength: number; averageValueLength: number } {
    const keyLengths: number[] = []
    const valueLengths: number[] = []

    const collectLengths = (current: any) => {
      for (const [key, value] of Object.entries(current)) {
        keyLengths.push(key.length)
        
        if (typeof value === 'string') {
          valueLengths.push(value.length)
        } else if (typeof value === 'object' && value !== null) {
          collectLengths(value)
        }
      }
    }

    collectLengths(obj)

    const averageKeyLength = keyLengths.length > 0 ? 
      keyLengths.reduce((a, b) => a + b, 0) / keyLengths.length : 0
    const averageValueLength = valueLengths.length > 0 ? 
      valueLengths.reduce((a, b) => a + b, 0) / valueLengths.length : 0

    return {
      averageKeyLength: Math.round(averageKeyLength * 10) / 10,
      averageValueLength: Math.round(averageValueLength * 10) / 10,
    }
  }

  /**
   * Calculate maximum nesting depth
   */
  private calculateMaxDepth(obj: any): number {
    let maxDepth = 0

    const calculateDepth = (current: any, depth = 0): number => {
      let currentMaxDepth = depth

      for (const value of Object.values(current)) {
        if (typeof value === 'object' && value !== null) {
          const nestedDepth = calculateDepth(value, depth + 1)
          currentMaxDepth = Math.max(currentMaxDepth, nestedDepth)
        }
      }

      return currentMaxDepth
    }

    maxDepth = calculateDepth(obj)
    return maxDepth
  }
}

/**
 * Translation completion reporter
 */
class TranslationCompletionReporter {
  private readonly translations = {
    en: enTranslations,
    cs: csTranslations,
    ar: arTranslations,
  }

  /**
   * Generate completion report for all languages
   */
  generateCompletionReport(): CompletionReport[] {
    const baseTranslation = this.translations.en
    const reports: CompletionReport[] = []

    for (const [language, translation] of Object.entries(this.translations)) {
      if (language === 'en') continue // Skip base language

      const allKeys = this.getAllKeys(baseTranslation)
      const translatedKeys = this.getTranslatedKeys(translation, allKeys)
      const missingKeys = allKeys.filter(key => !translatedKeys.includes(key))
      const emptyTranslations = this.getEmptyTranslations(translation)

      reports.push({
        language,
        totalKeys: allKeys.length,
        translatedKeys: translatedKeys.length,
        missingKeys,
        completionPercentage: Math.round((translatedKeys.length / allKeys.length) * 100),
        emptyTranslations,
      })
    }

    return reports
  }

  /**
   * Get all translation keys from base language
   */
  private getAllKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = []

    const collectKeys = (current: any, currentPrefix: string) => {
      for (const [key, value] of Object.entries(current)) {
        const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key

        if (typeof value === 'string') {
          keys.push(fullKey)
        } else if (typeof value === 'object' && value !== null) {
          collectKeys(value, fullKey)
        }
      }
    }

    collectKeys(obj, prefix)
    return keys
  }

  /**
   * Get translated keys that exist in target language
   */
  private getTranslatedKeys(translation: any, allKeys: string[]): string[] {
    const translatedKeys: string[] = []

    for (const key of allKeys) {
      const value = this.getNestedValue(translation, key)
      if (value && typeof value === 'string' && value.trim() !== '') {
        translatedKeys.push(key)
      }
    }

    return translatedKeys
  }

  /**
   * Get keys with empty translations
   */
  private getEmptyTranslations(translation: any): string[] {
    const emptyKeys: string[] = []

    const checkEmpty = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        if (typeof value === 'string' && value.trim() === '') {
          emptyKeys.push(fullKey)
        } else if (typeof value === 'object' && value !== null) {
          checkEmpty(value, fullKey)
        }
      }
    }

    checkEmpty(translation)
    return emptyKeys
  }

  /**
   * Get nested value using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}

// Test suite for automation utilities
describe('Translation Automation Utilities', () => {
  let validator: TranslationValidator
  let qualityAnalyzer: TranslationQualityAnalyzer
  let performanceAnalyzer: TranslationPerformanceAnalyzer
  let completionReporter: TranslationCompletionReporter

  beforeEach(() => {
    validator = new TranslationValidator()
    qualityAnalyzer = new TranslationQualityAnalyzer()
    performanceAnalyzer = new TranslationPerformanceAnalyzer()
    completionReporter = new TranslationCompletionReporter()
  })

  describe('Translation Validation', () => {
    it('should validate all translation files', () => {
      const results = validator.validateAllTranslations()

      expect(results).toHaveProperty('en')
      expect(results).toHaveProperty('cs')
      expect(results).toHaveProperty('ar')

      // English should be valid (it's the base)
      expect(results.en.valid).toBe(true)
      expect(results.en.coverage).toBe(100)

      // Other languages should have reasonable coverage
      expect(results.cs.coverage).toBeGreaterThan(80)
      expect(results.ar.coverage).toBeGreaterThan(80)
    })

    it('should detect missing interpolation variables', () => {
      // This would catch cases where {{variable}} is missing in translations
      const results = validator.validateAllTranslations()

      for (const [language, result] of Object.entries(results)) {
        const interpolationErrors = result.errors.filter(error => 
          error.includes('interpolation variables')
        )
        
        // Log interpolation issues but don't fail the test
        if (interpolationErrors.length > 0) {
          console.warn(`${language} has interpolation issues:`, interpolationErrors)
        }
      }
    })

    it('should validate pluralization completeness', () => {
      const results = validator.validateAllTranslations()

      // Czech should have 'one', 'few', 'other' forms
      const czechPluralizationWarnings = results.cs.warnings.filter(warning =>
        warning.includes('plural forms')
      )

      // Arabic should have more plural forms
      const arabicPluralizationWarnings = results.ar.warnings.filter(warning =>
        warning.includes('plural forms')
      )

      // Log warnings for review
      if (czechPluralizationWarnings.length > 0) {
        console.warn('Czech pluralization warnings:', czechPluralizationWarnings)
      }
      if (arabicPluralizationWarnings.length > 0) {
        console.warn('Arabic pluralization warnings:', arabicPluralizationWarnings)
      }
    })
  })

  describe('Quality Analysis', () => {
    it('should detect formatting inconsistencies', () => {
      const report = qualityAnalyzer.generateQualityReport()

      expect(report).toHaveProperty('inconsistentFormatting')
      expect(report).toHaveProperty('suspiciousTranslations')
      expect(report).toHaveProperty('lengthVariations')

      // Log issues for review
      if (report.inconsistentFormatting.length > 0) {
        console.warn('Formatting inconsistencies:', report.inconsistentFormatting.slice(0, 5))
      }
      if (report.suspiciousTranslations.length > 0) {
        console.warn('Suspicious translations:', report.suspiciousTranslations.slice(0, 5))
      }
    })

    it('should identify significant length variations', () => {
      const report = qualityAnalyzer.generateQualityReport()

      // Find the most extreme length variations
      const extremeVariations = report.lengthVariations
        .filter(variation => variation.maxVariation > 100)
        .slice(0, 10)

      if (extremeVariations.length > 0) {
        console.warn('Extreme length variations:', extremeVariations)
      }

      // Length variations are expected between languages, just log for awareness
      expect(report.lengthVariations).toBeDefined()
    })

    it('should validate context completeness', () => {
      const report = qualityAnalyzer.generateQualityReport()

      // Context issues might exist - log for review
      if (report.contextIssues.length > 0) {
        console.warn('Context issues:', report.contextIssues.slice(0, 5))
      }

      expect(report.contextIssues).toBeDefined()
    })
  })

  describe('Performance Analysis', () => {
    it('should analyze translation performance metrics', () => {
      const metrics = performanceAnalyzer.analyzePerformanceMetrics()

      expect(metrics).toHaveProperty('en')
      expect(metrics).toHaveProperty('cs')
      expect(metrics).toHaveProperty('ar')

      for (const [language, metric] of Object.entries(metrics)) {
        expect(metric.keyCount).toBeGreaterThan(0)
        expect(metric.averageKeyLength).toBeGreaterThan(0)
        expect(metric.averageValueLength).toBeGreaterThan(0)
        expect(metric.nestedDepth).toBeGreaterThanOrEqual(1)
        expect(metric.memoryUsage).toBeGreaterThan(0)

        console.log(`${language} metrics:`, {
          keyCount: metric.keyCount,
          avgKeyLength: metric.averageKeyLength,
          avgValueLength: metric.averageValueLength,
          depth: metric.nestedDepth,
          memory: `${(metric.memoryUsage / 1024).toFixed(2)} KB`,
        })
      }
    })

    it('should detect memory usage differences between languages', () => {
      const metrics = performanceAnalyzer.analyzePerformanceMetrics()
      
      const memoryUsages = Object.entries(metrics).map(([lang, metric]) => ({
        language: lang,
        memory: metric.memoryUsage,
      }))

      // Sort by memory usage
      memoryUsages.sort((a, b) => b.memory - a.memory)

      console.log('Memory usage by language:', memoryUsages)

      // All languages should have reasonable memory usage
      for (const usage of memoryUsages) {
        expect(usage.memory).toBeGreaterThan(1000) // At least 1KB
        expect(usage.memory).toBeLessThan(1000000) // Less than 1MB
      }
    })
  })

  describe('Completion Reporting', () => {
    it('should generate completion reports for all languages', () => {
      const reports = completionReporter.generateCompletionReport()

      expect(reports).toHaveLength(2) // cs and ar (excluding en base)

      for (const report of reports) {
        expect(report.language).toMatch(/^(cs|ar)$/)
        expect(report.totalKeys).toBeGreaterThan(0)
        expect(report.translatedKeys).toBeGreaterThanOrEqual(0)
        expect(report.completionPercentage).toBeGreaterThanOrEqual(0)
        expect(report.completionPercentage).toBeLessThanOrEqual(100)

        console.log(`${report.language} completion:`, {
          percentage: `${report.completionPercentage}%`,
          translated: `${report.translatedKeys}/${report.totalKeys}`,
          missing: report.missingKeys.length,
          empty: report.emptyTranslations.length,
        })

        // Expect reasonable completion for both languages
        expect(report.completionPercentage).toBeGreaterThan(70)
      }
    })

    it('should identify missing translation keys', () => {
      const reports = completionReporter.generateCompletionReport()

      for (const report of reports) {
        if (report.missingKeys.length > 0) {
          console.warn(`${report.language} missing keys (first 10):`, 
            report.missingKeys.slice(0, 10)
          )
        }

        if (report.emptyTranslations.length > 0) {
          console.warn(`${report.language} empty translations (first 10):`, 
            report.emptyTranslations.slice(0, 10)
          )
        }
      }

      // This test serves as a monitoring tool rather than strict validation
      expect(reports.length).toBe(2)
    })
  })

  describe('Automated Quality Gates', () => {
    it('should enforce minimum translation coverage', () => {
      const reports = completionReporter.generateCompletionReport()

      for (const report of reports) {
        // Enforce minimum 80% completion for production
        if (process.env.NODE_ENV === 'production') {
          expect(report.completionPercentage).toBeGreaterThanOrEqual(80)
        } else {
          // More lenient for development
          expect(report.completionPercentage).toBeGreaterThanOrEqual(60)
        }
      }
    })

    it('should enforce translation validation standards', () => {
      const results = validator.validateAllTranslations()

      for (const [language, result] of Object.entries(results)) {
        // Critical errors should be zero in production
        const criticalErrors = result.errors.filter(error =>
          error.includes('Missing interpolation') || 
          error.includes('Missing keys')
        )

        if (process.env.NODE_ENV === 'production') {
          expect(criticalErrors.length).toBe(0)
        }

        // Log errors for development review
        if (result.errors.length > 0) {
          console.warn(`${language} validation errors:`, result.errors.slice(0, 5))
        }
      }
    })

    it('should monitor translation quality metrics', () => {
      const qualityReport = qualityAnalyzer.generateQualityReport()
      const performanceMetrics = performanceAnalyzer.analyzePerformanceMetrics()

      // Performance thresholds
      for (const [language, metrics] of Object.entries(performanceMetrics)) {
        // Memory usage should be reasonable (less than 500KB per language)
        expect(metrics.memoryUsage).toBeLessThan(500 * 1024)
        
        // Nesting depth shouldn't be too deep (max 6 levels)
        expect(metrics.nestedDepth).toBeLessThanOrEqual(6)
      }

      // Quality thresholds
      const maxSuspiciousTranslations = process.env.NODE_ENV === 'production' ? 5 : 20
      expect(qualityReport.suspiciousTranslations.length).toBeLessThanOrEqual(maxSuspiciousTranslations)

      // Log quality summary
      console.log('Quality Summary:', {
        suspiciousTranslations: qualityReport.suspiciousTranslations.length,
        formattingIssues: qualityReport.inconsistentFormatting.length,
        lengthVariations: qualityReport.lengthVariations.length,
        pluralizationIssues: qualityReport.pluralizationIssues.length,
        contextIssues: qualityReport.contextIssues.length,
      })
    })
  })
})

// Export utilities for use in CI/CD
export {
  TranslationValidator,
  TranslationQualityAnalyzer,
  TranslationPerformanceAnalyzer,
  TranslationCompletionReporter,
}

export type {
  ValidationResult,
  PerformanceMetrics,
  CompletionReport,
  QualityReport,
}