import type { BackendConfig, Namespace } from '../types'

// Default backend configuration
const defaultConfig: BackendConfig = {
  apiUrl: '/api/translations',
  syncInterval: 300000, // 5 minutes
  cacheStrategy: 'localStorage'
}

// Backend client for dynamic translations
export class TranslationBackend {
  private config: BackendConfig
  private syncTimer?: number
  private cache: Map<string, any> = new Map()
  
  constructor(config?: Partial<BackendConfig>) {
    this.config = { ...defaultConfig, ...config }
    this.initializeCache()
  }
  
  // Initialize cache from storage
  private initializeCache(): void {
    if (this.config.cacheStrategy === 'localStorage' && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('jidelnicek-translations-cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          Object.entries(parsed).forEach(([key, value]) => {
            this.cache.set(key, value)
          })
        }
      } catch (error) {
        console.error('Failed to load translation cache:', error)
      }
    }
  }
  
  // Save cache to storage
  private saveCache(): void {
    if (this.config.cacheStrategy === 'localStorage' && typeof window !== 'undefined') {
      try {
        const cacheObj = Object.fromEntries(this.cache.entries())
        localStorage.setItem('jidelnicek-translations-cache', JSON.stringify(cacheObj))
      } catch (error) {
        console.error('Failed to save translation cache:', error)
      }
    }
  }
  
  // Fetch translations from backend
  async fetchTranslations(
    language: string, 
    namespace?: Namespace
  ): Promise<any> {
    const cacheKey = namespace ? `${language}-${namespace}` : language
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }
    
    try {
      const url = new URL(this.config.apiUrl)
      url.searchParams.append('language', language)
      if (namespace) {
        url.searchParams.append('namespace', namespace)
      }
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }
      
      const response = await fetch(url.toString(), { headers })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch translations: ${response.statusText}`)
      }
      
      const translations = await response.json()
      
      // Cache the result
      this.cache.set(cacheKey, translations)
      this.saveCache()
      
      return translations
    } catch (error) {
      console.error('Failed to fetch translations:', error)
      throw error
    }
  }
  
  // Push missing translations to backend
  async reportMissingTranslations(
    missing: Array<{
      key: string
      language: string
      namespace: string
      defaultValue?: string
    }>
  ): Promise<void> {
    try {
      const url = new URL(`${this.config.apiUrl}/missing`)
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ translations: missing })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to report missing translations: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to report missing translations:', error)
    }
  }
  
  // Update a translation
  async updateTranslation(
    language: string,
    namespace: string,
    key: string,
    value: string
  ): Promise<void> {
    try {
      const url = new URL(`${this.config.apiUrl}/update`)
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          language,
          namespace,
          key,
          value
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update translation: ${response.statusText}`)
      }
      
      // Invalidate cache
      const cacheKey = `${language}-${namespace}`
      this.cache.delete(cacheKey)
      this.cache.delete(language)
    } catch (error) {
      console.error('Failed to update translation:', error)
      throw error
    }
  }
  
  // Start syncing translations
  startSync(onUpdate?: (translations: any) => void): void {
    if (this.syncTimer) {
      return // Already syncing
    }
    
    const sync = async () => {
      try {
        // Fetch all translations
        const languages = ['en', 'cs'] // TODO: Get from config
        const updates = await Promise.all(
          languages.map(lang => this.fetchTranslations(lang))
        )
        
        if (onUpdate) {
          const translationMap = languages.reduce((acc, lang, index) => {
            acc[lang] = updates[index]
            return acc
          }, {} as Record<string, any>)
          
          onUpdate(translationMap)
        }
      } catch (error) {
        console.error('Translation sync failed:', error)
      }
    }
    
    // Initial sync
    sync()
    
    // Set up periodic sync
    if (this.config.syncInterval && this.config.syncInterval > 0) {
      this.syncTimer = window.setInterval(sync, this.config.syncInterval)
    }
  }
  
  // Stop syncing
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
    }
  }
  
  // Clear cache
  clearCache(): void {
    this.cache.clear()
    if (this.config.cacheStrategy === 'localStorage' && typeof window !== 'undefined') {
      localStorage.removeItem('jidelnicek-translations-cache')
    }
  }
  
  // Create i18next backend plugin
  createI18nextBackend() {
    const backend = this
    
    return {
      type: 'backend',
      
      init(services: any, backendOptions: any, i18nextOptions: any) {
        // Start syncing if configured
        if (backendOptions.autoSync) {
          backend.startSync()
        }
      },
      
      read(language: string, namespace: string, callback: Function) {
        backend.fetchTranslations(language, namespace as Namespace)
          .then(resources => {
            callback(null, resources)
          })
          .catch(error => {
            callback(error, null)
          })
      },
      
      create(languages: string[], namespace: string, key: string, fallbackValue: string) {
        // Report as missing translation
        const missing = languages.map(language => ({
          key,
          language,
          namespace,
          defaultValue: fallbackValue
        }))
        
        backend.reportMissingTranslations(missing)
      }
    }
  }
}

// Singleton instance
let backendInstance: TranslationBackend | null = null

// Get or create backend instance
export function getTranslationBackend(config?: Partial<BackendConfig>): TranslationBackend {
  if (!backendInstance) {
    backendInstance = new TranslationBackend(config)
  }
  return backendInstance
}

// Mock backend for development
export class MockTranslationBackend extends TranslationBackend {
  private mockData: Record<string, any> = {}
  
  constructor(config?: Partial<BackendConfig>) {
    super(config)
    this.initializeMockData()
  }
  
  private initializeMockData(): void {
    // Add some mock translations
    this.mockData = {
      'en-common': {
        welcome: 'Welcome',
        goodbye: 'Goodbye'
      },
      'cs-common': {
        welcome: 'Vítejte',
        goodbye: 'Nashledanou'
      }
    }
  }
  
  async fetchTranslations(language: string, namespace?: Namespace): Promise<any> {
    const key = namespace ? `${language}-${namespace}` : language
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return this.mockData[key] || {}
  }
  
  async reportMissingTranslations(missing: any[]): Promise<void> {
    console.log('Mock: Missing translations reported:', missing)
  }
  
  async updateTranslation(
    language: string,
    namespace: string,
    key: string,
    value: string
  ): Promise<void> {
    const cacheKey = `${language}-${namespace}`
    if (!this.mockData[cacheKey]) {
      this.mockData[cacheKey] = {}
    }
    this.mockData[cacheKey][key] = value
    console.log('Mock: Translation updated:', { language, namespace, key, value })
  }
}