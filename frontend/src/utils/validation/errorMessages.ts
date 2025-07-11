/**
 * Error message system with internationalization support
 * 
 * This module provides a sophisticated error message handling system
 * with support for multiple languages, dynamic interpolation, and
 * error severity levels.
 */

import { useI18n } from '@/hooks/useI18n';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorMessage {
  key: string;
  severity: ErrorSeverity;
  message: string;
  params?: Record<string, any>;
}

export interface ErrorMessageTemplate {
  key: string;
  defaultMessage: string;
  severity?: ErrorSeverity;
  interpolate?: (params: Record<string, any>) => string;
}

// Default error message templates
const ERROR_TEMPLATES: Record<string, ErrorMessageTemplate> = {
  // Basic validation errors
  required: {
    key: 'validation.required',
    defaultMessage: 'This field is required',
    severity: 'error',
  },
  minLength: {
    key: 'validation.minLength',
    defaultMessage: 'Must be at least {min} characters',
    severity: 'error',
    interpolate: (params) => `Must be at least ${params.min} characters`,
  },
  maxLength: {
    key: 'validation.maxLength',
    defaultMessage: 'Must be no more than {max} characters',
    severity: 'error',
    interpolate: (params) => `Must be no more than ${params.max} characters`,
  },
  lengthBetween: {
    key: 'validation.lengthBetween',
    defaultMessage: 'Must be between {min} and {max} characters',
    severity: 'error',
    interpolate: (params) => `Must be between ${params.min} and ${params.max} characters`,
  },
  
  // Format errors
  email: {
    key: 'validation.email',
    defaultMessage: 'Please enter a valid email address',
    severity: 'error',
  },
  phone: {
    key: 'validation.phone',
    defaultMessage: 'Please enter a valid phone number',
    severity: 'error',
  },
  url: {
    key: 'validation.url',
    defaultMessage: 'Please enter a valid URL',
    severity: 'error',
  },
  date: {
    key: 'validation.date',
    defaultMessage: 'Please enter a valid date',
    severity: 'error',
  },
  
  // Numeric errors
  min: {
    key: 'validation.min',
    defaultMessage: 'Must be at least {min}',
    severity: 'error',
    interpolate: (params) => `Must be at least ${params.min}`,
  },
  max: {
    key: 'validation.max',
    defaultMessage: 'Must be no more than {max}',
    severity: 'error',
    interpolate: (params) => `Must be no more than ${params.max}`,
  },
  between: {
    key: 'validation.between',
    defaultMessage: 'Must be between {min} and {max}',
    severity: 'error',
    interpolate: (params) => `Must be between ${params.min} and ${params.max}`,
  },
  
  // Date errors
  futureDate: {
    key: 'validation.futureDate',
    defaultMessage: 'Date must be in the future',
    severity: 'error',
  },
  pastDate: {
    key: 'validation.pastDate',
    defaultMessage: 'Date must be in the past',
    severity: 'error',
  },
  dateBetween: {
    key: 'validation.dateBetween',
    defaultMessage: 'Date must be between {start} and {end}',
    severity: 'error',
    interpolate: (params) => `Date must be between ${params.start} and ${params.end}`,
  },
  
  // Match errors
  matches: {
    key: 'validation.matches',
    defaultMessage: 'Must match {field}',
    severity: 'error',
    interpolate: (params) => `Must match ${params.field}`,
  },
  passwordMatch: {
    key: 'validation.passwordMatch',
    defaultMessage: 'Passwords do not match',
    severity: 'error',
  },
  
  // Type errors
  array: {
    key: 'validation.array',
    defaultMessage: 'Must be an array',
    severity: 'error',
  },
  object: {
    key: 'validation.object',
    defaultMessage: 'Must be an object',
    severity: 'error',
  },
  
  // Async validation
  checking: {
    key: 'validation.checking',
    defaultMessage: 'Checking...',
    severity: 'info',
  },
  available: {
    key: 'validation.available',
    defaultMessage: '{field} is available',
    severity: 'info',
    interpolate: (params) => `${params.field} is available`,
  },
  unavailable: {
    key: 'validation.unavailable',
    defaultMessage: '{field} is already taken',
    severity: 'error',
    interpolate: (params) => `${params.field} is already taken`,
  },
  
  // Network errors
  networkError: {
    key: 'validation.networkError',
    defaultMessage: 'Network error. Please try again.',
    severity: 'error',
  },
  serverError: {
    key: 'validation.serverError',
    defaultMessage: 'Server error. Please try again later.',
    severity: 'error',
  },
  
  // Warnings
  weakPassword: {
    key: 'validation.weakPassword',
    defaultMessage: 'Your password is weak. Consider using a stronger password.',
    severity: 'warning',
  },
  unsavedChanges: {
    key: 'validation.unsavedChanges',
    defaultMessage: 'You have unsaved changes',
    severity: 'warning',
  },
};

