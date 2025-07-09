import React, { useMemo } from 'react'
import clsx from 'clsx'

interface PasswordStrengthIndicatorProps {
  password: string
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const strength = useMemo(() => {
    if (!password) return 0
    
    let score = 0
    
    // Length check
    if (password.length >= 12) score++
    if (password.length >= 16) score++
    
    // Character variety checks
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    
    // Common patterns (negative score)
    if (/^(password|12345|qwerty)/i.test(password)) score = 1
    
    return Math.min(Math.max(score, 0), 5)
  }, [password])

  const strengthText = useMemo(() => {
    switch (strength) {
      case 0:
        return ''
      case 1:
      case 2:
        return 'Weak'
      case 3:
        return 'Fair'
      case 4:
        return 'Good'
      case 5:
        return 'Strong'
      default:
        return ''
    }
  }, [strength])

  const strengthColor = useMemo(() => {
    switch (strength) {
      case 1:
      case 2:
        return 'bg-red-500'
      case 3:
        return 'bg-yellow-500'
      case 4:
        return 'bg-green-500'
      case 5:
        return 'bg-green-600'
      default:
        return 'bg-gray-300'
    }
  }, [strength])

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 dark:text-gray-400">Password strength</span>
        <span className={clsx(
          'text-xs font-medium',
          strength <= 2 && 'text-red-600',
          strength === 3 && 'text-yellow-600',
          strength >= 4 && 'text-green-600'
        )}>
          {strengthText}
        </span>
      </div>
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={clsx(
              'h-1 flex-1 rounded-full transition-colors',
              level <= strength ? strengthColor : 'bg-gray-300 dark:bg-gray-600'
            )}
          />
        ))}
      </div>
    </div>
  )
}