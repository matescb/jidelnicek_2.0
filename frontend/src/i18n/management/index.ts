/**
 * Translation Management Utilities
 * Provides tools for managing, analyzing, and exporting translations
 */

import { promises as fs } from 'fs';
import path from 'path';

// Types
export interface TranslationStats {
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  coverage: number;
}

export interface TranslationCoverage {
  [locale: string]: {
    [namespace: string]: TranslationStats;
  };
}

export interface MissingTranslation {
  locale: string;
  namespace: string;
  key: string;
  referenceValue?: string;
}

export interface UnusedTranslation {
  locale: string;
  namespace: string;
  key: string;
  value: string;
}

export interface TranslationExport {
  locale: string;
  namespace: string;
  translations: Record<string, string>;
}

// Configuration
const LOCALES = ['en', 'cs', 'ar'];
const REFERENCE_LOCALE = 'en';
const TRANSLATIONS_DIR = path.join(process.cwd(), 'src/i18n/locales');
const REPORTS_DIR = path.join(process.cwd(), 'src/i18n/reports');

/**
 * Load all translation files
 */
async function loadTranslations(): Promise<Record<string, any>> {
  const translations: Record<string, any> = {};
  
  for (const locale of LOCALES) {
    const filePath = path.join(TRANSLATIONS_DIR, `${locale}.ts`);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const exportMatch = content.match(/export\s+default\s+({[\s\S]*})\s*$/);
      if (exportMatch) {
        translations[locale] = new Function('return ' + exportMatch[1])();
      }
    } catch (error) {
      console.error(`Error loading ${locale}:`, error);
      translations[locale] = {};
    }
  }
  
  return translations;
}

/**
 * Get all keys from a nested object
 */
function getAllKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  
  Object.entries(obj).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  });
  
  return keys;
}

/**
 * Get value from nested object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

/**
 * Find missing translations
 */
export async function findMissingTranslations(): Promise<MissingTranslation[]> {
  const translations = await loadTranslations();
  const referenceData = translations[REFERENCE_LOCALE];
  const missing: MissingTranslation[] = [];
  
  if (!referenceData) {
    throw new Error(`Reference locale ${REFERENCE_LOCALE} not found`);
  }
  
  // Check each locale
  for (const locale of LOCALES) {
    if (locale === REFERENCE_LOCALE) continue;
    
    const localeData = translations[locale] || {};
    
    // Check each namespace
    Object.entries(referenceData).forEach(([namespace, namespaceData]) => {
      const localeNamespace = localeData[namespace] || {};
      const referenceKeys = getAllKeys(namespaceData);
      
      referenceKeys.forEach(key => {
        const value = getNestedValue(localeNamespace, key);
        if (value === undefined || value === '') {
          missing.push({
            locale,
            namespace,
            key,
            referenceValue: getNestedValue(namespaceData, key)
          });
        }
      });
    });
  }
  
  return missing;
}

/**
 * Find unused translations
 */
export async function findUnusedTranslations(): Promise<UnusedTranslation[]> {
  const translations = await loadTranslations();
  const unused: UnusedTranslation[] = [];
  
  // Load key usage report if available
  let keyUsage: Record<string, string[]> = {};
  try {
    const usageReport = await fs.readFile(
      path.join(REPORTS_DIR, 'key-usage.json'),
      'utf8'
    );
    const report = JSON.parse(usageReport);
    keyUsage = report.keys || {};
  } catch (error) {
    console.warn('Key usage report not found. Run extract-keys first.');
  }
  
  // Find unused keys in each locale
  for (const locale of LOCALES) {
    const localeData = translations[locale] || {};
    
    Object.entries(localeData).forEach(([namespace, namespaceData]) => {
      const keys = getAllKeys(namespaceData);
      
      keys.forEach(key => {
        const fullKey = `${namespace}:${key}`;
        // Skip plural and context variations
        if (key.match(/_(one|other|zero|few|many|male|female|neutral|formal|informal)$/)) {
          const baseKey = key.replace(/_(one|other|zero|few|many|male|female|neutral|formal|informal)$/, '');
          const baseFullKey = `${namespace}:${baseKey}`;
          if (keyUsage[baseFullKey]) return;
        }
        
        if (!keyUsage[fullKey] || keyUsage[fullKey].length === 0) {
          unused.push({
            locale,
            namespace,
            key,
            value: getNestedValue(namespaceData, key)
          });
        }
      });
    });
  }
  
  return unused;
}

