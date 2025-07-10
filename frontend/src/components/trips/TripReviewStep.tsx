import React from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  MapPin,
  Users,
  Utensils,
  Clock,
  CheckCircle,
  AlertCircle,
  Crown,
  Coffee,
  Sandwich,
  Pizza,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useTripWizard } from './TripWizardContext';
import { MealSlot } from './TripWizardTypes';

const getMealIcon = (type: MealSlot['type']) => {
  switch (type) {
    case 'breakfast':
      return Coffee;
    case 'lunch':
      return Sandwich;
    case 'dinner':
      return Pizza;
    default:
      return Clock;
  }
};

export const TripReviewStep: React.FC = () => {
  const { data } = useTripWizard();
  const { basicInfo, participants, mealSlots, dayMealSlots } = data;

  const tripDuration = Math.ceil(
    (basicInfo.endDate.getTime() - basicInfo.startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const totalMealPortions = participants.reduce(
    (sum, p) => sum + p.mealCoefficient,
    0
  );

  const totalMeals = dayMealSlots.reduce(
    (sum, day) => sum + day.mealSlots.length,
    0
  );

  const organizers = participants.filter((p) => p.isOrganizer);
  const dietaryRestrictions = participants
    .flatMap((p) => p.dietaryRestrictions || [])
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Review & Confirm</h2>
        <p className="text-gray-600">
          Review your trip details before creating it.
        </p>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg">{basicInfo.name}</h3>
            {basicInfo.description && (
              <p className="text-gray-600 mt-1">{basicInfo.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-medium">
                  {format(basicInfo.startDate, 'MMM d')} -{' '}
                  {format(basicInfo.endDate, 'MMM d, yyyy')} ({tripDuration} days)
                </p>
              </div>
            </div>

            {basicInfo.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">{basicInfo.location}</p>
                </div>
              </div>
            )}
          </div>

          <Badge variant="secondary" className="mt-2">
            {basicInfo.tripType}
          </Badge>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Participants ({participants.length})
          </CardTitle>
          <CardDescription>
            Total meal portions: {totalMealPortions.toFixed(1)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{participant.name}</span>
                    {participant.isOrganizer && (
                      <Crown className="h-4 w-4 text-yellow-600" />
                    )}
                  </div>
                  {participant.email && (
                    <p className="text-sm text-gray-500">{participant.email}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    Coefficient: {participant.mealCoefficient}
                  </p>
                  {participant.dietaryRestrictions &&
                    participant.dietaryRestrictions.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {participant.dietaryRestrictions.length} restriction
                        {participant.dietaryRestrictions.length > 1 ? 's' : ''}
                      </p>
                    )}
                </div>
              </div>
            ))}
          </div>

          {dietaryRestrictions.length > 0 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Dietary Restrictions</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap gap-1 mt-2">
                  {dietaryRestrictions.map((restriction) => (
                    <Badge key={restriction} variant="outline" className="text-xs">
                      {restriction}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Meal Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-orange-600" />
            Meal Schedule
          </CardTitle>
          <CardDescription>
            {totalMeals} meals across {dayMealSlots.length} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Meal Slots Overview */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Meal Types:</h4>
            <div className="flex flex-wrap gap-2">
              {mealSlots.map((slot) => {
                const Icon = getMealIcon(slot.type);
                return (
                  <div
                    key={slot.id}
                    className="flex items-center gap-1 bg-gray-50 rounded-md px-3 py-1"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{slot.name}</span>
                    {slot.defaultTime && (
                      <span className="text-xs text-gray-500">
                        ({slot.defaultTime})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Summary */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Daily Breakdown:</h4>
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {dayMealSlots.map((day, index) => {
                const isFirstDay = index === 0;
                const isLastDay = index === dayMealSlots.length - 1;
                
                return (
                  <div
                    key={day.date.toISOString()}
                    className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {format(day.date, 'EEE, MMM d')}
                      </span>
                      {(isFirstDay || isLastDay) && (
                        <Badge variant="outline" className="text-xs">
                          {isFirstDay && 'Arrival'}
                          {isLastDay && 'Departure'}
                        </Badge>
                      )}
                    </div>
                    <span className="text-gray-600">
                      {day.mealSlots.length} meal{day.mealSlots.length > 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-800">Trip Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-700">{tripDuration}</p>
              <p className="text-sm text-green-600">Days</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">
                {participants.length}
              </p>
              <p className="text-sm text-green-600">Participants</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{totalMeals}</p>
              <p className="text-sm text-green-600">Total Meals</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">
                {(totalMeals * totalMealPortions).toFixed(0)}
              </p>
              <p className="text-sm text-green-600">Meal Portions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>Ready to create your trip!</AlertTitle>
        <AlertDescription>
          Review the information above and click "Create Trip" to finalize. You can
          always edit these details later.
        </AlertDescription>
      </Alert>
    </div>
  );
};