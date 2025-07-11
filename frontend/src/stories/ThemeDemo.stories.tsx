import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Alert } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const meta: Meta = {
  title: 'Theme/Demo',
  parameters: {
    docs: {
      description: {
        story: 'Use the theme switcher in the toolbar to see components in different themes. Toggle "Theme Comparison" to see both themes side-by-side.',
      },
    },
  },
};

export default meta;

const ComponentShowcase = () => {
  const [switchState, setSwitchState] = React.useState(false);
  
  return (
    <div className="space-y-8 p-6 bg-background text-foreground">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Theme Showcase</h1>
        <p className="text-muted-foreground">
          Explore how components look in different themes
        </p>
      </div>

      {/* Cards */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Cards & Containers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-2">Default Card</h3>
            <p className="text-sm text-muted-foreground">
              This is a basic card component with standard styling.
            </p>
          </Card>
          <Card className="p-6 border-primary">
            <h3 className="font-semibold mb-2 text-primary">Primary Card</h3>
            <p className="text-sm text-muted-foreground">
              This card has a primary colored border.
            </p>
          </Card>
          <Card className="p-6 bg-muted">
            <h3 className="font-semibold mb-2">Muted Card</h3>
            <p className="text-sm text-muted-foreground">
              This card has a muted background.
            </p>
          </Card>
        </div>
      </section>

      {/* Buttons */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* Form Elements */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Form Elements</h2>
        <Card className="p-6 max-w-md">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter your email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Enter password" />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="notifications"
                checked={switchState}
                onCheckedChange={setSwitchState}
              />
              <Label htmlFor="notifications">Enable notifications</Label>
            </div>
          </div>
        </Card>
      </section>

      {/* Badges & Tags */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Badges & Tags</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>

      {/* Alerts */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Alerts</h2>
        <div className="space-y-3 max-w-2xl">
          <Alert>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h4 className="font-medium">Default Alert</h4>
              <p className="text-sm mt-1">This is a default alert message.</p>
            </div>
          </Alert>
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h4 className="font-medium text-green-800 dark:text-green-200">Success Alert</h4>
              <p className="text-sm mt-1 text-green-700 dark:text-green-300">Operation completed successfully!</p>
            </div>
          </Alert>
        </div>
      </section>

      {/* Tabs */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Tabs</h2>
        <Tabs defaultValue="overview" className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <Card className="p-4">
              <p>This is the overview tab content. It shows general information.</p>
            </Card>
          </TabsContent>
          <TabsContent value="features" className="mt-4">
            <Card className="p-4">
              <p>This tab displays various features of the application.</p>
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <Card className="p-4">
              <p>Configure your preferences in this settings tab.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Color Palette */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Theme Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="h-20 bg-background border rounded-lg mb-2"></div>
            <p className="text-sm font-medium">Background</p>
          </div>
          <div>
            <div className="h-20 bg-foreground rounded-lg mb-2"></div>
            <p className="text-sm font-medium">Foreground</p>
          </div>
          <div>
            <div className="h-20 bg-primary rounded-lg mb-2"></div>
            <p className="text-sm font-medium">Primary</p>
          </div>
          <div>
            <div className="h-20 bg-secondary rounded-lg mb-2"></div>
            <p className="text-sm font-medium">Secondary</p>
          </div>
          <div>
            <div className="h-20 bg-muted rounded-lg mb-2"></div>
            <p className="text-sm font-medium">Muted</p>
          </div>
          <div>
            <div className="h-20 bg-accent rounded-lg mb-2"></div>
            <p className="text-sm font-medium">Accent</p>
          </div>
          <div>
            <div className="h-20 bg-destructive rounded-lg mb-2"></div>
            <p className="text-sm font-medium">Destructive</p>
          </div>
          <div>
            <div className="h-20 bg-border border rounded-lg mb-2"></div>
            <p className="text-sm font-medium">Border</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export const Default: StoryObj = {
  render: () => <ComponentShowcase />,
};

export const CompactView: StoryObj = {
  render: () => (
    <div className="p-6 bg-background">
      <Card className="p-6 max-w-sm mx-auto">
        <h3 className="text-lg font-semibold mb-4">Quick Theme Test</h3>
        <div className="space-y-3">
          <Button className="w-full">Primary Action</Button>
          <Button variant="secondary" className="w-full">Secondary Action</Button>
          <div className="flex gap-2">
            <Badge>New</Badge>
            <Badge variant="secondary">Updated</Badge>
          </div>
        </div>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A compact view to quickly test theme changes',
      },
    },
  },
};