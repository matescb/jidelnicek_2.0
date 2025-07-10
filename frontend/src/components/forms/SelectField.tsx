import React, { forwardRef, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { 
  ChevronDownIcon, 
  CheckIcon, 
  XMarkIcon,
  MagnifyingGlassIcon 
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { FormError } from './FormError';
import { AnimatePresence, motion } from 'framer-motion';

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface SelectFieldProps {
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
   * Helper text displayed below select
   */
  helperText?: string;
  /**
   * Available options
   */
  options: SelectOption[];
  /**
   * Enable multi-select
   */
  multiple?: boolean;
  /**
   * Enable search/filter
   */
  searchable?: boolean;
  /**
   * Search placeholder
   */
  searchPlaceholder?: string;
  /**
   * Async options loader
   */
  loadOptions?: (query: string) => Promise<SelectOption[]>;
  /**
   * Loading state for async options
   */
  isLoading?: boolean;
  /**
   * Custom option renderer
   */
  renderOption?: (option: SelectOption, isSelected: boolean) => React.ReactNode;
  /**
   * Custom value renderer
   */
  renderValue?: (value: any, options: SelectOption[]) => React.ReactNode;
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
  value?: any;
  /**
   * Change handler for uncontrolled usage
   */
  onChange?: (value: any) => void;
}

const SelectFieldBase = forwardRef<HTMLDivElement, Omit<SelectFieldProps, 'name' | 'rules'>>(
  (
    {
      label,
      placeholder = 'Select an option',
      helperText,
      options = [],
      multiple = false,
      searchable = false,
      searchPlaceholder = 'Search...',
      loadOptions,
      isLoading = false,
      renderOption,
      renderValue,
      clearable = false,
      containerClassName,
      labelClassName,
      required,
      disabled,
      error,
      value,
      onChange,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [asyncOptions, setAsyncOptions] = useState<SelectOption[]>([]);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const hasError = Boolean(error);

    // Handle click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    // Focus search input when dropdown opens
    useEffect(() => {
      if (isOpen && searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen, searchable]);

    // Load async options
    useEffect(() => {
      if (loadOptions && isOpen) {
        setIsLoadingOptions(true);
        loadOptions(searchQuery)
          .then(setAsyncOptions)
          .catch(() => setAsyncOptions([]))
          .finally(() => setIsLoadingOptions(false));
      }
    }, [loadOptions, searchQuery, isOpen]);

    const displayOptions = loadOptions ? asyncOptions : options;

    // Filter options based on search
    const filteredOptions = useMemo(() => {
      if (!searchQuery) return displayOptions;
      
      const query = searchQuery.toLowerCase();
      return displayOptions.filter(option => 
        option.label.toLowerCase().includes(query) ||
        (option.description && option.description.toLowerCase().includes(query))
      );
    }, [displayOptions, searchQuery]);

    // Group options
    const groupedOptions = useMemo(() => {
      const groups: Record<string, SelectOption[]> = {};
      const ungrouped: SelectOption[] = [];

      filteredOptions.forEach(option => {
        if (option.group) {
          if (!groups[option.group]) groups[option.group] = [];
          groups[option.group].push(option);
        } else {
          ungrouped.push(option);
        }
      });

      return { groups, ungrouped };
    }, [filteredOptions]);

    const handleSelect = (option: SelectOption) => {
      if (option.disabled) return;

      if (multiple) {
        const currentValues = Array.isArray(value) ? value : [];
        const newValues = currentValues.includes(option.value)
          ? currentValues.filter(v => v !== option.value)
          : [...currentValues, option.value];
        onChange?.(newValues);
      } else {
        onChange?.(option.value);
        setIsOpen(false);
      }
      setSearchQuery('');
    };

    const handleClear = () => {
      onChange?.(multiple ? [] : null);
    };

    const isSelected = (option: SelectOption) => {
      if (multiple) {
        return Array.isArray(value) && value.includes(option.value);
      }
      return value === option.value;
    };

    const getDisplayValue = () => {
      if (renderValue) {
        return renderValue(value, displayOptions);
      }

      if (!value || (Array.isArray(value) && value.length === 0)) {
        return null;
      }

      if (multiple && Array.isArray(value)) {
        const selectedOptions = displayOptions.filter(opt => value.includes(opt.value));
        return selectedOptions.map(opt => opt.label).join(', ');
      }

      const selectedOption = displayOptions.find(opt => opt.value === value);
      return selectedOption?.label || null;
    };

    const displayValue = getDisplayValue();
    const showClearButton = clearable && value && !disabled && 
      (multiple ? Array.isArray(value) && value.length > 0 : true);

    const defaultRenderOption = (option: SelectOption, selected: boolean) => (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {option.icon && <option.icon className="h-5 w-5 text-gray-400" />}
          <div>
            <div className="text-sm">{option.label}</div>
            {option.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
            )}
          </div>
        </div>
        {selected && <CheckIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />}
      </div>
    );

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

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={clsx(
              'relative w-full rounded-md border px-3 py-2 text-left',
              'focus:outline-none focus:ring-2 transition-colors duration-200',
              hasError
                ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500/20',
              disabled
                ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60'
                : 'bg-white dark:bg-gray-900 cursor-pointer',
              'text-gray-900 dark:text-gray-100'
            )}
          >
            <span className={clsx('block truncate pr-8', !displayValue && 'text-gray-400')}>
              {displayValue || placeholder}
            </span>
            <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              {showClearButton ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded pointer-events-auto"
                  aria-label="Clear selection"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                </button>
              ) : (
                <ChevronDownIcon 
                  className={clsx(
                    'h-5 w-5 text-gray-400 transition-transform duration-200',
                    isOpen && 'transform rotate-180'
                  )} 
                />
              )}
            </span>
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute z-10 mt-1 w-full rounded-md bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-700"
              >
                {searchable && (
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-gray-800"
                      />
                    </div>
                  </div>
                )}

                <div className="max-h-60 overflow-auto py-1">
                  {isLoading || isLoadingOptions ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                  ) : filteredOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No options found</div>
                  ) : (
                    <>
                      {groupedOptions.ungrouped.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelect(option)}
                          disabled={option.disabled}
                          className={clsx(
                            'w-full px-3 py-2 text-sm text-left transition-colors',
                            option.disabled
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
                            isSelected(option) && 'bg-primary-50 dark:bg-primary-900/20'
                          )}
                        >
                          {renderOption ? renderOption(option, isSelected(option)) : defaultRenderOption(option, isSelected(option))}
                        </button>
                      ))}

                      {Object.entries(groupedOptions.groups).map(([groupName, groupOptions]) => (
                        <div key={groupName}>
                          <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {groupName}
                          </div>
                          {groupOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleSelect(option)}
                              disabled={option.disabled}
                              className={clsx(
                                'w-full px-3 py-2 text-sm text-left transition-colors',
                                option.disabled
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
                                isSelected(option) && 'bg-primary-50 dark:bg-primary-900/20'
                              )}
                            >
                              {renderOption ? renderOption(option, isSelected(option)) : defaultRenderOption(option, isSelected(option))}
                            </button>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {helperText && !hasError && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        )}

        <FormError error={error} fieldName={label} />
      </div>
    );
  }
);

SelectFieldBase.displayName = 'SelectFieldBase';

/**
 * SelectField component integrated with React Hook Form
 */
export const SelectField: React.FC<SelectFieldProps> = ({ name, rules, ...props }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <SelectFieldBase
          {...field}
          {...props}
          error={error?.message}
        />
      )}
    />
  );
};

/**
 * Uncontrolled SelectField for use outside of React Hook Form
 */
export const UncontrolledSelectField = SelectFieldBase;

export type { SelectOption };