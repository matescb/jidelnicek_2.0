import React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TouchableArea } from './TouchableArea'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'

export interface SortOption {
  key: string
  label: string
}

interface SortSelectorProps {
  options: SortOption[]
  value: string
  order: 'asc' | 'desc'
  onChange: (key: string, order: 'asc' | 'desc') => void
  className?: string
  label?: string
}

export function SortSelector({
  options,
  value,
  order,
  onChange,
  className = '',
  label
}: SortSelectorProps) {
  const { t } = useTranslation()
  
  const currentOption = options.find(opt => opt.key === value) || options[0]
  
  const handleSelect = (key: string) => {
    if (key === value) {
      // Toggle order if selecting the same option
      onChange(key, order === 'asc' ? 'desc' : 'asc')
    } else {
      // Default to desc for new selection
      onChange(key, 'desc')
    }
  }
  
  return (
    <Menu as="div" className={`relative inline-block text-left ${className}`}>
      <div>
        <Menu.Button as={TouchableArea} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ArrowUpDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          {label && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {label}:
            </span>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {currentOption.label}
          </span>
          {order === 'asc' ? (
            <ArrowUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ArrowDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </Menu.Button>
      </div>
      
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none divide-y divide-gray-100 dark:divide-gray-700">
          <div className="py-1">
            {options.map((option) => (
              <Menu.Item key={option.key}>
                {({ active }) => (
                  <button
                    onClick={() => handleSelect(option.key)}
                    className={`
                      ${active ? 'bg-gray-100 dark:bg-gray-700' : ''}
                      ${value === option.key ? 'font-semibold' : ''}
                      group flex w-full items-center justify-between px-4 py-2 text-sm text-gray-900 dark:text-gray-100
                    `}
                  >
                    <span>{option.label}</span>
                    {value === option.key && (
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        {order === 'asc' ? (
                          <>
                            <ArrowUp className="w-4 h-4" />
                            <span className="text-xs">{t('common.ascending')}</span>
                          </>
                        ) : (
                          <>
                            <ArrowDown className="w-4 h-4" />
                            <span className="text-xs">{t('common.descending')}</span>
                          </>
                        )}
                      </div>
                    )}
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}