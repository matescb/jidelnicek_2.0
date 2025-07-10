import React, { useState } from 'react'
import { CalculationSummary } from './CalculationSummary'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

// Demo trip IDs for testing
const DEMO_TRIPS = [
  { id: '1', name: 'Summer Camp 2024', participants: 25, days: 7 },
  { id: '2', name: 'Weekend Retreat', participants: 12, days: 3 },
  { id: '3', name: 'Family Reunion', participants: 45, days: 5 },
]

export const CalculationSummaryDemo: React.FC = () => {
  const [selectedTripId, setSelectedTripId] = useState<string>()
  const [lastClickedMetric, setLastClickedMetric] = useState<string>()

  const handleMetricClick = (metric: 'cost' | 'nutrition' | 'shopping') => {
    setLastClickedMetric(metric)
    console.log(`Clicked on ${metric} metric`)
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Calculation Summary Widget Demo</h1>
        <p className="text-muted-foreground mb-6">
          A real-time dashboard widget that displays key trip metrics with WebSocket updates
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This widget connects to WebSocket for real-time updates. Metrics will update automatically
          when changes occur in the selected trip (cost recalculations, nutrition updates, shopping list changes).
        </AlertDescription>
      </Alert>

      {/* Configuration */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Trip</label>
            <Select value={selectedTripId} onValueChange={setSelectedTripId}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Choose a trip..." />
              </SelectTrigger>
              <SelectContent>
                {DEMO_TRIPS.map(trip => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.name} ({trip.participants} people, {trip.days} days)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {lastClickedMetric && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                Last clicked metric: <strong>{lastClickedMetric}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                In a real app, this would navigate to the detailed {lastClickedMetric} view
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Widget Examples */}
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Default View</h2>
          <CalculationSummary 
            tripId={selectedTripId}
            onMetricClick={handleMetricClick}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Compact View (Custom Styling)</h2>
          <CalculationSummary 
            tripId={selectedTripId}
            className="max-w-4xl"
            onMetricClick={handleMetricClick}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Within Dashboard Layout</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CalculationSummary 
                tripId={selectedTripId}
                onMetricClick={handleMetricClick}
              />
            </div>
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-medium mb-2">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md">
                    View Full Report
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md">
                    Export Data
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md">
                    Share Summary
                  </button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Widget Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Real-time Updates</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Live cost calculations via WebSocket</li>
              <li>• Automatic nutrition summary updates</li>
              <li>• Shopping list item count changes</li>
              <li>• Connection status indicators</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Interactive Elements</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Clickable metric cards for navigation</li>
              <li>• Sparkline trend visualization</li>
              <li>• Manual refresh capability</li>
              <li>• Responsive grid layout</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Data Display</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Total cost with per-person breakdown</li>
              <li>• Daily calorie averages</li>
              <li>• Shopping item counts</li>
              <li>• Participant information</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">User Experience</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Loading skeletons for smooth transitions</li>
              <li>• Error states with helpful messages</li>
              <li>• Offline mode with cached data</li>
              <li>• Nutrition warnings display</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Usage Example */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Usage Example</h2>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
          <code>{`import { CalculationSummary } from '@/components/dashboard'

// Basic usage
<CalculationSummary 
  tripId={currentTripId}
/>

// With navigation handlers
<CalculationSummary 
  tripId={currentTripId}
  onMetricClick={(metric) => {
    switch(metric) {
      case 'cost':
        navigate('/trips/cost-breakdown')
        break
      case 'nutrition':
        navigate('/trips/nutrition-analysis')
        break
      case 'shopping':
        navigate('/trips/shopping-list')
        break
    }
  }}
/>

// Custom styling
<CalculationSummary 
  tripId={currentTripId}
  className="max-w-2xl mx-auto"
  onMetricClick={handleMetricClick}
/>`}</code>
        </pre>
      </Card>
    </div>
  )
}

export default CalculationSummaryDemo