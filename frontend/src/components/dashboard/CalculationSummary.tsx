import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTripStore } from '@/store/slices/tripStore'
import { useWebSocketContext } from '@/context/WebSocketContext'
import { websocketService } from '@/services/websocket'
import type { 
  CostCalculationUpdateEvent, 
  NutritionSummaryUpdateEvent,
  ShoppingListUpdateEvent 
} from '@/types/websocket'
import { formatCurrency } from '@/utils/calculations/cost'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  ShoppingCart,
  Users,
  Calendar,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down' | 'stable'
  }
  loading?: boolean
  onClick?: () => void
  className?: string
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  loading,
  onClick,
  className
}) => {
  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all hover:shadow-lg",
        onClick && "cursor-pointer hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <h3 className="text-2xl font-bold mt-2">{value}</h3>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && !loading && (
              <div className="flex items-center mt-2 space-x-1">
                {trend.direction === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : trend.direction === 'down' ? (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                ) : null}
                <span className={cn(
                  "text-xs font-medium",
                  trend.direction === 'up' && "text-green-600",
                  trend.direction === 'down' && "text-red-600",
                  trend.direction === 'stable' && "text-muted-foreground"
                )}>
                  {trend.direction !== 'stable' && `${Math.abs(trend.value)}%`}
                  {trend.direction === 'stable' && 'No change'}
                </span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 ml-4">
            <div className={cn(
              "p-3 rounded-full",
              "bg-primary/10 text-primary"
            )}>
              {icon}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color = 'currentColor',
  className
}) => {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg 
      width={width} 
      height={height} 
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
    </svg>
  )
}

export interface CalculationSummaryProps {
  tripId?: string
  className?: string
  onMetricClick?: (metric: 'cost' | 'nutrition' | 'shopping') => void
}

