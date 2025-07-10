# Form Submission Feedback Components

This directory contains comprehensive form submission feedback components for the Jidelnicek application. These components provide various UI patterns for handling form submissions, loading states, progress tracking, and user feedback.

## Components Overview

### 1. SubmitButton
Enhanced submit button with built-in loading states, success/error indicators, and accessibility features.

```tsx
import { SubmitButton } from '@/components/forms'

// Basic usage
<SubmitButton>
  Submit Form
</SubmitButton>

// With loading and success states
<SubmitButton
  loadingText="Saving..."
  successText="Saved!"
  errorText="Failed"
  autoResetDelay={3000}
  showProgress
  progress={uploadProgress}
>
  Save Changes
</SubmitButton>

// Multi-step form
<SubmitButton
  stepInfo={{ current: 2, total: 4 }}
  isLoading={isSubmitting}
>
  Next Step
</SubmitButton>
```

### 2. FormProgress
Progress indicators for forms including linear bars, circular progress, and step indicators.

```tsx
import { LinearProgress, CircularProgress, StepIndicator, ProgressWithETA } from '@/components/forms'

// Linear progress
<LinearProgress 
  value={75} 
  showLabel 
  color="primary"
  striped
  animated
/>

// Circular progress
<CircularProgress 
  value={60} 
  size="lg"
  showLabel
/>

// Multi-step indicator
<StepIndicator
  steps={4}
  currentStep={2}
  labels={['Personal', 'Contact', 'Preferences', 'Review']}
  clickable
  onStepClick={handleStepChange}
/>

// Progress with ETA
<ProgressWithETA
  progress={45}
  startTime={uploadStartTime}
  showETA
  showElapsed
/>
```

### 3. SubmissionFeedback
Post-submission feedback messages with different types and actions.

```tsx
import { SubmissionFeedback, RetryFeedback, NextSteps } from '@/components/forms'

// Success feedback
<SubmissionFeedback
  type="success"
  message="Form submitted successfully!"
  description="Your data has been saved."
  autoDismiss={5000}
  onDismiss={handleDismiss}
/>

// Error with retry
<RetryFeedback
  type="error"
  message="Submission failed"
  description="Network error occurred"
  onRetry={handleRetry}
  retryCount={1}
  maxRetries={3}
/>

// Next steps guide
<NextSteps
  title="What's next?"
  steps={[
    { 
      label: 'Verify your email', 
      completed: true 
    },
    { 
      label: 'Complete profile', 
      action: () => navigate('/profile') 
    }
  ]}
  variant="cards"
/>
```

### 4. FormSkeleton
Loading skeletons for forms to show while data is loading.

```tsx
import { FormSkeleton, FieldSkeleton, FormLoadingOverlay } from '@/components/forms'

// Full form skeleton
<FormSkeleton
  fields={4}
  fieldConfigs={[
    { type: 'text', label: true, helpText: true },
    { type: 'textarea', label: true },
    { type: 'select', label: true, width: 'half' },
    { type: 'checkbox' }
  ]}
  showTitle
  showSubmitButton
/>

// Single field skeleton
<FieldSkeleton 
  type="text" 
  showLabel 
  showHelpText 
/>

// Loading overlay
<FormLoadingOverlay
  show={isLoading}
  message="Saving changes..."
  blur
/>
```

### 5. OptimisticUpdate
Components for optimistic UI updates with automatic rollback on error.

```tsx
import { OptimisticUpdate, OptimisticList } from '@/components/forms'

// Optimistic field update
<OptimisticUpdate
  initialData={userData}
  onUpdate={updateUser}
  showSyncIndicator
>
  {(state, actions) => (
    <input
      value={state.data.name}
      onChange={(e) => actions.update({ name: e.target.value })}
      onBlur={() => actions.update(state.data)}
    />
  )}
</OptimisticUpdate>

// Optimistic list operations
<OptimisticList
  items={todos}
  keyExtractor={item => item.id}
  onAdd={addTodo}
  onUpdate={updateTodo}
  onDelete={deleteTodo}
>
  {(items, actions, state) => (
    <TodoList 
      items={items}
      onAdd={actions.add}
      onToggle={(id) => actions.update(id, { completed: true })}
      pendingDeletes={state.pendingDeletes}
    />
  )}
</OptimisticList>
```

