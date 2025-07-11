import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { languages, changeLanguage, getCurrentLanguage, type LanguageCode } from '@/i18n'

export interface LanguageSwitcherMobileProps {
  /**
   * Trigger element variant
   * @default 'icon'
   */
  triggerVariant?: 'icon' | 'button' | 'text'
  
  /**
   * Additional CSS classes for the trigger
   */
  triggerClassName?: string
  
  /**
   * Additional CSS classes for the sheet content
   */
  contentClassName?: string
  
  /**
   * Show description text in the sheet
   * @default true
   */
  showDescription?: boolean
  
  /**
   * Custom trigger element
   */
  customTrigger?: React.ReactNode
  
  /**
   * Callback when language is changed
   */
  onLanguageChange?: (language: LanguageCode) => void
  
  /**
   * Sheet side
   * @default 'bottom'
   */
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function LanguageSwitcherMobile({
  triggerVariant = 'icon',
  triggerClassName,
  contentClassName,
  showDescription = true,
  customTrigger,
  onLanguageChange,
  side = 'bottom',
}: LanguageSwitcherMobileProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)
  const currentLang = getCurrentLanguage()
  
  const handleLanguageChange = React.useCallback((langCode: LanguageCode) => {
    changeLanguage(langCode)
    onLanguageChange?.(langCode)
    // Add a small delay before closing to show the selection
    setTimeout(() => setIsOpen(false), 300)
  }, [onLanguageChange])
  
  // Render trigger based on variant
  const renderTrigger = () => {
    if (customTrigger) {
      return customTrigger
    }
    
    switch (triggerVariant) {
      case 'icon':
        return (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-10 w-10', triggerClassName)}
            aria-label={`Language: ${currentLang.nativeName}`}
          >
            <Globe className="h-5 w-5" />
          </Button>
        )
      
      case 'button':
        return (
          <Button
            variant="outline"
            className={cn('gap-2', triggerClassName)}
            aria-label={`Language: ${currentLang.nativeName}`}
          >
            <span className="text-lg" role="img" aria-label={`${currentLang.name} flag`}>
              {currentLang.flag}
            </span>
            <span>{currentLang.nativeName}</span>
          </Button>
        )
      
      case 'text':
        return (
          <button
            className={cn(
              'flex items-center gap-2 text-sm font-medium',
              'hover:text-primary-600 transition-colors',
              triggerClassName
            )}
            aria-label={`Language: ${currentLang.nativeName}`}
          >
            <Globe className="h-4 w-4" />
            <span>{currentLang.code.toUpperCase()}</span>
          </button>
        )
      
      default:
        return null
    }
  }
  
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {renderTrigger()}
      </SheetTrigger>
      <SheetContent 
        side={side} 
        className={cn(
          side === 'bottom' && 'h-auto max-h-[80vh]',
          contentClassName
        )}
      >
        <SheetHeader className="text-left">
          <SheetTitle>{t('settings.language', 'Select Language')}</SheetTitle>
          {showDescription && (
            <SheetDescription>
              {t('settings.languageDescription', 'Choose your preferred language')}
            </SheetDescription>
          )}
        </SheetHeader>
        
        <div className="mt-6 space-y-2">
          <AnimatePresence mode="wait">
            {Object.entries(languages).map(([code, lang], index) => {
              const isSelected = currentLang.code === code
              return (
                <motion.button
                  key={code}
                  onClick={() => handleLanguageChange(code as LanguageCode)}
                  className={cn(
                    'flex items-center w-full rounded-lg px-4 py-3',
                    'text-left transition-all duration-200',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                    'focus:ring-2 focus:ring-focus-ring focus:ring-inset',
                    isSelected && 'bg-primary-50 text-primary-900 dark:bg-primary-900/20 dark:text-primary-100'
                  )}
                  role="radio"
                  aria-checked={isSelected}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ 
                    duration: 0.2,
                    delay: index * 0.05,
                    ease: 'easeOut'
                  }}
                >
                  <span className="text-2xl mr-3" role="img" aria-label={`${lang.name} flag`}>
                    {lang.flag}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{lang.nativeName}</div>
                    <div className="text-sm text-muted-foreground">{lang.name}</div>
                  </div>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <Check className="h-5 w-5 text-primary-600" />
                    </motion.div>
                  )}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Bottom sheet variant (most common for mobile)
export function LanguageSwitcherBottomSheet(props: Omit<LanguageSwitcherMobileProps, 'side'>) {
  return <LanguageSwitcherMobile {...props} side="bottom" />
}

// Full screen variant for settings pages
export function LanguageSwitcherFullScreen({
  onLanguageChange,
  onClose,
  isOpen = true,
}: {
  onLanguageChange?: (language: LanguageCode) => void
  onClose?: () => void
  isOpen?: boolean
}) {
  const { t } = useTranslation()
  const currentLang = getCurrentLanguage()
  
  const handleLanguageChange = React.useCallback((langCode: LanguageCode) => {
    changeLanguage(langCode)
    onLanguageChange?.(langCode)
    // Add haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50)
    }
    onClose?.()
  }, [onLanguageChange, onClose])
  
  if (!isOpen) return null
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">{t('settings.language', 'Language')}</h2>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('common.done', 'Done')}
            </Button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3 max-w-md mx-auto">
            {Object.entries(languages).map(([code, lang]) => {
              const isSelected = currentLang.code === code
              return (
                <motion.button
                  key={code}
                  onClick={() => handleLanguageChange(code as LanguageCode)}
                  className={cn(
                    'flex items-center w-full rounded-xl px-4 py-4',
                    'text-left transition-all duration-200',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                    'focus:ring-2 focus:ring-focus-ring focus:ring-inset',
                    'border-2',
                    isSelected 
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' 
                      : 'border-transparent'
                  )}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <span className="text-3xl mr-4" role="img" aria-label={`${lang.name} flag`}>
                    {lang.flag}
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{lang.nativeName}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{lang.name}</div>
                  </div>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="ml-4"
                    >
                      <div className="h-6 w-6 rounded-full bg-primary-600 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    </motion.div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}