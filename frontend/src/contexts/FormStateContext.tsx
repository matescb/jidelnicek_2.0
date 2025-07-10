/**
 * Form state context for managing submission states across components
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

export interface FormSubmissionState {
  /**
   * Form ID
   */
  id: string
  /**
   * Submission status
   */
  status: 'idle' | 'submitting' | 'success' | 'error'
  /**
   * Progress (0-100)
   */
  progress?: number
  /**
   * Error details
   */
  error?: Error
  /**
   * Success data
   */
  data?: any
  /**
   * Submission timestamp
   */
  timestamp?: number
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>
}

export interface FormStateContextValue {
  /**
   * All form states
   */
  forms: Map<string, FormSubmissionState>
  /**
   * Get form state
   */
  getFormState: (formId: string) => FormSubmissionState | undefined
  /**
   * Set form state
   */
  setFormState: (formId: string, state: Partial<FormSubmissionState>) => void
  /**
   * Update form progress
   */
  updateProgress: (formId: string, progress: number) => void
  /**
   * Set form as submitting
   */
  setSubmitting: (formId: string, metadata?: Record<string, any>) => void
  /**
   * Set form as success
   */
  setSuccess: (formId: string, data?: any) => void
  /**
   * Set form as error
   */
  setError: (formId: string, error: Error) => void
  /**
   * Reset form state
   */
  resetForm: (formId: string) => void
  /**
   * Clear all form states
   */
  clearAll: () => void
  /**
   * Subscribe to form state changes
   */
  subscribe: (formId: string, callback: (state: FormSubmissionState) => void) => () => void
}

const FormStateContext = createContext<FormStateContextValue | undefined>(undefined)

export interface FormStateProviderProps {
  children: React.ReactNode
  /**
   * Persist form states to localStorage
   */
  persist?: boolean
  /**
   * Storage key prefix
   */
  storagePrefix?: string
}

