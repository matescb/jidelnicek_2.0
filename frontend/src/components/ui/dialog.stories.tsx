import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Modal dialog component with customizable sizes, animations, and behaviors.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Default Dialog</DialogTitle>
          <DialogDescription>
            This is a default dialog with standard settings.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Dialog content goes here. You can add any content you need.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Small: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Small Dialog</Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Small Dialog</DialogTitle>
          <DialogDescription>
            A compact dialog for simple confirmations.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Large: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Large Dialog</Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Large Dialog</DialogTitle>
          <DialogDescription>
            A larger dialog for more complex content.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6">
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              This is a large dialog that can contain more content, forms, or complex layouts.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name</Label>
                <Input id="first-name" placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name</Label>
                <Input id="last-name" placeholder="Doe" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const ExtraLarge: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Extra Large Dialog</Button>
      </DialogTrigger>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Extra Large Dialog</DialogTitle>
          <DialogDescription>
            Maximum width dialog for detailed content.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6">
          <div className="grid gap-6">
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const FullScreen: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Full Screen Dialog</Button>
      </DialogTrigger>
      <DialogContent size="full" className="flex flex-col">
        <DialogHeader>
          <DialogTitle>Full Screen Dialog</DialogTitle>
          <DialogDescription>
            Takes up most of the viewport.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-6">
          <div className="container mx-auto">
            <p className="mb-4">This dialog takes up 95% of the viewport.</p>
            <div className="grid gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-32 rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const NoCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>No Close Button</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>No Close Button</DialogTitle>
          <DialogDescription>
            This dialog doesn't have a close button.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Users must use the action buttons to close this dialog.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const PreventClose: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Prevent Close Dialog</Button>
      </DialogTrigger>
      <DialogContent 
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <DialogHeader>
          <DialogTitle>Important Action Required</DialogTitle>
          <DialogDescription>
            This dialog cannot be closed by clicking outside or pressing escape.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            You must make a selection to continue.
          </p>
        </div>
        <DialogFooter>
          <Button variant="destructive">Delete</Button>
          <Button variant="outline">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit Profile</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="john@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Tell us about yourself"
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const ConfirmationDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Item</Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your item
            and remove it from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const ScrollableContent: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Terms of Service</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[500px]">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            Please read and accept our terms of service.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto pr-2">
          <div className="space-y-4 text-sm">
            {[...Array(10)].map((_, i) => (
              <div key={i}>
                <h3 className="font-medium">Section {i + 1}</h3>
                <p className="text-muted-foreground">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                  Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
                </p>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Decline</Button>
          <Button>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const NestedDialogs: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parent Dialog</DialogTitle>
          <DialogDescription>
            This dialog contains another dialog.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open Nested Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nested Dialog</DialogTitle>
                <DialogDescription>
                  This is a dialog inside another dialog.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <DialogFooter>
          <Button>Close Parent</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};