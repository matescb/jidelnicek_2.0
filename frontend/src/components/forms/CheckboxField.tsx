import React, { forwardRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { CheckIcon, MinusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { FormError } from './FormError';
import { motion } from 'framer-motion';

interface CheckboxOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface CheckboxFieldProps {
  /**
   * Field name for form registration
   */
  name: string;
  /**
   * Field label
   */
  label?: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Helper text
   */
  helperText?: string;
  /**
   * Show as switch instead of checkbox
   */
  variant?: 'checkbox' | 'switch';
  /**
   * Checkbox size
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Color variant
   */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
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
   * Indeterminate state (for checkbox only)
   */
  indeterminate?: boolean;
  /**
   * Value for uncontrolled usage
   */
  checked?: boolean;
  /**
   * Change handler for uncontrolled usage
   */
  onChange?: (checked: boolean) => void;
}

interface CheckboxGroupFieldProps {
  /**
   * Field name for form registration
   */
  name: string;
  /**
   * Group label
   */
  label?: string;
  /**
   * Available options
   */
  options: CheckboxOption[];
  /**
   * Layout direction
   */
  layout?: 'horizontal' | 'vertical';
  /**
   * Helper text
   */
  helperText?: string;
  /**
   * Show as switches instead of checkboxes
   */
  variant?: 'checkbox' | 'switch';
  /**
   * Custom validation rules
   */
  rules?: any;
  /**
   * Container class name
   */
  containerClassName?: string;
  /**
   * Whether field is required
   */
  required?: boolean;
  /**
   * Custom error message
   */
  error?: string;
  /**
   * Value for uncontrolled usage
   */
  value?: (string | number)[];
  /**
   * Change handler for uncontrolled usage
   */
  onChange?: (value: (string | number)[]) => void;
}

const sizeClasses = {
  sm: {
    checkbox: 'h-4 w-4',
    switch: 'h-5 w-10',
    label: 'text-sm',
  },
  md: {
    checkbox: 'h-5 w-5',
    switch: 'h-6 w-11',
    label: 'text-base',
  },
  lg: {
    checkbox: 'h-6 w-6',
    switch: 'h-7 w-14',
    label: 'text-lg',
  },
};

const colorClasses = {
  primary: 'text-primary-600 dark:text-primary-500 focus:ring-primary-500/20',
  secondary: 'text-gray-600 dark:text-gray-500 focus:ring-gray-500/20',
  success: 'text-green-600 dark:text-green-500 focus:ring-green-500/20',
  warning: 'text-amber-600 dark:text-amber-500 focus:ring-amber-500/20',
  error: 'text-red-600 dark:text-red-500 focus:ring-red-500/20',
};

const CheckboxFieldBase = forwardRef<HTMLInputElement, Omit<CheckboxFieldProps, 'name' | 'rules'>>(
  (
    {
      label,
      description,
      helperText,
      variant = 'checkbox',
      size = 'md',
      color = 'primary',
      containerClassName,
      labelClassName,
      required,
      disabled,
      error,
      indeterminate,
      checked = false,
      onChange,
    },
    ref
  ) => {
    const hasError = Boolean(error);
    const sizeClass = sizeClasses[size];
    const colorClass = colorClasses[hasError ? 'error' : color];

    if (variant === 'switch') {
      return (
        <div className={clsx('space-y-1', containerClassName)}>
          <label className="flex items-start gap-3 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              onClick={() => !disabled && onChange?.(!checked)}
              disabled={disabled}
              className={clsx(
                'relative inline-flex flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                'focus:outline-none focus:ring-2',
                sizeClass.switch,
                colorClass,
                checked
                  ? hasError
                    ? 'bg-red-600 dark:bg-red-500'
                    : 'bg-primary-600 dark:bg-primary-500'
                  : 'bg-gray-200 dark:bg-gray-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  'pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  size === 'sm' && 'h-4 w-4',
                  size === 'md' && 'h-5 w-5',
                  size === 'lg' && 'h-6 w-6',
                  checked
                    ? size === 'sm'
                      ? 'translate-x-5'
                      : size === 'md'
                      ? 'translate-x-5'
                      : 'translate-x-7'
                    : 'translate-x-0'
                )}
              />
            </button>
            <div className="flex-1">
              {label && (
                <span
                  className={clsx(
                    'font-medium',
                    sizeClass.label,
                    hasError
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-gray-100',
                    disabled && 'opacity-50',
                    labelClassName
                  )}
                >
                  {label}
                  {required && <span className="text-red-500 ml-1">*</span>}
                </span>
              )}
              {description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
              )}
            </div>
          </label>
          {helperText && !hasError && (
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-9">{helperText}</p>
          )}
          <FormError error={error} />
        </div>
      );
    }

    return (
      <div className={clsx('space-y-1', containerClassName)}>
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="flex items-center h-5">
            <input
              ref={ref}
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange?.(e.target.checked)}
              disabled={disabled}
              className={clsx(
                'rounded border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2',
                sizeClass.checkbox,
                colorClass,
                hasError && 'border-red-300 dark:border-red-600',
                disabled && 'opacity-50 cursor-not-allowed',
                'transition-colors duration-200'
              )}
            />
            {indeterminate && (
              <MinusIcon
                className={clsx(
                  'absolute pointer-events-none',
                  sizeClass.checkbox,
                  'text-white'
                )}
              />
            )}
          </div>
          <div className="flex-1">
            {label && (
              <span
                className={clsx(
                  'font-medium',
                  sizeClass.label,
                  hasError
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-gray-100',
                  disabled && 'opacity-50',
                  labelClassName
                )}
              >
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </span>
            )}
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            )}
          </div>
        </label>
        {helperText && !hasError && (
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">{helperText}</p>
        )}
        <FormError error={error} />
      </div>
    );
  }
);

