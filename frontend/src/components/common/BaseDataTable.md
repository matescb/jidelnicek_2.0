# BaseDataTable Component Documentation

A highly customizable and feature-rich data table component built with React and TypeScript.

## Features

- **Generic TypeScript support** - Works with any data type
- **Sorting** - Single and multi-column sorting
- **Pagination** - Customizable page sizes and navigation
- **Selection** - Single and multi-row selection
- **Search/Filter** - Global search across filterable columns
- **Column Management** - Show/hide columns dynamically
- **Responsive Design** - Table on desktop, cards on mobile
- **Export** - CSV export built-in, custom export handlers supported
- **Virtualization** - Optional support for large datasets
- **Sticky Header** - Keep headers visible while scrolling
- **Custom Rendering** - Custom cell renderers and formatters
- **Loading/Error/Empty States** - Built-in state handling
- **Accessibility** - ARIA labels and keyboard navigation

## Basic Usage

```tsx
import { BaseDataTable, Column } from '@/components/common/BaseDataTable';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const columns: Column<User>[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email', sortable: true },
  { key: 'role', header: 'Role' },
];

function UserTable() {
  const [users, setUsers] = useState<User[]>([]);

  return (
    <BaseDataTable
      data={users}
      columns={columns}
      getRowKey={(user) => user.id}
    />
  );
}
```

## Advanced Features

### Custom Cell Rendering

```tsx
const columns: Column<User>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (value, user) => (
      <div className="flex items-center gap-2">
        <Avatar src={user.avatar} />
        <span>{value}</span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (value) => (
      <Badge variant={value === 'active' ? 'success' : 'default'}>
        {value}
      </Badge>
    ),
  },
];
```

### Selection

```tsx
function SelectableTable() {
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  return (
    <BaseDataTable
      data={users}
      columns={columns}
      getRowKey={(user) => user.id}
      selectable
      multiSelect
      selectedRows={selectedUsers}
      onSelectionChange={setSelectedUsers}
    />
  );
}
```

### Multi-Column Sorting

```tsx
<BaseDataTable
  data={users}
  columns={columns}
  getRowKey={(user) => user.id}
  multiSort
  defaultSort={[
    { key: 'role', direction: 'asc' },
    { key: 'name', direction: 'asc' },
  ]}
/>
```

### Global Search

```tsx
function SearchableTable() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <BaseDataTable
      data={users}
      columns={columns}
      getRowKey={(user) => user.id}
      searchable
      globalFilter={searchTerm}
      onGlobalFilterChange={setSearchTerm}
      searchPlaceholder="Search users..."
    />
  );
}
```

### Custom Export

```tsx
<BaseDataTable
  data={users}
  columns={columns}
  getRowKey={(user) => user.id}
  exportable
  exportFilename="users-report"
  onExport={(data, selectedOnly) => {
    // Custom export logic
    if (selectedOnly) {
      console.log('Exporting selected rows:', data);
    } else {
      console.log('Exporting all rows:', data);
    }
  }}
/>
```

### Row Actions

```tsx
<BaseDataTable
  data={users}
  columns={columns}
  getRowKey={(user) => user.id}
  onRowClick={(user) => {
    navigate(`/users/${user.id}`);
  }}
  rowClassName={(user) => 
    user.status === 'inactive' ? 'opacity-50' : ''
  }
/>
```

### Sticky Columns

```tsx
const columns: Column<User>[] = [
  {
    key: 'id',
    header: 'ID',
    sticky: true, // This column will stick to the left
    width: '80px',
  },
  // ... other columns
];
```

## Virtualization for Large Datasets

For tables with thousands of rows, use the `VirtualizedDataTable` component:

```tsx
import { VirtualizedDataTable } from '@/components/common/VirtualizedDataTable';

<VirtualizedDataTable
  data={largeDataset} // 10,000+ rows
  columns={columns}
  getRowKey={(item) => item.id}
  rowHeight={48}
  overscan={5}
/>
```

## Utility Functions

