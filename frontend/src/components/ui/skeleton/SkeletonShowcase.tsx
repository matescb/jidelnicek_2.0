import React from 'react'
import { 
  Skeleton,
  SkeletonCard,
  SkeletonProductCard,
  SkeletonBlogCard,
  SkeletonProfileCard,
  SkeletonTable,
  SkeletonResponsiveTable,
  SkeletonList,
  SkeletonInfiniteList,
  SkeletonMessageList,
  SkeletonForm,
  SkeletonLoginForm,
  SkeletonContactForm,
  SkeletonSettingsForm,
  SkeletonSearchForm,
  SkeletonText,
  SkeletonParagraph,
  SkeletonHeading,
  SkeletonArticle,
  SkeletonAvatar,
  SkeletonAvatarGroup,
  SkeletonAvatarWithText,
  SkeletonProfileAvatar
} from './index'

export const SkeletonShowcase: React.FC = () => {
  return (
    <div className="p-8 space-y-12 max-w-6xl mx-auto">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Skeleton Components Showcase</h1>
        <p className="text-gray-600 dark:text-gray-400">
          A comprehensive collection of skeleton loading components with smooth animations and dark mode support.
        </p>
      </div>

      {/* Base Skeleton */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Base Skeleton</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Rectangular</h3>
            <Skeleton width={200} height={100} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Circular</h3>
            <Skeleton width={100} height={100} shape="circular" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Text Line</h3>
            <Skeleton className="h-4 w-full" shape="text" />
          </div>
        </div>
      </section>

      {/* Avatar Skeletons */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Avatar Skeletons</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Avatar Sizes</h3>
            <div className="flex items-center gap-4">
              <SkeletonAvatar size="xs" />
              <SkeletonAvatar size="sm" />
              <SkeletonAvatar size="md" />
              <SkeletonAvatar size="lg" />
              <SkeletonAvatar size="xl" />
              <SkeletonAvatar size="2xl" />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">With Status</h3>
            <div className="flex items-center gap-4">
              <SkeletonAvatar showStatus />
              <SkeletonAvatar showStatus statusPosition="top-right" />
              <SkeletonAvatar shape="square" showStatus />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Avatar Group</h3>
            <SkeletonAvatarGroup count={5} />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">With Text</h3>
            <SkeletonAvatarWithText />
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Profile Avatar</h3>
          <SkeletonProfileAvatar />
        </div>
      </section>

      {/* Text Skeletons */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Text Skeletons</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Headings</h3>
            <SkeletonHeading level={1} />
            <SkeletonHeading level={2} />
            <SkeletonHeading level={3} />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Paragraph</h3>
            <SkeletonParagraph />
          </div>
        </div>
      </section>

      {/* Card Skeletons */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Card Skeletons</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Product Card</h3>
            <SkeletonProductCard />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Blog Card</h3>
            <SkeletonBlogCard />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Profile Card</h3>
            <SkeletonProfileCard />
          </div>
        </div>
      </section>

      {/* List Skeletons */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">List Skeletons</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Simple List</h3>
            <SkeletonList count={3} />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Avatar List</h3>
            <SkeletonList count={3} itemVariant="avatar" showDivider />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Detailed List</h3>
            <SkeletonList count={2} itemVariant="detailed" />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Message List</h3>
            <SkeletonMessageList count={4} />
          </div>
        </div>
      </section>

      {/* Table Skeleton */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Table Skeleton</h2>
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Basic Table</h3>
            <SkeletonTable rows={3} columns={4} />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">With Actions & Checkbox</h3>
            <SkeletonTable 
              rows={3} 
              columns={4} 
              showActions 
              showCheckbox 
              cellVariations={['avatar', 'text', 'badge', 'date']}
            />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Responsive Table</h3>
            <SkeletonResponsiveTable rows={2} columns={4} />
          </div>
        </div>
      </section>

      {/* Form Skeletons */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Form Skeletons</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Login Form</h3>
            <SkeletonLoginForm />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Contact Form</h3>
            <SkeletonContactForm />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Settings Form</h3>
            <SkeletonSettingsForm />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Search Form</h3>
            <SkeletonSearchForm />
          </div>
        </div>
      </section>

      {/* Full Article Skeleton */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Article Skeleton</h2>
        <SkeletonArticle />
      </section>

      {/* Animation Variations */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Animation Variations</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Shimmer (Default)</h3>
            <Skeleton className="h-20 w-full" animation="shimmer" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Pulse</h3>
            <Skeleton className="h-20 w-full" animation="pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Wave</h3>
            <Skeleton className="h-20 w-full" animation="wave" />
          </div>
        </div>
      </section>

      {/* Infinite List */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Infinite Scroll List</h2>
        <div className="max-h-96 overflow-y-auto border dark:border-gray-800 rounded-lg">
          <SkeletonInfiniteList count={5} itemVariant="avatar" />
        </div>
      </section>
    </div>
  )
}