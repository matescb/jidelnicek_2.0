import React, { useState, useRef } from 'react'
import { motion, useAnimation, PanInfo } from 'framer-motion'
import { TrashIcon, PencilIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export interface SwipeAction {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  color?: 'primary' | 'danger' | 'warning' | 'success'
  onClick: () => void | Promise<void>
}

interface SwipeableListItemProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  onDelete?: () => void | Promise<void>
  deleteConfirmation?: boolean
  deleteConfirmationText?: string
  threshold?: number
  className?: string
  disabled?: boolean
}

export const SwipeableListItem: React.FC<SwipeableListItemProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  onDelete,
  deleteConfirmation = true,
  deleteConfirmationText = 'Delete',
  threshold = 75,
  className,
  disabled = false
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const controls = useAnimation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [actionWidth, setActionWidth] = useState(0)

  // Add default delete action if onDelete is provided
  const allRightActions = onDelete 
    ? [...rightActions, {
        id: 'delete',
        label: deleteConfirmationText,
        icon: TrashIcon,
        color: 'danger' as const,
        onClick: async () => {
          if (deleteConfirmation) {
            setShowDeleteConfirm(true)
          } else {
            handleDelete()
          }
        }
      }]
    : rightActions

  const handleDelete = async () => {
    setIsDeleting(true)
    await controls.start({ 
      x: window.innerWidth,
      opacity: 0,
      transition: { duration: 0.3 }
    })
    await onDelete?.()
  }

  const handleDragEnd = async (_: any, info: PanInfo) => {
    const { offset, velocity } = info
    const swipeThreshold = threshold
    const swipeVelocityThreshold = 500

    // Determine if we should reveal actions or snap back
    if (Math.abs(offset.x) > swipeThreshold || Math.abs(velocity.x) > swipeVelocityThreshold) {
      // Swiped far enough
      if (offset.x > 0 && leftActions.length > 0) {
        // Reveal left actions
        await controls.start({ x: actionWidth })
      } else if (offset.x < 0 && allRightActions.length > 0) {
        // Reveal right actions
        await controls.start({ x: -actionWidth })
      } else {
        // Snap back if no actions
        await controls.start({ x: 0 })
      }
    } else {
      // Snap back
      await controls.start({ x: 0 })
    }
  }

  const handleActionClick = async (action: SwipeAction) => {
    await controls.start({ x: 0 })
    action.onClick()
  }

  const colorClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white'
  }

  if (disabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <div ref={containerRef} className={clsx('relative overflow-hidden', className)}>
      {/* Left actions */}
      {leftActions.length > 0 && (
        <div 
          className="absolute inset-y-0 left-0 flex"
          ref={(el) => el && setActionWidth(el.offsetWidth)}
        >
          {leftActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={clsx(
                  'px-4 flex flex-col items-center justify-center',
                  'transition-colors',
                  colorClasses[action.color || 'primary']
                )}
                aria-label={action.label}
              >
                {Icon && <Icon className="w-5 h-5 mb-1" />}
                <span className="text-xs">{action.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Right actions */}
      {allRightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex">
          {allRightActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={clsx(
                  'px-4 flex flex-col items-center justify-center',
                  'transition-colors',
                  colorClasses[action.color || 'primary']
                )}
                aria-label={action.label}
              >
                {Icon && <Icon className="w-5 h-5 mb-1" />}
                <span className="text-xs">{action.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragElastic={0.2}
        dragConstraints={{ left: -actionWidth, right: actionWidth }}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative bg-white dark:bg-gray-900"
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </motion.div>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-red-600 flex items-center justify-between px-4 z-10"
        >
          <span className="text-white font-medium">Delete this item?</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 bg-white/20 text-white rounded hover:bg-white/30"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1 bg-white text-red-600 rounded hover:bg-gray-100"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// Preset swipeable list items
export const SwipeableDeleteItem: React.FC<{
  children: React.ReactNode
  onDelete: () => void | Promise<void>
  className?: string
}> = ({ children, onDelete, className }) => {
  return (
    <SwipeableListItem
      onDelete={onDelete}
      className={className}
    >
      {children}
    </SwipeableListItem>
  )
}

export const SwipeableEditDeleteItem: React.FC<{
  children: React.ReactNode
  onEdit: () => void
  onDelete: () => void | Promise<void>
  className?: string
}> = ({ children, onEdit, onDelete, className }) => {
  return (
    <SwipeableListItem
      leftActions={[
        {
          id: 'edit',
          label: 'Edit',
          icon: PencilIcon,
          color: 'primary',
          onClick: onEdit
        }
      ]}
      onDelete={onDelete}
      className={className}
    >
      {children}
    </SwipeableListItem>
  )
}

export const SwipeableArchiveDeleteItem: React.FC<{
  children: React.ReactNode
  onArchive: () => void
  onDelete: () => void | Promise<void>
  className?: string
}> = ({ children, onArchive, onDelete, className }) => {
  return (
    <SwipeableListItem
      leftActions={[
        {
          id: 'archive',
          label: 'Archive',
          icon: ArchiveBoxIcon,
          color: 'warning',
          onClick: onArchive
        }
      ]}
      onDelete={onDelete}
      className={className}
    >
      {children}
    </SwipeableListItem>
  )
}