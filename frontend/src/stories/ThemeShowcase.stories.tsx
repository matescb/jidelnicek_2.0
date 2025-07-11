import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Alert } from '../components/ui/alert';
import { useTheme } from '../hooks/useTheme';

const meta = {
  title: 'Theme/Showcase',
  parameters: {
    layout: 'padded',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ThemeShowcase = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div className="space-y-8 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Theme Showcase</h1>
        <p className="text-muted-foreground">
          Current theme: <Badge variant="outline">{theme}</Badge>
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Interactive Elements</h2>
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button variant="default">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          
          <div className="flex items-center gap-4">
            <Switch id="theme-switch" />
            <Label htmlFor="theme-switch">Enable notifications</Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Enter your email" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Card Example</h3>
          <p className="text-sm text-muted-foreground">
            This is a card component that adapts to the current theme.
          </p>
        </Card>
        
        <Card className="p-6 bg-muted">
          <h3 className="font-semibold mb-2">Muted Background</h3>
          <p className="text-sm text-muted-foreground">
            This card has a muted background color.
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        <Alert>
          <h4 className="font-semibold">Default Alert</h4>
          <p className="text-sm">This is a default alert message.</p>
        </Alert>
        
        <Alert variant="destructive">
          <h4 className="font-semibold">Error Alert</h4>
          <p className="text-sm">This is an error alert message.</p>
        </Alert>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>
    </div>
  );
};

export const Default: Story = {
  render: () => <ThemeShowcase />,
};

export const ColorPalette: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <h2 className="text-2xl font-bold mb-4">Color Palette</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Primary Colors</h3>
          <div className="flex gap-4 flex-wrap">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary rounded-lg mb-2" />
              <p className="text-sm">Primary</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-foreground rounded-lg mb-2 border" />
              <p className="text-sm">Primary FG</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Background Colors</h3>
          <div className="flex gap-4 flex-wrap">
            <div className="text-center">
              <div className="w-20 h-20 bg-background rounded-lg mb-2 border" />
              <p className="text-sm">Background</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-muted rounded-lg mb-2" />
              <p className="text-sm">Muted</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-card rounded-lg mb-2 border" />
              <p className="text-sm">Card</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Border & Text Colors</h3>
          <div className="flex gap-4 flex-wrap">
            <div className="text-center">
              <div className="w-20 h-20 border-2 border-border rounded-lg mb-2" />
              <p className="text-sm">Border</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-foreground rounded-lg mb-2" />
              <p className="text-sm">Foreground</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-muted-foreground rounded-lg mb-2" />
              <p className="text-sm">Muted FG</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Semantic Colors</h3>
          <div className="flex gap-4 flex-wrap">
            <div className="text-center">
              <div className="w-20 h-20 bg-destructive rounded-lg mb-2" />
              <p className="text-sm">Destructive</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-success rounded-lg mb-2" />
              <p className="text-sm">Success</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-warning rounded-lg mb-2" />
              <p className="text-sm">Warning</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className="space-y-8 p-8 max-w-4xl">
      <h2 className="text-2xl font-bold mb-4">Typography</h2>
      
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Heading 1</h1>
          <h2 className="text-3xl font-bold mb-2">Heading 2</h2>
          <h3 className="text-2xl font-bold mb-2">Heading 3</h3>
          <h4 className="text-xl font-bold mb-2">Heading 4</h4>
          <h5 className="text-lg font-bold mb-2">Heading 5</h5>
          <h6 className="text-base font-bold mb-2">Heading 6</h6>
        </div>

        <div className="space-y-2">
          <p className="text-lg">Large text paragraph</p>
          <p>Regular paragraph text with normal font size.</p>
          <p className="text-sm">Small text paragraph</p>
          <p className="text-xs">Extra small text paragraph</p>
        </div>

        <div className="space-y-2">
          <p className="font-bold">Bold text</p>
          <p className="font-semibold">Semibold text</p>
          <p className="font-medium">Medium text</p>
          <p className="font-normal">Normal text</p>
          <p className="font-light">Light text</p>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground">Muted text color</p>
          <p className="text-primary">Primary text color</p>
          <p className="text-destructive">Destructive text color</p>
          <p className="text-success">Success text color</p>
          <p className="text-warning">Warning text color</p>
        </div>
      </div>
    </div>
  ),
};