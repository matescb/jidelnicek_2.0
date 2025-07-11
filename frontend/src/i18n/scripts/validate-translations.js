#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

// Configuration
const LOCALES = ['en', 'cs', 'ar'];
const REFERENCE_LOCALE = 'en';

// Validation rules
const VALIDATION_RULES = {
  // Check for missing interpolations
  checkInterpolations: true,
  // Check for HTML in translations
  checkHTML: true,
  // Check for trailing/leading whitespace
  checkWhitespace: true,
  // Check for consistent punctuation
  checkPunctuation: true,
  // Check plural forms
  checkPluralForms: true,
  // Check context variations
  checkContextVariations: true
};

// Plural suffixes by locale
const PLURAL_SUFFIXES = {
  en: ['_one', '_other', '_zero'],
  cs: ['_one', '_few', '_many', '_other'],
  ar: ['_zero', '_one', '_two', '_few', '_many', '_other']
};

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

// Extract interpolation variables from string
function extractInterpolations(str) {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(str)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

// Check if string contains HTML
function containsHTML(str) {
  return /<[^>]+>/.test(str);
}

// Validate a single translation value
function validateTranslationValue(key, value, referenceValue, locale, namespace, issues) {
  const fullKey = `${namespace}.${key}`;
  
  // Check interpolations
  if (VALIDATION_RULES.checkInterpolations && referenceValue) {
    const refVars = extractInterpolations(referenceValue);
    const localeVars = extractInterpolations(value);
    
    const missingVars = refVars.filter(v => !localeVars.includes(v));
    const extraVars = localeVars.filter(v => !refVars.includes(v));
    
    if (missingVars.length > 0) {
      issues.push({
        type: 'missing_interpolation',
        locale,
        key: fullKey,
        message: `Missing interpolation variables: ${missingVars.join(', ')}`,
        severity: 'error'
      });
    }
    
    if (extraVars.length > 0) {
      issues.push({
        type: 'extra_interpolation',
        locale,
        key: fullKey,
        message: `Extra interpolation variables: ${extraVars.join(', ')}`,
        severity: 'warning'
      });
    }
  }
  
  // Check HTML
  if (VALIDATION_RULES.checkHTML) {
    const refHasHTML = referenceValue ? containsHTML(referenceValue) : false;
    const hasHTML = containsHTML(value);
    
    if (refHasHTML !== hasHTML) {
      issues.push({
        type: 'html_mismatch',
        locale,
        key: fullKey,
        message: hasHTML ? 'Contains HTML but reference does not' : 'Missing HTML that reference has',
        severity: 'warning'
      });
    }
  }
  
  // Check whitespace
  if (VALIDATION_RULES.checkWhitespace) {
    if (value !== value.trim()) {
      issues.push({
        type: 'whitespace',
        locale,
        key: fullKey,
        message: 'Contains leading or trailing whitespace',
        severity: 'warning'
      });
    }
  }
  
  // Check punctuation consistency
  if (VALIDATION_RULES.checkPunctuation && referenceValue) {
    const refEndsWithPunc = /[.!?]$/.test(referenceValue);
    const endsWithPunc = /[.!?]$/.test(value);
    
    if (refEndsWithPunc !== endsWithPunc) {
      issues.push({
        type: 'punctuation',
        locale,
        key: fullKey,
        message: 'Punctuation inconsistency with reference',
        severity: 'info'
      });
    }
  }
  
  // Check for empty values
  if (!value || value.trim() === '') {
    issues.push({
      type: 'empty_value',
      locale,
      key: fullKey,
      message: 'Translation is empty',
      severity: 'error'
    });
  }
}

// Validate plural forms
function validatePluralForms(namespace, translations, locale, referenceTranslations, issues) {
  const expectedSuffixes = PLURAL_SUFFIXES[locale] || PLURAL_SUFFIXES.en;
  
  // Find all base keys that should have plural forms
  const pluralBaseKeys = new Set();
  Object.keys(referenceTranslations).forEach(key => {
    expectedSuffixes.forEach(suffix => {
      if (key.endsWith(suffix)) {
        pluralBaseKeys.add(key.substring(0, key.length - suffix.length));
      }
    });
  });
  
  // Check each plural base key
  pluralBaseKeys.forEach(baseKey => {
    const missingForms = [];
    expectedSuffixes.forEach(suffix => {
      const fullKey = baseKey + suffix;
      if (!translations[fullKey] && referenceTranslations[fullKey]) {
        missingForms.push(suffix);
      }
    });
    
    if (missingForms.length > 0) {
      issues.push({
        type: 'missing_plural_forms',
        locale,
        key: `${namespace}.${baseKey}`,
        message: `Missing plural forms: ${missingForms.join(', ')}`,
        severity: 'error'
      });
    }
  });
}

// Validate context variations
function validateContextVariations(namespace, translations, locale, referenceTranslations, issues) {
  const contextSuffixes = ['_male', '_female', '_neutral', '_formal', '_informal'];
  
  // Find all base keys that have context variations
  const contextBaseKeys = new Set();
  Object.keys(referenceTranslations).forEach(key => {
    contextSuffixes.forEach(suffix => {
      if (key.endsWith(suffix)) {
        contextBaseKeys.add(key.substring(0, key.length - suffix.length));
      }
    });
  });
  
  // Check each context base key
  contextBaseKeys.forEach(baseKey => {
    const refContexts = contextSuffixes.filter(suffix => 
      referenceTranslations[baseKey + suffix]
    );
    const localeContexts = contextSuffixes.filter(suffix => 
      translations[baseKey + suffix]
    );
    
    const missingContexts = refContexts.filter(ctx => !localeContexts.includes(ctx));
    
    if (missingContexts.length > 0) {
      issues.push({
        type: 'missing_context_variations',
        locale,
        key: `${namespace}.${baseKey}`,
        message: `Missing context variations: ${missingContexts.join(', ')}`,
        severity: 'warning'
      });
    }
  });
}

// Validate translations for a namespace
function validateNamespace(namespace, namespaceData, locale, referenceData, issues) {
  const referenceNamespace = referenceData[namespace] || {};
  
  // Check for missing keys
  Object.keys(referenceNamespace).forEach(key => {
    if (!namespaceData[key]) {
      issues.push({
        type: 'missing_translation',
        locale,
        key: `${namespace}.${key}`,
        message: 'Translation missing',
        severity: 'error'
      });
    } else {
      validateTranslationValue(
        key, 
        namespaceData[key], 
        referenceNamespace[key], 
        locale, 
        namespace, 
        issues
      );
    }
  });
  
  // Check for extra keys
  Object.keys(namespaceData).forEach(key => {
    if (!referenceNamespace[key]) {
      issues.push({
        type: 'extra_translation',
        locale,
        key: `${namespace}.${key}`,
        message: 'Translation exists but not in reference locale',
        severity: 'warning'
      });
    }
  });
  
  // Validate plural forms
  if (VALIDATION_RULES.checkPluralForms) {
    validatePluralForms(namespace, namespaceData, locale, referenceNamespace, issues);
  }
  
  // Validate context variations
  if (VALIDATION_RULES.checkContextVariations) {
    validateContextVariations(namespace, namespaceData, locale, referenceNamespace, issues);
  }
}

// Generate validation report
function generateReport(issues) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: issues.length,
      byType: {},
      byLocale: {},
      bySeverity: {
        error: 0,
        warning: 0,
        info: 0
      }
    },
    issues: issues
  };
  
  // Count issues by type, locale, and severity
  issues.forEach(issue => {
    // By type
    report.summary.byType[issue.type] = (report.summary.byType[issue.type] || 0) + 1;
    
    // By locale
    report.summary.byLocale[issue.locale] = (report.summary.byLocale[issue.locale] || 0) + 1;
    
    // By severity
    report.summary.bySeverity[issue.severity]++;
  });
  
  return report;
}

