import React from 'react'
import { RecipeListView } from './RecipeListView'
import { Container } from '@/components/layout/Container'

export function RecipeListViewDemo() {
  return (
    <Container className="py-8">
      <RecipeListView
        showFilters={true}
        allowBatchOperations={true}
        onRecipeSelect={(recipe) => {
          console.log('Recipe selected:', recipe)
        }}
      />
    </Container>
  )
}

export default RecipeListViewDemo