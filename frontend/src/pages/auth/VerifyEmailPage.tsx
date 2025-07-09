import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/api/auth'
import { useAuth } from '@hooks/useAuth'
import toast from 'react-hot-toast'

const VerifyEmailPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, updateUser } = useAuth()
  const [verificationState, setVerificationState] = useState<'verifying' | 'success' | 'error' | 'pending'>('pending')
  const [isResending, setIsResending] = useState(false)
  const token = searchParams.get('token')

  useEffect(() => {
    if (token) {
      verifyEmail(token)
    }
  }, [token])

  const verifyEmail = async (verificationToken: string) => {
    setVerificationState('verifying')
    try {
      await authApi.verifyEmail(verificationToken)
      setVerificationState('success')
      if (user) {
        updateUser({ ...user, emailVerified: true })
      }
      setTimeout(() => {
        navigate('/dashboard')
      }, 3000)
    } catch (error) {
      setVerificationState('error')
    }
  }

  const resendVerification = async () => {
    setIsResending(true)
    try {
      await authApi.resendVerificationEmail()
      toast.success('Verification email sent! Please check your inbox.')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send verification email')
    } finally {
      setIsResending(false)
    }
  }

  // Show loading state while verifying
  if (verificationState === 'verifying') {
    return (
      <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
            <svg
              className="animate-spin h-12 w-12 text-primary-600 dark:text-primary-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Verifying your email...
          </h2>
        </div>
      </div>
    )
  }

  // Show success state
  if (verificationState === 'success') {
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Email Verified Successfully!
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your email has been verified. Redirecting to dashboard...
          </p>
        </div>
      </div>
    )
  }

  // Show error state
  if (verificationState === 'error') {
    return (
      <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Verification Failed
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            The verification link is invalid or has expired. Please request a new verification email.
          </p>
          <button
            onClick={resendVerification}
            disabled={isResending}
            className="btn-primary"
          >
            {isResending ? t('common.loading') : t('auth.resendVerification')}
          </button>
        </div>
      </div>
    )
  }

  // Show pending verification state (no token in URL)
  return (
    <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
      <div className="text-center">
        <svg
          className="mx-auto h-12 w-12 text-yellow-500 mb-4"
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
          {t('auth.verifyEmail')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {user && !user.emailVerified ? (
            <>We've sent a verification email to <strong>{user.email}</strong>. Please check your inbox and click the verification link.</>
          ) : (
            'Please check your email for the verification link.'
          )}
        </p>
        <div className="space-y-4">
          <button
            onClick={resendVerification}
            disabled={isResending}
            className="btn-primary w-full"
          >
            {isResending ? t('common.loading') : t('auth.resendVerification')}
          </button>
          {user && (
            <Link
              to="/dashboard"
              className="block text-sm font-medium text-primary-600 hover:text-primary-500"
            >
              Continue to Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default VerifyEmailPage