# NutritionCalculator Component

A comprehensive nutrition tracking and analysis component for trip meal planning.

## Features

- **Trip-wide Nutrition Summary**: View total nutrition for the entire trip with macronutrient balance visualization
- **Daily Breakdowns**: Expandable daily nutrition details with per-person calculations
- **Participant Tracking**: Individual nutrition tracking based on meal coefficients
- **Goal Monitoring**: Track nutrition against recommended daily values with progress bars
- **Micronutrient Analysis**: Detailed vitamin and mineral tracking with RDV percentages
- **Real-time Updates**: Integrates with WebSocket for live updates when meals change
- **Export Functionality**: Export nutrition reports in JSON format
- **Mobile Responsive**: Fully responsive design with tab navigation

## Usage

```tsx
import { NutritionCalculator } from '@/components/trips'

// Basic usage
<NutritionCalculator trip={trip} />

// With custom styling
<NutritionCalculator 
  trip={trip} 
  className="bg-white rounded-lg shadow"
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| trip | Trip | Yes | The trip object containing participants, days, and meals |
| className | string | No | Additional CSS classes for styling |

## Data Requirements

The component expects recipes to have nutrition data in the following format:

```typescript
interface RecipeNutrition {
  calories: number
  protein: number    // in grams
  carbs: number      // in grams
  fat: number        // in grams
  fiber: number      // in grams
  sodium: number     // in milligrams
  sugar?: number     // in grams
  saturatedFat?: number  // in grams
  cholesterol?: number   // in milligrams
}
```

## Tabs

### Summary Tab
- Trip totals with macronutrient donut chart
- Daily average calculations
- Nutrition balance score (0-100)
- Expandable micronutrient details

### Daily Tab
- Day-by-day nutrition breakdown
- Participant count per day
- Expandable details showing:
  - Macronutrient distribution
  - Goal progress
  - Individual meals

### Participants Tab
- Dropdown to select specific participant or view all
- Individual daily averages
- Personal goal tracking
- Daily nutrition timeline

### Goals Tab
- Information about nutrition goals
- Macronutrient targets (calories, protein, carbs, fats)
- Micronutrient targets (fiber, sodium, sugars, saturated fat)
- Based on general dietary guidelines

## Calculations

### Effective Participants
The component calculates effective participants based on meal coefficients:
```
effectiveParticipants = Σ(participant.mealCoefficients[mealSlot])
```

### Per-Participant Nutrition
Individual portions are calculated as:
```
participantPortion = (coefficient / effectiveParticipants) * totalNutrition
```

### Nutrition Balance Score
The balance score (0-100) evaluates how well macronutrients align with dietary guidelines:
- Protein: 10-35% of calories
- Carbohydrates: 45-65% of calories
- Fats: 20-35% of calories

## WebSocket Integration

The component listens for meal assignment changes:

```typescript
useEffect(() => {
  if (lastMessage?.type === 'meal-assignment-change' && 
      lastMessage.payload.tripId === trip.id) {
    // Trigger recalculation
  }
}, [lastMessage, trip.id])
```

## Export Format

The export generates a JSON file with the following structure:

```json
{
  "trip": {
    "name": "Trip Name",
    "dates": "July 1, 2024 - July 7, 2024"
  },
  "summary": {
    "calories": 15000,
    "proteins_g": 600,
    // ... other nutrients
  },
  "daily": [
    {
      "date": "July 1, 2024",
      "nutrition": { /* daily totals */ }
    }
  ],
  "participants": [
    {
      "name": "John Doe",
      "dailyAverage": { /* average nutrition */ }
    }
  ]
}
```

## Styling

The component uses Tailwind CSS classes and is designed to work with both light and dark themes. Key visual elements:

- Donut charts for macronutrient visualization
- Progress bars for goal tracking
- Color-coded status badges (green/amber/red)
- Expandable/collapsible sections with smooth transitions

## Future Enhancements

Potential improvements for future versions:

1. **Custom Goals**: Allow setting participant-specific nutrition goals
2. **Chart Library Integration**: Add more advanced visualizations with a charting library
3. **PDF Export**: Generate formatted PDF reports
4. **Meal Recommendations**: Suggest meals to meet nutrition goals
5. **Historical Tracking**: Compare nutrition across multiple trips
6. **Allergen Tracking**: Include allergen information in calculations
7. **Cost per Nutrient**: Calculate cost efficiency of nutrition sources