import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { 
  Search, 
  Plus, 
  ChevronRight, 
  Download, 
  Heart, 
  Settings,
  Trash2,
  Mail,
  ArrowRight,
  Check
} from 'lucide-react';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Versatile button component with multiple variants, sizes, loading states, and icon support.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Visual style variant of the button',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Size of the button',
    },
    isLoading: {
      control: 'boolean',
      description: 'Shows loading spinner and disables button',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Makes button take full width of container',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the button',
    },
    loadingText: {
      control: 'text',
      description: 'Text to display when loading',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic variants
export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
};

// Sizes
export const SmallSize: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const DefaultSize: Story = {
  args: {
    size: 'default',
    children: 'Default',
  },
};

export const LargeSize: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};

export const IconSize: Story = {
  args: {
    size: 'icon',
    children: <Settings className="h-4 w-4" />,
  },
};

// States
export const Loading: Story = {
  args: {
    isLoading: true,
    children: 'Submit',
  },
};

export const LoadingWithText: Story = {
  args: {
    isLoading: true,
    loadingText: 'Processing...',
    children: 'Submit',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};

// With Icons
export const WithLeftIcon: Story = {
  args: {
    leftIcon: <Plus className="h-4 w-4" />,
    children: 'Add Item',
  },
};

export const WithRightIcon: Story = {
  args: {
    rightIcon: <ChevronRight className="h-4 w-4" />,
    children: 'Continue',
  },
};

export const WithBothIcons: Story = {
  args: {
    leftIcon: <Download className="h-4 w-4" />,
    rightIcon: <ArrowRight className="h-4 w-4" />,
    children: 'Download',
  },
};

// Complex Examples
export const IconButton: Story = {
  name: 'Icon Buttons',
  render: () => (
    <div className="flex gap-2">
      <Button size="icon" variant="default" aria-label="Like">
        <Heart className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="outline" aria-label="Settings">
        <Settings className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="secondary" aria-label="Mail">
        <Mail className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const ButtonGroup: Story = {
  name: 'Button Group',
  render: () => (
    <div className="flex gap-2">
      <Button variant="secondary">Cancel</Button>
      <Button>Save Changes</Button>
    </div>
  ),
};

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Button variant="default">Default</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
    </div>
  ),
};

export const AllSizes: Story = {
  name: 'All Sizes',
  render: () => (
    <div className="flex gap-2 items-center">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Search className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const LoadingStates: Story = {
  name: 'Loading States',
  render: () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button isLoading>Default Loading</Button>
        <Button isLoading loadingText="Saving...">With Text</Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" isLoading>Small</Button>
        <Button size="lg" isLoading loadingText="Processing...">Large</Button>
      </div>
    </div>
  ),
};

export const RealWorldExamples: Story = {
  name: 'Real World Examples',
  render: () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button leftIcon={<Plus className="h-4 w-4" />}>
          Create Recipe
        </Button>
        <Button variant="outline" leftIcon={<Search className="h-4 w-4" />}>
          Search
        </Button>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm">
          Cancel
        </Button>
        <Button size="sm" rightIcon={<Check className="h-4 w-4" />}>
          Confirm
        </Button>
      </div>
      <div className="flex gap-2">
        <Button variant="destructive" leftIcon={<Trash2 className="h-4 w-4" />}>
          Delete Account
        </Button>
        <Button variant="ghost" rightIcon={<ChevronRight className="h-4 w-4" />}>
          View Details
        </Button>
      </div>
    </div>
  ),
};