# Translation Management Scripts

This directory contains scripts for managing translations in the Jidelnicek application.

## Available Scripts

### Extract Translation Keys
```bash
npm run i18n:extract
```
Scans all TypeScript and TSX files to find translation keys used in the codebase. Generates reports showing:
- All translation keys found
- Missing translations per locale
- Unused translations
- Key usage mapping (which files use which keys)

### Validate Translations
```bash
npm run i18n:validate
```
Validates all translation files for:
- Missing interpolation variables
- HTML consistency
- Whitespace issues
- Punctuation consistency
- Missing plural forms
- Missing context variations
- Empty values

### Sync Translations
```bash
npm run i18n:sync
# or non-interactive mode:
npm run i18n:sync:auto
```
Synchronizes translations between locales:
- Adds missing keys from reference locale (en)
- Optionally removes extra keys
- Updates empty translations with placeholders
- Interactive mode asks for confirmation

Options:
- `--no-add`: Don't add missing keys
- `--remove-extra`: Remove keys not in reference locale
- `--no-update-empty`: Don't update empty values
- `--non-interactive`: Run without user prompts

### Generate TypeScript Types
```bash
npm run i18n:types
```
Generates TypeScript types from the reference locale translations:
- Translation key types
- Namespace types
- Plural key types
- Interface definitions for all translation objects

### Translation Coverage Report
```bash
npm run i18n:coverage
```
Generates comprehensive coverage reports:
- Coverage percentage per locale and namespace
- List of missing translations
- List of unused translations
- Markdown report for documentation

### Quick Commands

Check translations (extract + validate):
```bash
npm run i18n:check
```

Update translations (extract + sync + generate types):
```bash
npm run i18n:update
```

### i18next Parser (Alternative)
```bash
npm run i18n:parser
```
Uses i18next-parser for extraction (configured in `i18next-parser.config.js`)

## Reports

All reports are saved to `src/i18n/reports/`:
- `extraction-report.json` - Key extraction results
- `key-usage.json` - Which files use which keys
- `validation-report.json` - Validation issues
- `sync-report.json` - Synchronization changes
- `coverage-report.json` - Translation coverage statistics
- `coverage-report.md` - Markdown coverage report

## Workflow

### For Developers

1. After adding new translation keys in code:
   ```bash
   npm run i18n:update
   ```

2. To check for issues:
   ```bash
   npm run i18n:check
   ```

### For Translators

1. Export translations for a locale:
   ```javascript
   import management from './src/i18n/management';
   await management.exportForTranslators('cs', 'json');
   ```

2. Import completed translations:
   ```javascript
   import management from './src/i18n/management';
   await management.importFromTranslators('./translations-cs.json', 'cs');
   ```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Check translations
  run: |
    npm run i18n:extract
    npm run i18n:validate
```

The validate script will exit with code 1 if there are errors.

## Configuration

### Supported Locales
- `en` - English (reference locale)
- `cs` - Czech
- `ar` - Arabic

### File Structure
```
src/i18n/
├── locales/
│   ├── en.ts          # Reference translations
│   ├── cs.ts          # Czech translations
│   └── ar.ts          # Arabic translations
├── scripts/           # Management scripts
├── reports/          # Generated reports
└── management/       # Translation utilities
```

## Tips

1. **Always run extraction before validation** to ensure reports are up-to-date
2. **Use the reference locale (en) as the source of truth** for all keys
3. **Add placeholders for translators** using `[LOCALE]` prefix
4. **Review sync changes** before applying in production
5. **Keep plural forms consistent** across locales