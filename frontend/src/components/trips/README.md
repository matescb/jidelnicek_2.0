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