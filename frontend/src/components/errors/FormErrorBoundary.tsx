import React, { useState, useRef, useEffect } from 'react';
import { ErrorBoundary, withErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { RefreshCw, Save, AlertTriangle, CheckCircle2, Copy, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ErrorInfo } from 'react';
import { errorLogger, ErrorSeverity } from '@/services/errorLogger';
import { ErrorMessage } from '@/components/ui/error/ErrorMessage';
import { classifyError, ErrorType } from '@/utils/errorHelpers';

interface FormErrorBoundaryProps {
  children: React.ReactNode;
  formId?: string;
  onFormError?: (error: Error, formData?: any) => void;
  preserveFormData?: boolean;
  showValidationInline?: boolean;
}

interface FormData {
  [key: string]: any;
}

interface ValidationError {
  field: string;
  message: string;
  type?: string;
}

const FormErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  reset: () => void;
  formData?: FormData;
  validationErrors?: ValidationError[];
  onRestoreData?: (data: FormData) => void;
}> = ({ error, retry, reset, formData, validationErrors, onRestoreData }) => {
  const { t } = useTranslation();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [savedFormData] = useState(formData);

  const { type } = classifyError(error);
  const isValidationError = type === ErrorType.VALIDATION_ERROR || 
                           type === ErrorType.MISSING_FIELD ||
                           type === ErrorType.INVALID_FORMAT;

  const handleRestoreData = () => {
    if (!savedFormData || !onRestoreData) return;
    
    setIsRestoring(true);
    setTimeout(() => {
      onRestoreData(savedFormData);
      setIsRestoring(false);
      reset();
    }, 500);
  };

  const handleCopyFormData = async () => {
    if (!savedFormData) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(savedFormData, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy form data:', err);
    }
  };

  // For validation errors, show a more compact UI
  if (isValidationError && validationErrors && validationErrors.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 
                   dark:border-red-800 rounded-lg"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
          
          <div className="flex-1">
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              {t('errors.form.validationTitle')}
            </h3>
            
            <ul className="space-y-1">
              {validationErrors.map((error, index) => (
                <motion.li
                  key={`${error.field}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="text-sm text-red-700 dark:text-red-300"
                >
                  <span className="font-medium">{error.field}:</span> {error.message}
                </motion.li>
              ))}
            </ul>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={reset}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // For other form errors, show full error UI
  return (
    <div className="min-h-[300px] flex items-center justify-center p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -5, 5, -5, 0] }}
            transition={{ duration: 0.5 }}
            className="inline-block"
          >
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 
                          flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </motion.div>

          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-gray-100">
            {t('errors.form.title')}
          </h2>

          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t('errors.form.message')}
          </p>
        </div>

        {/* Form data preservation notice */}
        {savedFormData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
          >
            <div className="flex items-center gap-2 mb-2">
              <Save className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {t('errors.form.dataSaved')}
              </p>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('errors.form.dataSavedMessage')}
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {savedFormData && onRestoreData && (
            <Button
              onClick={handleRestoreData}
              disabled={isRestoring}
              className="flex-1"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {t('errors.form.restoring')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('errors.form.restoreData')}
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={retry}
            className="flex-1"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.tryAgain')}
          </Button>

          {savedFormData && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyFormData}
              title={t('errors.form.copyData')}
            >
              {isCopied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Error details */}
        <ErrorMessage
          type="error"
          title={error.name}
          message={error.message}
          details={process.env.NODE_ENV === 'development' ? error.stack : undefined}
          onDismiss={reset}
        />
      </motion.div>
    </div>
  );
};

export class FormErrorBoundary extends ErrorBoundary {
  private formDataRef = useRef<FormData>({});
  private validationErrorsRef = useRef<ValidationError[]>([]);

  constructor(props: FormErrorBoundaryProps) {
    super({
      ...props,
      level: 'component',
      enableRecovery: true,
      resetKeys: [props.formId],
      resetOnPropsChange: true,
      customErrorComponent: ({ error, retry, reset }) => (
        <FormErrorFallback
          error={error}
          retry={retry}
          reset={reset}
          formData={props.preserveFormData ? this.formDataRef.current : undefined}
          validationErrors={this.validationErrorsRef.current}
          onRestoreData={this.handleRestoreData}
        />
      ),
      onError: (error: Error, errorInfo: ErrorInfo) => {
        // Capture form data before error boundary takes over
        if (props.preserveFormData) {
          this.captureFormData();
        }

        // Parse validation errors if available
        this.parseValidationErrors(error);

        // Log form errors
        errorLogger.logError(error, ErrorSeverity.MEDIUM, errorInfo, {
          component: 'FormErrorBoundary',
          metadata: {
            formId: props.formId,
            hasFormData: !!this.formDataRef.current,
            validationErrors: this.validationErrorsRef.current
          }
        });

        if (props.onFormError) {
          props.onFormError(error, this.formDataRef.current);
        }
      }
    });
  }

  private captureFormData = () => {
    const { formId } = this.props as FormErrorBoundaryProps;
    
    if (!formId) return;

    try {
      const form = document.getElementById(formId) as HTMLFormElement;
      if (!form) return;

      const formData = new FormData(form);
      const data: FormData = {};

      formData.forEach((value, key) => {
        if (data[key]) {
          // Handle multiple values (like checkboxes)
          if (Array.isArray(data[key])) {
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      });

      this.formDataRef.current = data;
    } catch (err) {
      console.error('Failed to capture form data:', err);
    }
  };

  private parseValidationErrors = (error: Error) => {
    try {
      // Try to parse validation errors from error message or custom properties
      if ('validationErrors' in error && Array.isArray((error as any).validationErrors)) {
        this.validationErrorsRef.current = (error as any).validationErrors;
      } else if (error.message.includes('validation')) {
        // Try to extract field names from error message
        const fieldMatch = error.message.match(/field[s]?\s*:?\s*([^,.\n]+)/i);
        if (fieldMatch) {
          this.validationErrorsRef.current = [{
            field: fieldMatch[1].trim(),
            message: error.message
          }];
        }
      }
    } catch (err) {
      console.error('Failed to parse validation errors:', err);
    }
  };

  private handleRestoreData = (data: FormData) => {
    const { formId } = this.props as FormErrorBoundaryProps;
    
    if (!formId) return;

    try {
      const form = document.getElementById(formId) as HTMLFormElement;
      if (!form) return;

      // Restore form values
      Object.entries(data).forEach(([key, value]) => {
        const elements = form.elements.namedItem(key);
        
        if (elements instanceof RadioNodeList) {
          // Handle radio buttons and checkboxes
          elements.forEach((element: any) => {
            if (element.type === 'checkbox' || element.type === 'radio') {
              element.checked = Array.isArray(value) 
                ? value.includes(element.value)
                : element.value === value;
            }
          });
        } else if (elements) {
          // Handle regular inputs
          if ((elements as any).type === 'checkbox') {
            (elements as any).checked = !!value;
          } else {
            (elements as any).value = value;
          }
        }
      });

      // Trigger change events to update React state
      form.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      console.error('Failed to restore form data:', err);
    }
  };
}

// HOC for forms with error handling
export function withFormErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<FormErrorBoundaryProps, 'children'>
) {
  return withErrorBoundary(Component, {
    level: 'component',
    ...options,
    customErrorComponent: ({ error, retry, reset }) => (
      <FormErrorFallback
        error={error}
        retry={retry}
        reset={reset}
      />
    )
  });
}

// Hook for form error handling
export function useFormErrorHandler(formId?: string) {
  const [formData, setFormData] = useState<FormData>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const handleError = (error: Error) => {
    // Capture form data
    if (formId) {
      try {
        const form = document.getElementById(formId) as HTMLFormElement;
        if (form) {
          const data = new FormData(form);
          const formDataObj: FormData = {};
          data.forEach((value, key) => {
            formDataObj[key] = value;
          });
          setFormData(formDataObj);
        }
      } catch (err) {
        console.error('Failed to capture form data:', err);
      }
    }

    // Parse validation errors
    if ('validationErrors' in error) {
      setValidationErrors((error as any).validationErrors);
    }

    throw error; // Re-throw to be caught by error boundary
  };

  return {
    handleError,
    formData,
    validationErrors,
    clearErrors: () => setValidationErrors([])
  };
}