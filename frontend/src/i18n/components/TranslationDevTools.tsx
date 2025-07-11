import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  getMissingTranslations, 
  clearMissingTranslations,
  exportMissingTranslations,
  generateMissingTranslationReport 
} from '../utils/missing-tracker'
import { validateTranslations, generateValidationReport } from '../utils/validation'
import type { MissingTranslation, Namespace } from '../types'

interface TranslationDevToolsProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  defaultOpen?: boolean
}

export const TranslationDevTools: React.FC<TranslationDevToolsProps> = ({
  position = 'bottom-right',
  defaultOpen = false
}) => {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<'missing' | 'validation' | 'tools'>('missing')
  const [missingTranslations, setMissingTranslations] = useState<MissingTranslation[]>([])
  const [validationReport, setValidationReport] = useState<string>('')
  
  useEffect(() => {
    // Update missing translations every 5 seconds
    const interval = setInterval(() => {
      setMissingTranslations(getMissingTranslations())
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])
  
  const handleValidate = () => {
    // This would need to be connected to your actual translation files
    const mockTranslations = {
      en: i18n.getResourceBundle('en', 'common'),
      cs: i18n.getResourceBundle('cs', 'common')
    }
    
    const result = validateTranslations(mockTranslations, ['common'] as Namespace[])
    setValidationReport(generateValidationReport(result))
  }
  
  const handleExportMissing = () => {
    const json = exportMissingTranslations()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'missing-translations.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const handleGenerateReport = () => {
    const report = generateMissingTranslationReport()
    const blob = new Blob([report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'missing-translations-report.md'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  }
  
  if (!import.meta.env.DEV) {
    return null // Only show in development
  }
  
  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="
            bg-indigo-600 text-white p-3 rounded-full shadow-lg
            hover:bg-indigo-700 transition-colors
          "
          aria-label="Open translation dev tools"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" 
            />
          </svg>
        </button>
      ) : (
        <div className="
          bg-white dark:bg-gray-800 rounded-lg shadow-xl
          w-96 max-h-[600px] overflow-hidden flex flex-col
        ">
          <div className="
            flex items-center justify-between p-4 border-b
            dark:border-gray-700
          ">
            <h3 className="text-lg font-semibold">Translation Dev Tools</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex border-b dark:border-gray-700">
            <button
              onClick={() => setActiveTab('missing')}
              className={`
                flex-1 px-4 py-2 text-sm font-medium
                ${activeTab === 'missing'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }
              `}
            >
              Missing ({missingTranslations.length})
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={`
                flex-1 px-4 py-2 text-sm font-medium
                ${activeTab === 'validation'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }
              `}
            >
              Validation
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`
                flex-1 px-4 py-2 text-sm font-medium
                ${activeTab === 'tools'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }
              `}
            >
              Tools
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'missing' && (
              <div className="space-y-2">
                {missingTranslations.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No missing translations found
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {missingTranslations.length} missing translations
                      </span>
                      <button
                        onClick={() => {
                          clearMissingTranslations()
                          setMissingTranslations([])
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Clear all
                      </button>
                    </div>
                    {missingTranslations.map((missing, index) => (
                      <div
                        key={index}
                        className="
                          bg-gray-50 dark:bg-gray-700 rounded p-3
                          text-sm space-y-1
                        "
                      >
                        <div className="font-mono text-xs">
                          {missing.language}/{missing.namespace}/{missing.key}
                        </div>
                        {missing.defaultValue && (
                          <div className="text-gray-600 dark:text-gray-400">
                            Default: {missing.defaultValue}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(missing.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            
            {activeTab === 'validation' && (
              <div className="space-y-4">
                <button
                  onClick={handleValidate}
                  className="
                    w-full px-4 py-2 bg-indigo-600 text-white rounded
                    hover:bg-indigo-700 transition-colors
                  "
                >
                  Run Validation
                </button>
                {validationReport && (
                  <div className="
                    bg-gray-50 dark:bg-gray-700 rounded p-3
                    text-sm whitespace-pre-wrap font-mono overflow-x-auto
                  ">
                    {validationReport}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'tools' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Current Language</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {i18n.language} ({i18n.languages.join(', ')})
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Loaded Namespaces</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {Object.keys(i18n.store.data[i18n.language] || {}).join(', ')}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <button
                    onClick={handleExportMissing}
                    className="
                      w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded
                      hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors
                    "
                  >
                    Export Missing Translations
                  </button>
                  
                  <button
                    onClick={handleGenerateReport}
                    className="
                      w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded
                      hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors
                    "
                  >
                    Generate Report
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('i18n instance:', i18n)
                      console.log('Store data:', i18n.store.data)
                      console.log('Options:', i18n.options)
                    }}
                    className="
                      w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded
                      hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors
                    "
                  >
                    Log Debug Info
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}