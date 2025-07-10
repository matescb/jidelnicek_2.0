import * as React from 'react'
import { ToastContainer } from './ToastContainer'
import { useToastStore } from '@/store/slices/toastStore'

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toasts, position, maxVisible, removeToast } = useToastStore()

  return (
    <>
      {children}
      <ToastContainer
        toasts={toasts.map(toast => ({
          id: toast.id,
          title: toast.title,
          description: toast.description,
          variant: toast.variant,
          action: toast.action ? (
            <button
              onClick={toast.action.onClick}
              className="text-sm font-medium underline underline-offset-2 hover:no-underline"
            >
              {toast.action.label}
            </button>
          ) : undefined,
          duration: toast.duration,
          persistent: toast.persistent,
          showProgress: toast.showProgress,
        }))}
        position={position}
        maxVisible={maxVisible}
        onClose={removeToast}
      />
    </>
  )
}