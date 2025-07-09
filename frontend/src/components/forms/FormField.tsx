import React from 'react'
import { useFormContext } from 'react-hook-form'
import { FormInput } from './FormInput'
import clsx from 'clsx'

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string
  label?: string
  helperText?: string
  containerClassName?: string
}

export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  helperText,
  containerClassName,
  ...inputProps
}) => {
  const {
    register,
    formState: { errors },
  } = useFormContext()

  const error = errors[name]?.message as string | undefined

  return (
    <div className={clsx('space-y-1', containerClassName)}>
      <FormInput
        {...register(name)}
        label={label}
        error={error}
        helperText={helperText}
        {...inputProps}
      />
    </div>
  )
}