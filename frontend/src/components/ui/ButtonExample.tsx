import React, { useState } from 'react'
import { Button } from './button'
import { 
  ArrowRightIcon, 
  ArrowDownTrayIcon, 
  PlusIcon, 
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
  HeartIcon,
  StarIcon,
  BookmarkIcon
} from '@heroicons/react/24/outline'

export const ButtonExample: React.FC = () => {
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <div className="space-y-8 p-8">
      {/* Variants */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Button Variants</h3>
        <div className="flex flex-wrap gap-4">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      {/* Sizes */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Button Sizes</h3>
        <div className="flex items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Settings">
            <PencilIcon className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Icons */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Buttons with Icons</h3>
        <div className="flex flex-wrap gap-4">
          <Button leftIcon={<PlusIcon className="h-4 w-4" />}>
            Create New
          </Button>
          <Button rightIcon={<ArrowRightIcon className="h-4 w-4" />}>
            Continue
          </Button>
          <Button 
            leftIcon={<ArrowDownTrayIcon className="h-4 w-4" />}
            rightIcon={<span className="text-xs">(2MB)</span>}
          >
            Download
          </Button>
          <Button 
            variant="destructive" 
            leftIcon={<TrashIcon className="h-4 w-4" />}
          >
            Delete
          </Button>
        </div>
      </section>

      {/* Icon sizes with different button sizes */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Icon Sizes</h3>
        <div className="flex flex-wrap gap-4">
          <Button size="sm" leftIcon={<HeartIcon className="h-3 w-3" />}>
            Small with Icon
          </Button>
          <Button size="default" leftIcon={<StarIcon className="h-4 w-4" />}>
            Default with Icon
          </Button>
          <Button size="lg" leftIcon={<BookmarkIcon className="h-5 w-5" />}>
            Large with Icon
          </Button>
        </div>
      </section>

      {/* Loading States */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Loading States</h3>
        <div className="flex flex-wrap gap-4">
          <Button isLoading>
            Loading
          </Button>
          <Button isLoading loadingText="Saving...">
            Save
          </Button>
          <Button 
            isLoading 
            loadingText="Processing..." 
            variant="secondary"
          >
            Process
          </Button>
          <Button 
            onClick={handleClick}
            isLoading={loading}
            loadingText="Submitting..."
            leftIcon={<CheckIcon className="h-4 w-4" />}
          >
            Submit Form
          </Button>
        </div>
      </section>

      {/* Disabled States */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Disabled States</h3>
        <div className="flex flex-wrap gap-4">
          <Button disabled>Disabled Default</Button>
          <Button disabled variant="secondary">Disabled Secondary</Button>
          <Button disabled variant="outline">Disabled Outline</Button>
          <Button disabled leftIcon={<XMarkIcon className="h-4 w-4" />}>
            Disabled with Icon
          </Button>
        </div>
      </section>

      {/* Full Width */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Full Width Buttons</h3>
        <div className="space-y-2 max-w-sm">
          <Button fullWidth>Full Width Default</Button>
          <Button fullWidth variant="outline">Full Width Outline</Button>
          <Button 
            fullWidth 
            leftIcon={<PlusIcon className="h-4 w-4" />}
            rightIcon={<ArrowRightIcon className="h-4 w-4" />}
          >
            Full Width with Icons
          </Button>
        </div>
      </section>

      {/* Dark Mode Test */}
      <section className="dark bg-gray-900 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-white">Dark Mode</h3>
        <div className="flex flex-wrap gap-4">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button 
            leftIcon={<HeartIcon className="h-4 w-4" />}
            isLoading
            loadingText="Loading..."
          >
            Loading
          </Button>
        </div>
      </section>

      {/* Accessibility Test */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Accessibility</h3>
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tab through these buttons to test focus states
          </p>
          <div className="flex gap-4">
            <Button>First Button</Button>
            <Button variant="secondary">Second Button</Button>
            <Button variant="outline">Third Button</Button>
            <Button size="icon" aria-label="Edit item">
              <PencilIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}