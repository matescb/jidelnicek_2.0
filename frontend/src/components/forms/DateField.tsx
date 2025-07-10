import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { CalendarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { FormError } from './FormError';
import { format, parse, isValid, startOfDay, endOfDay } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import { useI18nFormats } from '../../hooks/useI18nFormats';

interface DateFieldProps {
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
   * Date picker mode
   */
  mode?: 'date' | 'datetime' | 'time';
  /**
   * Minimum date constraint
   */
  minDate?: Date | string;
  /**
   * Maximum date constraint
   */
  maxDate?: Date | string;
  /**
   * Custom date format (uses locale default if not provided)
   */
  dateFormat?: string;
  /**
   * Enable date range selection
   */
  isRange?: boolean;
  /**
   * Timezone for datetime mode
   */
  timezone?: string;
  /**
   * Show timezone selector
   */
  showTimezone?: boolean;
  /**
   * Disabled dates function
   */
  isDateDisabled?: (date: Date) => boolean;
  /**
   * Show clear button
   */
  clearable?: boolean;
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
   * Value for uncontrolled usage
   */
  value?: Date | string | [Date, Date] | null;
  /**
   * Change handler for uncontrolled usage
   */
  onChange?: (value: Date | [Date, Date] | null) => void;
  /**
   * Locale
   */
  locale?: 'cs' | 'en';
}

const DateFieldBase = forwardRef<HTMLDivElement, Omit<DateFieldProps, 'name' | 'rules'>>(
  (
    {
      label,
      placeholder,
      helperText,
      mode = 'date',
      minDate,
      maxDate,
      dateFormat: customDateFormat,
      isRange = false,
      timezone,
      showTimezone = false,
      isDateDisabled,
      clearable = true,
      containerClassName,
      labelClassName,
      required,
      disabled,
      error,
      value,
      onChange,
      locale = 'cs',
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const { dateFormat, timeFormat, dateTimeFormat } = useI18nFormats();
    
    const hasError = Boolean(error);
    const dateLocale = locale === 'cs' ? cs : enUS;

    // Determine format based on mode
    const getFormat = () => {
      if (customDateFormat) return customDateFormat;
      switch (mode) {
        case 'time':
          return timeFormat;
        case 'datetime':
          return dateTimeFormat;
        default:
          return dateFormat;
      }
    };

    const displayFormat = getFormat();

    // Format value for display
    useEffect(() => {
      if (!value) {
        setInputValue('');
        return;
      }

      try {
        if (isRange && Array.isArray(value)) {
          const [start, end] = value;
          const formattedStart = format(start, displayFormat, { locale: dateLocale });
          const formattedEnd = format(end, displayFormat, { locale: dateLocale });
          setInputValue(`${formattedStart} - ${formattedEnd}`);
        } else if (value instanceof Date) {
          setInputValue(format(value, displayFormat, { locale: dateLocale }));
        } else if (typeof value === 'string') {
          const date = new Date(value);
          if (isValid(date)) {
            setInputValue(format(date, displayFormat, { locale: dateLocale }));
          }
        }
      } catch (err) {
        setInputValue('');
      }
    }, [value, displayFormat, isRange, dateLocale]);

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // Try to parse the input
      try {
        if (isRange) {
          const [startStr, endStr] = newValue.split(' - ');
          if (startStr && endStr) {
            const start = parse(startStr.trim(), displayFormat, new Date(), { locale: dateLocale });
            const end = parse(endStr.trim(), displayFormat, new Date(), { locale: dateLocale });
            if (isValid(start) && isValid(end)) {
              onChange?.([start, end]);
            }
          }
        } else {
          const date = parse(newValue, displayFormat, new Date(), { locale: dateLocale });
          if (isValid(date)) {
            onChange?.(date);
          }
        }
      } catch (err) {
        // Invalid format, wait for valid input
      }
    };

    const handleClear = () => {
      setInputValue('');
      onChange?.(null);
    };

    // Simple calendar UI (in production, use a proper date picker library)
    const renderCalendar = () => {
      // This is a simplified placeholder - in production use react-datepicker or similar
      return (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Calendar component would go here
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="mt-2 px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Close
          </button>
        </div>
      );
    };

    // Handle click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    const showClearButton = clearable && value && !disabled;

    return (
      <div className={clsx('space-y-1', containerClassName)} ref={ref}>
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

        <div className="relative" ref={containerRef}>
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder || displayFormat.toLowerCase()}
              disabled={disabled}
              className={clsx(
                'block w-full rounded-md border pl-3 pr-10 py-2',
                'focus:outline-none focus:ring-2 transition-colors duration-200',
                hasError
                  ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500/20',
                disabled
                  ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60'
                  : 'bg-white dark:bg-gray-900',
                'text-gray-900 dark:text-gray-100',
                'placeholder-gray-400 dark:placeholder-gray-500',
                'sm:text-sm'
              )}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
              {showClearButton && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Clear date"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                </button>
              )}
              <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                aria-label="Open calendar"
              >
                <CalendarIcon
                  className={clsx(
                    'h-5 w-5',
                    hasError ? 'text-red-400' : 'text-gray-400'
                  )}
                />
              </button>
            </div>
          </div>

          {isOpen && renderCalendar()}
        </div>

        {showTimezone && mode === 'datetime' && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Timezone: {timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
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

DateFieldBase.displayName = 'DateFieldBase';

/**
 * DateField component integrated with React Hook Form
 */
export const DateField: React.FC<DateFieldProps> = ({ name, rules, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <DateFieldBase
          {...field}
          {...props}
          error={error?.message}
        />
      )}
    />
  );
};

/**
 * Uncontrolled DateField for use outside of React Hook Form
 */
export const UncontrolledDateField = DateFieldBase;