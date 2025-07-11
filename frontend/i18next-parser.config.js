module.exports = {
  // Define namespaces
  defaultNamespace: 'common',
  namespaceSeparator: ':',
  keySeparator: '.',
  
  // Locales to manage
  locales: ['en', 'cs', 'ar'],
  
  // Source files to scan
  input: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/i18n/**/*'
  ],
  
  // Output directory
  output: 'src/i18n/locales/extracted/$LOCALE/$NAMESPACE.json',
  
  // Parser options
  lexers: {
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
    default: ['JavascriptLexer']
  },
  
  // Function names to extract from
  funcList: [
    't',
    'i18next.t',
    'i18n.t',
    'useTranslation',
    'withTranslation',
    'Trans',
    'Translation'
  ],
  
  // Keep existing translations
  keepRemoved: false,
  
  // Sort keys
  sort: true,
  
  // Skip default values
  skipDefaultValue: false,
  
  // Resource structure
  resource: {
    loadPath: 'src/i18n/locales/{{lng}}.ts',
    savePath: 'src/i18n/locales/extracted/{{lng}}/{{ns}}.json',
    jsonIndent: 2,
    lineEnding: '\n'
  },
  
  // Context handling
  context: true,
  contextFallback: true,
  contextDefaultValues: [],
  contextSeparator: '_',
  
  // Plural handling
  plural: true,
  pluralFallback: true,
  pluralSeparator: '_',
  
  // Interpolation
  interpolation: {
    prefix: '{{',
    suffix: '}}'
  },
  
  // Namespace extraction from code
  nsSeparator: ':',
  
  // Default values
  defaultValue: function (locale, namespace, key) {
    return key;
  },
  
  // Custom transform function to handle TypeScript imports
  customValueTemplate: null,
  
  // Fail on missing keys
  failOnWarnings: false,
  
  // Verbose output
  verbose: false,
  
  // Custom regex for trans components
  trans: {
    component: 'Trans',
    i18nKey: 'i18nKey',
    defaultsKey: 'defaults',
    extensions: ['.ts', '.tsx'],
    fallbackKey: function (ns, value) {
      return value;
    }
  },
  
  // Parser options
  js: {
    lexer: 'JavascriptLexer',
    functions: ['t', 'i18next.t', 'i18n.t']
  },
  
  jsx: {
    lexer: 'JsxLexer',
    attr: 'i18nKey'
  }
};