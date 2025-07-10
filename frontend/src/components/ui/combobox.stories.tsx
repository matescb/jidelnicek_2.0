import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Combobox, type ComboboxOption } from './combobox';

const meta = {
  title: 'Components/ComboBox',
  component: Combobox,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Advanced select component with search, multi-select, async loading, and create options.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    multiple: {
      control: 'boolean',
    },
    clearable: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
    loading: {
      control: 'boolean',
    },
    error: {
      control: 'boolean',
    },
    virtualize: {
      control: 'boolean',
    },
    allowCreate: {
      control: 'boolean',
    },
  },
  decorators: [
    (Story) => (
      <div className="min-w-[300px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data
const fruits: ComboboxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
  { value: 'elderberry', label: 'Elderberry' },
  { value: 'fig', label: 'Fig' },
  { value: 'grape', label: 'Grape' },
  { value: 'honeydew', label: 'Honeydew' },
];

const groupedOptions: ComboboxOption[] = [
  { value: 'apple', label: 'Apple', group: 'Fruits' },
  { value: 'banana', label: 'Banana', group: 'Fruits' },
  { value: 'cherry', label: 'Cherry', group: 'Fruits' },
  { value: 'carrot', label: 'Carrot', group: 'Vegetables' },
  { value: 'celery', label: 'Celery', group: 'Vegetables' },
  { value: 'corn', label: 'Corn', group: 'Vegetables' },
  { value: 'chicken', label: 'Chicken', group: 'Meat' },
  { value: 'beef', label: 'Beef', group: 'Meat' },
  { value: 'pork', label: 'Pork', group: 'Meat' },
];

const manyOptions: ComboboxOption[] = Array.from({ length: 100 }, (_, i) => ({
  value: `option-${i}`,
  label: `Option ${i + 1}`,
  group: `Group ${Math.floor(i / 10) + 1}`,
}));

// Basic examples
export const Default: Story = {
  args: {
    options: fruits,
    placeholder: 'Select a fruit...',
  },
};

export const WithValue: Story = {
  args: {
    options: fruits,
    value: 'banana',
    placeholder: 'Select a fruit...',
  },
};

export const Disabled: Story = {
  args: {
    options: fruits,
    value: 'apple',
    disabled: true,
    placeholder: 'Select a fruit...',
  },
};

export const Loading: Story = {
  args: {
    options: [],
    loading: true,
    placeholder: 'Select an option...',
  },
};

export const Error: Story = {
  args: {
    options: fruits,
    error: true,
    placeholder: 'Select a fruit...',
  },
};

// Size variants
export const Small: Story = {
  args: {
    options: fruits,
    size: 'sm',
    placeholder: 'Small combobox...',
  },
};

export const Medium: Story = {
  args: {
    options: fruits,
    size: 'md',
    placeholder: 'Medium combobox...',
  },
};

export const Large: Story = {
  args: {
    options: fruits,
    size: 'lg',
    placeholder: 'Large combobox...',
  },
};

// Multiple selection
export const MultiSelect: Story = {
  args: {
    options: fruits,
    multiple: true,
    placeholder: 'Select fruits...',
  },
};

export const MultiSelectWithValues: Story = {
  args: {
    options: fruits,
    multiple: true,
    value: ['apple', 'banana', 'cherry'],
    placeholder: 'Select fruits...',
  },
};

// Grouped options
export const Grouped: Story = {
  args: {
    options: groupedOptions,
    placeholder: 'Select food...',
  },
};

export const GroupedMultiple: Story = {
  args: {
    options: groupedOptions,
    multiple: true,
    placeholder: 'Select foods...',
  },
};

// Virtualized list
export const VirtualizedList: Story = {
  args: {
    options: manyOptions,
    placeholder: 'Select from many options...',
    virtualize: true,
  },
};

// Create option
const CreateExample = () => {
  const [options, setOptions] = React.useState(fruits);
  const [value, setValue] = React.useState<string>('');

  const handleCreate = async (search: string) => {
    const newOption: ComboboxOption = {
      value: search.toLowerCase().replace(/\s+/g, '-'),
      label: search,
    };
    setOptions([...options, newOption]);
    setValue(newOption.value);
  };

  return (
    <Combobox
      options={options}
      value={value}
      onChange={(val) => setValue(val as string)}
      allowCreate
      onCreate={handleCreate}
      placeholder="Select or create..."
      createMessage={(search) => `Create "${search}"`}
    />
  );
};

export const WithCreate: Story = {
  render: () => <CreateExample />,
};

// Async search
const AsyncExample = () => {
  const [options, setOptions] = React.useState<ComboboxOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [value, setValue] = React.useState<string>('');

  const handleSearch = async (search: string) => {
    if (!search) {
      setOptions([]);
      return;
    }

    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const filtered = fruits.filter(fruit => 
      fruit.label.toLowerCase().includes(search.toLowerCase())
    );
    setOptions(filtered);
    setLoading(false);
  };

  return (
    <Combobox
      options={options}
      value={value}
      onChange={(val) => setValue(val as string)}
      onSearch={handleSearch}
      loading={loading}
      async
      placeholder="Search fruits..."
      emptyMessage="Type to search..."
    />
  );
};

export const AsyncSearch: Story = {
  render: () => <AsyncExample />,
};

// Custom render
const CustomRenderExample = () => {
  const optionsWithData: ComboboxOption<{ emoji: string; description: string }>[] = [
    { 
      value: 'apple', 
      label: 'Apple',
      data: { emoji: '🍎', description: 'Red and crunchy' }
    },
    { 
      value: 'banana', 
      label: 'Banana',
      data: { emoji: '🍌', description: 'Yellow and sweet' }
    },
    { 
      value: 'cherry', 
      label: 'Cherry',
      data: { emoji: '🍒', description: 'Small and tart' }
    },
  ];

  const [value, setValue] = React.useState<string>('');

  return (
    <Combobox
      options={optionsWithData}
      value={value}
      onChange={(val) => setValue(val as string)}
      placeholder="Select a fruit..."
      renderOption={(option, isSelected) => (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-xl">{option.data?.emoji}</span>
            <div>
              <div className="font-medium">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.data?.description}</div>
            </div>
          </div>
          {isSelected && <Check className="h-4 w-4" />}
        </div>
      )}
    />
  );
};

