import React, { useEffect } from 'react'
import { ShoppingListView } from './ShoppingListView'
import { useTripStore } from '@/store/slices/tripStore'
import type { Trip, ShoppingListItem } from '@/store/slices/tripStore'

// Mock trip data for demo
const mockTrip: Trip = {
  id: 'demo-trip-1',
  name: 'Summer Camping Trip 2024',
  description: 'Annual family camping trip to Yellowstone',
  startDate: '2024-07-15',
  endDate: '2024-07-22',
  participantCount: 8,
  status: 'planning',
  mealSlotConfiguration: [],
  participants: [],
  days: [],
  userId: 'demo-user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

// Mock shopping list data
const mockShoppingList: ShoppingListItem[] = [
  // Produce
  { ingredientId: '1', name: 'Tomatoes', quantity: 2.5, unit: 'kg', category: 'produce', recipes: ['Greek Salad', 'Pasta Sauce'] },
  { ingredientId: '2', name: 'Onions', quantity: 1.5, unit: 'kg', category: 'produce', recipes: ['Stir Fry', 'Soup', 'Pasta Sauce'] },
  { ingredientId: '3', name: 'Bell Peppers', quantity: 8, unit: 'piece', category: 'produce', recipes: ['Stir Fry', 'Greek Salad'] },
  { ingredientId: '4', name: 'Garlic', quantity: 200, unit: 'g', category: 'produce', recipes: ['Pasta Sauce', 'Stir Fry', 'Soup'] },
  { ingredientId: '5', name: 'Lettuce', quantity: 3, unit: 'piece', category: 'produce', recipes: ['Greek Salad', 'Sandwiches'] },
  
  // Dairy
  { ingredientId: '6', name: 'Milk', quantity: 4, unit: 'l', category: 'dairy', recipes: ['Pancakes', 'Cereal'] },
  { ingredientId: '7', name: 'Cheese (Cheddar)', quantity: 500, unit: 'g', category: 'dairy', recipes: ['Sandwiches', 'Tacos'] },
  { ingredientId: '8', name: 'Yogurt', quantity: 2, unit: 'kg', category: 'dairy', recipes: ['Breakfast Parfait'] },
  { ingredientId: '9', name: 'Butter', quantity: 250, unit: 'g', category: 'dairy', recipes: ['Pancakes', 'Toast'] },
  
  // Meat
  { ingredientId: '10', name: 'Ground Beef', quantity: 1.5, unit: 'kg', category: 'meat', recipes: ['Tacos', 'Spaghetti Bolognese'] },
  { ingredientId: '11', name: 'Chicken Breast', quantity: 2, unit: 'kg', category: 'meat', recipes: ['Grilled Chicken', 'Stir Fry'] },
  { ingredientId: '12', name: 'Bacon', quantity: 500, unit: 'g', category: 'meat', recipes: ['BLT Sandwiches', 'Breakfast'] },
  
  // Grains
  { ingredientId: '13', name: 'Pasta', quantity: 1, unit: 'kg', category: 'grains', recipes: ['Spaghetti Bolognese', 'Pasta Salad'] },
  { ingredientId: '14', name: 'Rice', quantity: 2, unit: 'kg', category: 'grains', recipes: ['Stir Fry', 'Rice Bowls'] },
  { ingredientId: '15', name: 'Bread', quantity: 3, unit: 'piece', category: 'bakery', recipes: ['Sandwiches', 'Toast'] },
  
  // Canned
  { ingredientId: '16', name: 'Canned Tomatoes', quantity: 4, unit: 'piece', category: 'canned', recipes: ['Pasta Sauce', 'Soup'] },
  { ingredientId: '17', name: 'Black Beans', quantity: 3, unit: 'piece', category: 'canned', recipes: ['Tacos', 'Bean Salad'] },
  
  // Beverages
  { ingredientId: '18', name: 'Orange Juice', quantity: 2, unit: 'l', category: 'beverages', recipes: ['Breakfast'] },
  { ingredientId: '19', name: 'Coffee', quantity: 500, unit: 'g', category: 'beverages', recipes: ['Morning Coffee'] },
  
  // Condiments
  { ingredientId: '20', name: 'Olive Oil', quantity: 500, unit: 'ml', category: 'condiments', recipes: ['Salad Dressing', 'Cooking'] },
  { ingredientId: '21', name: 'Soy Sauce', quantity: 250, unit: 'ml', category: 'condiments', recipes: ['Stir Fry'] },
  
  // Spices
  { ingredientId: '22', name: 'Salt', quantity: 200, unit: 'g', category: 'spices', recipes: ['All Recipes'] },
  { ingredientId: '23', name: 'Black Pepper', quantity: 50, unit: 'g', category: 'spices', recipes: ['Most Recipes'] },
  { ingredientId: '24', name: 'Paprika', quantity: 30, unit: 'g', category: 'spices', recipes: ['Tacos', 'Grilled Chicken'] }
]

export const ShoppingListViewDemo: React.FC = () => {
  const { setShoppingList, setShoppingListLoading } = useTripStore()

  useEffect(() => {
    // Simulate loading
    setShoppingListLoading(true)
    setTimeout(() => {
      setShoppingList(mockShoppingList)
      setShoppingListLoading(false)
    }, 1000)

    // Cleanup
    return () => {
      setShoppingList([])
    }
  }, [setShoppingList, setShoppingListLoading])

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Shopping List View Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          A read-only view of the shopping list with category grouping, collapsible sections, and print-optimized layout.
        </p>

        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Features Demonstrated:
            </h3>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-400">
              <li>• Category grouping with visual hierarchy</li>
              <li>• Collapsible category sections</li>
              <li>• Total counts and weights per category</li>
              <li>• Export to CSV and PDF (print)</li>
              <li>• Mobile-optimized responsive layout</li>
              <li>• Real-time updates via WebSocket (simulated)</li>
              <li>• Compact print layout</li>
            </ul>
          </div>

          <ShoppingListView trip={mockTrip} />
        </div>
      </div>
    </div>
  )
}