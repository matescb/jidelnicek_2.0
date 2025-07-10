import React, { useState } from 'react'
import { Combobox, type ComboboxOption } from './combobox'
import { Avatar } from './avatar'
import { Badge } from './badge'

// Sample data
const fruits: ComboboxOption[] = [
  { value: 'apple', label: 'Apple', group: 'Common Fruits' },
  { value: 'banana', label: 'Banana', group: 'Common Fruits' },
  { value: 'orange', label: 'Orange', group: 'Common Fruits' },
  { value: 'grape', label: 'Grape', group: 'Common Fruits' },
  { value: 'strawberry', label: 'Strawberry', group: 'Berries' },
  { value: 'blueberry', label: 'Blueberry', group: 'Berries' },
  { value: 'raspberry', label: 'Raspberry', group: 'Berries' },
  { value: 'mango', label: 'Mango', group: 'Tropical' },
  { value: 'pineapple', label: 'Pineapple', group: 'Tropical' },
  { value: 'watermelon', label: 'Watermelon', group: 'Melons' },
  { value: 'cantaloupe', label: 'Cantaloupe', group: 'Melons' },
  { value: 'honeydew', label: 'Honeydew', group: 'Melons' },
]

// Sample user data with avatars
interface User {
  id: string
  name: string
  email: string
  avatar: string
  department: string
  status: 'active' | 'inactive' | 'away'
}

const users: ComboboxOption<User>[] = [
  {
    value: '1',
    label: 'John Doe',
    group: 'Engineering',
    data: {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
      department: 'Engineering',
      status: 'active'
    }
  },
  {
    value: '2',
    label: 'Jane Smith',
    group: 'Engineering',
    data: {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane',
      department: 'Engineering',
      status: 'away'
    }
  },
  {
    value: '3',
    label: 'Bob Johnson',
    group: 'Design',
    data: {
      id: '3',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
      department: 'Design',
      status: 'active'
    }
  },
  {
    value: '4',
    label: 'Alice Williams',
    group: 'Design',
    disabled: true,
    data: {
      id: '4',
      name: 'Alice Williams',
      email: 'alice@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      department: 'Design',
      status: 'inactive'
    }
  },
  {
    value: '5',
    label: 'Charlie Brown',
    group: 'Marketing',
    data: {
      id: '5',
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
      department: 'Marketing',
      status: 'active'
    }
  },
]

// Generate many items for virtualization demo
const manyItems: ComboboxOption[] = Array.from({ length: 1000 }, (_, i) => ({
  value: `item-${i}`,
  label: `Item ${i + 1}`,
  group: `Group ${Math.floor(i / 100) + 1}`
}))

