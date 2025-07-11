/**
 * Enhanced form field components with built-in validation
 * 
 * These components extend the existing form fields with automatic
 * validation, error display, and status indicators.
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { useFieldValidationState } from '@/contexts/ValidationContext';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { ValidatorFunction } from '@/utils/validation/registry';
import { FormInput } from './FormInput';
import { ValidationIcon } from './ValidationIcon';
import { InlineError } from './InlineError';
import { z, ZodSchema } from 'zod';

export interface ValidationRule {
  validator: ValidatorFunction | ZodSchema;
  message?: string;
  async?: boolean;
}

export interface EnhancedFormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label?: string;
  helperText?: string;
  containerClassName?: string;
  rules?: ValidationRule[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showValidIcon?: boolean;
  showLoadingIcon?: boolean;
  showErrorInline?: boolean;
  errorPosition?: 'bottom' | 'right' | 'tooltip';
  asyncDebounceMs?: number;
  transform?: (value: any) => any;
  format?: (value: any) => string;
  parse?: (value: string) => any;
}

export const EnhancedFormField: React.FC<EnhancedFormFieldProps> = ({
  name,
  label,
  helperText,
  containerClassName,
  rules = [],
  validateOnChange = true,
  validateOnBlur = true,
  showValidIcon = true,
  showLoadingIcon = true,
  showErrorInline = true,
  errorPosition = 'bottom',
  asyncDebounceMs = 500,
  transform,
  format,
  parse,
  className,
  ...inputProps
}) => {
  const formContext = useFormContext();
  const fieldState = useFieldValidationState(name);

  // Create combined validator from rules
  const validator = useMemo(() => {
    if (rules.length === 0) return undefined;

    return async (value: any) => {
      // Run all sync validators first
      for (const rule of rules.filter(r => !r.async)) {
        let error: string | null = null;

        if ('validator' in rule && typeof rule.validator === 'function') {
          const result = rule.validator(value);
          if (!result.isValid) {
            error = rule.message || result.error || 'Validation failed';
          }
        } else if ('parse' in rule.validator) {
          // Zod schema
          try {
            await (rule.validator as ZodSchema).parseAsync(value);
          } catch (err) {
            if (err instanceof z.ZodError) {
              error = rule.message || err.errors[0]?.message || 'Validation failed';
            }
          }
        }

        if (error) return error;
      }

      // Run async validators
      for (const rule of rules.filter(r => r.async)) {
        if ('validator' in rule && typeof rule.validator === 'function') {
          const result = await rule.validator(value);
          if (!result.isValid) {
            return rule.message || result.error || 'Validation failed';
          }
        }
      }

      return null;
    };
  }, [rules]);

  // Field validation hook
  const validation = useFieldValidation({
    schema: z.any(), // We'll use our custom validator instead
    asyncValidator: validator,
    debounceMs: asyncDebounceMs,
    transform,
  });

  // Handle value change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const parsedValue = parse ? parse(rawValue) : rawValue;
    
    fieldState.setValue(parsedValue);
    
    if (validateOnChange) {
      validation.validateDebounced(parsedValue);
    }
  }, [fieldState, parse, validateOnChange, validation]);

  // Handle blur
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    fieldState.setTouched(true);
    
    if (validateOnBlur) {
      const rawValue = e.target.value;
      const parsedValue = parse ? parse(rawValue) : rawValue;
      validation.validate(parsedValue);
    }
    
    inputProps.onBlur?.(e);
  }, [fieldState, parse, validateOnBlur, validation, inputProps]);

  // Sync validation state with field state
  useEffect(() => {
    if (validation.isValidated) {
      fieldState.setError(validation.error || undefined);
    }
  }, [validation.error, validation.isValidated, fieldState]);

  // Format display value
  const displayValue = format && fieldState.value !== undefined 
    ? format(fieldState.value) 
    : fieldState.value;

  // Determine field status
  const status = useMemo(() => {
    if (validation.isValidating || fieldState.isValidating) return 'validating';
    if (fieldState.error && fieldState.isTouched) return 'error';
    if (validation.isValid && fieldState.isTouched) return 'valid';
    return 'default';
  }, [
    validation.isValidating,
    validation.isValid,
    fieldState.isValidating,
    fieldState.error,
    fieldState.isTouched,
  ]);

  // Status icon
  const statusIcon = useMemo(() => {
    if (!showValidIcon && !showLoadingIcon) return null;

    switch (status) {
      case 'validating':
        return showLoadingIcon ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : null;
      case 'valid':
        return showValidIcon ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : null;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  }, [status, showValidIcon, showLoadingIcon]);

  // Form context integration
  if (formContext) {
    return (
      <Controller
        name={name}
        control={formContext.control}
        render={({ field, fieldState: rhfFieldState }) => (
          <div className={clsx('relative', containerClassName)}>
            <div className="relative">
              <FormInput
                {...field}
                {...inputProps}
                label={label}
                error={rhfFieldState.error?.message || fieldState.error}
                helperText={helperText}
                className={clsx(
                  className,
                  status === 'error' && 'border-red-500 focus:border-red-500',
                  status === 'valid' && 'border-green-500 focus:border-green-500'
                )}
                onChange={(e) => {
                  field.onChange(e);
                  handleChange(e);
                }}
                onBlur={(e) => {
                  field.onBlur();
                  handleBlur(e);
                }}
                value={displayValue}
              />
              {statusIcon && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {statusIcon}
                </div>
              )}
            </div>
            
            {showErrorInline && errorPosition === 'bottom' && (
              <AnimatePresence mode="wait">
                {fieldState.error && fieldState.isTouched && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <InlineError error={fieldState.error} />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        )}
      />
    );
  }

  // Standalone mode (without react-hook-form)
  return (
    <div className={clsx('relative', containerClassName)}>
      <div className="relative">
        <FormInput
          {...inputProps}
          name={name}
          label={label}
          error={fieldState.error}
          helperText={helperText}
          className={clsx(
            className,
            status === 'error' && 'border-red-500 focus:border-red-500',
            status === 'valid' && 'border-green-500 focus:border-green-500'
          )}
          onChange={handleChange}
          onBlur={handleBlur}
          value={displayValue}
        />
        {statusIcon && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {statusIcon}
          </div>
        )}
      </div>
      
      {showErrorInline && errorPosition === 'bottom' && (
        <AnimatePresence mode="wait">
          {fieldState.error && fieldState.isTouched && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <InlineError error={fieldState.error} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

// Pre-configured field components with common validation rules
export const EmailField: React.FC<Omit<EnhancedFormFieldProps, 'rules' | 'type'>> = (props) => {
  const emailSchema = z.string().email('Please enter a valid email address');
  
  return (
    <EnhancedFormField
      {...props}
      type="email"
      rules={[{ validator: emailSchema }]}
      autoComplete="email"
    />
  );
};

export const PasswordField: React.FC<Omit<EnhancedFormFieldProps, 'rules' | 'type'>> = (props) => {
  const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number');
  
  return (
    <EnhancedFormField
      {...props}
      type="password"
      rules={[{ validator: passwordSchema }]}
      autoComplete="new-password"
    />
  );
};

export const PhoneField: React.FC<Omit<EnhancedFormFieldProps, 'rules' | 'type'>> = (props) => {
  const phoneSchema = z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number');
  
  return (
    <EnhancedFormField
      {...props}
      type="tel"
      rules={[{ validator: phoneSchema }]}
      autoComplete="tel"
    />
  );
};

export const UrlField: React.FC<Omit<EnhancedFormFieldProps, 'rules' | 'type'>> = (props) => {
  const urlSchema = z.string().url('Please enter a valid URL');
  
  return (
    <EnhancedFormField
      {...props}
      type="url"
      rules={[{ validator: urlSchema }]}
      autoComplete="url"
    />
  );
};

export const NumberField: React.FC<
  Omit<EnhancedFormFieldProps, 'rules' | 'type' | 'parse' | 'format'> & {
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
  }
> = ({ min, max, step, precision = 2, ...props }) => {
  const numberSchema = z.number({
    required_error: 'This field is required',
    invalid_type_error: 'Please enter a valid number',
  });
  
  let schema = numberSchema;
  if (min !== undefined) schema = schema.min(min, `Must be at least ${min}`);
  if (max !== undefined) schema = schema.max(max, `Must be no more than ${max}`);
  
  return (
    <EnhancedFormField
      {...props}
      type="number"
      min={min}
      max={max}
      step={step}
      rules={[{ validator: schema }]}
      parse={(value) => value === '' ? undefined : Number(value)}
      format={(value) => value !== undefined ? String(value) : ''}
    />
  );
};