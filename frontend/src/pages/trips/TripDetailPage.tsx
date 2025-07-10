import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, differenceInDays, parseISO } from 'date-fns'
import {
  Calendar,
  Users,
  ShoppingCart,
  FileText,
  Edit,
  Share2,
  Download,
  Archive,
  Clock,
  MapPin,
  ChefHat,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  Loader2,
  MoreVertical,
  ArrowLeft
} from 'lucide-react'
import { useTripStore, type Trip, type Participant, type DayPlan, type ShoppingListItem } from '@/store/slices/tripStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Container } from '@/components/layout/Container'
import { Stack } from '@/components/layout/Stack'
import { useToast } from '@/hooks/useToast'
import { useI18n } from '@/hooks/useI18n'

// Helper function to calculate meal planning progress
const calculateMealProgress = (trip: Trip) => {
  if (!trip.days || trip.days.length === 0) return 0
  
  const totalSlots = trip.days.reduce((total, day) => {
    return total + trip.mealSlotConfiguration.filter(slot => slot.isActive).length
  }, 0)
  
  const filledSlots = trip.days.reduce((total, day) => {
    return total + (day.meals?.length || 0)
  }, 0)
  
  return totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0
}

// Helper function to get status color
const getStatusColor = (status: Trip['status']) => {
  switch (status) {
    case 'planning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'completed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
  }
}