The package includes helpful utilities for common table operations:

```tsx
import {
  createDateColumn,
  createCurrencyColumn,
  createBooleanColumn,
  exportToCSV,
  exportToJSON,
} from '@/components/common/dataTableUtils';

// Pre-configured column types
const columns: Column<Order>[] = [
  createDateColumn('createdAt', 'Date Created'),
  createCurrencyColumn('total', 'Total', 'USD'),
  createBooleanColumn('paid', 'Payment Status', 'Paid', 'Unpaid'),
];

// Export utilities
exportToCSV(data, columns, 'orders-export');
exportToJSON(data, 'orders-export');
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | required | Array of data items |
| `columns` | `Column<T>[]` | required | Column definitions |
| `getRowKey` | `(item: T) => string \| number` | required | Function to get unique key for each row |
| `loading` | `boolean` | `false` | Show loading state |
| `error` | `string` | - | Error message to display |
| `pageSize` | `number` | `10` | Number of rows per page |
| `pageSizeOptions` | `number[]` | `[10, 25, 50, 100]` | Available page size options |
| `selectable` | `boolean` | `false` | Enable row selection |
| `multiSelect` | `boolean` | `false` | Enable multi-row selection |
| `selectedRows` | `T[]` | `[]` | Currently selected rows |
| `onSelectionChange` | `(rows: T[]) => void` | - | Selection change handler |
| `defaultSort` | `SortConfig[]` | `[]` | Default sort configuration |
| `multiSort` | `boolean` | `false` | Enable multi-column sorting |
| `searchable` | `boolean` | `true` | Show search input |
| `searchPlaceholder` | `string` | `'Search...'` | Search input placeholder |
| `globalFilter` | `string` | `''` | Global filter value |
| `onGlobalFilterChange` | `(value: string) => void` | - | Filter change handler |
| `striped` | `boolean` | `true` | Alternate row colors |
| `hoverable` | `boolean` | `true` | Highlight rows on hover |
| `compact` | `boolean` | `false` | Reduce row padding |
| `stickyHeader` | `boolean` | `true` | Keep header visible on scroll |
| `maxHeight` | `string` | `'600px'` | Maximum table height |
| `onRowClick` | `(item: T) => void` | - | Row click handler |
| `rowClassName` | `(item: T) => string` | - | Dynamic row class names |
| `exportable` | `boolean` | `true` | Show export button |
| `exportFilename` | `string` | `'data-export'` | Export file name |
| `onExport` | `(data: T[], selected: boolean) => void` | - | Custom export handler |
| `emptyMessage` | `string` | `'No data available'` | Empty state message |
| `emptyIcon` | `ReactNode` | - | Empty state icon |

## Column Configuration

Each column supports the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `key` | `keyof T \| string` | Property key or custom identifier |
| `header` | `string` | Column header text |
| `accessor` | `(item: T) => any` | Custom value accessor |
| `render` | `(value: any, item: T) => ReactNode` | Custom cell renderer |
| `sortable` | `boolean` | Enable sorting for this column |
| `filterable` | `boolean` | Include in global search |
| `visible` | `boolean` | Column visibility |
| `width` | `string` | Fixed column width |
| `sticky` | `boolean` | Sticky column (left side) |

## Performance Tips

1. **Use `getRowKey` efficiently** - Return a primitive value (string/number)
2. **Memoize columns** - Define columns outside component or use `useMemo`
3. **Virtualize large datasets** - Use `VirtualizedDataTable` for 1000+ rows
4. **Debounce search** - Already built-in, but can be customized
5. **Optimize renders** - Use `React.memo` for custom cell renderers

## Accessibility

The component includes:
- Proper ARIA labels
- Keyboard navigation support
- Screen reader announcements
- Focus management
- High contrast mode support

## Styling

The component uses Tailwind CSS classes and can be customized via:
- The `className` prop for the container
- `rowClassName` for dynamic row styles
- Custom cell renderers for cell-level styling
- CSS variables for theme customization