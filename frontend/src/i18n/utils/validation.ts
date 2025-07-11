import type { 
  ValidationResult, 
  ValidationError, 
  ValidationWarning, 
  TranslationFile,
  Namespace 
} from '../types'

// Validate translation files
export function validateTranslations(
  translations: Record<string, TranslationFile>,
  namespaces: Namespace[]
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const languages = Object.keys(translations)
  
  if (languages.length === 0) {
    errors.push({
      type: 'missing_key',
      key: '',
      language: '',
      namespace: '',
      message: 'No translation files found'
    })
    return { isValid: false, errors, warnings, coverage: 0 }
  }
  
  // Get all keys from all languages
  const allKeys = new Set<string>()
  const keysByLanguage: Record<string, Set<string>> = {}
  
  languages.forEach(lang => {
    keysByLanguage[lang] = new Set()
    collectKeys(translations[lang], '', keysByLanguage[lang])
    keysByLanguage[lang].forEach(key => allKeys.add(key))
  })
  
  // Check for missing keys
  languages.forEach(lang => {
    allKeys.forEach(key => {
      if (!keysByLanguage[lang].has(key)) {
        errors.push({
          type: 'missing_key',
          key,
          language: lang,
          namespace: getNamespaceFromKey(key, namespaces),
          message: `Missing translation for key "${key}" in language "${lang}"`
        })
      }
    })
  })
  
  // Check for interpolation consistency
  languages.forEach(lang => {
    keysByLanguage[lang].forEach(key => {
      const value = getValueByKey(translations[lang], key)
      if (typeof value === 'string') {
        const interpolations = extractInterpolations(value)
        
        // Compare with other languages
        languages.forEach(otherLang => {
          if (lang !== otherLang && keysByLanguage[otherLang].has(key)) {
            const otherValue = getValueByKey(translations[otherLang], key)
            if (typeof otherValue === 'string') {
              const otherInterpolations = extractInterpolations(otherValue)
              
              // Check if interpolations match
              const missing = interpolations.filter(i => !otherInterpolations.includes(i))
              const extra = otherInterpolations.filter(i => !interpolations.includes(i))
              
              if (missing.length > 0 || extra.length > 0) {
                warnings.push({
                  type: 'inconsistent_format',
                  key,
                  language: lang,
                  namespace: getNamespaceFromKey(key, namespaces),
                  message: `Inconsistent interpolations between "${lang}" and "${otherLang}"`
                })
              }
            }
          }
        })
      }
    })
  })
  
  // Check for unused keys (keys that exist in translations but not used in code)
  // This would require code analysis, so we'll just add a placeholder
  
  // Calculate coverage
  const referenceLanguage = languages[0]
  const referenceKeyCount = keysByLanguage[referenceLanguage]?.size || 0
  let totalCoverage = 0
  
  languages.forEach(lang => {
    const coverage = referenceKeyCount > 0 
      ? (keysByLanguage[lang].size / referenceKeyCount) * 100
      : 0
    totalCoverage += coverage
  })
  
  const averageCoverage = languages.length > 0 
    ? totalCoverage / languages.length
    : 0
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    coverage: Math.round(averageCoverage)
  }
}

// Collect all keys from a translation object
function collectKeys(obj: any, prefix: string, keys: Set<string>): void {
  Object.keys(obj).forEach(key => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      collectKeys(obj[key], fullKey, keys)
    } else {
      keys.add(fullKey)
    }
  })
}

// Get value by dot-notation key
function getValueByKey(obj: any, key: string): any {
  const parts = key.split('.')
  let current = obj
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      return undefined
    }
  }
  
  return current
}

// Extract interpolation variables from a string
function extractInterpolations(str: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const matches: string[] = []
  let match
  
  while ((match = regex.exec(str)) !== null) {
    matches.push(match[1].trim())
  }
  
  return [...new Set(matches)]
}

// Get namespace from key
function getNamespaceFromKey(key: string, namespaces: Namespace[]): string {
  const firstPart = key.split('.')[0]
  return namespaces.includes(firstPart as Namespace) ? firstPart : 'common'
}

// Validate a single translation key format
export function validateTranslationKey(key: string): boolean {
  // Key should not be empty
  if (!key) return false
  
  // Key should not start or end with a dot
  if (key.startsWith('.') || key.endsWith('.')) return false
  
  // Key should not have consecutive dots
  if (key.includes('..')) return false
  
  // Key parts should be valid identifiers
  const parts = key.split('.')
  const validIdentifier = /^[a-zA-Z][a-zA-Z0-9_]*$/
  
  return parts.every(part => validIdentifier.test(part))
}

// Check if translation value has valid interpolation syntax
export function validateInterpolation(value: string): boolean {
  const regex = /\{\{([^}]+)\}\}/g
  let match
  
  while ((match = regex.exec(value)) !== null) {
    const variable = match[1].trim()
    // Variable should be a valid identifier
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) {
      return false
    }
  }
  
  return true
}

// Generate validation report
export function generateValidationReport(result: ValidationResult): string {
  const lines: string[] = []
  
  lines.push('# Translation Validation Report')
  lines.push('')
  lines.push(`**Status**: ${result.isValid ? '✅ Valid' : '❌ Invalid'}`)
  lines.push(`**Coverage**: ${result.coverage}%`)
  lines.push('')
  
  if (result.errors.length > 0) {
    lines.push('## Errors')
    lines.push('')
    result.errors.forEach(error => {
      lines.push(`- **${error.type}**: ${error.message}`)
      lines.push(`  - Key: \`${error.key}\``)
      lines.push(`  - Language: ${error.language}`)
      lines.push(`  - Namespace: ${error.namespace}`)
      lines.push('')
    })
  }
  
  if (result.warnings.length > 0) {
    lines.push('## Warnings')
    lines.push('')
    result.warnings.forEach(warning => {
      lines.push(`- **${warning.type}**: ${warning.message}`)
      lines.push(`  - Key: \`${warning.key}\``)
      lines.push(`  - Language: ${warning.language}`)
      lines.push(`  - Namespace: ${warning.namespace}`)
      lines.push('')
    })
  }
  
  return lines.join('\n')
}