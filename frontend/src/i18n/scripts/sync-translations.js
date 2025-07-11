#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

// Configuration
const LOCALES = ['en', 'cs', 'ar'];
const REFERENCE_LOCALE = 'en';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Read translation files
async function readTranslations() {
  const translations = {};
  
  for (const locale of LOCALES) {
    const filePath = path.join(ROOT_DIR, `src/i18n/locales/${locale}.ts`);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const exportMatch = content.match(/export\s+default\s+({[\s\S]*})\s*$/);
      if (exportMatch) {
        translations[locale] = new Function('return ' + exportMatch[1])();
      }
    } catch (error) {
      console.error(`Error reading ${locale}.ts:`, error.message);
      translations[locale] = {};
    }
  }
  
  return translations;
}

// Deep clone object
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Get all keys from an object recursively
function getAllKeys(obj, prefix = '') {
  const keys = [];
  
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

// Set value in nested object
function setNestedValue(obj, path, value) {
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

// Get value from nested object
function getNestedValue(obj, path) {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (!current || !current[key]) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

// Delete key from nested object
function deleteNestedKey(obj, path) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      return;
    }
    current = current[keys[i]];
  }
  
  delete current[keys[keys.length - 1]];
}

// Sync translations from reference to target locales
async function syncTranslations(translations, options = {}) {
  const { 
    addMissing = true, 
    removeExtra = false, 
    updateEmpty = true,
    interactive = true 
  } = options;
  
  const referenceData = translations[REFERENCE_LOCALE];
  const changes = {};
  
  // Get all reference keys
  const referenceKeys = getAllKeys(referenceData);
  
  for (const locale of LOCALES) {
    if (locale === REFERENCE_LOCALE) continue;
    
    changes[locale] = {
      added: [],
      removed: [],
      updated: []
    };
    
    const localeData = deepClone(translations[locale]);
    
    // Add missing keys
    if (addMissing) {
      for (const key of referenceKeys) {
        const refValue = getNestedValue(referenceData, key);
        const localeValue = getNestedValue(localeData, key);
        
        if (localeValue === undefined) {
          // Handle plural forms
          if (key.match(/_(one|other|zero|few|many)$/)) {
            setNestedValue(localeData, key, refValue);
            changes[locale].added.push(key);
          } else {
            // For regular keys, add with placeholder
            setNestedValue(localeData, key, `[${locale.toUpperCase()}] ${refValue}`);
            changes[locale].added.push(key);
          }
        } else if (updateEmpty && localeValue === '') {
          // Update empty values
          setNestedValue(localeData, key, `[${locale.toUpperCase()}] ${refValue}`);
          changes[locale].updated.push(key);
        }
      }
    }
    
    // Remove extra keys
    if (removeExtra) {
      const localeKeys = getAllKeys(localeData);
      
      for (const key of localeKeys) {
        if (!referenceKeys.includes(key)) {
          if (!interactive || await confirmRemoval(locale, key, getNestedValue(localeData, key))) {
            deleteNestedKey(localeData, key);
            changes[locale].removed.push(key);
          }
        }
      }
    }
    
    translations[locale] = localeData;
  }
  
  return changes;
}

// Confirm removal of extra key
async function confirmRemoval(locale, key, value) {
  console.log(`\n⚠️  Extra key found in ${locale}:`);
  console.log(`   Key: ${key}`);
  console.log(`   Value: ${value}`);
  const answer = await question('Remove this key? (y/n): ');
  return answer.toLowerCase() === 'y';
}

// Write translations back to files
async function writeTranslations(translations) {
  for (const locale of LOCALES) {
    const filePath = path.join(ROOT_DIR, `src/i18n/locales/${locale}.ts`);
    
    // Convert object to TypeScript export
    const content = `export default ${JSON.stringify(translations[locale], null, 2)}`;
    
    // Fix formatting
    const formattedContent = content
      .replace(/"([^"]+)":/g, '$1:') // Remove quotes from keys
      .replace(/\\'/g, "'") // Unescape single quotes
      .replace(/\\"/g, '"'); // Unescape double quotes
    
    await fs.writeFile(filePath, formattedContent);
  }
}

// Generate sync report
function generateReport(changes) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalChanges: 0,
      byLocale: {}
    },
    changes: changes
  };
  
  Object.entries(changes).forEach(([locale, localeChanges]) => {
    const total = localeChanges.added.length + 
                  localeChanges.removed.length + 
                  localeChanges.updated.length;
    
    report.summary.totalChanges += total;
    report.summary.byLocale[locale] = {
      added: localeChanges.added.length,
      removed: localeChanges.removed.length,
      updated: localeChanges.updated.length,
      total: total
    };
  });
  
  return report;
}

// Main sync function
async function main() {
  try {
    console.log('🔄 Starting translation sync...\n');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
      addMissing: !args.includes('--no-add'),
      removeExtra: args.includes('--remove-extra'),
      updateEmpty: !args.includes('--no-update-empty'),
      interactive: !args.includes('--non-interactive')
    };
    
    // Read translations
    const translations = await readTranslations();
    
    // Perform sync
    const changes = await syncTranslations(translations, options);
    
    // Generate report
    const report = generateReport(changes);
    
    // Show summary
    console.log('\n📊 Sync Summary:');
    console.log(`   Total changes: ${report.summary.totalChanges}\n`);
    
    Object.entries(report.summary.byLocale).forEach(([locale, stats]) => {
      if (stats.total > 0) {
        console.log(`   ${locale}:`);
        if (stats.added > 0) console.log(`     Added: ${stats.added} keys`);
        if (stats.removed > 0) console.log(`     Removed: ${stats.removed} keys`);
        if (stats.updated > 0) console.log(`     Updated: ${stats.updated} keys`);
      }
    });
    
    if (report.summary.totalChanges === 0) {
      console.log('   No changes needed - translations are in sync!');
      rl.close();
      return;
    }
    
    // Confirm changes
    if (options.interactive) {
      console.log('\n📝 Detailed Changes:');
      Object.entries(changes).forEach(([locale, localeChanges]) => {
        if (localeChanges.added.length > 0) {
          console.log(`\n${locale} - Added keys:`);
          localeChanges.added.forEach(key => console.log(`  + ${key}`));
        }
        if (localeChanges.removed.length > 0) {
          console.log(`\n${locale} - Removed keys:`);
          localeChanges.removed.forEach(key => console.log(`  - ${key}`));
        }
        if (localeChanges.updated.length > 0) {
          console.log(`\n${locale} - Updated keys:`);
          localeChanges.updated.forEach(key => console.log(`  ~ ${key}`));
        }
      });
      
      const answer = await question('\nApply these changes? (y/n): ');
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Sync cancelled');
        rl.close();
        return;
      }
    }
    
    // Write changes
    await writeTranslations(translations);
    
    // Save report
    const outputDir = path.join(ROOT_DIR, 'src/i18n/reports');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, 'sync-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n✅ Sync complete! Report saved to src/i18n/reports/sync-report.json');
    
    rl.close();
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    rl.close();
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}