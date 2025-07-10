// Test file to demonstrate MealPlanningBoard usage
import React from 'react'
import { MealPlanningBoard } from './MealPlanningBoard'
import type { Trip } from '@/store/slices/tripStore'
import type { Recipe } from '@/types/recipe'

// Mock data for testing
const mockTrip: Trip = {
  id: '1',
  name: 'Summer Vacation 2024',
  description: 'Family trip to the mountains',
  startDate: '2024-07-01',
  endDate: '2024-07-14',
  participantCount: 4,
  status: 'planning',
  mealSlotConfiguration: [
    {
      id: 'breakfast',
      dayNumber: 1,
      mealType: 'breakfast',
      isActive: true,
      displayOrder: 1,
    },
    {
      id: 'lunch',
      dayNumber: 1,
      mealType: 'lunch',
      isActive: true,
      displayOrder: 2,
    },
    {
      id: 'dinner',
      dayNumber: 1,
      mealType: 'dinner',
      isActive: true,
      displayOrder: 3,
    },
  ],
  participants: [],
  days: Array.from({ length: 14 }, (_, i) => ({
    id: `day-${i + 1}`,
    dayNumber: i + 1,
    date: new Date(2024, 6, i + 1).toISOString(),
    meals: [],
    participantCount: 4,
  })),
  userId: 'user-1',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

const mockRecipes: Recipe[] = [
  {
    id: '1',
    name: 'Scrambled Eggs',
    description: 'Classic breakfast dish',
    instructions: [{ step: 1, text: 'Beat eggs and cook in pan' }],
    ingredients: [
      { name: 'Eggs', quantity: 4, unit: 'pieces' },
      { name: 'Butter', quantity: 1, unit: 'tbsp' },
    ],
    prepTime: 5,
    cookTime: 5,
    totalTime: 10,
    servings: 2,
    difficulty: 'easy',
    categories: ['Breakfast', 'Quick'],
    tags: ['vegetarian', 'gluten-free'],
    isPublic: true,
    userId: 'user-1',
    nutrition: {
      calories: 200,
      protein: 16,
      carbs: 2,
      fat: 14,
      fiber: 0,
      sodium: 180,
    },
    ratingAverage: 4.5,
    ratingCount: 120,
    favoriteCount: 45,
    viewCount: 1500,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'Grilled Chicken Salad',
    description: 'Healthy lunch option with mixed greens',
    instructions: [
      { step: 1, text: 'Grill chicken breast' },
      { step: 2, text: 'Mix salad ingredients' },
    ],
    ingredients: [
      { name: 'Chicken breast', quantity: 200, unit: 'g' },
      { name: 'Mixed greens', quantity: 100, unit: 'g' },
      { name: 'Cherry tomatoes', quantity: 10, unit: 'pieces' },
    ],
    prepTime: 15,
    cookTime: 20,
    totalTime: 35,
    servings: 1,
    difficulty: 'medium',
    categories: ['Lunch', 'Healthy', 'Salads'],
    tags: ['high-protein', 'low-carb'],
    isPublic: true,
    userId: 'user-2',
    nutrition: {
      calories: 350,
      protein: 40,
      carbs: 12,
      fat: 15,
      fiber: 4,
      sodium: 300,
    },
    ratingAverage: 4.2,
    ratingCount: 89,
    favoriteCount: 32,
    viewCount: 980,
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02',
  },
  {
    id: '3',
    name: 'Spaghetti Carbonara',
    description: 'Traditional Italian pasta dish',
    instructions: [
      { step: 1, text: 'Cook pasta al dente' },
      { step: 2, text: 'Prepare egg and cheese mixture' },
      { step: 3, text: 'Combine with bacon' },
    ],
    ingredients: [
      { name: 'Spaghetti', quantity: 400, unit: 'g' },
      { name: 'Bacon', quantity: 200, unit: 'g' },
      { name: 'Eggs', quantity: 4, unit: 'pieces' },
      { name: 'Parmesan', quantity: 100, unit: 'g' },
    ],
    prepTime: 10,
    cookTime: 20,
    totalTime: 30,
    servings: 4,
    difficulty: 'medium',
    categories: ['Dinner', 'Italian', 'Pasta'],
    tags: ['comfort-food'],
    isPublic: true,
    userId: 'user-3',
    imageUrl: 'https://example.com/carbonara.jpg',
    nutrition: {
      calories: 580,
      protein: 25,
      carbs: 65,
      fat: 24,
      fiber: 3,
      sodium: 450,
    },
    ratingAverage: 4.8,
    ratingCount: 234,
    favoriteCount: 156,
    viewCount: 3200,
    createdAt: '2024-01-03',
    updatedAt: '2024-01-03',
  },
]

// Example usage
export function MealPlanningBoardExample() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Meal Planning Board Example</h1>
      <MealPlanningBoard trip={mockTrip} recipes={mockRecipes} />
    </div>
  )
}