import React, { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { GlobeAltIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
]

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation()

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0]

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode)
  }

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300">
        <span className="sr-only">Change language</span>
        <GlobeAltIcon className="h-5 w-5" />
      </Menu.Button>
      
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {languages.map((language) => (
            <Menu.Item key={language.code}>
              {({ active }) => (
                <button
                  onClick={() => handleLanguageChange(language.code)}
                  className={clsx(
                    active ? 'bg-gray-100 dark:bg-gray-700' : '',
                    language.code === currentLanguage.code ? 'font-medium' : '',
                    'block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                  )}
                >
                  <span className="mr-2">{language.flag}</span>
                  {language.name}
                </button>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  )
}