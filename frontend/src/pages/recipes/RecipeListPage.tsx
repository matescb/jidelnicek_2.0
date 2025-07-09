import React from 'react'
import { useTranslation } from 'react-i18next'

const RecipeListPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('navigation.recipes')}
      </h1>
      <p className="text-gray-600 dark:text-gray-400">Recipe list page - Coming soon</p>
    </div>
  )
}

export default RecipeListPage