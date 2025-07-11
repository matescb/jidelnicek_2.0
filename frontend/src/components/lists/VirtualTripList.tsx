import React, { forwardRef, useCallback, useMemo } from 'react'
import { Trip } from '@/store/slices/tripStore'
import { VirtualList, VirtualTable, VirtualListHandle, VirtualTableColumn } from '@/components/performance/virtual'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
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
  CalendarDays,
  ChefHat
} from 'lucide-react'
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

export interface VirtualTripListProps {
  trips: Trip[]
  viewMode?: 'list' | 'table'
  height?: number | string
  onTripClick?: (trip: Trip) => void
  onEdit?: (trip: Trip) => void
  onDuplicate?: (trip: Trip) => void
  onArchive?: (trip: Trip) => void
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  className?: string
  overscan?: number
}

export const VirtualTripList = forwardRef<VirtualListHandle, VirtualTripListProps>(({
  trips,
  viewMode = 'list',
  height = 600,
  onTripClick,
  onEdit,
  onDuplicate,
  onArchive,
  onSort,
  sortBy,
  sortDirection = 'asc',
  className,
  overscan = 3
}, ref) => {
  const { t } = useTranslation()

  // Calculate meal planning progress
  const calculateMealProgress = useCallback((trip: Trip): number => {
    if (!trip.days || trip.days.length === 0) return 0
    
    const totalSlots = trip.days.reduce((sum, day) => {
      return sum + (trip.mealSlotConfiguration?.filter(slot => slot.isActive).length || 0)
    }, 0)
    
    const filledSlots = trip.days.reduce((sum, day) => {
      return sum + (day.meals?.length || 0)
    }, 0)
    
    return totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0
  }, [])

  // Calculate budget status (mock for now)
  const getBudgetStatus = useCallback((trip: Trip) => {
    const mockBudget = Math.random() > 0.5 ? 'under' : 'over'
    const percentage = mockBudget === 'under' ? 85 : 110
    return { status: mockBudget, percentage }
  }, [])

  // Format date range
  const formatDateRange = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${format(start, 'd')} - ${format(end, 'd MMM yyyy')}`
    }
    
    return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`
  }, [])

  // Status badge component
  const StatusBadge = React.memo(({ status }: { status: Trip['status'] }) => {
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
  })

  // Budget indicator component
  const BudgetIndicator = React.memo(({ trip }: { trip: Trip }) => {
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
  })

  // Actions dropdown
  const renderActions = useCallback((trip: Trip) => {
    if (!onEdit && !onDuplicate && !onArchive) return null

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onTripClick?.(trip)}>
            <Eye className="mr-2 h-4 w-4" />
            {t('common.view')}
          </DropdownMenuItem>
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(trip)}>
              <Edit className="mr-2 h-4 w-4" />
              {t('common.edit')}
            </DropdownMenuItem>
          )}
          {onDuplicate && (
            <DropdownMenuItem onClick={() => onDuplicate(trip)}>
              <Copy className="mr-2 h-4 w-4" />
              {t('common.duplicate')}
            </DropdownMenuItem>
          )}
          {onArchive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onArchive(trip)}>
                <Archive className="mr-2 h-4 w-4" />
                {trip.isArchived ? t('common.unarchive') : t('common.archive')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }, [t, onTripClick, onEdit, onDuplicate, onArchive])

  // List item renderer
  const renderListItem = useCallback((trip: Trip, index: number) => {
    const progress = calculateMealProgress(trip)

    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-200 dark:border-gray-700"
        onClick={() => onTripClick?.(trip)}
      >
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
            <div className="flex items-center gap-2">
              <StatusBadge status={trip.status} />
              {renderActions(trip)}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span>{trip.participantCount || 0} {t('trips.participants')}</span>
            </div>
            <div className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-gray-400" />
              <span>{trip.days?.length || 0} {t('trips.days')}</span>
            </div>
            <BudgetIndicator trip={trip} />
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t('trips.fields.mealProgress')}
              </span>
              <span className="font-medium">
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>
    )
  }, [t, calculateMealProgress, getBudgetStatus, formatDateRange, onTripClick, renderActions])

  // Table columns
  const columns: VirtualTableColumn<Trip>[] = useMemo(() => [
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
      sortable: true,
      minWidth: 200
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
      sortable: true,
      width: 180
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
      width: 120,
      align: 'center'
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
      width: 160
    },
    {
      key: 'budget',
      header: t('trips.fields.budget'),
      accessor: (trip) => <BudgetIndicator trip={trip} />,
      width: 120
    },
    {
      key: 'actions',
      header: '',
      accessor: (trip) => renderActions(trip),
      width: 50,
      align: 'center'
    }
  ], [t, calculateMealProgress, formatDateRange, renderActions])

  if (viewMode === 'table') {
    return (
      <VirtualTable
        ref={ref as any}
        data={trips}
        columns={columns}
        height={height}
        rowHeight={80}
        overscan={overscan}
        getRowKey={(trip) => trip.id}
        onRowClick={onTripClick}
        onSort={onSort}
        sortBy={sortBy}
        sortDirection={sortDirection}
        hoverable
        striped
        className={className}
        emptyMessage={t('trips.empty')}
      />
    )
  }

  return (
    <VirtualList
      ref={ref}
      items={trips}
      height={height}
      itemHeight={140}
      overscan={overscan}
      renderItem={(trip, index) => (
        <div className="px-4 py-2">
          {renderListItem(trip, index)}
        </div>
      )}
      getItemKey={(trip) => trip.id}
      className={className}
      emptyMessage={t('trips.empty')}
    />
  )
})

VirtualTripList.displayName = 'VirtualTripList'