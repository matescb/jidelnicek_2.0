# Breadcrumb Navigation System

A comprehensive breadcrumb navigation system with automatic route-based generation, custom breadcrumb support, and mobile-friendly responsive design.

## Features

- **Auto-generation from routes** - Automatically generates breadcrumbs based on the current route
- **Custom breadcrumbs** - Override auto-generated breadcrumbs with custom ones
- **Dynamic segments** - Handles dynamic route parameters (e.g., `:id`)
- **Mobile-friendly** - Responsive design with configurable truncation
- **Icon support** - Add icons to any breadcrumb item
- **Flexible truncation** - Choose between middle or end truncation modes
- **Context-based state** - Manage breadcrumbs globally with React Context
- **TypeScript support** - Fully typed for better developer experience

## Basic Usage

### 1. Wrap your app with BreadcrumbProvider

```tsx
import { BreadcrumbProvider } from '@/components/navigation/breadcrumbs';

function App() {
  return (
    <BreadcrumbProvider autoGenerate={true}>
      <Router>
        {/* Your app routes */}
      </Router>
    </BreadcrumbProvider>
  );
}
```

### 2. Display breadcrumbs in your layout

```tsx
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';

function Layout() {
  return (
    <div>
      <header>
        <Breadcrumbs />
      </header>
      <main>{/* Page content */}</main>
    </div>
  );
}
```

## Advanced Usage

### Custom Breadcrumb Title

Set a custom title for the current page:

```tsx
import { useBreadcrumbTitle } from '@/components/navigation/breadcrumbs';

function RecipeDetail() {
  const { id } = useParams();
  const recipe = useRecipe(id);
  
  // Update breadcrumb when recipe loads
  useBreadcrumbTitle(recipe?.name || 'Loading...', [recipe]);
  
  return <div>{/* Recipe content */}</div>;
}
```

### Completely Custom Breadcrumbs

Override auto-generated breadcrumbs:

```tsx
import { useSetBreadcrumbs } from '@/components/navigation/breadcrumbs';

function CustomPage() {
  const setBreadcrumbs = useSetBreadcrumbs();
  
  useEffect(() => {
    const cleanup = setBreadcrumbs([
      { id: 'home', label: 'Dashboard', path: '/dashboard' },
      { id: 'reports', label: 'Reports', path: '/reports' },
      { id: 'current', label: 'Sales Report', isActive: true },
    ]);
    
    return cleanup; // Restores auto-generation on unmount
  }, [setBreadcrumbs]);
  
  return <div>{/* Page content */}</div>;
}
```

### Append Breadcrumb

Add a breadcrumb to the current trail:

```tsx
import { useAppendBreadcrumb } from '@/components/navigation/breadcrumbs';

function EditPage() {
  useAppendBreadcrumb({
    label: 'Edit',
    icon: <EditIcon className="h-4 w-4" />,
  });
  
  return <div>{/* Edit form */}</div>;
}
```

### Standalone Breadcrumbs

Use breadcrumbs without the provider:

```tsx
import { SimpleBreadcrumbs } from '@/components/navigation/breadcrumbs';

function StandalonePage() {
  const items = [
    { label: 'Home', path: '/' },
    { label: 'Products', path: '/products' },
    { label: 'Electronics' },
  ];
  
  return <SimpleBreadcrumbs items={items} />;
}
```

## Configuration

### Breadcrumbs Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `separator` | `ReactNode` | `<ChevronRightIcon />` | Custom separator element |
| `showHome` | `boolean` | `true` | Show home icon for root breadcrumb |
| `maxItems` | `number` | - | Maximum items to display (overrides responsive defaults) |
| `mobileMaxItems` | `number` | `2` | Maximum items on mobile |
| `desktopMaxItems` | `number` | `5` | Maximum items on desktop |
| `truncateMode` | `'middle' \| 'end'` | `'middle'` | How to truncate long breadcrumb trails |
| `itemClassName` | `string` | - | CSS classes for breadcrumb items |
| `linkClassName` | `string` | - | CSS classes for breadcrumb links |
| `activeClassName` | `string` | - | CSS classes for active breadcrumb |
| `separatorClassName` | `string` | - | CSS classes for separators |

### BreadcrumbProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoGenerate` | `boolean` | `true` | Automatically generate breadcrumbs from routes |
| `children` | `ReactNode` | - | Child components |

## Route Configuration

To customize auto-generated breadcrumbs, add metadata to your route configuration:

```tsx
const routes: RouteConfig[] = [
  {
    path: '/recipes/:id',
    component: RecipeDetail,
    meta: {
      title: 'Recipe Detail',
      breadcrumb: (params) => `Recipe ${params.id}`,
      icon: <RecipeIcon />,
    },
  },
];
```

## Hooks

### `useBreadcrumbs()`
Get the current breadcrumb items.

### `useSetBreadcrumbs()`
Set custom breadcrumbs (returns cleanup function).

### `useBreadcrumbTitle(title, dependencies)`
Update the title of the current breadcrumb.

### `useBreadcrumbOperations()`
Get breadcrumb manipulation functions (push, pop, replace, clear).

### `useTemporaryBreadcrumbs(breadcrumbs, enabled)`
Temporarily override breadcrumbs with automatic cleanup.

### `useAppendBreadcrumb(breadcrumb)`
Append a breadcrumb to the current trail.

## Styling

The breadcrumb components use Tailwind CSS classes by default. You can customize the appearance by:

1. **Using component props** - Pass custom class names via props
2. **CSS modules** - Import and use your own styles
3. **Tailwind utilities** - Apply utilities directly via className props

Example custom styling:

```tsx
<Breadcrumbs
  className="bg-gray-100 rounded-lg p-2"
  linkClassName="text-blue-600 hover:text-blue-800"
  activeClassName="text-gray-900 font-bold"
  separatorClassName="text-gray-400"
/>
```

## TypeScript Types

```typescript
interface BreadcrumbItem {
  id: string;
  label: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  isDynamic?: boolean;
  params?: Record<string, string>;
}

interface BreadcrumbConfig {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  showHome?: boolean;
  maxItems?: number;
  truncateMode?: 'middle' | 'end';
  className?: string;
}
```

## Examples

Check out `BreadcrumbsExample.tsx` for comprehensive usage examples including:

- Basic auto-generated breadcrumbs
- Custom breadcrumb titles
- Completely custom breadcrumbs
- Appending breadcrumbs
- Standalone usage
- Different configurations and styling options