CheckboxFieldBase.displayName = 'CheckboxFieldBase';

const CheckboxGroupFieldBase = forwardRef<HTMLDivElement, Omit<CheckboxGroupFieldProps, 'name' | 'rules'>>(
  (
    {
      label,
      options,
      layout = 'vertical',
      helperText,
      variant = 'checkbox',
      containerClassName,
      required,
      error,
      value = [],
      onChange,
    },
    ref
  ) => {
    const hasError = Boolean(error);

    const handleToggle = (optionValue: string | number) => {
      const newValue = value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue];
      onChange?.(newValue);
    };

    return (
      <div className={clsx('space-y-2', containerClassName)} ref={ref}>
        {label && (
          <label
            className={clsx(
              'block text-sm font-medium',
              hasError
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-gray-300'
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <div
          className={clsx(
            'space-y-2',
            layout === 'horizontal' && 'flex flex-wrap gap-4 space-y-0'
          )}
        >
          {options.map((option) => (
            <CheckboxFieldBase
              key={option.value}
              label={option.label}
              description={option.description}
              variant={variant}
              checked={value.includes(option.value)}
              onChange={() => handleToggle(option.value)}
              disabled={option.disabled}
              size="sm"
            />
          ))}
        </div>

        {helperText && !hasError && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
        
        <FormError error={error} />
      </div>
    );
  }
);

CheckboxGroupFieldBase.displayName = 'CheckboxGroupFieldBase';

/**
 * CheckboxField component integrated with React Hook Form
 */
export const CheckboxField: React.FC<CheckboxFieldProps> = ({ name, rules, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { value, onChange, ...field }, fieldState: { error } }) => (
        <CheckboxFieldBase
          {...field}
          {...props}
          checked={value || false}
          onChange={onChange}
          error={error?.message}
        />
      )}
    />
  );
};

/**
 * CheckboxGroupField component integrated with React Hook Form
 */
export const CheckboxGroupField: React.FC<CheckboxGroupFieldProps> = ({ name, rules, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <CheckboxGroupFieldBase
          {...field}
          {...props}
          error={error?.message}
        />
      )}
    />
  );
};

/**
 * Uncontrolled CheckboxField for use outside of React Hook Form
 */
export const UncontrolledCheckboxField = CheckboxFieldBase;

/**
 * Uncontrolled CheckboxGroupField for use outside of React Hook Form
 */
export const UncontrolledCheckboxGroupField = CheckboxGroupFieldBase;

export type { CheckboxOption };