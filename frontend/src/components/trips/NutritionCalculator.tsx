import React, { useState, useMemo, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  Users,
  Download,
  ChevronDown,
  ChevronUp,
  Info,
  Target,
  TrendingUp,
  Apple,
  Beef,
  Wheat,
  Droplet
} from 'lucide-react'
import { Trip, TripDay, TripMeal, TripParticipant, Recipe } from '../../types'
import {
  calculateRecipeNutrition,
  calculatePerServing,
  roundNutritionValues,
  calculateDailyNutrition,
  calculateNutritionPerParticipant,
  checkNutritionGoals,
  calculateNutritionBalance,
  getNutritionSummary,
  NutritionalValue,
  DailyNutritionGoals,
  NutritionGoalStatus,
  RecipeIngredientNutrition
} from '../../utils/calculations/nutrition'
import { useWebSocket } from '../../hooks/useWebSocket'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Progress } from '../ui/Progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/Select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../ui/Tooltip'

interface NutritionCalculatorProps {
  trip: Trip
  className?: string
}

// Default daily nutrition goals (can be customized per participant)
const DEFAULT_DAILY_GOALS: DailyNutritionGoals = {
  calories: { min: 2000, max: 2500 },
  proteins_g: { min: 50, max: 175 },
  carbohydrates_g: { min: 225, max: 325 },
  fats_g: { min: 44, max: 78 },
  fiber_g: { min: 25, max: 35 },
  sodium_mg: { max: 2300 },
  sugars_g: { max: 50 },
  saturated_fats_g: { max: 22 }
}

// Recommended daily values for vitamins and minerals
const VITAMIN_RDV: Record<string, { value: number; unit: string }> = {
  vitamin_a_ug: { value: 900, unit: 'μg' },
  vitamin_b1_mg: { value: 1.2, unit: 'mg' },
  vitamin_b2_mg: { value: 1.3, unit: 'mg' },
  vitamin_b3_mg: { value: 16, unit: 'mg' },
  vitamin_b5_mg: { value: 5, unit: 'mg' },
  vitamin_b6_mg: { value: 1.7, unit: 'mg' },
  vitamin_b7_ug: { value: 30, unit: 'μg' },
  vitamin_b9_ug: { value: 400, unit: 'μg' },
  vitamin_b12_ug: { value: 2.4, unit: 'μg' },
  vitamin_c_mg: { value: 90, unit: 'mg' },
  vitamin_d_ug: { value: 20, unit: 'μg' },
  vitamin_e_mg: { value: 15, unit: 'mg' },
  vitamin_k_ug: { value: 120, unit: 'μg' }
}

