import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { 
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListBulletIcon,
  NumberedListIcon,
  CodeBracketIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { FormError } from './FormError';
import { AnimatePresence, motion } from 'framer-motion';

interface TextareaFieldProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  /**
   * Field name for form registration
   */
  name: string;
  /**
   * Field label
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Helper text displayed below textarea
   */
  helperText?: string;
  /**
   * Auto-resize to content
   */
  autoResize?: boolean;
  /**
   * Minimum rows (default: 3)
   */
  minRows?: number;
  /**
   * Maximum rows for auto-resize
   */
  maxRows?: number;
  /**
   * Show character counter
   */
  showCounter?: boolean;
  /**
   * Show word counter
   */
  showWordCounter?: boolean;
  /**
   * Maximum character length
   */
  maxLength?: number;
  /**
   * Enable markdown preview
   */
  enableMarkdownPreview?: boolean;
  /**
   * Show rich text toolbar
   */
  showToolbar?: boolean;
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
   * Wrapper class name
   */
  wrapperClassName?: string;
  /**
   * Whether field is required
   */
  required?: boolean;
  /**
   * Custom error message
   */
  error?: string;
  /**
   * Render markdown content (for preview)
   */
  renderMarkdown?: (content: string) => React.ReactNode;
}

const TextareaFieldBase = forwardRef<HTMLTextAreaElement, Omit<TextareaFieldProps, 'name' | 'rules'>>(
  (
    {
      label,
      placeholder,
      helperText,
      autoResize = false,
      minRows = 3,
      maxRows = 10,
      showCounter = false,
      showWordCounter = false,
      maxLength,
      enableMarkdownPreview = false,
      showToolbar = false,
      containerClassName,
      labelClassName,
      wrapperClassName,
      required,
      error,
      className,
      disabled,
      value = '',
      onChange,
      renderMarkdown,
      ...props
    },
    ref
  ) => {
    const [showPreview, setShowPreview] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const hasError = Boolean(error);
    const content = String(value);
    const characterCount = content.length;
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

    // Auto-resize functionality
    useEffect(() => {
      if (autoResize && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const minHeight = minRows * 24; // Approximate line height
        const maxHeight = maxRows * 24;
        textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
      }
    }, [value, autoResize, minRows, maxRows]);

    // Toolbar actions
    const insertMarkdown = (prefix: string, suffix: string = '') => {
      if (!textareaRef.current || disabled) return;

      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      const newText = `${content.substring(0, start)}${prefix}${selectedText}${suffix}${content.substring(end)}`;
      
      if (onChange) {
        const event = {
          target: { value: newText },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(event);
      }

      // Restore focus and selection
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    };

    return (
      <div className={clsx('space-y-1', containerClassName)}>
        {label && (
          <label
            htmlFor={props.id}
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

        {showToolbar && !showPreview && (
          <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-t-md border border-b-0 border-gray-300 dark:border-gray-600">
            <button
              type="button"
              onClick={() => insertMarkdown('**', '**')}
              disabled={disabled}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Bold"
            >
              <BoldIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('*', '*')}
              disabled={disabled}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Italic"
            >
              <ItalicIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('[', '](url)')}
              disabled={disabled}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Link"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
            <button
              type="button"
              onClick={() => insertMarkdown('- ')}
              disabled={disabled}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Bullet list"
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('1. ')}
              disabled={disabled}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Numbered list"
            >
              <NumberedListIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('`', '`')}
              disabled={disabled}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Code"
            >
              <CodeBracketIcon className="h-4 w-4" />
            </button>
            {enableMarkdownPreview && renderMarkdown && (
              <>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 text-sm"
                >
                  {showPreview ? (
                    <>
                      <EyeSlashIcon className="h-4 w-4" />
                      Edit
                    </>
                  ) : (
                    <>
                      <EyeIcon className="h-4 w-4" />
                      Preview
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        <div className={clsx('relative', wrapperClassName)}>
          {showPreview && renderMarkdown ? (
            <div
              className={clsx(
                'min-h-[4.5rem] p-3 rounded-md border transition-colors duration-200',
                'bg-gray-50 dark:bg-gray-800',
                'border-gray-300 dark:border-gray-600',
                'prose prose-sm dark:prose-invert max-w-none',
                className
              )}
            >
              {renderMarkdown(content) || <span className="text-gray-400 italic">Nothing to preview</span>}
            </div>
          ) : (
            <textarea
              ref={(node) => {
                // Handle both refs
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
                textareaRef.current = node;
              }}
              value={value}
              onChange={onChange}
              disabled={disabled}
              placeholder={placeholder}
              maxLength={maxLength}
              rows={minRows}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={clsx(
                'block w-full rounded-md border transition-colors duration-200',
                'focus:outline-none focus:ring-2',
                showToolbar && 'rounded-t-none',
                hasError
                  ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500/20',
                disabled
                  ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60'
                  : 'bg-white dark:bg-gray-900',
                'text-gray-900 dark:text-gray-100',
                'placeholder-gray-400 dark:placeholder-gray-500',
                'sm:text-sm',
                'px-3 py-2',
                autoResize && 'resize-none',
                className
              )}
              {...props}
            />
          )}
        </div>

        {(helperText || showCounter || showWordCounter) && !hasError && (
          <div className="flex justify-between items-center flex-wrap gap-2">
            {helperText && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
            )}
            <div className="flex items-center gap-3 text-xs">
              {showWordCounter && (
                <span className="text-gray-500 dark:text-gray-400">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
              )}
              {showCounter && maxLength && (
                <span
                  className={clsx(
                    'transition-colors',
                    characterCount > maxLength * 0.9
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  {characterCount}/{maxLength}
                </span>
              )}
            </div>
          </div>
        )}

        <FormError error={error} fieldName={props.id || props.name} />
      </div>
    );
  }
);

TextareaFieldBase.displayName = 'TextareaFieldBase';

/**
 * TextareaField component integrated with React Hook Form
 */
export const TextareaField: React.FC<TextareaFieldProps> = ({ name, rules, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <TextareaFieldBase
          {...field}
          {...props}
          error={error?.message}
          id={name}
        />
      )}
    />
  );
};

/**
 * Uncontrolled TextareaField for use outside of React Hook Form
 */
export const UncontrolledTextareaField = TextareaFieldBase;