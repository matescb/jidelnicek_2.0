/**
 * Comprehensive example demonstrating the form validation framework
 */

import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  EnhancedFormField, 
  EmailField, 
  PasswordField,
  PhoneField,
  NumberField,
  SubmitButton,
  ErrorSummary,
  ValidationProgressIndicator,
  FormGroup,
  FormSection
} from '@/components/forms';
import { ValidationProvider } from '@/contexts/ValidationContext';
import { 
  required, 
  minLength, 
  matches,
  createEmailAvailabilityValidator,
  createUsernameAvailabilityValidator,
  compose,
  conditional,
  withMessage
} from '@/utils/validation';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/card';

// Define form schema
const registrationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirmPassword: z.string(),
  age: z.number().min(18, 'Must be at least 18 years old').max(120, 'Invalid age'),
  phone: z.string().optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegistrationForm = z.infer<typeof registrationSchema>;

// Mock API functions
const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return !['admin', 'user', 'test'].includes(username.toLowerCase());
};

const checkEmailAvailability = async (email: string): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return !email.endsWith('@taken.com');
};

export const FormValidationExample: React.FC = () => {
  const { showToast } = useToast();
  const [errors, setErrors] = useState<any[]>([]);
  
  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    mode: 'onChange',
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      age: undefined,
      phone: '',
      bio: '',
      agreeToTerms: false,
    },
  });

  const onSubmit = async (data: RegistrationForm) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showToast({
        type: 'success',
        message: 'Registration successful!',
      });
      
      console.log('Form data:', data);
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Registration failed. Please try again.',
      });
    }
  };

  // Create async validators
  const usernameValidator = createUsernameAvailabilityValidator(checkUsernameAvailability);
  const emailValidator = createEmailAvailabilityValidator(checkEmailAvailability);

  // Custom validators
  const strongPasswordValidator = compose(
    minLength(12),
    withMessage(
      matches('password', 'Password is too similar to username'),
      'Password should not contain your username'
    )
  );

  const phoneValidator = conditional(
    (value) => !!value, // Only validate if provided
    compose(
      minLength(10),
      matches(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    )
  );

  // Calculate validation progress
  const fields = form.watch();
  const totalFields = Object.keys(registrationSchema.shape).length;
  const filledFields = Object.values(fields).filter(value => 
    value !== '' && value !== undefined && value !== false
  ).length;

  return (
    <ValidationProvider>
      <FormProvider {...form}>
        <Card className="max-w-2xl mx-auto p-6">
          <h2 className="text-2xl font-bold mb-6">Registration Form</h2>
          
          <ValidationProgressIndicator
            totalFields={totalFields}
            validatedFields={filledFields}
            validFields={Object.keys(form.formState.errors).length === 0 ? filledFields : 0}
            showDetails
            className="mb-6"
          />

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormSection title="Account Information">
              <FormGroup>
                <EnhancedFormField
                  name="username"
                  label="Username"
                  placeholder="Choose a username"
                  helperText="3-20 characters, letters and numbers only"
                  rules={[
                    { validator: required },
                    { validator: minLength(3) },
                    { validator: usernameValidator, async: true },
                  ]}
                  asyncDebounceMs={500}
                  showValidIcon
                  showLoadingIcon
                />

                <EmailField
                  name="email"
                  label="Email Address"
                  placeholder="your@email.com"
                  helperText="We'll never share your email"
                  rules={[
                    { validator: emailValidator, async: true, message: 'This email is already registered' }
                  ]}
                  asyncDebounceMs={500}
                />
              </FormGroup>

              <FormGroup>
                <PasswordField
                  name="password"
                  label="Password"
                  placeholder="Create a strong password"
                  helperText="At least 8 characters with uppercase, lowercase, and numbers"
                />

                <EnhancedFormField
                  name="confirmPassword"
                  type="password"
                  label="Confirm Password"
                  placeholder="Re-enter your password"
                  rules={[
                    { validator: required },
                    { 
                      validator: matches('password'), 
                      message: 'Passwords do not match' 
                    }
                  ]}
                />
              </FormGroup>
            </FormSection>

            <FormSection title="Personal Information">
              <FormGroup>
                <NumberField
                  name="age"
                  label="Age"
                  placeholder="Your age"
                  min={18}
                  max={120}
                  helperText="You must be at least 18 years old"
                />

                <PhoneField
                  name="phone"
                  label="Phone Number (Optional)"
                  placeholder="+1234567890"
                  helperText="Include country code"
                  rules={[
                    { validator: phoneValidator }
                  ]}
                />
              </FormGroup>

              <EnhancedFormField
                name="bio"
                label="Bio (Optional)"
                placeholder="Tell us about yourself..."
                helperText="Maximum 500 characters"
                rules={[
                  { validator: z.string().max(500) }
                ]}
                component="textarea"
                rows={4}
              />
            </FormSection>

            <FormSection>
              <EnhancedFormField
                name="agreeToTerms"
                type="checkbox"
                label="I agree to the terms and conditions"
                rules={[
                  { 
                    validator: (value) => ({ 
                      isValid: value === true, 
                      error: 'You must agree to continue' 
                    })
                  }
                ]}
              />
            </FormSection>

            {Object.keys(form.formState.errors).length > 0 && (
              <ErrorSummary
                errors={Object.entries(form.formState.errors).map(([field, error]) => ({
                  key: field,
                  severity: 'error',
                  message: error?.message || 'Invalid value',
                }))}
                title="Please fix the following errors:"
                groupBySeverity
                showSeverityIcons
              />
            )}

            <div className="flex gap-4">
              <SubmitButton
                isLoading={form.formState.isSubmitting}
                loadingText="Creating account..."
                successText="Account created!"
                className="flex-1"
              >
                Create Account
              </SubmitButton>
              
              <button
                type="button"
                onClick={() => form.reset()}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </form>
        </Card>
      </FormProvider>
    </ValidationProvider>
  );
};

// Showcase different validation modes
export const ValidationModesExample: React.FC = () => {
  const [mode, setMode] = useState<'onChange' | 'onBlur' | 'onSubmit'>('onChange');

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Validation Modes</h3>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="onChange"
              checked={mode === 'onChange'}
              onChange={(e) => setMode(e.target.value as any)}
              className="mr-2"
            />
            On Change
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="onBlur"
              checked={mode === 'onBlur'}
              onChange={(e) => setMode(e.target.value as any)}
              className="mr-2"
            />
            On Blur
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="onSubmit"
              checked={mode === 'onSubmit'}
              onChange={(e) => setMode(e.target.value as any)}
              className="mr-2"
            />
            On Submit
          </label>
        </div>
      </Card>

      <ValidationProvider validateOnChange={mode === 'onChange'} validateOnBlur={mode === 'onBlur'}>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Try Different Fields</h3>
          <div className="space-y-4">
            <EmailField
              name="demoEmail"
              label="Email Address"
              placeholder="test@example.com"
            />
            
            <PhoneField
              name="demoPhone"
              label="Phone Number"
              placeholder="+1234567890"
            />
            
            <NumberField
              name="demoAge"
              label="Age"
              min={0}
              max={150}
              placeholder="Enter your age"
            />
          </div>
        </Card>
      </ValidationProvider>
    </div>
  );
};