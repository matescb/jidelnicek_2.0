import type { MissingTranslation } from '../types'

// Storage key for missing translations
const STORAGE_KEY = 'jidelnicek-missing-translations'

// In-memory cache of missing translations
let missingTranslationsCache: MissingTranslation[] = []

// Track a missing translation
export function trackMissingTranslation(
  key: string,
  namespace: string,
  language: string,
  defaultValue?: string
): void {
  const missing: MissingTranslation = {
    key,
    namespace,
    language,
    timestamp: new Date(),
    defaultValue
  }
  
  // Check if already tracked
  const exists = missingTranslationsCache.some(
    m => m.key === key && m.namespace === namespace && m.language === language
  )
  
  if (!exists) {
    missingTranslationsCache.push(missing)
    saveMissingTranslations()
  }
}

// Get all missing translations
export function getMissingTranslations(): MissingTranslation[] {
  return [...missingTranslationsCache]
}

// Get missing translations by language
export function getMissingTranslationsByLanguage(language: string): MissingTranslation[] {
  return missingTranslationsCache.filter(m => m.language === language)
}

// Get missing translations by namespace
export function getMissingTranslationsByNamespace(namespace: string): MissingTranslation[] {
  return missingTranslationsCache.filter(m => m.namespace === namespace)
}

// Clear missing translations
export function clearMissingTranslations(): void {
  missingTranslationsCache = []
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Save to localStorage
function saveMissingTranslations(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(missingTranslationsCache))
    } catch (error) {
      console.error('Failed to save missing translations:', error)
    }
  }
}

// Load from localStorage
function loadMissingTranslations(): void {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        missingTranslationsCache = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      }
    } catch (error) {
      console.error('Failed to load missing translations:', error)
    }
  }
}

// Initialize on load
if (typeof window !== 'undefined') {
  loadMissingTranslations()
}

// Export missing translations as JSON
export function exportMissingTranslations(): string {
  const grouped: Record<string, Record<string, Record<string, string>>> = {}
  
  missingTranslationsCache.forEach(missing => {
    if (!grouped[missing.language]) {
      grouped[missing.language] = {}
    }
    if (!grouped[missing.language][missing.namespace]) {
      grouped[missing.language][missing.namespace] = {}
    }
    
    // Convert dot notation to nested object
    const parts = missing.key.split('.')
    let current = grouped[missing.language][missing.namespace]
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {}
      }
      current = current[parts[i]] as any
    }
    
    current[parts[parts.length - 1]] = missing.defaultValue || `[Missing: ${missing.key}]`
  })
  
  return JSON.stringify(grouped, null, 2)
}

// Create a missing translation report
export function generateMissingTranslationReport(): string {
  const lines: string[] = []
  const byLanguage = new Map<string, MissingTranslation[]>()
  
  // Group by language
  missingTranslationsCache.forEach(missing => {
    const list = byLanguage.get(missing.language) || []
    list.push(missing)
    byLanguage.set(missing.language, list)
  })
  
  lines.push('# Missing Translations Report')
  lines.push('')
  lines.push(`**Total Missing**: ${missingTranslationsCache.length}`)
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push('')
  
  byLanguage.forEach((translations, language) => {
    lines.push(`## Language: ${language}`)
    lines.push('')
    
    // Group by namespace
    const byNamespace = new Map<string, MissingTranslation[]>()
    translations.forEach(t => {
      const list = byNamespace.get(t.namespace) || []
      list.push(t)
      byNamespace.set(t.namespace, list)
    })
    
    byNamespace.forEach((nsTranslations, namespace) => {
      lines.push(`### Namespace: ${namespace}`)
      lines.push('')
      
      nsTranslations.forEach(t => {
        lines.push(`- \`${t.key}\``)
        if (t.defaultValue) {
          lines.push(`  - Default: "${t.defaultValue}"`)
        }
        lines.push(`  - First seen: ${t.timestamp.toLocaleString()}`)
      })
      lines.push('')
    })
  })
  
  return lines.join('\n')
}

// Development helper to log missing translations periodically
if (import.meta.env.DEV) {
  setInterval(() => {
    const missing = getMissingTranslations()
    if (missing.length > 0) {
      console.group('Missing Translations')
      console.table(missing.map(m => ({
        key: m.key,
        language: m.language,
        namespace: m.namespace,
        defaultValue: m.defaultValue
      })))
      console.groupEnd()
    }
  }, 30000) // Log every 30 seconds in development
}