export const NutritionCalculator: React.FC<NutritionCalculatorProps> = ({
  trip,
  className
}) => {
  const { t, i18n } = useTranslation()
  const [selectedTab, setSelectedTab] = useState('summary')
  const [selectedParticipant, setSelectedParticipant] = useState<string>('all')
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [showMicronutrients, setShowMicronutrients] = useState(false)

  // Subscribe to real-time updates
  const { lastMessage } = useWebSocket()

  useEffect(() => {
    if (lastMessage?.type === 'meal-assignment-change' && lastMessage.payload.tripId === trip.id) {
      // Trigger recalculation when meals change
      // In a real app, this would fetch updated trip data
    }
  }, [lastMessage, trip.id])

  // Calculate nutrition data
  const nutritionData = useMemo(() => {
    const dailyNutrition: Record<string, Record<string, number | null>> = {}
    const participantNutrition: Record<string, Record<string, Record<string, number | null>>> = {}
    let totalNutrition: Record<string, number | null> = {}

    // Get active participants for each day
    const getActiveParticipants = (date: string) => {
      return trip.participants.filter(p => {
        if (p.status !== 'accepted') return false
        const arrival = p.arrivalDate ? parseISO(p.arrivalDate) : parseISO(trip.startDate)
        const departure = p.departureDate ? parseISO(p.departureDate) : parseISO(trip.endDate)
        const currentDate = parseISO(date)
        return currentDate >= arrival && currentDate <= departure
      })
    }

    // Process each day
    trip.days.forEach(day => {
      const dayMeals: Array<{ nutrition: Record<string, number | null>; servings: number }> = []
      const activeParticipants = getActiveParticipants(day.date)
      
      // Initialize participant data for this day
      activeParticipants.forEach(p => {
        if (!participantNutrition[p.id]) {
          participantNutrition[p.id] = {}
        }
        participantNutrition[p.id][day.date] = {}
      })

      // Process each meal
      day.meals.forEach(meal => {
        if (!meal.recipe?.nutrition) return

        // Convert recipe nutrition to our format
        const recipeNutrition: Record<string, number | null> = {
          calories: meal.recipe.nutrition.calories,
          proteins_g: meal.recipe.nutrition.protein,
          carbohydrates_g: meal.recipe.nutrition.carbs,
          fats_g: meal.recipe.nutrition.fat,
          fiber_g: meal.recipe.nutrition.fiber,
          sodium_mg: meal.recipe.nutrition.sodium,
          sugars_g: meal.recipe.nutrition.sugar ?? null,
          saturated_fats_g: meal.recipe.nutrition.saturatedFat ?? null,
          cholesterol_mg: meal.recipe.nutrition.cholesterol ?? null
        }

        const servings = meal.servingsOverride || meal.recipe.servings
        
        // Calculate effective participants for this meal
        let effectiveParticipants = 0
        activeParticipants.forEach(p => {
          const coefficient = p.mealCoefficients?.[meal.mealSlot] || 1
          effectiveParticipants += coefficient
        })

        if (effectiveParticipants > 0) {
          // Scale recipe to needed servings
          const scaleFactor = effectiveParticipants / meal.recipe.servings
          const scaledNutrition: Record<string, number | null> = {}
          
          Object.entries(recipeNutrition).forEach(([key, value]) => {
            scaledNutrition[key] = value !== null ? value * scaleFactor : null
          })

          dayMeals.push({ nutrition: scaledNutrition, servings: 1 })

          // Calculate per participant
          activeParticipants.forEach(p => {
            const coefficient = p.mealCoefficients?.[meal.mealSlot] || 1
            const participantPortion = coefficient / effectiveParticipants
            
            Object.entries(scaledNutrition).forEach(([key, value]) => {
              if (value !== null) {
                if (!participantNutrition[p.id][day.date][key]) {
                  participantNutrition[p.id][day.date][key] = 0
                }
                participantNutrition[p.id][day.date][key]! += value * participantPortion
              }
            })
          })
        }
      })

      // Calculate daily totals
      dailyNutrition[day.date] = calculateDailyNutrition(dayMeals)
    })

    // Calculate trip totals
    const allMeals = Object.values(dailyNutrition).map(nutrition => ({
      nutrition,
      servings: 1
    }))
    totalNutrition = calculateDailyNutrition(allMeals)

    return {
      daily: dailyNutrition,
      participant: participantNutrition,
      total: totalNutrition
    }
  }, [trip])

  // Toggle day expansion
  const toggleDayExpansion = (dayId: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dayId)) {
        next.delete(dayId)
      } else {
        next.add(dayId)
      }
      return next
    })
  }

  // Export nutrition report
  const exportReport = () => {
    const report = {
      trip: {
        name: trip.name,
        dates: `${format(parseISO(trip.startDate), 'PPP', { locale: cs })} - ${format(parseISO(trip.endDate), 'PPP', { locale: cs })}`
      },
      summary: nutritionData.total,
      daily: Object.entries(nutritionData.daily).map(([date, nutrition]) => ({
        date: format(parseISO(date), 'PPP', { locale: cs }),
        nutrition: roundNutritionValues(nutrition)
      })),
      participants: trip.participants.filter(p => p.status === 'accepted').map(p => ({
        name: p.name,
        dailyAverage: calculateDailyAverage(nutritionData.participant[p.id] || {})
      }))
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip.name}-nutrition-report.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Calculate daily average for a participant
  const calculateDailyAverage = (participantData: Record<string, Record<string, number | null>>) => {
    const days = Object.keys(participantData).length
    if (days === 0) return {}

    const totals: Record<string, number> = {}
    Object.values(participantData).forEach(dayNutrition => {
      Object.entries(dayNutrition).forEach(([key, value]) => {
        if (value !== null) {
          totals[key] = (totals[key] || 0) + value
        }
      })
    })

    const averages: Record<string, number | null> = {}
    Object.entries(totals).forEach(([key, total]) => {
      averages[key] = total / days
    })

    return roundNutritionValues(averages)
  }

  // Render macronutrient pie chart
  const renderMacroChart = (nutrition: Record<string, number | null>) => {
    const calories = nutrition.calories || 0
    const proteins = nutrition.proteins_g || 0
    const carbs = nutrition.carbohydrates_g || 0
    const fats = nutrition.fats_g || 0

    if (calories === 0) return null

    const proteinCalories = proteins * 4
    const carbCalories = carbs * 4
    const fatCalories = fats * 9

    const proteinPercent = (proteinCalories / calories) * 100
    const carbPercent = (carbCalories / calories) * 100
    const fatPercent = (fatCalories / calories) * 100

    // Create donut chart segments
    let cumulativePercent = 0
    const segments = [
      { percent: proteinPercent, color: '#ef4444', label: t('nutrition.protein') }, // red
      { percent: carbPercent, color: '#3b82f6', label: t('nutrition.carbs') }, // blue
      { percent: fatPercent, color: '#f59e0b', label: t('nutrition.fat') } // amber
    ]

    return (
      <div className="flex items-center gap-6">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <g transform="translate(60, 60)">
            {segments.map((segment, index) => {
              const startAngle = (cumulativePercent * 360) / 100
              const endAngle = ((cumulativePercent + segment.percent) * 360) / 100
              cumulativePercent += segment.percent

              const startAngleRad = (startAngle * Math.PI) / 180
              const endAngleRad = (endAngle * Math.PI) / 180

              const x1 = Math.cos(startAngleRad) * 40
              const y1 = Math.sin(startAngleRad) * 40
              const x2 = Math.cos(endAngleRad) * 40
              const y2 = Math.sin(endAngleRad) * 40

              const largeArc = segment.percent > 50 ? 1 : 0

              return (
                <path
                  key={index}
                  d={`M ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} L 0 0`}
                  fill={segment.color}
                  stroke="white"
                  strokeWidth="2"
                />
              )
            })}
            <circle cx="0" cy="0" r="25" fill="white" />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              className="text-sm font-medium fill-gray-900"
            >
              {Math.round(calories)} kcal
            </text>
          </g>
        </svg>

        <div className="space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-gray-600">{segment.label}:</span>
              <span className="font-medium">{Math.round(segment.percent)}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render nutrition goal progress
  const renderGoalProgress = (
    nutrition: Record<string, number | null>,
    goals: DailyNutritionGoals = DEFAULT_DAILY_GOALS
  ) => {
    const goalStatuses = checkNutritionGoals(nutrition, goals)

    return (
      <div className="space-y-3">
        {goalStatuses.map(status => {
          const isRange = status.goal.min !== undefined && status.goal.max !== undefined
          const goalText = isRange
            ? `${status.goal.min} - ${status.goal.max}`
            : status.goal.min
            ? `≥ ${status.goal.min}`
            : `≤ ${status.goal.max}`

          const getStatusColor = () => {
            switch (status.status) {
              case 'within': return 'text-green-600 bg-green-50'
              case 'below': return 'text-amber-600 bg-amber-50'
              case 'above': return 'text-red-600 bg-red-50'
            }
          }

          const getProgressColor = () => {
            switch (status.status) {
              case 'within': return 'bg-green-500'
              case 'below': return 'bg-amber-500'
              case 'above': return 'bg-red-500'
            }
          }

          return (
            <div key={status.nutrient}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium capitalize">
                  {t(`nutrition.${status.nutrient}`)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {Math.round(status.current)} / {goalText}
                  </span>
                  <Badge className={getStatusColor()}>
                    {t(`nutrition.status.${status.status}`)}
                  </Badge>
                </div>
              </div>
              <Progress
                value={Math.min(status.percentage, 100)}
                className="h-2"
                indicatorClassName={getProgressColor()}
              />
            </div>
          )
        })}
      </div>
    )
  }

  // Render micronutrient table
  const renderMicronutrientTable = (nutrition: Record<string, number | null>) => {
    const vitamins = Object.entries(nutrition)
      .filter(([key]) => key.startsWith('vitamin_'))
      .map(([key, value]) => ({
        name: key,
        value,
        rdv: VITAMIN_RDV[key],
        percent: value && VITAMIN_RDV[key] ? (value / VITAMIN_RDV[key].value) * 100 : 0
      }))

    return (
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">{t('nutrition.vitamins')}</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {vitamins.map(vitamin => (
            <div key={vitamin.name} className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-900">
                {t(`nutrition.${vitamin.name}`)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {vitamin.value !== null ? (
                  <>
                    {Math.round(vitamin.value * 10) / 10} {vitamin.rdv?.unit}
                    {vitamin.rdv && (
                      <span className="ml-1">
                        ({Math.round(vitamin.percent)}% RDV)
                      </span>
                    )}
                  </>
                ) : (
                  'N/A'
                )}
              </div>
              {vitamin.value !== null && vitamin.rdv && (
                <Progress
                  value={Math.min(vitamin.percent, 100)}
                  className="h-1 mt-2"
                  indicatorClassName={
                    vitamin.percent >= 100
                      ? 'bg-green-500'
                      : vitamin.percent >= 50
                      ? 'bg-blue-500'
                      : 'bg-gray-400'
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const activeParticipants = trip.participants.filter(p => p.status === 'accepted')

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {t('nutrition.calculator')}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={exportReport}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('nutrition.exportReport')}
          </Button>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="summary">{t('nutrition.summary')}</TabsTrigger>
            <TabsTrigger value="daily">{t('nutrition.daily')}</TabsTrigger>
            <TabsTrigger value="participants">{t('nutrition.participants')}</TabsTrigger>
            <TabsTrigger value="goals">{t('nutrition.goals')}</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {t('nutrition.tripTotals')}
                </h4>
                {renderMacroChart(nutritionData.total)}
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {t('nutrition.dailyAverage')}
                </h4>
                {renderMacroChart(
                  calculateDailyAverage({ avg: nutritionData.total })
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">
                  {t('nutrition.nutritionBalance')}
                </h4>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        {t('nutrition.balanceTooltip')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-4">
                <Progress
                  value={calculateNutritionBalance(nutritionData.total)}
                  className="flex-1"
                  indicatorClassName="bg-gradient-to-r from-green-500 to-blue-500"
                />
                <span className="text-lg font-semibold">
                  {calculateNutritionBalance(nutritionData.total)}%
                </span>
              </div>
            </div>

            {showMicronutrients && (
              <div>
                {renderMicronutrientTable(nutritionData.total)}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMicronutrients(!showMicronutrients)}
              className="w-full"
            >
              {showMicronutrients ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  {t('nutrition.hideMicronutrients')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  {t('nutrition.showMicronutrients')}
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="daily" className="space-y-4">
            {trip.days.map(day => {
              const dayNutrition = nutritionData.daily[day.date] || {}
              const isExpanded = expandedDays.has(day.id)
              const dayParticipants = trip.participants.filter(p => {
                if (p.status !== 'accepted') return false
                const arrival = p.arrivalDate ? parseISO(p.arrivalDate) : parseISO(trip.startDate)
                const departure = p.departureDate ? parseISO(p.departureDate) : parseISO(trip.endDate)
                const currentDate = parseISO(day.date)
                return currentDate >= arrival && currentDate <= departure
              })

              return (
                <div key={day.id} className="border rounded-lg">
                  <button
                    onClick={() => toggleDayExpansion(day.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">
                          {t('common.day')} {day.dayNumber} - {format(parseISO(day.date), 'PPP', { locale: cs })}
                        </div>
                        <div className="text-sm text-gray-600">
                          {dayParticipants.length} {t('common.participants')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-semibold">
                          {Math.round(dayNutrition.calories || 0)} kcal
                        </div>
                        <div className="text-sm text-gray-600">
                          {t('nutrition.perPerson')}: {Math.round((dayNutrition.calories || 0) / dayParticipants.length)} kcal
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          {renderMacroChart(dayNutrition)}
                        </div>
                        <div>
                          {renderGoalProgress(
                            calculateNutritionPerParticipant(
                              dayNutrition,
                              dayParticipants.length
                            )
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">{t('common.meals')}</h5>
                        {day.meals.map(meal => (
                          <div
                            key={meal.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <div className="font-medium">
                                {t(`mealSlot.${meal.mealSlot}`)} - {meal.recipe.name}
                              </div>
                              <div className="text-sm text-gray-600">
                                {meal.servingsOverride || meal.recipe.servings} {t('common.servings')}
                              </div>
                            </div>
                            {meal.recipe.nutrition && (
                              <div className="text-sm text-gray-600">
                                {meal.recipe.nutrition.calories} kcal / {t('common.serving')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </TabsContent>

          <TabsContent value="participants" className="space-y-4">
            <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder={t('common.selectParticipant')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.allParticipants')}</SelectItem>
                {activeParticipants.map(participant => (
                  <SelectItem key={participant.id} value={participant.id}>
                    {participant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedParticipant === 'all' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeParticipants.map(participant => {
                  const avgNutrition = calculateDailyAverage(
                    nutritionData.participant[participant.id] || {}
                  )

                  return (
                    <Card key={participant.id} className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium">{participant.name}</div>
                          <div className="text-sm text-gray-600">
                            {t('nutrition.dailyAverage')}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t('nutrition.calories')}:</span>
                          <span className="font-medium">
                            {Math.round(avgNutrition.calories || 0)} kcal
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t('nutrition.protein')}:</span>
                          <span className="font-medium">
                            {Math.round(avgNutrition.proteins_g || 0)} g
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t('nutrition.carbs')}:</span>
                          <span className="font-medium">
                            {Math.round(avgNutrition.carbohydrates_g || 0)} g
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t('nutrition.fat')}:</span>
                          <span className="font-medium">
                            {Math.round(avgNutrition.fats_g || 0)} g
                          </span>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const participant = activeParticipants.find(p => p.id === selectedParticipant)
                  if (!participant) return null

                  const avgNutrition = calculateDailyAverage(
                    nutritionData.participant[participant.id] || {}
                  )

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900 mb-4">
                            {t('nutrition.averageDailyIntake')}
                          </h4>
                          {renderMacroChart(avgNutrition)}
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-gray-900 mb-4">
                            {t('nutrition.dailyGoals')}
                          </h4>
                          {renderGoalProgress(avgNutrition)}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-4">
                          {t('nutrition.dailyBreakdown')}
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(nutritionData.participant[participant.id] || {}).map(
                            ([date, nutrition]) => (
                              <div
                                key={date}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="text-sm">
                                  {format(parseISO(date), 'PPP', { locale: cs })}
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span>{Math.round(nutrition.calories || 0)} kcal</span>
                                  <span className="text-gray-600">
                                    P: {Math.round(nutrition.proteins_g || 0)}g
                                  </span>
                                  <span className="text-gray-600">
                                    C: {Math.round(nutrition.carbohydrates_g || 0)}g
                                  </span>
                                  <span className="text-gray-600">
                                    F: {Math.round(nutrition.fats_g || 0)}g
                                  </span>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </TabsContent>

          <TabsContent value="goals" className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">
                    {t('nutrition.aboutGoals')}
                  </h4>
                  <p className="text-sm text-blue-700">
                    {t('nutrition.goalsDescription')}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {t('nutrition.macronutrientGoals')}
                </h4>
                <div className="space-y-4">
                  {Object.entries(DEFAULT_DAILY_GOALS).slice(0, 4).map(([nutrient, goal]) => (
                    <div key={nutrient} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        {nutrient === 'calories' && <TrendingUp className="w-5 h-5 text-gray-600" />}
                        {nutrient === 'proteins_g' && <Beef className="w-5 h-5 text-red-600" />}
                        {nutrient === 'carbohydrates_g' && <Wheat className="w-5 h-5 text-amber-600" />}
                        {nutrient === 'fats_g' && <Droplet className="w-5 h-5 text-yellow-600" />}
                        <span className="font-medium capitalize">
                          {t(`nutrition.${nutrient}`)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {'min' in goal && 'max' in goal ? (
                          <>
                            {t('nutrition.range')}: {goal.min} - {goal.max} {nutrient.includes('_g') ? 'g' : ''}
                          </>
                        ) : 'min' in goal ? (
                          <>
                            {t('nutrition.minimum')}: {goal.min} {nutrient.includes('_g') ? 'g' : ''}
                          </>
                        ) : (
                          <>
                            {t('nutrition.maximum')}: {goal.max} {nutrient.includes('_g') ? 'g' : ''}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {t('nutrition.micronutrientGoals')}
                </h4>
                <div className="space-y-4">
                  {Object.entries(DEFAULT_DAILY_GOALS).slice(4).map(([nutrient, goal]) => (
                    <div key={nutrient} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Apple className="w-5 h-5 text-green-600" />
                        <span className="font-medium capitalize">
                          {t(`nutrition.${nutrient}`)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {'min' in goal && 'max' in goal ? (
                          <>
                            {t('nutrition.range')}: {goal.min} - {goal.max} {nutrient.includes('_mg') ? 'mg' : 'g'}
                          </>
                        ) : 'min' in goal ? (
                          <>
                            {t('nutrition.minimum')}: {goal.min} {nutrient.includes('_mg') ? 'mg' : 'g'}
                          </>
                        ) : (
                          <>
                            {t('nutrition.maximum')}: {goal.max} {nutrient.includes('_mg') ? 'mg' : 'g'}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  )
}