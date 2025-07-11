# Responsive Grid System

A comprehensive grid system for building responsive layouts with CSS Grid and Flexbox, featuring automatic responsive behavior, common layout templates, and container query support.

## Components

### Grid
The main CSS Grid container component with full responsive control.

```tsx
import { Grid, GridItem } from '@/components/layout/grid'

// Basic usage
<Grid columns={3} gap={4}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Grid>

// Responsive columns
<Grid 
  columns={{ base: 1, sm: 2, md: 3, lg: 4 }} 
  gap={{ base: 2, md: 4 }}
>
  {items.map(item => <Card key={item.id} {...item} />)}
</Grid>

// Grid areas
<Grid
  areas={[
    'header header',
    'sidebar content',
    'footer footer'
  ]}
  columns="200px 1fr"
  rows="auto 1fr auto"
>
  <GridItem area="header">Header</GridItem>
  <GridItem area="sidebar">Sidebar</GridItem>
  <GridItem area="content">Content</GridItem>
  <GridItem area="footer">Footer</GridItem>
</Grid>
```

#### Props
- `columns`: Number of columns or responsive configuration
- `rows`: Number of rows or responsive configuration
- `gap`: Gap between items (number in 0.25rem units or string)
- `rowGap` / `columnGap`: Override gap for specific axis
- `areas`: Grid template areas for named layouts
- `alignItems` / `justifyItems`: Item alignment
- `alignContent` / `justifyContent`: Content alignment
- `autoFlow`: Grid auto flow direction
- `containerQueries`: Enable container query support
- `containerName`: Name for container queries
- `containerType`: Type of container query

### GridItem
Individual grid item with positioning and spanning controls.

```tsx
// Spanning columns/rows
<GridItem colSpan={2} rowSpan={2}>
  Large item
</GridItem>

// Responsive spanning
<GridItem colSpan={{ base: 'full', md: 2, lg: 3 }}>
  Responsive item
</GridItem>

// Positioned item
<GridItem colStart={2} colEnd={4} rowStart={1}>
  Positioned item
</GridItem>

// Named area
<GridItem area="sidebar">
  Sidebar content
</GridItem>
```

#### Props
- `colSpan` / `rowSpan`: Number of columns/rows to span
- `colStart` / `colEnd`: Column positioning
- `rowStart` / `rowEnd`: Row positioning
- `area`: Named grid area
- `order`: Display order
- `alignSelf` / `justifySelf`: Self alignment

### ResponsiveGrid
Auto-responsive grid that adjusts column count based on available space.

```tsx
// Basic auto-responsive
<ResponsiveGrid minItemWidth="250px" gap={4}>
  {cards.map(card => <Card key={card.id} {...card} />)}
</ResponsiveGrid>

// With max columns
<ResponsiveGrid 
  minItemWidth="200px" 
  maxColumns={4} 
  gap={4}
>
  {products.map(product => <ProductCard key={product.id} {...product} />)}
</ResponsiveGrid>

// Masonry layout (experimental)
<ResponsiveGrid 
  minItemWidth="300px" 
  masonry 
  masonryGap="1rem"
>
  {images.map(img => <img key={img.id} src={img.url} />)}
</ResponsiveGrid>

// Using presets
<ResponsiveGrid.Cards>
  {items.map(item => <Card key={item.id} {...item} />)}
</ResponsiveGrid.Cards>
```

#### Props
- `minItemWidth`: Minimum width for each item
- `maxItemWidth`: Maximum width for each item
- `maxColumns`: Maximum number of columns
- `fillMode`: 'fit' or 'fill' for auto behavior
- `masonry`: Enable masonry layout
- `masonryGap`: Gap for masonry layout

#### Presets
- `ResponsiveGrid.Cards`: 280px min width, gap 6
- `ResponsiveGrid.Gallery`: 200px min width, gap 4
- `ResponsiveGrid.Products`: 250px min width, gap 5, max 4 columns
- `ResponsiveGrid.Thumbnails`: 120px min width, gap 3
- `ResponsiveGrid.Features`: 300px min width, gap 8, max 3 columns

### FlexGrid
Flexbox-based grid with responsive controls and legacy browser support.

```tsx
// Basic flex layout
<FlexGrid wrap="wrap" gap={4} alignItems="center">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</FlexGrid>

// Responsive columns with flex
<FlexGrid 
  columns={{ base: 1, sm: 2, md: 3 }} 
  gap={4}
>
  {items.map(item => <Card key={item.id} {...item} />)}
</FlexGrid>

// Centered layout
<FlexGrid
  direction="column"
  alignItems="center"
  justifyContent="center"
  gap={6}
>
  <Logo />
  <Title />
  <CallToAction />
</FlexGrid>

// With flex items
<FlexGrid gap={4}>
  <FlexItem grow={1}>Grows</FlexItem>
  <FlexItem basis="200px">Fixed</FlexItem>
  <FlexItem grow={2}>Grows more</FlexItem>
</FlexGrid>
```

