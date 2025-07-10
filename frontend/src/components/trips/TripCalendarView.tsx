import React, { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { cs, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, Users, ChefHat, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import type { Trip, DayPlan, MealSlot } from '@/store/slices/tripStore'
import { useI18nFormats } from '@/hooks/useI18nFormats'

interface TripCalendarViewProps {
  trip: Trip
  onDayClick?: (day: DayPlan | null, date: Date) => void
  selectedDate?: Date
  locale?: 'cs' | 'en'
}

export const TripCalendarView: React.FC<TripCalendarViewProps> = ({
  trip,
  onDayClick,
  selectedDate,
  locale = 'cs'
}) => {
  const { formatDate } = useI18nFormats()
  const dateLocale = locale === 'cs' ? cs : enUS
  
  // Calculate the date range for the trip
  const tripStart = parseISO(trip.startDate)
  const tripEnd = parseISO(trip.endDate)
  
  // State for current viewing month
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate && isWithinInterval(selectedDate, { start: tripStart, end: tripEnd })) {
      return startOfMonth(selectedDate)
    }
    return startOfMonth(tripStart)
  })

  // Get all days in the current month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Create a map of trip days for quick lookup
  const tripDaysMap = useMemo(() => {
    const map = new Map<string, DayPlan>()
    trip.days.forEach(day => {
      map.set(day.date, day)
    })
    return map
  }, [trip.days])

  // Get active meal slots
  const activeMealSlots = trip.mealSlotConfiguration.filter(slot => slot.isActive)

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  // Check if a date is within the trip range
  const isWithinTrip = (date: Date) => {
    return isWithinInterval(date, { start: tripStart, end: tripEnd })
  }

  // Get day statistics
  const getDayStats = (dayPlan: DayPlan | undefined) => {
    if (!dayPlan) return { plannedMeals: 0, totalMeals: 0, participantCount: 0 }
    
    const totalMeals = activeMealSlots.length
    const plannedMeals = dayPlan.meals.length
    const participantCount = dayPlan.participantCount || trip.participantCount
    
    return { plannedMeals, totalMeals, participantCount }
  }

  // Handle day click
  const handleDayClick = (date: Date) => {
    if (!isWithinTrip(date)) return
    
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayPlan = tripDaysMap.get(dateStr) || null
    
    onDayClick?.(dayPlan, date)
  }

  // Get week days
  const weekDays = locale === 'cs' 
    ? ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Adjust days to start with Monday
  const adjustedDaysInMonth = useMemo(() => {
    const firstDay = daysInMonth[0]
    const dayOfWeek = firstDay.getDay()
    const daysToAdd = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    
    const paddingDays = Array.from({ length: daysToAdd }, (_, i) => {
      const date = new Date(firstDay)
      date.setDate(date.getDate() - (daysToAdd - i))
      return date
    })
    
    return [...paddingDays, ...daysInMonth]
  }, [daysInMonth])

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {format(currentMonth, 'LLLL yyyy', { locale: dateLocale })}
        </h3>
        
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={locale === 'cs' ? 'Předchozí měsíc' : 'Previous month'}
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={locale === 'cs' ? 'Další měsíc' : 'Next month'}
          >
            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day, index) => (
          <div
            key={index}
            className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {adjustedDaysInMonth.map((date, index) => {
          const dateStr = format(date, 'yyyy-MM-dd')
          const dayPlan = tripDaysMap.get(dateStr)
          const isInCurrentMonth = isSameMonth(date, currentMonth)
          const isInTrip = isWithinTrip(date)
          const isSelected = selectedDate && isSameDay(date, selectedDate)
          const isToday = isSameDay(date, new Date())
          const stats = getDayStats(dayPlan)
          
          return (
            <div
              key={index}
              onClick={() => handleDayClick(date)}
              className={clsx(
                'relative min-h-[100px] p-2 border rounded-lg transition-all',
                isInCurrentMonth ? 'opacity-100' : 'opacity-50',
                isInTrip && isInCurrentMonth ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
                isInTrip
                  ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                  : 'bg-gray-50 dark:bg-gray-950 border-gray-100 dark:border-gray-800',
                isSelected && 'ring-2 ring-primary-500 border-primary-500',
                isToday && 'border-primary-400 dark:border-primary-600'
              )}
            >
              {/* Date number */}
              <div className={clsx(
                'text-sm font-medium mb-1',
                isInTrip
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-600',
                isToday && 'text-primary-600 dark:text-primary-400'
              )}>
                {format(date, 'd')}
              </div>

              {/* Day content - only show for trip days */}
              {isInTrip && isInCurrentMonth && (
                <div className="space-y-1">
                  {/* Meal planning status */}
                  {dayPlan && (
                    <>
                      <div className="flex items-center gap-1 text-xs">
                        <ChefHat className="h-3 w-3 text-gray-500" />
                        <span className={clsx(
                          stats.plannedMeals === stats.totalMeals
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-amber-600 dark:text-amber-400'
                        )}>
                          {stats.plannedMeals}/{stats.totalMeals}
                        </span>
                      </div>
                      
                      {/* Participant count if different from trip default */}
                      {stats.participantCount !== trip.participantCount && (
                        <div className="flex items-center gap-1 text-xs">
                          <Users className="h-3 w-3 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">
                            {stats.participantCount}
                          </span>
                        </div>
                      )}
                      
                      {/* Warning if not all meals planned */}
                      {stats.plannedMeals < stats.totalMeals && (
                        <div className="absolute top-1 right-1">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Show if it's a trip day but no plan yet */}
                  {!dayPlan && (
                    <div className="text-xs text-gray-400 dark:text-gray-600 italic">
                      {locale === 'cs' ? 'Bez plánu' : 'No plan'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"></div>
          <span>{locale === 'cs' ? 'Den výletu' : 'Trip day'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded"></div>
          <span>{locale === 'cs' ? 'Mimo výlet' : 'Outside trip'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-gray-500" />
          <span>{locale === 'cs' ? 'Naplánovaná jídla' : 'Planned meals'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span>{locale === 'cs' ? 'Neúplný plán' : 'Incomplete plan'}</span>
        </div>
      </div>
    </div>
  )
}