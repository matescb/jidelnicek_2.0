import React, { useEffect, useState, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, Transition } from '@headlessui/react'
import { 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  MapPin,
  MoreVertical,
  Edit,
  Copy,
  Archive,
  Trash2,
  Eye
} from 'lucide-react'
import { useTripStore } from '@/store/slices/tripStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/utils/date'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Pagination } from '@/components/ui/Pagination'

// Trip status type from the store - extended with archived
type TripStatus = 'planning' | 'active' | 'completed' | 'archived'

// Status badge component
const StatusBadge: React.FC<{ status: TripStatus }> = ({ status }) => {
  const { t } = useTranslation()
  
  const statusConfig = {
    planning: {
      label: t('trips.status.planning', 'Planning'),
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    },
    active: {
      label: t('trips.status.active', 'Active'),
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    },
    completed: {
      label: t('trips.status.completed', 'Completed'),
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    },
    archived: {
      label: t('trips.status.archived', 'Archived'),
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    }
  }
  
  const config = statusConfig[status] || statusConfig.planning
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      config.className
    )}>
      {config.label}
    </span>
  )
}

// Loading skeleton component
const TripCardSkeleton: React.FC = () => (
  <Card className="animate-pulse">
    <CardHeader>
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
    </CardContent>
    <CardFooter>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
    </CardFooter>
  </Card>
)

// Trip card component
interface TripCardProps {
  trip: any // Using any for now, should be Trip type from store
  onView: () => void
  onEdit: () => void
  onDuplicate: () => void
  onArchive: () => void
  onDelete: () => void
}

