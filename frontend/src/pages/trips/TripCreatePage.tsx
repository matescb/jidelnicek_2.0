import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { TripWizard } from '@/components/trips/TripWizard'
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTripStore } from '@/store/slices/tripStore'
import { useToast } from '@/hooks/useToast'
import type { TripWizardData } from '@/components/trips/TripWizardTypes'
import type { Trip, MealSlot as TripMealSlot } from '@/store/slices/tripStore'

const TripCreatePage = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { createTrip, loading, error, clearError } = useTripStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleComplete = async (wizardData: TripWizardData) => {
    setIsSubmitting(true)
    clearError()

    try {
      // Transform wizard data to trip store format
      const tripData: Partial<Trip> = {
        name: wizardData.basicInfo.name,
        description: wizardData.basicInfo.description,
        startDate: wizardData.basicInfo.startDate.toISOString(),
        endDate: wizardData.basicInfo.endDate.toISOString(),
        participantCount: wizardData.participants.length,
        status: 'planning',
        // Transform meal slots to the expected format
        mealSlotConfiguration: wizardData.mealSlots.map((slot, index): TripMealSlot => ({
          id: slot.id,
          dayNumber: 0, // Will be set by backend based on day configuration
          mealType: slot.type === 'custom' ? 'snack' : slot.type as 'breakfast' | 'lunch' | 'dinner' | 'snack',
          isActive: true,
          customName: slot.name,
          displayOrder: index
        })),
        // Transform participants
        participants: wizardData.participants.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          mealCoefficients: {
            breakfast: p.mealCoefficient,
            lunch: p.mealCoefficient,
            dinner: p.mealCoefficient
          }
        })),
        days: [] // Will be populated by backend based on date range
      }

      const newTrip = await createTrip(tripData)

      toast({
        title: 'Trip created successfully!',
        description: `${newTrip.name} has been created and is ready for meal planning.`,
        variant: 'success'
      })

      // Navigate to the trip detail page
      navigate(`/trips/${newTrip.id}`)
    } catch (err: any) {
      console.error('Failed to create trip:', err)
      
      toast({
        title: 'Failed to create trip',
        description: err.response?.data?.message || 'An error occurred while creating the trip. Please try again.',
        variant: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const breadcrumbItems = [
    { label: 'Trips', href: '/trips' },
    { label: 'Create New Trip' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumbs items={breadcrumbItems} />
          
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Create New Trip
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Plan your next adventure with our guided trip creation wizard
              </p>
            </div>
            
            <Button
              variant="outline"
              onClick={() => navigate('/trips')}
              className="hidden md:flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Trips
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && !isSubmitting && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && !isSubmitting && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        )}

        {/* Trip Wizard */}
        {!loading && (
          <TripWizard onComplete={handleComplete} />
        )}

        {/* Submitting Overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Creating your trip...
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please wait while we set up your trip
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TripCreatePage