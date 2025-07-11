import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  File, 
  X, 
  Pause, 
  Play, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Upload
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { ProgressBar } from './ProgressBar';

export interface FileUploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  speed?: number;
  timeRemaining?: string;
  error?: string;
}

interface FileUploadProgressProps {
  files: FileUploadItem[];
  onPause?: (fileId: string) => void;
  onResume?: (fileId: string) => void;
  onCancel?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
  showOverall?: boolean;
  className?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSecond: number): string => {
  return `${formatFileSize(bytesPerSecond)}/s`;
};

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  files,
  onPause,
  onResume,
  onCancel,
  onRetry,
  showOverall = true,
  className,
}) => {
  const overallProgress = files.length > 0
    ? Math.round(files.reduce((sum, file) => sum + file.progress, 0) / files.length)
    : 0;

  const activeUploads = files.filter(f => f.status === 'uploading').length;
  const completedUploads = files.filter(f => f.status === 'completed').length;
  const errorUploads = files.filter(f => f.status === 'error').length;

  const getStatusIcon = (status: FileUploadItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  const getProgressVariant = (status: FileUploadItem['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'primary';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {showOverall && files.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Overall Progress
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <span>{activeUploads} active</span>
              <span className="text-green-600 dark:text-green-400">
                {completedUploads} completed
              </span>
              {errorUploads > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {errorUploads} failed
                </span>
              )}
            </div>
          </div>
          <ProgressBar
            value={overallProgress}
            showPercentage
            size="md"
            variant="primary"
            animated
          />
        </div>
      )}

      <AnimatePresence>
        {files.map((file) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start space-x-3 flex-1">
                {getStatusIcon(file.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatFileSize(file.size)}</span>
                    {file.status === 'uploading' && file.speed && (
                      <>
                        <span>•</span>
                        <span>{formatSpeed(file.speed)}</span>
                      </>
                    )}
                    {file.status === 'uploading' && file.timeRemaining && (
                      <>
                        <span>•</span>
                        <span>{file.timeRemaining} remaining</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                {file.status === 'uploading' && (
                  <button
                    onClick={() => onPause?.(file.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title="Pause upload"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                )}
                
                {file.status === 'paused' && (
                  <button
                    onClick={() => onResume?.(file.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title="Resume upload"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                
                {file.status === 'error' && (
                  <button
                    onClick={() => onRetry?.(file.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title="Retry upload"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                
                {(file.status === 'pending' || file.status === 'uploading' || file.status === 'paused') && (
                  <button
                    onClick={() => onCancel?.(file.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-red-500"
                    title="Cancel upload"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {file.status !== 'completed' && (
              <ProgressBar
                value={file.progress}
                size="sm"
                variant={getProgressVariant(file.status)}
                animated={file.status === 'uploading'}
                striped={file.status === 'uploading'}
              />
            )}

            {file.status === 'error' && file.error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {file.error}
              </p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {files.length === 0 && (
        <div className="text-center py-12">
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No files uploading
          </p>
        </div>
      )}
    </div>
  );
};