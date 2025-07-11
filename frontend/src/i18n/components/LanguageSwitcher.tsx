import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { languages, type LanguageCode } from '../index.enhanced'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { CheckIcon } from '@heroicons/react/24/outline'

interface LanguageSwitcherProps {
  className?: string
  showFlag?: boolean
  showName?: boolean
  showNativeName?: boolean
  variant?: 'dropdown' | 'inline' | 'modal'
  onLanguageChange?: (language: LanguageCode) => void
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  showFlag = true,
  showName = false,
  showNativeName = true,
  variant = 'dropdown',
  onLanguageChange
}) => {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const currentLanguage = languages[i18n.language as LanguageCode] || languages.en
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleLanguageChange = async (langCode: LanguageCode) => {
    await i18n.changeLanguage(langCode)
    setIsOpen(false)
    onLanguageChange?.(langCode)
    
    // Update document attributes
    document.documentElement.lang = langCode
    document.documentElement.dir = languages[langCode].dir
  }
  
  if (variant === 'inline') {
    return (
      <div className={`flex gap-2 ${className}`}>
        {Object.entries(languages).map(([code, lang]) => (
          <button
            key={code}
            onClick={() => handleLanguageChange(code as LanguageCode)}
            className={`
              px-3 py-1 rounded-md text-sm font-medium transition-colors
              ${i18n.language === code
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }
            `}
            aria-label={`Switch to ${lang.name}`}
          >
            {showFlag && <span className="mr-1">{lang.flag}</span>}
            {showNativeName ? lang.nativeName : lang.name}
          </button>
        ))}
      </div>
    )
  }
  
  if (variant === 'modal') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-md
            bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
            transition-colors ${className}
          `}
          aria-label="Change language"
        >
          {showFlag && <span className="text-lg">{currentLanguage.flag}</span>}
          <span className="text-sm font-medium">
            {showNativeName ? currentLanguage.nativeName : currentLanguage.name}
          </span>
        </button>
        
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Select Language
              </h2>
              <div className="space-y-2">
                {Object.entries(languages).map(([code, lang]) => (
                  <button
                    key={code}
                    onClick={() => handleLanguageChange(code as LanguageCode)}
                    className={`
                      w-full flex items-center justify-between p-3 rounded-lg
                      transition-colors text-left
                      ${i18n.language === code
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{lang.flag}</span>
                      <div>
                        <div className="font-medium">{lang.nativeName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {lang.name}
                        </div>
                      </div>
                    </div>
                    {i18n.language === code && (
                      <CheckIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    )
  }
  
  // Default dropdown variant
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-2 rounded-md
          bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
          transition-colors
        "
        aria-label="Change language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {showFlag && <span className="text-lg">{currentLanguage.flag}</span>}
        {(showName || showNativeName) && (
          <span className="text-sm font-medium">
            {showNativeName ? currentLanguage.nativeName : currentLanguage.name}
          </span>
        )}
        <ChevronDownIcon 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      
      {isOpen && (
        <div className="
          absolute right-0 mt-2 w-48 rounded-md shadow-lg
          bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5
          z-50
        ">
          <div className="py-1" role="listbox">
            {Object.entries(languages).map(([code, lang]) => (
              <button
                key={code}
                onClick={() => handleLanguageChange(code as LanguageCode)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2 text-sm
                  transition-colors text-left
                  ${i18n.language === code
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                role="option"
                aria-selected={i18n.language === code}
              >
                {showFlag && <span className="text-lg">{lang.flag}</span>}
                <span className="flex-1">
                  {showNativeName ? lang.nativeName : lang.name}
                </span>
                {i18n.language === code && (
                  <CheckIcon className="w-4 h-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Compact language switcher for mobile
export const CompactLanguageSwitcher: React.FC<{
  className?: string
}> = ({ className = '' }) => {
  const { i18n } = useTranslation()
  const currentLanguage = languages[i18n.language as LanguageCode] || languages.en
  
  const availableLanguages = Object.entries(languages).filter(
    ([code]) => code !== i18n.language
  )
  
  const handleToggle = async () => {
    // Simple toggle between available languages
    const nextLang = availableLanguages[0][0] as LanguageCode
    await i18n.changeLanguage(nextLang)
    document.documentElement.lang = nextLang
    document.documentElement.dir = languages[nextLang].dir
  }
  
  return (
    <button
      onClick={handleToggle}
      className={`
        flex items-center justify-center w-10 h-10 rounded-full
        bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
        transition-colors ${className}
      `}
      aria-label={`Current language: ${currentLanguage.name}. Click to switch.`}
    >
      <span className="text-lg">{currentLanguage.flag}</span>
    </button>
  )
}