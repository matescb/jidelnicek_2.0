import React from 'react'
import { useTranslation } from 'react-i18next'
import { DirectionalBox, DirectionalFlex, useDirection } from './'
import { languages } from '@/i18n'

export const RTLExample: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { direction, isRTL, toggleDirection } = useDirection()

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Language Selector */}
      <div className="bg-surface p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">{t('settings.language')}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(languages).map(([code, lang]) => (
            <button
              key={code}
              onClick={() => changeLanguage(code)}
              className={`px-4 py-2 rounded-md transition-colors ${
                i18n.language === code
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface-elevated hover:bg-secondary-100'
              }`}
            >
              {lang.flag} {lang.nativeName}
            </button>
          ))}
        </div>
      </div>

      {/* Direction Info */}
      <div className="bg-surface p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Direction Info</h3>
        <DirectionalFlex gap="1rem" className="items-center">
          <span>Current Direction: <strong>{direction}</strong></span>
          <span>Is RTL: <strong>{isRTL ? 'Yes' : 'No'}</strong></span>
          <button
            onClick={toggleDirection}
            className="px-4 py-2 bg-secondary-500 text-white rounded-md hover:bg-secondary-600"
          >
            Toggle Direction
          </button>
        </DirectionalFlex>
      </div>

      {/* Directional Layout Example */}
      <div className="bg-surface p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Directional Layout</h3>
        
        {/* Using logical properties */}
        <DirectionalBox
          marginStart="0"
          marginEnd="auto"
          paddingStart="1rem"
          paddingEnd="2rem"
          borderStart="4px solid var(--color-primary-500)"
          className="bg-primary-50 mb-4 max-w-md"
        >
          <p className="text-start">
            This box uses logical properties. Notice how the border, padding, and alignment 
            automatically adjust for RTL languages.
          </p>
        </DirectionalBox>

        {/* Icon mirroring example */}
        <DirectionalFlex gap="1rem" className="items-center mb-4">
          <DirectionalBox mirrorTransform className="text-2xl">
            →
          </DirectionalBox>
          <span>This arrow automatically flips in RTL mode</span>
        </DirectionalFlex>

        {/* Grid layout */}
        <div className="grid grid-cols-3 gap-4">
          <DirectionalBox
            textAlign="start"
            className="bg-secondary-100 p-4 rounded"
          >
            <h4 className="font-semibold">Start Aligned</h4>
            <p className="text-sm text-text-secondary">Content aligned to start</p>
          </DirectionalBox>
          
          <DirectionalBox
            textAlign="center"
            className="bg-secondary-100 p-4 rounded"
          >
            <h4 className="font-semibold">Center Aligned</h4>
            <p className="text-sm text-text-secondary">Content centered</p>
          </DirectionalBox>
          
          <DirectionalBox
            textAlign="end"
            className="bg-secondary-100 p-4 rounded"
          >
            <h4 className="font-semibold">End Aligned</h4>
            <p className="text-sm text-text-secondary">Content aligned to end</p>
          </DirectionalBox>
        </div>
      </div>

      {/* CSS Classes Example */}
      <div className="bg-surface p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">RTL CSS Utilities</h3>
        
        <div className="space-y-4">
          {/* Margin utilities */}
          <div className="ms-0 me-auto ps-4 pe-8 border-s-4 border-primary-500 bg-blue-50 max-w-md">
            <p className="font-semibold">Logical Margin & Padding</p>
            <p className="text-sm">Uses ms-0 (margin-start), me-auto (margin-end), ps-4 (padding-start), pe-8 (padding-end)</p>
          </div>

          {/* Float example */}
          <div className="overflow-hidden bg-gray-50 p-4 rounded">
            <div className="float-start bg-green-200 p-2 me-4 mb-2 rounded">
              Float Start
            </div>
            <p>This text wraps around the floated element. In RTL mode, the float automatically switches sides.</p>
          </div>

          {/* Animation example */}
          <div className="relative overflow-hidden bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded">
            <div className="animate-slide-in-from-start">
              <p>This slides in from the start direction (left in LTR, right in RTL)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Example */}
      <div className="bg-surface p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">{t('auth.login')}</h3>
        <form className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1 text-start">
              {t('auth.email')}
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border rounded-md text-start"
              placeholder={t('auth.email')}
              dir="auto"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-start">
              {t('auth.password')}
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border rounded-md text-start"
              placeholder={t('auth.password')}
            />
          </div>
          <DirectionalFlex gap="1rem" flexDirection="row" className="justify-end">
            <button
              type="button"
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
            >
              {t('auth.login')}
            </button>
          </DirectionalFlex>
        </form>
      </div>
    </div>
  )
}