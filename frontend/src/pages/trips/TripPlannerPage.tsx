import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, differenceInDays, startOfDay } from 'date-fns'
import { 
  Calendar, 
  Clock, 
  Users, 
  ChefHat, 
  AlertCircle,
  Plus,
  Save,
  ArrowLeft,
  Settings,
  BarChart3,
  ShoppingCart
} from 'lucide-react'
import { useTripStore } from '@/store/slices/tripStore'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { TripCalendarView } from '@/components/trips/TripCalendarView'
import { MealPlanningBoard } from '@/components/trips/MealPlanningBoard'
import { ParticipantManager } from '@/components/trips/ParticipantManager'
import { TripStatistics } from '@/components/trips/TripStatistics'
import { ShoppingListGenerator } from '@/components/trips/ShoppingListGenerator'

const TripPlannerPage: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentTrip, loading, error, fetchTrip, updateTrip } = useTripStore()
  const { fetchUserRecipes, userRecipes } = useRecipeStore()
  const [activeTab, setActiveTab] = useState('calendar')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (id) {
      fetchTrip(id)
      fetchUserRecipes()
    }
  }, [id, fetchTrip, fetchUserRecipes])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/trips')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Trips
        </Button>
      </div>
    )
  }

  if (!currentTrip) {
    return null
  }

  const tripDuration = differenceInDays(
    new Date(currentTrip.endDate),
    new Date(currentTrip.startDate)
  ) + 1

  const totalMealSlots = currentTrip.days.reduce(
    (total, day) => total + currentTrip.mealSlotConfiguration.filter(slot => slot.isActive).length,
    0
  )

  const plannedMeals = currentTrip.days.reduce(
    (total, day) => total + day.meals.length,
    0
  )

  const completionPercentage = totalMealSlots > 0 
    ? Math.round((plannedMeals / totalMealSlots) * 100)
    : 0

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateTrip(currentTrip.id, currentTrip)
      // Show success message
    } catch (error) {
      // Handle error
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/trips')}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentTrip.name}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {format(new Date(currentTrip.startDate), 'MMM d')} - {format(new Date(currentTrip.endDate), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate(`/trips/${id}/edit`)}
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tripDuration} days</div>
            <p className="text-xs text-muted-foreground">
              {currentTrip.mealSlotConfiguration.filter(s => s.isActive).length} meals per day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentTrip.participants.length}</div>
            <p className="text-xs text-muted-foreground">
              {currentTrip.participantCount} expected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meal Planning</CardTitle>
            <ChefHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionPercentage}%</div>
            <Progress value={completionPercentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {plannedMeals} of {totalMealSlots} meals planned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge 
              variant={currentTrip.status === 'active' ? 'default' : 'secondary'}
              className="mt-1"
            >
              {currentTrip.status}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Last updated {format(new Date(currentTrip.updatedAt), 'MMM d, h:mm a')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calendar" className="text-xs sm:text-sm">
            <Calendar className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="meals" className="text-xs sm:text-sm">
            <ChefHat className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Meals</span>
          </TabsTrigger>
          <TabsTrigger value="participants" className="text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Participants</span>
          </TabsTrigger>
          <TabsTrigger value="statistics" className="text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="shopping" className="text-xs sm:text-sm">
            <ShoppingCart className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Shopping</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trip Calendar</CardTitle>
              <CardDescription>
                View and manage your trip schedule day by day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TripCalendarView trip={currentTrip} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meal Planning</CardTitle>
              <CardDescription>
                Drag and drop recipes to plan meals for each day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MealPlanningBoard 
                trip={currentTrip} 
                recipes={userRecipes}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Participant Management</CardTitle>
              <CardDescription>
                Manage trip participants and their preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ParticipantManager trip={currentTrip} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trip Statistics</CardTitle>
              <CardDescription>
                Nutritional information and meal distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TripStatistics trip={currentTrip} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shopping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shopping List</CardTitle>
              <CardDescription>
                Generate and manage your trip shopping list
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShoppingListGenerator trip={currentTrip} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TripPlannerPage