export function ComboBoxExample() {
  const [singleValue, setSingleValue] = useState<string | null>(null)
  const [multiValue, setMultiValue] = useState<string[] | null>(null)
  const [asyncValue, setAsyncValue] = useState<string | null>(null)
  const [createValue, setCreateValue] = useState<string | null>(null)
  const [userValue, setUserValue] = useState<string | null>(null)
  const [largeValue, setLargeValue] = useState<string | null>(null)
  
  // Async options state
  const [asyncOptions, setAsyncOptions] = useState<ComboboxOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Dynamic options for create example
  const [dynamicOptions, setDynamicOptions] = useState<ComboboxOption[]>([
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'angular', label: 'Angular' },
  ])

  // Simulate async search
  const handleAsyncSearch = async (search: string) => {
    setIsLoading(true)
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Filter fruits based on search
    const filtered = fruits.filter(fruit => 
      fruit.label.toLowerCase().includes(search.toLowerCase())
    )
    setAsyncOptions(filtered)
    setIsLoading(false)
  }

  // Handle creating new option
  const handleCreate = async (value: string) => {
    const newOption: ComboboxOption = {
      value: value.toLowerCase().replace(/\s+/g, '-'),
      label: value
    }
    setDynamicOptions([...dynamicOptions, newOption])
    setCreateValue(newOption.value)
  }

  // Custom render for user options
  const renderUserOption = (option: ComboboxOption<User>, isSelected: boolean) => {
    const user = option.data
    if (!user) return option.label

    return (
      <div className="flex items-center gap-3 w-full">
        <Avatar
          src={user.avatar}
          alt={user.name}
          fallback={user.name.charAt(0)}
          className="h-8 w-8"
        />
        <div className="flex-1 text-left">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
        {user.status === 'active' && (
          <Badge variant="success" size="sm">Active</Badge>
        )}
        {user.status === 'away' && (
          <Badge variant="warning" size="sm">Away</Badge>
        )}
        {user.status === 'inactive' && (
          <Badge variant="secondary" size="sm">Inactive</Badge>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8 p-8 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold mb-4">ComboBox Examples</h2>
        <p className="text-muted-foreground">
          A comprehensive combobox component with search, multi-select, async loading, and more.
        </p>
      </div>

      {/* Basic single select */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Basic Single Select</h3>
        <Combobox
          options={fruits}
          value={singleValue}
          onChange={(value) => setSingleValue(value as string | null)}
          placeholder="Select a fruit..."
        />
        <p className="text-sm text-muted-foreground">
          Selected: {singleValue || 'None'}
        </p>
      </div>

      {/* Multi-select */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Multi-Select with Groups</h3>
        <Combobox
          options={fruits}
          value={multiValue}
          onChange={(value) => setMultiValue(value as string[] | null)}
          placeholder="Select fruits..."
          multiple
          maxSelectedDisplay={2}
        />
        <p className="text-sm text-muted-foreground">
          Selected: {multiValue?.join(', ') || 'None'}
        </p>
      </div>

      {/* Async loading */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Async Search</h3>
        <Combobox
          options={asyncOptions}
          value={asyncValue}
          onChange={(value) => setAsyncValue(value as string | null)}
          placeholder="Search for fruits..."
          async
          loading={isLoading}
          onSearch={handleAsyncSearch}
          loadingMessage="Searching fruits..."
          emptyMessage="No fruits found. Try searching!"
        />
        <p className="text-sm text-muted-foreground">
          Type to search fruits from the server
        </p>
      </div>

      {/* Create new option */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Create New Options</h3>
        <Combobox
          options={dynamicOptions}
          value={createValue}
          onChange={(value) => setCreateValue(value as string | null)}
          placeholder="Select or create framework..."
          allowCreate
          onCreate={handleCreate}
          createMessage={(search) => `Add "${search}" as new framework`}
        />
        <p className="text-sm text-muted-foreground">
          Type to search or create new options
        </p>
      </div>

      {/* Custom rendering */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Custom Option Rendering</h3>
        <Combobox
          options={users}
          value={userValue}
          onChange={(value) => setUserValue(value as string | null)}
          placeholder="Select a user..."
          renderOption={renderUserOption}
          searchPlaceholder="Search by name or email..."
          filterOption={(option, search) => {
            const user = option.data as User
            return (
              user.name.toLowerCase().includes(search.toLowerCase()) ||
              user.email.toLowerCase().includes(search.toLowerCase())
            )
          }}
        />
        <p className="text-sm text-muted-foreground">
          Custom rendered options with avatars and status badges
        </p>
      </div>

      {/* Large dataset with virtualization */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Large Dataset (1000 items)</h3>
        <Combobox
          options={manyItems}
          value={largeValue}
          onChange={(value) => setLargeValue(value as string | null)}
          placeholder="Select from many items..."
          virtualize
          virtualItemHeight={32}
        />
        <p className="text-sm text-muted-foreground">
          Virtualized list for performance with large datasets
        </p>
      </div>

      {/* Different sizes */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Size Variants</h3>
        <div className="space-y-4">
          <Combobox
            options={fruits.slice(0, 5)}
            placeholder="Small size"
            size="sm"
          />
          <Combobox
            options={fruits.slice(0, 5)}
            placeholder="Medium size (default)"
            size="md"
          />
          <Combobox
            options={fruits.slice(0, 5)}
            placeholder="Large size"
            size="lg"
          />
        </div>
      </div>

      {/* States */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Different States</h3>
        <div className="space-y-4">
          <Combobox
            options={fruits.slice(0, 5)}
            placeholder="Disabled state"
            disabled
          />
          <Combobox
            options={fruits.slice(0, 5)}
            placeholder="Error state"
            error
          />
          <Combobox
            options={[]}
            placeholder="Loading state"
            loading
            loadingMessage="Loading options..."
          />
        </div>
      </div>
    </div>
  )
}