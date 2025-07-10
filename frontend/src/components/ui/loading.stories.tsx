import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { LoadingShowcase } from './LoadingShowcase';
import { 
  LoadingSpinner, 
  LoadingDots, 
  InlineLoadingDots,
  LoadingOverlay,
  ContainerLoading,
  PageLoading,
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  ProgressBar,
  ProgressCircle
} from './';

const meta = {
  title: 'Components/Loading',
  component: LoadingShowcase,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Comprehensive loading state components including spinners, dots, progress indicators, and skeletons.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LoadingShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {
  render: () => <LoadingShowcase />,
};

// Loading Spinner Stories
export const Spinner: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[200px] gap-4">
      <LoadingSpinner size="sm" />
      <LoadingSpinner size="md" />
      <LoadingSpinner size="lg" />
      <LoadingSpinner size="xl" />
    </div>
  ),
};

export const SpinnerVariants: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[200px] gap-4">
      <LoadingSpinner variant="default" />
      <LoadingSpinner variant="primary" />
      <LoadingSpinner variant="secondary" />
      <LoadingSpinner variant="destructive" />
      <LoadingSpinner variant="success" />
      <LoadingSpinner variant="warning" />
    </div>
  ),
};

// Loading Dots Stories
export const Dots: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[200px] gap-8">
      <LoadingDots size="sm" />
      <LoadingDots size="md" />
      <LoadingDots size="lg" />
      <LoadingDots size="xl" />
    </div>
  ),
};

export const DotsVariants: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[200px] gap-8">
      <LoadingDots variant="default" />
      <LoadingDots variant="primary" />
      <LoadingDots variant="secondary" />
      <LoadingDots variant="success" />
      <LoadingDots variant="warning" />
      <LoadingDots variant="danger" />
    </div>
  ),
};

export const InlineDots: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-lg">
        Loading your data<InlineLoadingDots size="sm" variant="primary" />
      </p>
    </div>
  ),
};

// Progress Bar Stories
export const ProgressBarSizes: Story = {
  render: () => (
    <div className="p-8 space-y-4 max-w-md mx-auto">
      <ProgressBar value={65} size="sm" />
      <ProgressBar value={65} size="md" />
      <ProgressBar value={65} size="lg" />
      <ProgressBar value={65} size="xl" />
    </div>
  ),
};

export const ProgressBarVariants: Story = {
  render: () => (
    <div className="p-8 space-y-4 max-w-md mx-auto">
      <ProgressBar value={65} indicatorVariant="default" />
      <ProgressBar value={65} indicatorVariant="success" />
      <ProgressBar value={65} indicatorVariant="warning" />
      <ProgressBar value={65} indicatorVariant="danger" />
      <ProgressBar value={65} indicatorVariant="info" />
    </div>
  ),
};

export const ProgressBarWithLabel: Story = {
  render: () => (
    <div className="p-8 max-w-md mx-auto">
      <ProgressBar value={65} max={100} showLabel indicatorVariant="primary" />
    </div>
  ),
};

// Progress Circle Stories
export const ProgressCircleSizes: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[200px] gap-4">
      <ProgressCircle value={65} size="sm" />
      <ProgressCircle value={65} size="md" />
      <ProgressCircle value={65} size="lg" />
      <ProgressCircle value={65} size="xl" />
    </div>
  ),
};

export const ProgressCircleVariants: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[200px] gap-4">
      <ProgressCircle value={65} variant="default" />
      <ProgressCircle value={65} variant="success" />
      <ProgressCircle value={65} variant="warning" />
      <ProgressCircle value={65} variant="danger" />
      <ProgressCircle value={65} variant="info" />
    </div>
  ),
};

// Skeleton Stories
export const BasicSkeleton: Story = {
  render: () => (
    <div className="p-8 space-y-4 max-w-md">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  ),
};

export const SkeletonTextExample: Story = {
  render: () => (
    <div className="p-8 space-y-4 max-w-md">
      <SkeletonText />
      <SkeletonText className="w-3/4" />
      <SkeletonText className="w-1/2" />
    </div>
  ),
};

export const SkeletonAvatarSizes: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[200px] gap-4">
      <SkeletonAvatar size="sm" />
      <SkeletonAvatar size="md" />
      <SkeletonAvatar size="lg" />
    </div>
  ),
};

export const SkeletonCardExample: Story = {
  render: () => (
    <div className="p-8 max-w-sm">
      <SkeletonCard />
    </div>
  ),
};

// Loading Overlay Stories
export const ContainerLoadingExample: Story = {
  render: () => (
    <div className="p-8">
      <ContainerLoading isLoading text="Loading content..." />
    </div>
  ),
};

export const LoadingOverlayExample: Story = {
  render: () => (
    <div className="relative h-64 bg-gray-100 dark:bg-gray-900 rounded-lg">
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">Content Area</h3>
        <p>This content is covered by a loading overlay.</p>
      </div>
      <LoadingOverlay 
        isLoading 
        text="Processing..."
      />
    </div>
  ),
};

export const LoadingOverlayWithProgress: Story = {
  render: () => (
    <div className="relative h-64 bg-gray-100 dark:bg-gray-900 rounded-lg">
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">Upload Area</h3>
        <p>File upload in progress...</p>
      </div>
      <LoadingOverlay 
        isLoading 
        indicator="progress" 
        progress={65} 
        text="Uploading files..."
      />
    </div>
  ),
};

// Interactive Examples
const InteractiveOverlay = () => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 3000);
  };

  return (
    <div className="p-8">
      <button
        onClick={handleClick}
        className="mb-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Trigger Loading
      </button>
      <div className="relative h-48 bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Interactive Content</h3>
        <p>Click the button to see the loading overlay.</p>
        <LoadingOverlay 
          isLoading={isLoading}
          variant="blur"
          text="Loading data..."
        />
      </div>
    </div>
  );
};

export const InteractiveLoadingOverlay: Story = {
  render: () => <InteractiveOverlay />,
};

// Progress Animation
const AnimatedProgress = () => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + 10;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 space-y-8 max-w-md mx-auto">
      <div>
        <h3 className="text-sm font-medium mb-2">Progress Bar</h3>
        <ProgressBar value={progress} showLabel indicatorVariant="primary" />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Progress Circle</h3>
        <div className="flex justify-center">
          <ProgressCircle value={progress} size="lg" variant="success" />
        </div>
      </div>
    </div>
  );
};

export const AnimatedProgressIndicators: Story = {
  render: () => <AnimatedProgress />,
};