# Adaptive Layout Components

A collection of responsive layout components that seamlessly adapt between mobile and desktop interfaces, providing optimal user experience across all device sizes.

## Components Overview

### 1. AdaptiveContainer
A responsive container that adapts its width, padding, and margins based on screen size.

```tsx
import { AdaptiveContainer } from '@/components/layout/adaptive';

<AdaptiveContainer
  variant="fixed"        // 'fluid' | 'fixed' | 'full'
  maxWidth="xl"         // 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl'
  padding="md"          // 'none' | 'sm' | 'md' | 'lg'
  center={true}         // Center the container
  safeArea={true}       // Apply safe area insets
>
  <YourContent />
</AdaptiveContainer>
```

### 2. AdaptiveColumns
Flexible column layout that stacks on mobile and displays side-by-side on desktop.

```tsx
import { AdaptiveColumns } from '@/components/layout/adaptive';

<AdaptiveColumns
  columns={2}           // Number of columns (2-4)
  gap="md"              // 'sm' | 'md' | 'lg' | 'xl'
  stackAt="md"          // 'sm' | 'md' | 'lg' | 'never'
  ratio="1:2"           // '1:1' | '1:2' | '2:1' | '1:3' | '3:1' | 'auto'
  align="stretch"       // 'start' | 'center' | 'end' | 'stretch'
>
  <Column1 />
  <Column2 />
</AdaptiveColumns>
```

### 3. AdaptiveSidebar
Transforms between a drawer on mobile and fixed sidebar on desktop.

```tsx
import { AdaptiveSidebar } from '@/components/layout/adaptive';

<AdaptiveSidebar
  sidebar={<Navigation />}
  side="left"           // 'left' | 'right'
  collapsible={true}    // Allow collapsing on desktop
  breakpoint="lg"       // 'sm' | 'md' | 'lg'
  width="medium"        // 'narrow' | 'medium' | 'wide'
>
  <MainContent />
</AdaptiveSidebar>
```

### 4. AdaptiveDialog
Modal dialog on desktop that transforms to a bottom drawer on mobile.

```tsx
import { AdaptiveDialog } from '@/components/layout/adaptive';

<AdaptiveDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Dialog Title"
  description="Dialog description"
  size="md"             // 'sm' | 'md' | 'lg' | 'xl' | 'full'
  mobileVariant="drawer" // 'dialog' | 'drawer' | 'fullscreen'
  footer={<DialogActions />}
>
  <DialogContent />
</AdaptiveDialog>
```

### 5. AdaptiveTable
Table that converts to cards or list view on mobile devices.

```tsx
import { AdaptiveTable } from '@/components/layout/adaptive';

const columns = [
  { key: 'name', header: 'Name', priority: 'high' },
  { key: 'email', header: 'Email', priority: 'medium' },
  { key: 'role', header: 'Role', priority: 'low' },
];

<AdaptiveTable
  data={users}
  columns={columns}
  mobileVariant="cards"  // 'cards' | 'list' | 'scroll'
  onRowClick={handleClick}
  loading={isLoading}
  emptyMessage="No data found"
/>
```

### 6. AdaptiveForm
Form layout that adapts from multi-column on desktop to single column on mobile.

```tsx
import { AdaptiveForm, AdaptiveFormField, AdaptiveFormSection } from '@/components/layout/adaptive';

<AdaptiveForm onSubmit={handleSubmit} columns={2}>
  <AdaptiveFormSection title="Personal Info" columns={2}>
    <AdaptiveFormField label="First Name" required>
      <Input name="firstName" />
    </AdaptiveFormField>
    
    <AdaptiveFormField label="Email" span="full">
      <Input name="email" type="email" />
    </AdaptiveFormField>
  </AdaptiveFormSection>
  
  <AdaptiveFormActions>
    <Button type="submit">Submit</Button>
  </AdaptiveFormActions>
</AdaptiveForm>
```

### 7. AdaptiveHero
Hero section with responsive text alignment and image positioning.

```tsx
import { AdaptiveHero } from '@/components/layout/adaptive';

<AdaptiveHero
  title="Welcome to Our App"
  subtitle="Responsive Design"
  description="Build beautiful, responsive interfaces"
  variant="split"        // 'default' | 'centered' | 'split' | 'background'
  size="lg"             // 'sm' | 'md' | 'lg' | 'xl'
  align="left"          // 'left' | 'center' | 'right'
  mobileAlign="center"  // Mobile text alignment
  image={{
    src: "/hero-image.jpg",
    alt: "Hero image"
  }}
  actions={
    <>
      <Button>Get Started</Button>
      <Button variant="outline">Learn More</Button>
    </>
  }
/>
```

## Features

### Responsive Breakpoints
- **Mobile**: < 640px (sm)
- **Tablet**: < 768px (md)
- **Desktop**: < 1024px (lg)

### Key Benefits
- **Automatic adaptation**: Components intelligently switch layouts based on screen size
- **Mobile-first**: Optimized for mobile performance and touch interactions
- **Accessibility**: Built with ARIA attributes and keyboard navigation
- **Customizable**: Extensive props for fine-tuning behavior and appearance
- **Type-safe**: Full TypeScript support with proper types

## Usage Examples

### Complete Layout Example
```tsx
import {
  AdaptiveSidebar,
  AdaptiveContainer,
  AdaptiveTable,
  AdaptiveDialog,
} from '@/components/layout/adaptive';

function Dashboard() {
  return (
    <AdaptiveSidebar
      sidebar={<Navigation />}
      breakpoint="lg"
    >
      <AdaptiveContainer maxWidth="xl" padding="lg">
        <h1>Dashboard</h1>
        
        <AdaptiveTable
          data={data}
          columns={columns}
          mobileVariant="cards"
        />
        
        <AdaptiveDialog
          trigger={<Button>Open Settings</Button>}
          title="Settings"
        >
          <SettingsForm />
        </AdaptiveDialog>
      </AdaptiveContainer>
    </AdaptiveSidebar>
  );
}
```

### Form with Responsive Layout
```tsx
function ContactForm() {
  return (
    <AdaptiveForm onSubmit={handleSubmit}>
      <AdaptiveFormSection title="Contact Information" columns={2}>
        <AdaptiveFormField label="Name" span={2}>
          <Input name="name" />
        </AdaptiveFormField>
        
        <AdaptiveFormField label="Email">
          <Input name="email" type="email" />
        </AdaptiveFormField>
        
        <AdaptiveFormField label="Phone">
          <Input name="phone" type="tel" />
        </AdaptiveFormField>
      </AdaptiveFormSection>
      
      <AdaptiveFormActions align="right">
        <Button variant="outline">Cancel</Button>
        <Button type="submit">Submit</Button>
      </AdaptiveFormActions>
    </AdaptiveForm>
  );
}
```

## Best Practices

1. **Use semantic breakpoints**: Choose breakpoints that make sense for your content, not arbitrary device sizes
2. **Test on real devices**: Always test adaptive behavior on actual mobile devices
3. **Consider touch targets**: Ensure interactive elements are large enough for touch on mobile
4. **Progressive enhancement**: Start with mobile layout and enhance for larger screens
5. **Performance**: Use lazy loading and virtualization for large datasets in tables

## Customization

All components accept standard className props for additional styling:

```tsx
<AdaptiveContainer
  className="bg-gray-50 dark:bg-gray-900"
  padding="lg"
>
  <Content />
</AdaptiveContainer>
```

Components are built with Tailwind CSS and can be customized using utility classes or by extending the component styles.