## Context & State Management

### FormStateProvider
Global form state management for tracking multiple form submissions.

```tsx
import { FormStateProvider, useFormSubmissionState } from '@/contexts/FormStateContext'

// Wrap your app
<FormStateProvider persist>
  <App />
</FormStateProvider>

// Use in components
function MyForm() {
  const { state, setSubmitting, setSuccess, setError, updateProgress } = useFormSubmissionState('my-form')
  
  const handleSubmit = async (data) => {
    setSubmitting()
    
    try {
      // Update progress
      for (let i = 0; i <= 100; i += 10) {
        updateProgress(i)
        await delay(100)
      }
      
      setSuccess(response)
    } catch (error) {
      setError(error)
    }
  }
}
```

## Utility Hooks

### Form Submission Utilities
Helper hooks for common submission patterns.

```tsx
import {
  useDebouncedSubmit,
  useThrottledSubmit,
  useSequentialSubmit,
  useBatchSubmit,
  useRetrySubmit,
  useProgressTracking,
  useAutoSave,
  usePriorityQueue
} from '@/hooks'

// Debounced submission
const { debouncedSubmit, isPending } = useDebouncedSubmit(saveData, 500)

// Auto-save
const { save, isSaving, lastSaved } = useAutoSave(saveFormData, {
  debounceDelay: 1000,
  enabled: true,
  onSuccess: () => console.log('Auto-saved!')
})

// Retry with backoff
const { submit, retryCount, isRetrying } = useRetrySubmit(apiCall, {
  maxRetries: 3,
  initialDelay: 1000,
  backoffFactor: 2
})

// Progress tracking
const { progress, steps, updateProgress, completeStep } = useProgressTracking()
```

## Integration with Existing Form Hooks

These components work seamlessly with the existing form validation hooks:

```tsx
import { useZodForm, useFormSubmit } from '@/hooks'
import { SubmitButton, SubmissionFeedback } from '@/components/forms'

function MyForm() {
  const submission = useFormSubmit({
    onSubmit: async (data) => {
      return await api.createResource(data)
    },
    onSuccess: (response) => {
      console.log('Created:', response)
    },
    showSuccessToast: true
  })

  const form = useZodForm({
    schema: mySchema,
    onSubmit: submission.handleSubmit
  })

  return (
    <form onSubmit={form.handleSubmit}>
      {/* Form fields */}
      
      <SubmitButton
        isLoading={submission.isLoading}
        isSuccess={submission.isSuccess}
        isError={submission.isError}
        disabled={!form.formState.isValid}
      >
        Create Resource
      </SubmitButton>
      
      {submission.isSuccess && (
        <SubmissionFeedback
          type="success"
          message="Resource created!"
          actions={[
            { label: 'View', onClick: () => navigate(`/resources/${submission.response.id}`) },
            { label: 'Create Another', onClick: form.reset }
          ]}
        />
      )}
    </form>
  )
}
```

## Accessibility

All components are built with accessibility in mind:

- Proper ARIA labels and live regions
- Keyboard navigation support
- Screen reader announcements for state changes
- Focus management
- High contrast mode support

## Internationalization

Components use the i18n system for all text content:

```tsx
// Components automatically use translations
<SubmitButton /> // Shows "Submitting..." in current language

// Custom messages can use translations
<SubmissionFeedback
  message={t('recipes.created')}
  description={t('recipes.createdDescription')}
/>
```

## Styling

Components use Tailwind CSS classes and support dark mode:

- Consistent with the application's design system
- Responsive layouts
- Dark mode variants
- Customizable through className props

## Best Practices

1. **Always provide feedback**: Use appropriate feedback components for all form submissions
2. **Show progress**: For long operations, use progress indicators
3. **Handle errors gracefully**: Always provide retry options for failed submissions
4. **Optimize for performance**: Use optimistic updates for better perceived performance
5. **Accessibility first**: Ensure all interactions are keyboard accessible
6. **Consistent patterns**: Use the same feedback patterns throughout the application

## Examples

See `FormSubmissionExamples.tsx` for comprehensive examples of all patterns.