import React, { useState } from 'react'
import {
  HomeIcon,
  UserIcon,
  Cog6ToothIcon,
  BellIcon,
  PlusIcon,
  CameraIcon,
  PhotoIcon,
  DocumentIcon
} from '@heroicons/react/24/outline'
import {
  BottomSheet,
  MobileModal,
  TabBar,
  PullToRefresh,
  FloatingActionButton,
  MobileHeader,
  SwipeableEditDeleteItem
} from './index'
import toast from 'react-hot-toast'

export const MobileComponentsDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home')
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [items, setItems] = useState([
    { id: '1', name: 'Item 1', description: 'Swipe left or right for actions' },
    { id: '2', name: 'Item 2', description: 'Edit or delete this item' },
    { id: '3', name: 'Item 3', description: 'Another swipeable item' },
  ])

  const tabItems = [
    { id: 'home', label: 'Home', icon: HomeIcon, badge: 3 },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'notifications', label: 'Alerts', icon: BellIcon, badge: '9+' },
    { id: 'settings', label: 'Settings', icon: Cog6ToothIcon },
  ]

  const fabActions = [
    {
      id: 'camera',
      label: 'Take Photo',
      icon: CameraIcon,
      onClick: () => toast.success('Camera opened'),
      color: 'bg-blue-600 hover:bg-blue-700' as const
    },
    {
      id: 'gallery',
      label: 'Choose from Gallery',
      icon: PhotoIcon,
      onClick: () => toast.success('Gallery opened'),
      color: 'bg-green-600 hover:bg-green-700' as const
    },
    {
      id: 'document',
      label: 'Upload Document',
      icon: DocumentIcon,
      onClick: () => toast.success('Document picker opened'),
      color: 'bg-purple-600 hover:bg-purple-700' as const
    }
  ]

  const handleRefresh = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    toast.success('Content refreshed!')
  }

  const handleDeleteItem = async (id: string) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    setItems(items.filter(item => item.id !== id))
    toast.success('Item deleted')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header */}
      <MobileHeader
        title="Mobile Components"
        largeTitle
        searchable
        onSearch={(query) => toast(`Searching for: ${query}`)}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <BellIcon className="w-5 h-5" />
          </button>
        }
      />

      {/* Pull to Refresh Content */}
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 py-6 space-y-6">
          {/* Demo Buttons */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Component Demos
            </h2>
            
            <button
              onClick={() => setIsBottomSheetOpen(true)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-left"
            >
              <h3 className="font-medium text-gray-900 dark:text-white">
                Bottom Sheet
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tap to open a draggable bottom sheet
              </p>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-left"
            >
              <h3 className="font-medium text-gray-900 dark:text-white">
                Mobile Modal
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Full-screen modal with swipe to close
              </p>
            </button>
          </div>

          {/* Swipeable List */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Swipeable List Items
            </h2>
            
            <div className="space-y-2">
              {items.map((item) => (
                <SwipeableEditDeleteItem
                  key={item.id}
                  onEdit={() => toast(`Edit ${item.name}`)}
                  onDelete={() => handleDeleteItem(item.id)}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm"
                >
                  <div className="px-4 py-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </SwipeableEditDeleteItem>
              ))}
            </div>
          </div>

          {/* Extra content for scroll */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pull to Refresh
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Pull down from the top to refresh the content
            </p>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
              >
                <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </PullToRefresh>

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        snapPoints={[0.5, 0.9]}
        defaultSnapPoint={0}
      >
        <div className="py-4">
          <h2 className="text-xl font-semibold mb-4">Bottom Sheet Content</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This sheet can be dragged to different snap points or closed by swiping down.
          </p>
          <div className="space-y-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="p-3 bg-gray-100 dark:bg-gray-800 rounded"
              >
                Option {i + 1}
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>

      {/* Mobile Modal */}
      <MobileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Notifications"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Swipe down or tap the close button to dismiss this modal.
          </p>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"
            >
              <h3 className="font-medium mb-1">Notification {i + 1}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This is a sample notification message
              </p>
            </div>
          ))}
        </div>
      </MobileModal>

      {/* Floating Action Button */}
      <FloatingActionButton
        actions={fabActions}
        position="bottom-right"
        hideOnScroll
      />

      {/* Tab Bar */}
      <TabBar
        items={tabItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  )
}