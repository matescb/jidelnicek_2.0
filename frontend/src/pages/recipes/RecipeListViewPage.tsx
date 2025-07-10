import React from 'react'
import { RecipeListView } from '@/components/recipes/RecipeListView'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'

/**
 * RecipeListViewPage - Advanced recipe list with comprehensive features
 * 
 * Features:
 * - Multiple view modes (grid cards, compact list, detailed table)
 * - Advanced filtering (category, difficulty, dietary restrictions, prep time, calories)
 * - Search by name, ingredients, or tags
 * - Sorting by name, rating, prep time, date created
 * - Quick actions (view, edit, duplicate, delete, add to trip)
 * - Favorite toggle with immediate UI feedback
 * - Batch operations (export, delete multiple)
 * - Responsive design with mobile-optimized filters
 * - Real-time data from recipe store
 * - Pagination for large datasets
 */
export function RecipeListViewPage() {
  return (
    <DashboardLayout>
      <RecipeListView
        showFilters={true}
        allowBatchOperations={true}
        onRecipeSelect={(recipe) => {
          // Optional: Handle recipe selection differently
          console.log('Recipe selected:', recipe)
          // By default, it navigates to recipe detail page
        }}
      />
    </DashboardLayout>
  )
}

export default RecipeListViewPage