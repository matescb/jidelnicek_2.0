import { useToastStore } from '@/store/slices/toastStore'

export const useToast = () => {
  const store = useToastStore()
  
  return {
    // Core toast methods
    toast: store.toast,
    
    // Individual methods for convenience
    success: store.toast.success,
    error: store.toast.error,
    warning: store.toast.warning,
    info: store.toast.info,
    
    // Promise handler
    promise: store.toast.promise,
    
    // Manual control
    addToast: store.addToast,
    updateToast: store.updateToast,
    removeToast: store.removeToast,
    removeAllToasts: store.removeAllToasts,
    
    // Settings
    setPosition: store.setPosition,
    setMaxVisible: store.setMaxVisible,
    setDefaultDuration: store.setDefaultDuration,
    
    // State
    toasts: store.toasts,
    position: store.position,
    maxVisible: store.maxVisible,
    defaultDuration: store.defaultDuration,
  }
}