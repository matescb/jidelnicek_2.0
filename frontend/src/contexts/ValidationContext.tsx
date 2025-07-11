/**
 * Validation context for form state management
 * 
 * This context provides centralized validation state management,
 * field tracking, and submission attempt counting.
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { ErrorMessage, ErrorSeverity } from '@/utils/validation/errorMessages';

export interface FieldValidationState {
  value: any;
  error?: string;
  warnings?: string[];
  isValidating: boolean;
  isValidated: boolean;
  isDirty: boolean;
  isTouched: boolean;
  validatedAt?: number;
}

export interface FormValidationState {
  fields: Record<string, FieldValidationState>;
  isValidating: boolean;
  isValid: boolean;
  isDirty: boolean;
  submitCount: number;
  lastSubmitAt?: number;
  errors: ErrorMessage[];
  warnings: ErrorMessage[];
}

export interface ValidationContextValue {
  // Form state
  formState: FormValidationState;
  
  // Field operations
  setFieldValue: (field: string, value: any) => void;
  setFieldError: (field: string, error?: string) => void;
  setFieldWarnings: (field: string, warnings?: string[]) => void;
  setFieldValidating: (field: string, isValidating: boolean) => void;
  setFieldTouched: (field: string, isTouched: boolean) => void;
  setFieldDirty: (field: string, isDirty: boolean) => void;
  
  // Bulk operations
  setFieldsValues: (values: Record<string, any>) => void;
  setFieldsErrors: (errors: Record<string, string | undefined>) => void;
  resetField: (field: string) => void;
  resetForm: () => void;
  
  // Validation operations
  validateField: (field: string) => Promise<boolean>;
  validateFields: (fields?: string[]) => Promise<boolean>;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  
  // Submit operations
  incrementSubmitCount: () => void;
  getFieldState: (field: string) => FieldValidationState | undefined;
  
  // Utility functions
  isFieldValid: (field: string) => boolean;
  isFieldDirty: (field: string) => boolean;
  isFieldTouched: (field: string) => boolean;
  getFieldError: (field: string) => string | undefined;
  getAllErrors: () => Record<string, string>;
  hasErrors: () => boolean;
}

const ValidationContext = createContext<ValidationContextValue | undefined>(undefined);

export interface ValidationProviderProps {
  children: ReactNode;
  initialValues?: Record<string, any>;
  onValidate?: (field: string, value: any) => Promise<string | undefined>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnSubmit?: boolean;
}

export function ValidationProvider({
  children,
  initialValues = {},
  onValidate,
  validateOnChange = true,
  validateOnBlur = true,
  validateOnSubmit = true,
}: ValidationProviderProps) {
  const [formState, setFormState] = useState<FormValidationState>(() => {
    const initialFields: Record<string, FieldValidationState> = {};
    
    Object.entries(initialValues).forEach(([field, value]) => {
      initialFields[field] = {
        value,
        isValidating: false,
        isValidated: false,
        isDirty: false,
        isTouched: false,
      };
    });

    return {
      fields: initialFields,
      isValidating: false,
      isValid: true,
      isDirty: false,
      submitCount: 0,
      errors: [],
      warnings: [],
    };
  });

  const validationAbortControllers = useRef<Map<string, AbortController>>(new Map());

  // Update form-level state based on field states
  const updateFormState = useCallback((fields: Record<string, FieldValidationState>) => {
    const isValidating = Object.values(fields).some(field => field.isValidating);
    const isDirty = Object.values(fields).some(field => field.isDirty);
    const errors = Object.entries(fields)
      .filter(([_, field]) => field.error)
      .map(([key, field]) => ({
        key,
        severity: 'error' as ErrorSeverity,
        message: field.error!,
      }));
    const warnings = Object.entries(fields)
      .filter(([_, field]) => field.warnings && field.warnings.length > 0)
      .flatMap(([key, field]) => 
        field.warnings!.map(warning => ({
          key,
          severity: 'warning' as ErrorSeverity,
          message: warning,
        }))
      );
    const isValid = errors.length === 0;

    setFormState(prev => ({
      ...prev,
      fields,
      isValidating,
      isDirty,
      isValid,
      errors,
      warnings,
    }));
  }, []);

  // Field value setter
  const setFieldValue = useCallback((field: string, value: any) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      const currentField = newFields[field] || {
        value: undefined,
        isValidating: false,
        isValidated: false,
        isDirty: false,
        isTouched: false,
      };

      newFields[field] = {
        ...currentField,
        value,
        isDirty: true,
      };

      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });

    // Validate on change if enabled
    if (validateOnChange && onValidate) {
      validateField(field);
    }
  }, [onValidate, validateOnChange]);

  // Field error setter
  const setFieldError = useCallback((field: string, error?: string) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      if (newFields[field]) {
        newFields[field] = {
          ...newFields[field],
          error,
          isValidated: true,
          validatedAt: Date.now(),
        };
      }
      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });
  }, [updateFormState]);

  // Field warnings setter
  const setFieldWarnings = useCallback((field: string, warnings?: string[]) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      if (newFields[field]) {
        newFields[field] = {
          ...newFields[field],
          warnings,
        };
      }
      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });
  }, [updateFormState]);

  // Field validating setter
  const setFieldValidating = useCallback((field: string, isValidating: boolean) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      if (newFields[field]) {
        newFields[field] = {
          ...newFields[field],
          isValidating,
        };
      }
      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });
  }, [updateFormState]);

  // Field touched setter
  const setFieldTouched = useCallback((field: string, isTouched: boolean) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      if (newFields[field]) {
        newFields[field] = {
          ...newFields[field],
          isTouched,
        };
      }
      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });

    // Validate on blur if enabled
    if (validateOnBlur && isTouched && onValidate) {
      validateField(field);
    }
  }, [onValidate, validateOnBlur]);

  // Field dirty setter
  const setFieldDirty = useCallback((field: string, isDirty: boolean) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      if (newFields[field]) {
        newFields[field] = {
          ...newFields[field],
          isDirty,
        };
      }
      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });
  }, [updateFormState]);

  // Bulk field values setter
  const setFieldsValues = useCallback((values: Record<string, any>) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      Object.entries(values).forEach(([field, value]) => {
        newFields[field] = {
          ...newFields[field],
          value,
          isDirty: true,
        };
      });
      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });
  }, [updateFormState]);

  // Bulk field errors setter
  const setFieldsErrors = useCallback((errors: Record<string, string | undefined>) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      Object.entries(errors).forEach(([field, error]) => {
        if (newFields[field]) {
          newFields[field] = {
            ...newFields[field],
            error,
            isValidated: true,
            validatedAt: Date.now(),
          };
        }
      });
      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });
  }, [updateFormState]);

  // Validate single field
  const validateField = useCallback(async (field: string): Promise<boolean> => {
    if (!onValidate) return true;

    const fieldState = formState.fields[field];
    if (!fieldState) return true;

    // Cancel any ongoing validation for this field
    const existingController = validationAbortControllers.current.get(field);
    if (existingController) {
      existingController.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    validationAbortControllers.current.set(field, abortController);

    setFieldValidating(field, true);

    try {
      const error = await onValidate(field, fieldState.value);
      
      // Check if validation was aborted
      if (abortController.signal.aborted) {
        return false;
      }

      setFieldError(field, error);
      return !error;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }
      setFieldError(field, 'Validation error');
      return false;
    } finally {
      setFieldValidating(field, false);
      validationAbortControllers.current.delete(field);
    }
  }, [formState.fields, onValidate, setFieldError, setFieldValidating]);

  // Validate multiple fields
  const validateFields = useCallback(async (fields?: string[]): Promise<boolean> => {
    const fieldsToValidate = fields || Object.keys(formState.fields);
    const results = await Promise.all(
      fieldsToValidate.map(field => validateField(field))
    );
    return results.every(result => result);
  }, [formState.fields, validateField]);

  // Reset field
  const resetField = useCallback((field: string) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      const initialValue = initialValues[field];
      
      newFields[field] = {
        value: initialValue,
        isValidating: false,
        isValidated: false,
        isDirty: false,
        isTouched: false,
      };

      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });
  }, [initialValues, updateFormState]);

  // Reset form
  const resetForm = useCallback(() => {
    // Cancel all ongoing validations
    validationAbortControllers.current.forEach(controller => controller.abort());
    validationAbortControllers.current.clear();

    setFormState({
      fields: Object.entries(initialValues).reduce((acc, [field, value]) => {
        acc[field] = {
          value,
          isValidating: false,
          isValidated: false,
          isDirty: false,
          isTouched: false,
        };
        return acc;
      }, {} as Record<string, FieldValidationState>),
      isValidating: false,
      isValid: true,
      isDirty: false,
      submitCount: 0,
      errors: [],
      warnings: [],
    });
  }, [initialValues]);

  // Clear field error
  const clearFieldError = useCallback((field: string) => {
    setFieldError(field, undefined);
  }, [setFieldError]);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      Object.keys(newFields).forEach(field => {
        newFields[field] = {
          ...newFields[field],
          error: undefined,
        };
      });
      updateFormState(newFields);
      return { ...prev, fields: newFields };
    });
  }, [updateFormState]);

  // Increment submit count
  const incrementSubmitCount = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      submitCount: prev.submitCount + 1,
      lastSubmitAt: Date.now(),
    }));

    // Validate on submit if enabled
    if (validateOnSubmit) {
      validateFields();
    }
  }, [validateOnSubmit, validateFields]);

  // Get field state
  const getFieldState = useCallback((field: string): FieldValidationState | undefined => {
    return formState.fields[field];
  }, [formState.fields]);

  // Utility functions
  const isFieldValid = useCallback((field: string): boolean => {
    const fieldState = formState.fields[field];
    return !fieldState?.error && fieldState?.isValidated;
  }, [formState.fields]);

  const isFieldDirty = useCallback((field: string): boolean => {
    return formState.fields[field]?.isDirty || false;
  }, [formState.fields]);

  const isFieldTouched = useCallback((field: string): boolean => {
    return formState.fields[field]?.isTouched || false;
  }, [formState.fields]);

  const getFieldError = useCallback((field: string): string | undefined => {
    return formState.fields[field]?.error;
  }, [formState.fields]);

  const getAllErrors = useCallback((): Record<string, string> => {
    return Object.entries(formState.fields).reduce((acc, [field, state]) => {
      if (state.error) {
        acc[field] = state.error;
      }
      return acc;
    }, {} as Record<string, string>);
  }, [formState.fields]);

  const hasErrors = useCallback((): boolean => {
    return Object.values(formState.fields).some(field => field.error);
  }, [formState.fields]);

  const value: ValidationContextValue = {
    formState,
    setFieldValue,
    setFieldError,
    setFieldWarnings,
    setFieldValidating,
    setFieldTouched,
    setFieldDirty,
    setFieldsValues,
    setFieldsErrors,
    resetField,
    resetForm,
    validateField,
    validateFields,
    clearFieldError,
    clearAllErrors,
    incrementSubmitCount,
    getFieldState,
    isFieldValid,
    isFieldDirty,
    isFieldTouched,
    getFieldError,
    getAllErrors,
    hasErrors,
  };

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidationContext() {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useValidationContext must be used within a ValidationProvider');
  }
  return context;
}

// Hook for field-level validation state
export function useFieldValidationState(fieldName: string) {
  const context = useValidationContext();
  
  return {
    value: context.getFieldState(fieldName)?.value,
    error: context.getFieldError(fieldName),
    isValidating: context.getFieldState(fieldName)?.isValidating || false,
    isValid: context.isFieldValid(fieldName),
    isDirty: context.isFieldDirty(fieldName),
    isTouched: context.isFieldTouched(fieldName),
    setValue: (value: any) => context.setFieldValue(fieldName, value),
    setError: (error?: string) => context.setFieldError(fieldName, error),
    setTouched: (touched: boolean) => context.setFieldTouched(fieldName, touched),
    validate: () => context.validateField(fieldName),
    reset: () => context.resetField(fieldName),
  };
}