import React, { forwardRef } from 'react'
import clsx from 'clsx'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  loading?: boolean
  success?: boolean
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, helperText, loading, success, className, ...props }, ref) => {
    const inputId = props.id || props.name

    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'input-field',
              error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
              success && !error && 'border-green-300 focus:border-green-500 focus:ring-green-500',
              (loading || success) && 'pr-10',
              className
            )}
            {...props}
          />
          {loading && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <LoadingSpinner size="sm" />
            </div>
          )}
          {success && !loading && !error && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    )
  }
)

FormInput.displayName = 'FormInput'