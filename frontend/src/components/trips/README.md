# Trip Components

## MealPlanningBoard

A comprehensive drag-and-drop meal planning interface for organizing meals during trips.

### Features

- **Drag & Drop Interface**: Drag recipes from the sidebar to assign them to meal slots
- **Recipe Filtering**: Search and filter recipes by name, category, and difficulty
- **Visual Feedback**: Visual indicators during dragging and hover states
- **Nutritional Summary**: Real-time calculation of daily nutritional values
- **Batch Operations**:
  - Copy/paste individual days
  - Copy first week to all remaining weeks
  - Clear entire days
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Internationalization**: Full support for English and Czech languages

### Usage

```tsx
import { MealPlanningBoard } from '@/components/trips/MealPlanningBoard'
import type { Trip } from '@/store/slices/tripStore'
import type { Recipe } from '@/types/recipe'

function TripPlanningPage() {
  const trip: Trip = // ... load trip data
  const recipes: Recipe[] = // ... load available recipes
  
  return (
    <MealPlanningBoard 
      trip={trip} 
      recipes={recipes} 
    />
  )
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `trip` | `Trip` | The trip object containing days, meal slots, and existing meal assignments |
| `recipes` | `Recipe[]` | Array of available recipes that can be assigned to meal slots |

### Architecture

The component is built using:
- **@hello-pangea/dnd**: Modern drag-and-drop library (maintained fork of react-beautiful-dnd)
- **Zustand**: For state management via `useTripStore`
- **Tailwind CSS**: For styling with dark mode support
- **react-i18next**: For internationalization

### Component Structure

1. **RecipeCardDraggable**: Draggable recipe cards in the sidebar
2. **MealSlotDroppable**: Drop zones for each meal slot (breakfast, lunch, dinner, snack)
3. **DayCard**: Individual day containers with meal slots and nutrition summary
4. **Main Board**: Orchestrates the drag-and-drop context and manages the overall layout

### State Management

The component integrates with the trip store for:
- `assignMeal`: Assigns a recipe to a specific meal slot
- `removeMeal`: Removes a meal from a slot
- `updateTrip`: Updates trip data (for future enhancements)

### Responsive Behavior

- **Desktop**: Side-by-side layout with sticky recipe sidebar
- **Tablet**: Adjustable grid layout for day cards
- **Mobile**: Stacked layout with collapsible sections

### Future Enhancements

- Moving meals between different slots
- Bulk meal operations (copy/paste multiple meals)
- Meal notes and customization
- Serving size adjustments per meal
- Integration with shopping list generation
- Meal plan templates and presets

## CostCalculator

A comprehensive cost calculation and budget tracking component for trip planning with real-time updates and detailed breakdowns.

### Features

- **Total Cost Estimation**: Calculate estimated costs based on ingredient quantities and market prices
- **Per-Participant Breakdown**: Cost distribution based on meal coefficients and attendance days
- **Category Analysis**: Detailed breakdown by ingredient categories (produce, dairy, meat, etc.)
- **Budget Tracking**: Visual indicators with variance analysis and over-budget warnings
- **Real-time Updates**: WebSocket integration for live price and quantity changes
- **Price Strategies**: Multiple estimation modes (conservative, average, optimistic)
- **Currency Support**: Multi-currency with proper formatting
- **Export Functionality**: Download detailed cost reports in JSON format
- **Responsive Design**: Mobile-friendly interface with collapsible sections
- **Visual Charts**: Progress bars and indicators for budget status

### Usage

```tsx
import { CostCalculator } from '@/components/trips/CostCalculator'
import { Decimal } from 'decimal.js'

function TripCostAnalysis() {
  const ingredients = [
    {
      ingredientId: '1',
      name: 'Tomatoes',
      quantity: new Decimal(2),
      unit: 'kg',
      category: 'produce'
    },
    // ... more ingredients
  ]

  const participants = [
    {
      id: '1',
      name: 'John Doe',
      effectiveCoefficient: 1.0,
      attendanceDays: 7
    },
    // ... more participants
  ]

  return (
    <CostCalculator
      tripId="trip-123"
      ingredients={ingredients}
      participants={participants}
      totalDays={7}
      mealsPerDay={3}
      budget={500}
      currency="USD"
    />
  )
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tripId` | `string` | Yes | Unique identifier for the trip |
| `ingredients` | `Array<Ingredient>` | Yes | List of ingredients with quantities and categories |
| `participants` | `Array<Participant>` | Yes | List of participants with coefficients and attendance |
| `totalDays` | `number` | Yes | Total number of days for the trip |
| `mealsPerDay` | `number` | No | Number of meals per day (default: 3) |
| `budget` | `number` | No | Total budget for the trip |
| `currency` | `string` | No | Currency code (default: 'USD') |
| `className` | `string` | No | Additional CSS classes |

### Ingredient Type

```typescript
interface Ingredient {
  ingredientId: string
  name: string
  quantity: Decimal
  unit: string
  category?: string
}
```

### Participant Type

```typescript
interface Participant {
  id: string
  name: string
  effectiveCoefficient: number
  attendanceDays: number
}
```

### Cost Calculation Logic

1. **Ingredient Costs**: Uses market price estimates based on categories
2. **Total Cost**: Sum of all ingredient costs
3. **Per-Participant Cost**: Based on effective coefficients and attendance days
4. **Category Breakdown**: Groups costs by ingredient categories
5. **Budget Analysis**: Compares estimated costs against budget

### Price Estimation Strategies

- **Conservative**: Uses higher price estimates (max prices)
- **Average**: Uses median price estimates (default)
- **Optimistic**: Uses lower price estimates (min prices)

### WebSocket Events

The component listens for real-time updates:

```typescript
'cost:calculation-update': {
  tripId: string
  totalCost: number
  costPerParticipant: number
  breakdown: {
    ingredients: number
    overhead: number
    tax: number
  }
  participantBreakdown: Array<{
    participantId: string
    participantName: string
    cost: number
    mealCount: number
  }>
  currency: string
  calculatedAt: string
}
```

### Export Format

The exported JSON report includes:
- Trip ID and generation timestamp
- Currency and price strategy used
- Cost summary (total, per participant, per day, per meal)
- Budget status and remaining amount
- Category breakdown with percentages
- Participant breakdown with individual costs

### Integration with Trip Store

```tsx
import { CostCalculatorExample } from '@/components/trips/CostCalculatorExample'

// Automatically integrates with trip store and shopping list
function TripDetailPage({ tripId }: { tripId: string }) {
  return <CostCalculatorExample tripId={tripId} />
}
```

### Styling and Theming

The component uses:
- Tailwind CSS for responsive design
- Dark mode support via CSS variables
- Framer Motion for smooth animations
- Consistent design tokens from the UI library

### Performance Considerations

- Memoized calculations to prevent unnecessary recalculations
- Decimal.js for precise financial calculations
- Debounced WebSocket updates
- Lazy loading of expanded category details

### Accessibility

- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader announcements for updates
- High contrast mode compatibility