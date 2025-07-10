import { useState, useCallback } from 'react'
import { apiClient } from '@/api/client'
import { AxiosProgressEvent } from 'axios'

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

interface UseFileUploadOptions {
  onProgress?: (progress: UploadProgress) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export function useFileUpload(options?: UseFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0
  })

  const uploadFile = useCallback(async (
    url: string,
    formData: FormData,
    method: 'post' | 'put' = 'post'
  ) => {
    setIsUploading(true)
    setProgress({ loaded: 0, total: 0, percentage: 0 })

    try {
      const response = await apiClient[method](url, formData, {
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            const progressData = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage
            }
            
            setProgress(progressData)
            options?.onProgress?.(progressData)
          }
        }
      })

      options?.onComplete?.()
      return response.data
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Upload failed')
      options?.onError?.(errorObj)
      throw errorObj
    } finally {
      setIsUploading(false)
    }
  }, [options])

  return {
    uploadFile,
    isUploading,
    progress
  }
}