// Activity Timeline Component
const ActivityTimeline: React.FC<{ tripId: string }> = ({ tripId }) => {
  // Mock activity data - in real app, this would come from API
  const activities = [
    { id: '1', type: 'meal_added', user: 'John Doe', action: 'added Spaghetti Carbonara to Day 2 Dinner', time: '2 hours ago' },
    { id: '2', type: 'participant_added', user: 'Jane Smith', action: 'joined the trip', time: '5 hours ago' },
    { id: '3', type: 'shopping_generated', user: 'System', action: 'generated shopping list', time: '1 day ago' },
    { id: '4', type: 'trip_created', user: 'John Doe', action: 'created the trip', time: '3 days ago' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-1.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-medium">{activity.user}</span> {activity.action}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Nutritional Chart Component
const NutritionalChart: React.FC<{ tripId: string }> = ({ tripId }) => {
  // Mock nutritional data - in real app, this would be calculated from meals
  const nutritionData = {
    calories: 2200,
    protein: 85,
    carbs: 280,
    fat: 75,
    fiber: 35
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Nutritional Breakdown
        </CardTitle>
        <CardDescription>Average per person per day</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Calories</p>
              <p className="text-2xl font-semibold">{nutritionData.calories}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Protein</p>
              <p className="text-2xl font-semibold">{nutritionData.protein}g</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Carbs</p>
              <p className="text-2xl font-semibold">{nutritionData.carbs}g</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fat</p>
              <p className="text-2xl font-semibold">{nutritionData.fat}g</p>
            </div>
          </div>
          <div className="pt-4 border-t dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Fiber</span>
              <span className="font-medium">{nutritionData.fiber}g</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Meal Distribution Component
const MealDistribution: React.FC<{ trip: Trip }> = ({ trip }) => {
  const mealCounts = trip.days.reduce((acc, day) => {
    day.meals?.forEach(meal => {
      const type = meal.mealSlot
      acc[type] = (acc[type] || 0) + 1
    })
    return acc
  }, {} as Record<string, number>)

  const totalMeals = Object.values(mealCounts).reduce((sum, count) => sum + count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Meal Distribution
        </CardTitle>
        <CardDescription>By meal type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(mealCounts).map(([type, count]) => {
            const percentage = totalMeals > 0 ? (count / totalMeals) * 100 : 0
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium capitalize">{type}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{count} meals</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Overview Tab Component
const OverviewTab: React.FC<{ trip: Trip }> = ({ trip }) => {
  const tripProgress = calculateMealProgress(trip)
  const daysTotal = differenceInDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1
  const daysElapsed = differenceInDays(new Date(), parseISO(trip.startDate))
  const timeProgress = Math.max(0, Math.min(100, (daysElapsed / daysTotal) * 100))

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-8 h-8 text-primary" />
                <span className="text-2xl font-bold">{trip.participants.length}</span>
              </div>
              <div className="flex -space-x-2">
                {trip.participants.slice(0, 3).map((p, i) => (
                  <div
                    key={p.id}
                    className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center"
                  >
                    <span className="text-xs font-medium">{p.name.charAt(0)}</span>
                  </div>
                ))}
                {trip.participants.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                    <span className="text-xs font-medium">+{trip.participants.length - 3}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Trip Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{daysTotal} days</p>
                <Progress value={timeProgress} className="w-20 h-1 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Meal Planning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ChefHat className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{tripProgress}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">$450</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Est. total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <NutritionalChart tripId={trip.id} />
          <MealDistribution trip={trip} />
        </div>
        <div>
          <ActivityTimeline tripId={trip.id} />
        </div>
      </div>
    </div>
  )
}

// Schedule Tab Component
const ScheduleTab: React.FC<{ trip: Trip }> = ({ trip }) => {
  return (
    <div className="space-y-4">
      {trip.days.map((day) => (
        <Card key={day.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Day {day.dayNumber} - {format(parseISO(day.date), 'EEEE, MMMM d')}
              </CardTitle>
              <Badge variant="outline">
                <Users className="w-3 h-3 mr-1" />
                {day.participantCount} participants
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trip.mealSlotConfiguration
                .filter(slot => slot.isActive)
                .map(slot => {
                  const meal = day.meals?.find(m => m.mealSlot === slot.id)
                  return (
                    <div key={slot.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex items-center gap-3">
                        <ChefHat className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium capitalize">{slot.customName || slot.mealType}</p>
                          {meal ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{meal.recipe.name}</p>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No meal assigned</p>
                          )}
                        </div>
                      </div>
                      {meal && meal.servingsOverride && (
                        <Badge variant="secondary">{meal.servingsOverride} servings</Badge>
                      )}
                    </div>
                  )
                })}
            </div>
            {day.notes && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">{day.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Participants Tab Component
const ParticipantsTab: React.FC<{ trip: Trip }> = ({ trip }) => {
  const navigate = useNavigate()
  
  return (
    <div className="space-y-6">
      {/* Header with action button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Trip Participants</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {trip.participants.length} participants registered
          </p>
        </div>
        <Button onClick={() => navigate(`/dashboard/trips/${trip.id}/participants`)}>
          <Users className="w-4 h-4 mr-2" />
          Manage Participants
        </Button>
      </div>
      
      {/* Participant cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {trip.participants.map((participant) => (
        <Card key={participant.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{participant.name}</CardTitle>
              <Button size="sm" variant="ghost">
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {participant.email && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{participant.email}</p>
              )}
              <div className="text-sm">
                <p className="text-gray-500 dark:text-gray-400 mb-1">Meal Coefficients:</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-gray-500 dark:text-gray-400">Breakfast</p>
                    <p className="font-semibold">{participant.mealCoefficients.breakfast}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-gray-500 dark:text-gray-400">Lunch</p>
                    <p className="font-semibold">{participant.mealCoefficients.lunch}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-gray-500 dark:text-gray-400">Dinner</p>
                    <p className="font-semibold">{participant.mealCoefficients.dinner}</p>
                  </div>
                </div>
              </div>
              {(participant.arrivalDate || participant.departureDate) && (
                <div className="pt-2 border-t dark:border-gray-700">
                  {participant.arrivalDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Arrives: {format(parseISO(participant.arrivalDate), 'MMM d')}
                    </p>
                  )}
                  {participant.departureDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Departs: {format(parseISO(participant.departureDate), 'MMM d')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  )
}

// Shopping List Tab Component
const ShoppingListTab: React.FC<{ tripId: string }> = ({ tripId }) => {
  const { shoppingList, shoppingListLoading, generateShoppingList } = useTripStore()
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateList = async () => {
    setIsGenerating(true)
    try {
      await generateShoppingList(tripId)
    } finally {
      setIsGenerating(false)
    }
  }

  if (!shoppingList || shoppingList.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No shopping list generated yet</p>
            <Button onClick={handleGenerateList} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Shopping List'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group items by category
  const groupedItems = shoppingList.reduce((acc, item) => {
    const category = item.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Shopping List</h3>
        <Button onClick={handleGenerateList} variant="outline" size="sm" disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Regenerating...
            </>
          ) : (
            'Regenerate'
          )}
        </Button>
      </div>
      
      {Object.entries(groupedItems).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.ingredientId} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Used in: {item.recipes.join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{item.quantity} {item.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Documents Tab Component
const DocumentsTab: React.FC<{ trip: Trip }> = ({ trip }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Trip Summary
          </CardTitle>
          <CardDescription>PDF document with trip overview</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Meal Plan
          </CardTitle>
          <CardDescription>Excel spreadsheet with detailed meal plan</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download Excel
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Shopping List
          </CardTitle>
          <CardDescription>Printable shopping list</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Recipe Collection
          </CardTitle>
          <CardDescription>All recipes used in this trip</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

const TripDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentTrip, loading, error, fetchTrip, shareTrip } = useTripStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('overview')
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    if (id) {
      fetchTrip(id)
    }
  }, [id, fetchTrip])

  const handleShare = async () => {
    if (!currentTrip) return
    
    setIsSharing(true)
    try {
      const shareLink = await shareTrip(currentTrip.id)
      // Copy to clipboard
      navigator.clipboard.writeText(shareLink)
      showToast('success', 'Share link copied to clipboard!')
    } catch (error) {
      showToast('error', 'Failed to generate share link')
    } finally {
      setIsSharing(false)
    }
  }

  const handleExport = (format: 'pdf' | 'excel') => {
    showToast('info', `Exporting to ${format.toUpperCase()}...`)
    // Implement export logic
  }

  const handleArchive = () => {
    showToast('info', 'Archiving trip...')
    // Implement archive logic
  }

  if (loading) {
    return (
      <Container className="py-8">
        <Stack spacing="lg">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </Stack>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="py-8">
        <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      </Container>
    )
  }

  if (!currentTrip) {
    return (
      <Container className="py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Trip not found
          </AlertDescription>
        </Alert>
      </Container>
    )
  }

  return (
    <Container className="py-8">
      <Stack spacing="lg">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/trips')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                {currentTrip.name}
                <Badge className={getStatusColor(currentTrip.status)}>
                  {currentTrip.status}
                </Badge>
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                {currentTrip.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {currentTrip.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(currentTrip.startDate), 'MMM d')} - {format(parseISO(currentTrip.endDate), 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {currentTrip.participants.length} participants
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/trips/${id}/participants`)}
            >
              <Users className="w-4 h-4 mr-2" />
              Participants
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/trips/${id}/edit`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4 mr-2" />
              )}
              Share
            </Button>
            <div className="relative group">
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    <Download className="w-4 h-4" />
                    Export as PDF
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    <Download className="w-4 h-4" />
                    Export as Excel
                  </button>
                  <div className="border-t dark:border-gray-700 my-1" />
                  <button
                    onClick={handleArchive}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    <Archive className="w-4 h-4" />
                    Archive Trip
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="shopping">Shopping List</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab trip={currentTrip} />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <ScheduleTab trip={currentTrip} />
          </TabsContent>

          <TabsContent value="participants" className="mt-6">
            <ParticipantsTab trip={currentTrip} />
          </TabsContent>

          <TabsContent value="shopping" className="mt-6">
            <ShoppingListTab tripId={currentTrip.id} />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <DocumentsTab trip={currentTrip} />
          </TabsContent>
        </Tabs>
      </Stack>
    </Container>
  )
}

export default TripDetailPage