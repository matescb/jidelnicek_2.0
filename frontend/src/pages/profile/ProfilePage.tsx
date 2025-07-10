import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@hooks/useAuth'
import { UserProfile } from '@/components/participants/UserProfile'

const ProfilePage: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('navigation.profile')}
      </h1>
      <UserProfile 
        userId={user?.id}
        canEdit={true}
        onSave={(data) => {
          console.log('Profile updated:', data)
        }}
      />
    </div>
  )
}

export default ProfilePage