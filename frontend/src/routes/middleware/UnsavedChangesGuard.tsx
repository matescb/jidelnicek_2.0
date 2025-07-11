import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigationMiddleware } from './NavigationMiddleware';
import { createUnsavedChangesMiddleware } from './middlewares';
import type { NavigationContext, NavigationMiddleware, UnsavedChangesOptions } from './types';

interface UnsavedChangesGuardProps extends UnsavedChangesOptions {
  when: boolean;
  children?: React.ReactNode;
}

export const UnsavedChangesGuard: React.FC<UnsavedChangesGuardProps> = ({
  when,
  message = 'You have unsaved changes. Do you want to save before leaving?',
  showSaveOption = true,
  onSave,
  onDiscard,
  children,
}) => {
  const { registerMiddleware, unregisterMiddleware } = useNavigationMiddleware();
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<NavigationContext | null>(null);
  const middlewareRef = useRef<NavigationMiddleware | null>(null);

  const handleSave = useCallback(async () => {
    if (onSave) {
      try {
        await onSave();
        setShowDialog(false);
        if (pendingNavigation) {
          pendingNavigation.navigate(pendingNavigation.to);
        }
      } catch (error) {
        console.error('Failed to save changes:', error);
      }
    }
  }, [onSave, pendingNavigation]);

  const handleDiscard = useCallback(() => {
    if (onDiscard) {
      onDiscard();
    }
    setShowDialog(false);
    if (pendingNavigation) {
      pendingNavigation.navigate(pendingNavigation.to);
    }
  }, [onDiscard, pendingNavigation]);

  const handleCancel = useCallback(() => {
    setShowDialog(false);
    setPendingNavigation(null);
  }, []);

  // Create custom middleware
  useEffect(() => {
    if (when) {
      const middleware: NavigationMiddleware = async (context) => {
        if (showSaveOption && onSave) {
          setPendingNavigation(context);
          setShowDialog(true);
          return { allow: false };
        } else {
          // Use default browser confirmation
          return createUnsavedChangesMiddleware(() => true, message)(context);
        }
      };

      middlewareRef.current = middleware;
      registerMiddleware([middleware]);
    }

    return () => {
      if (middlewareRef.current) {
        unregisterMiddleware([middlewareRef.current]);
        middlewareRef.current = null;
      }
    };
  }, [when, showSaveOption, onSave, message, registerMiddleware, unregisterMiddleware]);

  // Handle browser unload event
  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [when, message]);

  if (!showDialog) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <UnsavedChangesDialog
        isOpen={showDialog}
        message={message}
        showSaveOption={showSaveOption}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onCancel={handleCancel}
      />
    </>
  );
};

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  message: string;
  showSaveOption: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  message,
  showSaveOption,
  onSave,
  onDiscard,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Unsaved Changes</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          
          <button
            onClick={onDiscard}
            className="px-4 py-2 text-red-600 border border-red-300 rounded hover:bg-red-50"
          >
            Discard Changes
          </button>
          
          {showSaveOption && (
            <button
              onClick={onSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Hook for programmatic unsaved changes handling
export const useUnsavedChanges = (options?: UnsavedChangesOptions) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const formDataRef = useRef<any>(null);

  const trackChanges = useCallback((formData: any) => {
    if (!formDataRef.current) {
      formDataRef.current = JSON.stringify(formData);
      return;
    }

    const hasChanges = formDataRef.current !== JSON.stringify(formData);
    setHasUnsavedChanges(hasChanges);
  }, []);

  const resetChanges = useCallback(() => {
    setHasUnsavedChanges(false);
    formDataRef.current = null;
  }, []);

  const saveChanges = useCallback(async () => {
    if (options?.onSave) {
      await options.onSave();
      resetChanges();
    }
  }, [options, resetChanges]);

  return {
    hasUnsavedChanges,
    trackChanges,
    resetChanges,
    saveChanges,
    UnsavedChangesGuard: (props: Partial<UnsavedChangesGuardProps>) => (
      <UnsavedChangesGuard
        when={hasUnsavedChanges}
        onSave={saveChanges}
        {...options}
        {...props}
      />
    ),
  };
};