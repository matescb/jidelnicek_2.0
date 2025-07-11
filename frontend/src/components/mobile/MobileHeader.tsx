import React, { useEffect, useState, useRef } from 'react'
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion'
import { ChevronLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface MobileHeaderProps {
  title: string
  largeTitle?: boolean
  onBack?: () => void
  actions?: React.ReactNode
  searchable?: boolean
  onSearch?: (query: string) => void
  searchPlaceholder?: string
  transparent?: boolean
  blurBackground?: boolean
  className?: string
  children?: React.ReactNode
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  largeTitle = false,
  onBack,
  actions,
  searchable = false,
  onSearch,
  searchPlaceholder = 'Search...',
  transparent = false,
  blurBackground = true,
  className,
  children
}) => {
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const headerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  const { scrollY } = useScroll()
  const headerOpacity = useTransform(scrollY, [0, 50], [transparent ? 0 : 1, 1])
  const titleScale = useTransform(scrollY, [0, 50], [1.5, 1])
  const titleY = useTransform(scrollY, [0, 50], [20, 0])

  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchActive])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.(searchQuery)
  }

  const handleSearchToggle = () => {
    setIsSearchActive(!isSearchActive)
    if (isSearchActive) {
      setSearchQuery('')
      onSearch?.('')
    }
  }

  return (
    <>
      {/* Fixed header */}
      <motion.header
        ref={headerRef}
        style={{
          backgroundColor: transparent ? 'transparent' : undefined,
          backdropFilter: blurBackground ? 'blur(10px)' : undefined,
          WebkitBackdropFilter: blurBackground ? 'blur(10px)' : undefined
        }}
        className={clsx(
          'fixed top-0 left-0 right-0 z-40',
          'safe-area-top',
          !transparent && 'bg-white/90 dark:bg-gray-900/90',
          'border-b border-gray-200/50 dark:border-gray-700/50',
          className
        )}
      >
        <motion.div
          style={{ opacity: headerOpacity }}
          className="absolute inset-0 bg-white dark:bg-gray-900"
        />

        <div className="relative">
          {/* Main header content */}
          <div className="flex items-center justify-between px-4 h-14">
            {/* Left side */}
            <div className="flex items-center">
              {onBack && (
                <button
                  onClick={onBack}
                  className={clsx(
                    'p-2 -ml-2 rounded-lg',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    'transition-colors'
                  )}
                  aria-label="Go back"
                >
                  <ChevronLeftIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </button>
              )}

              {/* Regular title (shown when not using large title or when scrolled) */}
              {!largeTitle && (
                <h1 className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h1>
              )}
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-2">
              {searchable && (
                <button
                  onClick={handleSearchToggle}
                  className={clsx(
                    'p-2 rounded-lg',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    'transition-colors'
                  )}
                  aria-label="Search"
                >
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              )}
              {actions}
            </div>
          </div>

          {/* Search bar */}
          <motion.div
            initial={false}
            animate={{
              height: isSearchActive ? 'auto' : 0,
              opacity: isSearchActive ? 1 : 0
            }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSearchSubmit} className="px-4 pb-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={clsx(
                    'w-full pl-10 pr-4 py-2',
                    'bg-gray-100 dark:bg-gray-800',
                    'rounded-lg',
                    'text-gray-900 dark:text-white',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500'
                  )}
                />
              </div>
            </form>
          </motion.div>

          {/* Additional content */}
          {children}
        </div>
      </motion.header>

      {/* Large title (shown below header when at top) */}
      {largeTitle && (
        <motion.div
          style={{
            scale: titleScale,
            y: titleY
          }}
          className="fixed top-14 left-0 right-0 z-30 safe-area-top"
        >
          <div className="px-4 py-4 bg-white dark:bg-gray-900">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
          </div>
        </motion.div>
      )}

      {/* Spacer */}
      <div className={clsx('h-14 safe-area-top', largeTitle && 'h-28')} />
    </>
  )
}

// Simplified header variant
export const SimpleHeader: React.FC<{
  title: string
  onBack?: () => void
  actions?: React.ReactNode
}> = ({ title, onBack, actions }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 mr-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
        )}
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      {actions && <div className="flex items-center space-x-2">{actions}</div>}
    </div>
  )
}