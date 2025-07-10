import React, { createContext, useContext, useState } from 'react'
import clsx from 'clsx'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, className, children }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={clsx('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  className?: string
  children: React.ReactNode
}

export const TabsList: React.FC<TabsListProps> = ({ className, children }) => {
  return (
    <div
      className={clsx(
        'inline-flex h-10 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800 p-1 text-gray-500 dark:text-gray-400',
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  className?: string
  children: React.ReactNode
  disabled?: boolean
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, className, children, disabled = false }) => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs')
  }

  const { value: selectedValue, onValueChange } = context
  const isSelected = selectedValue === value

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      onClick={() => !disabled && onValueChange(value)}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isSelected
          ? 'bg-white dark:bg-gray-900 text-gray-950 dark:text-gray-50 shadow-sm'
          : 'text-gray-700 dark:text-gray-400 hover:text-gray-950 dark:hover:text-gray-50',
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  className?: string
  children: React.ReactNode
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, className, children }) => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('TabsContent must be used within Tabs')
  }

  const { value: selectedValue } = context

  if (selectedValue !== value) {
    return null
  }

  return (
    <div
      role="tabpanel"
      className={clsx(
        'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </div>
  )
}