import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const WelcomePage = () => (
  <div className="prose prose-lg dark:prose-invert max-w-4xl mx-auto p-8">
    <h1>Welcome to Jidelnicek Component Library</h1>
    
    <p className="lead">
      Welcome to the Jidelnicek UI component library! This Storybook contains all the reusable components used throughout the application.
    </p>

    <h2>🎨 Component Categories</h2>

    <h3>Core Components</h3>
    <ul>
      <li><strong>Button</strong> - Primary action buttons with multiple variants and sizes</li>
      <li><strong>Dialog</strong> - Modal dialogs for user interactions</li>
      <li><strong>Toast</strong> - Notification system for user feedback</li>
      <li><strong>Tooltip</strong> - Contextual information on hover/focus</li>
    </ul>

    <h3>Form Components</h3>
    <ul>
      <li><strong>ComboBox</strong> - Advanced select with search and multi-select support</li>
      <li><strong>Input Fields</strong> - Text inputs with validation</li>
      <li><strong>Select</strong> - Dropdown selection components</li>
      <li><strong>Checkbox & Radio</strong> - Selection controls</li>
    </ul>

    <h3>Layout Components</h3>
    <ul>
      <li><strong>Cards</strong> - Content containers with various styles
        <ul>
          <li>RecipeCard</li>
          <li>RestaurantCard</li>
          <li>WeeklyMenuCard</li>
          <li>TripCard</li>
        </ul>
      </li>
      <li><strong>Grid & List</strong> - Responsive layout components</li>
      <li><strong>Navigation</strong> - App navigation components</li>
    </ul>

    <h3>Feedback Components</h3>
    <ul>
      <li><strong>Loading</strong> - Loading states and spinners
        <ul>
          <li>LoadingSpinner</li>
          <li>LoadingOverlay</li>
          <li>Skeleton loaders</li>
        </ul>
      </li>
      <li><strong>Empty States</strong> - No content displays</li>
      <li><strong>Error Boundaries</strong> - Error handling components</li>
    </ul>

    <h2>🎯 Design Principles</h2>
    <ol>
      <li><strong>Consistency</strong> - All components follow the same design language</li>
      <li><strong>Accessibility</strong> - WCAG 2.1 AA compliant components</li>
      <li><strong>Responsiveness</strong> - Mobile-first design approach</li>
      <li><strong>Performance</strong> - Optimized for fast rendering</li>
      <li><strong>Customization</strong> - Flexible theming with Tailwind CSS</li>
    </ol>

    <h2>🚀 Getting Started</h2>
    <p>Browse the component stories in the sidebar to:</p>
    <ul>
      <li>View different component states and variants</li>
      <li>Interact with live component examples</li>
      <li>Copy code snippets for implementation</li>
      <li>Test responsive behavior</li>
      <li>Toggle between light and dark modes</li>
    </ul>

    <h2>🛠️ Development</h2>
    <p>To add new stories:</p>
    <ol>
      <li>Create a <code>.stories.tsx</code> file next to your component</li>
      <li>Export your component variations</li>
      <li>Add controls for interactive props</li>
      <li>Document usage with JSDoc comments</li>
    </ol>

    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
      <pre className="text-sm"><code>{`export default {
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    docs: {
      description: {
        component: 'Description of what the component does',
      },
    },
  },
  argTypes: {
    // Define controls here
  },
} as Meta<typeof MyComponent>;`}</code></pre>
    </div>

    <h2>📚 Resources</h2>
    <ul>
      <li>Component Guidelines</li>
      <li>Design Tokens</li>
      <li>Accessibility Guide</li>
      <li>Contributing</li>
    </ul>

    <p className="text-xl mt-8">Happy building! 🎉</p>
  </div>
);

const meta = {
  title: 'Welcome',
  component: WelcomePage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof WelcomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Welcome: Story = {};