# ComboBox Component

A comprehensive combo box component with search functionality, built from scratch using Radix UI Popover as the foundation.

## Features

- 🔍 **Search/Filter**: Real-time search with customizable filter logic
- ✅ **Single & Multi-select**: Support for both single and multiple selections
- 🔄 **Async Loading**: Load options dynamically with loading states
- 🎨 **Custom Rendering**: Render options with custom components
- 👥 **Grouped Options**: Organize options into groups
- ❌ **Clear Button**: Easy way to clear selections
- ➕ **Create Options**: Allow users to create new options on the fly
- 📱 **Fully Accessible**: Keyboard navigation and ARIA support
- 🚀 **Virtualization**: Handle large datasets efficiently
- 🎯 **TypeScript**: Full type safety with generics
- 🌙 **Dark Mode**: Seamless dark mode support
- 📏 **Size Variants**: Small, medium, and large sizes

## Basic Usage

```tsx
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'

const options: ComboboxOption[] = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
]

function MyComponent() {
  const [value, setValue] = useState<string | null>(null)
  
  return (
    <Combobox
      options={options}
      value={value}
      onChange={setValue}
      placeholder="Select a framework..."
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `ComboboxOption[]` | `[]` | Array of options to display |
| `value` | `string \| string[]` | - | Selected value(s) |
| `onChange` | `(value) => void` | - | Callback when selection changes |
| `placeholder` | `string` | `"Select an option..."` | Placeholder text |
| `searchPlaceholder` | `string` | `"Search..."` | Search input placeholder |
| `emptyMessage` | `string` | `"No options found."` | Message when no options match |
| `loadingMessage` | `string` | `"Loading..."` | Message during loading |
| `createMessage` | `(search) => string` | - | Message for create option |
| `multiple` | `boolean` | `false` | Enable multi-select mode |
| `disabled` | `boolean` | `false` | Disable the combobox |
| `loading` | `boolean` | `false` | Show loading state |
| `async` | `boolean` | `false` | Enable async mode |
| `onSearch` | `(search) => void` | - | Async search handler |
| `onCreate` | `(search) => void` | - | Create option handler |
| `allowCreate` | `boolean` | `false` | Allow creating new options |
| `clearable` | `boolean` | `true` | Show clear button |
| `virtualize` | `boolean` | `true` | Enable virtualization |
| `virtualItemHeight` | `number` | `40` | Height of virtual items |
| `renderOption` | `function` | - | Custom option renderer |
| `filterOption` | `function` | - | Custom filter function |
| `groupSort` | `function` | - | Custom group sort function |
| `maxSelectedDisplay` | `number` | `3` | Max badges to show in multi-select |
| `error` | `boolean` | `false` | Show error state |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |

## Examples

### Multi-Select with Groups

```tsx
const fruits: ComboboxOption[] = [
  { value: 'apple', label: 'Apple', group: 'Common' },
  { value: 'banana', label: 'Banana', group: 'Common' },
  { value: 'mango', label: 'Mango', group: 'Tropical' },
]

<Combobox
  options={fruits}
  value={selectedFruits}
  onChange={setSelectedFruits}
  multiple
  placeholder="Select fruits..."
/>
```

### Async Search

```tsx
const [options, setOptions] = useState<ComboboxOption[]>([])
const [loading, setLoading] = useState(false)

const handleSearch = async (search: string) => {
  setLoading(true)
  const results = await fetchUsers(search)
  setOptions(results)
  setLoading(false)
}

<Combobox
  options={options}
  async
  loading={loading}
  onSearch={handleSearch}
  placeholder="Search users..."
/>
```

### Custom Option Rendering

```tsx
interface User {
  id: string
  name: string
  avatar: string
}

const renderUser = (option: ComboboxOption<User>) => (
  <div className="flex items-center gap-2">
    <img src={option.data.avatar} className="w-8 h-8 rounded-full" />
    <span>{option.label}</span>
  </div>
)

<Combobox
  options={userOptions}
  renderOption={renderUser}
/>
```

### Create New Options

```tsx
const [tags, setTags] = useState<ComboboxOption[]>([])

const handleCreate = async (value: string) => {
  const newTag = { value: value.toLowerCase(), label: value }
  setTags([...tags, newTag])
}

<Combobox
  options={tags}
  allowCreate
  onCreate={handleCreate}
  createMessage={(search) => `Create tag "${search}"`}
/>
```

## Keyboard Navigation

- `↓` / `↑` - Navigate through options
- `Enter` - Select highlighted option
- `Escape` - Close dropdown
- `Tab` - Close dropdown and move focus
- Type to search/filter options

## Accessibility

The ComboBox component follows WAI-ARIA guidelines:

- Proper ARIA attributes (`role="combobox"`, `aria-expanded`, etc.)
- Keyboard navigation support
- Screen reader friendly
- Focus management
- Disabled state handling

## Performance

- **Virtualization**: Automatically enabled for lists with 20+ items
- **Debounced Search**: 300ms debounce for async searches
- **Memoization**: Options are memoized to prevent unnecessary re-renders
- **Lazy Rendering**: Only visible options are rendered

## Styling

The component uses Tailwind CSS classes and respects the application's theme:

- Inherits border, background, and text colors from theme
- Dark mode support via CSS variables
- Customizable via `className` prop
- Size variants affect padding and font size

## TypeScript

The component is fully typed with TypeScript generics:

```tsx
interface Product {
  id: string
  name: string
  price: number
}

const options: ComboboxOption<Product>[] = [
  {
    value: '1',
    label: 'iPhone',
    data: { id: '1', name: 'iPhone', price: 999 }
  }
]

// Type-safe data access
const renderProduct = (option: ComboboxOption<Product>) => {
  return <div>{option.data.name} - ${option.data.price}</div>
}
```