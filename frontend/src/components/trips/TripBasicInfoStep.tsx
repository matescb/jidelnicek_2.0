import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, MapPin, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Calendar } from '../ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { useTripWizard } from './TripWizardContext';
import { TripBasicInfo } from './TripWizardTypes';

const basicInfoSchema = z.object({
  name: z.string().min(1, 'Trip name is required').max(100, 'Trip name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  startDate: z.date({
    required_error: 'Start date is required',
  }),
  endDate: z.date({
    required_error: 'End date is required',
  }),
  location: z.string().max(200, 'Location is too long').optional(),
  tripType: z.enum(['camping', 'hotel', 'cottage', 'other']),
}).refine((data) => data.startDate <= data.endDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

type BasicInfoFormData = z.infer<typeof basicInfoSchema>;

export const TripBasicInfoStep: React.FC = () => {
  const { data, updateBasicInfo } = useTripWizard();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: data.basicInfo,
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  const onSubmit = (formData: BasicInfoFormData) => {
    updateBasicInfo(formData);
  };

  // Auto-save on blur
  const handleBlur = () => {
    handleSubmit(onSubmit)();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Basic Information</h2>
        <p className="text-gray-600">Let's start with the basic details of your trip.</p>
      </div>

      {/* Trip Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="required">
          Trip Name
        </Label>
        <Input
          id="name"
          placeholder="Summer camping 2024"
          {...register('name')}
          onBlur={handleBlur}
          className={cn(errors.name && 'border-red-500')}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="A relaxing weekend in the mountains..."
          rows={3}
          {...register('description')}
          onBlur={handleBlur}
          className={cn(errors.description && 'border-red-500')}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="required">
            Start Date
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground',
                  errors.startDate && 'border-red-500'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  setValue('startDate', date || new Date());
                  handleBlur();
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.startDate && (
            <p className="text-sm text-red-500">{errors.startDate.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate" className="required">
            End Date
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground',
                  errors.endDate && 'border-red-500'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => {
                  setValue('endDate', date || new Date());
                  handleBlur();
                }}
                disabled={(date) => date < startDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.endDate && (
            <p className="text-sm text-red-500">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">
          <MapPin className="inline-block w-4 h-4 mr-1" />
          Location
        </Label>
        <Input
          id="location"
          placeholder="Blue Mountains, NSW"
          {...register('location')}
          onBlur={handleBlur}
          className={cn(errors.location && 'border-red-500')}
        />
        {errors.location && (
          <p className="text-sm text-red-500">{errors.location.message}</p>
        )}
      </div>

      {/* Trip Type */}
      <div className="space-y-2">
        <Label htmlFor="tripType" className="required">
          Trip Type
        </Label>
        <Select
          value={watch('tripType')}
          onValueChange={(value: TripBasicInfo['tripType']) => {
            setValue('tripType', value);
            handleBlur();
          }}
        >
          <SelectTrigger className={cn(errors.tripType && 'border-red-500')}>
            <SelectValue placeholder="Select trip type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="camping">Camping</SelectItem>
            <SelectItem value="hotel">Hotel</SelectItem>
            <SelectItem value="cottage">Cottage</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {errors.tripType && (
          <p className="text-sm text-red-500">{errors.tripType.message}</p>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Trip Duration</p>
          <p>
            Your trip is planned for{' '}
            {startDate && endDate
              ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
              : 0}{' '}
            days.
          </p>
        </div>
      </div>
    </form>
  );
};