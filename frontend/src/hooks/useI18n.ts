import { useCallback } from 'react'

export const useI18n = () => {
  const t = useCallback((key: string) => {
    // For now, just return the key as-is
    // In a real app, this would look up translations
    return key
  }, [])

  return { t }
}