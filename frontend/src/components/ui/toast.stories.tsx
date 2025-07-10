import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { useToast } from '@/hooks/useToast';
import { ToastDemo } from '@/components/examples/ToastDemo';
import type { ToastPosition } from '@/store/slices/toastStore';

const meta = {
  title: 'Components/Toast',
  component: ToastDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Toast notification system with multiple variants, positions, and features like promises and actions.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ToastDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => <ToastDemo />,
};

// Individual toast variant stories
const ToastVariantDemo = ({ variant }: { variant: 'success' | 'error' | 'warning' | 'info' | 'default' }) => {
  const { success, error, warning, info, toast } = useToast();
  
  const messages = {
    success: { title: 'Success!', description: 'Your changes have been saved.' },
    error: { title: 'Error!', description: 'Something went wrong. Please try again.' },
    warning: { title: 'Warning!', description: 'This action cannot be undone.' },
    info: { title: 'Info', description: 'New features are available.' },
    default: { title: 'Notification', description: 'This is a default toast message.' },
  };

  const handleClick = () => {
    const msg = messages[variant];
    switch (variant) {
      case 'success':
        success(msg.title, msg.description);
        break;
      case 'error':
        error(msg.title, msg.description);
        break;
      case 'warning':
        warning(msg.title, msg.description);
        break;
      case 'info':
        info(msg.title, msg.description);
        break;
      case 'default':
        toast.default(msg.title, msg.description);
        break;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Button onClick={handleClick}>
        Show {variant.charAt(0).toUpperCase() + variant.slice(1)} Toast
      </Button>
    </div>
  );
};

export const Success: Story = {
  render: () => <ToastVariantDemo variant="success" />,
};

export const Error: Story = {
  render: () => <ToastVariantDemo variant="error" />,
};

export const Warning: Story = {
  render: () => <ToastVariantDemo variant="warning" />,
};

export const Info: Story = {
  render: () => <ToastVariantDemo variant="info" />,
};

export const Default: Story = {
  render: () => <ToastVariantDemo variant="default" />,
};

// Position demo
const PositionDemo = ({ position }: { position: ToastPosition }) => {
  const { toast, setPosition } = useToast();
  
  const handleClick = () => {
    setPosition(position);
    toast.default('Position Example', `This toast appears at ${position.replace('-', ' ')}`);
  };

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Button onClick={handleClick}>
        Show Toast at {position.replace('-', ' ')}
      </Button>
    </div>
  );
};

export const TopLeft: Story = {
  render: () => <PositionDemo position="top-left" />,
};

export const TopCenter: Story = {
  render: () => <PositionDemo position="top-center" />,
};

export const TopRight: Story = {
  render: () => <PositionDemo position="top-right" />,
};

export const BottomLeft: Story = {
  render: () => <PositionDemo position="bottom-left" />,
};

export const BottomCenter: Story = {
  render: () => <PositionDemo position="bottom-center" />,
};

export const BottomRight: Story = {
  render: () => <PositionDemo position="bottom-right" />,
};

// Special features
const WithActionDemo = () => {
  const { toast, success } = useToast();
  
  const handleClick = () => {
    toast.default('File deleted', 'The file has been moved to trash.', {
      action: {
        label: 'Undo',
        onClick: () => {
          success('Action undone', 'The file has been restored.');
        },
      },
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Button onClick={handleClick}>
        Show Toast with Action
      </Button>
    </div>
  );
};

export const WithAction: Story = {
  render: () => <WithActionDemo />,
};

const PromiseDemo = () => {
  const { promise } = useToast();
  
  const handleSuccess = async () => {
    const fakeApiCall = () => new Promise<string>((resolve) => {
      setTimeout(() => resolve('Data loaded successfully!'), 3000);
    });

    await promise(
      fakeApiCall(),
      {
        loading: 'Loading data...',
        success: (data) => data,
        error: 'Failed to load data',
      }
    );
  };

  const handleError = async () => {
    const fakeApiCall = () => new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Network error')), 2000);
    });

    try {
      await promise(
        fakeApiCall(),
        {
          loading: 'Fetching data...',
          success: 'Data fetched!',
          error: (err) => `Error: ${err.message}`,
        }
      );
    } catch (err) {
      // Error is already handled by toast.promise
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[200px] gap-4">
      <Button onClick={handleSuccess}>
        Promise (Success)
      </Button>
      <Button onClick={handleError} variant="destructive">
        Promise (Error)
      </Button>
    </div>
  );
};

export const WithPromise: Story = {
  render: () => <PromiseDemo />,
};

const PersistentDemo = () => {
  const { toast } = useToast();
  
  const handleClick = () => {
    toast.info('System Update', 'A new version is available. This notification will stay until dismissed.', {
      persistent: true,
      showProgress: false,
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Button onClick={handleClick}>
        Show Persistent Toast
      </Button>
    </div>
  );
};

export const Persistent: Story = {
  render: () => <PersistentDemo />,
};

const MultipleToastsDemo = () => {
  const { success, error, warning, info, toast } = useToast();
  
  const handleClick = () => {
    success('First toast', 'This is the first notification');
    setTimeout(() => warning('Second toast', 'This is the second notification'), 500);
    setTimeout(() => info('Third toast', 'This is the third notification'), 1000);
    setTimeout(() => error('Fourth toast', 'This is the fourth notification'), 1500);
    setTimeout(() => toast.default('Fifth toast', 'This is the fifth notification'), 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Button onClick={handleClick}>
        Show Multiple Toasts
      </Button>
    </div>
  );
};

export const MultipleToasts: Story = {
  render: () => <MultipleToastsDemo />,
};