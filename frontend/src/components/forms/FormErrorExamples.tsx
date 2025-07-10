import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFormErrors } from '../../hooks/useFormErrors';
import {
  FormError,
  FormFieldWithError,
  FormErrorSummary,
  ValidationIcon,
  ValidationIconWithLabel,
  FieldValidationIndicator,
  InlineError,
  InlineMessage,
  MultipleInlineErrors,
  ErrorBoundaryForm,
  FormField,
  FormButton,
} from './index';

// Example schema
const exampleSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ExampleFormData = z.infer<typeof exampleSchema>;

/**
 * Example demonstrating all form error components
 */
export const FormErrorExamples: React.FC = () => {
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [showExamples, setShowExamples] = useState({
    formError: true,
    errorSummary: true,
    validationIcons: true,
    inlineErrors: true,
    errorBoundary: true,
  });

  const methods = useForm<ExampleFormData>({
    resolver: zodResolver(exampleSchema),
    mode: 'onChange',
  });

  const formErrors = useFormErrors({
    enableTranslation: true,
    maxErrors: 5,
  });

  // Simulate form submission with errors
  const onSubmit = async (data: ExampleFormData) => {
    console.log('Form submitted:', data);
  };

  const onError = (errors: any) => {
    formErrors.setFromFieldErrors(errors);
  };

  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Form Error Components Examples
      </h1>

      {/* Form Error Component */}
      {showExamples.formError && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            FormError Component
          </h2>
          
          <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <FormError 
              error="This is a single error message" 
              fieldName="example"
            />
            
            <FormError 
              error={["Multiple errors", "Can be displayed", "In a list"]}
              severity="warning"
            />
            
            <FormError 
              error="Info message with custom icon"
              severity="info"
              showIcon={true}
            />
            
            <FormFieldWithError 
              error="This wraps a form field with error"
              fieldName="wrapped-field"
            >
              <input 
                type="text" 
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Form field with error"
              />
            </FormFieldWithError>
          </div>
        </section>
      )}

      {/* Form Error Summary */}
      {showExamples.errorSummary && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            FormErrorSummary Component
          </h2>
          
          <FormErrorSummary
            errors={[
              { field: 'email', message: 'Email is required' },
              { field: 'email', message: 'Email format is invalid' },
              { field: 'password', message: 'Password is too short' },
              { message: 'Server error: Unable to process request' },
            ]}
            title="Please fix the following errors"
            groupByField={true}
            showCount={true}
            onErrorClick={(field) => console.log('Clicked on field:', field)}
          />
        </section>
      )}

      {/* Validation Icons */}
      {showExamples.validationIcons && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            ValidationIcon Component
          </h2>
          
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <ValidationIcon state="idle" />
            <ValidationIcon state="validating" message="Checking availability..." />
            <ValidationIcon state="success" message="Valid input" />
            <ValidationIcon state="error" message="Invalid input" />
            <ValidationIcon state="warning" message="Warning message" />
            <ValidationIcon state="info" message="Information" />
          </div>
          
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <ValidationIconWithLabel state="success" label="Email available" />
            <ValidationIconWithLabel state="error" label="Username taken" />
          </div>
          
          <div className="relative bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <input 
              type="text" 
              className="w-full px-3 py-2 pr-10 border rounded-md"
              placeholder="Field with validation indicator"
            />
            <FieldValidationIndicator
              fieldName="example"
              state={validationState}
              message="Validation message"
            />
          </div>
        </section>
      )}

      {/* Inline Errors */}
      {showExamples.inlineErrors && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            InlineError Component
          </h2>
          
          <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <div>
              <input 
                type="text" 
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Field with error"
              />
              <InlineError message="This field is required" />
            </div>
            
            <div>
              <input 
                type="text" 
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Field with warning"
              />
              <InlineError 
                message="This username is already taken" 
                type="warning"
              />
            </div>
            
            <InlineMessage
              message="This is an informational message with background"
              type="info"
              showBackground={true}
              dismissible={true}
              onDismiss={() => console.log('Dismissed')}
            />
            
            <div>
              <input 
                type="text" 
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Field with multiple errors"
              />
              <MultipleInlineErrors
                errors={[
                  "Password must be at least 8 characters",
                  "Password must contain uppercase letter",
                  "Password must contain a number"
                ]}
                display="list"
              />
            </div>
          </div>
        </section>
      )}

      {/* Error Boundary Example */}
      {showExamples.errorBoundary && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            ErrorBoundaryForm Component
          </h2>
          
          <ErrorBoundaryForm
            formName="Example Form"
            onError={(error, errorInfo) => {
              console.error('Form error:', error, errorInfo);
            }}
          >
            <FormProvider {...methods}>
              <form 
                onSubmit={methods.handleSubmit(onSubmit, onError)}
                className="space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg"
              >
                <FormField
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                />
                
                <FormField
                  name="password"
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                />
                
                <FormField
                  name="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  placeholder="Confirm your password"
                />
                
                <FormButton type="submit">
                  Submit Form
                </FormButton>
              </form>
            </FormProvider>
          </ErrorBoundaryForm>
        </section>
      )}

      {/* Controls to toggle examples */}
      <section className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Toggle Examples
        </h3>
        <div className="space-y-2">
          {Object.entries(showExamples).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setShowExamples(prev => ({
                  ...prev,
                  [key]: e.target.checked
                }))}
                className="rounded"
              />
              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
};