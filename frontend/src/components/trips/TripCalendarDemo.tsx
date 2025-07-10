import React, { useState } from 'react'
import { TripCalendarView } from './TripCalendarView'
import type { Trip, DayPlan } from '@/store/slices/tripStore'

// Demo trip data
const demoTrip: Trip = {
  id: '1',
  name: 'Summer Camping Trip',
  description: 'Annual camping trip with friends',
  startDate: '2025-08-01',
  endDate: '2025-08-07',
  participantCount: 8,
  status: 'planning',
  mealSlotConfiguration: [
    { id: '1', dayNumber: 1, mealType: 'breakfast', isActive: true, displayOrder: 1 },
    { id: '2', dayNumber: 1, mealType: 'lunch', isActive: true, displayOrder: 2 },
    { id: '3', dayNumber: 1, mealType: 'dinner', isActive: true, displayOrder: 3 },
  ],
  participants: [
    { id: '1', name: 'John Doe', mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 } },
    { id: '2', name: 'Jane Smith', mealCoefficients: { breakfast: 0.8, lunch: 1, dinner: 1 } },
  ],
  days: [
    {
      id: '1',
      dayNumber: 1,
      date: '2025-08-01',
      meals: [
        { 
          id: 'm1', 
          dayId: '1', 
          mealSlot: 'breakfast', 
          recipe: { 
            id: 'r1', 
            name: 'Pancakes',
            servings: 4,
            userId: 'u1',
            isPublic: true,
            difficulty: 'easy',
            instructions: [],
            ingredients: [],
            ratingAverage: 0,
            ratingCount: 0,
            favoriteCount: 0,
            viewCount: 0,
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01'
          } 
        },
        { 
          id: 'm2', 
          dayId: '1', 
          mealSlot: 'lunch', 
          recipe: { 
            id: 'r2', 
            name: 'Sandwiches',
            servings: 4,
            userId: 'u1',
            isPublic: true,
            difficulty: 'easy',
            instructions: [],
            ingredients: [],
            ratingAverage: 0,
            ratingCount: 0,
            favoriteCount: 0,
            viewCount: 0,
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01'
          } 
        },
      ],
      participantCount: 8,
    },
    {
      id: '2',
      dayNumber: 2,
      date: '2025-08-02',
      meals: [
        { 
          id: 'm3', 
          dayId: '2', 
          mealSlot: 'breakfast', 
          recipe: { 
            id: 'r3', 
            name: 'Oatmeal',
            servings: 4,
            userId: 'u1',
            isPublic: true,
            difficulty: 'easy',
            instructions: [],
            ingredients: [],
            ratingAverage: 0,
            ratingCount: 0,
            favoriteCount: 0,
            viewCount: 0,
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01'
          } 
        },
      ],
      participantCount: 8,
    },
  ],
  userId: 'user123',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-10T00:00:00Z',
}

export const TripCalendarDemo: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedDay, setSelectedDay] = useState<DayPlan | null>(null)

  const handleDayClick = (day: DayPlan | null, date: Date) => {
    setSelectedDate(date)
    setSelectedDay(day)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Trip Calendar View Demo
      </h1>
      
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
        <TripCalendarView
          trip={demoTrip}
          onDayClick={handleDayClick}
          selectedDate={selectedDate}
          locale="en"
        />
      </div>

      {selectedDate && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Selected Date</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Date: {selectedDate.toLocaleDateString()}
          </p>
          {selectedDay ? (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Planned Meals:</h3>
              <ul className="space-y-2">
                {selectedDay.meals.map(meal => (
                  <li key={meal.id} className="text-sm text-gray-600 dark:text-gray-400">
                    {meal.mealSlot}: {meal.recipe.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
              No meals planned for this day yet.
            </p>
          )}
        </div>
      )}
    </div>
  )
}