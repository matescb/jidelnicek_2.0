# Translation Management System

This document describes the comprehensive translation management system for the Jidelnicek application.

## Overview

The translation management system provides:
- **Automated key extraction** from TypeScript/React code
- **Translation validation** with comprehensive checks
- **Synchronization** between locales
- **TypeScript type generation** for type-safe translations
- **Coverage reporting** and analytics
- **Import/Export** for professional translators
- **CI/CD integration** for quality assurance

## Quick Start

### For Developers

1. **After adding new translation keys:**
   ```bash
   npm run i18n:update
   ```
   This will extract keys, sync translations, and generate types.

2. **Check translation status:**
   ```bash
   npm run i18n:check
   ```

3. **View detailed reports:**
   ```bash
   npm run i18n:cli coverage
   npm run i18n:cli missing
   ```

### For Translators

1. **Export translations:**
   ```bash
   npm run i18n:cli export cs
   ```

2. **Import completed translations:**
   ```bash
   npm run i18n:cli import ./cs-translations.json cs
   ```

## Architecture

### File Structure
```
frontend/src/i18n/
├── locales/                    # Translation files
│   ├── en.ts                  # Reference locale (English)
│   ├── cs.ts                  # Czech translations
│   └── ar.ts                  # Arabic translations
├── scripts/                   # Management scripts
│   ├── extract-keys.js        # Key extraction
│   ├── validate-translations.js # Validation
│   ├── sync-translations.js   # Synchronization
│   ├── generate-types.js      # Type generation
│   └── cli.js                # CLI interface
├── management/               # Core utilities
│   └── index.ts             # Management API
├── reports/                 # Generated reports
│   ├── extraction-report.json
│   ├── validation-report.json
│   ├── coverage-report.md
│   └── exports/            # Translation exports
└── types.generated.ts      # Auto-generated types
```

### Configuration Files
- `i18next-parser.config.js` - i18next parser configuration
- `package.json` - NPM scripts for translation management

## Features

### 1. Key Extraction

The extraction script scans all TypeScript and React files for translation usage:

```javascript
// Detected patterns:
t('key')
t('namespace:key')
useTranslation('namespace')
<Trans i18nKey="key">
<T key="key" />
```

**Reports generated:**
- `extraction-report.json` - All keys found, missing translations, unused translations
- `key-usage.json` - Which files use which translation keys

### 2. Translation Validation

Comprehensive validation checks:
- ✅ Missing interpolation variables (`{{variable}}`)
- ✅ HTML consistency between locales
- ✅ Whitespace issues (leading/trailing)
- ✅ Punctuation consistency
- ✅ Missing plural forms
- ✅ Missing context variations
- ✅ Empty translation values

### 3. Synchronization

Keeps all locales in sync with the reference locale:
- Adds missing keys with placeholders
- Optionally removes extra keys
- Updates empty values
- Interactive or automated modes

### 4. Type Generation

Generates TypeScript types from translations:
```typescript
// Auto-generated types
export type TranslationKey = 
  'auth.login' |
  'auth.register' |
  'recipes.title' |
  // ... all keys

export interface Translations {
  auth: {
    login: string;
    register: string;
    // ...
  };
  // ...
}
```

### 5. Coverage Reporting

Detailed coverage analysis:
- Overall translation coverage percentage
- Coverage by locale and namespace
- List of missing translations
- List of unused translations
- Markdown reports for documentation

## npm Scripts

### Core Scripts
```bash
# Extract translation keys from code
npm run i18n:extract

# Validate all translations
npm run i18n:validate

# Sync translations between locales
npm run i18n:sync          # Interactive
npm run i18n:sync:auto     # Non-interactive

# Generate TypeScript types
npm run i18n:types

# Generate coverage report
npm run i18n:coverage
```

### Convenience Scripts
```bash
# Check translations (extract + validate)
npm run i18n:check

# Update translations (extract + sync + types)
npm run i18n:update

# CLI interface
npm run i18n:cli <command>
```

