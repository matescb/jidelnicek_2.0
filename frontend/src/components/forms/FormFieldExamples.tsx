import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TextField,
  TextareaField,
  SelectField,
  CheckboxField,
  CheckboxGroupField,
  RadioField,
  DateField,
  FileField,
  FormGroup,
  FormSection,
  FormCard,
  ConditionalFormGroup,
  SubmitButton,
} from './index';
import { 
  EnvelopeIcon, 
  UserIcon, 
  LockClosedIcon,
  CalendarIcon,
  TagIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

// Example schema
const exampleSchema = z.object({
  // Text fields
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  
  // Textarea
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  notes: z.string().optional(),
  
  // Select
  country: z.string().min(1, 'Please select a country'),
  skills: z.array(z.string()).min(1, 'Select at least one skill'),
  
  // Checkbox
  terms: z.boolean().refine(val => val === true, 'You must accept the terms'),
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
  }),
  
  // Radio
  plan: z.enum(['free', 'pro', 'enterprise']),
  
  // Date
  birthdate: z.date().optional(),
  eventDate: z.date().optional(),
  
  // File
  avatar: z.instanceof(FileList).optional(),
  documents: z.instanceof(FileList).optional(),
  
  // Conditional fields
  hasCompany: z.boolean(),
  companyName: z.string().optional(),
  companySize: z.string().optional(),
});

type ExampleFormData = z.infer<typeof exampleSchema>;

const countryOptions = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'es', label: 'Spain' },
  { value: 'it', label: 'Italy' },
  { value: 'jp', label: 'Japan' },
  { value: 'cn', label: 'China' },
];

const skillOptions = [
  { value: 'react', label: 'React', group: 'Frontend' },
  { value: 'vue', label: 'Vue.js', group: 'Frontend' },
  { value: 'angular', label: 'Angular', group: 'Frontend' },
  { value: 'node', label: 'Node.js', group: 'Backend' },
  { value: 'python', label: 'Python', group: 'Backend' },
  { value: 'java', label: 'Java', group: 'Backend' },
  { value: 'docker', label: 'Docker', group: 'DevOps' },
  { value: 'k8s', label: 'Kubernetes', group: 'DevOps' },
];

const notificationOptions = [
  { value: 'email', label: 'Email notifications', description: 'Receive updates via email' },
  { value: 'sms', label: 'SMS notifications', description: 'Get text messages for important updates' },
  { value: 'push', label: 'Push notifications', description: 'Browser push notifications' },
];

const planOptions = [
  { 
    value: 'free', 
    label: 'Free Plan', 
    description: 'Perfect for individuals',
    icon: TagIcon,
  },
  { 
    value: 'pro', 
    label: 'Pro Plan', 
    description: 'For growing teams',
    icon: DocumentTextIcon,
  },
  { 
    value: 'enterprise', 
    label: 'Enterprise', 
    description: 'Custom solutions for large organizations',
    icon: CalendarIcon,
  },
];

export const FormFieldExamples: React.FC = () => {
  const methods = useForm<ExampleFormData>({
    resolver: zodResolver(exampleSchema),
    defaultValues: {
      notifications: {
        email: true,
        sms: false,
        push: false,
      },
      plan: 'free',
      hasCompany: false,
    },
  });

  const onSubmit = (data: ExampleFormData) => {
    console.log('Form submitted:', data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Form Field Components Demo
        </h2>

        {/* Basic Information Section */}
        <FormSection
          title="Basic Information"
          description="Enter your personal details"
          icon={UserIcon}
          collapsible
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              name="username"
              label="Username"
              placeholder="johndoe"
              leadingIcon={UserIcon}
              required
              showCounter
              maxLength={20}
            />

            <TextField
              name="email"
              label="Email"
              type="email"
              placeholder="john@example.com"
              leadingIcon={EnvelopeIcon}
              required
            />
          </div>

          <TextField
            name="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            leadingIcon={LockClosedIcon}
            required
            helperText="Must be at least 8 characters"
          />
        </FormSection>

        {/* Profile Section */}
        <FormCard
          title="Profile Details"
          description="Tell us more about yourself"
          spacing="lg"
        >
          <TextareaField
            name="bio"
            label="Bio"
            placeholder="Tell us about yourself..."
            showCounter
            showWordCounter
            maxLength={500}
            autoResize
            minRows={3}
            maxRows={6}
            helperText="Write a brief description about yourself"
          />

          <TextareaField
            name="notes"
            label="Notes"
            placeholder="Add any additional notes..."
            showToolbar
            enableMarkdownPreview
            renderMarkdown={(content) => <div>{content}</div>}
          />
        </FormCard>

        {/* Location & Skills */}
        <FormGroup title="Location & Skills" columns={2}>
          <SelectField
            name="country"
            label="Country"
            placeholder="Select your country"
            options={countryOptions}
            searchable
            required
          />

          <SelectField
            name="skills"
            label="Skills"
            placeholder="Select your skills"
            options={skillOptions}
            multiple
            searchable
            helperText="Select all that apply"
          />
        </FormGroup>

        {/* Preferences */}
        <FormSection title="Preferences">
          <RadioField
            name="plan"
            label="Select your plan"
            options={planOptions}
            variant="card"
            layout="horizontal"
          />

          <CheckboxGroupField
            name="notifications"
            label="Notification Preferences"
            options={notificationOptions}
            layout="vertical"
            helperText="Choose how you want to receive updates"
          />

          <CheckboxField
            name="terms"
            label="I agree to the terms and conditions"
            description="By checking this box, you agree to our Terms of Service and Privacy Policy"
            required
          />
        </FormSection>

        {/* Dates */}
        <FormGroup title="Important Dates">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DateField
              name="birthdate"
              label="Date of Birth"
              placeholder="Select your birthdate"
              maxDate={new Date()}
            />

            <DateField
              name="eventDate"
              label="Event Date"
              placeholder="Select event date"
              minDate={new Date()}
              showTimezone
              mode="datetime"
            />
          </div>
        </FormGroup>

        {/* File Uploads */}
        <FormSection title="Documents">
          <FileField
            name="avatar"
            label="Profile Picture"
            accept="image/*"
            maxSize={5 * 1024 * 1024} // 5MB
            showPreview
            helperText="Upload your profile picture (max 5MB)"
          />

          <FileField
            name="documents"
            label="Supporting Documents"
            accept=".pdf,.doc,.docx"
            multiple
            maxFiles={5}
            dragAndDrop
            helperText="Upload up to 5 documents"
          />
        </FormSection>

        {/* Conditional Fields */}
        <FormSection title="Company Information">
          <CheckboxField
            name="hasCompany"
            label="I represent a company"
            variant="switch"
          />

          <ConditionalFormGroup
            watchField="hasCompany"
            showWhen={true}
            spacing="md"
          >
            <TextField
              name="companyName"
              label="Company Name"
              placeholder="Acme Inc."
              required
            />

            <SelectField
              name="companySize"
              label="Company Size"
              placeholder="Select company size"
              options={[
                { value: '1-10', label: '1-10 employees' },
                { value: '11-50', label: '11-50 employees' },
                { value: '51-200', label: '51-200 employees' },
                { value: '201-500', label: '201-500 employees' },
                { value: '500+', label: '500+ employees' },
              ]}
              required
            />
          </ConditionalFormGroup>
        </FormSection>

        {/* Submit Button */}
        <div className="flex justify-end pt-6">
          <SubmitButton
            loadingText="Submitting..."
            className="px-6 py-2"
          >
            Submit Form
          </SubmitButton>
        </div>
      </form>
    </FormProvider>
  );
};