/**
 * Calculate translation coverage
 */
export async function calculateCoverage(): Promise<TranslationCoverage> {
  const translations = await loadTranslations();
  const referenceData = translations[REFERENCE_LOCALE];
  const coverage: TranslationCoverage = {};
  
  if (!referenceData) {
    throw new Error(`Reference locale ${REFERENCE_LOCALE} not found`);
  }
  
  // Calculate coverage for each locale
  for (const locale of LOCALES) {
    coverage[locale] = {};
    const localeData = translations[locale] || {};
    
    // Calculate for each namespace
    Object.entries(referenceData).forEach(([namespace, namespaceData]) => {
      const referenceKeys = getAllKeys(namespaceData);
      const totalKeys = referenceKeys.length;
      
      if (locale === REFERENCE_LOCALE) {
        coverage[locale][namespace] = {
          totalKeys,
          translatedKeys: totalKeys,
          missingKeys: 0,
          coverage: 100
        };
      } else {
        const localeNamespace = localeData[namespace] || {};
        let translatedKeys = 0;
        
        referenceKeys.forEach(key => {
          const value = getNestedValue(localeNamespace, key);
          if (value && value !== '') {
            translatedKeys++;
          }
        });
        
        coverage[locale][namespace] = {
          totalKeys,
          translatedKeys,
          missingKeys: totalKeys - translatedKeys,
          coverage: totalKeys > 0 ? (translatedKeys / totalKeys) * 100 : 0
        };
      }
    });
  }
  
  return coverage;
}

/**
 * Export translations for translators
 */
export async function exportForTranslators(
  locale: string,
  format: 'json' | 'csv' | 'xlsx' = 'json'
): Promise<TranslationExport[]> {
  const translations = await loadTranslations();
  const referenceData = translations[REFERENCE_LOCALE];
  const localeData = translations[locale] || {};
  const exports: TranslationExport[] = [];
  
  if (!referenceData) {
    throw new Error(`Reference locale ${REFERENCE_LOCALE} not found`);
  }
  
  // Export each namespace
  Object.entries(referenceData).forEach(([namespace, namespaceData]) => {
    const referenceKeys = getAllKeys(namespaceData);
    const namespaceExport: Record<string, string> = {};
    
    referenceKeys.forEach(key => {
      const referenceValue = getNestedValue(namespaceData, key);
      const localeValue = getNestedValue(localeData[namespace] || {}, key);
      
      // Include reference value for context
      namespaceExport[key] = localeValue || `[TRANSLATE] ${referenceValue}`;
    });
    
    exports.push({
      locale,
      namespace,
      translations: namespaceExport
    });
  });
  
  // Save exports
  const exportDir = path.join(REPORTS_DIR, 'exports');
  await fs.mkdir(exportDir, { recursive: true });
  
  if (format === 'json') {
    await fs.writeFile(
      path.join(exportDir, `${locale}-translations.json`),
      JSON.stringify(exports, null, 2)
    );
  } else if (format === 'csv') {
    // CSV export
    let csv = 'Namespace,Key,Reference,Translation\n';
    exports.forEach(exp => {
      Object.entries(exp.translations).forEach(([key, value]) => {
        const refValue = getNestedValue(
          referenceData[exp.namespace],
          key
        );
        csv += `"${exp.namespace}","${key}","${refValue}","${value}"\n`;
      });
    });
    
    await fs.writeFile(
      path.join(exportDir, `${locale}-translations.csv`),
      csv
    );
  }
  
  return exports;
}

/**
 * Import translations from translators
 */