export const CalculationSummary: React.FC<CalculationSummaryProps> = ({
  tripId,
  className,
  onMetricClick
}) => {
  const { t } = useTranslation()
  const { isConnected } = useWebSocketContext()
  const { currentTrip, loading: tripsLoading, fetchTrip } = useTripStore()
  
  const [costData, setCostData] = useState<CostCalculationUpdateEvent | null>(null)
  const [nutritionData, setNutritionData] = useState<NutritionSummaryUpdateEvent | null>(null)
  const [shoppingData, setShoppingData] = useState<ShoppingListUpdateEvent | null>(null)
  const [costHistory, setCostHistory] = useState<number[]>([])
  const [calorieHistory, setCalorieHistory] = useState<number[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load trip if needed
  useEffect(() => {
    if (tripId && (!currentTrip || currentTrip.id !== tripId)) {
      fetchTrip(tripId)
    }
  }, [tripId, currentTrip, fetchTrip])

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!isConnected || !tripId) return

    const unsubscribeCost = websocketService.subscribe(
      'cost:calculation-update',
      (event) => {
        if (event.payload.tripId === tripId) {
          setCostData(event.payload)
          setCostHistory(prev => [...prev.slice(-9), event.payload.totalCost])
        }
      }
    )

    const unsubscribeNutrition = websocketService.subscribe(
      'nutrition:summary-update',
      (event) => {
        if (event.payload.tripId === tripId) {
          setNutritionData(event.payload)
          setCalorieHistory(prev => [...prev.slice(-9), event.payload.dailyAverages.calories])
        }
      }
    )

    const unsubscribeShopping = websocketService.subscribe(
      'shopping-list:update',
      (event) => {
        if (event.payload.tripId === tripId) {
          setShoppingData(event.payload)
        }
      }
    )

    return () => {
      unsubscribeCost()
      unsubscribeNutrition()
      unsubscribeShopping()
    }
  }, [isConnected, tripId])

  // Calculate trends
  const calculateTrend = (history: number[]): { value: number; direction: 'up' | 'down' | 'stable' } => {
    if (history.length < 2) return { value: 0, direction: 'stable' }
    
    const current = history[history.length - 1]
    const previous = history[history.length - 2]
    
    if (current === previous) return { value: 0, direction: 'stable' }
    
    const change = ((current - previous) / previous) * 100
    return {
      value: Math.abs(change),
      direction: change > 0 ? 'up' : 'down'
    }
  }

  const handleRefresh = useCallback(async () => {
    if (!tripId || isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await fetchTrip(tripId)
      // Request fresh calculations from the server
      await websocketService.emit('request:calculations', { tripId })
    } finally {
      setIsRefreshing(false)
    }
  }, [tripId, fetchTrip, isRefreshing])

  const activeTrip = tripId ? currentTrip : null
  const isLoading = tripsLoading || !activeTrip

  // Calculate derived values
  const totalCost = costData?.totalCost || 0
  const costPerPerson = costData?.costPerParticipant || 0
  const dailyCalories = nutritionData?.dailyAverages.calories || 0
  const shoppingItemCount = shoppingData?.items.length || 0
  const participantCount = activeTrip?.participantCount || 0
  const dayCount = activeTrip?.days?.length || 0

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {activeTrip ? activeTrip.name : t('dashboard.calculationSummary.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeTrip ? (
              <>
                {participantCount} {t('dashboard.calculationSummary.participants')} • {dayCount} {t('dashboard.calculationSummary.days')}
              </>
            ) : (
              t('dashboard.calculationSummary.selectTrip')
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={!activeTrip || isRefreshing}
          className={cn(
            "p-2 rounded-lg transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
        </button>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="flex items-center space-x-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{t('dashboard.calculationSummary.offline')}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost */}
        <MetricCard
          title={t('dashboard.calculationSummary.totalCost')}
          value={formatCurrency(totalCost)}
          subtitle={`${formatCurrency(costPerPerson)} ${t('dashboard.calculationSummary.perPerson')}`}
          icon={<DollarSign className="w-5 h-5" />}
          trend={calculateTrend(costHistory)}
          loading={isLoading}
          onClick={() => onMetricClick?.('cost')}
        />

        {/* Daily Calories */}
        <MetricCard
          title={t('dashboard.calculationSummary.dailyCalories')}
          value={Math.round(dailyCalories).toLocaleString()}
          subtitle={t('dashboard.calculationSummary.perPersonPerDay')}
          icon={<Activity className="w-5 h-5" />}
          trend={calculateTrend(calorieHistory)}
          loading={isLoading}
          onClick={() => onMetricClick?.('nutrition')}
        />

        {/* Shopping Items */}
        <MetricCard
          title={t('dashboard.calculationSummary.shoppingItems')}
          value={shoppingItemCount}
          subtitle={shoppingData ? t('dashboard.calculationSummary.uniqueIngredients') : undefined}
          icon={<ShoppingCart className="w-5 h-5" />}
          loading={isLoading}
          onClick={() => onMetricClick?.('shopping')}
        />

        {/* Participants */}
        <MetricCard
          title={t('dashboard.calculationSummary.participants')}
          value={participantCount}
          subtitle={activeTrip?.status === 'active' ? t('dashboard.calculationSummary.activeTrip') : undefined}
          icon={<Users className="w-5 h-5" />}
          loading={isLoading}
        />
      </div>

      {/* Trend Charts */}
      {(costHistory.length > 1 || calorieHistory.length > 1) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {costHistory.length > 1 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">{t('dashboard.calculationSummary.costTrend')}</h3>
                <Badge variant="outline" className="text-xs">
                  {costHistory.length} {t('dashboard.calculationSummary.dataPoints')}
                </Badge>
              </div>
              <Sparkline 
                data={costHistory} 
                width={200} 
                height={40}
                color="hsl(var(--primary))"
                className="w-full h-10"
              />
            </Card>
          )}

          {calorieHistory.length > 1 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">{t('dashboard.calculationSummary.calorieTrend')}</h3>
                <Badge variant="outline" className="text-xs">
                  {calorieHistory.length} {t('dashboard.calculationSummary.dataPoints')}
                </Badge>
              </div>
              <Sparkline 
                data={calorieHistory} 
                width={200} 
                height={40}
                color="hsl(var(--chart-2))"
                className="w-full h-10"
              />
            </Card>
          )}
        </div>
      )}

      {/* Nutrition Warnings */}
      {nutritionData?.warnings && nutritionData.warnings.length > 0 && (
        <Card className="p-4 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('dashboard.calculationSummary.nutritionWarnings')}
              </h3>
              <ul className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                {nutritionData.warnings.slice(0, 3).map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
              {nutritionData.warnings.length > 3 && (
                <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                  {t('dashboard.calculationSummary.moreWarnings', { count: nutritionData.warnings.length - 3 })}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!activeTrip && !isLoading && (
        <Card className="p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-sm font-medium mb-2">
            {t('dashboard.calculationSummary.noTripSelected')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('dashboard.calculationSummary.selectTripPrompt')}
          </p>
        </Card>
      )}
    </div>
  )
}

export default CalculationSummary