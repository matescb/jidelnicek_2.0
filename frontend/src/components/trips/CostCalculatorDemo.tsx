import React, { useState } from 'react'
import { CostCalculator } from './CostCalculator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Decimal } from 'decimal.js'
import { Plus, Minus, DollarSign } from 'lucide-react'

// Mock data for demonstration
const mockIngredients = [
  // Produce
  { ingredientId: '1', name: 'Tomatoes', quantity: new Decimal(2), unit: 'kg', category: 'produce' },
  { ingredientId: '2', name: 'Onions', quantity: new Decimal(1.5), unit: 'kg', category: 'produce' },
  { ingredientId: '3', name: 'Potatoes', quantity: new Decimal(3), unit: 'kg', category: 'produce' },
  { ingredientId: '4', name: 'Carrots', quantity: new Decimal(1), unit: 'kg', category: 'produce' },
  { ingredientId: '5', name: 'Bell Peppers', quantity: new Decimal(0.5), unit: 'kg', category: 'produce' },
  
  // Dairy
  { ingredientId: '6', name: 'Milk', quantity: new Decimal(4), unit: 'l', category: 'dairy' },
  { ingredientId: '7', name: 'Cheese', quantity: new Decimal(0.8), unit: 'kg', category: 'dairy' },
  { ingredientId: '8', name: 'Yogurt', quantity: new Decimal(2), unit: 'l', category: 'dairy' },
  { ingredientId: '9', name: 'Butter', quantity: new Decimal(0.3), unit: 'kg', category: 'dairy' },
  
  // Meat
  { ingredientId: '10', name: 'Chicken Breast', quantity: new Decimal(2), unit: 'kg', category: 'meat' },
  { ingredientId: '11', name: 'Ground Beef', quantity: new Decimal(1.5), unit: 'kg', category: 'meat' },
  { ingredientId: '12', name: 'Pork Chops', quantity: new Decimal(1), unit: 'kg', category: 'meat' },
  
  // Pantry
  { ingredientId: '13', name: 'Rice', quantity: new Decimal(2), unit: 'kg', category: 'pantry' },
  { ingredientId: '14', name: 'Pasta', quantity: new Decimal(1.5), unit: 'kg', category: 'pantry' },
  { ingredientId: '15', name: 'Flour', quantity: new Decimal(1), unit: 'kg', category: 'pantry' },
  { ingredientId: '16', name: 'Olive Oil', quantity: new Decimal(0.5), unit: 'l', category: 'pantry' },
  
  // Bakery
  { ingredientId: '17', name: 'Bread', quantity: new Decimal(2), unit: 'kg', category: 'bakery' },
  { ingredientId: '18', name: 'Rolls', quantity: new Decimal(1), unit: 'kg', category: 'bakery' },
  
  // Beverages
  { ingredientId: '19', name: 'Orange Juice', quantity: new Decimal(3), unit: 'l', category: 'beverages' },
  { ingredientId: '20', name: 'Coffee', quantity: new Decimal(0.5), unit: 'kg', category: 'beverages' },
]

const mockParticipants = [
  { id: '1', name: 'John Doe', effectiveCoefficient: 1.0, attendanceDays: 7 },
  { id: '2', name: 'Jane Smith', effectiveCoefficient: 0.8, attendanceDays: 7 },
  { id: '3', name: 'Bob Johnson', effectiveCoefficient: 1.2, attendanceDays: 5 },
  { id: '4', name: 'Alice Brown', effectiveCoefficient: 0.9, attendanceDays: 7 },
  { id: '5', name: 'Charlie Davis', effectiveCoefficient: 0.7, attendanceDays: 3 },
]

export function CostCalculatorDemo() {
  const [budget, setBudget] = useState(500)
  const [currency, setCurrency] = useState('USD')
  const [totalDays, setTotalDays] = useState(7)
  const [mealsPerDay, setMealsPerDay] = useState(3)
  const [participants, setParticipants] = useState(mockParticipants)

  const updateParticipantCoefficient = (id: string, delta: number) => {
    setParticipants(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, effectiveCoefficient: Math.max(0.1, p.effectiveCoefficient + delta) }
          : p
      )
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Cost Calculator Demo</h1>
        <p className="text-muted-foreground">
          Interactive demonstration of the trip cost calculation and budget tracking features
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Trip Settings</CardTitle>
            <CardDescription>Configure your trip parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Total Budget</Label>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="budget"
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  min={0}
                  step={50}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="CZK">CZK (Kč)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">Total Days</Label>
              <Input
                id="days"
                type="number"
                value={totalDays}
                onChange={(e) => setTotalDays(Number(e.target.value))}
                min={1}
                max={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meals">Meals Per Day</Label>
              <Input
                id="meals"
                type="number"
                value={mealsPerDay}
                onChange={(e) => setMealsPerDay(Number(e.target.value))}
                min={1}
                max={5}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Participant Coefficients</h4>
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{participant.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {participant.attendanceDays} days
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => updateParticipantCoefficient(participant.id, -0.1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-12 text-center text-sm">
                      {participant.effectiveCoefficient.toFixed(1)}x
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => updateParticipantCoefficient(participant.id, 0.1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cost Calculator */}
        <div className="lg:col-span-2">
          <CostCalculator
            tripId="demo-trip"
            ingredients={mockIngredients}
            participants={participants}
            totalDays={totalDays}
            mealsPerDay={mealsPerDay}
            budget={budget}
            currency={currency}
          />
        </div>
      </div>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Key Features</CardTitle>
          <CardDescription>What the Cost Calculator offers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium">Real-time Updates</h4>
              <p className="text-sm text-muted-foreground">
                Live cost updates via WebSocket when prices or quantities change
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Budget Tracking</h4>
              <p className="text-sm text-muted-foreground">
                Visual indicators for budget status with variance analysis
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Per-Participant Costs</h4>
              <p className="text-sm text-muted-foreground">
                Breakdown based on meal coefficients and attendance days
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Category Analysis</h4>
              <p className="text-sm text-muted-foreground">
                Detailed cost breakdown by ingredient categories
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Price Strategies</h4>
              <p className="text-sm text-muted-foreground">
                Multiple estimation strategies from optimistic to conservative
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Export Reports</h4>
              <p className="text-sm text-muted-foreground">
                Download detailed cost reports in JSON format
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}