import React from 'react'
import { NutritionCalculator } from './NutritionCalculator'
import { Trip, TripDay, TripMeal, TripParticipant, Recipe } from '../../types'

// Sample trip data with nutrition information
const sampleTrip: Trip = {
  id: '1',
  name: 'Summer Camping Trip',
  description: 'A week-long camping adventure',
  startDate: '2024-07-01',
  endDate: '2024-07-07',
  participantCount: 4,
  status: 'planning',
  ownerId: 'user1',
  createdAt: '2024-01-15',
  updatedAt: '2024-01-15',
  participants: [
    {
      id: 'p1',
      tripId: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'planner',
      status: 'accepted',
      mealCoefficient: 1.2,
      snackCoefficient: 1,
      mealCoefficients: {
        breakfast: 1,
        lunch: 1.2,
        dinner: 1.2
      }
    },
    {
      id: 'p2',
      tripId: '1',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'participant',
      status: 'accepted',
      mealCoefficient: 1,
      snackCoefficient: 0.8,
      mealCoefficients: {
        breakfast: 0.8,
        lunch: 1,
        dinner: 1
      }
    },
    {
      id: 'p3',
      tripId: '1',
      name: 'Mike Johnson',
      email: 'mike@example.com',
      role: 'participant',
      status: 'accepted',
      arrivalDate: '2024-07-02',
      departureDate: '2024-07-06',
      mealCoefficient: 1.5,
      snackCoefficient: 1.2,
      mealCoefficients: {
        breakfast: 1.2,
        lunch: 1.5,
        dinner: 1.5
      }
    },
    {
      id: 'p4',
      tripId: '1',
      name: 'Sarah Wilson',
      email: 'sarah@example.com',
      role: 'participant',
      status: 'accepted',
      mealCoefficient: 0.9,
      snackCoefficient: 0.8,
      mealCoefficients: {
        breakfast: 0.8,
        lunch: 0.9,
        dinner: 0.9
      }
    }
  ],
  days: []
}

// Sample recipes with nutrition data
const sampleRecipes: Recipe[] = [
  {
    id: 'r1',
    name: 'Oatmeal with Berries',
    instructions: [{ step: 1, text: 'Cook oats' }],
    ingredients: [],
    servings: 4,
    difficulty: 'easy',
    isPublic: true,
    userId: 'user1',
    ratingAverage: 4.5,
    ratingCount: 10,
    favoriteCount: 5,
    viewCount: 100,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    nutrition: {
      calories: 320,
      protein: 12,
      carbs: 58,
      fat: 8,
      fiber: 8,
      sodium: 150,
      sugar: 12,
      saturatedFat: 2,
      cholesterol: 5
    }
  },
  {
    id: 'r2',
    name: 'Grilled Chicken Sandwich',
    instructions: [{ step: 1, text: 'Grill chicken' }],
    ingredients: [],
    servings: 4,
    difficulty: 'medium',
    isPublic: true,
    userId: 'user1',
    ratingAverage: 4.8,
    ratingCount: 25,
    favoriteCount: 15,
    viewCount: 250,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    nutrition: {
      calories: 420,
      protein: 35,
      carbs: 42,
      fat: 12,
      fiber: 3,
      sodium: 680,
      sugar: 6,
      saturatedFat: 3,
      cholesterol: 85
    }
  },
  {
    id: 'r3',
    name: 'Pasta with Tomato Sauce',
    instructions: [{ step: 1, text: 'Cook pasta' }],
    ingredients: [],
    servings: 6,
    difficulty: 'easy',
    isPublic: true,
    userId: 'user1',
    ratingAverage: 4.2,
    ratingCount: 30,
    favoriteCount: 20,
    viewCount: 400,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    nutrition: {
      calories: 380,
      protein: 14,
      carbs: 72,
      fat: 6,
      fiber: 4,
      sodium: 520,
      sugar: 8,
      saturatedFat: 1,
      cholesterol: 0
    }
  },
  {
    id: 'r4',
    name: 'Trail Mix Snack',
    instructions: [{ step: 1, text: 'Mix ingredients' }],
    ingredients: [],
    servings: 8,
    difficulty: 'easy',
    isPublic: true,
    userId: 'user1',
    ratingAverage: 4.6,
    ratingCount: 15,
    favoriteCount: 12,
    viewCount: 180,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    nutrition: {
      calories: 180,
      protein: 6,
      carbs: 20,
      fat: 10,
      fiber: 3,
      sodium: 50,
      sugar: 12,
      saturatedFat: 2,
      cholesterol: 0
    }
  }
]

// Generate trip days with meals
const generateTripDays = (): TripDay[] => {
  const days: TripDay[] = []
  const startDate = new Date('2024-07-01')
  
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    
    const meals: TripMeal[] = []
    
    // Breakfast
    meals.push({
      id: `m${i}-1`,
      dayId: `d${i}`,
      mealSlot: 'breakfast',
      recipeId: 'r1',
      recipe: sampleRecipes[0]
    })
    
    // Lunch
    meals.push({
      id: `m${i}-2`,
      dayId: `d${i}`,
      mealSlot: 'lunch',
      recipeId: 'r2',
      recipe: sampleRecipes[1]
    })
    
    // Dinner
    meals.push({
      id: `m${i}-3`,
      dayId: `d${i}`,
      mealSlot: 'dinner',
      recipeId: 'r3',
      recipe: sampleRecipes[2]
    })
    
    // Snack (only on some days)
    if (i % 2 === 0) {
      meals.push({
        id: `m${i}-4`,
        dayId: `d${i}`,
        mealSlot: 'snack',
        recipeId: 'r4',
        recipe: sampleRecipes[3]
      })
    }
    
    days.push({
      id: `d${i}`,
      tripId: '1',
      date: currentDate.toISOString().split('T')[0],
      dayNumber: i + 1,
      meals
    })
  }
  
  return days
}

// Add days to the sample trip
sampleTrip.days = generateTripDays()

export const NutritionCalculatorDemo: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Nutrition Calculator Demo
        </h1>
        <p className="text-gray-600">
          Comprehensive nutrition tracking and analysis for trip meal planning
        </p>
      </div>

      <NutritionCalculator trip={sampleTrip} />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">
          Demo Features
        </h2>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• View nutrition summaries for the entire trip</li>
          <li>• Daily nutrition breakdowns with expandable details</li>
          <li>• Per-participant nutrition calculations based on meal coefficients</li>
          <li>• Macronutrient balance visualization with donut charts</li>
          <li>• Nutrition goal tracking with progress bars</li>
          <li>• Micronutrient tracking (vitamins and minerals)</li>
          <li>• Export nutrition reports in JSON format</li>
          <li>• Mobile-responsive design with tabs</li>
          <li>• Real-time updates via WebSocket (when connected)</li>
        </ul>
      </div>
    </div>
  )
}