#### Props
- `direction`: Flex direction (row, column, etc.)
- `wrap`: Wrap behavior
- `gap`: Gap between items
- `alignItems`: Cross-axis alignment
- `justifyContent`: Main-axis alignment
- `columns`: Number of columns using flex-basis
- `legacyGap`: Use margin-based gap for old browsers

### GridTemplates
Pre-built layout templates for common use cases.

```tsx
import { GridTemplates } from '@/components/layout/grid'

// Hero with sidebar
<GridTemplates.HeroWithSidebar>
  <HeroContent />
  <Sidebar />
</GridTemplates.HeroWithSidebar>

// Dashboard layout
<GridTemplates.Dashboard sidebarWidth="250px">
  <Sidebar />
  <Header />
  <MainContent />
</GridTemplates.Dashboard>

// Holy grail layout
<GridTemplates.HolyGrail>
  <header>Header</header>
  <nav>Navigation</nav>
  <main>Content</main>
  <aside>Sidebar</aside>
  <footer>Footer</footer>
</GridTemplates.HolyGrail>

// Other templates
<GridTemplates.CardGrid />
<GridTemplates.BlogLayout />
<GridTemplates.Gallery />
<GridTemplates.Features />
<GridTemplates.PricingTable />
<GridTemplates.StatsGrid />
<GridTemplates.MasonryGallery />
<GridTemplates.FormLayout />
<GridTemplates.CenteredLayout />
```

## Responsive Values

All spacing and layout props support responsive values:

```tsx
// Single value (applies to all breakpoints)
gap={4}

// Responsive object
gap={{ base: 2, sm: 4, md: 6, lg: 8 }}
columns={{ base: 1, md: 2, lg: 3 }}
```

### Breakpoints
- `base`: 0px
- `xs`: 480px
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## Container Queries

Modern browsers support container queries for truly component-based responsive design:

```tsx
<Grid 
  containerQueries
  containerName="my-grid"
  columns={{ base: 1, sm: 2, md: 3 }}
>
  {/* Children respond to container size, not viewport */}
</Grid>
```

## Examples

### Product Grid
```tsx
<ResponsiveGrid 
  minItemWidth="250px" 
  maxColumns={4}
  gap={{ base: 4, md: 6 }}
>
  {products.map(product => (
    <ProductCard key={product.id} {...product} />
  ))}
</ResponsiveGrid>
```

### Admin Dashboard
```tsx
<GridTemplates.Dashboard sidebarWidth="280px" sidebarCollapsed={isCollapsed}>
  <Sidebar />
  <Header />
  <Grid columns={{ base: 1, lg: 2 }} gap={6}>
    <StatsCard />
    <ChartCard />
    <RecentActivity />
    <QuickActions />
  </Grid>
</GridTemplates.Dashboard>
```

### Landing Page Features
```tsx
<GridTemplates.Features>
  <FeatureCard 
    icon="zap" 
    title="Lightning Fast" 
    description="Optimized for performance"
  />
  <FeatureCard 
    icon="shield" 
    title="Secure" 
    description="Enterprise-grade security"
  />
  <FeatureCard 
    icon="globe" 
    title="Global" 
    description="Available worldwide"
  />
</GridTemplates.Features>
```

### Form Layout
```tsx
<GridTemplates.FormLayout gap={4}>
  <label htmlFor="name">Name</label>
  <input id="name" type="text" />
  
  <label htmlFor="email">Email</label>
  <input id="email" type="email" />
  
  <label htmlFor="message">Message</label>
  <textarea id="message" rows={4} />
  
  <div /> {/* Empty cell */}
  <button type="submit">Send</button>
</GridTemplates.FormLayout>
```

## Browser Support

- **CSS Grid**: All modern browsers (IE 11 with limitations)
- **Flexbox**: All modern browsers (IE 10+ with prefixes)
- **Container Queries**: Chrome 105+, Firefox 110+, Safari 16+
- **Gap property**: All modern browsers (use `legacyGap` for older browsers)

## Performance Tips

1. Use `ResponsiveGrid` for automatic layouts when possible
2. Avoid deeply nested grids
3. Use CSS Grid for 2D layouts, FlexGrid for 1D layouts
4. Enable container queries only when needed
5. Prefer template layouts for common patterns

## TypeScript

All components are fully typed with TypeScript:

```tsx
import { GridProps, ResponsiveValue } from '@/components/layout/grid'

const customColumns: ResponsiveValue<number> = {
  base: 1,
  md: 2,
  lg: 3
}

const MyGrid: React.FC<Partial<GridProps>> = (props) => (
  <Grid columns={customColumns} {...props} />
)
```