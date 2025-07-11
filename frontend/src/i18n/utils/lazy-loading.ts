import type { Namespace } from '../types'

// Cache for loaded namespaces
const loadedNamespaces = new Map<string, Set<Namespace>>()

// Namespace loaders
const namespaceLoaders: Record<Namespace, () => Promise<any>> = {
  common: () => import('../locales/namespaces/common'),
  auth: () => import('../locales/namespaces/auth'),
  recipes: () => import('../locales/namespaces/recipes'),
  trips: () => import('../locales/namespaces/trips'),
  admin: () => import('../locales/namespaces/admin'),
  validation: () => import('../locales/namespaces/validation'),
  errors: () => import('../locales/namespaces/errors')
}

// Load a namespace for a specific language
export async function loadNamespace(
  language: string, 
  namespace: Namespace
): Promise<any> {
  const cacheKey = `${language}-${namespace}`
  
  // Check if already loaded
  const langCache = loadedNamespaces.get(language) || new Set()
  if (langCache.has(namespace)) {
    return null // Already loaded
  }
  
  try {
    // Load the namespace module
    const module = await namespaceLoaders[namespace]()
    const translations = module.default || module
    
    // Mark as loaded
    langCache.add(namespace)
    loadedNamespaces.set(language, langCache)
    
    // Return translations for the specific language
    return translations[language] || translations
  } catch (error) {
    console.error(`Failed to load namespace ${namespace} for language ${language}:`, error)
    throw error
  }
}

// Load multiple namespaces
export async function loadNamespaces(
  language: string,
  namespaces: Namespace[]
): Promise<Record<Namespace, any>> {
  const results = await Promise.allSettled(
    namespaces.map(ns => loadNamespace(language, ns))
  )
  
  const loaded: Record<string, any> = {}
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      loaded[namespaces[index]] = result.value
    }
  })
  
  return loaded
}

// Preload namespaces (useful for critical paths)
export async function preloadNamespaces(
  language: string,
  namespaces: Namespace[]
): Promise<void> {
  await loadNamespaces(language, namespaces)
}

// Check if a namespace is loaded
export function isNamespaceLoaded(
  language: string,
  namespace: Namespace
): boolean {
  const langCache = loadedNamespaces.get(language)
  return langCache?.has(namespace) || false
}

// Get all loaded namespaces for a language
export function getLoadedNamespaces(language: string): Namespace[] {
  const langCache = loadedNamespaces.get(language)
  return langCache ? Array.from(langCache) : []
}

// Clear namespace cache (useful for testing or language switching)
export function clearNamespaceCache(language?: string): void {
  if (language) {
    loadedNamespaces.delete(language)
  } else {
    loadedNamespaces.clear()
  }
}

// Create a namespace loader for i18next backend
export function createNamespaceBackend() {
  return {
    type: 'backend',
    
    init(services: any, backendOptions: any, i18nextOptions: any) {
      // Initialization if needed
    },
    
    read(language: string, namespace: string, callback: Function) {
      loadNamespace(language, namespace as Namespace)
        .then(resources => {
          callback(null, resources)
        })
        .catch(error => {
          callback(error, null)
        })
    },
    
    // Create method for adding new translations (optional)
    create(languages: string[], namespace: string, key: string, fallbackValue: string) {
      // This would typically save to a backend
      console.log('Create translation:', { languages, namespace, key, fallbackValue })
    },
    
    // Save method for persisting translations (optional)
    save(language: string, namespace: string, data: any) {
      // This would typically save to a backend
      console.log('Save translations:', { language, namespace, data })
    }
  }
}

// Webpack magic comments for better chunk naming
export function getNamespaceChunkName(namespace: Namespace): string {
  return `i18n-namespace-${namespace}`
}

// Helper to dynamically import with chunk naming
export async function importNamespace(
  namespace: Namespace,
  language: string
): Promise<any> {
  switch (namespace) {
    case 'common':
      return import(
        /* webpackChunkName: "i18n-common" */
        `../locales/namespaces/common/${language}`
      )
    case 'auth':
      return import(
        /* webpackChunkName: "i18n-auth" */
        `../locales/namespaces/auth/${language}`
      )
    case 'recipes':
      return import(
        /* webpackChunkName: "i18n-recipes" */
        `../locales/namespaces/recipes/${language}`
      )
    case 'trips':
      return import(
        /* webpackChunkName: "i18n-trips" */
        `../locales/namespaces/trips/${language}`
      )
    case 'admin':
      return import(
        /* webpackChunkName: "i18n-admin" */
        `../locales/namespaces/admin/${language}`
      )
    case 'validation':
      return import(
        /* webpackChunkName: "i18n-validation" */
        `../locales/namespaces/validation/${language}`
      )
    case 'errors':
      return import(
        /* webpackChunkName: "i18n-errors" */
        `../locales/namespaces/errors/${language}`
      )
    default:
      throw new Error(`Unknown namespace: ${namespace}`)
  }
}