export async function importFromTranslators(
  filePath: string,
  locale: string
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf8');
  const imports = JSON.parse(content) as TranslationExport[];
  
  // Load current translations
  const translations = await loadTranslations();
  const localeData = translations[locale] || {};
  
  // Apply imports
  imports.forEach(imp => {
    if (!localeData[imp.namespace]) {
      localeData[imp.namespace] = {};
    }
    
    Object.entries(imp.translations).forEach(([key, value]) => {
      // Skip untranslated entries
      if (!value.startsWith('[TRANSLATE]')) {
        setNestedValue(localeData[imp.namespace], key, value);
      }
    });
  });
  
  // Write back to file
  const outputPath = path.join(TRANSLATIONS_DIR, `${locale}.ts`);
  const content = `export default ${JSON.stringify(localeData, null, 2)}`;
  const formattedContent = content
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
  
  await fs.writeFile(outputPath, formattedContent);
}

/**
 * Set value in nested object
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * Generate coverage report
 */
export async function generateCoverageReport(): Promise<void> {
  const coverage = await calculateCoverage();
  const missing = await findMissingTranslations();
  const unused = await findUnusedTranslations();
  
  const report = {
    timestamp: new Date().toISOString(),
    coverage,
    summary: {
      totalMissing: missing.length,
      totalUnused: unused.length,
      overallCoverage: calculateOverallCoverage(coverage)
    },
    details: {
      missing: groupByLocaleAndNamespace(missing),
      unused: groupByLocaleAndNamespace(unused)
    }
  };
  
  // Save report
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(REPORTS_DIR, 'coverage-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  // Generate markdown report
  const markdown = generateMarkdownReport(report);
  await fs.writeFile(
    path.join(REPORTS_DIR, 'coverage-report.md'),
    markdown
  );
}

/**
 * Calculate overall coverage across all locales
 */
function calculateOverallCoverage(coverage: TranslationCoverage): number {
  let totalKeys = 0;
  let totalTranslated = 0;
  
  Object.entries(coverage).forEach(([locale, namespaces]) => {
    if (locale === REFERENCE_LOCALE) return;
    
    Object.values(namespaces).forEach(stats => {
      totalKeys += stats.totalKeys;
      totalTranslated += stats.translatedKeys;
    });
  });
  
  return totalKeys > 0 ? (totalTranslated / totalKeys) * 100 : 0;
}

/**
 * Group translations by locale and namespace
 */
function groupByLocaleAndNamespace<T extends { locale: string; namespace: string }>(
  items: T[]
): Record<string, Record<string, T[]>> {
  const grouped: Record<string, Record<string, T[]>> = {};
  
  items.forEach(item => {
    if (!grouped[item.locale]) {
      grouped[item.locale] = {};
    }
    if (!grouped[item.locale][item.namespace]) {
      grouped[item.locale][item.namespace] = [];
    }
    grouped[item.locale][item.namespace].push(item);
  });
  
  return grouped;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: any): string {
  let markdown = `# Translation Coverage Report\n\n`;
  markdown += `Generated: ${report.timestamp}\n\n`;
  
  markdown += `## Summary\n\n`;
  markdown += `- **Overall Coverage**: ${report.summary.overallCoverage.toFixed(1)}%\n`;
  markdown += `- **Missing Translations**: ${report.summary.totalMissing}\n`;
  markdown += `- **Unused Translations**: ${report.summary.totalUnused}\n\n`;
  
  markdown += `## Coverage by Locale\n\n`;
  
  Object.entries(report.coverage).forEach(([locale, namespaces]: [string, any]) => {
    if (locale === REFERENCE_LOCALE) return;
    
    markdown += `### ${locale.toUpperCase()}\n\n`;
    markdown += `| Namespace | Coverage | Translated | Missing | Total |\n`;
    markdown += `|-----------|----------|------------|---------|-------|\n`;
    
    Object.entries(namespaces).forEach(([namespace, stats]: [string, any]) => {
      markdown += `| ${namespace} | ${stats.coverage.toFixed(1)}% | ${stats.translatedKeys} | ${stats.missingKeys} | ${stats.totalKeys} |\n`;
    });
    
    markdown += `\n`;
  });
  
  return markdown;
}

// Export all utilities
export default {
  findMissingTranslations,
  findUnusedTranslations,
  calculateCoverage,
  exportForTranslators,
  importFromTranslators,
  generateCoverageReport
};