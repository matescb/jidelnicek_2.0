import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import { Button } from './button'

/**
 * Example component demonstrating all Dialog features
 * 
 * Features demonstrated:
 * - Size variants (sm, md, lg, xl, full)
 * - Custom animations with Framer Motion
 * - Close on escape/outside click options
 * - Responsive design
 * - Dark mode compatibility
 * - Focus trap and keyboard navigation
 * - TypeScript types
 */
export function DialogExample() {
  const [openSizes, setOpenSizes] = React.useState<Record<string, boolean>>({
    sm: false,
    md: false,
    lg: false,
    xl: false,
    full: false,
    custom: false,
    noClose: false,
  })

  const handleOpenChange = (size: string) => (open: boolean) => {
    setOpenSizes(prev => ({ ...prev, [size]: open }))
  }

  // Custom animation variants
  const customAnimationVariants = {
    initial: { 
      opacity: 0, 
      scale: 0.5,
      rotate: -10
    },
    animate: { 
      opacity: 1, 
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 200
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.5,
      rotate: 10,
      transition: {
        duration: 0.3
      }
    }
  }

  return (
    <div className="grid gap-4 p-8">
      <h2 className="text-2xl font-bold">Dialog Component Examples</h2>
      
      {/* Size Variants */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Small Dialog */}
        <Dialog open={openSizes.sm} onOpenChange={handleOpenChange('sm')}>
          <DialogTrigger asChild>
            <Button variant="outline">Small Dialog</Button>
          </DialogTrigger>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Small Dialog</DialogTitle>
              <DialogDescription>
                This is a small dialog, perfect for simple confirmations.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Small dialogs are ideal for quick actions or confirmations that don't require much space.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange('sm')(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleOpenChange('sm')(false)}>
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Medium Dialog (default) */}
        <Dialog open={openSizes.md} onOpenChange={handleOpenChange('md')}>
          <DialogTrigger asChild>
            <Button variant="outline">Medium Dialog (Default)</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Medium Dialog</DialogTitle>
              <DialogDescription>
                This is the default size for dialogs.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Medium dialogs provide a good balance between content space and screen coverage.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange('md')(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Large Dialog */}
        <Dialog open={openSizes.lg} onOpenChange={handleOpenChange('lg')}>
          <DialogTrigger asChild>
            <Button variant="outline">Large Dialog</Button>
          </DialogTrigger>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>Large Dialog</DialogTitle>
              <DialogDescription>
                Large dialogs are great for forms or detailed content.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Large dialogs provide ample space for complex forms, detailed information, or multiple sections of content.
              </p>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Example Field 1</label>
                  <input className="px-3 py-2 border rounded-md" placeholder="Enter something..." />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Example Field 2</label>
                  <textarea className="px-3 py-2 border rounded-md" rows={3} placeholder="Enter more details..." />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange('lg')(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleOpenChange('lg')(false)}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Extra Large and Full Size */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Extra Large Dialog */}
        <Dialog open={openSizes.xl} onOpenChange={handleOpenChange('xl')}>
          <DialogTrigger asChild>
            <Button variant="outline">Extra Large Dialog</Button>
          </DialogTrigger>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>Extra Large Dialog</DialogTitle>
              <DialogDescription>
                Extra large dialogs are suitable for complex layouts or data tables.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Column 1</th>
                      <th className="text-left p-2">Column 2</th>
                      <th className="text-left p-2">Column 3</th>
                      <th className="text-left p-2">Column 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((row) => (
                      <tr key={row} className="border-b">
                        <td className="p-2">Data {row}-1</td>
                        <td className="p-2">Data {row}-2</td>
                        <td className="p-2">Data {row}-3</td>
                        <td className="p-2">Data {row}-4</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange('xl')(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full Size Dialog */}
        <Dialog open={openSizes.full} onOpenChange={handleOpenChange('full')}>
          <DialogTrigger asChild>
            <Button variant="outline">Full Size Dialog</Button>
          </DialogTrigger>
          <DialogContent size="full">
            <DialogHeader>
              <DialogTitle>Full Size Dialog</DialogTitle>
              <DialogDescription>
                Full size dialogs take up most of the viewport.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 py-4 overflow-y-auto">
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  This dialog takes up 95% of the viewport width and height, providing maximum space for content.
                </p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="p-4 border rounded-lg">
                      <h3 className="font-semibold">Section {item}</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        Content for section {item}. Full size dialogs are perfect for complex interfaces.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange('full')(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Special Features */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Custom Animation Dialog */}
        <Dialog open={openSizes.custom} onOpenChange={handleOpenChange('custom')}>
          <DialogTrigger asChild>
            <Button variant="outline">Custom Animation</Button>
          </DialogTrigger>
          <DialogContent 
            size="md"
            animationVariants={customAnimationVariants}
          >
            <DialogHeader>
              <DialogTitle>Custom Animation Dialog</DialogTitle>
              <DialogDescription>
                This dialog has custom Framer Motion animations.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Notice the custom scale and rotation animation when this dialog opens and closes.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange('custom')(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* No Close Options Dialog */}
        <Dialog open={openSizes.noClose} onOpenChange={handleOpenChange('noClose')}>
          <DialogTrigger asChild>
            <Button variant="outline">No Close on Outside/Escape</Button>
          </DialogTrigger>
          <DialogContent 
            size="md"
            closeOnClickOutside={false}
            closeOnEscape={false}
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle>Locked Dialog</DialogTitle>
              <DialogDescription>
                This dialog cannot be closed by clicking outside or pressing Escape.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Users must explicitly click the action button to close this dialog. 
                The close button is also hidden.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange('noClose')(false)}>
                I Understand, Close Dialog
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dark Mode Test */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Dark Mode Compatibility</h3>
        <p className="text-sm text-muted-foreground">
          The dialog component automatically adapts to dark mode using the `bg-background` 
          and `text-foreground` classes. Toggle your system's dark mode to see it in action.
        </p>
      </div>

      {/* Mobile Responsiveness Note */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Mobile Responsiveness</h3>
        <p className="text-sm text-muted-foreground">
          On mobile devices, dialogs automatically adjust with proper margins and rounded corners 
          are removed for better edge-to-edge display. The dialog content is scrollable when it 
          exceeds the viewport height.
        </p>
      </div>
    </div>
  )
}