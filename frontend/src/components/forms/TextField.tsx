import React, { forwardRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { FormError } from './FormError';
import { AnimatePresence, motion } from 'framer-motion';

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
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
   * Helper text displayed below input
   */
  helperText?: string;
  /**
   * Input type
   */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /**
   * Show character counter
   */
  showCounter?: boolean;
  /**
   * Maximum character length
   */
  maxLength?: number;
  /**
   * Show clear button
   */
  clearable?: boolean;
  /**
   * Leading icon component
   */
  leadingIcon?: React.ComponentType<{ className?: string }>;
  /**
   * Trailing icon component
   */
  trailingIcon?: React.ComponentType<{ className?: string }>;
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
   * Input wrapper class name
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
   * Force show/hide password toggle for password fields
   */
  showPasswordToggle?: boolean;
}

const TextFieldBase = forwardRef<HTMLInputElement, Omit<TextFieldProps, 'name' | 'rules'>>(
  (
    {
      label,
      placeholder,
      helperText,
      type = 'text',
      showCounter = false,
      maxLength,
      clearable = false,
      leadingIcon: LeadingIcon,
      trailingIcon: TrailingIcon,
      containerClassName,
      labelClassName,
      wrapperClassName,
      required,
      error,
      showPasswordToggle = true,
      className,
      disabled,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
    const inputType = type === 'password' && showPassword ? 'text' : type;
    const showPasswordButton = type === 'password' && showPasswordToggle && !disabled;
    const showClearButton = clearable && value && !disabled;
    
    const characterCount = typeof value === 'string' ? value.length : 0;
    const hasError = Boolean(error);

    const handleClear = () => {
      if (onChange) {
        const event = {
          target: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
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
        
        <div className={clsx('relative', wrapperClassName)}>
          {LeadingIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LeadingIcon
                className={clsx(
                  'h-5 w-5 transition-colors',
                  hasError
                    ? 'text-red-400'
                    : isFocused
                    ? 'text-primary-500'
                    : 'text-gray-400'
                )}
              />
            </div>
          )}

          <input
            ref={ref}
            type={inputType}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            maxLength={maxLength}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={clsx(
              'block w-full rounded-md border transition-colors duration-200',
              'focus:outline-none focus:ring-2',
              LeadingIcon && 'pl-10',
              (TrailingIcon || showPasswordButton || showClearButton) && 'pr-10',
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
              className
            )}
            {...props}
          />

          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
            <AnimatePresence>
              {showClearButton && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Clear input"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                </motion.button>
              )}
            </AnimatePresence>

            {showPasswordButton && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                ) : (
                  <EyeIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                )}
              </button>
            )}

            {TrailingIcon && !showPasswordButton && !showClearButton && (
              <TrailingIcon
                className={clsx(
                  'h-5 w-5 transition-colors',
                  hasError
                    ? 'text-red-400'
                    : 'text-gray-400'
                )}
              />
            )}
          </div>
        </div>

        {(helperText || (showCounter && maxLength)) && !hasError && (
          <div className="flex justify-between items-center">
            {helperText && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
            )}
            {showCounter && maxLength && (
              <p
                className={clsx(
                  'text-xs transition-colors',
                  characterCount > maxLength * 0.9
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {characterCount}/{maxLength}
              </p>
            )}
          </div>
        )}

        <FormError error={error} fieldName={props.id || props.name} />
      </div>
    );
  }
);

TextFieldBase.displayName = 'TextFieldBase';

/**
 * TextField component integrated with React Hook Form
 */
export const TextField: React.FC<TextFieldProps> = ({ name, rules, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <TextFieldBase
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
 * Uncontrolled TextField for use outside of React Hook Form
 */
export const UncontrolledTextField = TextFieldBase;