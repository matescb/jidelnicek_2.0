import React, { forwardRef, useState, useRef, useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { 
  CloudArrowUpIcon, 
  DocumentIcon,
  PhotoIcon,
  XMarkIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { FormError } from './FormError';
import { AnimatePresence, motion } from 'framer-motion';

interface FileInfo {
  file: File;
  preview?: string;
  progress?: number;
  error?: string;
}

interface FileFieldProps {
  /**
   * Field name for form registration
   */
  name: string;
  /**
   * Field label
   */
  label?: string;
  /**
   * Helper text
   */
  helperText?: string;
  /**
   * Accept file types
   */
  accept?: string;
  /**
   * Allow multiple files
   */
  multiple?: boolean;
  /**
   * Maximum file size in bytes
   */
  maxSize?: number;
  /**
   * Maximum number of files (when multiple is true)
   */
  maxFiles?: number;
  /**
   * Show image preview
   */
  showPreview?: boolean;
  /**
   * Enable drag and drop
   */
  dragAndDrop?: boolean;
  /**
   * Custom validation rules
   */
  rules?: any;
  /**
   * Container class name
   */
  containerClassName?: string;
  /**
   * Label class name
   */
  labelClassName?: string;
  /**
   * Whether field is required
   */
  required?: boolean;
  /**
   * Whether field is disabled
   */
  disabled?: boolean;
  /**
   * Custom error message
   */
  error?: string;
  /**
   * Upload handler (for async uploads)
   */
  onUpload?: (files: File[]) => Promise<void>;
  /**
   * Value for uncontrolled usage
   */
  value?: File[] | FileList | null;
  /**
   * Change handler for uncontrolled usage
   */
  onChange?: (files: File[] | null) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileFieldBase = forwardRef<HTMLDivElement, Omit<FileFieldProps, 'name' | 'rules'>>(
  (
    {
      label,
      helperText,
      accept,
      multiple = false,
      maxSize,
      maxFiles = 10,
      showPreview = true,
      dragAndDrop = true,
      containerClassName,
      labelClassName,
      required,
      disabled,
      error,
      onUpload,
      value,
      onChange,
    },
    ref
  ) => {
    const [isDragging, setIsDragging] = useState(false);
    const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const hasError = Boolean(error);

    // Convert FileList or File[] to FileInfo[]
    React.useEffect(() => {
      if (value) {
        const files = Array.isArray(value) ? value : Array.from(value);
        const newFileInfos: FileInfo[] = files.map(file => {
          const info: FileInfo = { file };
          
          // Create preview for images
          if (showPreview && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setFileInfos(prev => 
                prev.map(f => 
                  f.file === file 
                    ? { ...f, preview: e.target?.result as string }
                    : f
                )
              );
            };
            reader.readAsDataURL(file);
          }
          
          return info;
        });
        setFileInfos(newFileInfos);
      } else {
        setFileInfos([]);
      }
    }, [value, showPreview]);

    const validateFile = (file: File): string | null => {
      if (maxSize && file.size > maxSize) {
        return `File size exceeds ${formatFileSize(maxSize)}`;
      }
      
      if (accept) {
        const acceptedTypes = accept.split(',').map(t => t.trim());
        const fileType = file.type;
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        const isAccepted = acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            return fileExtension === type.toLowerCase();
          }
          if (type.endsWith('/*')) {
            return fileType.startsWith(type.replace('/*', '/'));
          }
          return fileType === type;
        });
        
        if (!isAccepted) {
          return `File type not accepted. Allowed: ${accept}`;
        }
      }
      
      return null;
    };

    const handleFiles = async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      
      // Validate file count
      if (multiple && fileArray.length > maxFiles) {
        return;
      }
      
      // Validate and process files
      const validFiles: File[] = [];
      const newFileInfos: FileInfo[] = [];
      
      for (const file of fileArray) {
        const error = validateFile(file);
        if (!error) {
          validFiles.push(file);
          newFileInfos.push({ file, error });
        } else {
          newFileInfos.push({ file, error });
        }
      }
      
      // Update state
      if (multiple) {
        const currentFiles = value ? Array.from(value) : [];
        onChange?.([...currentFiles, ...validFiles]);
      } else {
        onChange?.(validFiles.length > 0 ? validFiles : null);
      }
      
      // Handle upload if provided
      if (onUpload && validFiles.length > 0) {
        try {
          await onUpload(validFiles);
        } catch (err) {
          console.error('Upload failed:', err);
        }
      }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      if (!disabled && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    }, [disabled]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    };

    const removeFile = (index: number) => {
      const currentFiles = value ? Array.from(value) : [];
      const newFiles = currentFiles.filter((_, i) => i !== index);
      onChange?.(newFiles.length > 0 ? newFiles : null);
    };

    const triggerFileSelect = () => {
      fileInputRef.current?.click();
    };

    return (
      <div className={clsx('space-y-2', containerClassName)} ref={ref}>
        {label && (
          <label
            className={clsx(
              'block text-sm font-medium transition-colors',
              hasError
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-gray-300',
              labelClassName
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          disabled={disabled}
          className="sr-only"
        />

        {dragAndDrop ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={triggerFileSelect}
            className={clsx(
              'relative rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200',
              isDragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : hasError
                ? 'border-red-300 dark:border-red-600 hover:border-red-400 dark:hover:border-red-500'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {isDragging ? (
                'Drop files here'
              ) : (
                <>
                  <span className="font-medium">Click to upload</span> or drag and drop
                </>
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {accept ? `${accept} files` : 'Any file type'}
              {maxSize && ` up to ${formatFileSize(maxSize)}`}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={triggerFileSelect}
            disabled={disabled}
            className={clsx(
              'inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
              hasError
                ? 'border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-primary-500',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            Choose {multiple ? 'files' : 'file'}
          </button>
        )}

        {fileInfos.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence>
              {fileInfos.map((fileInfo, index) => (
                <motion.div
                  key={`${fileInfo.file.name}-${index}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    fileInfo.error
                      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                  )}
                >
                  {showPreview && fileInfo.preview ? (
                    <img
                      src={fileInfo.preview}
                      alt={fileInfo.file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : fileInfo.file.type.startsWith('image/') ? (
                    <PhotoIcon className="h-10 w-10 text-gray-400" />
                  ) : (
                    <DocumentIcon className="h-10 w-10 text-gray-400" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {fileInfo.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(fileInfo.file.size)}
                      {fileInfo.error && (
                        <span className="text-red-600 dark:text-red-400 ml-2">
                          - {fileInfo.error}
                        </span>
                      )}
                    </p>
                    {fileInfo.progress !== undefined && (
                      <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${fileInfo.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      aria-label={`Remove ${fileInfo.file.name}`}
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {helperText && !hasError && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        )}

        <FormError error={error} fieldName={label} />
      </div>
    );
  }
);

FileFieldBase.displayName = 'FileFieldBase';

/**
 * FileField component integrated with React Hook Form
 */
export const FileField: React.FC<FileFieldProps> = ({ name, rules, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { value, onChange, ...field }, fieldState: { error } }) => (
        <FileFieldBase
          {...field}
          {...props}
          value={value}
          onChange={onChange}
          error={error?.message}
        />
      )}
    />
  );
};

/**
 * Uncontrolled FileField for use outside of React Hook Form
 */
export const UncontrolledFileField = FileFieldBase;