export const CustomRender: Story = {
  render: () => <CustomRenderExample />,
};

// Disabled options
export const WithDisabledOptions: Story = {
  args: {
    options: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana', disabled: true },
      { value: 'cherry', label: 'Cherry' },
      { value: 'date', label: 'Date', disabled: true },
      { value: 'elderberry', label: 'Elderberry' },
    ],
    placeholder: 'Some options are disabled...',
  },
};

// No clearable
export const NotClearable: Story = {
  args: {
    options: fruits,
    value: 'apple',
    clearable: false,
    placeholder: 'Cannot be cleared...',
  },
};

// Empty state
export const EmptyState: Story = {
  args: {
    options: [],
    placeholder: 'No options available...',
    emptyMessage: 'No fruits found in the database.',
  },
};

// Kitchen sink
const KitchenSink = () => {
  const [value, setValue] = React.useState<string[]>(['apple', 'banana']);

  return (
    <div className="space-y-4 w-96">
      <h3 className="text-lg font-semibold">ComboBox Examples</h3>
      
      <div>
        <label className="text-sm font-medium mb-1 block">Single Select</label>
        <Combobox options={fruits} placeholder="Select a fruit..." />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Multi Select</label>
        <Combobox 
          options={fruits} 
          multiple 
          value={value}
          onChange={(val) => setValue(val as string[])}
          placeholder="Select multiple fruits..." 
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Grouped Options</label>
        <Combobox options={groupedOptions} placeholder="Select food..." />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">With Create</label>
        <Combobox 
          options={fruits} 
          allowCreate 
          onCreate={(search) => console.log('Create:', search)}
          placeholder="Select or create..." 
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Disabled State</label>
        <Combobox options={fruits} disabled placeholder="Disabled..." />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Loading State</label>
        <Combobox options={[]} loading placeholder="Loading..." />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Error State</label>
        <Combobox options={fruits} error placeholder="Error state..." />
      </div>
    </div>
  );
};

export const AllExamples: Story = {
  render: () => <KitchenSink />,
};