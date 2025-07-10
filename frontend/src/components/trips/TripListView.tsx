import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { 
  Calendar, 
  Users, 
  MapPin, 
  Eye, 
  Edit, 
  Copy, 
  Archive,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChefHat,
  CalendarDays,
  Grid3X3,
  List
} from 'lucide-react'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTripStore } from '@/store/slices/tripStore'
import { TripFilters } from './TripFilters'
import { TripCalendarView } from './TripCalendarView'
import type { Trip } from '@/store/slices/tripStore'

interface TripListViewProps {
  onTripSelect?: (trip: Trip) => void
  className?: string
}

export function TripListView({ onTripSelect, className = '' }: TripListViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  
  const {
    trips,
    loading,
    totalTrips,
    currentPage,
    pageSize,
    filters,
    sortBy,
    sortOrder,
    fetchTrips,
    setFilters,
    setSorting,
    duplicateTrip,
    updateTrip,
    deleteTrip
  } = useTripStore()

  // Fetch trips on mount and when filters/sorting change
  useEffect(() => {
    fetchTrips(currentPage)
  }, [currentPage, filters, sortBy, sortOrder, fetchTrips])

  // Calculate meal planning progress
  const calculateMealProgress = (trip: Trip): number => {
    if (!trip.days || trip.days.length === 0) return 0
    
    const totalSlots = trip.days.reduce((sum, day) => {
      return sum + (trip.mealSlotConfiguration?.filter(slot => slot.isActive).length || 0)
    }, 0)
    
    const filledSlots = trip.days.reduce((sum, day) => {
      return sum + (day.meals?.length || 0)
    }, 0)
    
    return totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0
  }

  // Calculate budget status (mock for now)
  const getBudgetStatus = (trip: Trip) => {
    // This would normally calculate from actual budget data
    const mockBudget = Math.random() > 0.5 ? 'under' : 'over'
    const percentage = mockBudget === 'under' ? 85 : 110
    return { status: mockBudget, percentage }
  }

  // Format date range
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${format(start, 'd')} - ${format(end, 'd MMM yyyy')}`
    }
    
    return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`
  }

  // Handle trip actions
  const handleView = (trip: Trip) => {
    if (onTripSelect) {
      onTripSelect(trip)
    } else {
      navigate(`/trips/${trip.id}`)
    }
  }

  const handleEdit = (trip: Trip) => {
    navigate(`/trips/${trip.id}/edit`)
  }

  const handleDuplicate = async (trip: Trip) => {
    try {
      const newTrip = await duplicateTrip(trip.id)
      navigate(`/trips/${newTrip.id}/edit`)
    } catch (error) {
      console.error('Failed to duplicate trip:', error)
    }
  }

  const handleArchive = async (trip: Trip) => {
    try {
      await updateTrip(trip.id, { isArchived: !trip.isArchived })
      await fetchTrips(currentPage)
    } catch (error) {
      console.error('Failed to archive trip:', error)
    }
  }

  // Status badge component
  const StatusBadge = ({ status }: { status: Trip['status'] }) => {
    const variants = {
      planning: 'secondary',
      active: 'default',
      completed: 'outline'
    } as const

    const icons = {
      planning: <Calendar className="w-3 h-3 mr-1" />,
      active: <TrendingUp className="w-3 h-3 mr-1" />,
      completed: <Archive className="w-3 h-3 mr-1" />
    }

    return (
      <Badge variant={variants[status]} className="flex items-center">
        {icons[status]}
        {t(`trips.status.${status}`)}
      </Badge>
    )
  }

  // Budget indicator component
  const BudgetIndicator = ({ trip }: { trip: Trip }) => {
    const budget = getBudgetStatus(trip)
    const isOver = budget.status === 'over'
    
    return (
      <div className="flex items-center gap-2">
        <DollarSign className={`w-4 h-4 ${isOver ? 'text-red-500' : 'text-green-500'}`} />
        <span className={`text-sm font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
          {budget.percentage}%
        </span>
        {isOver ? (
          <TrendingUp className="w-3 h-3 text-red-500" />
        ) : (
          <TrendingDown className="w-3 h-3 text-green-500" />
        )}
      </div>
    )
  }

  // Define table columns
  const columns: Column<Trip>[] = [
    {
      key: 'name',
      header: t('trips.fields.name'),
      accessor: (trip) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {trip.name}
          </span>
          {trip.location && (
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
              <MapPin className="w-3 h-3 mr-1" />
              {trip.location}
            </span>
          )}
        </div>
      ),
      sortable: true
    },
    {
      key: 'dates',
      header: t('trips.fields.dates'),
      accessor: (trip) => (
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <span className="text-sm">
            {formatDateRange(trip.startDate, trip.endDate)}
          </span>
        </div>
      ),
      sortable: true
    },
    {
      key: 'participants',
      header: t('trips.fields.participants'),
      accessor: (trip) => (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium">
            {trip.participantCount || trip.participants?.length || 0}
          </span>
        </div>
      ),
      sortable: true,
      width: 120
    },
    {
      key: 'status',
      header: t('trips.fields.status'),
      accessor: (trip) => <StatusBadge status={trip.status} />,
      sortable: true,
      width: 140
    },
    {
      key: 'progress',
      header: t('trips.fields.mealProgress'),
      accessor: (trip) => {
        const progress = calculateMealProgress(trip)
        return (
          <div className="flex items-center gap-3 min-w-[120px]">
            <Progress value={progress} className="flex-1" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {progress}%
            </span>
          </div>
        )
      },
      width: 160,
      mobileHidden: true
    },
    {
      key: 'budget',
      header: t('trips.fields.budget'),
      accessor: (trip) => <BudgetIndicator trip={trip} />,
      width: 120,
      mobileHidden: true
    },
    {
      key: 'owner',
      header: t('trips.fields.owner'),
      accessor: (trip) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {trip.userId || t('common.unknown')}
        </span>
      ),
      mobileHidden: true
    }
  ]

  // Actions dropdown
  const renderActions = (trip: Trip) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleView(trip)}>
          <Eye className="mr-2 h-4 w-4" />
          {t('common.view')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleEdit(trip)}>
          <Edit className="mr-2 h-4 w-4" />
          {t('common.edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDuplicate(trip)}>
          <Copy className="mr-2 h-4 w-4" />
          {t('common.duplicate')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleArchive(trip)}>
          <Archive className="mr-2 h-4 w-4" />
          {trip.isArchived ? t('common.unarchive') : t('common.archive')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Mobile render item
  const mobileRenderItem = (trip: Trip) => (
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {trip.name}
          </h3>
          {trip.location && (
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
              <MapPin className="w-3 h-3 mr-1" />
              {trip.location}
            </p>
          )}
        </div>
        <StatusBadge status={trip.status} />
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span>{trip.participantCount || 0} {t('trips.participants')}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('trips.fields.mealProgress')}
          </span>
          <span className="text-sm font-medium">
            {calculateMealProgress(trip)}%
          </span>
        </div>
        <Progress value={calculateMealProgress(trip)} />
      </div>
      
      <div className="flex justify-between items-center pt-2">
        <BudgetIndicator trip={trip} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleView(trip)}
          className="text-blue-600 dark:text-blue-400"
        >
          {t('common.viewDetails')}
        </Button>
      </div>
    </div>
  )

  // Handle sorting
  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSorting(key as any, order)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('trips.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('trips.subtitle', { count: totalTrips })}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="list">
                <List className="w-4 h-4 mr-2" />
                {t('common.list')}
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <Grid3X3 className="w-4 h-4 mr-2" />
                {t('common.calendar')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button onClick={() => navigate('/trips/new')}>
            {t('trips.create')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <TripFilters
        filters={filters}
        onFiltersChange={setFilters}
        participantOptions={[]} // Would be populated from actual data
      />

      {/* Content */}
      <Card className="p-0 overflow-hidden">
        <Tabs value={viewMode} className="w-full">
          <TabsContent value="list" className="m-0">
            <DataTable
              columns={columns}
              data={trips}
              keyExtractor={(trip) => trip.id}
              onSort={handleSort}
              onRowClick={handleView}
              actions={renderActions}
              loading={loading}
              emptyMessage={t('trips.empty')}
              mobileRenderItem={mobileRenderItem}
            />
          </TabsContent>
          
          <TabsContent value="calendar" className="m-0 p-4">
            <TripCalendarView
              trips={trips}
              onTripClick={handleView}
              loading={loading}
            />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Pagination */}
      {totalTrips > pageSize && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTrips(currentPage - 1)}
              disabled={currentPage === 1}
            >
              {t('common.previous')}
            </Button>
            
            <span className="text-sm text-gray-600 dark:text-gray-400 px-4">
              {t('common.pageInfo', { current: currentPage, total: Math.ceil(totalTrips / pageSize) })}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTrips(currentPage + 1)}
              disabled={currentPage >= Math.ceil(totalTrips / pageSize)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}