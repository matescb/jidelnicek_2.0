import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';

interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ 
  open, 
  onOpenChange, 
  children 
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
};

export const AlertDialogTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const AlertDialogContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DialogContent>
      {children}
    </DialogContent>
  );
};

export const AlertDialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DialogHeader>
      {children}
    </DialogHeader>
  );
};

export const AlertDialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DialogTitle>
      {children}
    </DialogTitle>
  );
};

export const AlertDialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="text-sm text-muted-foreground">
      {children}
    </div>
  );
};

export const AlertDialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DialogFooter>
      {children}
    </DialogFooter>
  );
};

export const AlertDialogAction: React.FC<{ 
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => {
  return (
    <Button onClick={onClick} variant="default">
      {children}
    </Button>
  );
};

export const AlertDialogCancel: React.FC<{ 
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => {
  return (
    <Button onClick={onClick} variant="outline">
      {children}
    </Button>
  );
};