### Alternative Parser
```bash
# Use i18next-parser
npm run i18n:parser
```

## CI/CD Integration

The included GitHub Actions workflow (`.github/workflows/i18n-check.yml`):
1. Runs on PRs and pushes affecting translations
2. Extracts and validates translations
3. Checks for missing translations
4. Generates coverage reports
5. Comments on PRs with coverage information

## Best Practices

### 1. Translation Key Naming
```typescript
// Use dot notation for nested keys
t('recipes.title')
t('recipes.form.name')
t('recipes.messages.created')

// Use namespaces for feature separation
t('auth:login')
t('admin:dashboard.title')
```

### 2. Interpolation
```typescript
// Always use meaningful variable names
t('auth.passwordMin', { min: 8 })
t('recipes.showing', { count: 10, total: 50 })
```

### 3. Pluralization
```typescript
// Define all plural forms
en: {
  recipe_one: '{{count}} recipe',
  recipe_other: '{{count}} recipes'
}

cs: {
  recipe_one: '{{count}} recept',
  recipe_few: '{{count}} recepty',
  recipe_many: '{{count}} receptů'
}
```

### 4. Context Variations
```typescript
// Define context-specific translations
welcome_male: 'Welcome back, sir!',
welcome_female: 'Welcome back, madam!',
welcome_neutral: 'Welcome back!',
welcome_formal: 'Welcome back, esteemed user!',
welcome_informal: 'Hey, welcome back!'
```

## Workflow Examples

### Adding New Features
1. Implement feature with translation keys
2. Run `npm run i18n:update`
3. Review generated placeholders
4. Commit changes

### Preparing for Translation
1. Run `npm run i18n:cli export cs`
2. Send JSON file to translator
3. Receive completed translations
4. Run `npm run i18n:cli import translations.json cs`
5. Run `npm run i18n:validate`

### Quality Assurance
1. Before release: `npm run i18n:check`
2. Generate report: `npm run i18n:coverage`
3. Review missing translations
4. Fix any validation errors

## Troubleshooting

### Common Issues

**Issue: Scripts fail with module errors**
- Ensure `"type": "module"` is in package.json
- Use `.js` extension for ES modules

**Issue: Keys not being extracted**
- Check that files match scan patterns
- Verify translation function usage matches patterns
- Run with verbose mode for debugging

**Issue: Validation false positives**
- Review validation rules in `validate-translations.js`
- Consider context (e.g., some keys may not need punctuation)

**Issue: Type generation fails**
- Ensure reference locale has valid structure
- Check for syntax errors in translation files

## Advanced Usage

### Custom Validation Rules
Edit `scripts/validate-translations.js`:
```javascript
const VALIDATION_RULES = {
  checkInterpolations: true,
  checkHTML: true,
  checkWhitespace: true,
  checkPunctuation: false, // Disable
  // Add custom rules...
};
```

### Custom Export Formats
Use the management API:
```typescript
import management from './src/i18n/management';

// Export as CSV
await management.exportForTranslators('cs', 'csv');

// Custom processing
const missing = await management.findMissingTranslations();
// Process as needed...
```

### Integration with Translation Services
```typescript
// Example: Send to translation API
const exports = await management.exportForTranslators('cs');
await translationAPI.createJob(exports);

// Example: Import from translation API
const translations = await translationAPI.getCompletedJob();
await management.importFromTranslators(translations, 'cs');
```

## Future Enhancements

Planned improvements:
- [ ] XLIFF export format support
- [ ] Translation memory integration
- [ ] Real-time collaboration features
- [ ] Machine translation suggestions
- [ ] Visual translation editor
- [ ] Automated screenshot capture for context
- [ ] Translation quality scoring

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review script source code and comments
3. Run scripts with verbose/debug flags
4. Check generated reports for detailed information