import React, { useEffect, useState } from 'react'
import { CostCalculator } from './CostCalculator'
import { useTripStore } from '@/store/slices/tripStore'
import { useWebSocketEvent } from '@/hooks/useWebSocket'
import { Decimal } from 'decimal.js'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

/**
 * Example of integrating CostCalculator with the trip store and WebSocket updates
 */
export function CostCalculatorExample({ tripId }: { tripId: string }) {
  const { currentTrip, shoppingList, fetchTrip, generateShoppingList } = useTripStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch trip data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        await fetchTrip(tripId)
        await generateShoppingList(tripId)
      } catch (err) {
        setError('Failed to load trip data')
        console.error('Error loading trip data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [tripId, fetchTrip, generateShoppingList])

  // Listen for shopping list updates
  useWebSocketEvent(
    'shopping-list:update',
    (event) => {
      if (event.payload.tripId === tripId) {
        // Shopping list has been updated
        // The store will be updated automatically by useRealtimeShoppingList hook
      }
    },
    { tripId, enabled: true }
  )

  // Listen for participant changes
  useWebSocketEvent(
    'participant:coefficient-change',
    (event) => {
      if (event.payload.tripId === tripId) {
        // Participant coefficients have changed
        // Refetch trip to get updated data
        fetchTrip(tripId)
      }
    },
    { tripId, enabled: true }
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !currentTrip) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Trip data not available'}
        </AlertDescription>
      </Alert>
    )
  }

  // Transform shopping list to ingredients format
  const ingredients = shoppingList.map(item => ({
    ingredientId: item.ingredientId,
    name: item.name,
    quantity: new Decimal(item.quantity),
    unit: item.unit,
    category: item.category,
  }))

  // Transform participants data
  const participants = currentTrip.participants.map(p => {
    // Calculate effective coefficient as average of meal coefficients
    const avgCoefficient = (
      (p.mealCoefficients?.breakfast || 1) +
      (p.mealCoefficients?.lunch || 1) +
      (p.mealCoefficients?.dinner || 1)
    ) / 3

    // Calculate attendance days
    const arrivalDate = p.arrivalDate ? new Date(p.arrivalDate) : new Date(currentTrip.startDate)
    const departureDate = p.departureDate ? new Date(p.departureDate) : new Date(currentTrip.endDate)
    const attendanceDays = Math.ceil(
      (departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1

    return {
      id: p.id,
      name: p.name,
      effectiveCoefficient: avgCoefficient,
      attendanceDays,
    }
  })

  // Calculate total days
  const startDate = new Date(currentTrip.startDate)
  const endDate = new Date(currentTrip.endDate)
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1

  // Count meals per day based on trip configuration
  const mealsPerDay = currentTrip.mealTypes?.length || 3

  return (
    <CostCalculator
      tripId={tripId}
      ingredients={ingredients}
      participants={participants}
      totalDays={totalDays}
      mealsPerDay={mealsPerDay}
      budget={currentTrip.budget}
      currency={currentTrip.currency || 'USD'}
    />
  )
}

/**
 * Advanced example with custom price data and budget allocations
 */
export function CostCalculatorAdvancedExample({ tripId }: { tripId: string }) {
  const [customBudget, setCustomBudget] = useState<number | undefined>()
  const [priceStrategy, setPriceStrategy] = useState<'conservative' | 'average' | 'optimistic'>('average')

  // This would typically come from your API or state management
  const mockIngredients = [
    { ingredientId: '1', name: 'Tomatoes', quantity: new Decimal(2), unit: 'kg', category: 'produce' },
    { ingredientId: '2', name: 'Chicken', quantity: new Decimal(3), unit: 'kg', category: 'meat' },
    { ingredientId: '3', name: 'Rice', quantity: new Decimal(2), unit: 'kg', category: 'pantry' },
  ]

  const mockParticipants = [
    { id: '1', name: 'Adult 1', effectiveCoefficient: 1.0, attendanceDays: 7 },
    { id: '2', name: 'Adult 2', effectiveCoefficient: 0.9, attendanceDays: 7 },
    { id: '3', name: 'Child', effectiveCoefficient: 0.6, attendanceDays: 7 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Trip Cost Analysis</h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="budget" className="text-sm font-medium">
              Budget:
            </label>
            <input
              id="budget"
              type="number"
              value={customBudget || ''}
              onChange={(e) => setCustomBudget(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Enter budget"
              className="w-32 px-3 py-1 border rounded-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="strategy" className="text-sm font-medium">
              Strategy:
            </label>
            <select
              id="strategy"
              value={priceStrategy}
              onChange={(e) => setPriceStrategy(e.target.value as any)}
              className="px-3 py-1 border rounded-md"
            >
              <option value="optimistic">Optimistic</option>
              <option value="average">Average</option>
              <option value="conservative">Conservative</option>
            </select>
          </div>
        </div>
      </div>

      <CostCalculator
        tripId={tripId}
        ingredients={mockIngredients}
        participants={mockParticipants}
        totalDays={7}
        mealsPerDay={3}
        budget={customBudget}
        currency="USD"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">Cost Optimization Tips</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Buy seasonal produce for better prices</li>
            <li>• Consider bulk purchases for non-perishables</li>
            <li>• Plan meals to minimize waste</li>
            <li>• Compare prices across different stores</li>
          </ul>
        </div>
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">Budget Management</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Set aside 10-15% for unexpected expenses</li>
            <li>• Track actual vs. estimated costs</li>
            <li>• Adjust portions based on participant needs</li>
            <li>• Consider shared vs. individual items</li>
          </ul>
        </div>
      </div>
    </div>
  )
}