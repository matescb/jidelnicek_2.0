import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './Tooltip';
import { Button } from './button';
import { Info, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Flexible tooltip component with multiple positions, triggers, and customization options.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    placement: {
      control: 'select',
      options: [
        'top', 'top-start', 'top-end',
        'bottom', 'bottom-start', 'bottom-end',
        'left', 'left-start', 'left-end',
        'right', 'right-start', 'right-end'
      ],
    },
    trigger: {
      control: 'select',
      options: ['hover', 'click', 'focus', 'manual'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: 'select',
      options: ['dark', 'light'],
    },
    showDelay: {
      control: { type: 'number', min: 0, max: 2000, step: 100 },
    },
    hideDelay: {
      control: { type: 'number', min: 0, max: 2000, step: 100 },
    },
    offset: {
      control: { type: 'number', min: 0, max: 50, step: 1 },
    },
    arrow: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
    flip: {
      control: 'boolean',
    },
    interactive: {
      control: 'boolean',
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[200px] flex items-center justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic examples
export const Default: Story = {
  args: {
    content: 'This is a tooltip',
    children: <Button>Hover me</Button>,
  },
};

export const WithText: Story = {
  args: {
    content: 'Hello! This is a helpful tooltip message.',
    children: <span className="underline cursor-help">Hover over this text</span>,
  },
};

export const WithIcon: Story = {
  args: {
    content: 'Click for more information',
    trigger: 'click',
    children: <HelpCircle className="h-5 w-5 text-gray-500 cursor-pointer" />,
  },
};

// Placement examples
export const Placements: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-8 p-8">
      <div className="col-start-2 space-y-2">
        <Tooltip content="Top Start" placement="top-start">
          <Button variant="outline" size="sm">Top Start</Button>
        </Tooltip>
        <Tooltip content="Top" placement="top">
          <Button variant="outline" size="sm" className="w-full">Top</Button>
        </Tooltip>
        <Tooltip content="Top End" placement="top-end">
          <Button variant="outline" size="sm" className="ml-auto block">Top End</Button>
        </Tooltip>
      </div>
      
      <div className="space-y-2">
        <Tooltip content="Left Start" placement="left-start">
          <Button variant="outline" size="sm">Left Start</Button>
        </Tooltip>
        <Tooltip content="Left" placement="left">
          <Button variant="outline" size="sm">Left</Button>
        </Tooltip>
        <Tooltip content="Left End" placement="left-end">
          <Button variant="outline" size="sm">Left End</Button>
        </Tooltip>
      </div>
      
      <div className="col-start-2 row-start-2 flex items-center justify-center">
        <Button variant="secondary">Center</Button>
      </div>
      
      <div className="col-start-3 row-start-2 space-y-2 text-right">
        <Tooltip content="Right Start" placement="right-start">
          <Button variant="outline" size="sm">Right Start</Button>
        </Tooltip>
        <Tooltip content="Right" placement="right">
          <Button variant="outline" size="sm">Right</Button>
        </Tooltip>
        <Tooltip content="Right End" placement="right-end">
          <Button variant="outline" size="sm">Right End</Button>
        </Tooltip>
      </div>
      
      <div className="col-start-2 row-start-3 space-y-2">
        <Tooltip content="Bottom Start" placement="bottom-start">
          <Button variant="outline" size="sm">Bottom Start</Button>
        </Tooltip>
        <Tooltip content="Bottom" placement="bottom">
          <Button variant="outline" size="sm" className="w-full">Bottom</Button>
        </Tooltip>
        <Tooltip content="Bottom End" placement="bottom-end">
          <Button variant="outline" size="sm" className="ml-auto block">Bottom End</Button>
        </Tooltip>
      </div>
    </div>
  ),
};

// Trigger modes
export const HoverTrigger: Story = {
  args: {
    content: 'Shown on hover',
    trigger: 'hover',
    children: <Button>Hover trigger</Button>,
  },
};

export const ClickTrigger: Story = {
  args: {
    content: 'Click to toggle this tooltip',
    trigger: 'click',
    children: <Button>Click trigger</Button>,
  },
};

export const FocusTrigger: Story = {
  args: {
    content: 'Shown on focus',
    trigger: 'focus',
    children: <input className="px-3 py-2 border rounded" placeholder="Focus me" />,
  },
};

export const MultipleTriggers: Story = {
  args: {
    content: 'Hover or click me',
    trigger: ['hover', 'click'],
    children: <Button>Multiple triggers</Button>,
  },
};

// Sizes
export const Small: Story = {
  args: {
    content: 'Small tooltip',
    size: 'sm',
    children: <Button size="sm">Small</Button>,
  },
};

export const Medium: Story = {
  args: {
    content: 'Medium tooltip',
    size: 'md',
    children: <Button>Medium</Button>,
  },
};

export const Large: Story = {
  args: {
    content: 'Large tooltip with more content',
    size: 'lg',
    children: <Button size="lg">Large</Button>,
  },
};

// Variants
export const DarkVariant: Story = {
  args: {
    content: 'Dark tooltip (default)',
    variant: 'dark',
    children: <Button>Dark variant</Button>,
  },
};

export const LightVariant: Story = {
  args: {
    content: 'Light tooltip',
    variant: 'light',
    children: <Button>Light variant</Button>,
  },
};

// Features
export const WithoutArrow: Story = {
  args: {
    content: 'No arrow pointing to trigger',
    arrow: false,
    children: <Button>No arrow</Button>,
  },
};

export const CustomOffset: Story = {
  args: {
    content: 'Custom offset from trigger',
    offset: 20,
    children: <Button>20px offset</Button>,
  },
};

export const LongContent: Story = {
  args: {
    content: 'This is a very long tooltip content that will wrap to multiple lines when it reaches the maximum width constraint.',
    maxWidth: 200,
    children: <Button>Long content</Button>,
  },
};

export const Interactive: Story = {
  args: {
    content: (
      <div>
        <p className="mb-2">Interactive tooltip content</p>
        <Button size="sm" variant="secondary">Click me</Button>
      </div>
    ),
    interactive: true,
    trigger: 'hover',
    children: <Button>Interactive tooltip</Button>,
  },
};

export const WithDelay: Story = {
  args: {
    content: 'Appears after 1 second',
    showDelay: 1000,
    children: <Button>Delayed tooltip</Button>,
  },
};

export const Disabled: Story = {
  args: {
    content: 'This tooltip is disabled',
    disabled: true,
    children: <Button>Disabled tooltip</Button>,
  },
};

// Complex content
export const RichContent: Story = {
  args: {
    content: (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="font-semibold">Success!</span>
        </div>
        <p className="text-sm">Your changes have been saved.</p>
        <p className="text-xs text-gray-400">Last updated: 2 minutes ago</p>
      </div>
    ),
    size: 'lg',
    children: <Button variant="success">Rich content</Button>,
  },
};

// Real-world examples
export const FormFieldHelp: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Username
          <Tooltip content="Must be 3-20 characters long and contain only letters, numbers, and underscores">
            <Info className="inline-block ml-1 h-4 w-4 text-gray-400" />
          </Tooltip>
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded"
          placeholder="Enter username"
        />
      </div>
    </div>
  ),
};

