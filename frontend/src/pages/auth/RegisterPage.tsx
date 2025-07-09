import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@hooks/useAuth'
import { RegisterData } from '@/types'
import { FormInput } from '@components/forms/FormInput'
import { FormButton } from '@components/forms/FormButton'
import { PasswordStrengthIndicator } from '@components/forms/PasswordStrengthIndicator'

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

const RegisterPage: React.FC = () => {
  const { t } = useTranslation()
  const { register: registerUser } = useAuth()
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData & { confirmPassword: string }>({
    resolver: zodResolver(registerSchema),
  })

  const password = watch('password')

  const onSubmit = async (data: RegisterData & { confirmPassword: string }) => {
    try {
      const { confirmPassword, ...registerData } = data
      await registerUser(registerData)
    } catch (error) {
      // Error is handled in AuthContext
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            {...register('firstName')}
            label={t('auth.firstName')}
            type="text"
            autoComplete="given-name"
            error={errors.firstName?.message}
          />

          <FormInput
            {...register('lastName')}
            label={t('auth.lastName')}
            type="text"
            autoComplete="family-name"
            error={errors.lastName?.message}
          />
        </div>

        <FormInput
          {...register('email')}
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          error={errors.email?.message}
        />

        <div>
          <FormInput
            {...register('password')}
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            helperText="Password must be at least 12 characters with uppercase, lowercase, number, and special character"
          />
          <PasswordStrengthIndicator password={password || ''} />
        </div>

        <FormInput
          {...register('confirmPassword')}
          label={t('auth.confirmPassword')}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
        />

        <FormButton
          type="submit"
          isLoading={isSubmitting}
          fullWidth
        >
          {t('auth.register')}
        </FormButton>

        <div className="text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              to="/auth/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              {t('auth.login')}
            </Link>
          </span>
        </div>
      </form>
    </div>
  )
}

export default RegisterPage