const TripCard: React.FC<TripCardProps> = ({
  trip,
  onView,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete
}) => {
  const { t } = useTranslation()
  
  // Determine trip status for display
  const getTripStatus = (): TripStatus => {
    // Check if trip has isArchived property or similar
    if (trip.isArchived) return 'archived'
    return trip.status as TripStatus
  }
  
  const status = getTripStatus()
  
  return (
    <Card className="relative hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{trip.name}</CardTitle>
            {trip.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {trip.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <Menu as="div" className="relative">
              <Menu.Button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <MoreVertical className="w-4 h-4" />
              </Menu.Button>
              
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={onView}
                          className={cn(
                            'flex items-center gap-2 w-full px-4 py-2 text-sm',
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'text-gray-700 dark:text-gray-300'
                          )}
                        >
                          <Eye className="w-4 h-4" />
                          {t('common.view', 'View')}
                        </button>
                      )}
                    </Menu.Item>
                    
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={onEdit}
                          className={cn(
                            'flex items-center gap-2 w-full px-4 py-2 text-sm',
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'text-gray-700 dark:text-gray-300'
                          )}
                        >
                          <Edit className="w-4 h-4" />
                          {t('common.edit', 'Edit')}
                        </button>
                      )}
                    </Menu.Item>
                    
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={onDuplicate}
                          className={cn(
                            'flex items-center gap-2 w-full px-4 py-2 text-sm',
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'text-gray-700 dark:text-gray-300'
                          )}
                        >
                          <Copy className="w-4 h-4" />
                          {t('common.duplicate', 'Duplicate')}
                        </button>
                      )}
                    </Menu.Item>
                    
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={onArchive}
                          className={cn(
                            'flex items-center gap-2 w-full px-4 py-2 text-sm',
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'text-gray-700 dark:text-gray-300'
                          )}
                        >
                          <Archive className="w-4 h-4" />
                          {status === 'archived' 
                            ? t('common.unarchive', 'Unarchive')
                            : t('common.archive', 'Archive')
                          }
                        </button>
                      )}
                    </Menu.Item>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={onDelete}
                          className={cn(
                            'flex items-center gap-2 w-full px-4 py-2 text-sm',
                            active ? 'bg-red-50 dark:bg-red-900/20' : '',
                            'text-red-600 dark:text-red-400'
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('common.delete', 'Delete')}
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>
              {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Users className="w-4 h-4" />
            <span>
              {trip.participantCount} {t('trips.participants', 'participants')}
            </span>
          </div>
          
          {trip.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4" />
              <span>{trip.location}</span>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter>
        <button
          onClick={onView}
          className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          {t('trips.viewDetails', 'View Details')}
        </button>
      </CardFooter>
    </Card>
  )
}

// Main TripListPage component
const TripListPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    trips,
    loading,
    error,
    totalTrips,
    currentPage,
    pageSize,
    filters,
    fetchTrips,
    setFilters,
    clearFilters,
    deleteTrip,
    duplicateTrip,
    updateTrip,
    clearError
  } = useTripStore()
  
  const [searchQuery, setSearchQuery] = useState(filters.search || '')
  const [activeTab, setActiveTab] = useState<'all' | TripStatus>('all')
  const debouncedSearch = useDebounce(searchQuery, 300)
  
  // Fetch trips on mount and when filters change
  useEffect(() => {
    fetchTrips(currentPage)
  }, [currentPage, filters, fetchTrips])
  
  // Update search filter when debounced value changes
  useEffect(() => {
    setFilters({ search: debouncedSearch })
  }, [debouncedSearch, setFilters])
  
  // Filter trips by status tab
  const filteredTrips = useMemo(() => {
    if (activeTab === 'all') return trips
    
    return trips.filter(trip => {
      // Check if trip has isArchived property for archived status
      if (activeTab === 'archived') {
        return trip.isArchived === true
      }
      
      // Filter by trip status from the store
      switch (activeTab) {
        case 'planning':
          return trip.status === 'planning' && !trip.isArchived
        case 'active':
          return trip.status === 'active' && !trip.isArchived
        case 'completed':
          return trip.status === 'completed' && !trip.isArchived
        default:
          return true
      }
    })
  }, [trips, activeTab])
  
  // Tab configuration
  const tabs = [
    { id: 'all', label: t('common.all', 'All') },
    { id: 'planning', label: t('trips.status.planning', 'Planning') },
    { id: 'active', label: t('trips.status.active', 'Active') },
    { id: 'completed', label: t('trips.status.completed', 'Completed') },
    { id: 'archived', label: t('trips.status.archived', 'Archived') }
  ]
  
  // Handlers
  const handleCreateTrip = () => {
    navigate('/dashboard/trips/new')
  }
  
  const handleViewTrip = (tripId: string) => {
    navigate(`/dashboard/trips/${tripId}`)
  }
  
  const handleEditTrip = (tripId: string) => {
    navigate(`/dashboard/trips/${tripId}/edit`)
  }
  
  const handleDuplicateTrip = async (tripId: string) => {
    try {
      const newTrip = await duplicateTrip(tripId)
      navigate(`/dashboard/trips/${newTrip.id}/edit`)
    } catch (error) {
      console.error('Failed to duplicate trip:', error)
    }
  }
  
  const handleArchiveTrip = async (tripId: string) => {
    try {
      const trip = trips.find(t => t.id === tripId)
      if (trip) {
        // Toggle archive status
        await updateTrip(tripId, { isArchived: !trip.isArchived })
      }
    } catch (error) {
      console.error('Failed to archive trip:', error)
    }
  }
  
  const handleDeleteTrip = async (tripId: string) => {
    if (window.confirm(t('trips.confirmDelete', 'Are you sure you want to delete this trip?'))) {
      try {
        await deleteTrip(tripId)
      } catch (error) {
        console.error('Failed to delete trip:', error)
      }
    }
  }
  
  const handlePageChange = (page: number) => {
    fetchTrips(page)
  }
  
  // Calculate total pages
  const totalPages = Math.ceil(totalTrips / pageSize)
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('trips.title', 'My Trips')}
            </h1>
            <button
              onClick={handleCreateTrip}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('trips.createNew', 'Create New Trip')}
            </button>
          </div>
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('trips.searchPlaceholder', 'Search trips...')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {/* Status tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={clearError}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              {t('common.dismiss', 'Dismiss')}
            </button>
          </div>
        )}
        
        {/* Trip grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 mb-6 text-gray-300 dark:text-gray-600">
              <MapPin className="w-full h-full" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery || activeTab !== 'all'
                ? t('trips.noTripsFound', 'No trips found')
                : t('trips.noTrips', 'No trips yet')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-center max-w-md">
              {searchQuery || activeTab !== 'all'
                ? t('trips.tryDifferentSearch', 'Try adjusting your search or filters')
                : t('trips.getStarted', 'Get started by creating your first trip')}
            </p>
            {!searchQuery && activeTab === 'all' && (
              <button
                onClick={handleCreateTrip}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                {t('trips.createFirstTrip', 'Create Your First Trip')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onView={() => handleViewTrip(trip.id)}
                  onEdit={() => handleEditTrip(trip.id)}
                  onDuplicate={() => handleDuplicateTrip(trip.id)}
                  onArchive={() => handleArchiveTrip(trip.id)}
                  onDelete={() => handleDeleteTrip(trip.id)}
                />
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Floating action button for mobile */}
      <button
        onClick={handleCreateTrip}
        className="fixed bottom-6 right-6 lg:hidden w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  )
}

export default TripListPage