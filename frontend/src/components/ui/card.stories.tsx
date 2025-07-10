import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
  CardImage,
  CardActions
} from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Heart, MessageCircle, Share2, Clock, Users, Star } from 'lucide-react';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Versatile card component with multiple variants, elevations, and interactive states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'success', 'warning', 'error', 'gradient'],
    },
    elevation: {
      control: 'select',
      options: ['flat', 'raised', 'elevated'],
    },
    border: {
      control: 'select',
      options: ['none', 'subtle', 'prominent'],
    },
    interactive: {
      control: 'select',
      options: ['static', 'hover', 'clickable'],
    },
    loading: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
    selected: {
      control: 'boolean',
    },
    withAnimation: {
      control: 'boolean',
    },
    animationType: {
      control: 'select',
      options: ['scale', 'fade', 'slide'],
    },
  },
  decorators: [
    (Story) => (
      <div className="min-w-[350px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic examples
export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the card content. You can put any content here.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
};

// Variants
export const Variants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <Card variant="default">
        <CardHeader>
          <CardTitle>Default</CardTitle>
        </CardHeader>
        <CardContent>Default variant</CardContent>
      </Card>
      
      <Card variant="primary">
        <CardHeader>
          <CardTitle>Primary</CardTitle>
        </CardHeader>
        <CardContent>Primary variant</CardContent>
      </Card>
      
      <Card variant="secondary">
        <CardHeader>
          <CardTitle>Secondary</CardTitle>
        </CardHeader>
        <CardContent>Secondary variant</CardContent>
      </Card>
      
      <Card variant="success">
        <CardHeader>
          <CardTitle>Success</CardTitle>
        </CardHeader>
        <CardContent>Success variant</CardContent>
      </Card>
      
      <Card variant="warning">
        <CardHeader>
          <CardTitle>Warning</CardTitle>
        </CardHeader>
        <CardContent>Warning variant</CardContent>
      </Card>
      
      <Card variant="error">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>Error variant</CardContent>
      </Card>
      
      <Card variant="gradient" className="col-span-2">
        <CardHeader>
          <CardTitle>Gradient</CardTitle>
        </CardHeader>
        <CardContent>Gradient variant</CardContent>
      </Card>
    </div>
  ),
};

// Elevations
export const Elevations: Story = {
  render: () => (
    <div className="space-y-4">
      <Card elevation="flat">
        <CardHeader>
          <CardTitle>Flat</CardTitle>
        </CardHeader>
        <CardContent>No shadow</CardContent>
      </Card>
      
      <Card elevation="raised">
        <CardHeader>
          <CardTitle>Raised</CardTitle>
        </CardHeader>
        <CardContent>Small shadow</CardContent>
      </Card>
      
      <Card elevation="elevated">
        <CardHeader>
          <CardTitle>Elevated</CardTitle>
        </CardHeader>
        <CardContent>Large shadow</CardContent>
      </Card>
    </div>
  ),
};

// Interactive states
export const Interactive: Story = {
  render: () => (
    <div className="space-y-4">
      <Card interactive="static">
        <CardHeader>
          <CardTitle>Static</CardTitle>
        </CardHeader>
        <CardContent>No interaction</CardContent>
      </Card>
      
      <Card interactive="hover">
        <CardHeader>
          <CardTitle>Hover</CardTitle>
        </CardHeader>
        <CardContent>Scales on hover</CardContent>
      </Card>
      
      <Card interactive="clickable">
        <CardHeader>
          <CardTitle>Clickable</CardTitle>
        </CardHeader>
        <CardContent>Click me!</CardContent>
      </Card>
    </div>
  ),
};

// States
export const Loading: Story = {
  args: {
    loading: true,
  },
  render: (args) => <Card {...args} />,
};

export const Disabled: Story = {
  render: () => (
    <Card disabled>
      <CardHeader>
        <CardTitle>Disabled Card</CardTitle>
      </CardHeader>
      <CardContent>This card is disabled</CardContent>
    </Card>
  ),
};

export const Selected: Story = {
  render: () => (
    <Card selected>
      <CardHeader>
        <CardTitle>Selected Card</CardTitle>
      </CardHeader>
      <CardContent>This card is selected</CardContent>
    </Card>
  ),
};

// With ribbon
export const WithRibbon: Story = {
  render: () => (
    <Card ribbon={{ text: 'NEW', color: 'primary' }}>
      <CardHeader>
        <CardTitle>New Feature</CardTitle>
      </CardHeader>
      <CardContent>Check out this new feature!</CardContent>
    </Card>
  ),
};

// With image
export const WithImage: Story = {
  render: () => (
    <Card>
      <CardImage 
        src="https://via.placeholder.com/400x200" 
        alt="Placeholder"
      />
      <CardHeader>
        <CardTitle>Card with Image</CardTitle>
        <CardDescription>Beautiful image header</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Content below the image</p>
      </CardContent>
    </Card>
  ),
};

