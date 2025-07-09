import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import toast from 'react-hot-toast'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>

const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation()
  const [isSubmitted, setIsSubmitted] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordData) => {
    try {
      await authApi.forgotPassword(data.email)
      setIsSubmitted(true)
      toast.success('Password reset instructions sent to your email')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send reset email')
    }
  }

  if (isSubmitted) {
    return (
      <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Check your email
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            We've sent password reset instructions to your email address. Please check your inbox and follow the link to reset your password.
          </p>
          <Link
            to="/auth/login"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          {t('auth.forgotPassword')}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Enter your email address and we'll send you instructions to reset your password.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('auth.email')}
          </label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            className="input-field"
            placeholder="name@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary"
          >
            {isSubmitting ? t('common.loading') : t('auth.sendResetLink')}
          </button>
        </div>

        <div className="text-center">
          <Link
            to="/auth/login"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </form>
    </div>
  )
}

export default ForgotPasswordPage