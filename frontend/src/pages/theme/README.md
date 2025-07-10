# Theme Showcase Page

The Theme Showcase page is a comprehensive display of all theme-related components and styling options in the application. It's only available in development mode to help developers verify that the dark mode implementation works correctly across all components.

## Access

In development mode, you can access the theme showcase page through:

1. **Direct URL**: Navigate to `/theme-showcase`
2. **Development Menu**: Click the beaker icon in the header (only visible in dev mode)

## Features

### 1. Color Palettes
- **Primary Colors**: Full spectrum from 50-900
- **Secondary Colors**: Full spectrum from 50-900
- **Status Colors**: Success, Warning, Error, Info (shades 400-600)
- **Neutral/Gray Colors**: Full spectrum from 50-900
- **Click to Copy**: Click any color swatch to copy its value to clipboard

### 2. Backgrounds & Surfaces
- Main background colors
- Card and panel backgrounds
- Surface variants for different elevation levels

### 3. Typography
- All heading levels (H1-H6)
- Text color variations (primary, secondary, muted, disabled)
- Colored text examples for all theme colors

### 4. Buttons
- **Variants**: Primary, Secondary, Success, Warning, Danger, Ghost, Link
- **Sizes**: Small, Medium, Large
- **States**: Normal, Disabled, Loading
- **Icon Buttons**: Examples with icons on left or right

### 5. Form Components
- Text inputs (normal, required, disabled, with error)
- Password input with visibility toggle
- Select dropdowns
- Textareas
- Checkboxes (normal and disabled)
- Radio buttons

### 6. Cards & Elevations
- Shadow levels from sm to 2xl
- Gradient cards
- Border variations

### 7. Alerts & Notifications
- Success, Warning, Error, and Info alert styles
- Toast notification triggers
- Icons and proper color coding

### 8. Badges & Tags
- Status badges (Active, Pending, Expired, etc.)
- Category tags (Breakfast, Lunch, Dinner, etc.)
- Pill badges with icons

### 9. Table Styles
- Header styling
- Row hover effects
- Status badges within tables
- Dark mode compatible borders

### 10. Loading States
- Spinner animation
- Skeleton pulse effect
- Loading dots animation

### 11. Borders & Dividers
- Default, primary, dashed, and dotted borders
- Horizontal dividers of various thicknesses
- Colored dividers

### 12. Theme Transitions
- Smooth color transitions when switching themes
- Consistent theming across all components

## Theme Toggle Components

The page showcases both theme toggle implementations:
1. **Simple Toggle**: Basic light/dark mode switch
2. **Advanced Toggle**: Three-state toggle (Light/Dark/System)

## Development Usage

Use this page to:
- Verify dark mode implementation across all components
- Check color contrast ratios
- Test theme transitions
- Copy color values for use in other components
- Ensure consistent styling throughout the application

## Testing

The page includes comprehensive tests to ensure:
- All sections render correctly
- Color copy functionality works
- Theme toggling is functional
- All component variants are displayed
- Form interactions work as expected

## Notes

- This page is only available when `import.meta.env.DEV` is true
- The route is conditionally added to avoid it being included in production builds
- All color values can be copied by clicking on the color swatches
- The page is fully responsive and works on all screen sizes