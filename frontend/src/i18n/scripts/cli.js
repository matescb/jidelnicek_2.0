#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import management from '../management/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const options = args.slice(1);

// Display help
function showHelp() {
  console.log(`
Translation Management CLI

Usage: node cli.js <command> [options]

Commands:
  missing                Find missing translations
  unused                 Find unused translations
  coverage               Generate coverage report
  export <locale>        Export translations for translators
  import <file> <locale> Import translations from file
  help                   Show this help message

Examples:
  node cli.js missing
  node cli.js export cs
  node cli.js import ./cs-translations.json cs
`);
}

// Main CLI function
async function main() {
  try {
    switch (command) {
      case 'missing': {
        console.log('🔍 Finding missing translations...\n');
        const missing = await management.findMissingTranslations();
        
        if (missing.length === 0) {
          console.log('✅ No missing translations found!');
        } else {
          console.log(`Found ${missing.length} missing translations:\n`);
          
          // Group by locale
          const byLocale = {};
          missing.forEach(item => {
            if (!byLocale[item.locale]) {
              byLocale[item.locale] = [];
            }
            byLocale[item.locale].push(item);
          });
          
          Object.entries(byLocale).forEach(([locale, items]) => {
            console.log(`${locale.toUpperCase()} (${items.length} missing):`);
            items.slice(0, 10).forEach(item => {
              console.log(`  - ${item.namespace}.${item.key}`);
            });
            if (items.length > 10) {
              console.log(`  ... and ${items.length - 10} more\n`);
            } else {
              console.log('');
            }
          });
        }
        break;
      }
      
      case 'unused': {
        console.log('🔍 Finding unused translations...\n');
        const unused = await management.findUnusedTranslations();
        
        if (unused.length === 0) {
          console.log('✅ No unused translations found!');
        } else {
          console.log(`Found ${unused.length} unused translations:\n`);
          
          // Group by locale
          const byLocale = {};
          unused.forEach(item => {
            if (!byLocale[item.locale]) {
              byLocale[item.locale] = [];
            }
            byLocale[item.locale].push(item);
          });
          
          Object.entries(byLocale).forEach(([locale, items]) => {
            console.log(`${locale.toUpperCase()} (${items.length} unused):`);
            items.slice(0, 10).forEach(item => {
              console.log(`  - ${item.namespace}.${item.key}: "${item.value}"`);
            });
            if (items.length > 10) {
              console.log(`  ... and ${items.length - 10} more\n`);
            } else {
              console.log('');
            }
          });
        }
        break;
      }
      
      case 'coverage': {
        console.log('📊 Generating coverage report...\n');
        await management.generateCoverageReport();
        console.log('✅ Coverage report generated!');
        console.log('   See: src/i18n/reports/coverage-report.json');
        console.log('   See: src/i18n/reports/coverage-report.md');
        
        // Show summary
        const coverage = await management.calculateCoverage();
        console.log('\nCoverage Summary:');
        
        Object.entries(coverage).forEach(([locale, namespaces]) => {
          if (locale === 'en') return; // Skip reference
          
          let totalKeys = 0;
          let translatedKeys = 0;
          
          Object.values(namespaces).forEach(stats => {
            totalKeys += stats.totalKeys;
            translatedKeys += stats.translatedKeys;
          });
          
          const percentage = totalKeys > 0 ? (translatedKeys / totalKeys) * 100 : 0;
          console.log(`  ${locale.toUpperCase()}: ${percentage.toFixed(1)}% (${translatedKeys}/${totalKeys})`);
        });
        break;
      }
      
      case 'export': {
        const locale = options[0];
        if (!locale) {
          console.error('❌ Please specify a locale to export');
          console.log('   Example: node cli.js export cs');
          process.exit(1);
        }
        
        console.log(`📤 Exporting translations for ${locale}...\n`);
        const exports = await management.exportForTranslators(locale, 'json');
        
        console.log('✅ Export complete!');
        console.log(`   File: src/i18n/reports/exports/${locale}-translations.json`);
        console.log(`   Namespaces: ${exports.length}`);
        
        let totalKeys = 0;
        exports.forEach(exp => {
          totalKeys += Object.keys(exp.translations).length;
        });
        console.log(`   Total keys: ${totalKeys}`);
        break;
      }
      
      case 'import': {
        const [file, locale] = options;
        if (!file || !locale) {
          console.error('❌ Please specify file path and locale');
          console.log('   Example: node cli.js import ./cs-translations.json cs');
          process.exit(1);
        }
        
        console.log(`📥 Importing translations for ${locale} from ${file}...\n`);
        await management.importFromTranslators(file, locale);
        console.log('✅ Import complete!');
        break;
      }
      
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run CLI
main();