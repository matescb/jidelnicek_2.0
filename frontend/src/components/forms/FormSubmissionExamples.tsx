/**
 * Examples demonstrating different form submission feedback patterns
 */

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { 
  SubmitButton, 
  useSubmitButton 
} from './SubmitButton'
import { 
  LinearProgress, 
  CircularProgress, 
  StepIndicator,
  ProgressWithETA 
} from './FormProgress'
import { 
  SubmissionFeedback, 
  NextSteps, 
  RetryFeedback 
} from './SubmissionFeedback'
import { 
  FormSkeleton, 
  FieldSkeleton,
  FormLoadingOverlay 
} from './FormSkeleton'
import { 
  OptimisticUpdate, 
  OptimisticList,
  useOptimisticUpdate 
} from './OptimisticUpdate'
import { useFormSubmissionState } from '@/contexts/FormStateContext'
import { 
  useDebouncedSubmit,
  useSequentialSubmit,
  useAutoSave,
  useProgressTracking
} from '@/utils/formSubmissionUtils'
import { FormField } from './FormField'
import { FormInput } from './FormInput'

/**
 * Basic submit button example
 */
export function BasicSubmitExample() {
  const { t } = useTranslation()
  const [result, setResult] = useState<string>('')

  const handleSubmit = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    setResult('Form submitted successfully!')
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t('examples.basicSubmit')}</h3>
      
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
        <SubmitButton
          loadingText="Submitting..."
          successText="Submitted!"
          errorText="Failed"
          autoResetDelay={3000}
        >
          Submit Form
        </SubmitButton>
      </form>

      {result && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{result}</p>
      )}
    </div>
  )
}

/**
 * Multi-step form with progress
 */
export function MultiStepFormExample() {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4
  const { state: buttonState, setLoading, setSuccess, setError, reset } = useSubmitButton()

  const stepLabels = [
    'Personal Info',
    'Contact Details',
    'Preferences',
    'Review'
  ]

  const handleNext = async () => {
    setLoading()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1)
      reset()
    } else {
      setSuccess()
    }
  }

  const handleStepClick = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step)
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">{t('examples.multiStepForm')}</h3>
      
      <StepIndicator
        steps={totalSteps}
        currentStep={currentStep}
        labels={stepLabels}
        clickable
        onStepClick={handleStepClick}
      />

      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400">
          Step {currentStep} content goes here...
        </p>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50"
        >
          Previous
        </button>

        <SubmitButton
          onClick={handleNext}
          isLoading={buttonState.isLoading}
          isSuccess={buttonState.isSuccess}
          stepInfo={{ current: currentStep, total: totalSteps }}
        >
          {currentStep === totalSteps ? 'Submit' : 'Next'}
        </SubmitButton>
      </div>
    </div>
  )
}

/**
 * Form with submission feedback
 */
export function SubmissionFeedbackExample() {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning'
    message: string
    description?: string
  } | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const simulateSubmission = async (shouldFail: boolean) => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    if (shouldFail) {
      throw new Error('Submission failed')
    }
  }

  const handleSubmit = async (shouldFail = false) => {
    try {
      await simulateSubmission(shouldFail)
      setFeedback({
        type: 'success',
        message: 'Form submitted successfully!',
        description: 'Your data has been saved and processed.',
      })
      setRetryCount(0)
    } catch (error) {
      setFeedback({
        type: 'error',
        message: 'Submission failed',
        description: 'There was an error processing your request. Please try again.',
      })
    }
  }

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1)
    setFeedback(null)
    await handleSubmit(retryCount < 2) // Fail first 2 retries
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t('examples.submissionFeedback')}</h3>

      <div className="space-x-2">
        <button
          onClick={() => handleSubmit(false)}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Submit (Success)
        </button>
        <button
          onClick={() => handleSubmit(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Submit (Error)
        </button>
      </div>

      {feedback && (
        <>
          {feedback.type === 'error' ? (
            <RetryFeedback
              type={feedback.type}
              message={feedback.message}
              description={feedback.description}
              onRetry={handleRetry}
              retryCount={retryCount}
              maxRetries={3}
              autoDismiss={5000}
              onDismiss={() => setFeedback(null)}
            />
          ) : (
            <SubmissionFeedback
              type={feedback.type}
              message={feedback.message}
              description={feedback.description}
              autoDismiss={5000}
              onDismiss={() => setFeedback(null)}
            />
          )}
        </>
      )}

      {feedback?.type === 'success' && (
        <NextSteps
          title="What's next?"
          steps={[
            {
              label: 'Check your email',
              description: 'We sent a confirmation to your email address',
              completed: true,
            },
            {
              label: 'Complete your profile',
              description: 'Add more details to personalize your experience',
              action: () => console.log('Navigate to profile'),
            },
            {
              label: 'Explore features',
              description: 'Discover what you can do with your new account',
              action: () => console.log('Navigate to features'),
            },
          ]}
          variant="cards"
        />
      )}
    </div>
  )
}

