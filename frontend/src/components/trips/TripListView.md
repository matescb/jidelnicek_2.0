# TripListView Component

A comprehensive trip management interface that displays trips in both list and calendar views with advanced filtering, sorting, and quick actions.

## Features

### Display Modes
- **List View**: Traditional table layout with sortable columns
- **Calendar View**: Visual calendar display showing trips by date
- **Responsive Design**: Optimized mobile view with card-based layout

### Data Display
- Trip name and location
- Date range with formatted display
- Participant count with icon
- Status badges (planning, active, completed)
- Meal planning progress with visual progress bar
- Budget status indicator (under/over budget)
- Owner/creator information

### Filtering Options
- **Search**: Filter by trip name or destination
- **Status Filter**: Multi-select for planning, active, completed
- **Date Range**: Select start and end date range
- **Advanced Filters**:
  - Participant count range (slider)
  - Specific participant selection
  - Location filter

### Sorting
- Sort by name
- Sort by start date
- Sort by participant count
- Sort by creation date
- Ascending/descending order toggle

### Quick Actions
- View trip details
- Edit trip
- Duplicate trip (creates a copy)
- Archive/unarchive trip
- Actions accessible via dropdown menu

### Visual Indicators
- **Progress Bar**: Shows percentage of meals planned
- **Budget Status**: 
  - Green with down arrow for under budget
  - Red with up arrow for over budget
- **Status Badges**: Color-coded with icons

## Usage

```tsx
import { TripListView } from '@/components/trips'

// Basic usage
function TripsPage() {
  return <TripListView />
}

// With custom selection handler
function TripsWithCustomSelect() {
  const handleTripSelect = (trip: Trip) => {
    console.log('Selected trip:', trip)
    // Custom navigation or modal logic
  }

  return <TripListView onTripSelect={handleTripSelect} />
}

// With custom styling
function StyledTripList() {
  return <TripListView className="custom-trip-list" />
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onTripSelect` | `(trip: Trip) => void` | `undefined` | Custom handler for trip selection. If not provided, navigates to trip detail page |
| `className` | `string` | `''` | Additional CSS classes for styling |

## Store Integration

The component automatically integrates with `useTripStore` and handles:
- Fetching trips with pagination
- Applying filters and sorting
- Trip mutations (duplicate, update, delete)
- Loading and error states

## Mobile Optimization

On mobile devices, the component:
- Switches to card-based layout
- Hides less important columns
- Shows expandable actions
- Maintains all filtering capabilities
- Provides touch-friendly interactions

## Filtering System

The filtering system supports:
- Debounced search (300ms delay)
- Multiple status selection
- Date range selection with calendar picker
- Participant count range with slider
- Active filter badges with remove option
- Clear all filters button

## Calendar View

The calendar view shows:
- Monthly calendar grid
- Trips displayed on their date ranges
- Color-coded by status
- Click to view trip details
- Navigation between months

## Performance Considerations

- Debounced search to reduce API calls
- Pagination for large datasets
- Memoized calculations for progress
- Virtualized list option for very large datasets

## Accessibility

- Keyboard navigation support
- Screen reader announcements
- ARIA labels for interactive elements
- Focus management in dropdowns
- Color contrast compliance

## Related Components

- `TripFilters`: Advanced filtering interface
- `TripCalendarView`: Calendar display mode
- `DataTable`: Base table component
- `TripWizard`: Trip creation flow

## Examples

See `TripListViewDemo.tsx` for comprehensive examples including:
- Basic implementation
- Custom actions
- Programmatic filter control
- Integration patterns