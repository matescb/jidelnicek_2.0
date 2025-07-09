import React from 'react'
import { useTranslation } from 'react-i18next'

const RecipeCreatePage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Create New Recipe
      </h1>
      <p className="text-gray-600 dark:text-gray-400">Recipe creation form - Coming soon</p>
    </div>
  )
}

export default RecipeCreatePage