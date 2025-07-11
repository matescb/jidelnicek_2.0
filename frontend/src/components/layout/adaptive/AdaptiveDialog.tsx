import React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface AdaptiveDialogProps {
  children?: React.ReactNode;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  mobileVariant?: 'dialog' | 'drawer' | 'fullscreen';
  desktopVariant?: 'dialog' | 'fullscreen';
  closeButton?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
};

export function AdaptiveDialog({
  children,
  trigger,
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  size = 'md',
  mobileVariant = 'drawer',
  desktopVariant = 'dialog',
  closeButton = true,
}: AdaptiveDialogProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const variant = isMobile ? mobileVariant : desktopVariant;

  // Mobile drawer version
  if (variant === 'drawer') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
        <DrawerContent className={className}>
          {(title || description) && (
            <DrawerHeader>
              {title && <DrawerTitle>{title}</DrawerTitle>}
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
          )}
          <div className="px-4 py-4">{children}</div>
          {footer && <DrawerFooter>{footer}</DrawerFooter>}
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop dialog version
  const dialogClassName = cn(
    variant === 'fullscreen' && 'max-w-none w-screen h-screen m-0',
    variant === 'dialog' && sizeClasses[size],
    className
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent 
        className={dialogClassName}
        showCloseButton={closeButton}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

// Sheet-style adaptive dialog (always slides from edge)
interface AdaptiveSheetProps extends AdaptiveDialogProps {
  side?: 'top' | 'right' | 'bottom' | 'left';
  mobileSide?: 'top' | 'right' | 'bottom' | 'left';
}

export function AdaptiveSheet({
  side = 'right',
  mobileSide = 'bottom',
  ...props
}: AdaptiveSheetProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const currentSide = isMobile ? mobileSide : side;

  return (
    <AdaptiveDialog
      {...props}
      mobileVariant="drawer"
      desktopVariant="dialog"
      className={cn(
        'data-[state=open]:animate-slide-in',
        currentSide === 'left' && 'slide-in-from-left',
        currentSide === 'right' && 'slide-in-from-right',
        currentSide === 'top' && 'slide-in-from-top',
        currentSide === 'bottom' && 'slide-in-from-bottom',
        props.className
      )}
    />
  );
}

// Confirmation dialog with adaptive behavior
interface AdaptiveConfirmProps {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'destructive';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AdaptiveConfirm({
  trigger,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  open,
  onOpenChange,
}: AdaptiveConfirmProps) {
  const [isOpen, setIsOpen] = useState(false);
  const controlledOpen = open ?? isOpen;
  const controlledOnOpenChange = onOpenChange ?? setIsOpen;

  const handleConfirm = () => {
    onConfirm();
    controlledOnOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    controlledOnOpenChange(false);
  };

  return (
    <AdaptiveDialog
      trigger={trigger}
      title={title}
      description={description}
      open={controlledOpen}
      onOpenChange={controlledOnOpenChange}
      size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      }
    />
  );
}

// Import Button for the confirmation dialog
import { Button } from '@/components/ui/button';

// Popover-style adaptive dialog
interface AdaptivePopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AdaptivePopover({
  trigger,
  children,
  className,
  align = 'center',
  side = 'bottom',
  open,
  onOpenChange,
}: AdaptivePopoverProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  if (isMobile) {
    return (
      <AdaptiveDialog
        trigger={trigger}
        open={open}
        onOpenChange={onOpenChange}
        mobileVariant="drawer"
        className={className}
      >
        {children}
      </AdaptiveDialog>
    );
  }

  // Desktop popover implementation would go here
  // For now, using dialog as fallback
  return (
    <AdaptiveDialog
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      className={className}
    >
      {children}
    </AdaptiveDialog>
  );
}