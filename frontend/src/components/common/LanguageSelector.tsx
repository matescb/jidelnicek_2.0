import React from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { languages, changeLanguage, getCurrentLanguage, type LanguageCode } from '@/i18n'

export function LanguageSelector() {
  const { i18n } = useTranslation()
  const currentLanguage = getCurrentLanguage()

  const handleLanguageChange = (code: LanguageCode) => {
    changeLanguage(code)
  }

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-700">
          <span className="text-lg mr-1">{currentLanguage.flag}</span>
          {currentLanguage.nativeName}
          <ChevronDownIcon
            className="-mr-1 h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
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
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 dark:ring-gray-700">
          <div className="py-1">
            {Object.entries(languages).map(([code, language]) => (
              <Menu.Item key={code}>
                {({ active }) => (
                  <button
                    onClick={() => handleLanguageChange(code as LanguageCode)}
                    className={`
                      ${active ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}
                      ${i18n.language === code ? 'font-semibold' : ''}
                      group flex w-full items-center px-4 py-2 text-sm
                    `}
                  >
                    <span className="text-lg mr-3">{language.flag}</span>
                    <div className="flex flex-col items-start">
                      <span>{language.nativeName}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {language.name}
                      </span>
                    </div>
                    {i18n.language === code && (
                      <svg
                        className="ml-auto h-5 w-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
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