/**
 * Form with progress tracking
 */
export function ProgressTrackingExample() {
  const { t } = useTranslation()
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [startTime, setStartTime] = useState<number>(0)
  const { 
    steps, 
    addStep, 
    completeStep, 
    completedSteps,
    totalSteps,
    reset: resetSteps 
  } = useProgressTracking()

  const simulateUpload = async () => {
    setIsUploading(true)
    setStartTime(Date.now())
    setProgress(0)
    resetSteps()

    // Add steps
    addStep('Validating file')
    addStep('Uploading to server')
    addStep('Processing file')
    addStep('Generating preview')

    // Simulate progress
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setProgress(i)

      // Complete steps at certain progress points
      if (i === 25) completeStep(0)
      if (i === 50) completeStep(1)
      if (i === 75) completeStep(2)
      if (i === 100) completeStep(3)
    }

    setIsUploading(false)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">{t('examples.progressTracking')}</h3>

      <button
        onClick={simulateUpload}
        disabled={isUploading}
        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
      >
        {isUploading ? 'Uploading...' : 'Start Upload'}
      </button>

      {isUploading && (
        <>
          <ProgressWithETA
            progress={progress}
            startTime={startTime}
            showETA
            showElapsed
          />

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Processing steps ({completedSteps}/{totalSteps})
            </p>
            {steps.map((step, index) => (
              <div key={index} className="flex items-center space-x-2">
                <CircularProgress
                  value={step.completed ? 100 : 0}
                  size="sm"
                  showLabel={false}
                />
                <span className={clsx(
                  'text-sm',
                  step.completed 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400'
                )}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Optimistic update example
 */
export function OptimisticUpdateExample() {
  const { t } = useTranslation()
  const [user] = useState({ name: 'John Doe', email: 'john@example.com' })

  const updateUser = async (data: typeof user) => {
    // Simulate API call with 50% failure rate
    await new Promise(resolve => setTimeout(resolve, 2000))
    if (Math.random() > 0.5) {
      throw new Error('Update failed')
    }
    return data
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t('examples.optimisticUpdate')}</h3>

      <OptimisticUpdate
        initialData={user}
        onUpdate={updateUser}
        showSyncIndicator
      >
        {(state, actions) => (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="font-medium">{state.data.name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{state.data.email}</p>
            </div>

            <input
              type="text"
              defaultValue={state.data.name}
              onBlur={(e) => actions.update({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
              placeholder="Edit name..."
            />

            {state.hasError && (
              <SubmissionFeedback
                type="error"
                message="Update failed"
                description="Your changes couldn't be saved. They'll be retried automatically."
                compact
                actions={[
                  {
                    label: 'Retry now',
                    onClick: actions.retry,
                    variant: 'primary',
                  },
                ]}
              />
            )}
          </div>
        )}
      </OptimisticUpdate>
    </div>
  )
}

/**
 * Form skeleton example
 */
export function FormSkeletonExample() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t('examples.formSkeleton')}</h3>

      <button
        onClick={() => setIsLoading(!isLoading)}
        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Toggle Loading
      </button>

      <div className="relative">
        {isLoading ? (
          <FormSkeleton
            fields={4}
            fieldConfigs={[
              { type: 'text', label: true, helpText: true },
              { type: 'textarea', label: true },
              { type: 'select', label: true, width: 'half' },
              { type: 'checkbox', label: false },
            ]}
            showTitle
            showDescription
            showSubmitButton
          />
        ) : (
          <form className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">User Profile</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Update your personal information
              </p>
            </div>

            <div className="space-y-4">
              <FormField label="Name" required>
                <FormInput placeholder="Enter your name" />
              </FormField>

              <FormField label="Bio">
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  rows={4}
                  placeholder="Tell us about yourself"
                />
              </FormField>

              <FormField label="Country">
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md">
                  <option>Select country</option>
                  <option>United States</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                </select>
              </FormField>

              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>Subscribe to newsletter</span>
              </label>
            </div>

            <div className="flex justify-end">
              <SubmitButton>Save Changes</SubmitButton>
            </div>
          </form>
        )}

        <FormLoadingOverlay
          show={false}
          message="Saving changes..."
          showSpinner
          blur
        />
      </div>
    </div>
  )
}

/**
 * All examples combined
 */
export function FormSubmissionExamples() {
  const { t } = useTranslation()

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('examples.formSubmissionPatterns')}</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Examples demonstrating various form submission feedback patterns
        </p>
      </div>

      <div className="grid gap-8">
        <BasicSubmitExample />
        <MultiStepFormExample />
        <SubmissionFeedbackExample />
        <ProgressTrackingExample />
        <OptimisticUpdateExample />
        <FormSkeletonExample />
      </div>
    </div>
  )
}