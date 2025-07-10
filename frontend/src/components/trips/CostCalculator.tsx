import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingCart,
  PieChart,
  AlertTriangle,
  Download,
  Settings,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Activity,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Decimal } from 'decimal.js'
import {
  PriceEstimationStrategy,
  calculateIngredientCosts,
  generateCostSummary,
  checkBudgetStatus,
  formatCurrency,
  type IngredientCost,
  type CostSummary,
  type BudgetStatus,
  type CategoryCostBreakdown,
  type ParticipantCostBreakdown,
} from '@/utils/calculations/cost'
import { useWebSocketEvent } from '@/hooks/useWebSocket'
import { useI18nFormats } from '@/hooks/useI18nFormats'
import { cn } from '@/lib/utils'

interface CostCalculatorProps {
  tripId: string
  ingredients: Array<{
    ingredientId: string
    name: string
    quantity: Decimal
    unit: string
    category?: string
  }>
  participants: Array<{
    id: string
    name: string
    effectiveCoefficient: number
    attendanceDays: number
  }>
  totalDays: number
  mealsPerDay?: number
  budget?: number
  currency?: string
  className?: string
}

interface CostSettings {
  strategy: PriceEstimationStrategy
  currency: string
  showCategories: boolean
  showParticipants: boolean
  compactMode: boolean
}