export function FormStateProvider({
  children,
  persist = false,
  storagePrefix = 'form-state',
}: FormStateProviderProps) {
  const [forms, setForms] = useState<Map<string, FormSubmissionState>>(() => {
    if (persist && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${storagePrefix}-forms`)
        if (stored) {
          const parsed = JSON.parse(stored)
          return new Map(Object.entries(parsed))
        }
      } catch (error) {
        console.error('Failed to load form states from storage:', error)
      }
    }
    return new Map()
  })

  const subscribers = useRef<Map<string, Set<(state: FormSubmissionState) => void>>>(new Map())

  // Persist to localStorage
  const persistForms = useCallback(() => {
    if (persist && typeof window !== 'undefined') {
      try {
        const data = Object.fromEntries(forms)
        localStorage.setItem(`${storagePrefix}-forms`, JSON.stringify(data))
      } catch (error) {
        console.error('Failed to persist form states:', error)
      }
    }
  }, [forms, persist, storagePrefix])

  // Notify subscribers
  const notifySubscribers = useCallback((formId: string, state: FormSubmissionState) => {
    const formSubscribers = subscribers.current.get(formId)
    if (formSubscribers) {
      formSubscribers.forEach(callback => callback(state))
    }
  }, [])

  const getFormState = useCallback(
    (formId: string) => forms.get(formId),
    [forms]
  )

  const setFormState = useCallback(
    (formId: string, state: Partial<FormSubmissionState>) => {
      setForms(prev => {
        const next = new Map(prev)
        const currentState = prev.get(formId) || { id: formId, status: 'idle' }
        const newState = { ...currentState, ...state }
        next.set(formId, newState)
        return next
      })

      const newState = { id: formId, status: 'idle' as const, ...forms.get(formId), ...state }
      notifySubscribers(formId, newState)
      persistForms()
    },
    [forms, notifySubscribers, persistForms]
  )

  const updateProgress = useCallback(
    (formId: string, progress: number) => {
      setFormState(formId, { progress: Math.min(100, Math.max(0, progress)) })
    },
    [setFormState]
  )

  const setSubmitting = useCallback(
    (formId: string, metadata?: Record<string, any>) => {
      setFormState(formId, {
        status: 'submitting',
        progress: 0,
        timestamp: Date.now(),
        metadata,
        error: undefined,
        data: undefined,
      })
    },
    [setFormState]
  )

  const setSuccess = useCallback(
    (formId: string, data?: any) => {
      setFormState(formId, {
        status: 'success',
        progress: 100,
        data,
        error: undefined,
      })
    },
    [setFormState]
  )

  const setError = useCallback(
    (formId: string, error: Error) => {
      setFormState(formId, {
        status: 'error',
        error,
        progress: undefined,
      })
    },
    [setFormState]
  )

  const resetForm = useCallback(
    (formId: string) => {
      setForms(prev => {
        const next = new Map(prev)
        next.delete(formId)
        return next
      })
      persistForms()
    },
    [persistForms]
  )

  const clearAll = useCallback(() => {
    setForms(new Map())
    if (persist && typeof window !== 'undefined') {
      localStorage.removeItem(`${storagePrefix}-forms`)
    }
  }, [persist, storagePrefix])

  const subscribe = useCallback(
    (formId: string, callback: (state: FormSubmissionState) => void) => {
      if (!subscribers.current.has(formId)) {
        subscribers.current.set(formId, new Set())
      }
      subscribers.current.get(formId)!.add(callback)

      // Return unsubscribe function
      return () => {
        const formSubscribers = subscribers.current.get(formId)
        if (formSubscribers) {
          formSubscribers.delete(callback)
          if (formSubscribers.size === 0) {
            subscribers.current.delete(formId)
          }
        }
      }
    },
    []
  )

  const value: FormStateContextValue = {
    forms,
    getFormState,
    setFormState,
    updateProgress,
    setSubmitting,
    setSuccess,
    setError,
    resetForm,
    clearAll,
    subscribe,
  }

  return (
    <FormStateContext.Provider value={value}>
      {children}
    </FormStateContext.Provider>
  )
}

export function useFormState() {
  const context = useContext(FormStateContext)
  if (!context) {
    throw new Error('useFormState must be used within a FormStateProvider')
  }
  return context
}

/**
 * Hook to manage a specific form's state
 */
export function useFormSubmissionState(formId: string) {
  const {
    getFormState,
    setSubmitting,
    setSuccess,
    setError,
    updateProgress,
    resetForm,
    subscribe,
  } = useFormState()

  const [state, setState] = useState<FormSubmissionState>(() => 
    getFormState(formId) || { id: formId, status: 'idle' }
  )

  // Subscribe to state changes
  React.useEffect(() => {
    const unsubscribe = subscribe(formId, setState)
    return unsubscribe
  }, [formId, subscribe])

  const actions = {
    setSubmitting: (metadata?: Record<string, any>) => setSubmitting(formId, metadata),
    setSuccess: (data?: any) => setSuccess(formId, data),
    setError: (error: Error) => setError(formId, error),
    updateProgress: (progress: number) => updateProgress(formId, progress),
    reset: () => resetForm(formId),
  }

  return { state, ...actions }
}

/**
 * Hook to track multiple forms
 */
export function useMultiFormState(formIds: string[]) {
  const { forms, subscribe } = useFormState()
  const [states, setStates] = useState<Map<string, FormSubmissionState>>(() => {
    const initial = new Map<string, FormSubmissionState>()
    formIds.forEach(id => {
      initial.set(id, forms.get(id) || { id, status: 'idle' })
    })
    return initial
  })

  React.useEffect(() => {
    const unsubscribes: (() => void)[] = []

    formIds.forEach(formId => {
      const unsubscribe = subscribe(formId, (state) => {
        setStates(prev => {
          const next = new Map(prev)
          next.set(formId, state)
          return next
        })
      })
      unsubscribes.push(unsubscribe)
    })

    return () => {
      unsubscribes.forEach(fn => fn())
    }
  }, [formIds, subscribe])

  const isAnySubmitting = Array.from(states.values()).some(state => state.status === 'submitting')
  const allSuccess = Array.from(states.values()).every(state => state.status === 'success')
  const hasErrors = Array.from(states.values()).some(state => state.status === 'error')

  return {
    states,
    isAnySubmitting,
    allSuccess,
    hasErrors,
  }
}