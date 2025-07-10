import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, Clock, Calendar, Coffee, Sandwich, Pizza } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/tabs';
import { useTripWizard } from './TripWizardContext';
import { MealSlot } from './TripWizardTypes';

const mealSlotSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name is too long'),
  defaultTime: z.string().optional(),
  type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'custom']),
});

type MealSlotFormData = z.infer<typeof mealSlotSchema>;

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

export const TripMealSlotsStep: React.FC = () => {
  const { data, addMealSlot, updateMealSlot, removeMealSlot, updateDayMealSlots } = useTripWizard();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<MealSlot | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<MealSlotFormData>({
    resolver: zodResolver(mealSlotSchema),
    defaultValues: {
      name: '',
      defaultTime: '',
      type: 'custom',
    },
  });

  const onSubmit = (formData: MealSlotFormData) => {
    if (editingSlot) {
      updateMealSlot(editingSlot.id, formData);
    } else {
      addMealSlot(formData);
    }
    handleClose();
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingSlot(null);
    reset();
  };

  const handleEdit = (slot: MealSlot) => {
    setEditingSlot(slot);
    reset(slot);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this meal slot?')) {
      removeMealSlot(id);
    }
  };

  const toggleMealSlotForDay = (date: Date, slotId: string) => {
    const day = data.dayMealSlots.find(
      (d) => d.date.toDateString() === date.toDateString()
    );
    if (!day) return;

    const newSlots = day.mealSlots.includes(slotId)
      ? day.mealSlots.filter((id) => id !== slotId)
      : [...day.mealSlots, slotId];

    updateDayMealSlots(date, newSlots);
  };

  const toggleAllDays = (slotId: string, checked: boolean) => {
    data.dayMealSlots.forEach((day) => {
      const newSlots = checked
        ? [...new Set([...day.mealSlots, slotId])]
        : day.mealSlots.filter((id) => id !== slotId);
      updateDayMealSlots(day.date, newSlots);
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Meal Schedule</h2>
        <p className="text-gray-600">Configure when and what meals will be served.</p>
      </div>

      {/* Add Meal Slot Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Meal Slot
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {editingSlot ? 'Edit Meal Slot' : 'Add Meal Slot'}
              </DialogTitle>
              <DialogDescription>
                Define a meal time for your trip.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="required">
                  Meal Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Breakfast, Lunch, Snack"
                  {...register('name')}
                  className={cn(errors.name && 'border-red-500')}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="type" className="required">
                  Meal Type
                </Label>
                <Select
                  value={watch('type')}
                  onValueChange={(value: MealSlot['type']) => setValue('type', value)}
                >
                  <SelectTrigger className={cn(errors.type && 'border-red-500')}>
                    <SelectValue placeholder="Select meal type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-red-500">{errors.type.message}</p>
                )}
              </div>

              {/* Default Time */}
              <div className="space-y-2">
                <Label htmlFor="defaultTime">Default Time</Label>
                <Input
                  id="defaultTime"
                  type="time"
                  {...register('defaultTime')}
                  className={cn(errors.defaultTime && 'border-red-500')}
                />
                {errors.defaultTime && (
                  <p className="text-sm text-red-500">{errors.defaultTime.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSlot ? 'Update' : 'Add'} Meal Slot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="schedule">Day-by-Day Schedule</TabsTrigger>
          <TabsTrigger value="slots">Meal Slots</TabsTrigger>
        </TabsList>

        {/* Day-by-Day Schedule */}
        <TabsContent value="schedule" className="space-y-4">
          {data.dayMealSlots.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No days configured yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                Please set trip dates in the basic info step.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Toggle All Controls */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Quick Actions:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.mealSlots.map((slot) => {
                    const Icon = getMealIcon(slot.type);
                    const allChecked = data.dayMealSlots.every((day) =>
                      day.mealSlots.includes(slot.id)
                    );
                    return (
                      <div key={slot.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`toggle-all-${slot.id}`}
                          checked={allChecked}
                          onCheckedChange={(checked) => toggleAllDays(slot.id, !!checked)}
                        />
                        <Label
                          htmlFor={`toggle-all-${slot.id}`}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Icon className="h-4 w-4" />
                          {slot.name} on all days
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Days List */}
              {data.dayMealSlots.map((day, index) => {
                const isFirstDay = index === 0;
                const isLastDay = index === data.dayMealSlots.length - 1;
                
                return (
                  <div
                    key={day.date.toISOString()}
                    className="bg-white border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">
                        {format(day.date, 'EEEE, MMMM d')}
                      </h4>
                      <div className="flex gap-1">
                        {isFirstDay && (
                          <Badge variant="secondary">Arrival</Badge>
                        )}
                        {isLastDay && (
                          <Badge variant="secondary">Departure</Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {data.mealSlots.map((slot) => {
                        const Icon = getMealIcon(slot.type);
                        return (
                          <div key={slot.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${day.date.toISOString()}-${slot.id}`}
                              checked={day.mealSlots.includes(slot.id)}
                              onCheckedChange={() => toggleMealSlotForDay(day.date, slot.id)}
                            />
                            <Label
                              htmlFor={`${day.date.toISOString()}-${slot.id}`}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Icon className="h-4 w-4" />
                              {slot.name}
                              {slot.defaultTime && (
                                <span className="text-sm text-gray-500">
                                  ({slot.defaultTime})
                                </span>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Meal Slots List */}
        <TabsContent value="slots" className="space-y-4">
          {data.mealSlots.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No meal slots configured.</p>
              <p className="text-sm text-gray-500 mt-1">
                Add meal slots to define when meals will be served.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {data.mealSlots.map((slot) => {
                const Icon = getMealIcon(slot.type);
                return (
                  <div
                    key={slot.id}
                    className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-gray-600" />
                        <div>
                          <h4 className="font-medium">{slot.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {slot.type}
                            </Badge>
                            {slot.defaultTime && (
                              <span className="text-sm text-gray-500">
                                {slot.defaultTime}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(slot)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(slot.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Summary */}
      {data.mealSlots.length > 0 && data.dayMealSlots.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>{data.mealSlots.length}</strong> meal slot
            {data.mealSlots.length > 1 ? 's' : ''} configured •{' '}
            <strong>
              {data.dayMealSlots.reduce((sum, day) => sum + day.mealSlots.length, 0)}
            </strong>{' '}
            total meals planned across {data.dayMealSlots.length} days
          </p>
        </div>
      )}
    </div>
  );
};