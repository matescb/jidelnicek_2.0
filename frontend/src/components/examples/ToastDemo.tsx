import React from 'react'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { ToastPosition } from '@/store/slices/toastStore'

export const ToastDemo: React.FC = () => {
  const {
    success,
    error,
    warning,
    info,
    toast,
    promise,
    removeAllToasts,
    position,
    setPosition,
    maxVisible,
    setMaxVisible,
    defaultDuration,
    setDefaultDuration,
  } = useToast()

  const positions: ToastPosition[] = [
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]

  const handlePromiseExample = async () => {
    const fakeApiCall = () => new Promise<string>((resolve) => {
      setTimeout(() => resolve('Data loaded successfully!'), 3000)
    })

    await promise(
      fakeApiCall(),
      {
        loading: 'Loading data...',
        success: (data) => data,
        error: 'Failed to load data',
      }
    )
  }

  const handlePromiseErrorExample = async () => {
    const fakeApiCall = () => new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Network error')), 2000)
    })

    try {
      await promise(
        fakeApiCall(),
        {
          loading: 'Fetching data...',
          success: 'Data fetched!',
          error: (err) => `Error: ${err.message}`,
        }
      )
    } catch (err) {
      // Error is already handled by toast.promise
    }
  }

  const handleActionToast = () => {
    toast.default('File deleted', 'The file has been moved to trash.', {
      action: {
        label: 'Undo',
        onClick: () => {
          success('Action undone', 'The file has been restored.')
        },
      },
    })
  }

  const handlePersistentToast = () => {
    toast.info('System Update', 'A new version is available. This notification will stay until dismissed.', {
      persistent: true,
      showProgress: false,
    })
  }

  const handleMultipleToasts = () => {
    success('First toast', 'This is the first notification')
    setTimeout(() => warning('Second toast', 'This is the second notification'), 500)
    setTimeout(() => info('Third toast', 'This is the third notification'), 1000)
    setTimeout(() => error('Fourth toast', 'This is the fourth notification'), 1500)
    setTimeout(() => toast.default('Fifth toast', 'This is the fifth notification'), 2000)
  }

  return (
    <div className="space-y-8 p-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold mb-4">Toast Notification System</h2>
        <p className="text-muted-foreground">
          A comprehensive toast notification system with animations, gestures, and accessibility features.
        </p>
      </div>

      {/* Settings */}
      <div className="space-y-4 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold">Settings</h3>
        
        <div className="space-y-2">
          <Label htmlFor="position">Position</Label>
          <Select value={position} onValueChange={(value) => setPosition(value as ToastPosition)}>
            <SelectTrigger id="position">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {positions.map((pos) => (
                <SelectItem key={pos} value={pos}>
                  {pos.replace('-', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-visible">Max Visible Toasts: {maxVisible}</Label>
          <Slider
            id="max-visible"
            min={1}
            max={10}
            step={1}
            value={[maxVisible]}
            onValueChange={([value]) => setMaxVisible(value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Default Duration: {defaultDuration}ms</Label>
          <Slider
            id="duration"
            min={1000}
            max={10000}
            step={500}
            value={[defaultDuration]}
            onValueChange={([value]) => setDefaultDuration(value)}
          />
        </div>
      </div>

      {/* Basic Toasts */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Toasts</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Button onClick={() => success('Success!', 'Your changes have been saved.')}>
            Success Toast
          </Button>
          <Button onClick={() => error('Error!', 'Something went wrong. Please try again.')}>
            Error Toast
          </Button>
          <Button onClick={() => warning('Warning!', 'This action cannot be undone.')}>
            Warning Toast
          </Button>
          <Button onClick={() => info('Info', 'New features are available.')}>
            Info Toast
          </Button>
          <Button onClick={() => toast.default('Default', 'This is a default toast.')}>
            Default Toast
          </Button>
        </div>
      </div>

      {/* Advanced Features */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Advanced Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button onClick={handleActionToast}>
            Toast with Action
          </Button>
          <Button onClick={handlePersistentToast}>
            Persistent Toast
          </Button>
          <Button onClick={handlePromiseExample}>
            Promise (Success)
          </Button>
          <Button onClick={handlePromiseErrorExample}>
            Promise (Error)
          </Button>
          <Button onClick={handleMultipleToasts}>
            Multiple Toasts
          </Button>
          <Button onClick={removeAllToasts} variant="outline">
            Clear All Toasts
          </Button>
        </div>
      </div>

      {/* Features List */}
      <div className="space-y-4 text-sm">
        <h3 className="text-lg font-semibold">Features</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Multiple toast variants with appropriate icons and colors</li>
          <li>6 position options for toast placement</li>
          <li>Auto-dismiss with configurable duration</li>
          <li>Progress bar showing time remaining</li>
          <li>Swipe to dismiss on mobile devices</li>
          <li>Keyboard support (Escape to dismiss most recent)</li>
          <li>Screen reader announcements for accessibility</li>
          <li>Dark mode support</li>
          <li>Persistent toasts that require manual dismissal</li>
          <li>Action buttons for undo/retry functionality</li>
          <li>Promise-based toasts for async operations</li>
          <li>Queue system with configurable max visible toasts</li>
          <li>Smooth animations with Framer Motion</li>
          <li>Stacking effect for multiple toasts</li>
        </ul>
      </div>
    </div>
  )
}