// Main validation function
async function main() {
  try {
    console.log('🔍 Starting translation validation...\n');
    
    // Read all translations
    const translations = await readTranslations();
    const referenceTranslations = translations[REFERENCE_LOCALE];
    
    if (!referenceTranslations || Object.keys(referenceTranslations).length === 0) {
      console.error(`❌ Reference locale (${REFERENCE_LOCALE}) has no translations!`);
      process.exit(1);
    }
    
    const issues = [];
    
    // Validate each locale
    LOCALES.forEach(locale => {
      if (locale === REFERENCE_LOCALE) return;
      
      const localeTranslations = translations[locale] || {};
      
      // Validate each namespace
      Object.keys(referenceTranslations).forEach(namespace => {
        const namespaceData = localeTranslations[namespace] || {};
        validateNamespace(namespace, namespaceData, locale, referenceTranslations, issues);
      });
      
      // Check for extra namespaces
      Object.keys(localeTranslations).forEach(namespace => {
        if (!referenceTranslations[namespace]) {
          issues.push({
            type: 'extra_namespace',
            locale,
            key: namespace,
            message: 'Namespace exists but not in reference locale',
            severity: 'warning'
          });
        }
      });
    });
    
    // Generate report
    const report = generateReport(issues);
    
    // Save report
    const outputDir = path.join(ROOT_DIR, 'src/i18n/reports');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, 'validation-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Print summary
    console.log('📊 Validation Summary:');
    console.log(`   Total issues: ${report.summary.totalIssues}`);
    console.log(`   Errors: ${report.summary.bySeverity.error}`);
    console.log(`   Warnings: ${report.summary.bySeverity.warning}`);
    console.log(`   Info: ${report.summary.bySeverity.info}\n`);
    
    // Print issues by type
    console.log('📋 Issues by Type:');
    Object.entries(report.summary.byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    // Print issues by locale
    console.log('\n🌍 Issues by Locale:');
    Object.entries(report.summary.byLocale).forEach(([locale, count]) => {
      console.log(`   ${locale}: ${count}`);
    });
    
    console.log('\n✅ Validation complete! Report saved to src/i18n/reports/validation-report.json');
    
    // Exit with error code if there are errors
    if (report.summary.bySeverity.error > 0) {
      console.log('\n❌ Validation failed with errors!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}