export const IconButtons: Story = {
  render: () => (
    <div className="flex gap-4">
      <Tooltip content="Information">
        <Button size="icon" variant="ghost">
          <Info className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Help" placement="bottom">
        <Button size="icon" variant="ghost">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Warning" placement="bottom" variant="light">
        <Button size="icon" variant="ghost">
          <AlertCircle className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  ),
};

export const TableActions: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Tooltip content="Edit item">
        <Button size="sm" variant="ghost">Edit</Button>
      </Tooltip>
      <Tooltip content="Duplicate item">
        <Button size="sm" variant="ghost">Duplicate</Button>
      </Tooltip>
      <Tooltip content="Delete item" variant="light">
        <Button size="sm" variant="ghost" className="text-red-600">Delete</Button>
      </Tooltip>
    </div>
  ),
};

// Controlled example
const ControlledExample = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => setOpen(true)}>Show tooltip</Button>
        <Button onClick={() => setOpen(false)} variant="outline">Hide tooltip</Button>
      </div>
      <Tooltip
        content="Controlled tooltip"
        open={open}
        onOpenChange={setOpen}
        trigger="manual"
      >
        <Button variant="secondary">Controlled target</Button>
      </Tooltip>
    </div>
  );
};

export const Controlled: Story = {
  render: () => <ControlledExample />,
};

// Kitchen sink
export const AllFeatures: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Tooltip Examples</h3>
        
        <div className="grid grid-cols-3 gap-4">
          <Tooltip content="Default tooltip">
            <Button variant="outline">Default</Button>
          </Tooltip>
          
          <Tooltip content="Click me!" trigger="click" variant="light">
            <Button variant="outline">Click trigger</Button>
          </Tooltip>
          
          <Tooltip content="No arrow" arrow={false}>
            <Button variant="outline">No arrow</Button>
          </Tooltip>
          
          <Tooltip content="Large size" size="lg">
            <Button variant="outline">Large</Button>
          </Tooltip>
          
          <Tooltip content="With delay" showDelay={1000}>
            <Button variant="outline">Delayed</Button>
          </Tooltip>
          
          <Tooltip 
            content={
              <div>
                <strong>Interactive content</strong>
                <p className="text-xs mt-1">You can hover over this</p>
              </div>
            }
            interactive
          >
            <Button variant="outline">Interactive</Button>
          </Tooltip>
        </div>
      </div>
    </div>
  ),
};