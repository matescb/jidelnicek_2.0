# Dashboard Components

This directory contains dashboard-specific components for the Jidelnicek application.

## Components

### CalculationSummary

A real-time dashboard widget that displays key trip metrics with WebSocket integration.

#### Features

- **Real-time Updates**: Automatically updates when cost, nutrition, or shopping list data changes
- **Interactive Metrics**: Click on metric cards to navigate to detailed views
- **Trend Visualization**: Sparkline charts show historical trends for cost and calories
- **Responsive Design**: Adapts to different screen sizes with grid layout
- **Loading States**: Skeleton loaders for smooth transitions
- **Error Handling**: Graceful offline mode with cached data display
- **Nutrition Warnings**: Displays important nutrition alerts

#### Usage

```tsx
import { CalculationSummary } from '@/components/dashboard'

// Basic usage
<CalculationSummary 
  tripId={currentTripId}
/>

// With navigation handlers
<CalculationSummary 
  tripId={currentTripId}
  onMetricClick={(metric) => {
    // Handle navigation to detailed views
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
/>
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tripId` | `string` | No | ID of the trip to display metrics for |
| `className` | `string` | No | Additional CSS classes for styling |
| `onMetricClick` | `(metric: 'cost' \| 'nutrition' \| 'shopping') => void` | No | Callback when a metric card is clicked |

#### WebSocket Events

The component subscribes to the following WebSocket events:

- `cost:calculation-update` - Updates total cost and per-person breakdown
- `nutrition:summary-update` - Updates daily calorie averages and warnings
- `shopping-list:update` - Updates shopping item counts

#### Metrics Displayed

1. **Total Cost**
   - Total trip cost with currency formatting
   - Cost per person calculation
   - Historical trend visualization

2. **Daily Calories**
   - Average calories per person per day
   - Trend chart for calorie changes

3. **Shopping Items**
   - Count of unique ingredients needed
   - Real-time updates as meals are added/removed

4. **Participants**
   - Total participant count
   - Active trip status indicator

## Demo

To see the component in action, run the demo:

```tsx
import { CalculationSummaryDemo } from '@/components/dashboard/CalculationSummaryDemo'

// In your routes
<Route path="/demo/calculation-summary" element={<CalculationSummaryDemo />} />
```

## Styling

The component uses Tailwind CSS classes and follows the application's design system. It automatically adapts to light/dark themes.

### Customization

You can customize the appearance by:

1. Passing custom `className` prop
2. Overriding CSS variables for colors
3. Adjusting the grid layout with wrapper elements

## Performance Considerations

- Uses React hooks for efficient re-renders
- Implements debouncing for WebSocket updates
- Limits sparkline data points to prevent memory issues
- Lazy loads trend charts only when data is available

## Future Enhancements

- [ ] Add export functionality for metrics
- [ ] Implement date range filtering
- [ ] Add comparison mode for multiple trips
- [ ] Include more detailed nutrition breakdowns
- [ ] Add budget tracking integration
- [ ] Implement metric goal setting