import React from 'react'
import type { Trip } from '@/store/slices/tripStore'

interface ShoppingListGeneratorProps {
  trip: Trip
}

export const ShoppingListGenerator: React.FC<ShoppingListGeneratorProps> = ({ trip }) => {
  return (
    <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
      <p className="text-center text-gray-500 dark:text-gray-400">
        Shopping List Generator - Coming Soon
      </p>
      <p className="text-center text-sm text-gray-400 dark:text-gray-600 mt-2">
        This component will generate and manage your trip shopping list
      </p>
    </div>
  )
}