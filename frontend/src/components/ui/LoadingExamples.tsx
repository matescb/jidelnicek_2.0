import React, { useState, useEffect } from 'react'
import { 
  LoadingSpinner, 
  LoadingDots,
  LoadingOverlay,
  ContainerLoading,
  PageLoading,
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  ProgressBar,
  ProgressCircle,
  Button
} from './'

/**
 * Example: Basic loading states in a button
 */
export const ButtonLoadingExample: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 3000)
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      loading={isLoading}
    >
      {isLoading ? 'Processing...' : 'Click me'}
    </Button>
  )
}

/**
 * Example: Data loading with skeleton
 */
export const DataLoadingExample: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    setTimeout(() => {
      setData([
        { id: 1, name: 'Item 1', description: 'Description for item 1' },
        { id: 2, name: 'Item 2', description: 'Description for item 2' },
        { id: 3, name: 'Item 3', description: 'Description for item 3' },
      ])
      setIsLoading(false)
    }, 2000)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-lg">
            <SkeletonAvatar />
            <div className="flex-1 space-y-2">
              <SkeletonText className="w-1/3" />
              <SkeletonText className="w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.id} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white">
            {item.name[0]}
          </div>
          <div className="flex-1">
            <h3 className="font-medium">{item.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Example: File upload with progress
 */
export const FileUploadExample: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleUpload = () => {
    setIsUploading(true)
    setProgress(0)

    // Simulate upload progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsUploading(false)
          return 100
        }
        return prev + 10
      })
    }, 300)
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleUpload} disabled={isUploading}>
        Upload File
      </Button>
      
      {isUploading && (
        <div className="space-y-2">
          <ProgressBar value={progress} showLabel indicatorVariant="primary" />
          <div className="flex items-center gap-2">
            <LoadingDots size="sm" variant="primary" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Uploading file...
            </span>
          </div>
        </div>
      )}
      
      {!isUploading && progress === 100 && (
        <div className="text-green-600 dark:text-green-400">
          Upload complete!
        </div>
      )}
    </div>
  )
}

/**
 * Example: Form submission with overlay
 */
export const FormSubmissionExample: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setTimeout(() => setIsSubmitting(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="space-y-4 p-6 bg-white dark:bg-gray-900 rounded-lg">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Enter your name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Enter your email"
          />
        </div>
        <Button type="submit">Submit</Button>
      </div>
      
      <LoadingOverlay
        isLoading={isSubmitting}
        variant="blur"
        text="Submitting form..."
      />
    </form>
  )
}

/**
 * Example: Dashboard with multiple loading states
 */
export const DashboardExample: React.FC = () => {
  const [stats, setStats] = useState({ loading: true, data: null })
  const [chart, setChart] = useState({ loading: true, data: null })
  const [table, setTable] = useState({ loading: true, data: null })

  useEffect(() => {
    // Simulate different loading times
    setTimeout(() => setStats({ loading: false, data: { users: 1234, revenue: '$12,345' } }), 1000)
    setTimeout(() => setChart({ loading: false, data: 'chart data' }), 2000)
    setTimeout(() => setTable({ loading: false, data: 'table data' }), 3000)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Stats Cards */}
      <div className="col-span-2 grid grid-cols-2 gap-4">
        {stats.loading ? (
          <>
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </>
        ) : (
          <>
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Users</h3>
              <p className="text-2xl font-bold">{stats.data?.users}</p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenue</h3>
              <p className="text-2xl font-bold">{stats.data?.revenue}</p>
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">Analytics</h3>
        {chart.loading ? (
          <ContainerLoading 
            isLoading 
            indicator="spinner" 
            text="Loading chart..." 
            minHeight="300px"
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Chart would go here
          </div>
        )}
      </div>

      {/* Progress Stats */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">Progress</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Completion</span>
              <span className="text-sm">75%</span>
            </div>
            <ProgressBar value={75} indicatorVariant="success" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Performance</span>
              <span className="text-sm">90%</span>
            </div>
            <ProgressBar value={90} indicatorVariant="info" />
          </div>
          <div className="flex justify-around pt-4">
            <ProgressCircle value={65} size="md" variant="warning" />
            <ProgressCircle value={85} size="md" variant="success" />
          </div>
        </div>
      </div>
    </div>
  )
}