// With image overlay
export const WithImageOverlay: Story = {
  render: () => (
    <Card>
      <CardImage 
        src="https://via.placeholder.com/400x200" 
        alt="Placeholder"
        overlay
        overlayContent={
          <>
            <h3 className="text-lg font-semibold">Overlay Title</h3>
            <p className="text-sm">Overlay description</p>
          </>
        }
      />
      <CardContent className="pt-4">
        <p>Content below the image</p>
      </CardContent>
    </Card>
  ),
};

// With animations
export const Animated: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <Card withAnimation animationType="scale">
        <CardHeader>
          <CardTitle>Scale</CardTitle>
        </CardHeader>
        <CardContent>Scales in</CardContent>
      </Card>
      
      <Card withAnimation animationType="fade">
        <CardHeader>
          <CardTitle>Fade</CardTitle>
        </CardHeader>
        <CardContent>Fades in</CardContent>
      </Card>
      
      <Card withAnimation animationType="slide">
        <CardHeader>
          <CardTitle>Slide</CardTitle>
        </CardHeader>
        <CardContent>Slides in</CardContent>
      </Card>
    </div>
  ),
};

// Complex examples
export const RecipeCard: Story = {
  render: () => (
    <Card interactive="hover" className="max-w-sm">
      <CardImage 
        src="https://via.placeholder.com/400x250" 
        alt="Recipe"
        height="h-52"
      />
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">Spaghetti Carbonara</CardTitle>
          <Button size="icon" variant="ghost">
            <Heart className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Classic Italian pasta dish</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>30 min</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>4 servings</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-current text-yellow-500" />
            <span>4.8</span>
          </div>
        </div>
      </CardContent>
      <CardActions>
        <Button variant="outline" size="sm">View Recipe</Button>
        <Button size="sm">Cook Now</Button>
      </CardActions>
    </Card>
  ),
};

export const ProfileCard: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader className="text-center">
        <Avatar className="w-20 h-20 mx-auto mb-4">
          <AvatarImage src="https://via.placeholder.com/80" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <CardTitle>John Doe</CardTitle>
        <CardDescription>Software Developer</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          Passionate about creating beautiful and functional web applications.
        </p>
      </CardContent>
      <CardFooter className="justify-center gap-2">
        <Button size="sm">Follow</Button>
        <Button size="sm" variant="outline">Message</Button>
      </CardFooter>
    </Card>
  ),
};

export const StatCard: Story = {
  render: () => (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Total Revenue</CardDescription>
        <CardTitle className="text-3xl">$45,231.89</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          <span className="text-green-600">+20.1%</span> from last month
        </p>
      </CardContent>
    </Card>
  ),
};

export const SocialCard: Story = {
  render: () => (
    <Card interactive="hover">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src="https://via.placeholder.com/40" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-base">John Doe</CardTitle>
            <CardDescription className="text-xs">2 hours ago</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p>Just launched my new project! Check it out and let me know what you think 🚀</p>
      </CardContent>
      <CardImage 
        src="https://via.placeholder.com/400x200" 
        alt="Post image"
        height="h-48"
      />
      <CardActions align="between">
        <div className="flex gap-4">
          <Button variant="ghost" size="sm">
            <Heart className="h-4 w-4 mr-1" />
            24
          </Button>
          <Button variant="ghost" size="sm">
            <MessageCircle className="h-4 w-4 mr-1" />
            12
          </Button>
          <Button variant="ghost" size="sm">
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
        </div>
      </CardActions>
    </Card>
  ),
};

// Kitchen sink
export const AllFeatures: Story = {
  render: () => (
    <div className="grid gap-4 max-w-4xl">
      <div className="grid grid-cols-3 gap-4">
        <Card variant="primary" elevation="elevated" interactive="hover">
          <CardHeader>
            <CardTitle>Interactive</CardTitle>
          </CardHeader>
          <CardContent>Hover over me!</CardContent>
        </Card>
        
        <Card ribbon={{ text: 'SALE', color: 'error' }}>
          <CardHeader>
            <CardTitle>With Ribbon</CardTitle>
          </CardHeader>
          <CardContent>Special offer</CardContent>
        </Card>
        
        <Card selected>
          <CardHeader>
            <CardTitle>Selected</CardTitle>
          </CardHeader>
          <CardContent>Currently selected</CardContent>
        </Card>
      </div>
      
      <Card withAnimation animationType="fade" interactive="clickable">
        <CardImage 
          src="https://via.placeholder.com/800x300"
          alt="Feature"
          overlay
          overlayContent={
            <div>
              <Badge variant="secondary" className="mb-2">Featured</Badge>
              <h2 className="text-2xl font-bold">Amazing Feature</h2>
              <p>Discover what makes this special</p>
            </div>
          }
        />
        <CardContent className="pt-6">
          <p>This card demonstrates multiple features including image overlay, animation, and interactive states.</p>
        </CardContent>
        <CardActions align="between">
          <Button variant="outline">Learn More</Button>
          <Button>Get Started</Button>
        </CardActions>
      </Card>
    </div>
  ),
};