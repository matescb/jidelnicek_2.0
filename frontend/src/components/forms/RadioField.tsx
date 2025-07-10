import React, { forwardRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import clsx from 'clsx';
import { FormError } from './FormError';
import { motion } from 'framer-motion';

interface RadioOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

interface RadioFieldProps {
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
  options: RadioOption[];
  /**
   * Layout direction
   */
  layout?: 'horizontal' | 'vertical';
  /**
   * Display variant
   */
  variant?: 'default' | 'card';
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Helper text
   */
  helperText?: string;
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
   * Custom error message
   */
  error?: string;
  /**
   * Value for uncontrolled usage
   */
  value?: string | number;
  /**
   * Change handler for uncontrolled usage
   */
  onChange?: (value: string | number) => void;
}

const sizeClasses = {
  sm: {
    radio: 'h-4 w-4',
    label: 'text-sm',
    card: 'p-3',
  },
  md: {
    radio: 'h-5 w-5',
    label: 'text-base',
    card: 'p-4',
  },
  lg: {
    radio: 'h-6 w-6',
    label: 'text-lg',
    card: 'p-5',
  },
};

const RadioFieldBase = forwardRef<HTMLDivElement, Omit<RadioFieldProps, 'name' | 'rules'>>(
  (
    {
      label,
      options,
      layout = 'vertical',
      variant = 'default',
      size = 'md',
      helperText,
      containerClassName,
      labelClassName,
      required,
      error,
      value,
      onChange,
    },
    ref
  ) => {
    const hasError = Boolean(error);
    const sizeClass = sizeClasses[size];

    const renderDefaultOption = (option: RadioOption) => (
      <label
        key={option.value}
        className={clsx(
          'flex items-start gap-3 cursor-pointer',
          option.disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center h-5">
          <input
            type="radio"
            name={label}
            value={option.value}
            checked={value === option.value}
            onChange={() => !option.disabled && onChange?.(option.value)}
            disabled={option.disabled}
            className={clsx(
              'border-gray-300 dark:border-gray-600',
              'text-primary-600 dark:text-primary-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              sizeClass.radio,
              hasError && 'border-red-300 dark:border-red-600 text-red-600 dark:text-red-500',
              'transition-colors duration-200'
            )}
          />
        </div>
        <div className="flex-1">
          <span
            className={clsx(
              'font-medium',
              sizeClass.label,
              hasError
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-900 dark:text-gray-100',
              option.disabled && 'opacity-50'
            )}
          >
            {option.label}
          </span>
          {option.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{option.description}</p>
          )}
        </div>
      </label>
    );

    const renderCardOption = (option: RadioOption) => (
      <motion.button
        key={option.value}
        type="button"
        onClick={() => !option.disabled && onChange?.(option.value)}
        disabled={option.disabled}
        whileTap={{ scale: option.disabled ? 1 : 0.98 }}
        className={clsx(
          'relative w-full text-left rounded-lg border-2 transition-all duration-200',
          sizeClass.card,
          value === option.value
            ? hasError
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
          option.disabled && 'opacity-50 cursor-not-allowed',
          !option.disabled && 'cursor-pointer'
        )}
      >
        <div className="flex items-start gap-3">
          {option.icon && (
            <option.icon
              className={clsx(
                'h-6 w-6 flex-shrink-0',
                value === option.value
                  ? hasError
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span
                className={clsx(
                  'font-medium',
                  sizeClass.label,
                  value === option.value
                    ? hasError
                      ? 'text-red-900 dark:text-red-100'
                      : 'text-primary-900 dark:text-primary-100'
                    : 'text-gray-900 dark:text-gray-100'
                )}
              >
                {option.label}
              </span>
              <div
                className={clsx(
                  'ml-3 rounded-full border-2 transition-colors',
                  sizeClass.radio,
                  value === option.value
                    ? hasError
                      ? 'border-red-600 dark:border-red-400'
                      : 'border-primary-600 dark:border-primary-400'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {value === option.value && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={clsx(
                      'w-full h-full rounded-full',
                      hasError
                        ? 'bg-red-600 dark:bg-red-400'
                        : 'bg-primary-600 dark:bg-primary-400',
                      'scale-[0.6]'
                    )}
                  />
                )}
              </div>
            </div>
            {option.description && (
              <p
                className={clsx(
                  'text-sm mt-1',
                  value === option.value
                    ? hasError
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-primary-700 dark:text-primary-300'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {option.description}
              </p>
            )}
          </div>
        </div>
      </motion.button>
    );

    return (
      <div className={clsx('space-y-2', containerClassName)} ref={ref}>
        {label && (
          <label
            className={clsx(
              'block text-sm font-medium',
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

        <div
          className={clsx(
            variant === 'default' && 'space-y-3',
            variant === 'card' && 'grid gap-3',
            variant === 'card' && layout === 'horizontal' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
            variant === 'card' && layout === 'vertical' && 'grid-cols-1',
            variant === 'default' && layout === 'horizontal' && 'flex flex-wrap gap-6'
          )}
          role="radiogroup"
          aria-label={label}
          aria-required={required}
          aria-invalid={hasError}
        >
          {options.map((option) =>
            variant === 'card' ? renderCardOption(option) : renderDefaultOption(option)
          )}
        </div>

        {helperText && !hasError && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        )}

        <FormError error={error} fieldName={label} />
      </div>
    );
  }
);

RadioFieldBase.displayName = 'RadioFieldBase';

/**
 * RadioField component integrated with React Hook Form
 */
export const RadioField: React.FC<RadioFieldProps> = ({ name, rules, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <RadioFieldBase
          {...field}
          {...props}
          error={error?.message}
        />
      )}
    />
  );
};

/**
 * Uncontrolled RadioField for use outside of React Hook Form
 */
export const UncontrolledRadioField = RadioFieldBase;

export type { RadioOption };