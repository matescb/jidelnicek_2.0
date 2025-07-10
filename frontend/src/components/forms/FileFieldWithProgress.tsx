import React, { useState } from 'react'
import { FileField } from './FileField'
import { useFileUpload } from '@/hooks/useFileUpload'
import { motion, AnimatePresence } from 'framer-motion'

interface FileFieldWithProgressProps extends React.ComponentProps<typeof FileField> {
  uploadUrl?: string
  onUploadComplete?: (response: any) => void
  autoUpload?: boolean
}

export const FileFieldWithProgress: React.FC<FileFieldWithProgressProps> = ({
  uploadUrl,
  onUploadComplete,
  autoUpload = false,
  ...fileFieldProps
}) => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const { uploadFile } = useFileUpload({
    onProgress: (progress) => {
      // This is a simplified version - in a real app you'd track per-file progress
      setUploadProgress(prev => ({
        ...prev,
        current: progress.percentage
      }))
    },
    onComplete: () => {
      setUploadProgress({})
    }
  })

  const handleUpload = async (files: File[]) => {
    if (!uploadUrl || !autoUpload) return

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const response = await uploadFile(uploadUrl, formData)
      onUploadComplete?.(response)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  return (
    <div className="relative">
      <FileField
        {...fileFieldProps}
        onUpload={autoUpload ? handleUpload : fileFieldProps.onUpload}
      />
      
      {/* Global upload progress overlay */}
      <AnimatePresence>
        {Object.keys(uploadProgress).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg flex items-center justify-center z-10"
          >
            <div className="text-center">
              <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Uploading...
              </div>
              <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-blue-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress.current || 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {uploadProgress.current || 0}%
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}