/**
 * Error message manager class
 */
export class ErrorMessageManager {
  private templates = new Map<string, ErrorMessageTemplate>();
  private customMessages = new Map<string, string>();

  constructor() {
    // Load default templates
    Object.entries(ERROR_TEMPLATES).forEach(([key, template]) => {
      this.templates.set(key, template);
    });
  }

  /**
   * Register a custom error template
   */
  registerTemplate(key: string, template: ErrorMessageTemplate): void {
    this.templates.set(key, template);
  }

  /**
   * Register multiple templates
   */
  registerTemplates(templates: Record<string, ErrorMessageTemplate>): void {
    Object.entries(templates).forEach(([key, template]) => {
      this.registerTemplate(key, template);
    });
  }

  /**
   * Set a custom message override
   */
  setCustomMessage(key: string, message: string): void {
    this.customMessages.set(key, message);
  }

  /**
   * Get error message
   */
  getMessage(
    key: string, 
    params?: Record<string, any>,
    locale?: string
  ): ErrorMessage {
    // Check for custom message override
    if (this.customMessages.has(key)) {
      return {
        key,
        severity: 'error',
        message: this.customMessages.get(key)!,
        params,
      };
    }

    // Get template
    const template = this.templates.get(key);
    if (!template) {
      return {
        key,
        severity: 'error',
        message: key,
        params,
      };
    }

    // Interpolate message
    let message = template.defaultMessage;
    if (params && template.interpolate) {
      message = template.interpolate(params);
    } else if (params) {
      // Default interpolation
      message = message.replace(/{(\w+)}/g, (match, param) => {
        return params[param] !== undefined ? String(params[param]) : match;
      });
    }

    return {
      key: template.key,
      severity: template.severity || 'error',
      message,
      params,
    };
  }

  /**
   * Format multiple error messages
   */
  formatMessages(errors: Array<{ key: string; params?: Record<string, any> }>): ErrorMessage[] {
    return errors.map(error => this.getMessage(error.key, error.params));
  }

  /**
   * Get messages by severity
   */
  filterBySeverity(messages: ErrorMessage[], severity: ErrorSeverity): ErrorMessage[] {
    return messages.filter(msg => msg.severity === severity);
  }

  /**
   * Clear all custom messages
   */
  clearCustomMessages(): void {
    this.customMessages.clear();
  }
}

// Create singleton instance
export const errorMessageManager = new ErrorMessageManager();

/**
 * React hook for using error messages with i18n
 */
export function useErrorMessages() {
  const { t } = useI18n();

  const getMessage = (
    key: string, 
    params?: Record<string, any>,
    defaultMessage?: string
  ): string => {
    // Try to get translated message first
    const translationKey = `validation.${key}`;
    const hasTranslation = t(translationKey) !== translationKey;
    
    if (hasTranslation) {
      return t(translationKey, params);
    }

    // Fall back to error message manager
    const errorMessage = errorMessageManager.getMessage(key, params);
    return errorMessage.message || defaultMessage || key;
  };

  const formatFieldError = (
    fieldName: string,
    errorKey: string,
    params?: Record<string, any>
  ): string => {
    const fieldLabel = t(`fields.${fieldName}`, fieldName);
    return getMessage(errorKey, { field: fieldLabel, ...params });
  };

  const getFieldErrors = (
    errors: Record<string, string | string[]>
  ): Record<string, string[]> => {
    const formatted: Record<string, string[]> = {};
    
    Object.entries(errors).forEach(([field, error]) => {
      if (Array.isArray(error)) {
        formatted[field] = error.map(e => formatFieldError(field, e));
      } else {
        formatted[field] = [formatFieldError(field, error)];
      }
    });

    return formatted;
  };

  return {
    getMessage,
    formatFieldError,
    getFieldErrors,
    manager: errorMessageManager,
  };
}

/**
 * Helper function to create field-specific error messages
 */
export function createFieldErrorMessage(
  field: string,
  validationType: string,
  params?: Record<string, any>
): ErrorMessage {
  return errorMessageManager.getMessage(validationType, {
    field,
    ...params,
  });
}

/**
 * Helper to group errors by severity
 */
export function groupErrorsBySeverity(
  errors: ErrorMessage[]
): Record<ErrorSeverity, ErrorMessage[]> {
  return errors.reduce((acc, error) => {
    const severity = error.severity || 'error';
    if (!acc[severity]) {
      acc[severity] = [];
    }
    acc[severity].push(error);
    return acc;
  }, {} as Record<ErrorSeverity, ErrorMessage[]>);
}