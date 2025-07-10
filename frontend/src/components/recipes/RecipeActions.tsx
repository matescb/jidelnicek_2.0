import React, { useState } from 'react';
import {
  MoreVertical,
  Edit,
  Copy,
  GitFork,
  Trash2,
  Share2,
  Download,
  Flag,
  Link,
  FileText,
  FileJson,
  Facebook,
  Twitter,
  Mail,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import { Recipe } from '@/types/recipe';
import { cn } from '@/lib/utils';

interface RecipeActionsProps {
  recipe: Recipe;
  onEdit?: () => void;
  onDuplicate?: (recipe: Recipe) => void;
  onFork?: (recipe: Recipe) => void;
  onDelete?: () => void;
  className?: string;
  variant?: 'icon' | 'button';
  size?: 'sm' | 'md' | 'lg';
}

interface LoadingStates {
  duplicate: boolean;
  fork: boolean;
  delete: boolean;
  export: boolean;
  report: boolean;
}

export const RecipeActions: React.FC<RecipeActionsProps> = ({
  recipe,
  onEdit,
  onDuplicate,
  onFork,
  onDelete,
  className,
  variant = 'icon',
  size = 'md',
}) => {
  const { user } = useAuthStore();
  const { deleteRecipe, duplicateRecipe, forkRecipe } = useRecipeStore();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [loading, setLoading] = useState<LoadingStates>({
    duplicate: false,
    fork: false,
    delete: false,
    export: false,
    report: false,
  });

  const isOwner = user?.id === recipe.authorId;
  const isAuthenticated = !!user;

  const setLoadingState = (key: keyof LoadingStates, value: boolean) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  };

  const handleDuplicate = async () => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to duplicate recipes');
      return;
    }

    setLoadingState('duplicate', true);
    try {
      const duplicatedRecipe = await duplicateRecipe(recipe.id);
      toast.success('Recipe duplicated successfully');
      onDuplicate?.(duplicatedRecipe);
    } catch (error) {
      toast.error('Failed to duplicate recipe');
      console.error('Duplicate error:', error);
    } finally {
      setLoadingState('duplicate', false);
    }
  };

  const handleFork = async () => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to fork recipes');
      return;
    }

    setLoadingState('fork', true);
    try {
      const forkedRecipe = await forkRecipe(recipe.id);
      toast.success('Recipe forked successfully');
      onFork?.(forkedRecipe);
    } catch (error) {
      toast.error('Failed to fork recipe');
      console.error('Fork error:', error);
    } finally {
      setLoadingState('fork', false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) {
      toast.error('You can only delete your own recipes');
      return;
    }

    setLoadingState('delete', true);
    try {
      await deleteRecipe(recipe.id);
      toast.success('Recipe deleted successfully');
      setShowDeleteDialog(false);
      onDelete?.();
    } catch (error) {
      toast.error('Failed to delete recipe');
      console.error('Delete error:', error);
    } finally {
      setLoadingState('delete', false);
    }
  };

  const handleShare = async (platform: 'link' | 'facebook' | 'twitter' | 'email') => {
    const recipeUrl = `${window.location.origin}/recipes/${recipe.id}`;
    const shareText = `Check out this recipe: ${recipe.title}`;

    switch (platform) {
      case 'link':
        try {
          await navigator.clipboard.writeText(recipeUrl);
          toast.success('Link copied to clipboard');
        } catch (error) {
          toast.error('Failed to copy link');
        }
        break;
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(recipeUrl)}`,
          '_blank'
        );
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(recipeUrl)}`,
          '_blank'
        );
        break;
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(recipe.title)}&body=${encodeURIComponent(`${shareText}\n\n${recipeUrl}`)}`;
        break;
    }
  };

  const handleExport = async (format: 'pdf' | 'json') => {
    setLoadingState('export', true);
    try {
      if (format === 'json') {
        const dataStr = JSON.stringify(recipe, null, 2);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
        const exportFileDefaultName = `${recipe.title.replace(/\s+/g, '-').toLowerCase()}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        toast.success('Recipe exported as JSON');
      } else {
        // PDF export would require a backend endpoint or client-side PDF generation
        toast.info('PDF export coming soon');
      }
    } catch (error) {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
      console.error('Export error:', error);
    } finally {
      setLoadingState('export', false);
    }
  };

  const handleReport = async () => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to report content');
      return;
    }

    if (!reportReason.trim()) {
      toast.error('Please provide a reason for reporting');
      return;
    }

    setLoadingState('report', true);
    try {
      // This would typically call an API endpoint to submit the report
      // await reportRecipe(recipe.id, reportReason);
      toast.success('Report submitted successfully');
      setShowReportDialog(false);
      setReportReason('');
    } catch (error) {
      toast.error('Failed to submit report');
      console.error('Report error:', error);
    } finally {
      setLoadingState('report', false);
    }
  };

  const triggerButton = variant === 'icon' ? (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon' : 'icon-sm'}
      className={cn('focus:ring-2 focus:ring-offset-2', className)}
      aria-label="Recipe actions"
    >
      <MoreVertical className={cn(
        'transition-colors',
        size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
      )} />
    </Button>
  ) : (
    <Button
      variant="outline"
      size={size}
      className={cn('gap-2', className)}
    >
      <MoreVertical className={cn(
        size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
      )} />
      Actions
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {triggerButton}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Recipe Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Edit - Only for owner */}
          {isOwner && onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Recipe
            </DropdownMenuItem>
          )}
          
          {/* Duplicate - For authenticated users */}
          {isAuthenticated && (
            <DropdownMenuItem 
              onClick={handleDuplicate}
              disabled={loading.duplicate}
            >
              {loading.duplicate ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Duplicate Recipe
            </DropdownMenuItem>
          )}
          
          {/* Fork - For authenticated users */}
          {isAuthenticated && (
            <DropdownMenuItem 
              onClick={handleFork}
              disabled={loading.fork}
            >
              {loading.fork ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GitFork className="mr-2 h-4 w-4" />
              )}
              Fork Recipe
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          {/* Share submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleShare('link')}>
                <Link className="mr-2 h-4 w-4" />
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('facebook')}>
                <Facebook className="mr-2 h-4 w-4" />
                Facebook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('twitter')}>
                <Twitter className="mr-2 h-4 w-4" />
                Twitter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('email')}>
                <Mail className="mr-2 h-4 w-4" />
                Email
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {/* Export submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download className="mr-2 h-4 w-4" />
              Export
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem 
                onClick={() => handleExport('pdf')}
                disabled={loading.export}
              >
                <FileText className="mr-2 h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleExport('json')}
                disabled={loading.export}
              >
                <FileJson className="mr-2 h-4 w-4" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          
          {/* Report - For authenticated users */}
          {isAuthenticated && !isOwner && (
            <DropdownMenuItem 
              onClick={() => setShowReportDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Flag className="mr-2 h-4 w-4" />
              Report Content
            </DropdownMenuItem>
          )}
          
          {/* Delete - Only for owner */}
          {isOwner && (
            <DropdownMenuItem 
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Recipe
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{recipe.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading.delete}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading.delete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading.delete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Report Recipe</DialogTitle>
            <DialogDescription>
              Please let us know why you're reporting this recipe.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="report-reason" className="text-sm font-medium">
                Reason for reporting
              </label>
              <textarea
                id="report-reason"
                className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Please describe the issue..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                disabled={loading.report}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReportDialog(false);
                setReportReason('');
              }}
              disabled={loading.report}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReport}
              disabled={loading.report || !reportReason.trim()}
              variant="destructive"
            >
              {loading.report ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="mr-2 h-4 w-4" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};