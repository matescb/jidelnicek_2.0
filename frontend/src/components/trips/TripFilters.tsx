import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  X,
  ChevronDown
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select'
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger 
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import type { TripFilters as TripFiltersType } from '@/store/slices/tripStore'

interface TripFiltersProps {
  filters: TripFiltersType
  onFiltersChange: (filters: TripFiltersType) => void
  participantOptions?: Array<{ id: string; name: string }>
  className?: string
}

export function TripFilters({ 
  filters, 
  onFiltersChange, 
  participantOptions = [],
  className = '' 
}: TripFiltersProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [localFilters, setLocalFilters] = useState<TripFiltersType>(filters)
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(filters.status || [])
  const [dateRange, setDateRange] = useState<{
    from?: Date
    to?: Date
  }>({
    from: filters.startDateFrom ? new Date(filters.startDateFrom) : undefined,
    to: filters.startDateTo ? new Date(filters.startDateTo) : undefined
  })
  const [participantRange, setParticipantRange] = useState<[number, number]>([
    filters.participantCountMin || 1,
    filters.participantCountMax || 50
  ])

  // Status options
  const statusOptions = [
    { value: 'planning', label: t('trips.status.planning') },
    { value: 'active', label: t('trips.status.active') },
    { value: 'completed', label: t('trips.status.completed') }
  ]

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        handleFilterChange({ search: searchValue || undefined })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue])

  // Handle filter changes
  const handleFilterChange = (updates: Partial<TripFiltersType>) => {
    const newFilters = { ...localFilters, ...updates }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  // Handle status toggle
  const handleStatusToggle = (status: string) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status]
    
    setSelectedStatuses(newStatuses)
    handleFilterChange({ status: newStatuses.length > 0 ? newStatuses : undefined })
  }

  // Handle date range change
  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    setDateRange(range)
    handleFilterChange({
      startDateFrom: range.from ? format(range.from, 'yyyy-MM-dd') : undefined,
      startDateTo: range.to ? format(range.to, 'yyyy-MM-dd') : undefined
    })
  }

  // Handle participant range change
  const handleParticipantRangeChange = (values: number[]) => {
    const [min, max] = values
    setParticipantRange([min, max])
    handleFilterChange({
      participantCountMin: min > 1 ? min : undefined,
      participantCountMax: max < 50 ? max : undefined
    })
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchValue('')
    setSelectedStatuses([])
    setDateRange({})
    setParticipantRange([1, 50])
    setLocalFilters({})
    onFiltersChange({})
  }

  // Count active filters
  const activeFilterCount = [
    filters.search,
    filters.status?.length,
    filters.startDateFrom || filters.startDateTo,
    filters.participantCountMin || filters.participantCountMax
  ].filter(Boolean).length

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Primary filters row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={t('trips.filters.searchPlaceholder')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[150px] justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {t('trips.filters.status')}
              </span>
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedStatuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="space-y-2">
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.value}
                    checked={selectedStatuses.includes(option.value)}
                    onCheckedChange={() => handleStatusToggle(option.value)}
                  />
                  <Label
                    htmlFor={option.value}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Date range filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[200px] justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {dateRange.from || dateRange.to
                  ? `${dateRange.from ? format(dateRange.from, 'MMM d') : ''} - ${
                      dateRange.to ? format(dateRange.to, 'MMM d') : ''
                    }`
                  : t('trips.filters.dateRange')
                }
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Toggle advanced filters */}
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          {t('trips.filters.advanced')}
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Advanced filters */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent className="space-y-4">
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Participant count range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('trips.filters.participantCount')}
              </Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{participantRange[0]}</span>
                  <span className="text-gray-500">-</span>
                  <span>{participantRange[1]}</span>
                </div>
                <Slider
                  value={participantRange}
                  onValueChange={handleParticipantRangeChange}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Participant filter (if options provided) */}
            {participantOptions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="participant" className="text-sm font-medium">
                  {t('trips.filters.participant')}
                </Label>
                <Select>
                  <SelectTrigger id="participant">
                    <SelectValue placeholder={t('trips.filters.selectParticipant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {participantOptions.map((participant) => (
                      <SelectItem key={participant.id} value={participant.id}>
                        {participant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Location filter */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">
                {t('trips.filters.location')}
              </Label>
              <Input
                id="location"
                type="text"
                placeholder={t('trips.filters.locationPlaceholder')}
                className="w-full"
              />
            </div>
          </div>

          {/* Clear filters button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-2"
              disabled={activeFilterCount === 0}
            >
              <X className="h-4 w-4" />
              {t('trips.filters.clear')}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              {t('trips.filters.search')}: {filters.search}
              <button
                onClick={() => {
                  setSearchValue('')
                  handleFilterChange({ search: undefined })
                }}
                className="ml-1 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.status?.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {t(`trips.status.${status}`)}
              <button
                onClick={() => handleStatusToggle(status)}
                className="ml-1 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          
          {(filters.startDateFrom || filters.startDateTo) && (
            <Badge variant="secondary" className="gap-1">
              {t('trips.filters.dates')}: {
                filters.startDateFrom && format(new Date(filters.startDateFrom), 'MMM d')
              } - {
                filters.startDateTo && format(new Date(filters.startDateTo), 'MMM d')
              }
              <button
                onClick={() => {
                  setDateRange({})
                  handleFilterChange({ startDateFrom: undefined, startDateTo: undefined })
                }}
                className="ml-1 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {(filters.participantCountMin || filters.participantCountMax) && (
            <Badge variant="secondary" className="gap-1">
              {t('trips.filters.participants')}: {filters.participantCountMin || 1} - {filters.participantCountMax || 50}
              <button
                onClick={() => {
                  setParticipantRange([1, 50])
                  handleFilterChange({ participantCountMin: undefined, participantCountMax: undefined })
                }}
                className="ml-1 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}