#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

// Configuration
const LOCALES = ['en', 'cs', 'ar'];
const SOURCE_PATTERNS = [
  'src/**/*.ts',
  'src/**/*.tsx',
  '!src/**/*.test.{ts,tsx}',
  '!src/**/*.spec.{ts,tsx}',
  '!src/**/*.d.ts',
  '!src/i18n/**/*'
];

// Regular expressions for finding translation keys
const TRANSLATION_PATTERNS = [
  // t('key') or t("key")
  /\bt\s*\(\s*['"`]([^'"`]+)['"`]/g,
  // t('namespace:key')
  /\bt\s*\(\s*['"`]([^:]+):([^'"`]+)['"`]/g,
  // useTranslation('namespace')
  /useTranslation\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  // i18nKey="key" or i18nKey='key'
  /i18nKey\s*=\s*['"`]([^'"`]+)['"`]/g,
  // <Trans i18nKey="key">
  /<Trans[^>]+i18nKey\s*=\s*['"`]([^'"`]+)['"`]/g,
  // T component
  /<T\s+[^>]*>/g
];

// Extract namespace from key
function extractNamespaceAndKey(fullKey) {
  const parts = fullKey.split(':');
  if (parts.length === 2) {
    return { namespace: parts[0], key: parts[1] };
  }
  return { namespace: 'common', key: fullKey };
}

// Extract keys from file content
function extractKeysFromContent(content, filePath) {
  const keys = new Set();
  const namespaces = new Set();
  
  // Extract namespace declarations
  const namespaceMatch = content.match(/useTranslation\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
  if (namespaceMatch) {
    namespaceMatch.forEach(match => {
      const ns = match.match(/useTranslation\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
      if (ns && ns[1]) {
        namespaces.add(ns[1]);
      }
    });
  }
  
  // Extract translation keys
  TRANSLATION_PATTERNS.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const { namespace, key } = extractNamespaceAndKey(match[1]);
        keys.add({ namespace, key, filePath });
      }
    }
  });
  
  // Handle T component
  const tComponentMatches = content.matchAll(/<T\s+([^>]*)>/g);
  for (const match of tComponentMatches) {
    const keyMatch = match[1].match(/key\s*=\s*['"`]([^'"`]+)['"`]/);
    const nsMatch = match[1].match(/ns\s*=\s*['"`]([^'"`]+)['"`]/);
    if (keyMatch) {
      const namespace = nsMatch ? nsMatch[1] : 'common';
      keys.add({ namespace, key: keyMatch[1], filePath });
    }
  }
  
  return { keys: Array.from(keys), namespaces: Array.from(namespaces) };
}

// Read and parse TypeScript translation files
async function readExistingTranslations() {
  const translations = {};
  
  for (const locale of LOCALES) {
    const filePath = path.join(ROOT_DIR, `src/i18n/locales/${locale}.ts`);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      // Extract the export default object
      const exportMatch = content.match(/export\s+default\s+({[\s\S]*})\s*$/);
      if (exportMatch) {
        // Use Function constructor to safely evaluate the object
        const obj = new Function('return ' + exportMatch[1])();
        translations[locale] = obj;
      }
    } catch (error) {
      console.warn(`Warning: Could not read ${locale}.ts:`, error.message);
      translations[locale] = {};
    }
  }
  
  return translations;
}

// Scan source files for translation keys
async function scanSourceFiles() {
  const allKeys = new Map();
  const namespaceUsage = new Map();
  
  const files = await glob(SOURCE_PATTERNS, {
    cwd: ROOT_DIR,
    absolute: true,
    ignore: SOURCE_PATTERNS.filter(p => p.startsWith('!'))
  });
  
  console.log(`Scanning ${files.length} files for translation keys...`);
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const { keys, namespaces } = extractKeysFromContent(content, file);
    
    keys.forEach(({ namespace, key, filePath }) => {
      const fullKey = `${namespace}:${key}`;
      if (!allKeys.has(fullKey)) {
        allKeys.set(fullKey, []);
      }
      allKeys.get(fullKey).push(path.relative(ROOT_DIR, filePath));
    });
    
    namespaces.forEach(ns => {
      if (!namespaceUsage.has(ns)) {
        namespaceUsage.set(ns, []);
      }
      namespaceUsage.get(ns).push(path.relative(ROOT_DIR, file));
    });
  }
  
  return { keys: allKeys, namespaceUsage };
}

// Generate extraction report
async function generateReport(extractedKeys, existingTranslations) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalKeysFound: extractedKeys.size,
      uniqueNamespaces: new Set(Array.from(extractedKeys.keys()).map(k => k.split(':')[0])).size,
      localesCovered: LOCALES
    },
    byNamespace: {},
    missingTranslations: {},
    unusedTranslations: {}
  };
  
  // Group keys by namespace
  const keysByNamespace = new Map();
  extractedKeys.forEach((files, fullKey) => {
    const [namespace, key] = fullKey.split(':');
    if (!keysByNamespace.has(namespace)) {
      keysByNamespace.set(namespace, new Set());
    }
    keysByNamespace.get(namespace).add(key);
  });
  
  // Analyze each namespace
  keysByNamespace.forEach((keys, namespace) => {
    report.byNamespace[namespace] = {
      totalKeys: keys.size,
      keys: Array.from(keys).sort()
    };
    
    // Check missing translations
    LOCALES.forEach(locale => {
      if (!report.missingTranslations[locale]) {
        report.missingTranslations[locale] = {};
      }
      
      const localeData = existingTranslations[locale] || {};
      const namespaceData = localeData[namespace] || {};
      const missingKeys = Array.from(keys).filter(key => !namespaceData[key]);
      
      if (missingKeys.length > 0) {
        report.missingTranslations[locale][namespace] = missingKeys;
      }
    });
  });
  
  // Find unused translations
  LOCALES.forEach(locale => {
    const localeData = existingTranslations[locale] || {};
    report.unusedTranslations[locale] = {};
    
    Object.entries(localeData).forEach(([namespace, translations]) => {
      const extractedNamespaceKeys = keysByNamespace.get(namespace) || new Set();
      const unusedKeys = Object.keys(translations).filter(key => {
        // Skip meta keys and plural forms
        if (key.includes('_one') || key.includes('_other') || key.includes('_zero') || 
            key.includes('_few') || key.includes('_many')) {
          const baseKey = key.replace(/_(one|other|zero|few|many)$/, '');
          return !extractedNamespaceKeys.has(baseKey);
        }
        return !extractedNamespaceKeys.has(key);
      });
      
      if (unusedKeys.length > 0) {
        report.unusedTranslations[locale][namespace] = unusedKeys;
      }
    });
  });
  
  return report;
}

// Main extraction function
async function main() {
  try {
    console.log('🔍 Starting translation key extraction...\n');
    
    // Read existing translations
    const existingTranslations = await readExistingTranslations();
    
    // Scan source files
    const { keys: extractedKeys, namespaceUsage } = await scanSourceFiles();
    
    // Generate report
    const report = await generateReport(extractedKeys, existingTranslations);
    
    // Save extraction results
    const outputDir = path.join(ROOT_DIR, 'src/i18n/reports');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save detailed report
    await fs.writeFile(
      path.join(outputDir, 'extraction-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Save key usage mapping
    const keyUsageReport = {
      timestamp: new Date().toISOString(),
      keys: Object.fromEntries(extractedKeys)
    };
    await fs.writeFile(
      path.join(outputDir, 'key-usage.json'),
      JSON.stringify(keyUsageReport, null, 2)
    );
    
    // Print summary
    console.log('📊 Extraction Summary:');
    console.log(`   Total keys found: ${report.summary.totalKeysFound}`);
    console.log(`   Namespaces: ${report.summary.uniqueNamespaces}`);
    console.log(`   Locales: ${report.summary.localesCovered.join(', ')}\n`);
    
    // Print missing translations
    console.log('⚠️  Missing Translations:');
    Object.entries(report.missingTranslations).forEach(([locale, namespaces]) => {
      const totalMissing = Object.values(namespaces).reduce((sum, keys) => sum + keys.length, 0);
      if (totalMissing > 0) {
        console.log(`   ${locale}: ${totalMissing} missing keys`);
      }
    });
    
    // Print unused translations
    console.log('\n🗑️  Unused Translations:');
    Object.entries(report.unusedTranslations).forEach(([locale, namespaces]) => {
      const totalUnused = Object.values(namespaces).reduce((sum, keys) => sum + keys.length, 0);
      if (totalUnused > 0) {
        console.log(`   ${locale}: ${totalUnused} unused keys`);
      }
    });
    
    console.log('\n✅ Extraction complete! Reports saved to src/i18n/reports/');
    
  } catch (error) {
    console.error('❌ Extraction failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}