import type { Meta, StoryObj } from '@storybook/react';
import { ThemeToggle } from './ThemeToggle';
import { ThemeToggleAdvanced } from './ThemeToggleAdvanced';
import { ThemeToggleEnhanced } from './ThemeToggleEnhanced';
import { ThemeToggleMobile } from './ThemeToggleMobile';

const meta: Meta<typeof ThemeToggle> = {
  title: 'Navigation/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Theme toggle components for switching between light and dark modes. Use the theme switcher in the toolbar to see how these components adapt to different themes.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="p-8 rounded-lg bg-background">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Basic theme toggle button',
      },
    },
  },
};

export const Advanced: Story = {
  render: () => <ThemeToggleAdvanced />,
  parameters: {
    docs: {
      description: {
        story: 'Advanced theme toggle with dropdown menu for system theme option',
      },
    },
  },
};

export const Enhanced: Story = {
  render: () => <ThemeToggleEnhanced />,
  parameters: {
    docs: {
      description: {
        story: 'Enhanced theme toggle with smooth animations and tooltips',
      },
    },
  },
};

export const Mobile: Story = {
  render: () => <ThemeToggleMobile />,
  parameters: {
    docs: {
      description: {
        story: 'Mobile-optimized theme toggle with larger touch targets',
      },
    },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Default</h3>
        <ThemeToggle />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Advanced</h3>
        <ThemeToggleAdvanced />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Enhanced</h3>
        <ThemeToggleEnhanced />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Mobile</h3>
        <ThemeToggleMobile />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All theme toggle variants displayed together',
      },
    },
  },
};