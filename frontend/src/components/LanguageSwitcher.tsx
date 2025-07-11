import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, Globe, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { languages, changeLanguage, getCurrentLanguage, type LanguageCode } from '@/i18n'

export type LanguageSwitcherMode = 'dropdown' | 'inline' | 'icon-only' | 'expanded' | 'select'

export interface LanguageSwitcherProps {
  /**
   * Display mode of the language switcher
   * @default 'dropdown'
   */
  mode?: LanguageSwitcherMode
  
  /**
   * Size variant of the switcher
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg'
  
  /**
   * Additional CSS classes
   */
  className?: string
  
  /**
   * Show language name alongside flag
   * @default true (except in icon-only mode)
   */
  showName?: boolean
  
  /**
   * Show flag icon
   * @default true
   */
  showFlag?: boolean
  
  /**
   * Custom icon to use instead of default
   */
  customIcon?: React.ReactNode
  
  /**
   * Callback when language is changed
   */
  onLanguageChange?: (language: LanguageCode) => void
  
  /**
   * Button variant (for dropdown and icon-only modes)
   * @default 'outline'
   */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
}

export function LanguageSwitcher({
  mode = 'dropdown',
  size = 'default',
  className,
  showName = true,
  showFlag = true,
  customIcon,
  onLanguageChange,
  variant = 'outline',
}: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)
  const currentLang = getCurrentLanguage()
  
  const handleLanguageChange = React.useCallback((langCode: LanguageCode) => {
    changeLanguage(langCode)
    onLanguageChange?.(langCode)
    setIsOpen(false)
  }, [onLanguageChange])
  
  // Size configurations
  const sizeConfig = {
    sm: {
      button: 'h-8 text-xs',
      icon: 'h-3.5 w-3.5',
      flag: 'text-sm',
      gap: 'gap-1.5',
      padding: 'px-2 py-1',
    },
    default: {
      button: 'h-10 text-sm',
      icon: 'h-4 w-4',
      flag: 'text-base',
      gap: 'gap-2',
      padding: 'px-3 py-1.5',
    },
    lg: {
      button: 'h-12 text-base',
      icon: 'h-5 w-5',
      flag: 'text-lg',
      gap: 'gap-3',
      padding: 'px-4 py-2',
    },
  }
  
  const config = sizeConfig[size]
  
  // Helper to render language option
  const renderLanguageOption = (lang: typeof languages[LanguageCode], isSelected: boolean) => {
    const showNameInMode = mode !== 'icon-only' && showName
    
    return (
      <span className={cn('flex items-center', config.gap)}>
        {showFlag && (
          <span className={config.flag} role="img" aria-label={`${lang.name} flag`}>
            {lang.flag}
          </span>
        )}
        {showNameInMode && (
          <span className="flex-1">{lang.nativeName}</span>
        )}
        {isSelected && mode === 'expanded' && (
          <Check className={cn(config.icon, 'text-primary-600 ml-auto')} />
        )}
      </span>
    )
  }
  
  // Dropdown mode (default)
  if (mode === 'dropdown') {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn('flex items-center', config.gap, className)}
            aria-label={`Language: ${currentLang.nativeName}`}
          >
            {customIcon || <Globe className={config.icon} />}
            {renderLanguageOption(currentLang, false)}
            <ChevronDown className={cn(config.icon, 'ml-auto opacity-50')} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          {Object.entries(languages).map(([code, lang]) => (
            <DropdownMenuItem
              key={code}
              onClick={() => handleLanguageChange(code as LanguageCode)}
              className={cn(
                'cursor-pointer',
                currentLang.code === code && 'bg-accent'
              )}
            >
              {renderLanguageOption(lang, currentLang.code === code)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  
  // Select mode (native-like select)
  if (mode === 'select') {
    return (
      <Select
        value={currentLang.code}
        onValueChange={(value) => handleLanguageChange(value as LanguageCode)}
      >
        <SelectTrigger 
          className={cn(config.button, className)}
          aria-label={`Language: ${currentLang.nativeName}`}
        >
          <SelectValue>
            {renderLanguageOption(currentLang, false)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(languages).map(([code, lang]) => (
            <SelectItem key={code} value={code}>
              {renderLanguageOption(lang, false)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  
  // Inline button mode
  if (mode === 'inline') {
    return (
      <div className={cn('flex items-center', config.gap, className)} role="group" aria-label="Language selection">
        {Object.entries(languages).map(([code, lang]) => {
          const isSelected = currentLang.code === code
          return (
            <Button
              key={code}
              variant={isSelected ? 'default' : 'ghost'}
              size={size}
              onClick={() => handleLanguageChange(code as LanguageCode)}
              className={cn(
                'transition-all',
                isSelected && 'shadow-sm'
              )}
              aria-pressed={isSelected}
              aria-label={`Switch to ${lang.nativeName}`}
            >
              {renderLanguageOption(lang, false)}
            </Button>
          )
        })}
      </div>
    )
  }
  
  // Icon-only mode
  if (mode === 'icon-only') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            className={cn(config.button, 'w-auto aspect-square', className)}
            aria-label={`Language: ${currentLang.nativeName}`}
          >
            {customIcon || showFlag ? (
              <span className={config.flag} role="img" aria-label={`${currentLang.name} flag`}>
                {currentLang.flag}
              </span>
            ) : (
              <Languages className={config.icon} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end">
          <div className="grid gap-1">
            {Object.entries(languages).map(([code, lang]) => {
              const isSelected = currentLang.code === code
              return (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code as LanguageCode)}
                  className={cn(
                    'flex items-center w-full rounded-sm',
                    config.padding,
                    config.gap,
                    'text-left hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                    'transition-colors',
                    isSelected && 'bg-accent text-accent-foreground'
                  )}
                  aria-pressed={isSelected}
                >
                  {renderLanguageOption(lang, isSelected)}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    )
  }
  
  // Expanded list mode
  if (mode === 'expanded') {
    return (
      <div 
        className={cn('space-y-1', className)} 
        role="radiogroup" 
        aria-label="Language selection"
      >
        <AnimatePresence mode="wait">
          {Object.entries(languages).map(([code, lang]) => {
            const isSelected = currentLang.code === code
            return (
              <motion.button
                key={code}
                onClick={() => handleLanguageChange(code as LanguageCode)}
                className={cn(
                  'flex items-center w-full rounded-lg',
                  config.padding,
                  config.gap,
                  'text-left transition-all duration-200',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                  'focus:ring-2 focus:ring-focus-ring focus:ring-offset-2',
                  isSelected && 'bg-primary-50 text-primary-900 dark:bg-primary-900/20 dark:text-primary-100'
                )}
                role="radio"
                aria-checked={isSelected}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
              >
                {renderLanguageOption(lang, isSelected)}
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    )
  }
  
  return null
}

// Compact variant for headers/navbars
export function LanguageSwitcherCompact(props: Omit<LanguageSwitcherProps, 'mode' | 'size'>) {
  return <LanguageSwitcher {...props} mode="icon-only" size="sm" />
}

// Desktop variant with full features
export function LanguageSwitcherDesktop(props: Omit<LanguageSwitcherProps, 'mode'>) {
  return <LanguageSwitcher {...props} mode="dropdown" />
}