export function CostCalculator({
  tripId,
  ingredients,
  participants,
  totalDays,
  mealsPerDay = 3,
  budget,
  currency = 'USD',
  className,
}: CostCalculatorProps) {
  const { t } = useTranslation()
  const { formatNumber } = useI18nFormats()
  
  const [settings, setSettings] = useState<CostSettings>({
    strategy: PriceEstimationStrategy.AVERAGE,
    currency,
    showCategories: true,
    showParticipants: true,
    compactMode: false,
  })
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [liveUpdateEnabled, setLiveUpdateEnabled] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null)

  // Calculate costs
  useEffect(() => {
    const costs = calculateIngredientCosts(ingredients, undefined, settings.strategy)
    const summary = generateCostSummary(costs, participants, totalDays, mealsPerDay)
    setCostSummary(summary)
    
    if (budget) {
      const status = checkBudgetStatus(budget, summary.totalCost.toNumber())
      setBudgetStatus(status)
    }
  }, [ingredients, participants, totalDays, mealsPerDay, budget, settings.strategy])

  // Listen for live cost updates via WebSocket
  useWebSocketEvent(
    'cost:calculation-update',
    (event) => {
      if (event.payload.tripId === tripId && liveUpdateEnabled) {
        setLastUpdate(new Date())
        // The update would be handled by the parent component
        // This is just for showing the update indicator
      }
    },
    { tripId, enabled: liveUpdateEnabled }
  )

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const exportCostReport = () => {
    if (!costSummary) return

    const report = {
      tripId,
      generatedAt: new Date().toISOString(),
      currency: settings.currency,
      summary: {
        totalCost: costSummary.totalCost.toNumber(),
        averageCostPerParticipant: costSummary.averageCostPerParticipant.toNumber(),
        averageCostPerDay: costSummary.averageCostPerDay.toNumber(),
        averageCostPerMeal: costSummary.averageCostPerMeal.toNumber(),
      },
      budget: budget
        ? {
            total: budget,
            remaining: budgetStatus?.remainingBudget.toNumber(),
            percentageUsed: budgetStatus?.percentageUsed,
            status: budgetStatus?.status,
          }
        : null,
      categoryBreakdown: costSummary.categoryBreakdown.map((cat) => ({
        category: cat.category,
        totalCost: cat.totalCost.toNumber(),
        itemCount: cat.itemCount,
        percentage: cat.percentage,
      })),
      participantBreakdown: costSummary.participantBreakdown.map((p) => ({
        participantId: p.participantId,
        participantName: p.participantName,
        effectiveCoefficient: p.effectiveCoefficient,
        totalCost: p.totalCost.toNumber(),
        costPerDay: p.costPerDay.toNumber(),
        costPerMeal: p.costPerMeal.toNumber(),
      })),
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trip-${tripId}-cost-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!costSummary) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="flex items-center justify-center h-64">
          <Calculator className="h-8 w-8 text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const getBudgetStatusColor = (status: BudgetStatus['status']) => {
    switch (status) {
      case 'under':
        return 'text-green-600'
      case 'on-target':
        return 'text-yellow-600'
      case 'over':
        return 'text-red-600'
    }
  }

  const getBudgetStatusIcon = (status: BudgetStatus['status']) => {
    switch (status) {
      case 'under':
        return <TrendingDown className="h-4 w-4" />
      case 'on-target':
        return <Activity className="h-4 w-4" />
      case 'over':
        return <TrendingUp className="h-4 w-4" />
    }
  }

  const getPriceStrategyLabel = (strategy: PriceEstimationStrategy) => {
    switch (strategy) {
      case PriceEstimationStrategy.CONSERVATIVE:
        return t('costCalculator.strategy.conservative')
      case PriceEstimationStrategy.OPTIMISTIC:
        return t('costCalculator.strategy.optimistic')
      case PriceEstimationStrategy.MEDIAN:
        return t('costCalculator.strategy.median')
      case PriceEstimationStrategy.AVERAGE:
      default:
        return t('costCalculator.strategy.average')
    }
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {t('costCalculator.title', 'Cost Calculator')}
            </CardTitle>
            <CardDescription>
              {t('costCalculator.description', 'Estimated costs and budget tracking')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {liveUpdateEnabled && (
              <Badge variant="secondary" className="animate-pulse">
                <Activity className="h-3 w-3 mr-1" />
                {t('costCalculator.liveUpdates', 'Live')}
              </Badge>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('costCalculator.settings', 'Settings')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t('costCalculator.priceStrategy', 'Price Strategy')}
                    </label>
                    <Select
                      value={settings.strategy}
                      onValueChange={(value) =>
                        setSettings({ ...settings, strategy: value as PriceEstimationStrategy })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(PriceEstimationStrategy).map((strategy) => (
                          <SelectItem key={strategy} value={strategy}>
                            {getPriceStrategyLabel(strategy)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t('costCalculator.currency', 'Currency')}
                    </label>
                    <Select
                      value={settings.currency}
                      onValueChange={(value) =>
                        setSettings({ ...settings, currency: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="CZK">CZK (Kč)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      {t('costCalculator.liveUpdates', 'Live Updates')}
                    </label>
                    <Button
                      variant={liveUpdateEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLiveUpdateEnabled(!liveUpdateEnabled)}
                    >
                      {liveUpdateEnabled ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="icon"
              onClick={exportCostReport}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Cost Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('costCalculator.totalCost', 'Total Cost')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(costSummary.totalCost, settings.currency)}
              </div>
              {budgetStatus && (
                <p className={cn('text-sm mt-1', getBudgetStatusColor(budgetStatus.status))}>
                  {budgetStatus.percentageUsed.toFixed(1)}% {t('costCalculator.ofBudget', 'of budget')}
                </p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('costCalculator.perParticipant', 'Per Participant')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(costSummary.averageCostPerParticipant, settings.currency)}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('costCalculator.average', 'Average')}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('costCalculator.perDay', 'Per Day')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(costSummary.averageCostPerDay, settings.currency)}
              </div>
              <p className="text-sm text-muted-foreground">
                {totalDays} {t('costCalculator.days', 'days')}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('costCalculator.perMeal', 'Per Meal')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(costSummary.averageCostPerMeal, settings.currency)}
              </div>
              <p className="text-sm text-muted-foreground">
                {totalDays * mealsPerDay} {t('costCalculator.meals', 'meals')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Budget Status */}
        {budgetStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {getBudgetStatusIcon(budgetStatus.status)}
                {t('costCalculator.budgetStatus', 'Budget Status')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={Math.min(budgetStatus.percentageUsed, 100)}
                className={cn(
                  'h-3',
                  budgetStatus.status === 'under' && 'bg-green-100',
                  budgetStatus.status === 'on-target' && 'bg-yellow-100',
                  budgetStatus.status === 'over' && 'bg-red-100'
                )}
              />
              <div className="flex justify-between text-sm">
                <span>{t('costCalculator.budget', 'Budget')}: {formatCurrency(budgetStatus.totalBudget, settings.currency)}</span>
                <span className={getBudgetStatusColor(budgetStatus.status)}>
                  {budgetStatus.status === 'over' ? t('costCalculator.overBudget', 'Over budget') : t('costCalculator.remaining', 'Remaining')}: {formatCurrency(Math.abs(budgetStatus.remainingBudget.toNumber()), settings.currency)}
                </span>
              </div>
              {budgetStatus.status === 'over' && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t('costCalculator.overBudgetWarning', 'Estimated costs exceed budget by {{amount}}', {
                      amount: formatCurrency(Math.abs(budgetStatus.remainingBudget.toNumber()), settings.currency),
                    })}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs for Category and Participant Breakdown */}
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              {t('costCalculator.categories', 'Categories')}
            </TabsTrigger>
            <TabsTrigger value="participants" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('costCalculator.participants', 'Participants')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="categories" className="space-y-4">
            {costSummary.categoryBreakdown.map((category) => (
              <Card key={category.category}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleCategory(category.category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-sm font-medium capitalize">
                          {category.category}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {category.itemCount} {t('costCalculator.items', 'items')}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(category.totalCost, settings.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {category.percentage.toFixed(1)}%
                        </div>
                      </div>
                      {expandedCategories.has(category.category) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <AnimatePresence>
                  {expandedCategories.has(category.category) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CardContent>
                        <div className="space-y-2">
                          {category.items.map((item) => (
                            <div
                              key={item.ingredientId}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-muted-foreground">
                                {item.ingredientName}
                              </span>
                              <span>
                                {formatCurrency(item.totalCost, settings.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            ))}
          </TabsContent>
          
          <TabsContent value="participants" className="space-y-4">
            {costSummary.participantBreakdown.map((participant) => (
              <Card key={participant.participantId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {participant.participantName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t('costCalculator.coefficient', 'Coefficient')}: {participant.effectiveCoefficient}x
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(participant.totalCost, settings.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(participant.costPerDay, settings.currency)}/{t('costCalculator.day', 'day')}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-muted-foreground">
                        {t('costCalculator.totalCost', 'Total')}
                      </div>
                      <div className="font-medium">
                        {formatCurrency(participant.totalCost, settings.currency)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">
                        {t('costCalculator.perDay', 'Per Day')}
                      </div>
                      <div className="font-medium">
                        {formatCurrency(participant.costPerDay, settings.currency)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">
                        {t('costCalculator.perMeal', 'Per Meal')}
                      </div>
                      <div className="font-medium">
                        {formatCurrency(participant.costPerMeal, settings.currency)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Last Update */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t('costCalculator.lastUpdated', 'Last updated')}: {lastUpdate.toLocaleTimeString()}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  <Info className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">
                  {t('costCalculator.tooltip', 'Costs are estimated based on average market prices. Actual costs may vary.')}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  )
}